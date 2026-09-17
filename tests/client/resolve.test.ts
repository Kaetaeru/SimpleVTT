/**
 * Attack resolution (ROLL20_TABLE_SPEC.md §12.2): the rules table — advantage from conditions, AC, natural 20/1,
 * crit dice doubling, riders, resistance/immunity/vulnerability in either language, temp HP first, concentration
 * saves, 0 HP consequences, range — then the host applying cards to sheets and tokens, the DM palette (force
 * outcome, cover, reroll, damage edits, undo) and D90 "DM 확인 후 적용".
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { startEffect } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { derivedOf, npcAttackSpec, pcAttackSpec, pcCombatant, pcConcentrationKey, weaponRange } from "../../client/rules/attackSpec";
import type { AttackSpec, Combatant } from "../../client/rules/resolve";
import { describeResolution, diceFrom, listCovers, resolveAttack, suggestAdvantage } from "../../client/rules/resolve";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "x", name: "X", kind: "npc", ac: 15, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 2, effects: [], ...over });
const sword: AttackSpec = { name: "장검", source: "weapon", attackBonus: 5, mode: "melee", damage: [{ formula: "1d8+3", type: "참격" }] };
/** Scripted dice: d20s then damage dice in call order. */
const scripted = (...values: number[]) => { let at = 0; return { d: (_sides: number) => values[at++ % values.length] }; };

test("rules table: advantage from conditions, AC, natural 20/1, crit doubling, resistances in either language, temp HP, concentration, downed", () => {
  const me = combatant({ id: "me", name: "나", kind: "pc" });
  // 18+5 = 23 vs AC 15: hit; 1d8 → 6, +3 = 9.
  let result = resolveAttack(me, combatant(), sword, { dice: scripted(18, 6) });
  assert.deepEqual([result.outcome, result.attackTotal, result.damageTotal, result.hpAfter], ["hit", 23, 9, 11]);
  // Natural 1 misses even with a big bonus; natural 20 hits AC 30 and doubles the dice (not the +3).
  assert.equal(resolveAttack(me, combatant({ ac: 5 }), sword, { dice: scripted(1) }).outcome, "fumble");
  result = resolveAttack(me, combatant({ ac: 30 }), sword, { dice: scripted(20, 4, 5) });
  assert.deepEqual([result.outcome, result.damage[0].dice, result.damageTotal], ["crit", [4, 5], 12]);
  // Advantage from a prone target (melee) keeps the higher die; disadvantage for a ranged attack on a prone target keeps the lower.
  const prone = combatant({ conditions: ["넘어짐"] });
  result = resolveAttack(me, prone, sword, { dice: scripted(3, 17, 2) });
  assert.deepEqual([result.advantage, result.d20s, result.kept], ["advantage", [3, 17], 17]);
  const bow: AttackSpec = { ...sword, name: "단궁", mode: "ranged", damage: [{ formula: "1d6+2", type: "piercing" }] };
  result = resolveAttack(me, prone, bow, { dice: scripted(3, 17) });
  assert.deepEqual([result.advantage, result.kept, result.outcome], ["disadvantage", 3, "miss"]);
  // Advantage and disadvantage cancel; an unconscious target within 5 ft turns a hit into a critical.
  assert.equal(suggestAdvantage(combatant({ conditions: ["장님"] }), prone, sword).advantage, "normal");
  result = resolveAttack(me, combatant({ conditions: ["무의식"] }), sword, { dice: scripted(12, 2, 2) });
  assert.equal(result.outcome, "crit");
  assert.ok(result.reasons.some((reason) => reason.includes("치명타")));
  // Resistance halves (rounded down), immunity zeroes, vulnerability doubles — lists in Korean or English.
  assert.ok(listCovers(["타격·관통·참격"], "slashing") && listCovers(["bludgeoning, piercing, and slashing from nonmagical attacks"], "참격") && !listCovers(["fire"], "참격"));
  result = resolveAttack(me, combatant({ defenses: { resistances: ["slashing"], immunities: [], vulnerabilities: [] } }), sword, { dice: scripted(18, 6) });
  assert.deepEqual([result.damage[0].adjustment, result.damageTotal], ["저항", 4]);
  result = resolveAttack(me, combatant({ defenses: { resistances: [], immunities: ["참격"], vulnerabilities: [] } }), sword, { dice: scripted(18, 6) });
  assert.deepEqual([result.damage[0].adjustment, result.damageTotal, result.hpAfter], ["면역", 0, 20]);
  result = resolveAttack(me, combatant({ defenses: { resistances: [], immunities: [], vulnerabilities: ["slashing"] } }), sword, { dice: scripted(18, 6) });
  assert.equal(result.damageTotal, 18);
  // Temp HP absorbs first; a concentrating target rolls CON vs max(10, damage/2) — automatic (D92).
  result = resolveAttack(me, combatant({ hp: { current: 20, max: 20, temp: 5 }, concentration: "축복", conSave: 1 }), sword, { dice: scripted(18, 8, 7) });
  assert.deepEqual([result.absorbed, result.hpLost, result.hpAfter, result.tempAfter], [5, 6, 14, 0]);
  assert.deepEqual(result.concentration, { effect: "축복", dc: 10, d20: 7, total: 8, success: false });
  result = resolveAttack(me, combatant({ concentration: "축복", conSave: 5, hp: { current: 60, max: 60, temp: 0 } }), { ...sword, damage: [{ formula: "8d6", type: "fire" }] }, { dice: scripted(18, 6, 6, 6, 6, 6, 6, 6, 6, 9) });
  assert.deepEqual(result.concentration, { effect: "축복", dc: 24, d20: 9, total: 14, success: false }, "DC is half the damage when above 10");
  // 0 HP: an NPC dies, a PC goes unconscious unless the overflow reaches max HP (instant death).
  assert.equal(resolveAttack(me, combatant({ hp: { current: 3, max: 20, temp: 0 } }), sword, { dice: scripted(18, 6) }).downed, "dead");
  assert.equal(resolveAttack(me, combatant({ kind: "pc", hp: { current: 3, max: 20, temp: 0 } }), sword, { dice: scripted(18, 6) }).downed, "unconscious");
  assert.equal(resolveAttack(me, combatant({ kind: "pc", hp: { current: 3, max: 6, temp: 0 } }), sword, { dice: scripted(18, 6) }).downed, "instant-death");
  // Overrides: forced miss keeps the same dice; cover raises AC; damage scale/delta.
  result = resolveAttack(me, combatant(), sword, { dice: scripted(18, 6), overrides: { outcome: "miss" } });
  assert.deepEqual([result.outcome, result.damage.length], ["miss", 0]);
  result = resolveAttack(me, combatant(), sword, { dice: scripted(11, 6), overrides: { cover: 2 } });
  assert.deepEqual([result.targetAc, result.outcome], [17, "miss"]);
  result = resolveAttack(me, combatant(), sword, { dice: scripted(18, 6), overrides: { damageScale: 0.5, damageDelta: -1 } });
  assert.equal(result.damageTotal, 3);
  result = resolveAttack(me, combatant(), sword, { dice: scripted(0), fixed: { d20s: [18], damage: [[6]] } });
  assert.deepEqual([result.kept, result.damageTotal], [18, 9], "fixed dice re-resolve without new rolls");
  assert.ok(describeResolution(result).includes("적중"));
});

test("sheet specs: melee vs ranged, riders (암습, 신성한 강타 with a slot), PC combatant with concentration, NPC from token bar", () => {
  const { source: rogueSource, derived: rogueDerived } = build({ name: "도적", classes: "rogue", level: 5 });
  const rogue = newJournalCharacter("camp", "p", rogueSource, initialRuntime(rogueDerived));
  const dagger = rogueDerived.attacks.find((attack) => attack.name === "단검")!;
  assert.deepEqual(weaponRange(dagger), { mode: "melee" }, "a dagger is swung: an opportunity attack may use it");
  assert.deepEqual(weaponRange(rogueDerived.attacks.find((attack) => attack.name === "단궁")!), { mode: "ranged" });
  const withSneak = pcAttackSpec(rogue, rogueDerived, dagger.id, { contracts: ["rogue.sneak-attack"], facts: ["sneak-advantage"] })!;
  assert.equal(withSneak.spec.riders?.[0]?.formula, "3d6", "level 5 rogue: 3d6 sneak attack");
  assert.equal(pcAttackSpec(rogue, rogueDerived, dagger.id, {})!.spec.riders?.length, 0);
  const { source: palSource, derived: palDerived } = build({ name: "팔라딘", classes: "paladin", level: 5 });
  const paladin = newJournalCharacter("camp", "p", palSource, initialRuntime(palDerived));
  const weapon = palDerived.attacks[0];
  const smite = pcAttackSpec(paladin, palDerived, weapon.id, { spellSmite: { spellId: "dnd.srd521.spell.divine-smite", slot: 2 } })!;
  assert.equal(smite.spec.riders?.[0]?.formula, "3d8");
  assert.equal(smite.spend(paladin.runtime).slotsUsed[2], 1, "the smite spends the slot");
  const concentrating = { ...paladin, runtime: startEffect(paladin.runtime, { key: "spell:bless", name: "축복", source: "spell", duration: "1 minute", concentration: true, rounds: 10 }) };
  const me = pcCombatant(concentrating, derivedOf(concentrating, catalog()));
  assert.equal(me.concentration, "축복");
  assert.equal(pcConcentrationKey(concentrating), "spell:bless");
  assert.equal(me.ac, palDerived.ac.value);
  const goblin = newJournalNpc("camp", "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  const token = { ...tokenForNpc(goblin), bars: [{ value: 4, max: 10, visible: true, editable: false }, { visible: true, editable: false }, { visible: true, editable: false }] as never };
  assert.equal(npcAttackSpec(goblin, "시미터")?.attackBonus, 1);
  assert.equal(npcAttackSpec(goblin, "없는 행동"), null);
});

test("host: a player's ⚔ hits an NPC token (bar drops, 사망 marker), the goblin hits back into the sheet, the palette edits and undoes, D90 waits", async () => {
  const rolls = [0.95, 0.5, 0.5, 0.95, 0.99, 0.0, 0.5, 0.5, 0.5, 0.5];
  let at = 0;
  const hub = new MemoryHub();
  const base = newCampaign("판정 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "ABC234" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => rolls[at++ % rolls.length], attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const cave = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: cave });
  dm.send({ type: "page.ribbon", pageId: cave.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry: pc });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: cave.id, token: pcToken });
  dm.send({ type: "token.put", pageId: cave.id, token: goblinToken });
  await tick();
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  // 0.95 → d20 20 (crit); damage dice from 0.5, 0.5, 0.95, 0.99 → 2d6 doubled = [4, 4, 6, 6] + 3 = 23 → goblin (10 HP) dies.
  alice.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: cave.id, tokenId: pcToken.id }, targets: [{ pageId: cave.id, tokenId: goblinToken.id }], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  const card = dm.snapshot!.chat.find((message) => message.type === "action")!;
  assert.ok(card, "the resolution is a chat card");
  assert.deepEqual([card.action!.outcome, card.action!.damageTotal, card.action!.hpAfter, card.action!.downed, card.action!.applied], ["crit", 23, 0, "dead", true]);
  const goblinNow = host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!;
  assert.equal(goblinNow.bars[0].value, 0, "the unlinked token bar took the damage");
  assert.ok(goblinNow.markers.some((marker) => marker.name === "사망"));
  assert.equal(alice.snapshot!.chat.filter((message) => message.type === "action").length, 1, "players see the card with every die (D93)");
  // Undo restores the token; the card is superseded by an undone one.
  dm.send({ type: "act.undo", messageId: card.id });
  await tick();
  assert.equal(host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!.bars[0].value, 10);
  assert.ok(dm.snapshot!.chat.some((message) => message.supersedes === card.id && message.undone));
  // The goblin attacks alice: d20 from 0.0 → 1 = fumble; the DM forces a hit with the palette, damage lands on the sheet.
  dm.send({ type: "act.attack", attacker: { entryId: goblin.id, pageId: cave.id, tokenId: goblinToken.id }, targets: [{ pageId: cave.id, tokenId: pcToken.id }], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  const fumble = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.equal(fumble.action!.outcome, "fumble");
  dm.send({ type: "act.adjust", messageId: fumble.id, overrides: { outcome: "hit", note: "실은 맞았다" } });
  await tick();
  const forced = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.deepEqual([forced.supersedes, forced.action!.outcome, forced.action!.d20s], [fumble.id, "hit", fumble.action!.d20s], "the forced hit keeps the same d20");
  const sheet = host.journal.find((entry) => entry.id === pc.id);
  assert.ok(sheet?.kind === "character" && sheet.runtime.hp.current === pc.runtime.hp.current - forced.action!.damageTotal, "the PC sheet took the forced hit");
  assert.ok(sheet?.kind === "character" && sheet.runtime.log.some((line) => line.text.includes("시미터")));
  // Players cannot use the palette; a player cannot attack with someone else's token.
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.undo", messageId: forced.id });
  alice.send({ type: "act.attack", attacker: { entryId: goblin.id, pageId: cave.id, tokenId: goblinToken.id }, targets: [{ pageId: cave.id, tokenId: pcToken.id }], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  assert.equal(refusals.length, 2);
  // D90: with "DM 확인 후 적용" a player's attack waits; confirm applies it.
  host.updateCampaign({ ...host.state, settings: { ...host.state.settings, dmConfirmsResults: true } });
  await tick();
  alice.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: cave.id, tokenId: pcToken.id }, targets: [{ pageId: cave.id, tokenId: goblinToken.id }], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  const waiting = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.equal(waiting.action!.applied, false);
  assert.equal(host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!.bars[0].value, 10, "nothing applied yet");
  dm.send({ type: "act.confirm", messageId: waiting.id });
  await tick();
  const confirmed = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.equal(confirmed.action!.applied, true);
  if (confirmed.action!.outcome === "hit" || confirmed.action!.outcome === "crit") assert.equal(host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!.bars[0].value, confirmed.action!.hpAfter);
});
