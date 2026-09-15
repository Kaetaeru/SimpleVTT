/**
 * Scenes and tokens (ROLL20_TABLE_SPEC.md §2–§3, D109): players see their ribbon scene only, without the GM layer;
 * the ribbon and split-the-party bookmarks move players; controllers reorder only their own icons and edit only
 * editable bars; linked bars mirror the sheet both ways (D78); pure helpers.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { applyBarInput, controlsToken, mergeControllerTokenEdit, newScene, newToken, projectPage, tokenForCharacter } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("장면 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
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

test("pure helpers: bar input grammar, controller merge, projection, a character's icon and its saved default", () => {
  const bar = { value: 20, max: 28, visible: true, editable: true };
  assert.equal(applyBarInput(bar, "-5")?.value, 15);
  assert.equal(applyBarInput(bar, "+20")?.value, 28, "clamped to max");
  assert.equal(applyBarInput(bar, "7")?.value, 7);
  assert.equal(applyBarInput(bar, "abc"), null);
  const stored = newToken({ name: "고블린", layer: "gm", gmNotes: "비밀", locked: false, z: 1, bars: [{ value: 7, max: 7, visible: false, editable: true }, { value: 3, visible: true, editable: false }, { visible: true, editable: false }] });
  const merged = mergeControllerTokenEdit(stored, { ...stored, z: 5, layer: "objects", gmNotes: "해킹", locked: true, markers: [{ name: "중독" }], bars: [{ ...stored.bars[0], value: 2 }, { ...stored.bars[1], value: 9 }, stored.bars[2]] });
  assert.deepEqual([merged.z, merged.layer, merged.gmNotes, merged.locked], [5, "gm", "비밀", false], "the order moves; layer, notes and lock stay");
  assert.equal(merged.bars[0].value, 2, "an editable bar takes the value");
  assert.equal(merged.bars[1].value, 3, "a non-editable bar keeps its value");
  assert.deepEqual(merged.markers, [{ name: "중독" }]);
  assert.equal(mergeControllerTokenEdit({ ...stored, locked: true }, { ...stored, z: 9 }).z, 1, "a locked token does not move");
  const page = { ...newScene("camp", "동굴", 0), tokens: [stored, newToken({ name: "앨리스", layer: "objects", bars: [{ value: 10, max: 12, visible: true, editable: false }, { value: 1, visible: false, editable: false }, { visible: true, editable: false }] })] };
  const campaign = { playerPageId: page.id, pageBookmarks: {} };
  const seen = projectPage(page, { userId: "alice", role: "player" }, campaign)!;
  assert.equal(seen.tokens.length, 1, "GM-layer tokens are not sent to players");
  assert.equal(seen.tokens[0].bars[1].value, undefined, "hidden bars are blanked");
  assert.equal(seen.tokens[0].bars[0].value, 10);
  assert.equal(projectPage(page, { userId: "alice", role: "player" }, { playerPageId: "other", pageBookmarks: {} }), null, "not their scene");
  assert.equal(projectPage(page, { userId: "alice", role: "player" }, { playerPageId: "other", pageBookmarks: { alice: page.id } })?.id, page.id, "a bookmark overrides the ribbon");
  assert.equal(projectPage(page, { userId: "dm", role: "gm" }, { pageBookmarks: {} })?.tokens.length, 2);
  const { source, derived } = build({ name: "앨리스", classes: "fighter", level: 1 });
  const entry = newJournalCharacter("camp", "alice", source, initialRuntime(derived));
  const token = tokenForCharacter(entry);
  assert.equal(token.represents, entry.id);
  assert.equal(token.bars[0].link, "hp", "bar 1 links to hp by default (D78)");
  assert.equal(token.controlledBy, "inherit");
  assert.ok(controlsToken(token, { userId: "alice", role: "player" }, [entry]) && !controlsToken(token, { userId: "bob", role: "player" }, [entry]));
  const withDefault = tokenForCharacter({ ...entry, defaultToken: { tint: "#ff0000", showName: false } });
  assert.deepEqual([withDefault.tint, withDefault.showName], ["#ff0000", false], "the saved default token applies");
});

test("players see the ribbon scene only; the ribbon and bookmarks move them; GM-layer tokens stay hidden", async () => {
  const { host, dm, alice, bob, saved, campaign } = stage();
  await tick();
  const cave = newScene(campaign.id, "동굴", 0);
  const town = newScene(campaign.id, "마을", 1);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.put", page: town });
  await tick();
  assert.equal(dm.snapshot!.pages.length, 2);
  assert.equal(alice.snapshot!.pages.length, 0, "no ribbon yet: players see nothing");
  assert.ok(saved.some((change) => "page" in change && change.page.id === cave.id), "scenes persist through onPage");
  dm.send({ type: "page.ribbon", pageId: cave.id });
  await tick();
  assert.deepEqual(alice.snapshot!.pages.map((page) => page.name), ["동굴"]);
  assert.equal(alice.snapshot!.playerPageId, cave.id);
  const goblin = newToken({ name: "고블린", layer: "gm" });
  const chest = newToken({ name: "상자", layer: "objects" });
  dm.send({ type: "token.put", pageId: cave.id, token: goblin });
  dm.send({ type: "token.put", pageId: cave.id, token: chest });
  await tick();
  assert.deepEqual(alice.snapshot!.pages[0].tokens.map((token) => token.name), ["상자"], "the GM layer never reaches players");
  assert.equal(dm.snapshot!.pages[0].tokens.length, 2);
  dm.send({ type: "token.put", pageId: cave.id, token: { ...goblin, layer: "objects" } });
  await tick();
  assert.equal(alice.snapshot!.pages[0].tokens.length, 2, "moving it to the shared layer reveals it");
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
  // Removing the ribbon scene clears the ribbon.
  dm.send({ type: "page.remove", id: cave.id });
  await tick();
  assert.equal(host.state.playerPageId, undefined);
  assert.equal(alice.snapshot!.pages.length, 0);
  assert.ok(saved.some((change) => "removed" in change && change.removed === cave.id));
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "page.put", page: newScene(campaign.id, "몰래", 9) });
  alice.send({ type: "page.ribbon", pageId: town.id });
  await tick();
  assert.equal(refusals.length, 2, "scenes and the ribbon are the GM's");
});

test("controllers reorder their own icons; linked bars mirror the sheet both ways; others are refused", async () => {
  const { host, dm, alice, bob, campaign } = stage();
  await tick();
  const cave = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.ribbon", pageId: cave.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const entry = newJournalCharacter(campaign.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry });
  await tick();
  // Alice puts her own character into the scene she is on.
  const token = tokenForCharacter(entry);
  alice.send({ type: "token.put", pageId: cave.id, token: { ...token, layer: "gm", gmNotes: "x" } });
  await tick();
  const placed = host.pageList[0].tokens[0];
  assert.equal(placed.layer, "objects", "a player's icon lands on the shared layer");
  assert.equal(placed.gmNotes, "");
  assert.equal(placed.bars[0].value, entry.runtime.hp.current, "bar 1 mirrors current HP");
  assert.equal(placed.bars[0].max, entry.runtime.hp.maxSeen, "and max HP");
  // Bob cannot reorder it; alice can; a locked icon does not move.
  const refusals: string[] = [];
  bob.onRefused((reason) => refusals.push(reason));
  bob.send({ type: "token.put", pageId: cave.id, token: { ...placed, z: 9 } });
  await tick();
  assert.ok(refusals[0]?.includes("권한"));
  alice.send({ type: "token.put", pageId: cave.id, token: { ...placed, z: 9 } });
  await tick();
  assert.equal(host.pageList[0].tokens[0].z, 9);
  assert.equal(dm.snapshot!.pages[0].tokens[0].z, 9, "the GM's mirror follows");
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
  // Bob cannot put an icon for a character he does not control.
  bob.send({ type: "token.put", pageId: cave.id, token: tokenForCharacter(entry) });
  await tick();
  assert.ok(refusals[1]?.includes("자기 캐릭터"));
  // Removal: alice may remove her icon; bob may not.
  bob.send({ type: "token.remove", pageId: cave.id, id: current.id });
  alice.send({ type: "token.remove", pageId: cave.id, id: current.id });
  await tick();
  assert.equal(host.pageList[0].tokens.length, 0);
});
