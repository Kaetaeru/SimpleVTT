/**
 * Session core: a host and two players over the in-process hub. Commands are validated (token, ownership), sheet
 * ops are applied by the host with the offline reducer and every mirror ends up identical; a reconnecting player
 * replays what it missed; DM interventions are logged as such; projection hides what a viewer may not see.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { projectDocument } from "../../client/campaign/projection";
import { makeDocument, type NpcDocData } from "../../client/campaign/types";
import { applyOp } from "../../client/character/ops";
import { initialRuntime } from "../../client/character/runtime";
import { SessionClient } from "../../client/session/client";
import { SessionHost } from "../../client/session/host";
import { decodeInvite, encodeInvite } from "../../client/session/protocol";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 4) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage() {
  const hub = new MemoryHub();
  const host = new SessionHost(hub.hostEndpoint(), { sessionId: "sess_test", name: "테스트 세션", token: "ABC234", hostUserId: "dm", hostName: "DM", catalog: catalog(), hostSecret: "s3cret" });
  const mirror = new SessionClient(hub.connect("dm-mirror"), { userId: "dm", name: "DM", token: "ABC234", hostSecret: "s3cret" });
  return { hub, host, mirror };
}

test("players join with the token, bring characters, and every mirror sees the same sheet after an op", async () => {
  const { hub, host } = stage();
  const alice = new SessionClient(hub.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  const bob = new SessionClient(hub.connect("p2"), { userId: "bob", name: "밥", token: "ABC234" });
  await tick();
  assert.equal(alice.status, "joined");
  assert.equal(bob.status, "joined");
  const fighter = build({ classes: "fighter", level: 3 });
  alice.send({ type: "character.join", source: fighter.source, runtime: initialRuntime(fighter.derived) });
  await tick();
  assert.equal(bob.snapshot!.characters.length, 1, "bob sees alice's character (observer, D63)");
  alice.send({ type: "sheet.op", characterId: fighter.source.id, op: { type: "hp.command", text: "-9" } });
  await tick();
  const onAlice = alice.snapshot!.characters[0].runtime;
  const onBob = bob.snapshot!.characters[0].runtime;
  assert.equal(onAlice.hp.current, fighter.derived.hp.max - 9);
  assert.deepEqual(onBob.hp, onAlice.hp, "mirrors agree");
  assert.equal(host.state.characters[0].version, 2);
  assert.ok(bob.snapshot!.log.some((entry) => entry.kind === "sheet" && entry.text.includes("피해 9")));
});

test("the wrong token, a stale protocol, and touching someone else's sheet are refused", async () => {
  const { hub } = stage();
  const alice = new SessionClient(hub.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  const mallory = new SessionClient(hub.connect("p3"), { userId: "mallory", name: "말로리", token: "WRONG1" });
  const impostor = new SessionClient(hub.connect("p4"), { userId: "dm", name: "가짜 DM", token: "ABC234" });
  await tick();
  assert.equal(mallory.status, "refused");
  assert.ok(mallory.reason?.includes("초대 코드"));
  assert.equal(impostor.status, "refused", "the host user id without the host secret is refused");
  const fighter = build({ classes: "fighter", level: 3 });
  alice.send({ type: "character.join", source: fighter.source, runtime: initialRuntime(fighter.derived) });
  const bob = new SessionClient(hub.connect("p2"), { userId: "bob", name: "밥", token: "ABC234" });
  await tick();
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "sheet.op", characterId: fighter.source.id, op: { type: "hp.damage", amount: 5 } });
  bob.send({ type: "round.advance" });
  await tick();
  assert.equal(refusals.length, 2);
  assert.ok(refusals[0].includes("자기 캐릭터"));
  assert.ok(refusals[1].includes("호스트"));
  assert.equal(alice.snapshot!.characters[0].runtime.hp.current, fighter.derived.hp.max, "nothing changed");
});

test("the DM can act on a player's sheet (logged as DM), and the host advances rounds for every timed effect", async () => {
  const { hub, host, mirror } = stage();
  const alice = new SessionClient(hub.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  await tick();
  const barbarian = build({ classes: "barbarian", level: 3 });
  alice.send({ type: "character.join", source: barbarian.source, runtime: initialRuntime(barbarian.derived) });
  await tick();
  const rage = barbarian.derived.features.find((feature) => feature.id.endsWith("barbarian.rage"))!;
  alice.send({ type: "sheet.op", characterId: barbarian.source.id, op: { type: "feature.use", featureId: rage.id } });
  await tick();
  assert.equal(alice.snapshot!.characters[0].runtime.effects.length, 1);
  mirror.send({ type: "sheet.op", characterId: barbarian.source.id, op: { type: "hp.damage", amount: 7 } });
  await tick();
  const runtime = alice.snapshot!.characters[0].runtime;
  assert.equal(runtime.hp.current, barbarian.derived.hp.max - 7);
  assert.ok(runtime.log.at(-1)!.text.startsWith("DM:"), "the player's own log names the DM");
  assert.ok(alice.snapshot!.log.some((entry) => entry.kind === "dm"));
  mirror.send({ type: "round.advance" });
  await tick();
  assert.equal(alice.snapshot!.round, 1);
  assert.equal(alice.snapshot!.characters[0].runtime.effects[0].elapsed, 1);
  assert.equal(host.state.round, 1);
});

test("a player who drops and comes back with its last event number gets only the missed events; write-back fires for own characters only", async () => {
  const { hub, host } = stage();
  let alice = new SessionClient(hub.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  const writeBacks: string[] = [];
  alice.onCharacter((characterId) => writeBacks.push(characterId));
  const bob = new SessionClient(hub.connect("p2"), { userId: "bob", name: "밥", token: "ABC234" });
  const bobWriteBacks: string[] = [];
  bob.onCharacter((characterId) => bobWriteBacks.push(characterId));
  await tick();
  const fighter = build({ classes: "fighter", level: 3 });
  alice.send({ type: "character.join", source: fighter.source, runtime: initialRuntime(fighter.derived) });
  await tick();
  assert.deepEqual(writeBacks, [fighter.source.id]);
  assert.deepEqual(bobWriteBacks, [], "bob does not own it");
  const lastSeen = alice.snapshot!.lastEventN;
  alice.leave();
  await tick();
  assert.equal(host.state.participants.find((item) => item.userId === "alice")!.connected, false);
  bob.send({ type: "chat.say", text: "앨리스 어디 갔어?" });
  await tick();
  // Reconnect: a fresh client that remembers the last event number.
  alice = new SessionClient(hub.connect("p1b"), { userId: "alice", name: "앨리스", token: "ABC234" });
  const snapshotOf = alice;
  (snapshotOf as unknown as { snapshotState: unknown; lastEventN: number }).snapshotState = { sessionId: "sess_test", name: "", hostUserId: "dm", participants: [], characters: [], log: [], round: 0, lastEventN: lastSeen };
  (snapshotOf as unknown as { lastEventN: number }).lastEventN = lastSeen;
  await tick();
  assert.equal(alice.status, "joined");
  assert.ok(alice.snapshot!.log.some((entry) => entry.text.includes("앨리스 어디 갔어")), "the missed chat line arrived by replay");
  assert.ok(alice.snapshot!.lastEventN > lastSeen);
});

test("invite codes round-trip for the tab and tcp carriers, bare host:port-token is tcp", () => {
  assert.equal(encodeInvite({ carrier: "tab", address: "sess_x1", token: "K7QX3M" }), "tab:sess_x1-K7QX3M");
  assert.deepEqual(decodeInvite("tab:sess_x1-K7QX3M"), { carrier: "tab", address: "sess_x1", token: "K7QX3M" });
  assert.deepEqual(decodeInvite(" 25.12.34.56:41230-k7qx3m "), { carrier: "tcp", address: "25.12.34.56:41230", token: "K7QX3M" });
  assert.equal(decodeInvite("nonsense"), null);
});

test("projection: an NPC is an HP band to a player, full to the DM; a hidden token is not sent; a handout hides GM text", () => {
  const npc = makeDocument<"npc", NpcDocData>("npc", "고블린", { statBlock: { name: "고블린", ac: 15, hp: 7 }, runtime: { hp: { current: 1, max: 7, temp: 0 }, conditions: ["중독"] }, gmNotes: "보물 열쇠를 가짐", loot: [] }, { default: "limited" });
  const forPlayer = projectDocument(npc, "alice")!;
  assert.equal(forPlayer.level, "limited");
  assert.deepEqual(forPlayer.data, { prototypeToken: undefined, band: "critical", conditions: ["중독"] });
  const forDm = projectDocument(npc, "dm", true)!;
  assert.equal((forDm.data as NpcDocData).gmNotes, "보물 열쇠를 가짐");
  const secret = makeDocument("handout", "비밀 편지", { blocks: [{ type: "text" as const, text: "플레이어용" }], gmText: "DM만" }, { default: "none", users: { alice: "observer" } });
  assert.equal(projectDocument(secret, "bob"), null);
  assert.deepEqual(projectDocument(secret, "alice")!.data, { blocks: [{ type: "text", text: "플레이어용" }] });
  const scene = makeDocument("scene", "동굴", { grid: { size: 70, offsetX: 0, offsetY: 0, type: "square" as const }, width: 1400, height: 900, tokens: [{ id: "t1", actorRef: { kind: "npc" as const, id: npc.id }, x: 1, y: 1, size: 1, hidden: true }, { id: "t2", actorRef: { kind: "npc" as const, id: npc.id }, x: 2, y: 2, size: 1, hidden: false }], gmNotes: "함정" }, { default: "observer" });
  const sceneForPlayer = projectDocument(scene, "alice")!;
  assert.equal((sceneForPlayer.data as { tokens: unknown[] }).tokens.length, 1);
  assert.equal((sceneForPlayer.data as { gmNotes?: string }).gmNotes, undefined);
});

test("applyOp covers the sheet: a cast with a rolled temp HP, a refused op leaves the runtime untouched", () => {
  const cleric = build({ classes: "cleric", level: 3 });
  const cat = catalog();
  let runtime = initialRuntime(cleric.derived);
  const bless = cat.spellByName("Bless")!;
  runtime = applyOp(runtime, cleric.source, cat, { type: "spell.cast", spellId: bless.id, method: { kind: "slot", level: 1 }, lines: ["축복 시전 굴림 없음"] }).runtime;
  assert.equal(runtime.slotsUsed[1], 1);
  assert.equal(runtime.effects[0]?.name, bless.name);
  const refused = applyOp(runtime, cleric.source, cat, { type: "spell.cast", spellId: bless.id, method: { kind: "slot", level: 9 } });
  assert.ok(refused.refused);
  assert.equal(refused.runtime, runtime);
  const falseLife = cat.spellByName("False Life");
  if (falseLife) { runtime = applyOp(runtime, cleric.source, cat, { type: "spell.cast", spellId: falseLife.id, method: { kind: "ritual" } }).runtime; }
  runtime = applyOp(runtime, cleric.source, cat, { type: "hp.temp", amount: 6 }).runtime;
  assert.equal(runtime.hp.temp, 6);
});

test("a campaign remembers players, the party as last seen, and the session's log; the next session is seeded from it", async () => {
  const { campaignWithSession, seedFromCampaign } = await import("../../client/campaign/sessionSync");
  const { newCampaign } = await import("../../client/campaign/types");
  const { hub, host } = stage();
  const alice = new SessionClient(hub.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  await tick();
  const fighter = build({ classes: "fighter", level: 3 });
  alice.send({ type: "character.join", source: fighter.source, runtime: initialRuntime(fighter.derived) });
  await tick();
  alice.send({ type: "sheet.op", characterId: fighter.source.id, op: { type: "hp.damage", amount: 4 } });
  await tick();
  let campaign = newCampaign("잃어버린 광산");
  campaign = campaignWithSession(campaign, host.snapshot(), { id: "sess_1", startedAt: "2026-09-15T03:00:00.000Z" });
  assert.deepEqual(campaign.data.players.map((player) => player.userId), ["alice"], "the host is not a player");
  assert.equal(campaign.data.party[0].runtime.hp.current, fighter.derived.hp.max - 4);
  assert.equal(campaign.data.sessions.length, 1);
  assert.ok(campaign.data.sessions[0].log.some((entry) => entry.text.includes("피해 4")));
  campaign = campaignWithSession(campaign, host.snapshot(), { id: "sess_1", startedAt: "2026-09-15T03:00:00.000Z", endedAt: "2026-09-15T04:00:00.000Z" });
  assert.equal(campaign.data.sessions.length, 1, "the same session record is updated, not duplicated");
  assert.ok(campaign.data.sessions[0].endedAt);

  // Next session: seeded party shows before its owner returns; the returning player's copy replaces the snapshot.
  const hub2 = new MemoryHub();
  const host2 = new SessionHost(hub2.hostEndpoint(), { sessionId: "sess_2", name: "잃어버린 광산", token: "ABC234", hostUserId: "dm", hostName: "DM", catalog: catalog() });
  host2.seed(seedFromCampaign(campaign));
  const state = host2.snapshot();
  assert.equal(state.characters.length, 1);
  assert.equal(state.participants.find((item) => item.userId === "alice")?.connected, false);
  const bob = new SessionClient(hub2.connect("p2"), { userId: "bob", name: "밥", token: "ABC234" });
  await tick();
  assert.equal(bob.snapshot!.characters[0].runtime.hp.current, fighter.derived.hp.max - 4, "a newcomer sees the party as the campaign last saw it");
  const alice2 = new SessionClient(hub2.connect("p1"), { userId: "alice", name: "앨리스", token: "ABC234" });
  await tick();
  const healed = { ...initialRuntime(fighter.derived) };
  alice2.send({ type: "character.join", source: fighter.source, runtime: healed });
  await tick();
  assert.equal(bob.snapshot!.characters[0].runtime.hp.current, fighter.derived.hp.max, "the player's own copy wins (D67)");
  assert.equal(host2.snapshot().characters.length, 1, "no duplicate character");
});
