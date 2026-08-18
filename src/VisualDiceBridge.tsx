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

function modifierText(value:number) {
  if (value>0) return `+ ${value}`;
  if (value<0) return `− ${Math.abs(value)}`;
  return "+ 0";
}

export function VisualDiceBridge() {
  const { snapshot } = useSimpleVtt();
  const resolution = snapshot?.resolution ?? null;
  const animated = Boolean(resolution && ANIMATED_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);
  const [replay,setReplay] = useState<DiceReplay|null>(null);
  const [resolved,setResolved] = useState(false);
  const [reelValue,setReelValue] = useState<number|null>(null);
  const hideTimerRef = useRef<number|null>(null);
  const settleTimerRef = useRef<number|null>(null);
  const reelTimerRef = useRef<number|null>(null);

  const action = useMemo(() => {
    if (!snapshot || !resolution) return undefined;
    return Object.values(snapshot.scene.actionsByActor).flat().find((candidate) => candidate.id === resolution.actionId);
  },[snapshot,resolution]);

  const roll = useMemo(() => resolution ? buildVisualDiceRoll(resolution,action) : null,[resolution,action]);

  useEffect(() => {
    if (!animated || !roll || !resolution) return;
    const key = `${resolution.id}:${resolution.stage}:${resolution.authoritativeDice.join(",")}`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    const physical=roll.dice.filter((die)=>die.sides!==null);
    const upper=Math.max(2,physical.reduce((sum,die)=>sum+(die.sides??0),0)||Math.max(2,roll.notice.rawTotal));

    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);

    setReplay({ key, roll });
    setResolved(false);
    setReelValue(null);
    reelTimerRef.current=window.setInterval(()=>setReelValue(1+Math.floor(Math.random()*upper)),42);

    const settleAt=reduced?180:1080;
    settleTimerRef.current=window.setTimeout(()=>{
      if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);
      reelTimerRef.current=null;
      setReelValue(roll.notice.rawTotal);
      setResolved(true);
      settleTimerRef.current=null;
    },settleAt);

    hideTimerRef.current=window.setTimeout(()=>{
      setReplay((current) => current?.key === key ? null : current);
      setResolved(false);
      hideTimerRef.current=null;
    },reduced?650:1480);
  },[animated,roll,resolution]);

  useEffect(() => () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);
  },[]);

  if (!replay) return null;
  const physical=replay.roll.dice.filter((die):die is {value:number;sides:4|6|8|10|12|20}=>die.sides!==null) as PhysicsDie[];
  const tone=resolved?replay.roll.notice.tone:"normal";

  return createPortal(
    <div className="visual-dice-overlay v09" data-resolution-id={replay.roll.resolutionId} data-phase={resolved?"resolved":"rolling"}>
      {physical.length>0&&<PhysicsDice3D key={replay.key} dice={physical} cinematic reducedMotion={false} className="visual-dice-world"/>}
      <div className={`visual-roll-notice ${resolved?"resolved rolling-complete":"rolling"} ${tone}`} role="status" aria-live="polite">
        <div className="visual-roll-notice-core">
          <span className="visual-roll-label">{replay.roll.label}</span>
          <span className="visual-roll-die">{replay.roll.notice.notation}</span>
          <span className="visual-roll-reel" aria-label={resolved?`주사위 결과 ${replay.roll.notice.rawTotal}`:"주사위 굴리는 중"}><b>{reelValue??"—"}</b></span>
        </div>
        <div className="visual-roll-notice-extension">
          <span className="visual-roll-formula"><b>{replay.roll.notice.notation} {replay.roll.notice.rawTotal}</b><small>{modifierText(replay.roll.notice.modifier)} 수정치</small></span>
          <span className="visual-roll-equals">=</span>
          <strong className="visual-roll-total">{replay.roll.notice.total}</strong>
        </div>
        {resolved&&tone!=="normal"&&<span className="visual-roll-natural">{tone==="natural-20"?"NATURAL 20":"NATURAL 1"}</span>}
      </div>
      {replay.roll.legacyAggregate&&<small className="visual-dice-legacy-note overlay-note">개별 면 값이 없는 legacy aggregate는 3D 주사위 면으로 위장하지 않습니다.</small>}
    </div>,
    document.body,
  );
}
