/**
 * R33 (ROLL20_TABLE_SPEC.md D168): the feat catalog drives the feats.
 *
 * Every number R32 left as a constant in the derivation — 방어's +1, 궁술's +2, 대형 무기 전투's floor of 3 and the
 * properties it covers — is read out of the feat's own config now, and the sheet's one-line summary is written from
 * the same keys. The test that matters most is the last kind: a supplement feat nobody wrote code for, carrying the
 * same keys, gets the same treatment.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { emptySource } from "../../client/character/source";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { featExecutionStatus, featNotes } from "../../client/character/featRules";
import { applyDamage, type Combatant } from "../../client/rules/resolve";
import { canOffHand, pcAttackSpec } from "../../client/rules/attackSpec";
import { build, catalog, ids } from "./support";

const target = (): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 60, max: 60, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] });
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const configOf = (slug: string) => catalog().featById(ids.feat(slug))!.config as Record<string, unknown>;

/** A fighter with one fighting style, carrying a greatsword, a longbow and two shortswords. */
function fighter(style: string, background = "criminal") {
  const made = build({ name: "전사", classes: "fighter", level: 4, background, abilities: { str: 16, dex: 16 } }, { "class.0.fighting-style": [`dnd.srd521.feat.fighting-style.${style}`] });
  let runtime = initialRuntime(made.derived);
  for (const [itemId, name] of [["dnd.srd521.item.weapon.greatsword", "대검"], ["dnd.srd521.item.weapon.longbow", "장궁"], ["dnd.srd521.item.weapon.shortsword", "소검"]] as const) runtime = addItem(runtime, { itemId, name });
  return { made, runtime, derived: deriveCharacter(made.source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory }) };
}

test("feats: 방어·궁술·대형 무기 전투의 숫자가 카탈로그 config에서 온다 (D168)", () => {
  const defense = fighter("defense");
  const archery = fighter("archery");
  const gwf = fighter("great-weapon-fighting");
  // The expected values are read from the catalog, not written here: change the module and the test follows.
  const acBonus = configOf("fighting-style.defense").armorAcBonus as number;
  const rangedBonus = configOf("fighting-style.archery").rangedWeaponAttackBonus as number;
  const floor = configOf("fighting-style.great-weapon-fighting").damageDieMinimum as number;
  const covered = configOf("fighting-style.great-weapon-fighting").weaponPropertiesAny as string[];
  assert.equal(defense.derived.ac.value - archery.derived.ac.value, acBonus);
  assert.ok(defense.derived.ac.terms.some((term) => term.label === "방어" && term.value === acBonus), JSON.stringify(defense.derived.ac.terms));
  const bow = (made: ReturnType<typeof fighter>) => made.derived.attacks.find((attack) => attack.name === "장궁")!;
  assert.equal(bow(archery).attackBonus - bow(defense).attackBonus, rangedBonus);
  assert.ok(bow(archery).attackTerms.some((term) => term.label === "궁술" && term.value === rangedBonus), JSON.stringify(bow(archery).attackTerms));
  // The floor lands on exactly the weapons whose properties the config names, and on no others.
  for (const attack of gwf.derived.attacks) {
    const matches = covered.some((property) => attack.properties.includes(property));
    assert.equal(attack.dieMinimum ?? 0, matches ? floor : 0, `${attack.name} (${attack.properties.join("/")})`);
  }
  for (const attack of defense.derived.attacks) assert.equal(attack.dieMinimum, undefined, attack.name);
});

test("feats: 설치한 보충 재주도 같은 config 키만으로 굴러간다 (D168)", () => {
  const module: RuleModuleJson = {
    moduleId: "r33-supplement", moduleVersion: "1", defaultLocale: "ko-KR",
    rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
    content: [{
      id: "fx33.feat.plated", category: "feat", tags: ["feat", "origin"],
      presentation: { originalName: "Plated", locales: { "ko-KR": { name: "판금장이" } } },
      mechanics: [{ kind: "feat-definition", config: { tier: "origin", armorAcBonus: 2, rangedWeaponAttackBonus: 1, damageDieMinimum: 4, weaponPropertiesAny: ["light"] } }],
    }],
  } as unknown as RuleModuleJson;
  const withSupplement = createCatalog([module]);
  assert.equal(withSupplement.featById("fx33.feat.plated")?.tier, "origin");
  const source = emptySource({
    name: "판금 전사", rules: { profile: "dnd.srd-5.2.1", modules: ["r33-supplement"] },
    origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 16, dex: 16, con: 13, int: 10, wis: 12, cha: 8 } },
    tracks: Array.from({ length: 4 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    choices: { "origin.species.originFeat": ["fx33.feat.plated"] },
  });
  const made = autofill(source, withSupplement, { prefer: { "origin.species.originFeat": ["fx33.feat.plated"] } });
  assert.ok(made.derived.feats.some((feat) => feat.id === "fx33.feat.plated"), made.derived.feats.map((feat) => feat.id).join(","));
  let runtime = initialRuntime(made.derived);
  for (const [itemId, name] of [["dnd.srd521.item.weapon.longbow", "장궁"], ["dnd.srd521.item.weapon.shortsword", "소검"]] as const) runtime = addItem(runtime, { itemId, name });
  const derived = deriveCharacter(made.source, withSupplement, { equipped: runtime.equipped, inventory: runtime.inventory });
  // Nobody wrote a line of code for this feat; the three keys carried it.
  assert.ok(derived.ac.terms.some((term) => term.label === "판금장이" && term.value === 2), JSON.stringify(derived.ac.terms));
  assert.ok(derived.attacks.find((attack) => attack.name === "장궁")!.attackTerms.some((term) => term.label === "판금장이" && term.value === 1));
  assert.equal(derived.attacks.find((attack) => attack.name === "소검")!.dieMinimum, 4);
  assert.equal(derived.attacks.find((attack) => attack.name === "장궁")!.dieMinimum, undefined, "장궁 is not Light");
  assert.equal(derived.features.find((feature) => feature.name === "판금장이")!.execution, "derived", "a config the engine reads is not 'prose for the table'");
});

test("feats: 보조 손 공격은 능력 수정치를 잃고, 쌍수 전투가 그것을 돌려준다 (D168)", () => {
  const plain = fighter("defense");
  const twf = fighter("two-weapon-fighting");
  const sword = plain.derived.attacks.find((attack) => attack.name === "소검")!;
  assert.equal(canOffHand(sword), true, sword.properties.join("/"));
  assert.equal(canOffHand(plain.derived.attacks.find((attack) => attack.name === "대검")!), false);
  assert.equal(twf.derived.featEffects.lightOffHandAbilityModifier, "쌍수 전투");
  assert.equal(plain.derived.featEffects.lightOffHandAbilityModifier, undefined);
  const spec = (made: ReturnType<typeof fighter>, offHand: boolean) => pcAttackSpec({ runtime: made.runtime } as never, made.derived, made.derived.attacks.find((attack) => attack.name === "소검")!.id, { offHand })!.spec;
  const bonus = sword.damageBonus;
  assert.ok(bonus > 0, `${bonus}`);
  assert.equal(applyDamage(target(), spec(plain, false).damage, scripted(4), {}).damageTotal, 4 + bonus);
  assert.equal(applyDamage(target(), spec(plain, true).damage, scripted(4), {}).damageTotal, 4, "no style: the off-hand swing is dice only");
  assert.equal(applyDamage(target(), spec(twf, true).damage, scripted(4), {}).damageTotal, 4 + bonus, "쌍수 전투 keeps the modifier");
  assert.ok(spec(plain, true).name.includes("보조 손"), spec(plain, true).name);
  // A two-handed weapon cannot be the off-hand swing, so the rider is ignored rather than quietly costing its damage.
  const greatsword = plain.derived.attacks.find((attack) => attack.name === "대검")!;
  const great = pcAttackSpec({ runtime: plain.runtime } as never, plain.derived, greatsword.id, { offHand: true })!.spec;
  assert.equal(great.name, "대검", "the rider does not stick to a weapon that cannot take it");
  assert.equal(applyDamage(target(), great.damage, scripted(3, 3), {}).damageTotal, 3 + 3 + greatsword.damageBonus);
});

test("feats: 시트에 적히는 줄과 '표에서 판단' 표시가 config에서 만들어진다 (D168)", () => {
  const archery = fighter("archery").derived.features.find((feature) => feature.name === "궁술")!;
  assert.equal(archery.execution, "derived");
  assert.ok(archery.rules?.some((line) => line.includes("+2")), JSON.stringify(archery.rules));
  // 붙잡기 전문가 is prose the table adjudicates; the sheet must not dress its ability increase up as the whole feat.
  // R51 (D186): it now ships a contract that prints those three clauses, so its status is `common-play` — the config
  // notes are unchanged, because the contract adds lines rather than replacing what the config already said.
  assert.equal(featExecutionStatus(configOf("grappler")), "common-play");
  assert.deepEqual(featNotes(configOf("grappler")), ["만들기·레벨업에서 고른 값이 시트에 반영됩니다"]);
  assert.equal(featExecutionStatus(configOf("epic.dimensional-travel")), "descriptive", "a feat with no contract and no key is still prose");
  assert.equal(featExecutionStatus(configOf("savage-attacker")), "pre-roll");
  assert.equal(featExecutionStatus(configOf("epic.truesight")), "derived");
  assert.ok(featNotes(configOf("epic.truesight")).some((line) => line.includes("진시야 60")), JSON.stringify(featNotes(configOf("epic.truesight"))));
  // A feat with no key this engine reads says so, instead of looking applied.
  assert.deepEqual(featNotes({ grants: ["teleport-after-action"] }), []);
  assert.equal(featExecutionStatus({ grants: ["teleport-after-action"] }), "descriptive");
});

test("feats: 마법 입문자의 무료 시전은 config의 freeCastReset을 따른다 (D168)", () => {
  const made = build({ name: "마법 입문자", classes: "fighter", level: 4, background: "criminal" }, { "origin.species.originFeat": [ids.feat("magic-initiate")] });
  const free = made.derived.resources.filter((resource) => resource.freeCastSpellId);
  assert.ok(free.length, made.derived.resources.map((resource) => resource.label).join(","));
  assert.equal(configOf("magic-initiate").freeCastReset, "long-rest");
  for (const resource of free) assert.equal(resource.recovery, "긴 휴식");
});
