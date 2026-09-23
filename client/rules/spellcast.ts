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
import { advantageFor, CANNOT_ACT, type ActorStats } from "./actions";
import type { ContentCatalog } from "../catalog/catalog";
import { castSpell, type CastMethod } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { DerivedCharacter } from "../character/types";
import { creaturesOf, repeatSaveOf, spellExec, sustainedExec, sustainOf, weaponSpellOf } from "../compendium/spells";
import { applyDamage, immuneToCondition, noDamage, resolveAttack, rollFormula as rollSigned, type AttackOverrides, type AttackResolution, type Combatant, type DamageOutcome, type DamagePart, type DiceSource } from "./resolve";
import { scrollStats } from "./scrolls";
import { effectRuleKey } from "./effects";
import { contractEffect } from "./contractEffects";
import { characterScope } from "./contract";

const FLAVOUR_KEYS = new Set(["summary", "trigger", "duration"]);
/**
 * R101 (D236): whether a spell does anything the rules compute — a tracked part with a number or a state (not only its
 * sentence), conditions, a summon, a repeat, an on-hit rule, or an effect contract that changes the sheet. What is left
 * is the narrative half of the spell list (마법사의 손, 경보, 전언 …), and its card says "DM 판정" instead of looking done.
 */
/** H3d (D242): the damage types a spell deals, from its primary effect. */
const spellDamageTypes = (exec: SpellExec): string[] => (exec.primary.kind === "save-compound-damage" ? exec.primary.components.map((part) => part.damageType) : "damageType" in exec.primary && typeof exec.primary.damageType === "string" ? [exec.primary.damageType] : []);

export function spellIsJudged(exec: SpellExec, catalog: ContentCatalog, derived: DerivedCharacter): boolean {
  if (exec.primary.kind !== "tracked-effect") return false;
  // V4g (D269): what an index says about the spell counts too (a sustain, placed creatures, a weapon spell).
  if (exec.effects?.length || exec.summon || exec.onHit || sustainOf(exec) || creaturesOf(exec.spellId) || weaponSpellOf(exec.spellId) || exec.removesConditions?.length) return false;
  if ((exec.trackedEffects ?? []).some((part) => Object.keys(part).some((key) => !FLAVOUR_KEYS.has(key)))) return false;
  const contract = catalog.contractFor(effectRuleKey({ key: `spell:${exec.spellId}`, name: "", source: "spell", duration: "", concentration: false, elapsed: 0, startedAt: "" }, catalog));
  if (!contract) return true;
  const { application } = contractEffect(contract, characterScope(derived));
  return !Object.entries(application).some(([field, value]) => field !== "notes" && value !== undefined);
}

export interface CasterStats {
  /** Spell attack bonus and save DC of the list the spell comes from. */
  attackBonus: number;
  saveDc: number;
  /** Spellcasting ability modifier (added to healing dice when the spell says so). */
  modifier: number;
  /** Character level (cantrip scaling at 5/11/17); for NPCs the level a stat block implies. */
  level: number;
  /** R51 (D186): damage types this caster's own spells are never resisted for (원소 숙련자). */
  ignoresResistance?: string[];
  /** R55 (D190): this caster's spell attack rolls ignore half and three-quarters cover (주문 저격수). */
  ignoresCover?: boolean;
  /** R93 (D228): this spell adds the spellcasting modifier to its damage (고통스러운 폭발). */
  damageModifier?: boolean;
  /** R96 (D231): healing from a slot adds 2 + the slot level (생명의 제자); healing dice count as their maximum (최상급 치유). */
  healingSlotBonus?: boolean;
  healingMaximized?: boolean;
  /** V3g (D261): this spell's damage dice count as their maximum (과부하). */
  damageMaximized?: boolean;
  /** D324: this cast's temporary hit points count as their maximum (악마적 활력의 무료 거짓 생명). */
  tempHpMaximized?: boolean;
  /** D331: what the caster's own Hit Point Dice rolled for this cast (비전 활력) — the host spends them. */
  hitDiceRolled?: { total: number; note: string };
  /** R98 (D233): a damage cantrip deals half on a miss or a successful save (강력한 소마법). */
  potentCantrip?: boolean;
  /** R98 (D233): added once to the spell damage (강화된 방출). */
  damageBonusOnce?: number;
  /** D322: how many rounds a waiting spell has been waiting (지연 폭발 화염구's extra die per round). */
  roundsElapsed?: number;
}

export interface SpellCastSpec {
  spellId: string;
  name: string;
  /** Level it is cast at (slot level; a cantrip is 0). */
  level: number;
  exec: SpellExec;
  /** V4f (D268): the variant chosen when casting; the effect it starts remembers it. */
  variant?: string;
  /** R101 (D236): nothing in the rules computes this spell effect — the card says the table judges it. */
  judged?: boolean;
}

export interface SpellSave { ability: AbilityKey; d20: number; bonus: number; total: number; dc: number; success: boolean; /** R10: the save was rolled with advantage and why (회피 on a DEX save). */ advantage?: string; /** R90 (D225): rolled with disadvantage, and why. */ disadvantage?: string; /** R90 (D225): spell dice in the bonus ("액운 −2"). */ dice?: string; dropped?: number; /** R12: the failure was turned into a success by Legendary Resistance. */ legendary?: boolean; /** R35 (D174): a contract was paid to redo this save, and what paid for it. */ rescue?: string }
export interface SpellEffectStart { key: string; name: string; concentration: boolean; duration: string; rounds?: number; /** V4s (D281): the effect ends when its bearer attacks or casts (투명화). */ consumeOn?: "attack" | "cast" | "attack-or-cast"; /** R85 (D220): whose turn boundary counts the rounds. */ anchor?: { who: "source" | "bearer"; boundary: "start" | "end" }; /** R10: the target repeats this save at the end of each of its turns and ends the effect on a success. */ endSave?: { ability: AbilityKey; dc: number }; /** V4f (D268): the variant it was cast with. */ variant?: string;
  /** D321: the cast's own numbers, kept on the effect so what it does later is the caster's, not the bearer's. */ cast?: { level: number; saveDc: number; modifier: number };
  /** D321: conditions the bearer takes when the effect ends, for this long (가속). */ endConditions?: string[]; endDuration?: string }

/** R10: a target repeats the save at the end of each of its turns. H6c (D250): read from the spell's data, not its summary text. */
export const repeatsSaveAtTurnEnd = (exec: SpellExec) => repeatSaveOf(exec) === "turn-end";
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
  /** V4u (D283): hit points the caster gains from the damage this spell dealt (흡혈의 손길). */
  casterHealing?: number;
  applied: boolean;
}

const cantripDice = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);
// D322: a spell that waits grows by a die for every round it waited (지연 폭발 화염구); the host counts the rounds.
const scaledCount = (dice: SpellDice, castLevel: number, exec: SpellExec, caster: CasterStats) => (dice.cantripScaling ? dice.count * cantripDice(caster.level) : dice.count + Math.max(0, castLevel - exec.baseLevel) * (dice.dicePerSlotAboveBase ?? 0)) + (caster.roundsElapsed ?? 0) * (dice.dicePerRoundElapsed ?? 0);
const scaledFlat = (dice: SpellDice, castLevel: number, exec: SpellExec, caster: CasterStats) => (dice.flat ?? 0) + Math.max(0, castLevel - exec.baseLevel) * (dice.flatPerSlotAboveBase ?? 0) + (dice.addSpellcastingModifier || caster.damageModifier ? caster.modifier : 0);
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
  /**
   * R35 (D174): a contract rescued this save after the fact (불굴, 어둠의 존재의 행운). `d20` replaces the die that
   * was rolled and `delta` is added to the total; `label` names what paid for it, so the card says so.
   */
  saveAdjust?: { d20?: number; delta?: number; label?: string };
  /** V4r (D280): the targets roll this spell's save at disadvantage, with the reason (고조된 주문). */
  saveDisadvantage?: string;
  fixedDamage?: number[][];
}

/** Resolve the spell against every target. */
export function resolveSpell(input: CastInput): SpellResolution {
  const { spec, caster } = input;
  // D318: a spell whose save has its own DC (이계 접촉: 15) rather than the caster's.
  const fixedDc = (spec.exec.primary as { saveDc?: unknown }).saveDc;
  const casterStats = typeof fixedDc === "number" ? { ...input.casterStats, saveDc: fixedDc } : input.casterStats;
  // V3g (D261): 과부하 — damage dice at their maximum. ponytail: a d20 still rolls, since no SRD damage die is a d20.
  const dice: DiceSource = casterStats.damageMaximized ? { ...input.dice, d: (sides: number) => (sides === 20 ? input.dice.d(20) : sides) } : input.dice;
  const exec = spec.exec;
  const primary = exec.primary;
  const endSave = repeatsSaveAtTurnEnd(exec) && "saveAbility" in primary ? { ability: ((primary as { saveAbility: string }).saveAbility in ABILITY_KO ? (primary as { saveAbility: string }).saveAbility : "wis") as AbilityKey, dc: casterStats.saveDc } : undefined;
  // V4s (D281): a spell whose data says so ends when its bearer next attacks or casts (투명화).
  const endsOnUse = (exec.effects ?? []).some((effect) => effect.termination?.bearerAttacksOrCasts) || undefined;
  // D321: what the spell's own data says its effect leaves on the bearer when it ends (가속: 무력화 for a turn).
  const ending = (exec.trackedEffects ?? []).flatMap((part) => part.endConditions ?? []);
  const endingFor = (exec.trackedEffects ?? []).find((part) => part.endConditions?.length)?.endDuration;
  const effectStart = (duration?: SpellDuration): SpellEffectStart => ({ key: `spell:${spec.spellId}`, name: spec.name, concentration: Boolean(exec.concentration), duration: durationText(duration), rounds: roundsOf(duration), ...(endsOnUse ? { consumeOn: "attack-or-cast" as const } : {}), ...(duration?.anchorActorId ? { anchor: { who: duration.anchorActorId === "$target" ? "bearer" as const : "source" as const, boundary: duration.boundary === "start" ? "start" as const : "end" as const } } : {}), ...(endSave ? { endSave } : {}), ...(spec.variant ? { variant: spec.variant } : {}),
    // D321: the cast's numbers ride along, and what the effect leaves behind when it ends.
    cast: { level: spec.level, saveDc: casterStats.saveDc, modifier: casterStats.modifier },
    ...(ending.length ? { endConditions: ending, ...(endingFor ? { endDuration: endingFor } : {}) } : {}) });
  // R51 (D186): 원소 숙련자 — "your spells ignore resistance to the chosen damage type". Applied where the parts are
  // built, so every shape of spell damage (attack, save, projectiles, components) goes through the same door.
  // R98 (D233): 강화된 방출 — one flat part, added to the first damage roll only.
  const once = (parts: DamagePart[]): DamagePart[] => (casterStats.damageBonusOnce && parts.length ? [...parts, { formula: String(casterStats.damageBonusOnce), type: parts[0].type, label: "강화된 방출", critDoubles: false }] : parts);
  const potent = Boolean(casterStats.potentCantrip) && spec.level === 0;
  const unresisted = (part: DamagePart): DamagePart => ((casterStats.ignoresResistance ?? []).includes(part.type) ? { ...part, ignoresResistance: true } : part);
  const base = (target: Combatant): SpellTargetResult => ({ target: { id: target.id, name: target.name, kind: target.kind, tokenId: target.tokenId }, mode: "note", hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp, marks: [] });
  // R10: 회피 (Dodge) gives advantage on Dexterity saves.
  const save = (target: Combatant, stats: ActorStats, ability: string): SpellSave => { const key = (ability in ABILITY_KO ? ability : "dex") as AbilityKey;
    const dodging = key === "dex" && (target.conditions.includes("회피") || target.effects.includes("회피"));
    // R31 (D161): 마법 저항 — advantage on this save when what forced it is a spell, not a stat-block action.
    const resistant = Boolean(target.magicResistance) && !/^(npc|feature):/.test(input.spec.exec.spellId);
    // R61 (D196): and whatever the target's own contracts said about saving throws (전투 시전자's concentration,
    // 튼튼함's death saves). The reason rides on the row, as 회피 and 마법 저항 already do.
    const declared = advantageFor(stats, "saving-throw", { ability: key, conditions: conditionMarks("failed-save") });
    // R90 (D225): a spell the target is under — 축복·액운's d4, 신속's advantage on Dexterity saves, 저주's disadvantage.
    // D323: an effect whose advantage is only against certain conditions (독으로부터의 보호) counts when this spell
    // is trying to inflict one of them — or to make the bearer keep one.
    const asked = new Set((exec.effects ?? []).map((effect) => effect.conditionId));
    const states = (target.rollStates ?? []).filter((item) => item.on === "save" && (!item.ability || item.ability === key) && (!item.conditions?.length || item.conditions.some((condition) => asked.has(condition))));
    // H1 (D238): bloodied-advantage on saves (피투성이 광분).
    const bloodied = target.bloodied?.rolls.includes("save") && target.hp.current <= Math.floor(target.hp.max / 2) ? target.bloodied.label : undefined;
    const upBy = dodging ? "회피" : resistant ? "마법 저항" : declared ? declared.reason : bloodied ?? states.find((item) => item.state === "advantage")?.label;
    const downBy = states.find((item) => item.state === "disadvantage")?.label ?? input.saveDisadvantage;
    const advantaged = Boolean(upBy) && !downBy;
    const disadvantaged = Boolean(downBy) && !upBy;
    const first = dice.d(20); const second = advantaged || disadvantaged ? dice.d(20) : undefined; const rolled = second === undefined ? first : advantaged ? Math.max(first, second) : Math.min(first, second);
    const extra = (target.d20Dice ?? []).filter((item) => item.on === "save").map((item) => ({ label: item.label, total: rollSigned(item.dice, dice) }));
    // R35 (D174): the rescue replaces the die and adds its own dice before the DC is compared, so a save that was a
    // failure can become a success and the whole row is resolved again from there.
    const d20 = input.saveAdjust?.d20 ?? rolled; const bonus = (stats.saves[key] ?? 0) - 2 * Math.max(0, target.exhaustion ?? 0) + extra.reduce((sum, item) => sum + item.total, 0); const total = Math.max(d20 + bonus + (input.saveAdjust?.delta ?? 0), stats.minimumScore?.[key] ?? 0); return { ability: key, d20, bonus, total, dc: casterStats.saveDc, success: input.forceSaveSuccess ? true : total >= casterStats.saveDc, ...(input.saveAdjust?.label ? { rescue: input.saveAdjust.label } : {}), ...(input.forceSaveSuccess && total < casterStats.saveDc ? { legendary: true } : {}), ...(second !== undefined ? (advantaged ? { advantage: upBy, dropped: Math.min(first, second) } : { disadvantage: downBy, dropped: Math.max(first, second) }) : {}), ...(extra.length ? { dice: extra.map((item) => `${item.label} ${item.total >= 0 ? "+" : ""}${item.total}`).join(", ") } : {}) }; };
  // R28 (D150): a condition the target is immune to never lands, whoever asked for it.
  const conditionMarks = (trigger: "failed-save" | "hit" | "always", target?: Combatant) => (exec.effects ?? [])
    .filter((effect) => effect.trigger === trigger || effect.trigger === "always")
    // D322: a condition that only lands on a target weak enough (권능어: 충격 — 150 hit points or fewer).
    .filter((effect) => !target || effect.requiresHpAtMost === undefined || target.hp.current <= effect.requiresHpAtMost)
    .map((effect) => CONDITION_KO[effect.conditionId] ?? effect.conditionId)
    .filter((condition) => !target || !immuneToCondition(target.defenses, condition));
  /** D322: what the spell says about a target too strong for its condition ("이동 속도 0" instead of 충격). */
  const missedThreshold = (target: Combatant) => (exec.effects ?? [])
    .filter((effect) => effect.requiresHpAtMost !== undefined && target.hp.current > effect.requiresHpAtMost && effect.elseNote)
    .map((effect) => effect.elseNote!);
  const afterDamage = (row: SpellTargetResult, outcome: DamageOutcome) => { row.damage = outcome; row.hpAfter = outcome.hpAfter; row.tempAfter = outcome.tempAfter; if (outcome.trait) row.note = [row.note, outcome.trait].filter(Boolean).join(" · "); };
  const targets: SpellTargetResult[] = [];
  let note: string | undefined;
  const all = input.targets;
  switch (primary.kind) {
    case "attack-damage": {
      const formula = formulaOf(primary.dice, spec.level, exec, casterStats);
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "attack";
        const attack = resolveAttack(caster, combatant, { name: spec.name, source: "spell", attackBonus: casterStats.attackBonus, mode: (exec.targeting.rangeFeet ?? 0) > 5 ? "ranged" : "melee", damage: once([unresisted({ formula, type: primary.damageType, label: spec.name })]), ...(casterStats.ignoresCover ? { ignoresCover: true } : {}), inflicts: conditionMarks("hit", combatant) }, { dice, overrides: input.overrides, apply: input.apply });
        row.attack = attack; row.hpAfter = attack.hpAfter; row.tempAfter = attack.tempAfter; row.marks = attack.inflicted;
        // R98 (D233): 강력한 소마법 — a missed cantrip still deals half its damage (no other effect).
        if (potent && (attack.outcome === "miss" || attack.outcome === "fumble")) {
          const graze = applyDamage(combatant, once([unresisted({ formula, type: primary.damageType, label: `${spec.name} (강력한 소마법)` })]), dice, { half: true });
          row.attack = { ...attack, damage: graze.damage, damageTotal: graze.damageTotal, absorbed: graze.absorbed, hpLost: graze.hpLost, hpAfter: graze.hpAfter, tempAfter: graze.tempAfter, concentration: graze.concentration, downed: graze.downed };
          row.hpAfter = graze.hpAfter; row.tempAfter = graze.tempAfter;
        }
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
        const attack = resolveAttack(caster, live, { name: `${spec.name} ${n + 1}`, source: "spell", attackBonus: casterStats.attackBonus, mode: "ranged", damage: [unresisted({ formula: `${primary.dicePerAttack.count}d${primary.dicePerAttack.sides}${casterStats.damageModifier && casterStats.modifier ? `${casterStats.modifier > 0 ? "+" : "-"}${Math.abs(casterStats.modifier)}` : ""}`, type: primary.damageType, label: spec.name })] }, { dice, overrides: input.overrides, apply: input.apply });
        row.attack = row.attack ? { ...attack, damageTotal: row.attack.damageTotal + attack.damageTotal, d20s: [...row.attack.d20s, ...attack.d20s], damage: [...row.attack.damage, ...attack.damage], outcome: attack.outcome === "hit" || attack.outcome === "crit" ? attack.outcome : row.attack.outcome, hpBefore: row.hpBefore } : attack;
        row.hpAfter = attack.hpAfter; row.tempAfter = attack.tempAfter;
        rows.set(combatant.id, row);
      }
      targets.push(...rows.values());
      break;
    }
    case "save-damage": case "save-compound-damage": {
      const parts: DamagePart[] = (primary.kind === "save-damage" ? [{ formula: formulaOf(primary.dice, spec.level, exec, casterStats), type: primary.damageType, label: spec.name }] : primary.components.map((component) => ({ formula: formulaOf(component.dice, spec.level, exec, casterStats), type: component.damageType, label: spec.name }))).map(unresisted);
      const areaParts = once(parts);
      // One damage roll for the whole area: the same dice hit everyone (5e), halved for those who save.
      const rolled = input.fixedDamage ?? areaParts.map((part) => { const match = /^(\d+)d(\d+)/.exec(part.formula); if (!match) return []; return Array.from({ length: Number(match[1]) }, () => dice.d(Number(match[2]))); });
      for (const { combatant, stats } of all) {
        const row = base(combatant);
        row.mode = "save";
        // D326: a spell whose colour is rolled for every target (무지개 분사's eight rays).
        const rayRoll = exec.rayTable ? dice.d(exec.rayTable.die) : 0;
        const ray = exec.rayTable?.rows.find((item) => item.value === rayRoll);
        row.save = save(combatant, stats, primary.saveAbility);
        // R95 (D230): 회피술 — on a Dexterity save that halves, nothing on a success and half on a failure, unless incapacitated.
        const evades = Boolean(combatant.evasion) && row.save.ability === "dex" && primary.successDamage === "half" && !CANNOT_ACT.some((name) => combatant.conditions.includes(name));
        // R98 (D233): 강력한 소마법 turns a cantrip success-for-nothing into half.
        const noneOnSuccess = primary.successDamage === "none" && !potent;
        const rayParts = ray?.damageType ? areaParts.map((part) => ({ ...part, type: ray.damageType!, label: `${spec.name} · ${ray.name}` })) : areaParts;
        if (ray && !ray.damageType) { row.mode = "note"; row.note = `${exec.rayTable?.label ?? "표"} — ${ray.name}: ${ray.note ?? "DM 판정"}`; targets.push(row); continue; }
        if (row.save.success && (noneOnSuccess || evades)) afterDamage(row, noDamage(combatant));
        else afterDamage(row, applyDamage(combatant, rayParts, dice, { fixed: rolled, half: row.save.success || evades }));
        if (ray) row.note = [row.note, `${exec.rayTable?.label ?? "광선"}: ${ray.name}`].filter(Boolean).join(" · ");
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
      // D322: one pool shared out instead of a roll each (대량 치유: 700 hit points among the chosen).
      if (primary.pool) {
        let left = (primary.pool.flat ?? 0) + (primary.pool.dice ? rollFormula(formulaOf(primary.pool.dice, spec.level, exec, casterStats), dice) : 0);
        const total = left;
        const room = (combatant: Combatant) => Math.max(0, (primary.pool!.cap === "half-max" ? Math.floor(combatant.hp.max / 2) : combatant.hp.max) - combatant.hp.current);
        // The most hurt first, as the DM would hand it out; nobody takes more than they can hold.
        const order = [...all].sort((a, b) => a.combatant.hp.current / Math.max(1, a.combatant.hp.max) - b.combatant.hp.current / Math.max(1, b.combatant.hp.max));
        const given = new Map<string, number>();
        for (const { combatant } of order) { const share = combatant.noHealing ? 0 : Math.min(left, room(combatant)); given.set(combatant.id, share); left -= share; }
        for (const { combatant } of all) {
          const row = base(combatant);
          row.mode = "heal";
          row.healed = given.get(combatant.id) ?? 0;
          row.hpAfter = combatant.hp.current + row.healed;
          row.note = `${total}의 회복을 나눠 받습니다${combatant.noHealing ? ` — ${combatant.noHealing}: 회복 불가` : ""}${left > 0 && combatant === order[order.length - 1].combatant ? ` · ${left} 남음 (DM 판정: 다시 나누기)` : ""}`;
          targets.push(row);
        }
        break;
      }
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        const extra = (casterStats.healingSlotBonus && spec.level > 0 ? 2 + spec.level : 0) + (primary.hitDice ? casterStats.hitDiceRolled?.total ?? 0 : 0);
        // D323: 희망의 봉화 — the healing this creature receives rolls at its maximum, as 최상급 치유 does for the caster.
        const amount = rollFormula(formula, casterStats.healingMaximized || combatant.healingMaximized ? { d: (sides) => sides } : dice) + extra;
        // D321: an effect may stop its bearer regaining hit points (서리 손길) — the roll still shows, none of it lands.
        row.healed = combatant.noHealing ? 0 : Math.min(amount, Math.max(0, combatant.hp.max - combatant.hp.current));
        row.hpAfter = combatant.hp.current + row.healed;
        row.note = `${primary.hitDice && casterStats.hitDiceRolled ? `${casterStats.hitDiceRolled.note} + ` : ""}${formula}${casterStats.healingMaximized || combatant.healingMaximized ? ` (최대값${combatant.healingMaximized ? ` · ${combatant.healingMaximized}` : ""})` : ""}${extra ? ` +${extra} (생명의 제자)` : ""} = ${amount}${combatant.noHealing ? ` — ${combatant.noHealing}: 회복 불가` : ""}`;
        targets.push(row);
      }
      break;
    }
    case "temporary-hp": {
      const formula = formulaOf(primary.dice, spec.level, exec, casterStats);
      // D322: one pool of temporary hit points shared out evenly (PHB 활력의 권능어: 120 among six).
      if (primary.pool) {
        const total = (primary.pool.flat ?? 0) + (primary.pool.dice ? rollFormula(formulaOf(primary.pool.dice, spec.level, exec, casterStats), dice) : 0);
        const share = all.length ? Math.floor(total / all.length) : 0;
        for (const [index, { combatant }] of all.entries()) {
          const amount = share + (index === 0 ? total - share * all.length : 0);
          const row = base(combatant);
          row.mode = "temp";
          row.tempHp = Math.max(combatant.hp.temp, amount);
          row.tempAfter = row.tempHp;
          row.note = `임시 HP ${total}을(를) ${all.length}명이 나눔 = ${amount} (DM 판정: 다르게 나눌 수 있습니다)`;
          targets.push(row);
        }
        break;
      }
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "temp";
        // D324: a free cast that says so takes the maximum instead of rolling (악마적 활력).
        const amount = rollFormula(formula, casterStats.tempHpMaximized ? { d: (sides) => sides } : dice);
        row.tempHp = Math.max(combatant.hp.temp, amount);
        row.tempAfter = row.tempHp;
        row.note = `${formula}${casterStats.tempHpMaximized ? " (최대값)" : ""} = ${amount}`;
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
        const parts: DamagePart[] = Array.from({ length: row.projectiles }, (_, index) => unresisted({ formula: `1d${primary.projectileDice.sides}${primary.projectileDice.flat ? `+${primary.projectileDice.flat}` : ""}`, type: primary.damageType, label: `${spec.name} ${index + 1}` }));
        afterDamage(row, row.projectiles ? applyDamage(combatant, parts, dice) : noDamage(combatant));
        targets.push(row);
      }
      break;
    }
    case "area-damage": {
      const parts = once([unresisted({ formula: formulaOf(primary.dice, spec.level, exec, casterStats), type: primary.damageType, label: spec.name })]);
      const rolled = input.fixedDamage ?? parts.map((part) => { const match = /^(\d+)d(\d+)/.exec(part.formula); if (!match) return []; return Array.from({ length: Number(match[1]) }, () => dice.d(Number(match[2]))); });
      for (const { combatant } of all) {
        const row = base(combatant);
        afterDamage(row, applyDamage(combatant, parts, dice, { fixed: rolled }));
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
      if (spec.judged) note = `DM 판정 — ${primary.summary ?? spec.name}`;
      break;
    }
    /**
     * R28 (D152): the last nine spells that fell through to "DM이 효과를 적용합니다" even though the compendium
     * describes them precisely — 원조, 마법 무효화, 회복의 마법 언어, 죽음의 마법 언어 and the five revivals.
     */
    case "maximum-hp": {
      // 원조: the target's HP maximum and current HP both rise. The card applies the current-HP half; the new
      // maximum is the table's to keep, because it lasts eight hours and the sheet derives its own maximum.
      // D322: the rise may be dice (영웅 연회: 2d10), rolled once for everyone at the feast.
      const rise = primary.dice ? formulaOf(primary.dice as SpellDice, spec.level, exec, casterStats) : "";
      const amount = rise ? rollFormula(rise, dice) : (primary.amount as number ?? 5) + (primary.amountPerSlotAboveBase as number ?? 0) * Math.max(0, spec.level - (exec.baseLevel ?? spec.level));
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        row.healed = amount;
        row.hpAfter = combatant.hp.current + amount;
        row.note = `최대 HP와 현재 HP가 ${amount} 늘어납니다${rise ? ` (${rise})` : ""}`;
        targets.push(row);
      }
      break;
    }
    case "full-healing": {
      // 회복의 마법 언어: to full, and the conditions the spell names end.
      for (const { combatant } of all) {
        const row = base(combatant);
        row.mode = "heal";
        row.healed = combatant.noHealing ? 0 : Math.max(0, combatant.hp.max - combatant.hp.current);
        row.hpAfter = combatant.hp.current + row.healed;
        // D315: the conditions it ends are the spell's own list (`removesConditions`), laid on below like any spell's.
        row.note = `HP 전부 회복${primary.summary ? ` · ${String(primary.summary)}` : ""}`;
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
  // V4g (D269), D315: the conditions the spell ends, whatever it otherwise does (영웅심's fear, 치유's blindness) —
  // on every creature it reached, except one that resisted it with a successful save.
  if (exec.removesConditions?.length) {
    const ended = exec.removesConditions.map((id) => CONDITION_KO[id] ?? id);
    for (const row of targets) if (!row.save?.success) row.clears = [...new Set([...(row.clears ?? []), ...ended])];
  }
  // D322: the spell's second act — 얼음 칼's shard bursting whether the attack hit or missed, 금속 가열's save
  // after its damage. Its own dice are rolled once for everyone it reaches, as an area's are.
  const secondary = exec.secondary;
  if (secondary) {
    const reached = targets.filter((row) => secondary.appliesTo !== "damaged" || (row.attack?.damageTotal ?? row.damage?.damageTotal ?? 0) > 0);
    const seconds = new Map(all.map((entry) => [entry.combatant.id, entry]));
    const parts: DamagePart[] = secondary.kind === "save-damage" ? [{ formula: formulaOf(secondary.dice, spec.level, exec, casterStats), type: secondary.damageType, label: secondary.note ?? spec.name }] : [];
    const rolled = parts.map((part) => { const match = /^(\d+)d(\d+)/.exec(part.formula); return match ? Array.from({ length: Number(match[1]) }, () => dice.d(Number(match[2]))) : []; });
    for (const row of reached) {
      const entry = seconds.get(row.target.id);
      if (!entry || !("saveAbility" in secondary)) continue;
      const live = { ...entry.combatant, hp: { ...entry.combatant.hp, current: row.hpAfter, temp: row.tempAfter } };
      const second = save(live, entry.stats, String(secondary.saveAbility));
      const failed = !second.success;
      if (secondary.kind === "save-damage" && failed) {
        const outcome = applyDamage(live, parts, dice, { fixed: rolled, half: secondary.successDamage === "half" && second.success });
        row.damage = row.damage ? { ...outcome, damage: [...row.damage.damage, ...outcome.damage], damageTotal: row.damage.damageTotal + outcome.damageTotal } : outcome;
        row.hpAfter = outcome.hpAfter; row.tempAfter = outcome.tempAfter;
      } else if (secondary.kind === "save-damage" && second.success && secondary.successDamage === "half") {
        const outcome = applyDamage(live, parts, dice, { fixed: rolled, half: true });
        row.damage = row.damage ? { ...outcome, damage: [...row.damage.damage, ...outcome.damage], damageTotal: row.damage.damageTotal + outcome.damageTotal } : outcome;
        row.hpAfter = outcome.hpAfter; row.tempAfter = outcome.tempAfter;
      }
      if (failed && secondary.conditions?.length) row.marks = [...new Set([...row.marks, ...secondary.conditions.map((id) => CONDITION_KO[id] ?? id).filter((name) => !immuneToCondition(live.defenses, name))])];
      row.note = [row.note, `${secondary.note ?? "두 번째 효과"}: ${ABILITY_KO[second.ability]} 내성 ${second.total} vs DC ${second.dc} — ${second.success ? "성공" : "실패"}`].filter(Boolean).join(" · ");
      if (!row.save) row.save = second;
    }
  }
  // D322: a condition its target was too strong for says what happened instead.
  for (const row of targets) {
    const entry = all.find((item) => item.combatant.id === row.target.id);
    const missed = entry ? missedThreshold(entry.combatant) : [];
    if (missed.length) row.note = [row.note, ...missed].filter(Boolean).join(" · ");
  }
  // D326: a table the cast rolls on once (순간이동's mishap table) — the row it lands on is the card's line.
  if (exec.outcomeTable) {
    const rolled = dice.d(exec.outcomeTable.die);
    const row = exec.outcomeTable.rows.find((item) => rolled >= item.min && rolled <= item.max);
    const line = `${exec.outcomeTable.label ?? "표"} d${exec.outcomeTable.die} = ${rolled}${row ? ` — ${row.text}` : ""}`;
    note = [note, line].filter(Boolean).join(" · ");
  }
  // V4u (D283): the caster drinks part of what the spell dealt (흡혈의 손길: half the necrotic damage).
  const dealt = targets.reduce((sum, row) => sum + Math.max(0, row.attack?.damageTotal ?? row.damage?.damageTotal ?? 0), 0);
  const casterHealing = exec.casterHealing?.mode === "half-damage" && dealt > 0 ? Math.floor(dealt / 2) : undefined;
  return { spellId: spec.spellId, name: spec.name, level: spec.level, caster: { id: caster.id, name: caster.name, kind: caster.kind }, concentration: Boolean(exec.concentration), economy: exec.castingEconomy, targets, ...(casterHealing ? { casterHealing } : {}), note, applied: input.apply ?? true };
}

/** One line for the chat archive. */
export function describeSpell(result: SpellResolution) {
  const rows = result.targets.map((row) => {
    if (row.attack) return `${row.target.name} ${row.attack.outcome === "crit" ? "치명타" : row.attack.outcome === "hit" ? "적중" : "빗나감"}${row.attack.damageTotal ? ` 피해 ${row.attack.damageTotal}` : ""}`;
    if (row.save) return `${row.target.name} ${ABILITY_KO[row.save.ability]} 내성 ${row.save.total} vs ${row.save.dc} ${row.save.success ? "성공" : "실패"}${row.damage?.damageTotal ? ` 피해 ${row.damage.damageTotal}` : ""}${row.marks.length ? ` (${row.marks.join(", ")})` : ""}`;
    if (row.healed !== undefined) return `${row.target.name} 회복 ${row.healed}`;
    if (row.tempHp !== undefined) return `${row.target.name} 임시 HP ${row.tempHp}`;
    if (row.damage && row.projectiles === undefined) return `${row.target.name} 피해 ${row.damage.damageTotal}`;
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
  for (const list of derived.spellcasting) for (const id of [...list.cantrips, ...list.prepared, ...list.alwaysPrepared, ...(list.ritualFromSpellbook ? list.spellbook ?? [] : [])]) ids.add(id);
  // D351: the spells a working magic item casts from its charges, whether or not the character knows them.
  for (const resource of derived.resources) if (resource.itemInstanceId) for (const id of resource.freeCastSpellIds ?? []) ids.add(id);
  return [...ids].filter((id) => spellExec(id));
}

/** A PC's spell: the spec at the chosen level, the list's attack bonus and DC, and how the cost is paid (null: cannot). */
export function pcSpell(entry: { runtime: CharacterRuntime }, derived: DerivedCharacter, catalog: ContentCatalog, spellId: string, method?: CastMethod): { spec: SpellCastSpec; casterStats: CasterStats; spend: (runtime: CharacterRuntime) => CharacterRuntime | null } | null {
  const base = spellExec(spellId);
  // R77 (D212): a repeat of a spell in effect runs the sustain's execution at the level the spell was cast.
  const exec = base && method?.kind === "sustain" ? sustainedExec(base) : base;
  const view = catalog.spellById(spellId);
  if (!exec || !view) return null;
  const list = derived.spellcasting.find((item) => (method?.kind === "ritual" && item.ritualFromSpellbook && item.spellbook?.includes(spellId)) || item.cantrips.includes(spellId) || item.prepared.includes(spellId) || item.alwaysPrepared.includes(spellId)) ?? derived.spellcasting[0];
  // R19: a scroll carries the spell, so someone with no spellcasting of their own may still read it.
  const fromScroll = method?.kind === "scroll";
  // D361: the item holding the spell may name its own numbers and who may read it (a spell scroll).
  const scroll = fromScroll ? derived.inventory.find((item) => item.instanceId === (method as { instanceId: string }).instanceId) : undefined;
  const reading = scroll?.magic?.use?.castChosen;
  if (reading?.requiresOwnList && !derived.classes.some((state) => view?.classes.includes(state.classId))) return null;
  // D327: a spell somebody else cast on this sheet is used from this sheet (용의 숨결), whether or not it knows it.
  const lent = method?.kind === "sustain" ? entry.runtime.effects?.find((effect) => effect.key === `spell:${spellId}`) : undefined;
  // D351: a magic item casts its own spells from its charges, with its own numbers when it has them (DC 18).
  const itemPool = method?.kind === "resource" ? derived.resources.find((resource) => resource.id === method.id && resource.itemInstanceId && resource.freeCastSpellIds?.includes(spellId)) : undefined;
  const itemStats = itemPool?.castStats?.[spellId];
  if (!list && !fromScroll && !lent?.cast && !itemPool) return null;
  const chosen: CastMethod = method ?? (view.level === 0 ? { kind: "cantrip" } : { kind: "slot", level: view.level });
  const carried = chosen.kind === "sustain" ? entry.runtime.effects?.find((effect) => effect.key === `spell:${spellId}`) : undefined;
  const level = chosen.kind === "slot" ? chosen.level : chosen.kind === "pact" ? derived.pactMagic?.level ?? view.level : (chosen.kind === "resource" && itemPool && chosen.level !== undefined ? chosen.level : undefined) ?? itemStats?.level ?? carried?.level ?? (chosen.kind === "sustain" ? view.level : view.level);
  return {
    spec: { spellId, name: view.name, level, exec, ...(spellIsJudged(exec, catalog, derived) ? { judged: true } : {}) },
    // D327: a spell somebody else cast on this sheet keeps their numbers when this sheet uses it (용의 숨결).
    casterStats: { ...(list ? { attackBonus: list.attackBonus, saveDc: list.saveDc, modifier: derived.abilities[list.ability].modifier, level: derived.level } : { ...scrollStats(view.level), modifier: 0, level: derived.level }), ...(reading?.dc !== undefined ? { saveDc: reading.dc } : {}), ...(reading?.attackBonus !== undefined ? { attackBonus: reading.attackBonus } : {}), ...(itemStats?.dc !== undefined ? { saveDc: itemStats.dc } : {}), ...(itemStats?.attackBonus !== undefined ? { attackBonus: itemStats.attackBonus } : {}), ...(carried?.cast && carried.from ? { saveDc: carried.cast.saveDc, attackBonus: carried.cast.saveDc - 8, modifier: carried.cast.modifier } : {}), ...(derived.ignoresResistance?.length ? { ignoresResistance: derived.ignoresResistance } : {}), ...(derived.ignoresCover || derived.ignoresCoverForSpells ? { ignoresCover: true } : {}), ...(derived.spellDamageModifier?.includes(spellId) || (view.level === 0 && list && derived.cantripModifierClasses?.some((slug) => list.classId?.endsWith(`.${slug}`))) ? { damageModifier: true } : {}), ...(derived.healingSlotBonus ? { healingSlotBonus: true } : {}), ...(derived.healingMaximized ? { healingMaximized: true } : {}), ...(derived.spellDamageMaximizedUpTo && view.level >= 1 && level <= derived.spellDamageMaximizedUpTo && (!derived.spellDamageMaximizedClass || list?.classId?.endsWith(`.${derived.spellDamageMaximizedClass}`)) ? { damageMaximized: true } : {}), ...(derived.potentCantrip ? { potentCantrip: true } : {}), ...(chosen.kind === "resource" && derived.resources.find((item) => item.id === chosen.id)?.freeCastMaximized ? { tempHpMaximized: true } : {}), ...(list && (derived.schoolDamageModifier?.some((rule) => rule.school === view.school && list.classId?.endsWith(`.${rule.classSlug}`)) || spellDamageTypes(exec).some((type) => (derived.damageTypeModifier ?? []).includes(type))) ? { damageBonusOnce: derived.abilities[(derived.damageTypeModifierClass ? derived.spellcasting.find((entry) => entry.classId.endsWith(`.${derived.damageTypeModifierClass}`))?.ability : undefined) ?? list.ability].modifier } : {}) },
    spend: (runtime) => castSpell(runtime, derived, { id: view.id, name: view.name, level: view.level, duration: view.duration, ritual: view.ritual, ...((exec.effects ?? []).some((effect) => effect.termination?.bearerAttacksOrCasts) ? { consumeOn: "attack-or-cast" as const } : {}) }, chosen),
  };
}
