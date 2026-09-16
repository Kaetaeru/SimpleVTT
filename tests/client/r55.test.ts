/**
 * R55 (ROLL20_TABLE_SPEC.md D190): the reasons a roll is advantaged, opened to the content.
 *
 * `suggestAdvantage` knew fifteen reasons by heart and nothing could add a sixteenth. 무모한 공격 — a barbarian's
 * whole offence — was a sentence on the sheet: the app rolled one die and the player was expected to remember both
 * halves of the 2024 trade. Now a contract writes both, and each side of the swing reads its own.
 *
 * Cover is the other half of this seam: a contract may say an attack ignores it, which is what 명사수 and 주문
 * 저격수 are mostly made of.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { addItem, useFeature } from "../../client/character/play";
import { featureActivation } from "../../client/rules/activation";
import { pcAttackSpec, pcCombatant } from "../../client/rules/attackSpec";
import { diceFrom, resolveAttack, suggestAdvantage, type Combatant } from "../../client/rules/resolve";
import { build, catalog } from "./support";

const dummy = (extra: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 60, max: 60, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], ...extra });

/** A barbarian who has declared Reckless Attack, holding a greataxe and a shortbow. */
function reckless(level = 5) {
  const made = build({ name: "야만", classes: "barbarian", level, abilities: { str: 18, dex: 14 } });
  let runtime = initialRuntime(made.derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.greataxe", name: "대도끼" });
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.shortbow", name: "단궁" });
  const feature = made.derived.features.find((item) => item.name === "무모한 공격")!;
  runtime = useFeature(runtime, made.derived, feature, featureActivation(feature, made.derived)!)!;
  const derived = deriveCharacter(made.source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects });
  return { made, runtime, derived };
}

test("R55: 무모한 공격 gives advantage on the swings it covers, and only those (D190)", () => {
  const { runtime, derived } = reckless();
  assert.deepEqual(derived.advantageOn?.map((item) => item.scope), ["strength-melee"], JSON.stringify(derived.advantageOn));
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const bow = derived.attacks.find((attack) => attack.name.includes("단궁"))!;
  const specOf = (id: string) => pcAttackSpec({ runtime } as never, derived, id, {}, catalog())!.spec;
  assert.deepEqual(specOf(axe.id).advantageOn, ["무모한 공격: 이번 턴 근력 근접 공격"]);
  assert.equal(specOf(bow.id).advantageOn, undefined, "a bow is not a Strength melee swing");

  // The resolver rolls two dice and keeps the better, and says why.
  const swing = resolveAttack(dummy({ kind: "pc" }), dummy(), specOf(axe.id), { dice: diceFrom(() => 0.5), fixed: { d20s: [3, 17] } });
  assert.equal(swing.advantage, "advantage");
  assert.equal(swing.kept, 17);
  assert.ok(swing.reasons.includes("무모한 공격: 이번 턴 근력 근접 공격"), JSON.stringify(swing.reasons));
});

test("R55: and it gives the same advantage away — attacks against the barbarian (D190)", () => {
  const { runtime, derived } = reckless();
  assert.deepEqual(derived.grantsAdvantage, ["무모한 공격: 다음 턴 시작까지 이쪽을 향한 공격"]);
  const combatant = pcCombatant({ id: "pc", name: "야만", runtime } as never, derived);
  assert.deepEqual(combatant.grantsAdvantage, ["무모한 공격: 다음 턴 시작까지 이쪽을 향한 공격"]);
  const ogreSwing = { name: "주먹", source: "npc" as const, attackBonus: 6, mode: "melee" as const, damage: [{ formula: "2d8+4", type: "타격" }] };
  const suggested = suggestAdvantage(dummy(), combatant, ogreSwing);
  assert.equal(suggested.advantage, "advantage");
  assert.deepEqual(suggested.reasons, ["무모한 공격: 다음 턴 시작까지 이쪽을 향한 공격"]);
  // Without the declaration, nothing is given away.
  const calm = build({ name: "야만", classes: "barbarian", level: 5 });
  assert.equal(pcCombatant({ id: "pc", name: "야만", runtime: initialRuntime(calm.derived) } as never, calm.derived).grantsAdvantage, undefined);
});

test("R55: the sheet says both halves out loud (D190)", () => {
  const { derived } = reckless();
  const applied = derived.activeEffects.find((effect) => effect.name === "무모한 공격")!;
  assert.equal(applied.applied, true, JSON.stringify(applied));
  assert.ok(applied.notes.some((note) => note.startsWith("공격 굴림 유리")), JSON.stringify(applied.notes));
  assert.ok(applied.notes.some((note) => note.startsWith("이 캐릭터를 향한 공격 유리")), JSON.stringify(applied.notes));
});

test("R55: an attack that ignores cover ignores the DM's cover, and says so (D190)", () => {
  const spec = { name: "장궁", source: "weapon" as const, attackBonus: 7, mode: "ranged" as const, damage: [{ formula: "1d8+3", type: "관통" }], ignoresCover: true };
  const plain = { ...spec, ignoresCover: false };
  const behind = dummy({ ac: 15 });
  const shot = (which: typeof spec) => resolveAttack(dummy({ kind: "pc" }), behind, which, { dice: diceFrom(() => 0.5), fixed: { d20s: [10] }, overrides: { cover: 5 } });
  assert.equal(shot(plain).targetAc, 20, "3/4 cover is +5 AC");
  assert.equal(shot(plain).outcome, "miss");
  assert.equal(shot(spec).targetAc, 15, "the sharpshooter does not see it");
  assert.equal(shot(spec).outcome, "hit");
  assert.ok(shot(spec).reasons.includes("엄폐 +5 무시"), JSON.stringify(shot(spec).reasons));
  // With no cover declared there is nothing to say.
  const open = resolveAttack(dummy({ kind: "pc" }), behind, spec, { dice: diceFrom(() => 0.5), fixed: { d20s: [10] } });
  assert.deepEqual(open.reasons, []);
});

test("R55: a declared advantage and a condition that takes it away still cancel out (D190)", () => {
  const { runtime, derived } = reckless();
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const spec = pcAttackSpec({ runtime } as never, derived, axe.id, {}, catalog())!.spec;
  // The barbarian is poisoned: one plus, one minus, and 2024 says they cancel.
  const suggested = suggestAdvantage(dummy({ kind: "pc", conditions: ["중독"] }), dummy(), spec);
  assert.equal(suggested.advantage, "normal");
  assert.ok(suggested.reasons.includes("유리·불리가 상쇄"), JSON.stringify(suggested.reasons));
});
