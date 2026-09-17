/**
 * R89 (ROLL20_TABLE_SPEC.md D224): situation buttons for caster areas — a creature goes into 달빛 광선, ends its turn
 * there, or walks through 가시 성장, and the table rolls the area for it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter, type JournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const MOON = "dnd.srd521.spell.moonbeam";
const SPIKE = "dnd.srd521.spell.spike-growth";

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R89 시험", { userId: "dm", displayName: "DM" }), joinCode: "R89AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.01,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R89AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "드루이드", classes: "druid", level: 5 }, { "class.0.spells": [MOON, SPIKE] });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const first = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  const second = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!, { name: "둘째 오우거" });
  for (const entry of [pc, first, second]) dm.send({ type: "journal.put", entry });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const firstToken = tokenForNpc(first);
  const secondToken = tokenForNpc(second);
  for (const token of [pcToken, firstToken, secondToken]) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "드루이드", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "둘째", tokenId: secondToken.id, pageId: scene.id, entryId: second.id, initiative: 10 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, first: { pageId: scene.id, tokenId: firstToken.id }, second: { entryId: second.id, pageId: scene.id, tokenId: secondToken.id } };
  const druid = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const ogre = () => host.journal.find((entry) => entry.id === second.id) as JournalNpc;
  const spellCards = () => dm.snapshot!.chat.filter((message) => message.type === "spell").length;
  return { dm, refs, druid, ogre, spellCards, pcId: pc.id };
}

test("R89: entering 달빛 광선 rolls once per turn, ending a turn inside rolls again, and it all ends with concentration (D224)", async () => {
  const t = await table();
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: MOON, targets: [t.refs.first], method: { kind: "slot", level: 2 } });
  await tick();
  assert.ok(t.druid().runtime.effects.some((effect) => effect.key === `spell:${MOON}`), JSON.stringify(t.druid().runtime.effects));
  const before = t.spellCards();
  t.dm.send({ type: "act.zone", casterEntryId: t.pcId, spellId: MOON, target: t.refs.second, action: "enter" });
  await tick();
  assert.equal(t.spellCards(), before + 1, "entering rolls the area");
  assert.match(t.dm.snapshot!.chat.at(-1)!.content, /둘째 오우거 .*피해/, "the card lands on the creature that walked in");
  t.dm.send({ type: "act.zone", casterEntryId: t.pcId, spellId: MOON, target: t.refs.second, action: "leave" });
  t.dm.send({ type: "act.zone", casterEntryId: t.pcId, spellId: MOON, target: t.refs.second, action: "enter" });
  await tick();
  assert.equal(t.spellCards(), before + 1, "once per turn");
  t.dm.send({ type: "tracker.next" });
  await tick();
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(t.spellCards(), before + 2, "ending its own turn inside rolls it again");

  const sheet = t.druid();
  t.dm.send({ type: "journal.put", entry: { ...sheet, runtime: { ...sheet.runtime, effects: sheet.runtime.effects.filter((effect) => effect.key !== `spell:${MOON}`) } } });
  await tick();
  assert.equal(t.ogre().runtime.effects?.some((effect) => effect.key.startsWith("zone:")), false, "the membership goes with the spell");
});

test("R89: 가시 성장 hurts per 5 feet moved, not on entering (D224)", async () => {
  const t = await table();
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: SPIKE, targets: [], method: { kind: "slot", level: 2 } });
  await tick();
  assert.ok(t.druid().runtime.effects.some((effect) => effect.key === `spell:${SPIKE}`), JSON.stringify(t.dm.snapshot!.chat.slice(-2).map((message) => message.content)));
  const before = t.spellCards();
  t.dm.send({ type: "act.zone", casterEntryId: t.pcId, spellId: SPIKE, target: t.refs.second, action: "enter" });
  await tick();
  assert.equal(t.spellCards(), before, "stepping in is free");
  t.dm.send({ type: "act.zone", casterEntryId: t.pcId, spellId: SPIKE, target: t.refs.second, action: "move", feet: 10 });
  await tick();
  assert.equal(t.spellCards(), before + 2, JSON.stringify(t.dm.snapshot!.chat.slice(-4).map((message) => [message.type, message.content])));
});
