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
  /** R95 (D230): 회피술 — a Dexterity save for half damage takes none on a success and half on a failure. */
  evasion?: boolean;
  /** R96 (D231): 포착 불가 — attacks against it cannot have advantage while it is not incapacitated. */
  elusive?: boolean;
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
  /**
   * R51 (D186): damage this creature simply does not take, per damage type — 중갑 달인 takes 숙련 보너스 less
   * bludgeoning, piercing and slashing while in heavy armour. Subtracted after resistance, never below zero.
   */
  reduction?: Array<{ types: string[]; amount: number; source: string }>;
  /**
   * R55 (D190): reasons attacks *against* this creature are advantaged, each carrying the name of the rule that said
   * so. 무모한 공격 is the 2024 trade: the barbarian's own advantage rides on the attack spec, because it is only
   * their Strength melee swings; what they give away is here, because anyone attacking them gets it.
   */
  grantsAdvantage?: string[];
  /** R90 (D225): reasons attacks against this creature are at disadvantage (흐림). */
  grantsDisadvantage?: string[];
  /** R90 (D225): dice a spell it is under adds to its own attack rolls or saves (축복 +1d4, 액운 −1d4). */
  d20Dice?: Array<{ on: "attack" | "save"; dice: string; label: string }>;
  /** R90 (D225): advantage or disadvantage on its own attack rolls or saves, from a spell it is under. */
  rollStates?: Array<{ on: "attack" | "save"; state: "advantage" | "disadvantage"; label: string; ability?: string }>;
  /** R90 (D225): effects that end once used — by attacking (잔혹한 조롱) or by being attacked (유도 화살). */
  consumable?: Array<{ key: string; on: "attack" | "attacked" }>;
  /** R90 (D225): damage the caster who marked this creature adds when they hit it (사냥꾼의 표식, 주술). */
  markedBy?: Array<{ from: string; formula: string; type: string; label: string }>;
}

export interface DamagePart {
  formula: string;
  type: string;
  label?: string;
  /** Dice double on a critical hit (weapon/spell dice); a flat rider never does. */
  critDoubles?: boolean;
  /**
   * R32 (D165): 대형 무기 전투 — a damage die that rolls below this counts as this. The flag was set on the ledger
   * as `fighting-style:great-weapon-fighting` and read by nothing, so the style did nothing at all.
   */
  dieMinimum?: number;
  /** R51 (D186): this damage is not halved by the target's resistance (원소 숙련자, 독 제조자). */
  ignoresResistance?: boolean;
}

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
  /** R32 (D166): 야만적 공격자 — this swing rerolls its weapon dice and keeps the better set. */
  savage?: boolean;
  /** R43 (D183): the lowest d20 that is a critical hit for this attacker (19 with Improved Critical). */
  critRange?: number;
  /**
   * R53 (D188): damage that lands only on a critical hit (관통자's extra die, 저항할 수 없는 공격의 은총's ability
   * score). The resolver has to know about it before it rolls, which is why it travels with the spec rather than
   * being added to the card afterwards.
   */
  critRiders?: DamagePart[];
  /** R55 (D190): this attack ignores half and three-quarters cover (명사수, 주문 저격수). */
  ignoresCover?: boolean;
  /** R55 (D190): reasons *this* swing is advantaged, already narrowed to the weapon by whatever declared them. */
  advantageOn?: string[];
  /**
   * R60 (D195): what a rule does to this swing's own damage dice — reroll the lowest and keep the new one, roll an
   * extra die of the same size, or treat anything below a floor as that floor. They touch the weapon's dice only; a
   * flat rider is not "the weapon's damage dice", and an `onCrit` rule waits for a critical hit.
   */
  diceRules?: DiceRule[];
  /** R94 (D229): saves the target makes because a chosen rider landed (기절 타격), each with the condition a failure gives. */
  hitSaves?: Array<{ label: string; ability: string; dc: number; condition: string }>;
}

export interface DiceRule {
  mode: "reroll-lowest" | "extra-die" | "die-minimum";
  /** How many dice, or the floor for `die-minimum`. */
  value: number;
  label: string;
  onCrit?: boolean;
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
  /** R37 (D177): added to the attack roll's total by a contract's `roll.modify` (탁월한 기술's 1d12). */
  rollDelta?: number;
  note?: string;
}

export interface DamageResult { part: DamagePart; dice: number[]; rolled: number; adjusted: number; /** R51 (D186): what changed the number — a defence, or a flat reduction naming its source. */ adjustment: "저항" | "면역" | "취약" | string | null }

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
  /** R90 (D225): dice a spell added to the attack roll (축복, 액운), with what they rolled. */
  bonusDice?: Array<{ label: string; dice: string; total: number }>;
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
  // R55 (D190): whatever the two sheets' own contracts declared, on either side of the swing.
  for (const reason of spec.advantageOn ?? []) plus.push(reason);
  for (const reason of target.grantsAdvantage ?? []) plus.push(reason);
  // R90 (D225): spells on either side — 흐림 on the target, 액운·잔혹한 조롱·예지 on the attacker.
  for (const reason of target.grantsDisadvantage ?? []) minus.push(reason);
  for (const state of (attacker.rollStates ?? []).filter((item) => item.on === "attack")) (state.state === "advantage" ? plus : minus).push(`공격자 ${state.label}`);
  // R96 (D231): 포착 불가 takes every reason for advantage away, unless the creature is incapacitated.
  if (target.elusive && plus.length && !["행동불능", "충격", "마비", "석화", "무의식"].some((name) => has(target, name))) plus.length = 0;
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

/**
 * Roll a damage formula. `kept` are dice from an earlier resolution of this same part: each one is reused in order
 * and only the dice the formula still asks for beyond them are rolled fresh.
 *
 * R51 (D186): that reuse is the whole point. Every path that resolves a card a second time — the DM palette, the
 * Shield reaction, a 구조 재굴림 — hands the first roll's dice back so the numbers do not jump around. It used to
 * hand them to a branch that skipped the crit logic entirely, so "치명타" from the palette doubled nothing. Reusing
 * die-by-die instead means a hit promoted to a critical rolls the extra dice it now needs, and a critical demoted
 * to a hit drops them, while every die the player already saw keeps its face.
 */
function rollParts(formula: string, dice: DiceSource, doubleDice: boolean, dieMinimum = 0, kept?: number[]): { dice: number[]; total: number } {
  const clean = formula.replace(/\s+/g, "").replace(/\(.*?\)/g, "");
  const rolled: number[] = [];
  let total = 0;
  let at = 0;
  for (const term of clean.match(/[+-]?[^+-]+/g) ?? []) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const die = /^(\d*)d(\d+)$/.exec(body);
    if (die) {
      const count = (Number(die[1] || 1)) * (doubleDice ? 2 : 1);
      for (let index = 0; index < count; index += 1) {
        const reuse = kept?.[at];
        at += 1;
        const value = reuse !== undefined ? reuse : Math.max(dieMinimum, dice.d(Number(die[2])));
        rolled.push(value);
        total += sign * value;
      }
    } else if (/^\d+$/.test(body)) total += sign * Number(body);
  }
  return { dice: rolled, total };
}

/** R90 (D225): roll a signed formula ("-1d4", "1d4+1") and give its total. */
export const rollFormula = (formula: string, dice: DiceSource) => rollParts(formula, dice, false).total;

/**
 * R60 (D195): apply a swing's dice rules to one part's roll. `die` is the part's own die size, read from its formula,
 * so an extra die is the weapon's die and not a guess. The total is rebuilt from the dice, which is why a part whose
 * formula subtracts dice is left alone — nothing in this content does that, and guessing would be worse than not.
 */
function applyDiceRules(rolled: { dice: number[]; total: number }, part: DamagePart, dice: DiceSource, rules: DiceRule[], crit: boolean, kept?: number[], rerollOnce = false): { dice: number[]; total: number } {
  const match = /(\d*)d(\d+)/.exec(part.formula.replace(/\s+/g, ""));
  if (!match || !rolled.dice.length) return rolled;
  const sides = Number(match[2]);
  const flat = rolled.total - rolled.dice.reduce((sum, value) => sum + value, 0);
  let faces = [...rolled.dice];
  // R60 (D195): on a re-resolution the dice the card already showed come back in `kept`. The formula's own dice were
  // taken from it by `rollParts`; whatever is left over is what these rules added the first time, and reusing it is
  // what keeps a card's numbers still. A reroll never happens twice for the same swing, for the same reason.
  let surplus = (kept ?? []).slice(rolled.dice.length);
  const reuse = () => (surplus.length ? surplus.shift()! : dice.d(sides));
  for (const rule of rules) {
    if (rule.onCrit && !crit) continue;
    if (rule.mode === "die-minimum") faces = faces.map((value) => Math.max(value, rule.value));
    else if (rule.mode === "reroll-lowest") {
      if (kept && !rerollOnce) continue;
      for (let at = 0; at < Math.max(1, rule.value); at += 1) {
        const lowest = faces.reduce((best, value, index) => (value < faces[best] ? index : best), 0);
        faces[lowest] = dice.d(sides);
      }
    } else if (rule.mode === "extra-die") for (let at = 0; at < Math.max(1, rule.value); at += 1) faces.push(reuse());
  }
  surplus = [];
  return { dice: faces, total: faces.reduce((sum, value) => sum + value, 0) + flat };
}

/**
 * R63 (D198): the dice an earlier resolution showed, lined up with a new list of damage parts. A rider chosen after
 * the hit adds parts — 암습 lands before a contract's damage, and a critical's own parts come last — so matching by
 * position would hand one part's dice to another. Each new part takes the dice of the first unused old part with the
 * same label, formula and type; a part nobody rolled yet gets nothing and is rolled fresh.
 */
export function carryDice(previous: DamageResult[], parts: DamagePart[]): Array<number[] | undefined> {
  const used = new Set<number>();
  return parts.map((part) => {
    const at = previous.findIndex((item, index) => !used.has(index) && item.part.label === part.label && item.part.formula === part.formula && item.part.type === part.type);
    if (at < 0) return undefined;
    used.add(at);
    return previous[at].dice;
  });
}

/** R60 (D195): the three `property.modify` names that mean "do this to the weapon's own damage dice". */
export function diceRuleOf(property: string, value: number, label: string, onCrit = false): DiceRule | null {
  const mode = property === "damage.reroll-lowest" ? "reroll-lowest" : property === "damage.extra-die" ? "extra-die" : property === "damage.die-minimum" ? "die-minimum" : null;
  if (!mode) return null;
  return { mode, value: Number.isFinite(value) && value > 0 ? value : mode === "die-minimum" ? 2 : 1, label, ...(onCrit ? { onCrit: true } : {}) };
}

/* ---------- resolution ---------- */

export interface ResolveOptions { dice: DiceSource; overrides?: AttackOverrides; apply?: boolean; /** Fixed d20s and damage dice from an earlier resolution (palette edits keep the rolls). */ fixed?: { masteryD20?: number; d20s: number[]; /** R90 (D225): the spell dice added to the roll, in order. */ bonusDice?: number[]; /** R37 (D177): absent when the earlier resolution rolled no damage (a miss being re-resolved). R63 (D198): an entry may be missing for a part added since. */ damage?: Array<number[] | undefined> };
  /**
   * R63 (D198): the swing is re-resolved because the attacker just chose a rider in the window a hit opens. The dice
   * the card showed stay, but a reroll chosen *now* (야만적 공격자, 관통자) happens once against them — which a plain
   * re-resolution never does, so a palette edit still cannot reroll what the player already saw.
   */
  rerollOnce?: boolean }

export function resolveAttack(attacker: Combatant, target: Combatant, spec: AttackSpec, options: ResolveOptions): AttackResolution {
  const overrides = options.overrides ?? {};
  const suggested = suggestAdvantage(attacker, target, spec);
  const advantage = overrides.advantage ?? suggested.advantage;
  const reasons = [...(overrides.advantage && overrides.advantage !== suggested.advantage ? [...suggested.reasons, `DM: ${advantage === "advantage" ? "유리" : advantage === "disadvantage" ? "불리" : "보통"}`] : suggested.reasons), ...(overrides.note ? [overrides.note] : [])];
  const d20s = options.fixed?.d20s ?? (advantage === "normal" ? [options.dice.d(20)] : [options.dice.d(20), options.dice.d(20)]);
  const kept = advantage === "advantage" ? Math.max(...d20s) : advantage === "disadvantage" ? Math.min(...d20s) : d20s[0];
  // R55 (D190): a contract may say this attack ignores cover; the DM's own cover call is what it overrides.
  const declaredCover = overrides.cover ?? 0;
  const cover = spec.ignoresCover ? 0 : declaredCover;
  if (spec.ignoresCover && declaredCover) reasons.push(`엄폐 +${declaredCover} 무시`);
  const targetAc = target.ac + cover;
  const exhausted = 2 * Math.max(0, attacker.exhaustion ?? 0);
  // R90 (D225): the dice a spell adds to this creature's attack rolls, kept on a re-resolution like the d20.
  const bonusDice = (attacker.d20Dice ?? []).filter((item) => item.on === "attack").map((item, index) => ({ label: item.label, dice: item.dice, total: options.fixed?.bonusDice?.[index] ?? rollFormula(item.dice, options.dice) }));
  for (const item of bonusDice) reasons.push(`${item.label} ${item.total >= 0 ? "+" : ""}${item.total} (${item.dice})`);
  const attackTotal = kept + spec.attackBonus - exhausted + (overrides.rollDelta ?? 0) + bonusDice.reduce((total, item) => total + item.total, 0);
  if (exhausted) reasons.push(`탈진 ${attacker.exhaustion}단계 (−${exhausted})`);
  // R43 (D183): 향상된 치명타 lowers the number a d20 has to reach for a critical hit; 20 is the default.
  const critRange = Math.max(2, Math.min(20, spec.critRange ?? 20));
  let outcome: AttackResolution["outcome"] = kept >= critRange ? "crit" : kept === 1 ? "fumble" : attackTotal >= targetAc ? "hit" : "miss";
  if (outcome === "hit" && autoCrit(target, spec)) { outcome = "crit"; reasons.push(`대상 ${target.conditions.includes("마비") ? "마비" : "무의식"}: 5ft 안의 적중은 치명타`); }
  if (overrides.outcome) outcome = overrides.outcome;
  const hit = outcome === "hit" || outcome === "crit";
  // R12: weapon mastery — Graze deals the ability modifier on a miss; on a hit Topple asks for a CON save, Vex/Sap/Slow mark the target, Push is a note.
  let mastery: MasteryResult | undefined;
  const grazes = !hit && spec.mastery === "graze" && (spec.abilityMod ?? 0) > 0;
  const outcomeDamage = hit
    ? applyDamage(target, [...spec.damage, ...(spec.riders ?? []), ...(outcome === "crit" ? spec.critRiders ?? [] : [])], options.dice, { fixed: options.fixed?.damage, crit: outcome === "crit", scale: overrides.damageScale, delta: overrides.damageDelta, savage: spec.savage, ...(spec.diceRules?.length ? { diceRules: spec.diceRules } : {}), ...(options.rerollOnce ? { rerollOnce: true } : {}) })
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
    advantage, reasons, d20s, kept, cover, attackTotal, targetAc, outcome, damage, damageTotal, absorbed, hpLost, hpBefore: target.hp.current, hpAfter, tempAfter, concentration, downed, deathFailures, ...(bonusDice.length ? { bonusDice } : {}),
    inflicted, mastery, overrides: Object.keys(overrides).length ? overrides : undefined, applied: options.apply ?? true,
  };
}

/** What a hit (or a failed save) does to the target: dice per part, resistances, temp HP first, concentration, 0 HP. Shared by weapon attacks and spells. */
export interface DamageOutcome { damage: DamageResult[]; damageTotal: number; absorbed: number; hpLost: number; hpBefore: number; hpAfter: number; tempAfter: number; concentration?: AttackResolution["concentration"]; downed?: AttackResolution["downed"]; /** Death-save failures the damage caused on a PC already at 0 HP (2 from a critical hit). */ deathFailures?: number }
export const noDamage = (target: Combatant): DamageOutcome => ({ damage: [], damageTotal: 0, absorbed: 0, hpLost: 0, hpBefore: target.hp.current, hpAfter: target.hp.current, tempAfter: target.hp.temp });
export function applyDamage(target: Combatant, parts: DamagePart[], dice: DiceSource, options: { fixed?: Array<number[] | undefined>; /** R63 (D198): see `ResolveOptions.rerollOnce`. */ rerollOnce?: boolean; crit?: boolean; scale?: number; delta?: number; /** Halve after resistances (a successful save). */ half?: boolean; /** R32 (D166): 야만적 공격자 — roll the weapon dice twice and keep the better. */ savage?: boolean; /** R60 (D195): what a rule does to the weapon's own dice. */ diceRules?: DiceRule[] } = {}): DamageOutcome {
  const damage: DamageResult[] = [];
  parts.forEach((part, index) => {
    const fixedDice = options.fixed?.[index];
    const weaponDice = part.critDoubles !== false;
    const doubles = Boolean(options.crit) && weaponDice;
    // R51 (D186): the earlier roll's dice are reused face by face, so promoting or demoting a critical hit changes
    // how many dice the part has without changing the ones already shown.
    let rolled = rollParts(part.formula, dice, doubles, part.dieMinimum ?? 0, fixedDice);
    // R32 (D166): 야만적 공격자 — once per turn, roll the weapon's damage dice twice and use either. Only the
    // weapon's own dice reroll; a flat rider is not "the weapon's damage dice". A re-resolution keeps the dice it
    // was handed, so the reroll does not happen twice for the same swing.
    if (options.savage && weaponDice && (!fixedDice || options.rerollOnce)) {
      const again = rollParts(part.formula, dice, doubles, part.dieMinimum ?? 0);
      if (again.total > rolled.total) rolled = again;
    }
    // R60 (D195): the rules that touch the weapon's own dice, in the order the 2024 text implies — a floor first
    // (it changes what "lowest" means), then the reroll, then the extra die. A reused set of dice is left alone, so
    // re-resolving a card never quietly rerolls something the player already saw.
    if (weaponDice && options.diceRules?.length) rolled = applyDiceRules(rolled, part, dice, options.diceRules, Boolean(options.crit), fixedDice, options.rerollOnce);
    const rawRolled = Math.max(0, rolled.total);
    // R28 (D148): resistance and vulnerability come *last*, after every other modifier — a successful save halves
    // first. The old order doubled for vulnerability and only then halved, which rounds differently (11 → 22 → 11
    // instead of 11 → 5 → 10).
    const raw = options.half ? Math.floor(rawRolled / 2) : rawRolled;
    const immune = listCovers(target.defenses.immunities, part.type);
    const resist = !immune && !part.ignoresResistance && listCovers(target.defenses.resistances, part.type);
    const vulnerable = !immune && listCovers(target.defenses.vulnerabilities, part.type);
    const scaled = immune ? 0 : resist && vulnerable ? raw : resist ? Math.floor(raw / 2) : vulnerable ? raw * 2 : raw;
    // R51 (D186): flat reduction is the last thing that happens, after resistance, and cannot push the part below 0.
    const reducer = scaled > 0 ? (target.reduction ?? []).find((rule) => rule.types.some((type) => listCovers([type], part.type))) : undefined;
    const adjusted = Math.max(0, scaled - (reducer?.amount ?? 0));
    damage.push({ part, dice: rolled.dice, rolled: rawRolled, adjusted, adjustment: immune ? "면역" : resist && !vulnerable ? "저항" : vulnerable && !resist ? "취약" : reducer ? `−${reducer.amount} ${reducer.source}` : null });
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

/** One-line summary for the chat archive and logs. */
export function describeResolution(result: AttackResolution) {
  const roll = `${result.d20s.length > 1 ? `[${result.d20s.join(", ")}]→${result.kept}` : result.kept}${result.attack.bonus >= 0 ? "+" : ""}${result.attack.bonus} = ${result.attackTotal} vs AC ${result.targetAc}`;
  const outcome = result.outcome === "crit" ? "치명타" : result.outcome === "hit" ? "적중" : result.outcome === "fumble" ? "자동 실패" : "빗나감";
  const damage = result.damage.length ? ` · 피해 ${result.damageTotal}${result.absorbed ? ` (임시 ${result.absorbed} 흡수)` : ""} → HP ${result.hpBefore} → ${result.hpAfter}` : "";
  return `${result.attacker.name} → ${result.target.name}: ${result.attack.name} ${roll} ${outcome}${damage}${result.concentration ? ` · 집중 ${result.concentration.success ? "유지" : "실패"}` : ""}${result.downed ? ` · ${result.downed === "dead" ? "사망" : result.downed === "instant-death" ? "즉사" : "무의식"}` : result.deathFailures ? ` · 죽음 내성 실패 ${result.deathFailures}회` : ""}`;
}
