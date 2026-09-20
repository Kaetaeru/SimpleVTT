/**
 * V0.9 D329 (SRD_MODULE_PLAN.md §20): three shapes the PHB review asked for, on a synthetic module.
 *
 * - `grant.proficiency` may train tools, which is how 요리사·제작자·음악가 teach what they teach.
 * - `temp-hp.grant` with `pool: "share"` is one pool the user divides (고무하는 강타).
 * - A lasting effect may take dice off whoever attacks its bearer (칼날 방호: the attacker subtracts 1d4).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { tableOutcome } from "../../client/rules/contractTable";
import { featureRuleKey } from "../../client/rules/activation";
import type { AttackSpec, Combatant } from "../../client/rules/resolve";
import { resolveAttack } from "../../client/rules/resolve";
import { sourceOf } from "./support";

const FEAT = "test.d329.feat.quartermaster";
const named = (id: string, name: string, category: string, mechanics: unknown[]) => ({ id, category, presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } }, mechanics });

const MODULE = {
  moduleId: "test.d329", moduleVersion: "1",
  content: [
    named(FEAT, "병참장교", "feat", [
      { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
      { kind: "common-play", config: { id: "feat:quartermaster", entryPoints: [
        { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.proficiency", operation: "add", params: { tools: ["dnd.srd521.item.tool.cooks-utensils"], armor: ["light"] } }] },
        { id: "rations", label: "배급", invocation: "manual", targeting: { from: "targets", min: 1, max: 4 }, operations: [{ kind: "temp-hp.grant", target: "targets", dice: "2d8", pool: "share" }] },
      ] } },
    ]),
  ],
} as unknown as RuleModuleJson;

test("D329: a feat may train tools, not only weapons and armour", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "보급병", classes: "fighter", level: 4, choices: prefer }), cat, { prefer });
  assert.ok(made.derived.features.some((feature) => feature.name === "병참장교"), made.derived.features.map((feature) => feature.name).join(", "));
  assert.ok(made.derived.proficiencies.tools.includes("요리 도구"), made.derived.proficiencies.tools.join(", "));
  assert.ok(made.derived.proficiencies.armor.includes("경장 방어구"), made.derived.proficiencies.armor.join(", "));
});

test("D329: temporary hit points may be one pool the user divides", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "보급병", classes: "fighter", level: 4, choices: prefer }), cat, { prefer });
  // A labelled use is asked for by its own key (the button), as the table asks for it.
  const key = featureRuleKey(made.derived.features.find((feature) => feature.name === "병참장교")!.id);
  const outcome = tableOutcome(made.derived, cat, `${key}#rations`);
  assert.equal(outcome?.party.tempHpPool, "2d8", JSON.stringify(outcome?.party));
  assert.equal(outcome?.party.tempHp, undefined, "not the same amount to each");
});

test("D329: an effect may take dice off whoever swings at its bearer", () => {
  const attacker: Combatant = { id: "a", name: "고블린", kind: "npc", ac: 13, hp: { current: 10, max: 10, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] };
  const warded: Combatant = { id: "t", name: "마법사", kind: "pc", ac: 14, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 2, effects: [], d20DiceAgainst: [{ dice: "-1d4", label: "칼날 방호" }] };
  const spec: AttackSpec = { name: "시미터", source: "npc", attackBonus: 4, mode: "melee", damage: [{ formula: "1d6+2", type: "참격" }] };
  // d20 11 + 4 = 15 would hit AC 14; the ward takes 4 off and it misses.
  const missed = resolveAttack(attacker, warded, spec, { dice: { d: (sides) => (sides === 20 ? 11 : 4) } });
  assert.equal(missed.attackTotal, 11);
  assert.equal(missed.outcome, "miss");
  assert.ok(missed.reasons.some((reason) => reason.includes("칼날 방호")), missed.reasons.join(" · "));
});
