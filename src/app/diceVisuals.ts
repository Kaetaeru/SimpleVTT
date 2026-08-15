import type { ActionVm, ResolutionView } from "./contracts";

export type VisualDieSides = 4 | 6 | 8 | 10 | 12 | 20;

export interface VisualDieVm {
  value:number;
  sides:VisualDieSides|null;
  authoritative:true;
}

export interface VisualDiceRollVm {
  resolutionId:string;
  label:string;
  dice:VisualDieVm[];
  legacyAggregate:boolean;
}

const SUPPORTED_SIDES = new Set<VisualDieSides>([4,6,8,10,12,20]);

function parseDiceShape(notation:string|undefined): { count:number; sides:VisualDieSides }|null {
  if (!notation) return null;
  const match = notation.replace(/\s+/g,"").match(/^(\d+)d(\d+)/i);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]) as VisualDieSides;
  if (!Number.isInteger(count) || count <= 0 || !SUPPORTED_SIDES.has(sides)) return null;
  return { count, sides };
}

function typedDice(values:number[], shape:{count:number;sides:VisualDieSides}|null): VisualDieVm[]|null {
  if (!shape || values.length !== shape.count) return null;
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > shape.sides)) return null;
  return values.map((value) => ({ value, sides:shape.sides, authoritative:true }));
}

function d20Dice(values:number[]): VisualDieVm[]|null {
  if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 20)) return null;
  return values.map((value) => ({ value, sides:20, authoritative:true }));
}

export function buildVisualDiceRoll(resolution:ResolutionView, action:ActionVm|undefined): VisualDiceRollVm {
  const values = [...resolution.authoritativeDice];
  let dice:VisualDieVm[]|null = null;
  let label = "권위 주사위";

  if (resolution.stage === "save-animation" || resolution.rollKind === "attack" || resolution.rollKind === "check" || resolution.rollKind === "save") {
    dice = d20Dice(values);
    label = resolution.stage === "save-animation" || resolution.rollKind === "save" ? "내성 굴림" : resolution.rollKind === "attack" ? "명중 굴림" : "능력 판정";
  }

  if (resolution.rollKind === "healing") {
    const shape = parseDiceShape(action?.healing?.dice);
    dice = typedDice(values,shape);
    label = action?.healing?.dice ? `회복 ${action.healing.dice}` : "회복 굴림";
  }

  if (resolution.rollKind === "damage" || resolution.stage === "damage-animation") {
    const shape = parseDiceShape(action?.damage?.[0]?.dice);
    dice = typedDice(values,shape);
    label = action?.damage?.[0]?.dice ? `피해 ${action.damage[0].dice}` : "피해 굴림";
  }

  if (!dice) {
    dice = values.map((value) => ({ value, sides:null, authoritative:true }));
  }

  return {
    resolutionId:resolution.id,
    label,
    dice,
    legacyAggregate:dice.some((die) => die.sides === null),
  };
}
