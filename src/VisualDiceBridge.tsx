import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { buildVisualDiceRoll, type VisualDieSides, type VisualDiceRollVm } from "./app/diceVisuals";
import { PhysicsDice3D, type PhysicsDie } from "./PhysicsDice3D";

const ANIMATED_STAGES = new Set(["roll-animation","save-animation","damage-animation"]);

export function VisualDiceTray({
  label,
  dice,
  caption = "dice result",
  compact = false,
  className = "",
}: {
  label:string;
  dice:Array<{ value:number; sides:VisualDieSides|null }>;
  caption?:string;
  compact?:boolean;
  className?:string;
}) {
  const physical=dice.filter((die):die is {value:number;sides:4|6|8|10|12|20}=>die.sides!==null) as PhysicsDie[];
  const aggregate=dice.filter((die)=>die.sides===null);
  const reduced=typeof window!=="undefined"&&(window.matchMedia("(prefers-reduced-motion: reduce)").matches||document.documentElement.dataset.motion==="reduced");
  return <section className={`visual-dice-stage physics-enabled ${compact ? "compact" : ""} ${className}`.trim()} aria-label={`${label} 주사위`}>
    <div className="visual-dice-stage-head"><strong>{label}</strong><span>{caption}</span></div>
    <div className="visual-dice-table" role="group" aria-label={dice.map((die) => die.sides ? `d${die.sides} ${die.value}` : `결과 ${die.value}`).join(", ")}>
      {physical.length>0&&<PhysicsDice3D dice={physical} compact={compact} reducedMotion={reduced}/>} 
      {aggregate.map((die,index)=><div className="visual-die-legacy" key={`${label}:aggregate:${index}:${die.value}`} aria-label={`집계 결과 ${die.value}`}><div className="visual-die-legacy-value">{die.value}</div><small>aggregate</small></div>)}
    </div>
  </section>;
}

type DiceReplay = { key:string; roll:VisualDiceRollVm };

export function VisualDiceBridge() {
  const { snapshot } = useSimpleVtt();
  const resolution = snapshot?.resolution ?? null;
  const animated = Boolean(resolution && ANIMATED_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);
  const [replay,setReplay] = useState<DiceReplay|null>(null);
  const timerRef = useRef<number|null>(null);

  const action = useMemo(() => {
    if (!snapshot || !resolution) return undefined;
    return Object.values(snapshot.scene.actionsByActor).flat().find((candidate) => candidate.id === resolution.actionId);
  },[snapshot,resolution]);

  const roll = useMemo(() => resolution ? buildVisualDiceRoll(resolution,action) : null,[resolution,action]);

  useEffect(() => {
    if (!animated || !roll || !resolution) return;
    const key = `${resolution.id}:${resolution.stage}:${resolution.authoritativeDice.join(",")}`;
    setReplay({ key, roll });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    timerRef.current = window.setTimeout(() => {
      setReplay((current) => current?.key === key ? null : current);
      timerRef.current = null;
    }, reduced ? 1100 : 2700);
  },[animated,roll,resolution]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); },[]);
  if (!replay) return null;

  return createPortal(
    <div className="visual-dice-overlay" data-resolution-id={replay.roll.resolutionId}>
      <VisualDiceTray key={replay.key} label={replay.roll.label} dice={replay.roll.dice} caption="authoritative result · physics replay" className="visual-dice-overlay-card"/>
      {replay.roll.legacyAggregate && <small className="visual-dice-legacy-note">개별 면 값이 없는 legacy aggregate는 물리 주사위 결과로 위장하지 않습니다.</small>}
    </div>,
    document.body,
  );
}
