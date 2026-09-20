/**
 * V0.9 D330 (SRD_MODULE_PLAN.md §21): what a feat asks for first, and which weapons a rule is about.
 *
 * - A feat may require armour or shield training (중갑 달인 asks for heavy armour); the picker says why it is greyed.
 * - A weapon filter may be written as a little expression, so content names its own weapons: `a|b` is either,
 *   `a+b` is both, `items:<id>,<id>` names the weapons themselves (장병기 달인: a quarterstaff or a spear, or a
 *   Heavy weapon with Reach).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { featDisabledReason, type FeatContext } from "../../client/character/choices";
import type { FeatView } from "../../client/catalog/catalog";
import type { DerivedAttack } from "../../client/character/types";
import { attackScopeFilter } from "../../client/rules/contractEffects";

const feat = (requires: string): FeatView => ({ id: "test.d330.feat.bulwark", name: "방벽", nameEn: "Bulwark", tier: "general", repeatable: false, requires, grants: [], config: {}, scope: "installed" });
const context = (armor: string[], shield = false): FeatContext => ({ level: 8, abilityScore: () => 14, taken: () => false, hasSpellcasting: false, hasFightingStyle: false, training: { armor, shield } });
const attack = (over: Partial<DerivedAttack> = {}): DerivedAttack => ({ id: "a", name: "무기", ability: "str", attackBonus: 5, attackTerms: [], damage: "1d8", damageBonus: 3, damageTerms: [], damageType: "참격", properties: [], ...over }) as DerivedAttack;

test("D330: a feat may ask for armour or shield training first", () => {
  assert.equal(featDisabledReason(feat("armor-training:heavy"), context(["light", "medium"])), "중장 방어구 훈련 필요");
  assert.equal(featDisabledReason(feat("armor-training:heavy"), context(["light", "medium", "heavy"])), undefined);
  assert.equal(featDisabledReason(feat("shield-training"), context(["light"])), "방패 훈련 필요");
  assert.equal(featDisabledReason(feat("shield-training"), context(["light"], true)), undefined);
});

test("D330: a weapon filter may name its own weapons, or two properties at once", () => {
  const polearm = attackScopeFilter("items:quarterstaff,spear|heavy+reach")!;
  assert.ok(polearm, "the expression is understood");
  assert.equal(polearm(attack({ itemId: "dnd.srd521.item.weapon.quarterstaff" })), true, "the quarterstaff it names");
  assert.equal(polearm(attack({ itemId: "dnd.srd521.item.weapon.spear", properties: ["thrown", "versatile"] })), true);
  assert.equal(polearm(attack({ itemId: "dnd.srd521.item.weapon.glaive", properties: ["heavy", "reach", "two-handed"] })), true, "and a Heavy weapon with Reach");
  assert.equal(polearm(attack({ itemId: "dnd.srd521.item.weapon.greatsword", properties: ["heavy", "two-handed"] })), false, "a greatsword is neither");
  // The plain names still work as they did.
  assert.equal(attackScopeFilter("heavy")!(attack({ properties: ["heavy"] })), true);
  assert.equal(attackScopeFilter("무엇"), undefined, "an unknown filter is refused, not silently true");
});
