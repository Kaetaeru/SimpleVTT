/**
 * V0.9 D328 (SRD_MODULE_PLAN.md §8): the last two rows of the gap table.
 *
 * - 물체 조종 places as many objects as the caster's spellcasting modifier (`summon.count`), each with the stat
 *   block the SRD gives for the size chosen.
 * - 수호 문양 and 상징 are inscribed with the rune or effect chosen at the cast and wait; the ↻ button sets them
 *   off on whoever tripped them, with the save and dice that choice names.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spellExec, variantsOf, withVariant } from "../../client/compendium/spells";
import { summonMonster } from "../../client/compendium/summonTemplate";

test("D328: 물체 조종 places as many objects as the caster's modifier", () => {
  const summon = spellExec("dnd.srd521.spell.animate-objects")!.summon!;
  assert.equal(summon.count, "mod");
  assert.deepEqual(summon.forms.map((form) => form.name), ["중형 이하", "대형", "거대형"]);
  const large = summonMonster(summon.forms[1], { level: 5, attack: 9, dc: 17, mod: 5 });
  assert.ok(!("error" in large), "error" in large ? large.error : "");
  if ("error" in large) return;
  assert.equal(large.monster.ac, 15);
  assert.equal(large.monster.hp, 20);
  // The slam uses the caster's spell attack bonus, and a Large object adds their modifier to its damage.
  const slam = large.monster.actions[0];
  assert.equal(slam.attack?.bonus, 9);
  assert.deepEqual(slam.attack?.damage.map((part) => [part.dice, part.flat, part.type]), [["2d6", 8, "force"]]);
});

test("D328: 수호 문양 waits with the rune it was inscribed with, and goes off as a save", () => {
  assert.deepEqual(variantsOf("dnd.srd521.spell.glyph-of-warding").map((variant) => variant.id), ["acid", "cold", "fire", "lightning", "thunder", "spell-glyph"]);
  const cold = withVariant(spellExec("dnd.srd521.spell.glyph-of-warding")!, "cold").exec;
  const goes = cold.sustain && typeof cold.sustain === "object" ? cold.sustain : undefined;
  assert.equal(goes?.economy, "none", "setting it off costs nothing — the glyph was paid for when it was inscribed");
  assert.equal(goes?.primary?.kind, "save-damage");
  assert.equal(goes?.primary && "damageType" in goes.primary ? goes.primary.damageType : undefined, "cold");
  assert.equal(goes?.primary && "dice" in goes.primary ? goes.primary.dice.count : undefined, 5);
});

test("D328: 상징 carries its six effects, each with its own save", () => {
  assert.deepEqual(variantsOf("dnd.srd521.spell.symbol").map((variant) => variant.id), ["death", "discord", "fear", "pain", "sleep", "stunning"]);
  const death = withVariant(spellExec("dnd.srd521.spell.symbol")!, "death").exec;
  const deathGoes = death.sustain && typeof death.sustain === "object" ? death.sustain.primary : undefined;
  const deathDice = deathGoes && "dice" in deathGoes ? (deathGoes.dice as { count: number; sides: number }) : undefined;
  assert.equal(deathDice ? `${deathDice.count}d${deathDice.sides}` : undefined, "10d10");
  const fear = withVariant(spellExec("dnd.srd521.spell.symbol")!, "fear").exec;
  const fearGoes = fear.sustain && typeof fear.sustain === "object" ? fear.sustain.primary : undefined;
  assert.equal(fearGoes?.kind, "save-effect");
  assert.deepEqual((fear.effects ?? []).map((effect) => effect.conditionId), ["frightened"]);
});
