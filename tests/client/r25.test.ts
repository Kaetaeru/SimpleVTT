/**
 * R25 (ROLL20_TABLE_SPEC.md D126–D135): the host stops taking the wire at its word.
 *
 * A launched table hands every participant everyone else's user id, and every command arrived untyped at runtime:
 * `isClientCommand` only checks that `type` is a string. So a join code was enough to be someone else, an actor
 * reference could pair your own token with another character's sheet, a tracker row could point at a sheet you do
 * not control, a roll could be fabricated outright, and nothing bounded what one peer could make the host allocate.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import type { Campaign } from "../../client/campaign/model";
import { build } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const campaignOf = (): Campaign => ({ ...newCampaign("우리 테이블", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" });
function pc(name: string, owner: string): JournalCharacter {
  const made = build({ name, classes: "fighter", level: 3 });
  return newJournalCharacter("c", owner, made.source, initialRuntime(made.derived), { owner });
}

/** A table with the DM's seat, two players, and each one's character and token on the open scene. */
async function seated() {
  const hub = new MemoryHub();
  const campaign = campaignOf();
  const alicePc = pc("앨리스", "alice");
  const bobPc = pc("밥", "bob");
  const page = { ...newScene(campaign.id, "여관", 0), tokens: [{ ...tokenForCharacter(alicePc), id: "tok_alice" }, { ...tokenForCharacter(bobPc), id: "tok_bob" }] };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", pages: [page], journal: [alicePc, bobPc] });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234", seat: "alice-seat" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234", seat: "bob-seat" });
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  await tick();
  dm.send({ type: "page.ribbon", pageId: page.id });
  await tick();
  return { hub, host, dm, alice, bob, page, alicePc, bobPc, refusals };
}

test("authority: a user id is not a claim — a seat secret makes it one (D126)", async () => {
  const { hub, host } = await seated();
  // Mallory read Alice's user id straight out of her own snapshot; the join code is all she has besides.
  const refusals: string[] = [];
  const mallory = new TableClient(hub.connect("p3"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234", seat: "mallory-seat" });
  mallory.onRefused((reason) => refusals.push(reason));
  await tick();
  assert.equal(mallory.status, "refused", "she is not Alice");
  assert.ok(refusals.some((reason) => reason.includes("다른 기기")), JSON.stringify(refusals));
  // Alice's own seat still comes back, as many times as she likes.
  const again = new TableClient(hub.connect("p4"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234", seat: "alice-seat" });
  await tick();
  assert.equal(again.status, "joined");
  assert.equal(host.state.players.find((player) => player.userId === "alice")?.seat, "alice-seat");
});

test("authority: an actor reference must describe one creature (D128)", async () => {
  const { host, alice, bobPc, page, refusals } = await seated();
  // Alice's own token paired with Bob's sheet id: the token passes `mayAct`, the sheet used to be the one acted on.
  alice.send({ type: "act.item", actor: { entryId: bobPc.id, pageId: page.id, tokenId: "tok_alice" }, instanceId: "whatever" });
  await tick();
  assert.ok(refusals.length, "the mixed reference is refused, not resolved into Bob's sheet");
  assert.ok(!host.archive.some((message) => message.type === "action" || message.type === "spell"), JSON.stringify(host.archive.map((message) => message.content)));
  assert.equal((host.journal.find((entry) => entry.id === bobPc.id) as JournalCharacter).runtime.updatedAt, bobPc.runtime.updatedAt, "Bob's sheet was not written to at all");
  // Naming Bob's sheet with no token of your own is refused the same way it always was.
  const before = refusals.length;
  alice.send({ type: "act.item", actor: { entryId: bobPc.id }, instanceId: "whatever" });
  await tick();
  assert.ok(refusals.length > before);
});

test("authority: a player's tracker row describes their own token, not whatever the wire says (D133)", async () => {
  const { host, dm, alice, bobPc, page } = await seated();
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: -1, turns: [], sorted: true } });
  await tick();
  alice.send({ type: "tracker.add", turn: { name: "앨리스", entryId: bobPc.id, pageId: page.id, tokenId: "tok_alice", initiative: 99999, custom: true, formula: "+9999" } });
  await tick();
  const row = host.tracker.turns.find((turn) => turn.tokenId === "tok_alice")!;
  assert.ok(row, "the row is still added — a player may put their own token in the order");
  assert.notEqual(row.entryId, bobPc.id, "but it points at their own character, so 다음 턴 cannot roll Bob's death saves");
  assert.equal(row.custom, false);
  assert.equal(row.formula, undefined);
});

test("authority: a roll is checked against its own formula before it reaches the table (D130)", async () => {
  const { host, alice, refusals } = await seated();
  alice.send({ type: "chat.roll", roll: { formula: "1d20+3", total: 999, dice: [{ sides: 20, value: 20 }], modifier: 3 }, mode: "public" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("합계")), JSON.stringify(refusals));
  assert.ok(!host.archive.some((message) => message.roll?.total === 999));
  // A die that could not have come from the formula is refused too.
  alice.send({ type: "chat.roll", roll: { formula: "1d20+3", total: 103, dice: [{ sides: 100, value: 100 }], modifier: 3 }, mode: "public" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("주사위 눈")), JSON.stringify(refusals));
  // An honest roll goes through untouched, dropped dice and all.
  alice.send({ type: "chat.roll", roll: { formula: "4d6kh3", total: 14, dice: [{ sides: 6, value: 6 }, { sides: 6, value: 5 }, { sides: 6, value: 3 }, { sides: 6, value: 1, dropped: true }], modifier: 0 }, mode: "public" });
  await tick();
  assert.ok(host.archive.some((message) => message.roll?.total === 14), "a real roll is still the sender's own dice");
});

test("authority: a self roll stays with the roller, and the lock on a token means the same for delete (D131, D135)", async () => {
  const { host, dm, alice, bob, page } = await seated();
  alice.send({ type: "chat.roll", roll: { formula: "1d20", total: 7, dice: [{ sides: 20, value: 7 }], modifier: 0 }, mode: "self" });
  await tick();
  assert.ok(alice.snapshot!.chat.some((message) => message.roll?.total === 7), "the roller sees it");
  assert.ok(!bob.snapshot!.chat.some((message) => message.roll?.total === 7), "nobody else does");
  // A locked token cannot be nudged — nor deleted, which used to be the way around the lock.
  const token = host.pageList[0].tokens.find((item) => item.id === "tok_alice")!;
  dm.send({ type: "token.put", pageId: page.id, token: { ...token, locked: true } });
  await tick();
  const locked = host.pageList[0].tokens.find((item) => item.id === "tok_alice")!;
  alice.send({ type: "token.remove", pageId: page.id, id: "tok_alice" });
  await tick();
  assert.ok(host.pageList[0].tokens.some((item) => item.id === "tok_alice"), "the locked token is still there");
  assert.equal(locked.locked, true);
});

test("authority: a bar edit stays inside the sheet, and nothing a peer sends is unbounded (D129)", async () => {
  const { host, dm, alice, alicePc, page, refusals } = await seated();
  const token = host.pageList[0].tokens.find((item) => item.id === "tok_alice")!;
  dm.send({ type: "token.put", pageId: page.id, token: { ...token, bars: [{ ...token.bars[0], link: "hp", editable: true }, token.bars[1], token.bars[2]] } });
  await tick();
  const editable = host.pageList[0].tokens.find((item) => item.id === "tok_alice")!;
  const max = (host.journal.find((entry) => entry.id === alicePc.id) as JournalCharacter).runtime.hp.maxSeen;
  alice.send({ type: "token.put", pageId: page.id, token: { ...editable, bars: [{ ...editable.bars[0], value: 999999 }, editable.bars[1], editable.bars[2]] } });
  await tick();
  assert.equal((host.journal.find((entry) => entry.id === alicePc.id) as JournalCharacter).runtime.hp.current, max, "the sheet's own maximum is the ceiling");
  // Bounds that used to be absent entirely.
  alice.send({ type: "chat.say", text: "가".repeat(9000) });
  alice.send({ type: "token.put", pageId: page.id, token: { ...editable, markers: Array.from({ length: 5000 }, () => ({ name: "은신" })) } });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("4000자")), JSON.stringify(refusals));
  assert.ok(refusals.some((reason) => reason.includes("마커")), JSON.stringify(refusals));
  assert.ok(host.pageList[0].tokens.every((item) => item.markers.length < 100));
});

test("authority: a command that throws refuses instead of taking the table down (D127)", async () => {
  const { host, dm, alice } = await seated();
  const refusals: string[] = [];
  dm.onRefused((reason) => refusals.push(reason));
  dm.send({ type: "player.kick", userId: "아무도-아닌-사람" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("참가자가 없습니다")), JSON.stringify(refusals));
  // And the table is still alive: the next command works.
  alice.send({ type: "chat.say", text: "아직 살아 있습니다" });
  await tick();
  assert.ok(host.archive.some((message) => message.content === "아직 살아 있습니다"));
});

test("authority: an art upload is measured, not asked (D132)", async () => {
  const { hub, host, alice, refusals } = await seated();
  alice.send({ type: "art.upload", asset: { id: "a1", kind: "art" as const, campaignId: "c", hash: "h", name: "지도", folder: "", tags: [], mime: "text/html", bytes: 10, width: 1, height: 1, ownerId: "alice", createdAt: "", updatedAt: "" }, total: 1 });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("형식은 올릴 수 없습니다")), JSON.stringify(refusals));
  // A real image type whose declared size is a lie about the bytes that follow.
  alice.send({ type: "art.upload", asset: { id: "a2", kind: "art" as const, campaignId: "c", hash: "h", name: "지도", folder: "", tags: [], mime: "image/png", bytes: 10, width: 1, height: 1, ownerId: "alice", createdAt: "", updatedAt: "" }, total: 429 });
  await tick();
  for (let at = 0; at < 429; at += 1) alice.send({ type: "art.chunk", id: "a2", index: at, total: 429, data: "x".repeat(48 * 1024) });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("너무 큽니다")), JSON.stringify(refusals));
  assert.ok(!host.art.some((asset) => asset.id === "a2"), "and nothing that big was stored");
  // An absurd chunk count is refused before it becomes an allocation.
  alice.send({ type: "art.upload", asset: { id: "a3", kind: "art" as const, campaignId: "c", hash: "h", name: "지도", folder: "", tags: [], mime: "image/png", bytes: 10, width: 1, height: 1, ownerId: "alice", createdAt: "", updatedAt: "" }, total: 20_000_000 });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("조각 수")), JSON.stringify(refusals));
  void hub;
});
