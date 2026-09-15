/**
 * Casting a spell at the table (ROLL20_TABLE_SPEC.md §12.3–12.4, D102): the execution catalog says what the spell
 * does, the caster's stats give the attack bonus and save DC, and every target is resolved on the same pipeline as
 * weapons — spell attacks through `resolveAttack`, saves rolled for the target (both languages of conditions),
 * damage through `applyDamage`, healing and temp HP, magic missile's projectiles, tracked effects such as Bless or
 * Shield. Pure: the host feeds combatants and dice and applies what comes back.
 */
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KO } from "../catalog/types";
import { CONDITION_KO, type SpellDice, type SpellDuration, type SpellExec } from "../compendium/spells";
import type { ActorStats } from "./actions";
import type { ContentCatalog } from "../catalog/catalog";
import { castSpell, type CastMethod } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter } from "../character/types";
import { spellExec } from "../compendium/spells";
import { applyDamage, noDamage, resolveAttack, type AttackOverrides, type AttackResolution, type Combatant, type DamageOutcome, type DamagePart, type DiceSource } from "./resolve";

export interface CasterStats {
  /** Spell attack bonus and save DC of the list the spell comes from. */
  attackBonus: number;
  saveDc: number;
  /** Spellcasting ability modifier (added to healing dice when the spell says so). */
  modifier: number;
  /** Character level (cantrip scaling at 5/11/17); for NPCs the level a stat block implies. */
  level: number;
}

export interface SpellCastSpec {
  spellId: string;
  name: string;
  /** Level it is cast at (slot level; a cantrip is 0). */
  level: number;
  exec: SpellExec;
}

export interface SpellSave { ability: AbilityKey; d20: number; bonus: number; total: number; dc: number; success: boolean }
export interface SpellEffectStart { key: string; name: string; concentration: boolean; duration: string; rounds?: number }
export interface SpellTargetResult {
  target: { id: string; name: string; kind: "pc" | "npc"; tokenId?: string };
  mode: "attack" | "save" | "heal" | "temp" | "projectiles" | "effect" | "note";
  attack?: AttackResolution;
  save?: SpellSave;
  damage?: DamageOutcome;
  healed?: number;
  tempHp?: number;
  projectiles?: number;
  hpBefore: number;
  hpAfter: number;
  tempAfter: number;
  /** Conditions to put on the target (Korean names). */
  marks: string[];
  /** A lasting effect on the target (Bless, Shield, Hold Person's paralysis with its concentration link). */
  effect?: SpellEffectStart;
  note?: string;
}
export interface SpellResolution {
  spellId: string;
  name: string;
  level: number;
  caster: { id: string; name: string; kind: "pc" | "npc" };
  concentration: boolean;
  economy: SpellExec["castingEconomy"];
  targets: SpellTargetResult[];
  note?: string;
  applied: boolean;
}

const cantripDice = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);
const scaledCount = (dice: SpellDice, castLevel: number, exec: SpellExec, caster: CasterStats) => dice.cantripScaling ? dice.count * cantripDice(caster.level) : dice.count + Math.max(0, castLevel - exec.baseLevel) * (dice.dicePerSlotAboveBase ?? 0);
const scaledFlat = (dice: SpellDice, castLevel: number, exec: SpellExec, caster: CasterStats) => (dice.flat ?? 0) + Math.max(0, castLevel - exec.baseLevel) * (dice.flatPerSlotAboveBase ?? 0) + (dice.addSpellcastingModifier ? caster.modifier : 0);
const formulaOf = (dice: SpellDice, castLevel: number, exec: SpellExec, caster: CasterStats) => { const flat = scaledFlat(dice, castLevel, exec, caster); return `${scaledCount(dice, castLevel, exec, caster)}d${dice.sides}${flat ? `${flat > 0 ? "+" : "-"}${Math.abs(flat)}` : ""}`; };
const rollFormula = (formula: string, dice: DiceSource) => { const match = /^(\d+)d(\d+)([+-]\d+)?$/.exec(formula)!; let total = Number(match[3] ?? 0); for (let n = 0; n < Number(match[1]); n += 1) total += dice.d(Number(match[2])); return Math.max(0, total); };

export const durationText = (duration?: SpellDuration) => !duration ? "즉시" : duration.kind === "concentration" ? "집중 (최대 1분)" : duration.kind === "rounds" ? `${duration.amount ?? 1}라운드` : duration.kind === "minutes" ? `${duration.amount ?? 1}분` : duration.kind === "hours" ? `${duration.amount ?? 1}시간` : duration.kind === "permanent" ? "영구" : duration.kind === "instant" ? "즉시" : "특수";
const roundsOf = (duration?: SpellDuration) => (duration?.kind === "rounds" ? duration.amount ?? 1 : duration?.kind === "concentration" ? 10 : duration?.kind === "minutes" ? (duration.amount ?? 1) * 10 : undefined);

export interface CastInput {
  caster: Combatant;
  casterStats: CasterStats;
  spec: SpellCastSpec;
  /** Targets with the stats the resolver needs for their saves. */
  targets: Array<{ combatant: Combatant; stats: ActorStats }>;
  dice: DiceSource;
  /** The DM's pre-roll choices for spell attacks (유리/불리·엄폐·반드시). */
  overrides?: AttackOverrides;
  apply?: boolean;
}

/** Resolve the spell against every target. */
export function resolveSpell(input: CastInput): SpellResolution {
  const { spec, caster, casterStats, dice } = input;
  const exec = spec.exec;
  const primary = exec.primary;
  const effectStart = (duration?: SpellDuration): SpellEffectStart => ({ key: `spell:${spec.spellId}`, name: spec.name, concentration: Boolean(exec.concentration), duration: durationText(duration), rounds: roundsOf(duration) });
  const base = (target: Combatant): SpellTargetResult => ({ target: { id: target.id, name: target.name, kind: target.kind, tokenId: target.tokenId }, mode: "note", hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp, marks: [] });
  const save = (target: Combatant, stats: ActorStats, ability: string): SpellSave => { const key = (ability in ABILITY_KO ? ability : "dex") as AbilityKey; const d20 = dice.d(20); const bonus = stats.saves[key] ?? 0; const total = d20 + bonus; return { ability: key, d20, bonus, total, dc: casterStats.saveDc, success: total >= casterStats.saveDc }; };
  const conditionMarks = (trigger: "failed-save" | "hit" | "always") => (exec.effects ?? []).filter((effect) => effect.trigger === trigger || effect.trigger === "always").map((effect) => CONDITION_KO[effect.conditionId] ?? effect.conditionId);
  const afterDamage = (row: SpellTargetResult, outcome: DamageOutcome) => { row.damage = outcome; row.hpAfter = outcome.hpAfter; row.tempAfter = outcome.tempAfter; };
  const targets: SpellTargetResult[] = [];
  let note: string | undefined;
  const all = input.targets;
  switch (primary.kind) {
    case "attack-damage": {
      const formula = formulaOf(primary.dice, spec.level, exec, casterStats);
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "attack";
        const attack = resolveAttack(caster, combatant, { name: spec.name, source: "spell", attackBonus: casterStats.attackBonus, mode: (exec.targeting.rangeFeet ?? 0) > 5 ? "ranged" : "melee", damage: [{ formula, type: primary.damageType, label: spec.name }], inflicts: conditionMarks("hit") }, { dice, overrides: input.overrides, apply: input.apply });
        row.attack = attack; row.hpAfter = attack.hpAfter; row.tempAfter = attack.tempAfter; row.marks = attack.inflicted;
        if ((attack.outcome === "hit" || attack.outcome === "crit") && exec.trackedEffects?.some((effect) => effect.trigger === "hit")) row.effect = effectStart(exec.trackedEffects.find((effect) => effect.trigger === "hit")!.duration);
        targets.push(row);
      }
      break;
    }
    case "multi-attack-damage": {
      const count = primary.cantripAttackScaling ? primary.baseAttacks * cantripDice(casterStats.level) : primary.baseAttacks + Math.max(0, spec.level - exec.baseLevel) * (primary.attacksPerSlotAboveBase ?? 0);
      // Rays go round-robin over the chosen targets; each is its own attack roll.
      const rows = new Map<string, SpellTargetResult>();
      for (let n = 0; n < count; n += 1) {
        const { combatant } = all[n % all.length];
        const row = rows.get(combatant.id) ?? base(combatant);
        row.mode = "attack";
        const live = { ...combatant, hp: { ...combatant.hp, current: row.hpAfter, temp: row.tempAfter } };
        const attack = resolveAttack(caster, live, { name: `${spec.name} ${n + 1}`, source: "spell", attackBonus: casterStats.attackBonus, mode: "ranged", damage: [{ formula: `${primary.dicePerAttack.count}d${primary.dicePerAttack.sides}`, type: primary.damageType, label: spec.name }] }, { dice, overrides: input.overrides, apply: input.apply });
        row.attack = row.attack ? { ...attack, damageTotal: row.attack.damageTotal + attack.damageTotal, d20s: [...row.attack.d20s, ...attack.d20s], damage: [...row.attack.damage, ...attack.damage], outcome: attack.outcome === "hit" || attack.outcome === "crit" ? attack.outcome : row.attack.outcome, hpBefore: row.hpBefore } : attack;
        row.hpAfter = attack.hpAfter; row.tempAfter = attack.tempAfter;
        rows.set(combatant.id, row);
      }
      targets.push(...rows.values());
      break;
    }
    case "save-damage": case "save-compound-damage": {
      const parts: DamagePart[] = primary.kind === "save-damage" ? [{ formula: formulaOf(primary.dice, spec.level, exec, casterStats), type: primary.damageType, label: spec.name }] : primary.components.map((component) => ({ formula: formulaOf(component.dice, spec.level, exec, casterStats), type: component.damageType, label: spec.name }));
      // One damage roll for the whole area: the same dice hit everyone (5e), halved for those who save.
      const rolled = parts.map((part) => { const match = /^(\d+)d(\d+)/.exec(part.formula)!; return Array.from({ length: Number(match[1]) }, () => dice.d(Number(match[2]))); });
      for (const { combatant, stats } of all) {
        const row = base(combatant);
        row.mode = "save";
        row.save = save(combatant, stats, primary.saveAbility);
        if (row.save.success && primary.successDamage === "none") afterDamage(row, noDamage(combatant));
        else afterDamage(row, applyDamage(combatant, parts, dice, { fixed: rolled, half: row.save.success }));
        if (!row.save.success) { row.marks = conditionMarks("failed-save"); if (exec.effects?.length || exec.trackedEffects?.some((effect) => effect.trigger === "failed-save")) row.effect = effectStart(exec.effects?.[0]?.duration ?? exec.trackedEffects?.find((effect) => effect.trigger === "failed-save")?.duration); }
        targets.push(row);
      }
      break;
    }
    case "save-effect": {
      for (const { combatant, stats } of all) {
        const row = base(combatant);
        row.mode = "save";
        row.save = save(combatant, stats, primary.saveAbility);
        if (!row.save.success) { row.marks = conditionMarks("failed-save"); row.effect = effectStart(exec.effects?.[0]?.duration ?? primary.duration); }
        row.note = primary.summary;
        targets.push(row);
      }
      break;
    }
    case "healing": {
      const formula = formulaOf(primary.dice, spec.level, exec, casterStats);
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        const amount = rollFormula(formula, dice);
        row.healed = Math.min(amount, Math.max(0, combatant.hp.max - combatant.hp.current));
        row.hpAfter = combatant.hp.current + row.healed;
        row.note = `${formula} = ${amount}`;
        targets.push(row);
      }
      break;
    }
    case "temporary-hp": {
      const formula = formulaOf(primary.dice, spec.level, exec, casterStats);
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "temp";
        const amount = rollFormula(formula, dice);
        row.tempHp = Math.max(combatant.hp.temp, amount);
        row.tempAfter = row.tempHp;
        row.note = `${formula} = ${amount}`;
        targets.push(row);
      }
      break;
    }
    case "automatic-projectiles": {
      const count = primary.baseProjectiles + Math.max(0, spec.level - exec.baseLevel) * (primary.projectilesPerSlotAboveBase ?? 0);
      // Darts go round-robin over the chosen targets and always hit.
      const per = new Map<string, number>();
      for (let n = 0; n < count; n += 1) { const id = all[n % all.length].combatant.id; per.set(id, (per.get(id) ?? 0) + 1); }
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "projectiles";
        row.projectiles = per.get(combatant.id) ?? 0;
        const parts: DamagePart[] = Array.from({ length: row.projectiles }, (_, index) => ({ formula: `1d${primary.projectileDice.sides}${primary.projectileDice.flat ? `+${primary.projectileDice.flat}` : ""}`, type: primary.damageType, label: `${spec.name} ${index + 1}` }));
        afterDamage(row, row.projectiles ? applyDamage(combatant, parts, dice) : noDamage(combatant));
        targets.push(row);
      }
      break;
    }
    case "tracked-effect": {
      const duration = exec.trackedEffects?.[0]?.duration ?? primary.duration;
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "effect";
        row.effect = effectStart(duration);
        row.marks = conditionMarks("always");
        row.note = exec.trackedEffects?.map((effect) => effect.summary).join(" · ") ?? primary.summary;
        targets.push(row);
      }
      break;
    }
    default: {
      note = `${spec.name}: ${(primary as { summary?: string }).summary ?? "DM이 효과를 적용합니다"}`;
      for (const { combatant } of all) targets.push(base(combatant));
    }
  }
  return { spellId: spec.spellId, name: spec.name, level: spec.level, caster: { id: caster.id, name: caster.name, kind: caster.kind }, concentration: Boolean(exec.concentration), economy: exec.castingEconomy, targets, note, applied: input.apply ?? true };
}

/** One line for the chat archive. */
export function describeSpell(result: SpellResolution) {
  const rows = result.targets.map((row) => {
    if (row.attack) return `${row.target.name} ${row.attack.outcome === "crit" ? "치명타" : row.attack.outcome === "hit" ? "적중" : "빗나감"}${row.attack.damageTotal ? ` 피해 ${row.attack.damageTotal}` : ""}`;
    if (row.save) return `${row.target.name} ${ABILITY_KO[row.save.ability]} 내성 ${row.save.total} vs ${row.save.dc} ${row.save.success ? "성공" : "실패"}${row.damage?.damageTotal ? ` 피해 ${row.damage.damageTotal}` : ""}${row.marks.length ? ` (${row.marks.join(", ")})` : ""}`;
    if (row.healed !== undefined) return `${row.target.name} 회복 ${row.healed}`;
    if (row.tempHp !== undefined) return `${row.target.name} 임시 HP ${row.tempHp}`;
    if (row.projectiles !== undefined) return `${row.target.name} 화살 ${row.projectiles} 피해 ${row.damage?.damageTotal ?? 0}`;
    if (row.effect) return `${row.target.name} ${row.effect.name} (${row.effect.duration})`;
    return row.target.name;
  });
  return `${result.caster.name}: ${result.name}${result.level ? ` (${result.level}레벨)` : ""} → ${rows.join(" · ") || "대상 없음"}${result.note ? ` — ${result.note}` : ""}`;
}

/** Spell ids a character can cast right now (cantrips, prepared and always-prepared spells that the catalog can execute). */
export function castableSpells(derived: DerivedCharacter) {
  const ids = new Set<string>();
  for (const list of derived.spellcasting) for (const id of [...list.cantrips, ...list.prepared, ...list.alwaysPrepared]) ids.add(id);
  return [...ids].filter((id) => spellExec(id));
}

/** A PC's spell: the spec at the chosen level, the list's attack bonus and DC, and how the cost is paid (null: cannot). */
export function pcSpell(entry: { runtime: CharacterRuntime }, derived: DerivedCharacter, catalog: ContentCatalog, spellId: string, method?: CastMethod): { spec: SpellCastSpec; casterStats: CasterStats; spend: (runtime: CharacterRuntime) => CharacterRuntime | null } | null {
  const exec = spellExec(spellId);
  const view = catalog.spellById(spellId);
  if (!exec || !view) return null;
  const list = derived.spellcasting.find((item) => item.cantrips.includes(spellId) || item.prepared.includes(spellId) || item.alwaysPrepared.includes(spellId)) ?? derived.spellcasting[0];
  if (!list) return null;
  const chosen: CastMethod = method ?? (view.level === 0 ? { kind: "cantrip" } : { kind: "slot", level: view.level });
  const level = chosen.kind === "slot" ? chosen.level : chosen.kind === "pact" ? derived.pactMagic?.level ?? view.level : view.level;
  return {
    spec: { spellId, name: view.name, level, exec },
    casterStats: { attackBonus: list.attackBonus, saveDc: list.saveDc, modifier: derived.abilities[list.ability].modifier, level: derived.level },
    spend: (runtime) => castSpell(runtime, derived, { id: view.id, name: view.name, level: view.level, duration: view.duration, ritual: view.ritual }, chosen),
  };
}
