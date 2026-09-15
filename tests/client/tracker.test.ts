/**
 * The turn tracker and NPCs (ROLL20_TABLE_SPEC.md §6, §4.3, §9): pure advance/sort/formula rules; the host rolls
 * initiative into rows, "다음 턴" processes rules (effect rounds at turn end, recharge and death saves at turn
 * start, round counter), players get the tracker when the GM opens it and may add only their own tokens; a
 * monster becomes an NPC entry with an unlinked token; token removal drops its row.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { advanceTurn, emptyTracker, newTurn, roundCounterTurn, sortTurns, withoutTurn, withTurn } from "../../client/campaign/tracker";
import { startEffect } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById, searchMonsters, sizeCells } from "../../client/compendium/monsters";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

function stage(random: () => number = () => 0.5) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("트래커 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  return { hub, host, dm, alice, campaign };
}

test("tracker rules: sorting, upsert by token, custom formula rows, wrapping rounds", () => {
  let tracker = emptyTracker();
  tracker = withTurn(tracker, newTurn({ name: "고블린", initiative: 12, tokenId: "t1", pageId: "p" }));
  tracker = withTurn(tracker, newTurn({ name: "앨리스", initiative: 18, tokenId: "t2", pageId: "p" }));
  tracker = withTurn(tracker, roundCounterTurn(1));
  assert.deepEqual(tracker.turns.map((turn) => turn.name), ["앨리스", "고블린", "라운드"], "sorted by initiative, the counter (1) last");
  tracker = withTurn(tracker, newTurn({ name: "고블린", initiative: 20, tokenId: "t1", pageId: "p" }));
  assert.equal(tracker.turns.length, 3, "the same token replaces its row");
  assert.deepEqual(tracker.turns.map((turn) => turn.name), ["고블린", "앨리스", "라운드"]);
  let result = advanceTurn(tracker);
  assert.equal(result.started?.name, "고블린");
  assert.equal(result.ended, undefined);
  result = advanceTurn(result.tracker);
  assert.deepEqual([result.ended?.name, result.started?.name], ["고블린", "앨리스"]);
  result = advanceTurn(result.tracker);
  assert.equal(result.started?.name, "라운드");
  result = advanceTurn(result.tracker);
  assert.equal(result.roundWrapped, true);
  assert.equal(result.tracker.round, 2);
  assert.equal(result.tracker.turns.find((turn) => turn.custom)?.initiative, 2, "the +1 formula advanced the counter row");
  assert.equal(result.started?.name, "고블린");
  const current = result.tracker.turns[result.tracker.current];
  const removed = withoutTurn(result.tracker, result.tracker.turns[1].id);
  assert.equal(removed.turns[removed.current].id, current.id, "removing another row keeps the current one");
  assert.deepEqual(sortTurns([newTurn({ name: "b", initiative: 3 }), newTurn({ name: "a", initiative: 3 })]).map((turn) => turn.name), ["a", "b"]);
  assert.equal(advanceTurn(emptyTracker()).started, undefined);
});

test("compendium: monsters are searchable and become NPCs with unlinked tokens sized by the monster", () => {
  const goblins = searchMonsters("goblin");
  assert.ok(goblins.some((monster) => monster.nameEn === "Goblin Boss"));
  const boss = monsterById("dnd.srd521.monster.goblin-boss")!;
  assert.equal(boss.ac, 17);
  const npc = newJournalNpc("camp", "dm", boss);
  assert.deepEqual([npc.kind, npc.folder, npc.runtime.hp.current, npc.runtime.hp.max, npc.canView], ["npc", "괴물", 21, 21, []]);
  const token = tokenForNpc(npc);
  assert.equal(token.bars[0].link, undefined, "monster tokens carry their own HP (unlinked, D78)");
  assert.equal(token.bars[0].value, 21);
  assert.deepEqual(token.controlledBy, []);
  const dragon = searchMonsters("", { cr: "17" })[0];
  assert.ok(dragon, "CR filter works");
  assert.equal(sizeCells("huge"), 3);
  assert.equal(searchMonsters("zzz-nothing").length, 0);
});

test("host: opening the tracker reaches players; initiative rolls into rows; 다음 턴 processes effects, death saves and recharge", async () => {
  const rolls = [0.95, 0.05, 0.99, 0.5, 0.0];
  let at = 0;
  const { host, dm, alice, campaign } = stage(() => rolls[at++ % rolls.length]);
  await tick();
  const cave = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.ribbon", pageId: cave.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const runtime = startEffect(initialRuntime(derived), { key: "feature:test.rage", name: "격노", source: "feature", duration: "1 round", concentration: false, rounds: 1 });
  const pc = newJournalCharacter(campaign.id, "alice", source, runtime);
  alice.send({ type: "journal.put", entry: pc });
  const dragon = monsterById("dnd.srd521.monster.adult-black-dragon")!;
  const npc = { ...newJournalNpc(campaign.id, "dm", dragon), runtime: { ...newJournalNpc(campaign.id, "dm", dragon).runtime, spent: { "산성 브레스": true }, legendaryUsed: 2 } };
  dm.send({ type: "journal.put", entry: npc });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const npcToken = tokenForNpc(npc);
  alice.send({ type: "token.put", pageId: cave.id, token: pcToken });
  dm.send({ type: "token.put", pageId: cave.id, token: npcToken });
  await tick();
  assert.equal(alice.snapshot!.tracker.open, false);
  dm.send({ type: "tracker.set", tracker: { ...emptyTracker(), open: true } });
  await tick();
  assert.equal(alice.snapshot!.tracker.open, true, "the GM opening the tracker opens it for players");
  // Initiative: alice rolls her own token (allowed), the GM rolls the dragon; the cards land in chat.
  alice.send({ type: "tracker.add", turn: { name: pcToken.name, tokenId: pcToken.id, pageId: cave.id, entryId: pc.id }, rollBonus: 2 });
  dm.send({ type: "tracker.add", turn: { name: npcToken.name, tokenId: npcToken.id, pageId: cave.id, entryId: npc.id }, rollBonus: dragon.initiativeBonus });
  await tick();
  const tracker = host.tracker;
  assert.equal(tracker.turns.length, 2);
  const aliceTurn = tracker.turns.find((turn) => turn.tokenId === pcToken.id)!;
  assert.equal(aliceTurn.initiative, 20 + 2, "0.95 → d20 = 20, +2");
  assert.ok(dm.snapshot!.chat.some((message) => message.type === "rollresult" && message.roll?.label?.includes("이니셔티브")), "initiative rolls are chat cards");
  assert.equal(tracker.turns[0].id, aliceTurn.id, "sorted: alice (22) first");
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "tracker.add", turn: { name: "용", tokenId: npcToken.id, pageId: cave.id } });
  alice.send({ type: "tracker.next" });
  await tick();
  assert.equal(refusals.length, 2, "a player cannot add another's token nor advance");
  // Turn 1: alice starts (no processing needed). Turn 2: alice's turn ends → her 1-round effect ends; the dragon starts → recharge roll (0.99 → 6 ≥ 5) and legendary reset.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.tracker.current, 0);
  assert.ok(dm.snapshot!.chat.some((message) => message.content.includes("앨리스의 파이터의 턴")));
  dm.send({ type: "tracker.next" });
  await tick();
  const pcAfter = host.journal.find((entry) => entry.id === pc.id);
  assert.ok(pcAfter?.kind === "character" && pcAfter.runtime.effects.length === 0, "the 1-round effect ended when its turn ended");
  const npcAfter = host.journal.find((entry) => entry.id === npc.id);
  assert.ok(npcAfter?.kind === "npc" && npcAfter.runtime.spent["산성 브레스"] === false && npcAfter.runtime.legendaryUsed === 0, "recharge rolled 6 and legendary actions reset");
  assert.ok(dm.snapshot!.chat.some((message) => message.content.includes("재충전")));
  // Turn 3 wraps: round 2. Put alice at 0 HP first: her turn start rolls a death save automatically (D92).
  const stored = host.journal.find((entry) => entry.id === pc.id);
  if (stored?.kind !== "character") throw new Error("character expected");
  dm.send({ type: "journal.put", entry: { ...stored, runtime: { ...stored.runtime, hp: { ...stored.runtime.hp, current: 0 } } } });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.tracker.round, 2);
  const downed = host.journal.find((entry) => entry.id === pc.id);
  assert.ok(downed?.kind === "character" && downed.runtime.deathSaves.success + downed.runtime.deathSaves.failure >= 1, "a PC at 0 HP rolled a death save at its turn start");
  assert.ok(dm.snapshot!.chat.some((message) => message.roll?.label?.includes("죽음 내성")));
  assert.ok(dm.snapshot!.chat.some((message) => message.content === "라운드 2"));
  // Removing the dragon's token drops its row.
  dm.send({ type: "token.remove", pageId: cave.id, id: npcToken.id });
  await tick();
  assert.equal(host.tracker.turns.length, 1);
  assert.equal(alice.snapshot!.tracker.turns.length, 1, "players follow the tracker");
});
