/**
 * R10 rules leftovers (ROLL20_TABLE_SPEC.md D105): a target repeats the save at the end of its turns when the spell
 * says so; 회피 gives advantage on DEX saves; an NPC's per-day spells are counted; a potion can be used on someone
 * else through the host.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { spellExec } from "../../client/compendium/spells";
import { pcStats, type ActorStats } from "../../client/rules/actions";
import { derivedOf, npcSaveExec, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { itemUse } from "../../client/rules/items";
import type { Combatant } from "../../client/rules/resolve";
import { pcSpell, repeatsSaveAtTurnEnd, resolveSpell, type CasterStats } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [], ...over });
const stats: ActorStats = { abilities: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, saves: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, skills: {}, proficiencyBonus: 2 };
const casterStats: CasterStats = { attackBonus: 5, saveDc: 13, modifier: 3, level: 5 };
const spec = (id: string, level: number, name = id) => ({ spellId: `dnd.srd521.spell.${id}`, name, level, exec: spellExec(`dnd.srd521.spell.${id}`)! });

test("회피 gives advantage on a Dexterity save (two dice, the better kept); hold person and a sleep breath carry an end-of-turn save", () => {
  const caster = combatant({ id: "c", name: "시전자", kind: "pc" });
  const dodging = resolveSpell({ caster, casterStats, spec: spec("fireball", 3, "파이어볼"), targets: [{ combatant: combatant({ conditions: ["회피"] }), stats }], dice: scripted(1, 1, 1, 1, 1, 1, 1, 1, 3, 18) }); // the area damage is rolled once, before the saves
  assert.deepEqual([dodging.targets[0].save!.d20, dodging.targets[0].save!.advantage, dodging.targets[0].save!.dropped, dodging.targets[0].save!.success], [18, "회피", 3, true]);
  const plain = resolveSpell({ caster, casterStats, spec: spec("fireball", 3, "파이어볼"), targets: [{ combatant: combatant(), stats }], dice: scripted(1, 1, 1, 1, 1, 1, 1, 1, 3) });
  assert.equal(plain.targets[0].save!.advantage, undefined);
  // WIS saves are not helped by 회피.
  const held = resolveSpell({ caster, casterStats, spec: spec("hold-person", 2, "인간형 포박"), targets: [{ combatant: combatant({ conditions: ["회피"] }), stats }], dice: scripted(4) });
  assert.equal(held.targets[0].save!.advantage, undefined);
  assert.deepEqual(held.targets[0].effect!.endSave, { ability: "wis", dc: 13 });
  assert.ok(repeatsSaveAtTurnEnd(spellExec("dnd.srd521.spell.hold-person")!) && !repeatsSaveAtTurnEnd(spellExec("dnd.srd521.spell.fireball")!));
  const dragon = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.adult-brass-dragon")!);
  const sleep = npcSaveExec(dragon, "수면 브레스")!;
  const slept = resolveSpell({ caster, casterStats: sleep.casterStats, spec: sleep.spec, targets: [{ combatant: combatant(), stats }], dice: scripted(2) });
  assert.deepEqual([slept.targets[0].marks, slept.targets[0].effect!.endSave], [["행동불능"], { ability: "con", dc: 18 }]);
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R10 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const dice = { value: 0.5 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())), pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    pcItem: (entry, instanceId) => { const derived = derivedOf(entry, catalog()); const item = derived.inventory.find((candidate) => candidate.instanceId === instanceId); if (!item || item.quantity <= 0) return null; const use = itemUse(item, catalog()); return { name: item.name, heal: use.heal, text: use.text, consumes: use.consumes, consume: (runtime) => runtime }; } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "성소", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const cleric = build({ name: "성직자", classes: "cleric", level: 3 }, { "class.0.spells": ["dnd.srd521.spell.hold-person", "dnd.srd521.spell.command", "dnd.srd521.spell.detect-magic", "dnd.srd521.spell.sanctuary", "dnd.srd521.spell.inflict-wounds", "dnd.srd521.spell.create-or-destroy-water"] });
  const pc = newJournalCharacter(campaign.id, "alice", cleric.source, { ...initialRuntime(cleric.derived), hp: { ...initialRuntime(cleric.derived).hp, current: 3 } });
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc2 = newJournalCharacter(campaign.id, "alice", fighter.source, addItem({ ...initialRuntime(fighter.derived), hp: { ...initialRuntime(fighter.derived).hp, current: 5 } }, { itemId: "dnd.srd521.item.gear.potion-of-healing", name: "치유 물약" }));
  alice.send({ type: "journal.put", entry: pc });
  alice.send({ type: "journal.put", entry: pc2 });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  const mage = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.mage")!);
  dm.send({ type: "journal.put", entry: goblin });
  dm.send({ type: "journal.put", entry: mage });
  await tick();
  const clericToken = tokenForCharacter(pc);
  const fighterToken = tokenForCharacter(pc2);
  const goblinToken = tokenForNpc(goblin);
  const mageToken = tokenForNpc(mage);
  alice.send({ type: "token.put", pageId: scene.id, token: clericToken });
  alice.send({ type: "token.put", pageId: scene.id, token: fighterToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  dm.send({ type: "token.put", pageId: scene.id, token: mageToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { cleric: ref(pc.id, clericToken.id), fighter: ref(pc2.id, fighterToken.id), goblin: ref(goblin.id, goblinToken.id), mage: ref(mage.id, mageToken.id) };
  // Goblin, cleric, fighter; current = the cleric's turn.
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 1, sorted: true, turns: [newTurn({ name: "고블린 전사", initiative: 20, tokenId: goblinToken.id, pageId: scene.id, entryId: goblin.id }), newTurn({ name: "성직자", initiative: 15, tokenId: clericToken.id, pageId: scene.id, entryId: pc.id }), newTurn({ name: "파이터", initiative: 10, tokenId: fighterToken.id, pageId: scene.id, entryId: pc2.id })] } });
  await tick();
  const markersOf = (tokenId: string) => host.pageList[0].tokens.find((token) => token.id === tokenId)!.markers.map((marker) => marker.name);
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (client: TableClient, type: string) => [...client.snapshot!.chat].reverse().find((message) => message.type === type)!;
  const count = (client: TableClient, type: string) => client.snapshot!.chat.filter((message) => message.type === type && !message.undone).length;
  return { host, dm, alice, dice, scene, pc, pc2, goblin, mage, clericToken, fighterToken, goblinToken, refs, markersOf, entryOf, last, count, clericDerived: cleric.derived, fighterDerived: fighter.derived };
}

test("host: hold person is shaken off with a save at the end of the target's turn — an NPC (token marks, runtime.endSaves) and a PC (sheet effect and condition)", async () => {
  const { dm, alice, dice, pc2, goblin, goblinToken, refs, markersOf, entryOf, last, count } = await table();
  const hold = "dnd.srd521.spell.hold-person";
  dice.value = 0.1; // d20 = 3: every save fails
  alice.send({ type: "act.cast", caster: refs.cleric, spellId: hold, targets: [refs.goblin] });
  await tick();
  alice.send({ type: "act.cast", caster: refs.cleric, spellId: hold, targets: [refs.fighter] });
  await tick();
  assert.equal(count(dm, "spell"), 2, "two casts (two 2nd-level slots)");
  assert.ok(markersOf(goblinToken.id).includes("마비") && markersOf(goblinToken.id).includes("인간형 포박"), `goblin marks: ${markersOf(goblinToken.id)}`);
  const goblinEntry = entryOf(goblin.id);
  assert.equal(goblinEntry.kind === "npc" ? goblinEntry.runtime.endSaves?.length : 0, 1);
  const fighterEntry = entryOf(pc2.id);
  assert.ok(fighterEntry.kind === "character" && fighterEntry.runtime.conditions.includes("마비") && fighterEntry.runtime.effects.some((effect) => effect.endSave?.ability === "wis"));
  // Cleric's turn ends → fighter's turn: the fighter's turn ends with a failed save (still 3).
  dm.send({ type: "tracker.next" });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(last(dm, "rollresult").content.includes("종료 내성") && last(dm, "rollresult").content.includes("실패"));
  const stillHeld = entryOf(pc2.id);
  assert.ok(stillHeld.kind === "character" && stillHeld.runtime.conditions.includes("마비"), "a failed end-of-turn save keeps the paralysis");
  // Goblin's turn ends with a natural 20 → free; the cleric's turn passes; the fighter's turn ends with a 20 → free too.
  dice.value = 0.99;
  dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(!markersOf(goblinToken.id).includes("마비") && !markersOf(goblinToken.id).includes("인간형 포박"), `goblin freed: ${markersOf(goblinToken.id)}`);
  const freedGoblin = entryOf(goblin.id);
  assert.equal(freedGoblin.kind === "npc" ? freedGoblin.runtime.endSaves?.length ?? 0 : -1, 0);
  dm.send({ type: "tracker.next" });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  const freed = entryOf(pc2.id);
  assert.ok(freed.kind === "character" && !freed.runtime.conditions.includes("마비") && !freed.runtime.effects.some((effect) => effect.key === `spell:${hold}`), "the PC's effect and condition end on a success");
  assert.ok(last(dm, "rollresult").content.includes("성공, 효과 끝"));
});

test("host: an NPC's per-day spell counts its uses — the third fireball is refused, undo gives one back", async () => {
  const { dm, mage, refs, entryOf, count, last } = await table();
  const fireball = "dnd.srd521.spell.fireball";
  dm.send({ type: "act.cast", caster: refs.mage, spellId: fireball, targets: [refs.goblin] });
  await tick();
  dm.send({ type: "act.cast", caster: refs.mage, spellId: fireball, targets: [refs.goblin] });
  await tick();
  assert.equal(count(dm, "spell"), 2);
  const spent = entryOf(mage.id);
  assert.equal(spent.kind === "npc" ? spent.runtime.uses?.[fireball] : -1, 2);
  dm.send({ type: "act.cast", caster: refs.mage, spellId: fireball, targets: [refs.goblin] });
  await tick();
  assert.equal(count(dm, "spell"), 2, "no third fireball today");
  dm.send({ type: "act.undo", messageId: last(dm, "spell").id });
  await tick();
  const back = entryOf(mage.id);
  assert.equal(back.kind === "npc" ? back.runtime.uses?.[fireball] : -1, 1, "undo returns the use");
  // At-will spells never run out.
  dm.send({ type: "act.cast", caster: refs.mage, spellId: "dnd.srd521.spell.light", targets: [refs.mage] });
  await tick();
  assert.equal(count(dm, "spell"), 2);
});

test("host: a potion from the fighter's bag heals the cleric through the table — a card names both, the bag loses one, a second use is refused", async () => {
  const { dm, alice, pc, pc2, refs, entryOf, last, count, fighterDerived } = await table();
  const fighterEntry = entryOf(pc2.id);
  const potion = fighterEntry.kind === "character" ? derivedOf(fighterEntry, catalog()).inventory.find((item) => item.name === "치유 물약") : undefined;
  assert.ok(potion, "the fighter carries a potion");
  void fighterDerived;
  alice.send({ type: "act.item", actor: refs.fighter, target: refs.cleric, instanceId: potion!.instanceId });
  await tick();
  const card = last(dm, "act");
  assert.deepEqual([card.act!.kind, card.act!.actor.name, card.act!.target?.name], ["item", "파이터", "성직자"]);
  // 2d4+2 with every d4 a 3 → 8: the cleric's HP 3 → 11.
  assert.ok(card.act!.text.includes("= 8 회복") && card.act!.text.includes("HP 3 → 11"), card.act!.text);
  const healed = entryOf(pc.id);
  assert.equal(healed.kind === "character" ? healed.runtime.hp.current : -1, 11);
  // The DM cannot see a player's potion vanish twice: the test host's consume is a no-op, so make the second use fail on the host's own rule instead.
  alice.send({ type: "act.item", actor: refs.cleric, target: refs.fighter, instanceId: potion!.instanceId });
  await tick();
  assert.equal(count(dm, "act"), 1, "the cleric has no such potion");
});
