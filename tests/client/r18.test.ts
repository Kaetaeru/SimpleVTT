/**
 * R18 (ROLL20_TABLE_SPEC.md D115): the table's clock and its rests. The DM moves in-world time and timed effects
 * run out as it passes (a minute is ten rounds); a short rest is an hour and a long rest eight, and a long rest
 * gives the monsters their day back too. A player may only ask for one — the ask goes to the chat.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { advanceClock, clockText, emptyClock, newCampaign } from "../../client/campaign/model";
import { longRest, shortRest, startEffect, useSpellSlot } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { derivedOf } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the clock counts minutes and rolls the day over at midnight", () => {
  const start = emptyClock();
  assert.deepEqual(start, { day: 1, minute: 480 });
  assert.equal(clockText(start), "1일차 08:00");
  assert.equal(clockText(advanceClock(start, 90)), "1일차 09:30");
  assert.equal(clockText(advanceClock(start, 16 * 60)), "2일차 00:00", "midnight starts the next day");
  assert.equal(clockText(advanceClock(start, 8 * 60)), "1일차 16:00");
  assert.equal(clockText(advanceClock({ day: 3, minute: 23 * 60 + 50 }, 20)), "4일차 00:10");
  assert.deepEqual(advanceClock(start, -50), start, "time never runs backwards");
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R18 시험", { userId: "dm", displayName: "DM" }), joinCode: "R18AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    pcRest: (entry, kind) => { const derived = derivedOf(entry, catalog()); return kind === "long" ? longRest(entry.runtime, derived) : shortRest(entry.runtime, derived); } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R18AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R18AAA" });
  await tick();
  const wizard = build({ name: "마법사", classes: "wizard", level: 5 }, { "class.0.spellbook": ["dnd.srd521.spell.mage-armor"], "class.0.spells": ["dnd.srd521.spell.mage-armor"] });
  const derived = derivedOf({ runtime: initialRuntime(wizard.derived), source: wizard.source } as never, catalog());
  let runtime = initialRuntime(wizard.derived);
  runtime = { ...useSpellSlot(runtime, derived, 1)!, hp: { ...runtime.hp, current: 3 } };
  // A five-round effect (블레스) and an hour-long one (마법사의 갑옷).
  runtime = startEffect(runtime, { key: "spell:bless", name: "축복", source: "spell", concentration: false, duration: "1분 (10라운드)", rounds: 10 });
  runtime = startEffect(runtime, { key: "spell:mage-armor", name: "마법사의 갑옷", source: "spell", concentration: false, duration: "8시간", rounds: 4800 });
  const pc = { ...newJournalCharacter(campaign.id, "alice", wizard.source, runtime), canEdit: ["alice"] };
  alice.send({ type: "journal.put", entry: pc });
  const dragon = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.adult-red-dragon")!);
  dm.send({ type: "journal.put", entry: { ...dragon, runtime: { ...dragon.runtime, legendaryResistanceUsed: 2, uses: { "trait:전설 저항": 1 }, spent: { "화염 브레스": true } } } });
  await tick();
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (type: string) => [...dm.snapshot!.chat].reverse().find((message) => message.type === type);
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  return { host, dm, alice, pc, dragon, entryOf, last, refusals, maxHp: wizard.derived.hp.max };
}

test("host: the DM moves time and the effects whose rounds ran out end; the long one survives", async () => {
  const { dm, pc, entryOf, last } = await table();
  assert.equal(dm.snapshot!.clock.minute, 480, "the table starts at 08:00 on day 1");
  dm.send({ type: "table.clock", minutes: 10 });
  await tick();
  assert.equal(clockText(dm.snapshot!.clock), "1일차 08:10");
  assert.ok(last("system")!.content.includes("10분"), last("system")!.content);
  const after = entryOf(pc.id);
  assert.ok(after.kind === "character", "still a character");
  const names = after.kind === "character" ? (after.runtime.effects ?? []).map((effect) => effect.name) : [];
  assert.ok(!names.includes("축복"), `the ten-round effect ran out: ${names.join(", ")}`);
  assert.ok(names.includes("마법사의 갑옷"), "the eight-hour one is still on");
});

test("host: a short rest is an hour, a long rest eight and it gives both sides their day back; a player may only ask", async () => {
  const { dm, alice, pc, dragon, entryOf, last, refusals, maxHp } = await table();
  alice.send({ type: "table.rest", kind: "long" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("DM이 시작합니다")), JSON.stringify(refusals));
  const untouched = entryOf(pc.id);
  assert.ok(untouched.kind === "character" && untouched.runtime.hp.current === 3, "the player's attempt healed nobody");
  // Asking is allowed and the whole table sees it.
  alice.send({ type: "act.rest", kind: "long" });
  await tick();
  assert.ok(last("system")!.content.includes("긴 휴식을 제안합니다"), last("system")!.content);
  dm.send({ type: "table.rest", kind: "short" });
  await tick();
  assert.equal(clockText(dm.snapshot!.clock), "1일차 09:00", "a short rest is one hour");
  dm.send({ type: "table.rest", kind: "long" });
  await tick();
  assert.equal(clockText(dm.snapshot!.clock), "1일차 17:00", "and a long rest eight more");
  const rested = entryOf(pc.id);
  assert.ok(rested.kind === "character" && rested.runtime.hp.current === maxHp && Object.keys(rested.runtime.slotsUsed).length === 0, "full HP and every slot back");
  const monster = entryOf(dragon.id);
  assert.ok(monster.kind === "npc" && monster.runtime.legendaryResistanceUsed === 0 && !Object.keys(monster.runtime.uses ?? {}).length && !monster.runtime.spent["화염 브레스"], "the dragon's day came back too");
  assert.ok(last("system")!.content.includes("긴 휴식"), last("system")!.content);
});
