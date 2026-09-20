/**
 * V0.9 D322 (SRD_MODULE_PLAN.md §8): numbers that are shared out or that grow.
 *
 * - 대량 치유 holds one pool of 700 hit points instead of a roll each: it goes to the most hurt first, nobody takes
 *   more than they are missing, and what is left over is said out loud.
 * - 영웅 연회 rolls 2d10 once and raises every diner's maximum and current hit points by it.
 * - 지연 폭발 화염구's bead grows by a die for every round it waited, on top of its slot's dice.
 * - 얼음 칼's shard bursts on a Dexterity save whether the attack hit or missed, and 금속 가열 asks its own save
 *   after damage that has none (`secondary`).
 * - 권능어: 충격 only stuns a target at 150 hit points or fewer, and says what happens above that.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { spellExec } from "../../client/compendium/spells";
import type { ActorStats } from "../../client/rules/actions";
import type { Combatant } from "../../client/rules/resolve";
import { resolveSpell, type CasterStats } from "../../client/rules/spellcast";

const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const stats: ActorStats = { abilities: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, saves: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, skills: {}, proficiencyBonus: 2 };
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [], ...over });
const caster = combatant({ id: "c", name: "시전자", kind: "pc" });
const casterStats: CasterStats = { attackBonus: 5, saveDc: 13, modifier: 3, level: 9 };
const spec = (id: string, level: number, name = id) => ({ spellId: `dnd.srd521.spell.${id}`, name, level, exec: spellExec(`dnd.srd521.spell.${id}`)! });

test("D322: 대량 치유's 700 goes to the most hurt first, and nobody past their maximum", () => {
  const hurt = combatant({ id: "a", name: "다친 쪽", hp: { current: 4, max: 60, temp: 0 } });
  const scratched = combatant({ id: "b", name: "긁힌 쪽", hp: { current: 38, max: 40, temp: 0 } });
  const result = resolveSpell({ caster, casterStats, spec: spec("mass-heal", 9, "대량 치유"), targets: [{ combatant: hurt, stats }, { combatant: scratched, stats }], dice: scripted() });
  assert.deepEqual(result.targets.map((row) => [row.target.name, row.healed, row.hpAfter]), [["다친 쪽", 56, 60], ["긁힌 쪽", 2, 40]]);
  assert.match(result.targets[0].note ?? "", /700/);
  assert.match(result.targets[1].note ?? "", /남음/, "what nobody could take is said");
});

test("D322: 영웅 연회 rolls its 2d10 once and raises everyone by it", () => {
  const a = combatant({ id: "a", name: "가", hp: { current: 30, max: 40, temp: 0 } });
  const b = combatant({ id: "b", name: "나", hp: { current: 10, max: 40, temp: 0 } });
  const result = resolveSpell({ caster, casterStats, spec: spec("heroes-feast", 6, "영웅 연회"), targets: [{ combatant: a, stats }, { combatant: b, stats }], dice: scripted(7, 4) });
  assert.deepEqual(result.targets.map((row) => [row.healed, row.hpAfter]), [[11, 41], [11, 21]]);
  assert.match(result.targets[0].note ?? "", /2d10/);
});

test("D322: the bead of 지연 폭발 화염구 grows a die for every round it waited", () => {
  const exec = spellExec("dnd.srd521.spell.delayed-blast-fireball")!;
  const sustain = exec.sustain && typeof exec.sustain === "object" ? exec.sustain : undefined;
  const bead = { ...exec, primary: sustain?.primary ?? exec.primary };
  const target = combatant({ hp: { current: 90, max: 90, temp: 0 } });
  const fresh = resolveSpell({ caster, casterStats, spec: { spellId: exec.spellId, name: "지연 폭발 화염구", level: 7, exec: bead }, targets: [{ combatant: target, stats }], dice: scripted(...Array(20).fill(1)) });
  const waited = resolveSpell({ caster, casterStats: { ...casterStats, roundsElapsed: 3 }, spec: { spellId: exec.spellId, name: "지연 폭발 화염구", level: 7, exec: bead }, targets: [{ combatant: target, stats }], dice: scripted(...Array(20).fill(1)) });
  assert.equal(fresh.targets[0].damage?.damage[0].dice.length, 12, "12d6 at its own level");
  assert.equal(waited.targets[0].damage?.damage[0].dice.length, 15, "and one die per round of waiting");
});

test("D322: 얼음 칼's shard bursts whether the attack hit or missed", () => {
  // The attack misses (d20 2 + 5 = 7 vs AC 13); the Dexterity save (d20 3 + 2 = 5 vs DC 13) fails: 2d6 cold lands.
  const target = combatant({ hp: { current: 20, max: 20, temp: 0 } });
  const missed = resolveSpell({ caster, casterStats, spec: spec("ice-knife", 1, "얼음 칼"), targets: [{ combatant: target, stats }], dice: scripted(2, 4, 4, 3) });
  assert.equal(missed.targets[0].attack?.outcome, "miss");
  assert.equal(missed.targets[0].damage?.damageTotal, 8, JSON.stringify(missed.targets[0].note));
  assert.match(missed.targets[0].note ?? "", /파편 폭발/);
  // One more d6 per slot above the first.
  const big = resolveSpell({ caster, casterStats, spec: spec("ice-knife", 3, "얼음 칼"), targets: [{ combatant: target, stats }], dice: scripted(2, 1, 1, 1, 1, 3) });
  assert.equal(big.targets[0].damage?.damage[0].dice.length, 4);
});

test("D322: 권능어: 충격 stuns only a target at 150 hit points or fewer", () => {
  const weak = combatant({ id: "w", name: "약한 쪽", hp: { current: 90, max: 200, temp: 0 } });
  const strong = combatant({ id: "s", name: "센 쪽", hp: { current: 180, max: 200, temp: 0 } });
  const result = resolveSpell({ caster, casterStats, spec: spec("power-word-stun", 8, "권능어: 충격"), targets: [{ combatant: weak, stats }, { combatant: strong, stats }], dice: scripted() });
  assert.deepEqual(result.targets[0].marks, ["충격"]);
  assert.deepEqual(result.targets[1].marks, []);
  assert.match(result.targets[1].note ?? "", /이동 속도 0/);
});
