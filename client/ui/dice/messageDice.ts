/**
 * Every roll at the table tumbles as dice (owner request): a chat card the host resolved — an attack, a spell, an
 * official action's check, an initiative or death save — becomes a roll record the dice overlay can animate to the
 * values the host already rolled. Nothing is rerolled here; the dice only show what the card says.
 */
import type { ChatMessage } from "../../campaign/model";
import type { DieResult, RollResult } from "../../character/dice";
import type { AttackResolution, DamageResult } from "../../rules/resolve";

const MAX_DICE = 10;

const sidesOf = (formula: string) => Number(/\d*d(\d+)/.exec(formula)?.[1] ?? 6);
const damageDice = (parts: DamageResult[]): DieResult[] => parts.flatMap((part) => part.dice.map((value) => ({ sides: sidesOf(part.part.formula), value })));
const d20 = (value: number, dropped = false): DieResult => ({ sides: 20, value, ...(dropped ? { dropped: true } : {}) });
const attackDice = (attack: AttackResolution): DieResult[] => [
  ...attack.d20s.map((value, index) => d20(value, attack.d20s.length > 1 && index !== attack.d20s.indexOf(attack.kept))),
  ...(attack.outcome === "hit" || attack.outcome === "crit" ? damageDice(attack.damage) : []),
];
const outcomeKo = (outcome: AttackResolution["outcome"]) => (outcome === "crit" ? "치명타" : outcome === "hit" ? "적중" : outcome === "fumble" ? "자동 실패" : "빗나감");

/** The roll a chat card shows, or null when the card rolled nothing (a whisper, a drawn table row, an effect). */
export function rollOfMessage(message: ChatMessage): RollResult | null {
  const make = (label: string, dice: DieResult[], total: number, modifier: number, note?: string): RollResult | null => {
    if (!dice.length) return null;
    const shown = dice.slice(0, MAX_DICE);
    const natural = shown.find((die) => die.sides === 20 && !die.dropped)?.value;
    return { id: `chat:${message.id}`, label, formula: "", kind: "custom", dice: shown, modifier, total, at: message.at, ...(natural !== undefined ? { natural } : {}), ...(note ? { note } : {}) };
  };
  if ((message.type === "rollresult" || message.type === "gmroll") && message.roll && !message.roll.drawn?.length) {
    const roll = message.roll;
    return make(roll.label || message.content || "굴림", roll.dice.map((die) => ({ sides: die.sides, value: die.value, ...(die.dropped ? { dropped: true } : {}) })), roll.total, roll.modifier);
  }
  if (message.type === "action" && message.action) {
    const attack = message.action;
    const damage = attack.outcome === "hit" || attack.outcome === "crit" ? ` · 피해 ${attack.damageTotal}` : "";
    return make(`${attack.attacker.name} → ${attack.target.name}: ${attack.attack.name}`, attackDice(attack), attack.attackTotal, attack.attack.bonus, `${outcomeKo(attack.outcome)}${damage}`);
  }
  if (message.type === "act" && message.act?.check) {
    const check = message.act.check;
    const dice = check.dropped !== undefined ? [d20(check.d20), d20(check.dropped, true)] : [d20(check.d20)];
    return make(`${message.act.actor.name}: ${message.act.name}`, dice, check.total, check.bonus, check.success === undefined ? undefined : check.success ? "성공" : "실패");
  }
  if (message.type === "spell" && message.spell) {
    const spell = message.spell;
    const dice: DieResult[] = [];
    let damageShown = false;
    for (const row of spell.targets) {
      if (row.attack) dice.push(...attackDice(row.attack));
      if (row.save) dice.push(d20(row.save.d20), ...(row.save.dropped !== undefined ? [d20(row.save.dropped, true)] : []));
      // A save spell rolls its damage once for every target; show those dice once.
      if (row.damage?.damage.length && !damageShown) { dice.push(...damageDice(row.damage.damage)); damageShown = true; }
    }
    const only = spell.targets.length === 1 ? spell.targets[0] : undefined;
    if (only?.save && !only.attack) return make(`${spell.caster.name}: ${spell.name} → ${only.target.name}`, dice, only.save.total, only.save.bonus, only.save.success ? "내성 성공" : "내성 실패");
    if (only?.attack) return make(`${spell.caster.name}: ${spell.name} → ${only.target.name}`, dice, only.attack.attackTotal, only.attack.attack.bonus, outcomeKo(only.attack.outcome));
    const sum = dice.filter((die) => !die.dropped).reduce((total, die) => total + die.value, 0);
    return make(`${spell.caster.name}: ${spell.name}`, dice, sum, 0, spell.targets.length > 1 ? `대상 ${spell.targets.length}` : undefined);
  }
  return null;
}

/** The same dice in the same order: a roll the viewer already watched tumble locally comes back as its chat card. */
export const diceSignature = (dice: Array<{ sides: number; value: number }>) => dice.map((die) => `${die.sides}:${die.value}`).join(",");
