/**
 * V0.9 D331 (SRD_MODULE_PLAN.md §22): rules that are narrower than they looked.
 *
 * - `attack.oncePerTurnPerTarget`: 요정 방랑자's psychic die is once per turn *against each creature*, so the same
 *   turn's swing at somebody else still offers it.
 * - `primary.healing.hitDice`: 비전 활력 heals on the caster's own unspent Hit Point Dice, which the host spends.
 * - `spell.attack-roll.ignore-cover`: 주문 저격수 ignores cover with its spells, not with its bow.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { PROPERTIES } from "../../client/rules/contractEffects";
import type { ActorStats } from "../../client/rules/actions";
import type { SpellExec } from "../../client/compendium/spells";
import type { Combatant } from "../../client/rules/resolve";
import { resolveSpell, type CasterStats } from "../../client/rules/spellcast";
import { sourceOf } from "./support";

const FEATURE = "test.d331.feature.dread";
const named = (id: string, name: string, category: string, mechanics: unknown[]) => ({ id, category, presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name, description: `${name} 설명` } } }, mechanics });

const MODULE = {
  moduleId: "test.d331", moduleVersion: "1",
  content: [
    {
      id: "test.d331.subclass.dread", category: "subclass",
      presentation: { originalName: "Dread", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "공포의 길" } } },
      relationships: [{ kind: "parent", target: "dnd.srd521.class.ranger" }],
      progressionContributions: [{ track: "dnd.srd521.class.ranger", threshold: 3, grants: [FEATURE] }],
      mechanics: [{ kind: "subclass-definition", config: {} }],
    },
    named(FEATURE, "공포의 일격", "option", [{ kind: "common-play", config: { id: FEATURE, entryPoints: [
      { id: "dread", label: "공포의 일격", invocation: "on-hit", attack: { oncePerTurn: true, oncePerTurnPerTarget: true, requiresEffects: [] }, operations: [{ kind: "damage.apply", dice: "1d4", damageType: "정신", target: "attack-target" }] },
    ] } }]),
  ],
} as unknown as RuleModuleJson;

test("D331: a rider may be once per turn against each creature", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.2.subclass": ["test.d331.subclass.dread"] };
  const made = autofill(sourceOf({ name: "순찰자", classes: "ranger", level: 5, abilities: { dex: 16 }, choices: prefer }), cat, { prefer });
  const rider = made.derived.attackRiders?.find((item) => item.key.includes("dread"));
  assert.ok(rider, JSON.stringify(made.derived.attackRiders?.map((item) => item.key)));
  assert.equal(rider!.oncePerTurnPerTarget, true, "the rider carries the narrower limit");
  assert.equal(rider!.oncePerTurn, true, "and the plain limit stays, for anyone who only reads that");
});

test("D331: a spell may heal on the Hit Point Dice the host spent", () => {
  const exec = {
    spellId: "test.d331.spell.vigor", baseLevel: 2, castingEconomy: "bonus-action",
    targeting: { kind: "creature", rangeFeet: 0, minTargets: 1, maxTargets: 1, allowedRelations: ["self"], directTarget: true },
    primary: { kind: "healing", dice: { count: 0, sides: 4, addSpellcastingModifier: true }, hitDice: { count: 2, perSlotAboveBase: 1 } },
  } as unknown as SpellExec;
  const stats: ActorStats = { abilities: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, saves: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, skills: {}, proficiencyBonus: 2 };
  const combatant: Combatant = { id: "c", name: "마법사", kind: "pc", ac: 12, hp: { current: 10, max: 40, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [] };
  const casterStats: CasterStats = { attackBonus: 7, saveDc: 15, modifier: 4, level: 9, hitDiceRolled: { total: 9, note: "히트 다이스 d6 4, d6 5" } };
  const result = resolveSpell({ caster: combatant, casterStats, spec: { spellId: exec.spellId, name: "기력 회복", level: 2, exec }, targets: [{ combatant, stats }], dice: { d: () => 1 } });
  assert.equal(result.targets[0].healed, 9 + 4, "the dice the host spent, plus the caster's modifier");
  assert.match(result.targets[0].note ?? "", /히트 다이스/);
});

test("D331: ignoring cover may be about spells only", () => {
  assert.ok(PROPERTIES.includes("spell.attack-roll.ignore-cover"), "the property exists beside the one that covers every attack");
  assert.ok(PROPERTIES.includes("attack-roll.ignore-cover"));
});
