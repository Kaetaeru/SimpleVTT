/**
 * R24 (ROLL20_TABLE_SPEC.md D122–D125): a table that stays in sync.
 *
 * Four ways a session used to drift apart for good, each fixed here: campaign-level state (tracker, clock, macros,
 * tables, name) changed on the host without telling a single mirror; a relaunched host reusing event numbers that
 * meant something else; a dropped frame the mirror silently skipped past; and a whole-document write landing on top
 * of a newer one with nobody told. Plus the split-the-party bookmark that outlived its scene.
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
import type { PeerState, Transport } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const table = (): Campaign => ({ ...newCampaign("우리 테이블", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" });

function pc(name: string, owner: string): JournalCharacter {
  const made = build({ name, classes: "fighter", level: 3 });
  return newJournalCharacter("c", owner, made.source, initialRuntime(made.derived), { owner });
}

/**
 * A carrier the test holds on to: it can be re-pointed at a new hub (the DM relaunched the app) and can swallow
 * one frame on the way in (a chewed-up packet), which no real carrier lets us arrange on purpose.
 */
class Wire implements Transport {
  readonly peerId = "p1";
  private inner: Transport | null = null;
  private readonly off: Array<() => void> = [];
  private readonly messageHandlers = new Set<(from: string, message: unknown) => void>();
  private readonly peerHandlers = new Set<(peerId: string, state: PeerState) => void>();
  private swallow: ((message: unknown) => boolean) | null = null;

  attach(inner: Transport) {
    for (const stop of this.off.splice(0)) stop();
    this.inner = inner;
    this.off.push(inner.onMessage((from, message) => {
      if (this.swallow?.(message)) { this.swallow = null; return; }
      for (const handler of [...this.messageHandlers]) handler(from, message);
    }));
    this.off.push(inner.onPeer((peerId, state) => { for (const handler of [...this.peerHandlers]) handler(peerId, state); }));
    return this;
  }
  dropNext(match: (message: unknown) => boolean) { this.swallow = match; }
  send(to: string, message: unknown) { this.inner?.send(to, message); }
  onMessage(handler: (from: string, message: unknown) => void) { this.messageHandlers.add(handler); return () => { this.messageHandlers.delete(handler); }; }
  onPeer(handler: (peerId: string, state: PeerState) => void) { this.peerHandlers.add(handler); return () => { this.peerHandlers.delete(handler); }; }
  close() { this.inner?.close(); }
}

test("sync: campaign-level state changed on the host reaches every mirror (D122)", async () => {
  const hub = new MemoryHub();
  const campaign = table();
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s" });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  // The table is three rounds into a fight, an hour into the evening, with one shared macro.
  seat.send({ type: "tracker.set", tracker: { open: true, round: 3, current: -1, turns: [], sorted: true } });
  seat.send({ type: "table.clock", minutes: 60 });
  seat.send({ type: "table.macros", macros: [{ id: "m1", name: "횃불", text: "/em 횃불을 켠다", shared: true }] });
  await tick();
  assert.equal(alice.snapshot!.tracker.round, 3);
  const clockBefore = alice.snapshot!.clock;
  assert.equal(alice.snapshot!.macros.length, 1);

  // Now the campaign document is edited outside the table — a rename, from a copy that predates all of the above.
  host.updateCampaign({ ...campaign, name: "새 이름" });
  await tick();
  assert.equal(alice.snapshot!.name, "새 이름", "the rename reaches the mirror");
  assert.equal(alice.snapshot!.tracker.round, host.tracker.round, "and the mirror agrees with the host about the round");
  assert.deepEqual(alice.snapshot!.clock, host.clock, "…and about the time");
  assert.equal(alice.snapshot!.macros.length, (host.state.macros ?? []).length, "…and about the macros");
  assert.notDeepEqual(host.clock, clockBefore, "the rollback really happened — it is just no longer silent");
});

test("sync: a relaunched host never splices its own numbering into an older mirror (D122)", async () => {
  const first = new MemoryHub();
  const campaign = table();
  const hostOne = new TableHost(first.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s" });
  const dmOne = new TableClient(first.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const wire = new Wire().attach(first.connect("p1"));
  const alice = new TableClient(wire, { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  for (let at = 0; at < 6; at += 1) dmOne.send({ type: "chat.say", text: `첫 세션 ${at}` });
  await tick();
  assert.ok(alice.snapshot!.chat.some((message) => message.content === "첫 세션 5"));
  const place = alice.snapshot!.lastEventN;
  assert.ok(place > 0);
  hostOne.close();

  // The DM's laptop woke up and the app relaunched: a new host, numbering from zero, over a new carrier.
  const second = new MemoryHub();
  const hostTwo = new TableHost(second.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s" });
  const dmTwo = new TableClient(second.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  await tick();
  for (let at = 0; at < 9; at += 1) dmTwo.send({ type: "chat.say", text: `둘째 세션 ${at}` });
  await tick();
  assert.ok(hostTwo.archive.length >= 9);
  // Alice's window never closed: she still holds session one's place when her carrier comes back.
  wire.attach(second.connect("p1"));
  await tick();
  assert.ok(alice.snapshot!.chat.some((message) => message.content === "둘째 세션 0"), "the whole second session arrives, not a tail spliced past its first events");
  assert.ok(!alice.snapshot!.chat.some((message) => message.content === "첫 세션 0"), "and none of the first session's log is left mixed in");
  assert.notEqual(alice.snapshot!.lastEventN, place);
});

test("sync: a gap in the numbering asks for a snapshot instead of skipping past it (D122)", async () => {
  const hub = new MemoryHub();
  const host = new TableHost(hub.hostEndpoint(), { campaign: table(), hostUserId: "dm", hostSecret: "s" });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const wire = new Wire().attach(hub.connect("p1"));
  const alice = new TableClient(wire, { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  dm.send({ type: "chat.say", text: "하나" });
  await tick();
  const place = alice.snapshot!.lastEventN;
  // The frame carrying "둘" is chewed up on the way; "셋" arrives with a number one too high.
  wire.dropNext((message) => (message as { type?: string }).type === "events");
  dm.send({ type: "chat.say", text: "둘" });
  await tick();
  assert.equal(alice.snapshot!.lastEventN, place, "the lost frame really was lost");
  dm.send({ type: "chat.say", text: "셋" });
  await tick();
  await tick();
  assert.ok(alice.snapshot!.chat.some((message) => message.content === "둘"), "the resync brings back what the hole swallowed");
  assert.ok(alice.snapshot!.chat.some((message) => message.content === "셋"));
  assert.equal(alice.snapshot!.chat.filter((message) => message.content === "둘").length, 1, "exactly once — the snapshot replaced the log, it did not append to it");
  assert.equal(alice.snapshot!.lastEventN, dm.snapshot!.lastEventN, "and the mirror is level with the DM's own seat again");
  void host;
});

test("sync: deleting a scene takes the bookmarks that pointed at it (D124)", async () => {
  const hub = new MemoryHub();
  const campaign = table();
  const page = newScene(campaign.id, "지하 통로", 0);
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", pages: [page] });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  seat.send({ type: "page.bookmark", userId: "alice", pageId: page.id });
  await tick();
  assert.equal(alice.snapshot!.pageBookmarks.alice, page.id);
  seat.send({ type: "page.remove", id: page.id });
  await tick();
  assert.equal(host.state.pageBookmarks?.alice, undefined, "the dangling bookmark went with the scene");
  assert.equal(alice.snapshot!.pageBookmarks.alice, undefined, "and the mirror knows, so it falls back to the ribbon");
});

test("sync: a GM token edit written against an older rev keeps the player's marker (D123)", async () => {
  const hub = new MemoryHub();
  const campaign = table();
  const entry = pc("앨리스", "alice");
  const token = { ...tokenForCharacter(entry), id: "tok_alice" };
  const page = { ...newScene(campaign.id, "여관", 0), tokens: [token] };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", pages: [page], journal: [entry] });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  seat.send({ type: "page.ribbon", pageId: page.id });
  await tick();
  const seen = seat.snapshot!.pages[0].tokens[0];
  // The player marks themselves hidden; in the same breath the DM renames the token from the copy they held.
  alice.send({ type: "token.put", pageId: page.id, token: { ...alice.snapshot!.pages[0].tokens[0], markers: [{ name: "은신" }] } });
  await tick();
  seat.send({ type: "token.put", pageId: page.id, token: { ...seen, name: "후드 쓴 사람" } });
  await tick();
  const final = host.pageList[0].tokens[0];
  assert.equal(final.name, "후드 쓴 사람", "the DM's rename lands");
  assert.deepEqual(final.markers, [{ name: "은신" }], "and the player's marker survives it");
  // A GM edit that *did* see the token is still a plain replace — the DM may clear a marker.
  const fresh = host.pageList[0].tokens[0];
  seat.send({ type: "token.put", pageId: page.id, token: { ...fresh, markers: [] } });
  await tick();
  assert.deepEqual(host.pageList[0].tokens[0].markers, []);
});

test("sync: a sheet saved against a stale runtime cannot erase what the table just applied (D125)", async () => {
  const hub = new MemoryHub();
  const campaign = table();
  const entry = pc("앨리스", "alice");
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", journal: [entry] });
  const seat = new TableClient(hub.connect("host-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  await tick();
  const stale = alice.snapshot!.journal.find((item) => item.id === entry.id) as JournalCharacter;
  const later = new Date(Date.parse(stale.runtime.updatedAt) + 1000).toISOString();
  // The DM applies damage.
  seat.send({ type: "journal.put", entry: { ...stale, runtime: { ...stale.runtime, hp: { ...stale.runtime.hp, current: 9 }, updatedAt: later } } });
  await tick();
  assert.equal((host.journal[0] as JournalCharacter).runtime.hp.current, 9);
  // The player, still holding the pre-damage sheet, presses something that saves.
  alice.send({ type: "journal.put", entry: { ...stale, bio: "2차 풍을 썼다" } });
  await tick();
  const stored = host.journal[0] as JournalCharacter;
  assert.equal(stored.runtime.hp.current, 9, "the damage stands");
  assert.equal(stored.bio, "2차 풍을 썼다", "everything outside the runtime still applies");
  assert.ok(refusals.some((reason) => reason.includes("그 사이 바뀌었습니다")), JSON.stringify(refusals));
});
