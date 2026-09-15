/**
 * Pages and tokens (ROLL20_TABLE_SPEC.md §2–§3): players see their ribbon page only, without the GM layer; the
 * ribbon and split-the-party bookmarks move players; controllers move only their tokens and edit only editable bars;
 * linked bars mirror the sheet both ways (D78); pings reach the page's viewers; pure helpers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { applyBarInput, cellDistance, columnLabel, controlsToken, mergeControllerTokenEdit, newPage, newToken, projectPage, snap, tokenForCharacter } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import type { TableEvent } from "../../client/session/protocol";
import { MemoryHub } from "../../client/session/transport";
import { build } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("페이지 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const saved: Array<{ page: { id: string; tokens: unknown[] } } | { removed: string }> = [];
  const host = new TableHost(hub.hostEndpoint(), {
    campaign, hostUserId: "dm", hostSecret: "s", onPage: (change) => saved.push(change),
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : link === "ac" ? { value: 15 } : undefined),
  });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "ABC234" });
  return { hub, host, dm, alice, bob, saved, campaign };
}

test("pure helpers: snap, clamp, distance, labels, bar input grammar, controller merge, projection", () => {
  assert.equal(snap(2.4), 2);
  assert.equal(snap(2.6), 3);
  assert.equal(snap(1.3, 0.5), 1.5);
  assert.equal(cellDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 4, "5e diagonals cost one cell");
  assert.deepEqual([columnLabel(0), columnLabel(25), columnLabel(26)], ["A", "Z", "AA"]);
  const bar = { value: 20, max: 28, visible: true, editable: true };
  assert.equal(applyBarInput(bar, "-5")?.value, 15);
  assert.equal(applyBarInput(bar, "+20")?.value, 28, "clamped to max");
  assert.equal(applyBarInput(bar, "7")?.value, 7);
  assert.equal(applyBarInput(bar, "abc"), null);
  const stored = newToken({ name: "고블린", x: 1, y: 1, layer: "gm", gmNotes: "비밀", locked: false, bars: [{ value: 7, max: 7, visible: false, editable: true }, { value: 3, visible: true, editable: false }, { visible: true, editable: false }] });
  const merged = mergeControllerTokenEdit(stored, { ...stored, x: 5, y: 6, layer: "objects", gmNotes: "해킹", locked: true, markers: [{ name: "중독" }], bars: [{ ...stored.bars[0], value: 2 }, { ...stored.bars[1], value: 99 }, stored.bars[2]] });
  assert.deepEqual([merged.x, merged.y, merged.layer, merged.gmNotes, merged.locked], [5, 6, "gm", "비밀", false], "position moves; layer, notes and lock stay");
  assert.equal(merged.bars[0].value, 2, "an editable bar takes the value");
  assert.equal(merged.bars[1].value, 3, "a non-editable bar keeps its value");
  assert.deepEqual(merged.markers, [{ name: "중독" }]);
  assert.equal(mergeControllerTokenEdit({ ...stored, locked: true }, { ...stored, x: 9 }).x, 1, "a locked token does not move");
  const page = { ...newPage("camp", "동굴", 0), tokens: [stored, newToken({ name: "앨리스", layer: "objects", bars: [{ value: 10, max: 12, visible: true, editable: false }, { value: 1, visible: false, editable: false }, { visible: true, editable: false }] })] };
  const campaign = { playerPageId: page.id, pageBookmarks: {} };
  const seen = projectPage(page, { userId: "alice", role: "player" }, campaign)!;
  assert.equal(seen.tokens.length, 1, "GM-layer tokens are not sent to players");
  assert.equal(seen.tokens[0].bars[1].value, undefined, "hidden bars are blanked");
  assert.equal(seen.tokens[0].bars[0].value, 10);
  assert.equal(projectPage(page, { userId: "alice", role: "player" }, { playerPageId: "other", pageBookmarks: {} }), null, "not their page");
  assert.equal(projectPage(page, { userId: "alice", role: "player" }, { playerPageId: "other", pageBookmarks: { alice: page.id } })?.id, page.id, "a bookmark overrides the ribbon");
  assert.equal(projectPage(page, { userId: "dm", role: "gm" }, { pageBookmarks: {} })?.tokens.length, 2);
  const { source, derived } = build({ name: "앨리스", classes: "fighter", level: 1 });
  const entry = newJournalCharacter("camp", "alice", source, initialRuntime(derived));
  const token = tokenForCharacter(entry, { x: 3, y: 4 });
  assert.equal(token.represents, entry.id);
  assert.equal(token.bars[0].link, "hp", "bar 1 links to hp by default (D78)");
  assert.equal(token.controlledBy, "inherit");
  assert.ok(controlsToken(token, { userId: "alice", role: "player" }, [entry]) && !controlsToken(token, { userId: "bob", role: "player" }, [entry]));
  const withDefault = tokenForCharacter({ ...entry, defaultToken: { w: 2, h: 2, tint: "#ff0000", auras: [{ radius: 10, color: "#fff", square: false, visible: true }, { radius: 0, color: "#fff", square: false, visible: true }] } }, { x: 0, y: 0 });
  assert.deepEqual([withDefault.w, withDefault.tint, withDefault.auras[0].radius], [2, "#ff0000", 10], "the saved default token applies");
});

test("players see the ribbon page only; the ribbon and bookmarks move them; GM-layer tokens stay hidden", async () => {
  const { host, dm, alice, bob, saved, campaign } = stage();
  await tick();
  const cave = newPage(campaign.id, "동굴", 0);
  const town = newPage(campaign.id, "마을", 1);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.put", page: town });
  await tick();
  assert.equal(dm.snapshot!.pages.length, 2);
  assert.equal(alice.snapshot!.pages.length, 0, "no ribbon yet: players see nothing");
  assert.ok(saved.some((change) => "page" in change && change.page.id === cave.id), "pages persist through onPage");
  dm.send({ type: "page.ribbon", pageId: cave.id });
  await tick();
  assert.deepEqual(alice.snapshot!.pages.map((page) => page.name), ["동굴"]);
  assert.equal(alice.snapshot!.playerPageId, cave.id);
  const goblin = newToken({ name: "고블린", layer: "gm", x: 2, y: 2 });
  const chest = newToken({ name: "상자", layer: "objects", x: 4, y: 4 });
  dm.send({ type: "token.put", pageId: cave.id, token: goblin });
  dm.send({ type: "token.put", pageId: cave.id, token: chest });
  await tick();
  assert.deepEqual(alice.snapshot!.pages[0].tokens.map((token) => token.name), ["상자"], "the GM layer never reaches players");
  assert.equal(dm.snapshot!.pages[0].tokens.length, 2);
  dm.send({ type: "token.put", pageId: cave.id, token: { ...goblin, layer: "objects" } });
  await tick();
  assert.equal(alice.snapshot!.pages[0].tokens.length, 2, "moving a token to the token layer reveals it");
  dm.send({ type: "token.put", pageId: cave.id, token: { ...goblin, layer: "gm" } });
  await tick();
  assert.equal(alice.snapshot!.pages[0].tokens.length, 1, "moving it back removes it from players");
  // Split the party: bob goes to town, alice stays.
  dm.send({ type: "page.bookmark", userId: "bob", pageId: town.id });
  await tick();
  assert.deepEqual(bob.snapshot!.pages.map((page) => page.name), ["마을"]);
  assert.deepEqual(alice.snapshot!.pages.map((page) => page.name), ["동굴"]);
  dm.send({ type: "page.bookmark", userId: "bob", pageId: null });
  await tick();
  assert.deepEqual(bob.snapshot!.pages.map((page) => page.name), ["동굴"], "rejoining the ribbon");
  // Pings reach the page's viewers only.
  const pings: string[] = [];
  alice.onPing((ping) => pings.push(`alice:${ping.by}`));
  bob.onPing((ping) => pings.push(`bob:${ping.by}`));
  dm.send({ type: "page.bookmark", userId: "bob", pageId: town.id });
  await tick();
  alice.send({ type: "ping", pageId: cave.id, x: 1, y: 1 });
  bob.send({ type: "ping", pageId: cave.id, x: 1, y: 1 });
  await tick();
  assert.deepEqual(pings, ["alice:alice"], "bob is on another page: his ping on the cave is dropped and he does not see alice's");
  // Removing the ribbon page clears the ribbon.
  dm.send({ type: "page.remove", id: cave.id });
  await tick();
  assert.equal(host.state.playerPageId, undefined);
  assert.equal(alice.snapshot!.pages.length, 0);
  assert.ok(saved.some((change) => "removed" in change && change.removed === cave.id));
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "page.put", page: newPage(campaign.id, "몰래", 9) });
  alice.send({ type: "page.ribbon", pageId: town.id });
  await tick();
  assert.equal(refusals.length, 2, "pages and the ribbon are the GM's");
});

test("controllers move their own tokens; linked bars mirror the sheet both ways; others are refused", async () => {
  const { host, dm, alice, bob, campaign } = stage();
  await tick();
  const cave = newPage(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.ribbon", pageId: cave.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const entry = newJournalCharacter(campaign.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry });
  await tick();
  // Alice puts her own character on the page she is on.
  const token = tokenForCharacter(entry, { x: 1, y: 1 });
  alice.send({ type: "token.put", pageId: cave.id, token: { ...token, layer: "gm", gmNotes: "x" } });
  await tick();
  const placed = host.pageList[0].tokens[0];
  assert.equal(placed.layer, "objects", "a player's token lands on the token layer");
  assert.equal(placed.gmNotes, "");
  assert.equal(placed.bars[0].value, entry.runtime.hp.current, "bar 1 mirrors current HP");
  assert.equal(placed.bars[0].max, entry.runtime.hp.maxSeen, "and max HP");
  // Bob cannot move it; alice can; a locked token does not move.
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "token.put", pageId: cave.id, token: { ...placed, x: 9 } });
  await tick();
  assert.ok(refusals[0]?.includes("권한"));
  alice.send({ type: "token.put", pageId: cave.id, token: { ...placed, x: 9, y: 2 } });
  await tick();
  assert.deepEqual([host.pageList[0].tokens[0].x, host.pageList[0].tokens[0].y], [9, 2]);
  assert.equal(dm.snapshot!.pages[0].tokens[0].x, 9, "the GM's mirror follows");
  // Damage on the sheet reaches the token bar; a bar edit (editable) reaches the sheet.
  const mine = alice.snapshot!.journal[0];
  if (mine.kind !== "character") throw new Error("character expected");
  alice.send({ type: "journal.put", entry: { ...mine, runtime: { ...mine.runtime, hp: { ...mine.runtime.hp, current: mine.runtime.hp.current - 5 } } } });
  await tick();
  assert.equal(bob.snapshot!.pages[0].tokens[0].bars[0].value, entry.runtime.hp.current - 5, "the sheet change reached every mirror's token bar");
  dm.send({ type: "token.put", pageId: cave.id, token: { ...host.pageList[0].tokens[0], bars: [{ ...host.pageList[0].tokens[0].bars[0], editable: true }, host.pageList[0].tokens[0].bars[1], host.pageList[0].tokens[0].bars[2]] } });
  await tick();
  const current = host.pageList[0].tokens[0];
  alice.send({ type: "token.put", pageId: cave.id, token: { ...current, bars: [{ ...current.bars[0], value: 4 }, current.bars[1], current.bars[2]] } });
  await tick();
  const sheet = host.journal.find((item) => item.id === entry.id);
  assert.ok(sheet?.kind === "character" && sheet.runtime.hp.current === 4, "an editable hp bar writes the sheet");
  assert.ok(dm.snapshot!.chat.some((message) => message.type === "system" && message.content.includes("HP")), "and the chat notes it");
  // Bob cannot put a token for a character he does not control; a player's ping on their page reaches the GM.
  bob.send({ type: "token.put", pageId: cave.id, token: tokenForCharacter(entry, { x: 0, y: 0 }) });
  await tick();
  assert.ok(refusals[1]?.includes("자기 캐릭터"));
  const events: TableEvent[] = [];
  host.onEvent((event) => events.push(event));
  bob.send({ type: "ping", pageId: cave.id, x: 2, y: 3 });
  await tick();
  assert.ok(events.some((event) => event.type === "ping" && event.by === "bob"));
  // Removal: alice may remove her token; bob may not.
  bob.send({ type: "token.remove", pageId: cave.id, id: current.id });
  alice.send({ type: "token.remove", pageId: cave.id, id: current.id });
  await tick();
  assert.equal(host.pageList[0].tokens.length, 0);
});
