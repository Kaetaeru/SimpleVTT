/**
 * The launched campaign table (ROLL20_MODEL.md): the campaign's fixed join code admits players and remembers
 * them; kicked players are refused; chat commands become archive messages with Roll20 visibility (whispers to
 * sender/target/GM, GM rolls to roller/GM); GM-only role changes; reconnect replays only what the viewer may see.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newCampaign, withPlayerKicked } from "../../client/campaign/model";
import { parseChatInput, renderInline, visibleTo } from "../../client/session/chat";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { decodeInvite, encodeInvite } from "../../client/session/protocol";
import { MemoryHub } from "../../client/session/transport";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 4) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage(overrides: Partial<Parameters<typeof newCampaign>[1]> = {}) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("잃어버린 광산", { userId: "dm", displayName: "DM 민수", ...overrides }), joinCode: "ABC234" };
  const saved: { campaign: typeof campaign | null; chat: number } = { campaign: null, chat: 0 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s3cret", onCampaign: (next) => { saved.campaign = next; }, onChat: () => { saved.chat += 1; }, random: () => 0.5 });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM 민수", joinCode: "ABC234", hostSecret: "s3cret" });
  return { hub, host, dm, saved, campaign };
}

test("chat input parses Roll20 commands and inline rolls", () => {
  assert.deepEqual(parseChatInput("/roll 1d20+5 # 공격"), { kind: "roll", formula: "1d20+5", label: "공격", mode: "public" });
  assert.deepEqual(parseChatInput("/gr 2d6"), { kind: "roll", formula: "2d6", label: undefined, mode: "gm" });
  assert.deepEqual(parseChatInput('/w "DM 민수" 몰래 말할게'), { kind: "whisper", target: "DM 민수", text: "몰래 말할게" });
  assert.deepEqual(parseChatInput("/w gm 이거 봐"), { kind: "whisper", target: "gm", text: "이거 봐" });
  assert.deepEqual(parseChatInput("/em 웃는다"), { kind: "emote", text: "웃는다" });
  assert.deepEqual(parseChatInput("/desc 문이 삐걱 열린다"), { kind: "desc", text: "문이 삐걱 열린다" });
  assert.deepEqual(parseChatInput("공격 [[1d20+3]] 피해 [[2d6]]"), { kind: "say", text: "공격 [[1d20+3]] 피해 [[2d6]]", inline: ["1d20+3", "2d6"] });
  assert.equal(renderInline("공격 [[1d20+3]] 피해 [[2d6]]", [17, 8]), "공격 [17] 피해 [8]");
  assert.deepEqual(parseChatInput("   "), { kind: "empty" });
  assert.equal(parseChatInput("/roll abc").kind, "say", "a bad formula is plain text");
});

test("join code admits and remembers players; a wrong code and a kicked player are refused; the code is fixed", async () => {
  const { hub, host, saved } = stage();
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "abc234" });
  const wrong = new TableClient(hub.connect("p2"), { userId: "mallory", displayName: "말로리", joinCode: "ZZZZZZ" });
  const impostor = new TableClient(hub.connect("p3"), { userId: "dm", displayName: "가짜", joinCode: "ABC234" });
  await tick();
  assert.equal(alice.status, "joined", "lower-case code is accepted");
  assert.equal(wrong.status, "refused");
  assert.equal(impostor.status, "refused", "the host's user id needs the host secret");
  assert.ok(saved.campaign?.players.some((player) => player.userId === "alice" && player.role === "player" && player.color), "the campaign remembers alice with a color");
  assert.equal(host.state.joinCode, "ABC234", "the code did not change");
  alice.leave();
  await tick();
  assert.equal(host.state.players.find((player) => player.userId === "alice")?.lastSeenAt !== undefined, true);
  host.updateCampaign(withPlayerKicked(host.state, "alice", true));
  const back = new TableClient(hub.connect("p1b"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  assert.equal(back.status, "refused");
  assert.ok(back.reason?.includes("내보낸"));
});

test("chat: say, inline rolls, whispers to the target and the GM only, GM rolls hidden from others, /desc is GM-only", async () => {
  const { hub, dm, saved } = stage();
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  await tick();
  alice.send({ type: "chat.say", text: "안녕 [[1d20+3]]" });
  alice.send({ type: "chat.say", text: "/w 밥 비밀" });
  alice.send({ type: "chat.say", text: "/w gm 힌트 주세요" });
  alice.send({ type: "chat.say", text: "/gmroll 1d20" });
  alice.send({ type: "chat.say", text: "/roll 2d6+1 # 피해" });
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "chat.say", text: "/desc 안 됨" });
  dm.send({ type: "chat.say", text: "/desc 문이 열린다" });
  await tick(6);
  const texts = (client: TableClient) => client.snapshot!.chat.map((message) => `${message.type}:${message.content}`);
  assert.ok(texts(alice).some((line) => line.startsWith("general:안녕 [")), "inline roll rendered");
  assert.ok(texts(bob).includes("whisper:비밀"), "bob gets the whisper to him");
  assert.ok(!texts(bob).includes("whisper:힌트 주세요"), "bob does not get the whisper to the GM");
  assert.ok(texts(dm).includes("whisper:힌트 주세요") && texts(dm).includes("whisper:비밀"), "the GM sees every whisper");
  assert.ok(texts(alice).some((line) => line.startsWith("gmroll:")) && texts(dm).some((line) => line.startsWith("gmroll:")) && !texts(bob).some((line) => line.startsWith("gmroll:")), "GM roll: roller and GM only");
  const damage = alice.snapshot!.chat.find((message) => message.type === "rollresult")!;
  assert.equal(damage.roll?.formula, "2d6+1");
  assert.equal(damage.roll?.total, 4 + 4 + 1, "random 0.5 on d6 gives 4");
  assert.ok(refusals.some((reason) => reason.includes("/desc")));
  assert.ok(texts(bob).includes("desc:문이 열린다"));
  assert.ok(saved.chat >= 6, "every message reached the archive callback");
});

test("GM promotes and kicks; a reconnecting viewer replays only what it may see", async () => {
  const { hub, host, dm } = stage();
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  let bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  await tick();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "player.role", userId: "bob", role: "gm" });
  await tick();
  assert.ok(refusals[0]?.includes("GM만"));
  dm.send({ type: "player.role", userId: "alice", role: "gm" });
  await tick();
  assert.equal(host.state.players.find((player) => player.userId === "alice")?.role, "gm");
  const lastSeen = bob.snapshot!.lastEventN;
  bob.leave();
  await tick();
  alice.send({ type: "chat.say", text: "/w gm 밥 몰래" });
  alice.send({ type: "chat.say", text: "밥 돌아와" });
  await tick();
  bob = new TableClient(hub.connect("p2b"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  (bob as unknown as { snapshotState: unknown; lastEventN: number }).snapshotState = { campaignId: "", name: "", players: [], chat: [], lastEventN: lastSeen };
  (bob as unknown as { lastEventN: number }).lastEventN = lastSeen;
  await tick();
  const replayed = bob.snapshot!.chat.map((message) => message.content);
  assert.ok(replayed.includes("밥 돌아와"));
  assert.ok(!replayed.includes("밥 몰래"), "a whisper to the GM is not replayed to bob");
  dm.send({ type: "player.kick", userId: "bob" });
  await tick();
  assert.equal(bob.status, "refused");
  assert.equal(host.state.players.find((player) => player.userId === "bob")?.kicked, true);
  assert.ok(!alice.snapshot!.players.some((player) => player.userId === "bob"), "others no longer list bob");
});

test("invite codes carry the campaign's fixed code for tab and tcp carriers", () => {
  assert.equal(encodeInvite({ carrier: "tab", address: "camp_1", joinCode: "K7QX3M" }), "tab:camp_1-K7QX3M");
  assert.deepEqual(decodeInvite("25.12.34.56:41230-k7qx3m"), { carrier: "tcp", address: "25.12.34.56:41230", joinCode: "K7QX3M" });
  assert.equal(decodeInvite("garbage"), null);
  assert.equal(visibleTo({ id: "m", at: "", type: "whisper", who: "a", playerId: "a", target: "gm", content: "x" }, { userId: "b", role: "player" }), false);
  assert.equal(visibleTo({ id: "m", at: "", type: "whisper", who: "a", playerId: "a", target: "gm", content: "x" }, { userId: "c", role: "gm" }), true);
});

test("documents of another shape are skipped and older rows of this shape are repaired", async () => {
  const { isStoredDocument, repairCampaign } = await import("../../client/campaign/model");
  const rejectedBuild = { schema: 1, id: "doc_1", kind: "campaign", name: "옛 캠페인", version: 1, updatedAt: "2026-09-15T00:00:00Z", ownership: { default: "none", users: {} }, data: { players: [] } };
  const rejectedHandout = { schema: 1, id: "doc_2", kind: "handout", name: "옛 핸드아웃", version: 1, updatedAt: "", ownership: {}, data: { blocks: [] } };
  assert.equal(isStoredDocument(rejectedBuild), false);
  assert.equal(isStoredDocument(rejectedHandout), false);
  assert.equal(isStoredDocument({ id: "x", kind: "scene" }), false);
  const current = newCampaign("지금", { userId: "dm", displayName: "DM" });
  assert.equal(isStoredDocument(current), true);
  assert.equal(isStoredDocument({ id: "chat_x", kind: "chat", campaignId: "x", messages: [] }), true);
  const older = { ...current, settings: { playersCanCreateCharacters: false } as unknown as typeof current.settings, description: undefined as unknown as string, players: [{ userId: "u1", displayName: "누구" } as unknown as typeof current.players[number]] };
  const repaired = repairCampaign(older);
  assert.deepEqual(repaired.settings, { playersCanCreateCharacters: false, playersCanExportToVault: true, chatAvatars: true });
  assert.equal(repaired.description, "");
  assert.equal(repaired.players[0].role, "player");
  assert.ok(repaired.players[0].color && repaired.players[0].joinedAt);
});
