/**
 * V0.9 D339 (SRD_MODULE_PLAN.md §30): extra damage of its own type.
 *
 * A buff that adds "+1d4 radiant to your weapon damage" (성전사의 망토) was written as `damage.bonus`, which adds a
 * number to the weapon's own damage — so the extra was dealt as slashing, and a creature resistant to slashing
 * shrugged off half of the radiant too. With `damageTypes` the bonus becomes a part of its own beside the weapon's,
 * resistance is read against that type, and a critical hit does not double it (it is not the weapon's own dice).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { derivedOf, pcAttackSpec } from "../../client/rules/attackSpec";
import { resolveAttack, type Combatant } from "../../client/rules/resolve";
import { sourceOf } from "./support";

const FEAT = "test.d339.feat.mantle";

const MODULE = {
  moduleId: "test.d339", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Mantle", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "빛나는 망토", description: "무기 피해에 1d4 광휘를 더한다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:mantle", entryPoints: [
          { id: "while-worn", invocation: "manual", operations: [
            { kind: "property.modify", property: "damage.bonus", operation: "add", dice: "1d4", damageTypes: ["radiant"], note: "빛나는 망토" },
          ] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

function fighter() {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "기사", classes: "fighter", level: 4, abilities: { str: 16 }, choices: prefer }), cat, { prefer });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.longsword", name: "장검" });
  const derived = derivedOf({ source: made.source, runtime } as never, cat);
  return { cat, runtime, derived };
}

test("D339: the bonus rides on the attack as its own type", () => {
  const { derived } = fighter();
  const sword = derived.attacks.find((attack) => attack.name === "장검")!;
  assert.deepEqual(sword.extraDamage?.map((part) => [part.formula, part.type]), [["1d4", "radiant"]], JSON.stringify(sword.extraDamage));
  assert.equal(sword.damageTerms.some((term) => term.dice === "1d4"), false, "and it is not added to the weapon's own damage");
});

test("D339: resistance to the weapon's damage does not cover it", () => {
  const { cat, runtime, derived } = fighter();
  const spec = pcAttackSpec({ runtime } as never, derived, derived.attacks.find((attack) => attack.name === "장검")!.id, {}, cat)!.spec;
  assert.deepEqual(spec.riders?.map((part) => part.type), ["광휘"], JSON.stringify(spec.riders));
  assert.deepEqual(spec.damage.map((part) => part.type), ["참격"], "the weapon keeps its own part");
  const attacker: Combatant = { id: "a", name: "기사", kind: "pc", ac: 18, hp: { current: 30, max: 30, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 2, effects: [] };
  const target: Combatant = { id: "t", name: "구울", kind: "npc", ac: 10, hp: { current: 40, max: 40, temp: 0 }, conditions: [], defenses: { resistances: ["참격"], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [] };
  const hit = resolveAttack(attacker, target, spec, { dice: { d: (sides) => (sides === 20 ? 18 : 4) } });
  assert.equal(hit.outcome, "hit");
  const radiant = hit.damage.find((part) => part.part.type === "광휘")!;
  assert.equal(radiant.adjusted, 4, "the radiant part lands whole");
  const slashing = hit.damage.find((part) => part.part.type === "참격")!;
  assert.ok(slashing.adjusted < slashing.rolled, "while the weapon's own damage is halved");
});

test("D339: a critical hit does not double it", () => {
  const { cat, runtime, derived } = fighter();
  const spec = pcAttackSpec({ runtime } as never, derived, derived.attacks.find((attack) => attack.name === "장검")!.id, {}, cat)!.spec;
  const part = spec.riders!.find((item) => item.type === "광휘")!;
  assert.equal(part.critDoubles, false, "it is not the weapon's own dice");
});
