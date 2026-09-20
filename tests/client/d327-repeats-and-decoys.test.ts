/**
 * V0.9 D327 (SRD_MODULE_PLAN.md §8): repeats that belong to somebody else, and duplicates that take the hit.
 *
 * - 거울 분신: every hit rolls a d6 for each duplicate still standing; a 3 or better makes one take the hit and be
 *   destroyed, and the spell ends when the third is gone.
 * - 용의 숨결 is cast on a willing creature and *that* creature breathes — its ↻ rolls against the caster's save DC,
 *   not its own, at the slot the spell was cast with.
 * - 비전의 손 chooses which hand it makes on every repeat (the four effects are the spell's variants), and
 *   생각 탐지's repeat reads a mind chosen afresh.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spellExec, variantsOf } from "../../client/compendium/spells";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { bearerDefenses } from "../../client/rules/attackSpec";
import { deriveCharacter } from "../../client/character/derive";
import type { AttackSpec, Combatant } from "../../client/rules/resolve";
import { resolveAttack } from "../../client/rules/resolve";
import { pcSpell } from "../../client/rules/spellcast";
import { sourceOf } from "./support";

const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const attacker: Combatant = { id: "a", name: "고블린", kind: "npc", ac: 13, hp: { current: 10, max: 10, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] };
const spec: AttackSpec = { name: "시미터", source: "npc", attackBonus: 4, mode: "melee", damage: [{ formula: "1d6+2", type: "참격" }] };
const mirrored = (destroyed: number): ActiveEffect => ({ key: "spell:dnd.srd521.spell.mirror-image", name: "거울 분신", source: "spell", duration: "1분", concentration: false, elapsed: 0, startedAt: "", bearer: true, ...(destroyed ? { tally: { success: 0, failure: destroyed } } : {}) });

test("D327: 거울 분신 puts a duplicate in the way, and one fewer next time", () => {
  const defenses = bearerDefenses([mirrored(0)]);
  assert.deepEqual(defenses.decoys.map((item) => [item.left, item.die, item.min]), [[3, 6, 3]]);
  const target: Combatant = { id: "t", name: "마법사", kind: "pc", ac: 12, hp: { current: 30, max: 30, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 2, effects: [], decoys: defenses.decoys[0] };
  // The swing lands (d20 15 + 4 = 19 vs AC 12), then three d6 for the duplicates: 1, 1, 4 — the last one takes it.
  const found = resolveAttack(attacker, target, spec, { dice: scripted(15, 1, 1, 4) });
  assert.equal(found.outcome, "miss");
  assert.deepEqual(found.decoy?.rolls, [1, 1, 4]);
  assert.equal(found.damageTotal, 0);
  // With two left and both low, the swing lands on the caster.
  const two = bearerDefenses([mirrored(1)]).decoys[0];
  assert.equal(two.left, 2);
  const through = resolveAttack(attacker, { ...target, decoys: two }, spec, { dice: scripted(15, 1, 2, 3, 3) });
  assert.equal(through.outcome, "hit");
  assert.equal(through.decoy, undefined);
});

test("D327: 용의 숨결's repeat belongs to the creature it was cast on, with the caster's DC", () => {
  const cat = createCatalog([]);
  const made = autofill(sourceOf({ name: "전사", classes: "fighter", level: 5, abilities: { cha: 8 } }), cat);
  const now = new Date().toISOString();
  const runtime = { ...initialRuntime(made.derived), effects: [
    { key: "spell:dnd.srd521.spell.dragon-s-breath", name: "용의 숨결", source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: now, bearer: true, from: "caster", level: 3, cast: { level: 3, saveDc: 17, modifier: 5 } },
  ] };
  const derived = deriveCharacter(made.source, cat);
  const cast = pcSpell({ runtime }, derived, cat, "dnd.srd521.spell.dragon-s-breath", { kind: "sustain" });
  assert.ok(cast, "the fighter's own sheet can use it");
  assert.equal(cast!.casterStats.saveDc, 17, "the caster's DC, not the fighter's");
  assert.equal(cast!.spec.level, 3, "and the slot it was cast at");
  assert.equal(cast!.spec.exec.primary.kind, "save-damage");
});

test("D327: 비전의 손 offers its four hands on every repeat, and 생각 탐지 reads a new mind", () => {
  const variants = variantsOf("dnd.srd521.spell.arcane-hand");
  assert.deepEqual(variants.map((variant) => variant.id), ["clenched-fist", "forceful-hand", "grasping-hand", "interposing-hand"]);
  const hand = spellExec("dnd.srd521.spell.arcane-hand")!.sustain;
  assert.equal(hand && typeof hand === "object" ? hand.economy : undefined, "bonus-action");
  const thoughts = spellExec("dnd.srd521.spell.detect-thoughts")!.sustain;
  assert.equal(thoughts && typeof thoughts === "object" ? thoughts.target : undefined, "new");
});
