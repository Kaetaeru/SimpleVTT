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
  assert.deepEqual(made.derived.spellDamageModifier, [EB], "the target cantrip can be picked");
  const entry = { id: "w", name: "워락", runtime: initialRuntime(made.derived), source: made.source } as never;
  const cast = pcSpell(entry, made.derived, catalog(), EB)!;
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  const result = resolveSpell({ caster: pcCombatant(entry, made.derived), casterStats: cast.casterStats, spec: cast.spec, targets: [{ combatant: npcCombatant(ogre), stats: { saves: {} } as never }], dice: diceFrom(() => 0.99), overrides: { outcome: "hit" } });
  const parts = result.targets[0].attack!.damage.map((part) => part.part.formula);
  assert.deepEqual(parts, ["1d10+3", "1d10+3"], "two beams at level 5, each 1d10 + 3");
});

test("R98: an evoker's cantrip deals half on a miss, and an evocation adds Intelligence once (D233)", () => {
  const FIRE_BOLT = "dnd.srd521.spell.fire-bolt";
  const FIREBALL = "dnd.srd521.spell.fireball";
  const made = build({ name: "위저드", classes: "wizard", level: 10, abilities: { int: 16 } }, { "class.0.subclass": ["dnd.srd521.subclass.wizard.evoker"], "class.0.cantrips": [FIRE_BOLT, "dnd.srd521.spell.light", "dnd.srd521.spell.mage-hand", "dnd.srd521.spell.prestidigitation", "dnd.srd521.spell.ray-of-frost"], "class.0.spells": [FIREBALL] });
  assert.equal(made.derived.potentCantrip, true, made.derived.features.map((feature) => feature.id).join(", "));
  const entry = { id: "w", name: "위저드", runtime: initialRuntime(made.derived), source: made.source } as never;
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  const bolt = pcSpell(entry, made.derived, catalog(), FIRE_BOLT)!;
  const missed = resolveSpell({ caster: pcCombatant(entry, made.derived), casterStats: bolt.casterStats, spec: bolt.spec, targets: [{ combatant: npcCombatant(ogre), stats: { saves: {} } as never }], dice: diceFrom(() => 0.99), overrides: { outcome: "miss" } }).targets[0];
  assert.ok((missed.attack?.damageTotal ?? 0) > 0, JSON.stringify(missed.attack?.damage));
  const ball = pcSpell(entry, made.derived, catalog(), FIREBALL, { kind: "slot", level: 3 })!;
  assert.equal(ball.casterStats.damageBonusOnce, 3);
  const burned = resolveSpell({ caster: pcCombatant(entry, made.derived), casterStats: ball.casterStats, spec: ball.spec, targets: [{ combatant: npcCombatant(ogre), stats: { saves: { dex: -1 } } as never }], dice: diceFrom(() => 0) }).targets[0];
  assert.ok(burned.damage?.damage.some((part) => part.part.label === "강화된 방출" && part.adjusted === 3), JSON.stringify(burned.damage?.damage.map((part) => [part.part.label, part.adjusted])));
});
