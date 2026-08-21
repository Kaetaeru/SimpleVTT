import type { VisualDieSides, VisualDiceRollVm } from "./diceVisuals";

export const LOCAL_DICE_PRESENT_EVENT = "simplevtt:local-dice-presentation";

export type LocalDicePresentation = {
  id: string;
  label: string;
  dice: Array<{ value: number; sides: VisualDieSides }>;
  modifier: number;
  total: number;
  note?: string;
};

function notationFor(dice: LocalDicePresentation["dice"]) {
  const first = dice[0];
  if (!first) return "dice";
  if (dice.every((die) => die.sides === first.sides)) {
    return `${dice.length}d${first.sides}`.replace(/^1d/, "d");
  }
  return dice.map((die) => `d${die.sides}`).join(" + ");
}

export function buildLocalDiceVisualRoll(roll: LocalDicePresentation): VisualDiceRollVm {
  const rawTotal = roll.total - roll.modifier;
  const d20Roll = roll.dice.length > 0 && roll.dice.every((die) => die.sides === 20);
  const natural = d20Roll && rawTotal >= 1 && rawTotal <= 20 ? rawTotal : null;

  return {
    resolutionId: `local:${roll.id}`,
    label: roll.label,
    dice: roll.dice.map((die) => ({ ...die, authoritative: true as const })),
    legacyAggregate: false,
    notice: {
      notation: notationFor(roll.dice),
      rawTotal,
      modifier: roll.modifier,
      total: roll.total,
      natural,
      tone: natural === 20 ? "natural-20" : natural === 1 ? "natural-1" : "normal",
    },
  };
}

export function presentLocalDiceRoll(roll: LocalDicePresentation) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<VisualDiceRollVm>(LOCAL_DICE_PRESENT_EVENT, {
    detail: buildLocalDiceVisualRoll(roll),
  }));
}
