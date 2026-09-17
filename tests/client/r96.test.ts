/**
 * R96 (ROLL20_TABLE_SPEC.md D231): class features that were notes for the DM, computed from the sheet — 위험 감지,
 * 야성 본능, 광휘 일격, 강력한 주문 시전, 생명의 제자, 최상급 치유, 포착 불가.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalNpc } from "../../client/campaign/journal";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { advantageFor, pcStats } from "../../client/rules/actions";
import { hitOffers, npcAttackSpec, npcCombatant, pcCombatant } from "../../client/rules/attackSpec";
import { suggestAdvantage } from "../../client/rules/resolve";
import { diceFrom } from "../../client/rules/resolve";
import { pcSpell, resolveSpell } from "../../client/rules/spellcast";
import { build, catalog } from "./support";

test("R96: 위험 감지 and 야성 본능 are advantage on Dexterity saves and on initiative (D231)", () => {
  const stats = pcStats(build({ name: "바바리안", classes: "barbarian", level: 7 }).derived);
  assert.ok(advantageFor(stats, "saving-throw", { ability: "dex" }));
  assert.equal(advantageFor(stats, "saving-throw", { ability: "wis" }), undefined);
  assert.ok(advantageFor(stats, "ability-check", { skill: "initiative" }));
});

test("R96: 광휘 일격 is offered on a paladin's melee hit (D231)", () => {
  const made = build({ name: "팔라딘", classes: "paladin", level: 11 });
  const sword = made.derived.attacks.find((attack) => attack.itemId && !attack.range)!;
  const offer = hitOffers({ runtime: initialRuntime(made.derived) }, made.derived, sword.id, {}, catalog()).find((item) => item.key.endsWith("radiant-strikes"));
  assert.ok(offer?.hint.includes("1d8"), JSON.stringify(offer));
});

test("R96: a life cleric heals the maximum plus 2 + the slot level, and a cleric cantrip adds Wisdom (D231)", () => {
  const made = build({ name: "클레릭", classes: "cleric", level: 17, abilities: { wis: 16 } }, { "class.0.subclass": ["dnd.srd521.subclass.cleric.life-domain"], "class.6.blessed-strikes": ["cleric.blessed-strikes.potent-spellcasting"], "class.0.spells": ["dnd.srd521.spell.cure-wounds"], "class.0.cantrips": ["dnd.srd521.spell.sacred-flame", "dnd.srd521.spell.guidance", "dnd.srd521.spell.light", "dnd.srd521.spell.thaumaturgy", "dnd.srd521.spell.spare-the-dying"] });
  const entry = { id: "c", name: "클레릭", runtime: initialRuntime(made.derived) } as never;
  const cure = pcSpell(entry, made.derived, catalog(), "dnd.srd521.spell.cure-wounds", { kind: "slot", level: 1 })!;
  assert.deepEqual([cure.casterStats.healingSlotBonus, cure.casterStats.healingMaximized], [true, true]);
  const hurt = { ...pcCombatant(entry, made.derived), hp: { current: 1, max: 200, temp: 0 } };
  const row = resolveSpell({ caster: hurt, casterStats: cure.casterStats, spec: cure.spec, targets: [{ combatant: hurt, stats: pcStats(made.derived) }], dice: diceFrom(() => 0) }).targets[0];
  assert.ok(row.note?.includes("최대값") && row.note.includes("+3 (생명의 제자)"), row.note);
  assert.equal(pcSpell(entry, made.derived, catalog(), "dnd.srd521.spell.sacred-flame")?.casterStats.damageModifier, true);
});

test("R96: 포착 불가 — nothing gives advantage against the rogue unless it is incapacitated (D231)", () => {
  const made = build({ name: "로그", classes: "rogue", level: 18 });
  const entry = { id: "r", name: "로그", runtime: initialRuntime(made.derived) } as never;
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  const swing = npcAttackSpec(ogre, ogre.statBlock.actions.find((action) => action.kind === "attack")!.name)!;
  const rogue = { ...pcCombatant(entry, made.derived), conditions: ["넘어짐"] };
  assert.equal(suggestAdvantage(npcCombatant(ogre), rogue, { ...swing, mode: "melee" }).advantage, "normal");
  assert.equal(suggestAdvantage(npcCombatant(ogre), { ...rogue, conditions: ["넘어짐", "충격"] }, { ...swing, mode: "melee" }).advantage, "advantage");
});

test("R100: 진실의 일격 swings with the spellcasting ability and adds its radiant die from level 5 (D235)", async () => {
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  const made = build({ name: "위저드", classes: "wizard", level: 5, abilities: { int: 18, str: 8, dex: 12 } }, { "class.0.cantrips": ["dnd.srd521.spell.true-strike", "dnd.srd521.spell.light", "dnd.srd521.spell.mage-hand"] });
  const entry = { id: "w", name: "위저드", runtime: initialRuntime(made.derived), source: made.source } as never;
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  assert.ok(weapon, made.derived.attacks.map((attack) => attack.name).join(", "));
  const plain = pcAttackSpec(entry, made.derived, weapon.id, {}, catalog())!.spec;
  const strike = pcAttackSpec(entry, made.derived, weapon.id, { weaponSpell: "dnd.srd521.spell.true-strike" }, catalog())!.spec;
  const swap = made.derived.abilities.int.modifier - made.derived.abilities[weapon.ability].modifier;
  assert.equal(strike.attackBonus, plain.attackBonus + swap);
  assert.deepEqual(strike.riders?.map((part) => [part.label, part.formula, part.type]), [[catalog().spellById("dnd.srd521.spell.true-strike")!.name, "1d6", "광휘"]]);
  assert.ok(strike.name.includes(catalog().spellById("dnd.srd521.spell.true-strike")!.name));
});

test("R101: a spell nothing computes says DM 판정 on its card; one the rules run does not (D236)", async () => {
  const { spellIsJudged } = await import("../../client/rules/spellcast");
  const { spellExec } = await import("../../client/compendium/spells");
  const derived = build({ name: "위저드", classes: "wizard", level: 5 }).derived;
  const judged = (slug: string) => spellIsJudged(spellExec(`dnd.srd521.spell.${slug}`)!, catalog(), derived);
  assert.equal(judged("alarm"), true);
  assert.equal(judged("mage-hand"), true);
  assert.equal(judged("longstrider"), false, "its effect contract changes speed");
  assert.equal(judged("bless"), false, "its tracked parts carry dice");
  assert.equal(judged("hunter-s-mark"), false);
  assert.equal(judged("fireball"), false, "not a tracked effect at all");
});

test("R102: monster trait patterns — 언데드 인내, 흡수, 피투성이 분노, 회피술 (D237)", async () => {
  const { applyDamage } = await import("../../client/rules/resolve");
  const zombie = npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.zombie")!));
  assert.equal(zombie.holdAtOneHp?.dcBase, 5);
  const low = { ...zombie, hp: { ...zombie.hp, current: 3 } };
  const saved = applyDamage(low, [{ formula: "4", type: "참격" }], diceFrom(() => 0.99));
  assert.deepEqual([saved.hpAfter, saved.downed], [1, undefined], saved.trait);
  assert.equal(applyDamage(low, [{ formula: "4", type: "광휘" }], diceFrom(() => 0.99)).hpAfter, 0, "radiant damage ends it");
  assert.equal(applyDamage(low, [{ formula: "4", type: "참격" }], diceFrom(() => 0.99), { crit: true }).hpAfter, 0, "so does a critical hit");
  const golem = npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.flesh-golem")!));
  const hurt = { ...golem, hp: { ...golem.hp, current: golem.hp.max - 10 } };
  const zapped = applyDamage(hurt, [{ formula: "6", type: "번개" }], diceFrom(() => 0.5));
  assert.equal(zapped.hpAfter, golem.hp.max - 4, zapped.trait);
  const boar = npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.boar")!));
  const tusk = npcAttackSpec(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.boar")!), monsterById("dnd.srd521.monster.boar")!.actions.find((action) => action.kind === "attack")!.name)!;
  assert.equal(suggestAdvantage({ ...boar, hp: { ...boar.hp, current: 1 } }, zombie, tusk).advantage, "advantage");
  assert.equal(suggestAdvantage(boar, zombie, tusk).advantage, "normal");
  assert.equal(npcCombatant(newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.assassin")!)).evasion, true);
});
