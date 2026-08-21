import type { ActionVm, ResolutionView } from "./contracts";

export type VisualDieSides = 4 | 6 | 8 | 10 | 12 | 20;

export const VISUAL_DICE_REPLAY_MS = 1480;
export const VISUAL_DICE_REDUCED_REPLAY_MS = 650;

export interface VisualDieVm {
  value:number;
  sides:VisualDieSides|null;
  authoritative:true;
}

export interface VisualDiceNoticeVm {
  notation:string;
  rawTotal:number;
  modifier:number;
  total:number;
  natural:number|null;
  tone:"normal"|"natural-20"|"natural-1";
}

export interface VisualDiceRollVm {
  resolutionId:string;
  label:string;
  dice:VisualDieVm[];
  legacyAggregate:boolean;
  notice:VisualDiceNoticeVm;
}

const SUPPORTED_SIDES = new Set<VisualDieSides>([4,6,8,10,12,20]);

function parseDiceShape(notation:string|undefined): { count:number;sides:VisualDieSides }|null {
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

function notationFor(dice:VisualDieVm[], fallback:string) {
  const sides=dice[0]?.sides;
  if (sides && dice.every((die)=>die.sides===sides)) return `${dice.length}d${sides}`.replace(/^1d/,"d");
  return fallback;
}

function noticeFor(resolution:ResolutionView,action:ActionVm|undefined,dice:VisualDieVm[],label:string):VisualDiceNoticeVm {
  const physical=dice.filter((die)=>die.sides!==null);
  const legacyAggregate=dice.some((die)=>die.sides===null);
  const rawTotal=physical.length?physical.reduce((sum,die)=>sum+die.value,0):resolution.authoritativeDice.reduce((sum,value)=>sum+value,0);
  let modifier=0;
  let knownTotal:number|undefined;

  if (resolution.rollKind==="attack") {
    modifier=action?.attackBonus??0;
    knownTotal=resolution.attackTotal??resolution.rollTotal;
  } else if (resolution.rollKind==="check") {
    modifier=action?.checkBonus??0;
    knownTotal=resolution.rollTotal;
  } else if (resolution.rollKind==="save") {
    knownTotal=resolution.rollTotal;
    if (knownTotal!==undefined && resolution.authoritativeDice.length===1) modifier=knownTotal-rawTotal;
  } else if (resolution.rollKind==="healing") {
    modifier=legacyAggregate?0:action?.healing?.flat??0;
    knownTotal=resolution.rollTotal;
  } else if (resolution.rollKind==="damage") {
    // Damage stages can retain an earlier attack rollTotal. Never reuse it as damage total.
    modifier=legacyAggregate?0:action?.damage?.[0]?.flat??0;
  }

  if (knownTotal!==undefined && resolution.authoritativeDice.length===1 && (resolution.rollKind==="attack"||resolution.rollKind==="check")) modifier=knownTotal-rawTotal;
  const total=knownTotal??rawTotal+modifier;
  const natural=physical.length===1&&physical[0]?.sides===20?physical[0].value:null;
  return {
    notation:notationFor(dice,label),
    rawTotal,
    modifier,
    total,
    natural,
    tone:natural===20?"natural-20":natural===1?"natural-1":"normal",
  };
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

  if (!dice) dice = values.map((value) => ({ value, sides:null, authoritative:true }));
  return {
    resolutionId:resolution.id,
    label,
    dice,
    legacyAggregate:dice.some((die) => die.sides === null),
    notice:noticeFor(resolution,action,dice,label),
  };
}
