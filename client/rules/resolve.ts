/**
 * Semi-automatic attack resolution (ROLL20_TABLE_SPEC.md §12.2): the rules engine rolls and applies, the DM
 * corrects with the palette. Pure and deterministic given `random`, so the host runs it and tests pin every step:
 * advantage/disadvantage suggested from conditions and range, d20 vs AC (20 = hit + critical, 1 = miss), damage
 * dice doubled on a crit, riders, resistance/immunity/vulnerability per damage type, temp HP before HP, a
 * concentration save when a concentrating target takes damage (D92: automatic), and 0 HP consequences.
 */
import type { ActorRef, AttackRef } from "../session/protocol";
export type Advantage = "advantage" | "disadvantage" | "normal";

export interface CombatantDefenses {
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  /**
   * R28 (D150): conditions the creature cannot be given. The sheet and every stat block have carried this list all
   * along — the derived character even labels where each one comes from ("공포 (영웅심)") — and no rule read it, so
   * a zombie could be charmed and a barbarian raging through Heroism could still be frightened.
   */
  conditionImmunities?: string[];
}

/** Whether a condition simply cannot land here; the list may carry the source in brackets ("중독 (드워프)"). */
export function immuneToCondition(defenses: CombatantDefenses, condition: string) {
  const want = condition.trim();
  return (defenses.conditionImmunities ?? []).some((entry) => entry.replace(/\(.*?\)/g, "").trim() === want);
}

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
  /**
   * R28 (D147): 2024 exhaustion — every level is −2 on every D20 Test (attack rolls, ability checks, saving
   * throws). It was stored, set, decremented by a long rest and shown on the sheet, and read by no roll anywhere.
   */
  exhaustion?: number;
  /** R31 (D161): 마법 저항 — advantage on saving throws against spells and other magical effects. */
  magicResistance?: boolean;
  /** R31 (D162): 재생 — hit points regained at the start of its turn, and the sentence that qualifies it. */
  regeneration?: { amount: number; note: string };
  /** The token on the board, when there is one. */
  tokenId?: string;
  /** Token id of whoever holds this creature in a grapple (2024: attacks against anyone else are at disadvantage). */
  grappledBy?: string;
  /** R12: token id of the wielder whose Vex mastery gave advantage against this creature. */
  vexedBy?: string;
}

export interface DamagePart { formula: string; type: string; label?: string; /** Dice double on a critical hit (weapon/spell dice); a flat rider never does. */ critDoubles?: boolean }

export interface AttackSpec {
  name: string;
  source: "weapon" | "spell" | "npc";
  attackBonus: number;
  mode: "melee" | "ranged";
  damage: DamagePart[];
  /** Extra damage the attacker chose (암습, 신성한 강타 …), already as parts. */
  riders?: DamagePart[];
  /** Conditions the hit inflicts (from NPC riders or masteries). */
  inflicts?: string[];
  /** R12 (2024 weapon mastery): the active mastery property's key, the wielder's ability modifier and the mastery save DC (8 + mod + PB). */
  mastery?: string;
  abilityMod?: number;
  masteryDc?: number;
}

/** R12: what a mastery did on this attack. */
export interface MasteryResult { kind: string; label: string; /** Graze: damage dealt on a miss. */ grazed?: number; /** Topple: the target's CON save. */ save?: { d20: number; bonus: number; total: number; dc: number; success: boolean }; /** Marks put on the target (from the wielder). */ marks: string[]; note?: string }
export const MASTERY_LABEL: Record<string, string> = { cleave: "쪼개기", graze: "스치기", nick: "베기", push: "밀치기", sap: "약화", slow: "둔화", topple: "넘어뜨리기", vex: "교란" };

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
  /** R12: what the weapon mastery did (graze damage, topple save, marks). */
  mastery?: MasteryResult;
  /** R12: how this attack was asked for, so a card can offer the Cleave follow-up. */
  attackRef?: AttackRef;
  attackerRef?: ActorRef;
  /** What happened at 0 HP. */
  downed?: "unconscious" | "dead" | "instant-death";
  /** Death-save failures the hit caused on a PC already at 0 HP. */
  deathFailures?: number;
  inflicted: string[];
  overrides?: AttackOverrides;
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
  if (has(attacker, "약화")) minus.push("약화 (Sap): 다음 공격 불리");
  if (target.vexedBy && attacker.tokenId && target.vexedBy === attacker.tokenId) plus.push("교란 (Vex): 이 대상에게 유리");
  if (has(target, "넘어짐")) (spec.mode === "melee" ? plus : minus).push(spec.mode === "melee" ? "대상 넘어짐 (근접)" : "대상 넘어짐 (원거리)");
  // 2024: 행동불능(Incapacitated) on its own gives an attacker nothing — it only bars actions, reactions and concentration.
  for (const name of ["마비", "석화", "포박", "충격", "무의식"]) if (has(target, name)) plus.push(`대상 ${name}`);
  if (has(target, "장님")) plus.push("대상 장님");
  if (has(target, "투명")) minus.push("대상 투명");
  if (effect(target, "회피")) minus.push("대상 회피");
  if (plus.length && minus.length) return { advantage: "normal", reasons: [...plus, ...minus, "유리·불리가 상쇄"] };
  if (plus.length) return { advantage: "advantage", reasons: plus };
  if (minus.length) return { advantage: "disadvantage", reasons: minus };
  return { advantage: "normal", reasons: [] };
}

/** A melee hit on a paralysed or unconscious target is a critical hit (D95: the table has no distances, so melee stands in for "within 5 ft"). */
const autoCrit = (target: Combatant, spec: AttackSpec) => (target.conditions.includes("마비") || target.conditions.includes("무의식")) && spec.mode === "melee";

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

export interface ResolveOptions { dice: DiceSource; overrides?: AttackOverrides; apply?: boolean; /** Fixed d20s and damage dice from an earlier resolution (palette edits keep the rolls). */ fixed?: { masteryD20?: number; d20s: number[]; damage: number[][] } }

export function resolveAttack(attacker: Combatant, target: Combatant, spec: AttackSpec, options: ResolveOptions): AttackResolution {
  const overrides = options.overrides ?? {};
  const suggested = suggestAdvantage(attacker, target, spec);
  const advantage = overrides.advantage ?? suggested.advantage;
  const reasons = [...(overrides.advantage && overrides.advantage !== suggested.advantage ? [...suggested.reasons, `DM: ${advantage === "advantage" ? "유리" : advantage === "disadvantage" ? "불리" : "보통"}`] : suggested.reasons), ...(overrides.note ? [overrides.note] : [])];
  const d20s = options.fixed?.d20s ?? (advantage === "normal" ? [options.dice.d(20)] : [options.dice.d(20), options.dice.d(20)]);
  const kept = advantage === "advantage" ? Math.max(...d20s) : advantage === "disadvantage" ? Math.min(...d20s) : d20s[0];
  const cover = overrides.cover ?? 0;
  const targetAc = target.ac + cover;
  const exhausted = 2 * Math.max(0, attacker.exhaustion ?? 0);
  const attackTotal = kept + spec.attackBonus - exhausted;
  if (exhausted) reasons.push(`탈진 ${attacker.exhaustion}단계 (−${exhausted})`);
  let outcome: AttackResolution["outcome"] = kept === 20 ? "crit" : kept === 1 ? "fumble" : attackTotal >= targetAc ? "hit" : "miss";
  if (outcome === "hit" && autoCrit(target, spec)) { outcome = "crit"; reasons.push(`대상 ${target.conditions.includes("마비") ? "마비" : "무의식"}: 5ft 안의 적중은 치명타`); }
  if (overrides.outcome) outcome = overrides.outcome;
  const hit = outcome === "hit" || outcome === "crit";
  // R12: weapon mastery — Graze deals the ability modifier on a miss; on a hit Topple asks for a CON save, Vex/Sap/Slow mark the target, Push is a note.
  let mastery: MasteryResult | undefined;
  const grazes = !hit && spec.mastery === "graze" && (spec.abilityMod ?? 0) > 0;
  const outcomeDamage = hit
    ? applyDamage(target, [...spec.damage, ...(spec.riders ?? [])], options.dice, { fixed: options.fixed?.damage, crit: outcome === "crit", scale: overrides.damageScale, delta: overrides.damageDelta })
    : grazes ? applyDamage(target, [{ formula: String(spec.abilityMod), type: spec.damage[0]?.type ?? "타격", label: "스치기", critDoubles: false }], options.dice, { fixed: options.fixed?.damage, scale: overrides.damageScale, delta: overrides.damageDelta }) : noDamage(target);
  const { damage, damageTotal, absorbed, hpLost, hpAfter, tempAfter, concentration, downed, deathFailures } = outcomeDamage;
  const inflicted = hit ? (spec.inflicts ?? []).filter((condition) => !immuneToCondition(target.defenses, condition)) : [];
  if (grazes) mastery = { kind: "graze", label: MASTERY_LABEL.graze, grazed: damageTotal, marks: [], note: `빗나갔지만 ${damageTotal} 피해` };
  else if (hit && spec.mastery) {
    switch (spec.mastery) {
      case "topple": { const d20 = options.fixed?.masteryD20 ?? options.dice.d(20); const total = d20 + target.conSave; const dc = spec.masteryDc ?? 10; const success = total >= dc; if (!success && !target.conditions.includes("넘어짐") && !immuneToCondition(target.defenses, "넘어짐")) inflicted.push("넘어짐"); mastery = { kind: "topple", label: MASTERY_LABEL.topple, save: { d20, bonus: target.conSave, total, dc, success }, marks: [], note: success ? "건강 내성 성공" : "건강 내성 실패 → 넘어짐" }; break; }
      case "vex": mastery = { kind: "vex", label: MASTERY_LABEL.vex, marks: ["교란"], note: "다음 자기 턴 끝까지 이 대상에게 공격 유리" }; break;
      case "sap": mastery = { kind: "sap", label: MASTERY_LABEL.sap, marks: ["약화"], note: "대상의 다음 공격 굴림 불리" }; break;
      case "slow": mastery = { kind: "slow", label: MASTERY_LABEL.slow, marks: ["둔화"], note: "대상의 이동 속도 −10 ft (다음 자기 턴 시작까지)" }; break;
      case "push": mastery = { kind: "push", label: MASTERY_LABEL.push, marks: [], note: "대상을 10 ft 밀어냄 (대형 이하)" }; break;
      case "cleave": mastery = { kind: "cleave", label: MASTERY_LABEL.cleave, marks: [], note: "5 ft 안의 다른 대상에게 한 번 더 (피해에 능력 수정치 없음, 턴당 1회)" }; break;
      case "nick": mastery = { kind: "nick", label: MASTERY_LABEL.nick, marks: [], note: "가벼운 무기의 추가 공격을 공격 행동 안에서 (추가 행동 소비 없음)" }; break;
      default: break;
    }
  }
  return {
    attacker: { id: attacker.id, name: attacker.name, kind: attacker.kind }, target: { id: target.id, name: target.name, kind: target.kind },
    attack: { name: spec.name, source: spec.source, mode: spec.mode, bonus: spec.attackBonus },
    advantage, reasons, d20s, kept, cover, attackTotal, targetAc, outcome, damage, damageTotal, absorbed, hpLost, hpBefore: target.hp.current, hpAfter, tempAfter, concentration, downed, deathFailures,
    inflicted, mastery, overrides: Object.keys(overrides).length ? overrides : undefined, applied: options.apply ?? true,
  };
}

/** What a hit (or a failed save) does to the target: dice per part, resistances, temp HP first, concentration, 0 HP. Shared by weapon attacks and spells. */
export interface DamageOutcome { damage: DamageResult[]; damageTotal: number; absorbed: number; hpLost: number; hpBefore: number; hpAfter: number; tempAfter: number; concentration?: AttackResolution["concentration"]; downed?: AttackResolution["downed"]; /** Death-save failures the damage caused on a PC already at 0 HP (2 from a critical hit). */ deathFailures?: number }
export const noDamage = (target: Combatant): DamageOutcome => ({ damage: [], damageTotal: 0, absorbed: 0, hpLost: 0, hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp });
export function applyDamage(target: Combatant, parts: DamagePart[], dice: DiceSource, options: { fixed?: number[][]; crit?: boolean; scale?: number; delta?: number; /** Halve after resistances (a successful save). */ half?: boolean } = {}): DamageOutcome {
  const damage: DamageResult[] = [];
  parts.forEach((part, index) => {
    const fixedDice = options.fixed?.[index];
    let rolled: { dice: number[]; total: number };
    if (fixedDice) { rolled = { dice: fixedDice, total: fixedDice.reduce((sum, value) => sum + value, 0) + flatOf(part.formula) }; }
    else rolled = rollParts(part.formula, dice, Boolean(options.crit) && part.critDoubles !== false);
    const rawRolled = Math.max(0, rolled.total);
    // R28 (D148): resistance and vulnerability come *last*, after every other modifier — a successful save halves
    // first. The old order doubled for vulnerability and only then halved, which rounds differently (11 → 22 → 11
    // instead of 11 → 5 → 10).
    const raw = options.half ? Math.floor(rawRolled / 2) : rawRolled;
    const immune = listCovers(target.defenses.immunities, part.type);
    const resist = !immune && listCovers(target.defenses.resistances, part.type);
    const vulnerable = !immune && listCovers(target.defenses.vulnerabilities, part.type);
    const adjusted = immune ? 0 : resist && vulnerable ? raw : resist ? Math.floor(raw / 2) : vulnerable ? raw * 2 : raw;
    damage.push({ part, dice: rolled.dice, rolled: rawRolled, adjusted, adjustment: immune ? "면역" : resist && !vulnerable ? "저항" : vulnerable && !resist ? "취약" : null });
  });
  let damageTotal = damage.reduce((sum, item) => sum + item.adjusted, 0);
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
  let deathFailures: number | undefined;
  if (hpAfter === 0 && target.hp.current > 0) {
    const overflow = damageTotal - absorbed - target.hp.current;
    downed = target.kind === "npc" ? "dead" : overflow >= target.hp.max ? "instant-death" : "unconscious";
  } else if (target.kind === "pc" && target.hp.current === 0 && damageTotal - absorbed > 0) {
    // Damage on a PC already at 0 HP: one death-save failure, two from a critical hit, instant death at HP maximum.
    if (damageTotal - absorbed >= target.hp.max) downed = "instant-death";
    else deathFailures = options.crit ? 2 : 1;
  }
  return { damage, damageTotal, absorbed, hpLost, hpBefore: target.hp.current, hpAfter, tempAfter, concentration, downed, deathFailures };
}

const flatOf = (formula: string) => { let total = 0; for (const term of formula.replace(/\s+/g, "").replace(/\(.*?\)/g, "").match(/[+-]?[^+-]+/g) ?? []) if (/^[+-]?\d+$/.test(term)) total += Number(term); return total; };

/** One-line summary for the chat archive and logs. */
export function describeResolution(result: AttackResolution) {
  const roll = `${result.d20s.length > 1 ? `[${result.d20s.join(", ")}]→${result.kept}` : result.kept}${result.attack.bonus >= 0 ? "+" : ""}${result.attack.bonus} = ${result.attackTotal} vs AC ${result.targetAc}`;
  const outcome = result.outcome === "crit" ? "치명타" : result.outcome === "hit" ? "적중" : result.outcome === "fumble" ? "자동 실패" : "빗나감";
  const damage = result.damage.length ? ` · 피해 ${result.damageTotal}${result.absorbed ? ` (임시 ${result.absorbed} 흡수)` : ""} → HP ${result.hpBefore} → ${result.hpAfter}` : "";
  return `${result.attacker.name} → ${result.target.name}: ${result.attack.name} ${roll} ${outcome}${damage}${result.concentration ? ` · 집중 ${result.concentration.success ? "유지" : "실패"}` : ""}${result.downed ? ` · ${result.downed === "dead" ? "사망" : result.downed === "instant-death" ? "즉사" : "무의식"}` : result.deathFailures ? ` · 죽음 내성 실패 ${result.deathFailures}회` : ""}`;
}
