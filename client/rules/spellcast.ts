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
import { applyDamage, immuneToCondition, noDamage, resolveAttack, type AttackOverrides, type AttackResolution, type Combatant, type DamageOutcome, type DamagePart, type DiceSource } from "./resolve";
import { scrollStats } from "./scrolls";

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

export interface SpellSave { ability: AbilityKey; d20: number; bonus: number; total: number; dc: number; success: boolean; /** R10: the save was rolled with advantage and why (회피 on a DEX save). */ advantage?: string; dropped?: number; /** R12: the failure was turned into a success by Legendary Resistance. */ legendary?: boolean }
export interface SpellEffectStart { key: string; name: string; concentration: boolean; duration: string; rounds?: number; /** R10: the target repeats this save at the end of each of its turns and ends the effect on a success. */ endSave?: { ability: AbilityKey; dc: number } }

/** R10: the SRD text that lets a target repeat the save at the end of each of its turns (hold person, blindness/deafness, sleep breath …). */
export const REPEAT_SAVE = /턴이 끝날 때[^.]{0,40}(내성 굴림을 반복|내성 굴림을 다시|내성을 반복|다시 내성)/;
export const repeatsSaveAtTurnEnd = (exec: SpellExec) => REPEAT_SAVE.test(`${(exec.primary as { summary?: string }).summary ?? ""} ${(exec.trackedEffects ?? []).map((effect) => effect.summary).join(" ")}`);
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
  /** R28 (D152): conditions this row *ends* (회복의 마법 언어, and standing back up from a revival). */
  clears?: string[];
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
  /** R9: "action" when an NPC's save action (a breath weapon) was resolved through the spell path. */
  source?: "spell" | "action";
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
  /** R12 (Legendary Resistance): the target's save counts as a success; the area damage dice stay as first rolled. */
  forceSaveSuccess?: boolean;
  fixedDamage?: number[][];
}

/** Resolve the spell against every target. */
export function resolveSpell(input: CastInput): SpellResolution {
  const { spec, caster, casterStats, dice } = input;
  const exec = spec.exec;
  const primary = exec.primary;
  const endSave = repeatsSaveAtTurnEnd(exec) && "saveAbility" in primary ? { ability: ((primary as { saveAbility: string }).saveAbility in ABILITY_KO ? (primary as { saveAbility: string }).saveAbility : "wis") as AbilityKey, dc: casterStats.saveDc } : undefined;
  const effectStart = (duration?: SpellDuration): SpellEffectStart => ({ key: `spell:${spec.spellId}`, name: spec.name, concentration: Boolean(exec.concentration), duration: durationText(duration), rounds: roundsOf(duration), ...(endSave ? { endSave } : {}) });
  const base = (target: Combatant): SpellTargetResult => ({ target: { id: target.id, name: target.name, kind: target.kind, tokenId: target.tokenId }, mode: "note", hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp, marks: [] });
  // R10: 회피 (Dodge) gives advantage on Dexterity saves.
  const save = (target: Combatant, stats: ActorStats, ability: string): SpellSave => { const key = (ability in ABILITY_KO ? ability : "dex") as AbilityKey;
    const dodging = key === "dex" && (target.conditions.includes("회피") || target.effects.includes("회피"));
    // R31 (D161): 마법 저항 — advantage on this save when what forced it is a spell, not a stat-block action.
    const resistant = Boolean(target.magicResistance) && input.spec.exec.spellId.slice(0, 4) !== "npc:";
    const advantaged = dodging || resistant;
    const first = dice.d(20); const second = advantaged ? dice.d(20) : undefined; const d20 = second !== undefined ? Math.max(first, second) : first; const bonus = (stats.saves[key] ?? 0) - 2 * Math.max(0, target.exhaustion ?? 0); const total = d20 + bonus; return { ability: key, d20, bonus, total, dc: casterStats.saveDc, success: input.forceSaveSuccess ? true : total >= casterStats.saveDc, ...(input.forceSaveSuccess && total < casterStats.saveDc ? { legendary: true } : {}), ...(second !== undefined ? { advantage: dodging ? "회피" : "마법 저항", dropped: Math.min(first, second) } : {}) }; };
  // R28 (D150): a condition the target is immune to never lands, whoever asked for it.
  const conditionMarks = (trigger: "failed-save" | "hit" | "always", target?: Combatant) => (exec.effects ?? [])
    .filter((effect) => effect.trigger === trigger || effect.trigger === "always")
    .map((effect) => CONDITION_KO[effect.conditionId] ?? effect.conditionId)
    .filter((condition) => !target || !immuneToCondition(target.defenses, condition));
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
        const attack = resolveAttack(caster, combatant, { name: spec.name, source: "spell", attackBonus: casterStats.attackBonus, mode: (exec.targeting.rangeFeet ?? 0) > 5 ? "ranged" : "melee", damage: [{ formula, type: primary.damageType, label: spec.name }], inflicts: conditionMarks("hit", combatant) }, { dice, overrides: input.overrides, apply: input.apply });
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
      const rolled = input.fixedDamage ?? parts.map((part) => { const match = /^(\d+)d(\d+)/.exec(part.formula)!; return Array.from({ length: Number(match[1]) }, () => dice.d(Number(match[2]))); });
      for (const { combatant, stats } of all) {
        const row = base(combatant);
        row.mode = "save";
        row.save = save(combatant, stats, primary.saveAbility);
        if (row.save.success && primary.successDamage === "none") afterDamage(row, noDamage(combatant));
        else afterDamage(row, applyDamage(combatant, parts, dice, { fixed: rolled, half: row.save.success }));
        if (!row.save.success) { row.marks = conditionMarks("failed-save", combatant); if (exec.effects?.length || exec.trackedEffects?.some((effect) => effect.trigger === "failed-save")) row.effect = effectStart(exec.effects?.[0]?.duration ?? exec.trackedEffects?.find((effect) => effect.trigger === "failed-save")?.duration); }
        targets.push(row);
      }
      break;
    }
    case "save-effect": {
      for (const { combatant, stats } of all) {
        const row = base(combatant);
        row.mode = "save";
        row.save = save(combatant, stats, primary.saveAbility);
        if (!row.save.success) { row.marks = conditionMarks("failed-save", combatant); row.effect = effectStart(exec.effects?.[0]?.duration ?? primary.duration); }
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
        row.marks = conditionMarks("always", combatant);
        row.note = exec.trackedEffects?.map((effect) => effect.summary).join(" · ") ?? primary.summary;
        targets.push(row);
      }
      break;
    }
    /**
     * R28 (D152): the last nine spells that fell through to "DM이 효과를 적용합니다" even though the compendium
     * describes them precisely — 원조, 마법 무효화, 회복의 마법 언어, 죽음의 마법 언어 and the five revivals.
     */
    case "maximum-hp": {
      // 원조: the target's HP maximum and current HP both rise. The card applies the current-HP half; the new
      // maximum is the table's to keep, because it lasts eight hours and the sheet derives its own maximum.
      const amount = (primary.amount as number ?? 5) + (primary.amountPerSlotAboveBase as number ?? 0) * Math.max(0, spec.level - (exec.baseLevel ?? spec.level));
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        row.healed = amount;
        row.hpAfter = combatant.hp.current + amount;
        row.note = `최대 HP와 현재 HP가 ${amount} 늘어납니다 (8시간)`;
        targets.push(row);
      }
      break;
    }
    case "full-healing": {
      // 회복의 마법 언어: to full, and the conditions the spell names end.
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        row.healed = Math.max(0, combatant.hp.max - combatant.hp.current);
        row.hpAfter = combatant.hp.max;
        row.clears = ["매혹", "공포", "마비", "충격", "무의식", "넘어짐"];
        row.note = "HP 전부 회복 · 매혹·공포·마비·충격 종료, 넘어짐에서 일어남";
        targets.push(row);
      }
      break;
    }
    case "power-word-kill": {
      // 죽음의 마법 언어: 100 HP or fewer and the creature dies outright; otherwise the SRD's fallback damage.
      for (const { combatant } of all) {
        const row = base(combatant);
        if (combatant.hp.current <= 100) {
          row.mode = "effect";
          row.hpAfter = 0;
          row.marks = combatant.kind === "npc" ? ["사망"] : ["무의식", "넘어짐"];
          row.note = `HP ${combatant.hp.current} ≤ 100 — 즉사`;
        } else {
          const fallback = primary.fallbackDamage as { count: number; sides: number } | undefined;
          row.mode = "save";
          const outcome = applyDamage(combatant, [{ formula: `${fallback?.count ?? 12}d${fallback?.sides ?? 12}`, type: "psychic", label: spec.name }], dice, { apply: input.apply } as never);
          afterDamage(row, outcome);
          row.note = `HP ${combatant.hp.current} > 100 — 피해만`;
        }
        targets.push(row);
      }
      break;
    }
    case "revive": {
      // 소생·죽은 자 되살리기·환생·부활·완전 부활: back on their feet, death saves cleared.
      const full = primary.hp === "full";
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        const target = full ? combatant.hp.max : Math.max(1, combatant.hp.current);
        row.healed = Math.max(0, target - combatant.hp.current);
        row.hpAfter = target;
        row.clears = ["사망", "무의식"];
        row.note = `되살아납니다 (HP ${target}${full ? " — 전부" : ""}) · 죽음 내성 초기화`;
        targets.push(row);
      }
      break;
    }
    case "dispel": {
      // 마법 무효화 stays the table's call, but the card now says what is actually running on the target.
      for (const { combatant } of all) {
        const row = base(combatant);
        row.note = combatant.effects.length ? `걸려 있는 것: ${combatant.effects.join(", ")} — 끝낼 것을 DM이 고릅니다` : "걸려 있는 마법이 없습니다";
        targets.push(row);
      }
      note = `${spec.name}: 3레벨 이하는 자동, 그보다 높으면 시전 능력 판정 DC 10 + 주문 레벨`;
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
/** R11: the cheapest way to cast a leveled spell right now (lowest slot that fits, else the pact slot), or null. */
export function cheapestCast(derived: DerivedCharacter, runtime: CharacterRuntime, level: number): CastMethod | null {
  if (level === 0) return { kind: "cantrip" };
  for (const [slot, count] of Object.entries(derived.spellSlots).map(([key, value]) => [Number(key), value] as const).sort((a, b) => a[0] - b[0])) {
    if (slot >= level && count - (runtime.slotsUsed[slot] ?? 0) > 0) return { kind: "slot", level: slot };
  }
  if (derived.pactMagic && derived.pactMagic.level >= level && derived.pactMagic.count - (runtime.pactSlotsUsed ?? 0) > 0) return { kind: "pact" };
  return null;
}

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
  // R19: a scroll carries the spell, so someone with no spellcasting of their own may still read it.
  const fromScroll = method?.kind === "scroll";
  if (!list && !fromScroll) return null;
  const chosen: CastMethod = method ?? (view.level === 0 ? { kind: "cantrip" } : { kind: "slot", level: view.level });
  const level = chosen.kind === "slot" ? chosen.level : chosen.kind === "pact" ? derived.pactMagic?.level ?? view.level : view.level;
  return {
    spec: { spellId, name: view.name, level, exec },
    casterStats: list ? { attackBonus: list.attackBonus, saveDc: list.saveDc, modifier: derived.abilities[list.ability].modifier, level: derived.level } : { ...scrollStats(view.level), modifier: 0, level: derived.level },
    spend: (runtime) => castSpell(runtime, derived, { id: view.id, name: view.name, level: view.level, duration: view.duration, ritual: view.ritual }, chosen),
  };
}
