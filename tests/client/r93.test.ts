/**
 * R93 (ROLL20_TABLE_SPEC.md D228): 고통스러운 폭발 — the invocation's target cantrip could never be picked (the class
 * cantrips are chosen after the invocations), and the flag it set was read by nothing. Each beam of 섬뜩한 파동 now
 * adds the Charisma modifier.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { initialRuntime } from "../../client/character/runtime";
import { newJournalNpc } from "../../client/campaign/journal";
import { monsterById } from "../../client/compendium/monsters";
import { npcCombatant, pcCombatant } from "../../client/rules/attackSpec";
import { diceFrom } from "../../client/rules/resolve";
import { pcSpell, resolveSpell } from "../../client/rules/spellcast";
import { build, catalog } from "./support";

const EB = "dnd.srd521.spell.eldritch-blast";

test("R93: 고통스러운 폭발 adds the Charisma modifier to every beam of 섬뜩한 파동 (D228)", () => {
  const made = build({ name: "워락", classes: "warlock", level: 5, abilities: { cha: 16 } }, { "class.0.invocations": ["invocation.agonizing-blast"], "class.0.cantrips": [EB, "dnd.srd521.spell.mage-hand"], "class.0.invocation.agonizing-blast.target": [EB] });
  assert.deepEqual(made.derived.cantripDamageModifier, [EB], "the target cantrip can be picked");
  const entry = { id: "w", name: "워락", runtime: initialRuntime(made.derived), source: made.source } as never;
  const cast = pcSpell(entry, made.derived, catalog(), EB)!;
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  const result = resolveSpell({ caster: pcCombatant(entry, made.derived), casterStats: cast.casterStats, spec: cast.spec, targets: [{ combatant: npcCombatant(ogre), stats: { saves: {} } as never }], dice: diceFrom(() => 0.99), overrides: { outcome: "hit" } });
  const parts = result.targets[0].attack!.damage.map((part) => part.part.formula);
  assert.deepEqual(parts, ["1d10+3", "1d10+3"], "two beams at level 5, each 1d10 + 3");
});
