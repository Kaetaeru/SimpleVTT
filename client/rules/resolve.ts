/**
 * Semi-automatic attack resolution (ROLL20_TABLE_SPEC.md §12.2): the rules engine rolls and applies, the DM
 * corrects with the palette. Pure and deterministic given `random`, so the host runs it and tests pin every step:
 * advantage/disadvantage suggested from conditions and range, d20 vs AC (20 = hit + critical, 1 = miss), damage
 * dice doubled on a crit, riders, resistance/immunity/vulnerability per damage type, temp HP before HP, a
 * concentration save when a concentrating target takes damage (D92: automatic), and 0 HP consequences.
 */
export type Advantage = "advantage" | "disadvantage" | "normal";

export interface CombatantDefenses { resistances: string[]; immunities: string[]; vulnerabilities: string[] }

/** What the resolver needs to know about either side; the host builds it from a PC sheet or an NPC token/sheet. */
export interface Combatant {
  id: string;
  name: string;
  kind: "pc" | "npc";
  ac: number;
  hp: { current: number; max: number; temp: number };
  conditions: string[];
  defenses: CombatantDefenses;
  /** Bonus to Constitution saves (concentration). */
  conSave: number;
  /** Name of the effect the combatant is concentrating on, if any. */
  concentration?: string;
  /** Active effect flags that change attack rolls (회피, 도움 …). */
  effects: string[];
  /** The token on the board, when there is one. */
  tokenId?: string;
  /** Token id of whoever holds this creature in a grapple (2024: attacks against anyone else are at disadvantage). */
  grappledBy?: string;
  /** Cells from the attacker (undefined when either has no token). */
  distanceFeet?: number;
}

export interface DamagePart { formula: string; type: string; label?: string; /** Dice double on a critical hit (weapon/spell dice); a flat rider never does. */ critDoubles?: boolean }

export interface AttackSpec {
  name: string;
  source: "weapon" | "spell" | "npc";
  attackBonus: number;
  mode: "melee" | "ranged";
  /** Normal / long range in feet (melee: reach, default 5). */
  rangeFeet?: number;
  longRangeFeet?: number;
  damage: DamagePart[];
  /** Extra damage the attacker chose (암습, 신성한 강타 …), already as parts. */
  riders?: DamagePart[];
  /** Conditions the hit inflicts (from NPC riders or masteries). */
  inflicts?: string[];
}

export interface AttackOverrides {
  advantage?: Advantage;
  cover?: 0 | 2 | 5;
  outcome?: "hit" | "miss" | "crit";
  /** Added to the damage total after resistances (may be negative). */
  damageDelta?: number;
  /** Multiplies the damage total (0, 0.5, 1). */
  damageScale?: number;
  note?: string;
}

export interface DamageResult { part: DamagePart; dice: number[]; rolled: number; adjusted: number; adjustment: "저항" | "면역" | "취약" | null }

export interface AttackResolution {
  attacker: { id: string; name: string; kind: "pc" | "npc" };
  target: { id: string; name: string; kind: "pc" | "npc" };
  attack: { name: string; source: AttackSpec["source"]; mode: AttackSpec["mode"]; bonus: number };
  advantage: Advantage;
  reasons: string[];
  /** Both d20s when rolled with advantage/disadvantage; `kept` is the one that counts. */
  d20s: number[];
  kept: number;
  cover: number;
  attackTotal: number;
  targetAc: number;
  outcome: "hit" | "miss" | "crit" | "fumble";
  damage: DamageResult[];
  damageTotal: number;
  /** Temp HP absorbed and HP lost. */
  absorbed: number;
  hpLost: number;
  hpBefore: number;
  hpAfter: number;
  tempAfter: number;
  /** Concentration check made because damage landed on a concentrating target. */
  concentration?: { effect: string; dc: number; d20: number; total: number; success: boolean };
  /** What happened at 0 HP. */
  downed?: "unconscious" | "dead" | "instant-death";
  inflicted: string[];
  overrides?: AttackOverrides;
  distanceFeet?: number;
  /** True once HP was written (D90: with "DM 확인 후 적용" the card waits). */
  applied: boolean;
}

/* ---------- damage types in two languages ---------- */

const TYPE_KO: Record<string, string> = { slashing: "참격", piercing: "관통", bludgeoning: "타격", fire: "화염", cold: "냉기", lightning: "번개", thunder: "천둥", acid: "산성", poison: "독", necrotic: "사령", radiant: "광휘", force: "역장", psychic: "정신" };
const TYPE_EN = Object.fromEntries(Object.entries(TYPE_KO).map(([en, ko]) => [ko, en]));
/** Canonical (English) damage type for either spelling; unknown strings pass through lower-cased. */
export const damageTypeKey = (type: string) => { const trimmed = type.trim().toLowerCase(); return TYPE_EN[trimmed] ?? (TYPE_KO[trimmed] ? trimmed : trimmed); };
export const damageTypeKo = (type: string) => TYPE_KO[damageTypeKey(type)] ?? type;

/** A defenses list may hold "타격·관통·참격" or "bludgeoning, piercing, and slashing from nonmagical attacks". */
export function listCovers(list: string[], type: string) {
  const key = damageTypeKey(type);
  return list.some((entry) => entry.split(/[·,/;]| and | 및 /).map((part) => part.replace(/\(.*?\)|from nonmagical.*|비마법.*|피해/g, "").trim()).filter(Boolean).some((part) => damageTypeKey(part) === key));
}

/* ---------- advantage from conditions ---------- */

/** Suggest advantage or disadvantage from both sides' conditions and effects (5e 2024 conditions), with reasons. */
export function suggestAdvantage(attacker: Combatant, target: Combatant, spec: AttackSpec): { advantage: Advantage; reasons: string[] } {
  const plus: string[] = [];
  const minus: string[] = [];
  const has = (who: Combatant, name: string) => who.conditions.includes(name);
  const effect = (who: Combatant, name: string) => who.effects.includes(name) || who.conditions.includes(name);
  if (has(attacker, "장님")) minus.push("공격자 장님");
  if (has(attacker, "넘어짐")) minus.push("공격자 넘어짐");
  if (has(attacker, "포박")) minus.push("공격자 포박");
  if (has(attacker, "중독")) minus.push("공격자 중독");
  if (has(attacker, "공포")) minus.push("공격자 공포");
  if (attacker.grappledBy && target.tokenId && attacker.grappledBy !== target.tokenId) minus.push("붙잡힌 채 다른 대상 공격");
  if (has(attacker, "투명")) plus.push("공격자 투명");
  if (effect(attacker, "은신")) plus.push("공격자 은신");
  if (effect(attacker, "도움")) plus.push("도움 받음");
  if (has(target, "넘어짐")) (spec.mode === "melee" ? plus : minus).push(spec.mode === "melee" ? "대상 넘어짐 (근접)" : "대상 넘어짐 (원거리)");
  for (const name of ["마비", "석화", "포박", "충격", "행동불능", "무의식"]) if (has(target, name)) plus.push(`대상 ${name}`);
  if (has(target, "장님")) plus.push("대상 장님");
  if (has(target, "투명")) minus.push("대상 투명");
  if (effect(target, "회피")) minus.push("대상 회피");
  if (spec.mode === "ranged" && target.distanceFeet !== undefined && spec.rangeFeet !== undefined && target.distanceFeet > spec.rangeFeet) minus.push("긴 사거리");
  if (plus.length && minus.length) return { advantage: "normal", reasons: [...plus, ...minus, "유리·불리가 상쇄"] };
  if (plus.length) return { advantage: "advantage", reasons: plus };
  if (minus.length) return { advantage: "disadvantage", reasons: minus };
  return { advantage: "normal", reasons: [] };
}

/** A hit on a paralysed or unconscious target within 5 ft is a critical hit. */
const autoCrit = (target: Combatant, spec: AttackSpec) => (target.conditions.includes("마비") || target.conditions.includes("무의식")) && (spec.mode === "melee" || (target.distanceFeet !== undefined && target.distanceFeet <= 5));

/* ---------- dice ---------- */

export interface DiceSource { d(sides: number): number }
export const diceFrom = (random: () => number): DiceSource => ({ d: (sides) => 1 + Math.floor(random() * sides) });

function rollParts(formula: string, dice: DiceSource, doubleDice: boolean): { dice: number[]; total: number } {
  const clean = formula.replace(/\s+/g, "").replace(/\(.*?\)/g, "");
  const rolled: number[] = [];
  let total = 0;
  for (const term of clean.match(/[+-]?[^+-]+/g) ?? []) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const die = /^(\d*)d(\d+)$/.exec(body);
    if (die) {
      const count = (Number(die[1] || 1)) * (doubleDice ? 2 : 1);
      for (let index = 0; index < count; index += 1) { const value = dice.d(Number(die[2])); rolled.push(value); total += sign * value; }
    } else if (/^\d+$/.test(body)) total += sign * Number(body);
  }
  return { dice: rolled, total };
}

/* ---------- resolution ---------- */

export interface ResolveOptions { dice: DiceSource; overrides?: AttackOverrides; apply?: boolean; /** Fixed d20s and damage dice from an earlier resolution (palette edits keep the rolls). */ fixed?: { d20s: number[]; damage: number[][] } }

export function resolveAttack(attacker: Combatant, target: Combatant, spec: AttackSpec, options: ResolveOptions): AttackResolution {
  const overrides = options.overrides ?? {};
  const suggested = suggestAdvantage(attacker, target, spec);
  const advantage = overrides.advantage ?? suggested.advantage;
  const reasons = overrides.advantage && overrides.advantage !== suggested.advantage ? [...suggested.reasons, `DM: ${advantage === "advantage" ? "유리" : advantage === "disadvantage" ? "불리" : "보통"}`] : suggested.reasons;
  const d20s = options.fixed?.d20s ?? (advantage === "normal" ? [options.dice.d(20)] : [options.dice.d(20), options.dice.d(20)]);
  const kept = advantage === "advantage" ? Math.max(...d20s) : advantage === "disadvantage" ? Math.min(...d20s) : d20s[0];
  const cover = overrides.cover ?? 0;
  const targetAc = target.ac + cover;
  const attackTotal = kept + spec.attackBonus;
  let outcome: AttackResolution["outcome"] = kept === 20 ? "crit" : kept === 1 ? "fumble" : attackTotal >= targetAc ? "hit" : "miss";
  if (outcome === "hit" && autoCrit(target, spec)) { outcome = "crit"; reasons.push(`대상 ${target.conditions.includes("마비") ? "마비" : "무의식"}: 5ft 안의 적중은 치명타`); }
  if (overrides.outcome) outcome = overrides.outcome;
  const beyondLong = spec.mode === "ranged" && target.distanceFeet !== undefined && spec.longRangeFeet !== undefined && target.distanceFeet > spec.longRangeFeet;
  if (beyondLong && !overrides.outcome) { outcome = "miss"; reasons.push("최대 사거리 밖"); }
  const hit = outcome === "hit" || outcome === "crit";
  const outcomeDamage = hit ? applyDamage(target, [...spec.damage, ...(spec.riders ?? [])], options.dice, { fixed: options.fixed?.damage, crit: outcome === "crit", scale: overrides.damageScale, delta: overrides.damageDelta }) : noDamage(target);
  const { damage, damageTotal, absorbed, hpLost, hpAfter, tempAfter, concentration, downed } = outcomeDamage;
  return {
    attacker: { id: attacker.id, name: attacker.name, kind: attacker.kind }, target: { id: target.id, name: target.name, kind: target.kind },
    attack: { name: spec.name, source: spec.source, mode: spec.mode, bonus: spec.attackBonus },
    advantage, reasons, d20s, kept, cover, attackTotal, targetAc, outcome, damage, damageTotal, absorbed, hpLost, hpBefore: target.hp.current, hpAfter, tempAfter, concentration, downed,
    inflicted: hit ? spec.inflicts ?? [] : [], overrides: Object.keys(overrides).length ? overrides : undefined, distanceFeet: target.distanceFeet, applied: options.apply ?? true,
  };
}

/** What a hit (or a failed save) does to the target: dice per part, resistances, temp HP first, concentration, 0 HP. Shared by weapon attacks and spells. */
export interface DamageOutcome { damage: DamageResult[]; damageTotal: number; absorbed: number; hpLost: number; hpBefore: number; hpAfter: number; tempAfter: number; concentration?: AttackResolution["concentration"]; downed?: AttackResolution["downed"] }
export const noDamage = (target: Combatant): DamageOutcome => ({ damage: [], damageTotal: 0, absorbed: 0, hpLost: 0, hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp });
export function applyDamage(target: Combatant, parts: DamagePart[], dice: DiceSource, options: { fixed?: number[][]; crit?: boolean; scale?: number; delta?: number; /** Halve after resistances (a successful save). */ half?: boolean } = {}): DamageOutcome {
  const damage: DamageResult[] = [];
  parts.forEach((part, index) => {
    const fixedDice = options.fixed?.[index];
    let rolled: { dice: number[]; total: number };
    if (fixedDice) { rolled = { dice: fixedDice, total: fixedDice.reduce((sum, value) => sum + value, 0) + flatOf(part.formula) }; }
    else rolled = rollParts(part.formula, dice, Boolean(options.crit) && part.critDoubles !== false);
    const raw = Math.max(0, rolled.total);
    const immune = listCovers(target.defenses.immunities, part.type);
    const resist = !immune && listCovers(target.defenses.resistances, part.type);
    const vulnerable = !immune && listCovers(target.defenses.vulnerabilities, part.type);
    const adjusted = immune ? 0 : resist && vulnerable ? raw : resist ? Math.floor(raw / 2) : vulnerable ? raw * 2 : raw;
    damage.push({ part, dice: rolled.dice, rolled: raw, adjusted, adjustment: immune ? "면역" : resist && !vulnerable ? "저항" : vulnerable && !resist ? "취약" : null });
  });
  let damageTotal = damage.reduce((sum, item) => sum + item.adjusted, 0);
  if (options.half) damageTotal = Math.floor(damageTotal / 2);
  if (options.scale !== undefined) damageTotal = Math.floor(damageTotal * options.scale);
  if (options.delta) damageTotal = Math.max(0, damageTotal + options.delta);
  const absorbed = Math.min(target.hp.temp, damageTotal);
  const hpLost = Math.min(target.hp.current, damageTotal - absorbed);
  const hpAfter = target.hp.current - hpLost;
  const tempAfter = target.hp.temp - absorbed;
  let concentration: AttackResolution["concentration"];
  if (damageTotal > 0 && target.concentration) {
    const dc = Math.max(10, Math.floor(damageTotal / 2));
    const d20 = dice.d(20);
    const total = d20 + target.conSave;
    concentration = { effect: target.concentration, dc, d20, total, success: total >= dc };
  }
  let downed: AttackResolution["downed"];
  if (hpAfter === 0 && target.hp.current > 0) {
    const overflow = damageTotal - absorbed - target.hp.current;
    downed = target.kind === "npc" ? "dead" : overflow >= target.hp.max ? "instant-death" : "unconscious";
  }
  return { damage, damageTotal, absorbed, hpLost, hpBefore: target.hp.current, hpAfter, tempAfter, concentration, downed };
}

const flatOf = (formula: string) => { let total = 0; for (const term of formula.replace(/\s+/g, "").replace(/\(.*?\)/g, "").match(/[+-]?[^+-]+/g) ?? []) if (/^[+-]?\d+$/.test(term)) total += Number(term); return total; };

/** One-line summary for the chat archive and logs. */
export function describeResolution(result: AttackResolution) {
  const roll = `${result.d20s.length > 1 ? `[${result.d20s.join(", ")}]→${result.kept}` : result.kept}${result.attack.bonus >= 0 ? "+" : ""}${result.attack.bonus} = ${result.attackTotal} vs AC ${result.targetAc}`;
  const outcome = result.outcome === "crit" ? "치명타" : result.outcome === "hit" ? "적중" : result.outcome === "fumble" ? "자동 실패" : "빗나감";
  const damage = result.damage.length ? ` · 피해 ${result.damageTotal}${result.absorbed ? ` (임시 ${result.absorbed} 흡수)` : ""} → HP ${result.hpBefore} → ${result.hpAfter}` : "";
  return `${result.attacker.name} → ${result.target.name}: ${result.attack.name} ${roll} ${outcome}${damage}${result.concentration ? ` · 집중 ${result.concentration.success ? "유지" : "실패"}` : ""}${result.downed ? ` · ${result.downed === "dead" ? "사망" : result.downed === "instant-death" ? "즉사" : "무의식"}` : ""}`;
}
