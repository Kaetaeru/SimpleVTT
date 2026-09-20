/**
 * R52 (ROLL20_TABLE_SPEC.md D187): what a contract may add to one swing, declared before the dice.
 *
 * The pre-roll dialog used to offer exactly five things — 암습, 신성한 강타, 쪼개기, 야만적 공격자, 보조 손 — because
 * `AttackRiders` named those five and nothing else. Every other rule written as "declare it before the roll" (광란,
 * 대형 무기 달인의 중량 무기 숙달, 돌격자의 돌격 공격, 관통자의 꿰뚫기 …) could be described by a contract and then
 * had nowhere to appear. A contract entry point invoked as `pre-roll-attack` becomes a checkbox here instead: its
 * `damage.apply` is the extra damage, its `resource.change` the cost, its `adjudication.request` the line that says
 * what the player is promising the table.
 *
 * The turn-by-turn bookkeeping ("once per turn") stays the player's, exactly as it already is for 암습 — the app
 * says so on the checkbox rather than pretending to count.
 */
import type { ContentCatalog } from "../catalog/catalog";
import type { DerivedAttack, DerivedCharacter } from "../character/types";
import { ATTACK_INVOCATIONS, characterScope, entryOpen, evaluate, parseTargetMark, type CommonPlayContract, type ConditionDuration, type Scope, type TargetMark } from "./contract";
import { diceRuleOf, type DiceRule } from "./resolve";
import { CONDITION_KO } from "../compendium/spells";
import { attackScopeFilter } from "./contractEffects";
import { featureRuleKey } from "./activation";
import { featureContract } from "./contractActivation";

const DICE_RULE_KO: Record<DiceRule["mode"], (value: number) => string> = {
  "reroll-lowest": (value) => `피해 주사위 ${value}개 다시 굴림`,
  "extra-die": (value) => `피해 주사위 ${value}개 추가`,
  "die-minimum": (value) => `피해 주사위 최소 ${value}`,
};

export interface ContractRider {
  /** The rule key, which is what travels over the wire in `AttackRiders.contracts`. */
  key: string;
  /** The feature or feat this came from. */
  label: string;
  /** What the player is declaring, for the checkbox. */
  hint: string;
  /** R63 (D198): when it is asked — in the dialog before the dice, or in the window a hit opens. */
  moment: "pre-roll" | "on-hit";
  /** Weapon filter, in the same vocabulary `property.modify` uses (`heavy`, `strength-melee`, `unarmed` …). */
  scope?: string;
  oncePerTurn: boolean;
  /** Effects that must already be running for this to be offered (광란 needs 격노 and 무모한 공격). */
  requiresEffects: string[];
  /**
   * Extra damage parts. `type` of `"weapon"` means "the same type this weapon deals"; `factId` means the part only
   * lands when the player ticked that fact (R57 — 돌격자's 1d8 needs the ten feet the scene cannot measure).
   */
  damage: Array<{ formula: string; type: string; factId?: string }>;
  /** R57 (D192): the facts this rider asks the player to confirm, each a checkbox next to it. */
  facts: Array<{ id: string; question: string; auto?: string; /** V4h (D270): a computed fact that falls back to a checkbox when it is false. */ orAsk?: boolean }>;
  /** R60 (D195): what declaring it does to the weapon's own damage dice. */
  dice: DiceRule[];
  /** R94 (D229): a save the target makes when this rider lands, and the condition a failure puts on it (기절 타격). */
  saves: Array<{ ability: string; dc: number; condition: string; duration?: ConditionDuration; repeatSave?: "turn-end"; successMark?: TargetMark }>;
  /** V4b (D264): marks a hit leaves on the target (휘청이는 일격, 무너뜨리는 일격). */
  marks?: TargetMark[];
  /** V4i (D271): conditions a hit puts on the target with no save of its own (마력의 강타's 넘어짐). */
  conditions?: string[];
  resourceId?: string;
  cost: number;
  /** V3e (D259): this rider gives up this many dice of another rider it must be taken with (교활한 일격 from 암습). */
  forgo?: { key: string; dice: number };
  /** V3f (D260): the weapon mastery property this swing uses instead of the weapon's own (전술 통달). */
  mastery?: string;
  /** V3h (D262): declaring this gives up any advantage on the swing (잔혹한 일격). */
  forgoAdvantage?: boolean;
  /** V3h (D262): the weapon's own damage deals this type instead (강화된 타격). */
  damageType?: string;
  /** D324: what the hit gives back to whoever landed it — a formula, or Hit Point Dice to spend (생명 흡수자). */
  heal?: { formula?: string; hitDice?: number };
}

const SAVE_KO: Record<string, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };

/** D307: in a window a hit opens, "the target" is the creature that was hit — `target` means `attack-target` there. */
const hitTarget = (target: string) => target === "attack-target" || target === "target";

/** The formula a `damage.apply` names, with its dice count resolved against the character. */
function formulaOf(operation: { dice?: string; diceCount?: unknown; diceSides?: unknown; amount?: unknown }, scope: Scope): string | undefined {
  const flat = operation.amount === undefined ? undefined : Number(evaluate(operation.amount as never, scope));
  const die = operation.dice?.trim();
  if (!die) return Number.isFinite(flat) && flat ? String(flat) : undefined;
  const count = operation.diceCount === undefined ? undefined : Number(evaluate(operation.diceCount as never, scope));
  const sides = /^(\d*)d(\d+)$/.exec(die);
  if (!sides) return undefined;
  const total = count !== undefined && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : Number(sides[1] || 1);
  if (!total) return undefined;
  const size = operation.diceSides === undefined ? Number(sides[2]) : Number(evaluate(operation.diceSides as never, scope)) || Number(sides[2]);
  return `${total}d${size}${Number.isFinite(flat) && flat ? `${flat > 0 ? "+" : ""}${flat}` : ""}`;
}

/** Every pre-roll or on-hit rider a contract declares, or an empty list when it declares none. */
export function contractRiders(contract: CommonPlayContract, key: string, label: string, scope: Scope): ContractRider[] {
  const riders: ContractRider[] = [];
  for (const entry of contract.entryPoints) {
    if (!ATTACK_INVOCATIONS.has(entry.invocation) || !entry.attack || !entryOpen(entry, scope)) continue;
    const moment = entry.invocation === "on-hit" ? "on-hit" : "pre-roll";
    const rider: ContractRider = {
      key, label, hint: "", moment, ...(entry.attack.scope ? { scope: entry.attack.scope } : {}),
      oncePerTurn: entry.attack.oncePerTurn, requiresEffects: entry.attack.requiresEffects, damage: [], facts: [], dice: [], saves: [], cost: 0,
    };
    const hints: string[] = [];
    // R57 (D192): a fact this entry point declares is a checkbox, not prose; an operation gated on one carries the
    // fact's id rather than being evaluated now, because only the player at the moment knows the answer.
    const declared = new Set(entry.operations.flatMap((operation) => (operation.kind === "adjudication.request" && operation.fact?.at === moment ? [`fact:${operation.fact.id}`] : [])));
    const gatedOn = (operation: { when?: unknown }) => (operation.when && typeof operation.when === "object" && "ref" in operation.when && declared.has(String((operation.when as { ref: string }).ref)) ? String((operation.when as { ref: string }).ref).slice(5) : undefined);
    for (const operation of entry.operations) {
      const factId = gatedOn(operation as { when?: unknown });
      if (!factId && "when" in operation && operation.when && evaluate(operation.when, scope) !== true) continue;
      if (operation.kind === "damage.apply") {
        const formula = formulaOf(operation, scope);
        if (formula) rider.damage.push({ formula, type: operation.damageType, ...(factId ? { factId } : {}) });
      } else if (operation.kind === "resource.change") {
        const amount = Number(evaluate(operation.amount, scope));
        if (Number.isFinite(amount) && amount < 0) { rider.resourceId = operation.resourceId; rider.cost = -amount; }
      } else if (operation.kind === "property.modify" && operation.property === "mastery.replace") {
        if (operation.params?.mastery) { rider.mastery = String(operation.params.mastery); hints.push(`통달 속성을 ${String(operation.params.mastery)}(으)로`); }
      } else if (operation.kind === "property.modify" && operation.property === "rider.forgo-dice") {
        const dice = Number(evaluate(operation.value, scope));
        // V3h (D262): zero dice still ties this rider to the other one (잔혹한 일격's effects need the strike itself).
        if (operation.params?.rider && Number.isFinite(dice)) { rider.forgo = { key: String(operation.params.rider), dice }; if (dice) hints.push(`주사위 ${dice}개 포기`); }
      } else if (operation.kind === "property.modify" && operation.property === "attack-roll.forgo-advantage") {
        rider.forgoAdvantage = true; hints.push("이 공격의 유리 포기");
      } else if (operation.kind === "property.modify" && operation.property === "damage.type.replace") {
        if (operation.params?.type) { rider.damageType = String(operation.params.type); hints.push(`무기 피해 유형을 ${String(operation.params.type)}(으)로`); }
      } else if (operation.kind === "property.modify" && operation.property === "target.mark") {
        const mark = parseTargetMark(operation.params?.mark);
        if (mark) { rider.marks = [...(rider.marks ?? []), mark]; hints.push(`명중하면 대상에 ${mark.name}`); }
      } else if (operation.kind === "property.modify") {
        // R60 (D195): a rule that touches the weapon's own dice rather than adding a part of its own.
        const rule = diceRuleOf(operation.property, Number(evaluate(operation.value, scope)), label);
        if (rule) rider.dice.push(rule);
      } else if (operation.kind === "healing.apply" && !hitTarget(operation.target)) {
        // D324: the hit heals whoever swung — a formula, or a Hit Point Die they choose to spend (생명 흡수자).
        const formula = formulaOf(operation, scope);
        if (operation.hitDice || formula) { rider.heal = { ...(formula ? { formula } : {}), ...(operation.hitDice ? { hitDice: operation.hitDice } : {}) }; hints.push(operation.hitDice ? `히트 다이스 ${operation.hitDice}개를 써서 회복` : `회복 ${formula}`); }
      } else if (operation.kind === "condition.apply" && !operation.save && hitTarget(operation.target)) {
        // V4i (D271): no save at all — the condition simply lands (마력의 강타 knocks it prone).
        rider.conditions = [...(rider.conditions ?? []), operation.condition];
        hints.push(`명중하면 ${CONDITION_KO[operation.condition] ?? operation.condition}`);
      } else if (operation.kind === "condition.apply" && operation.save && hitTarget(operation.target)) {
        const dc = Number(evaluate(operation.save.dc, scope));
        if (Number.isFinite(dc)) rider.saves.push({ ability: operation.save.ability, dc, condition: operation.condition, ...(operation.duration ? { duration: operation.duration } : {}), ...(operation.repeatSave ? { repeatSave: operation.repeatSave } : {}), ...(operation.successMark ? { successMark: operation.successMark } : {}) });
      } else if (operation.kind === "adjudication.request") {
        if (operation.fact?.at === moment) rider.facts.push({ id: operation.fact.id, question: operation.question, ...(operation.fact.auto ? { auto: operation.fact.auto } : {}), ...(operation.fact.orAsk ? { orAsk: true } : {}) });
        else hints.push(operation.question);
      }
    }
    rider.hint = [...rider.damage.map((part) => `피해 +${part.formula}`), ...rider.saves.map((save) => `${SAVE_KO[save.ability] ?? save.ability} 내성 DC ${save.dc} 실패 시 ${CONDITION_KO[save.condition] ?? save.condition}`), ...rider.dice.map((rule) => DICE_RULE_KO[rule.mode](rule.value)), ...hints, ...(rider.oncePerTurn ? ["턴당 한 번"] : [])].join(" · ");
    if (rider.damage.length || rider.dice.length || rider.saves.length || rider.marks?.length || hints.length || rider.facts.length) riders.push(rider);
  }
  return riders;
}

/** Every pre-roll rider this character's own features and feats declare. Built once, at derivation (R49's lesson). */
export function characterRiders(derived: DerivedCharacter, catalog: ContentCatalog): ContractRider[] {
  const scope = characterScope(derived);
  const riders: ContractRider[] = [];
  const seen = new Set<string>();
  for (const feature of derived.features) {
    const key = featureRuleKey(feature.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const contract = featureContract(catalog, key);
    if (contract) riders.push(...contractRiders(contract, key, feature.name, scope));
  }
  return riders;
}

/** Whether this rider may be declared on this weapon at all (its weapon filter). */
export const riderFitsAttack = (rider: ContractRider, attack: DerivedAttack) => {
  if (!rider.scope) return true;
  const filter = attackScopeFilter(rider.scope);
  return filter ? filter(attack) : false;
};

/**
 * The riders the dialog should offer for this swing: the weapon fits, the effects it names are running, and the pool
 * it spends has something left. A rider whose effects are not running is not offered rather than offered and refused.
 */
export function offeredRiders(derived: DerivedCharacter, attack: DerivedAttack, options: { effects?: string[]; left?: (resourceId: string) => number; /** R63 (D198): which window is asking; the dialog before the dice by default. */ moment?: ContractRider["moment"] } = {}): ContractRider[] {
  const running = new Set([...(options.effects ?? []), ...derived.activeEffects.map((effect) => effect.name)]);
  const moment = options.moment ?? "pre-roll";
  return (derived.attackRiders ?? []).filter((rider) => {
    if (rider.moment !== moment) return false;
    if (!riderFitsAttack(rider, attack)) return false;
    if (rider.requiresEffects.some((name) => !running.has(name))) return false;
    if (rider.resourceId && options.left && options.left(rider.resourceId) < rider.cost) return false;
    return true;
  });
}
