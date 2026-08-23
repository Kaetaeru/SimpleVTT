import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { buildVisualDiceRoll, VISUAL_DICE_REDUCED_REPLAY_MS, VISUAL_DICE_REPLAY_MS, VISUAL_DICE_RESULT_FADE_MS, VISUAL_DICE_RESULT_HOLD_MS, type VisualDieSides, type VisualDiceRollVm } from "./app/diceVisuals";
import { isReducedMotionPreferred } from "./app/motionPreferences";
import { PhysicsDice3D, type PhysicsDie } from "./PhysicsDice3D";

const ANIMATED_STAGES = new Set(["roll-animation","save-animation","damage-animation"]);

export function VisualDiceTray({
  label,
  dice,
  caption = "dice result",
  compact = false,
  screenTable = false,
  className = "",
}: {
  label:string;
  dice:Array<{ value:number; sides:VisualDieSides|null }>;
  caption?:string;
  compact?:boolean;
  screenTable?:boolean;
  className?:string;
}) {
  const physical=dice.filter((die):die is {value:number;sides:4|6|8|10|12|20}=>die.sides!==null) as PhysicsDie[];
  const aggregate=dice.filter((die)=>die.sides===null);
  const reduced=typeof window!=="undefined"&&isReducedMotionPreferred();
  const signature=dice.map((die)=>`${die.sides??"aggregate"}:${die.value}`).join("|");
  const [screenReplayVisible,setScreenReplayVisible]=useState(screenTable&&physical.length>0);

  useEffect(()=>{
    if (!screenTable||physical.length===0) return;
    setScreenReplayVisible(true);
    const timer=window.setTimeout(()=>setScreenReplayVisible(false),reduced?VISUAL_DICE_REDUCED_REPLAY_MS:VISUAL_DICE_REPLAY_MS);
    return ()=>window.clearTimeout(timer);
  },[screenTable,signature,reduced,physical.length]);

  if (screenTable) return <>
    {screenReplayVisible&&physical.length>0&&createPortal(
      <div className="visual-dice-overlay v09 standalone-table" data-phase="rolling">
        <PhysicsDice3D key={signature} dice={physical} cinematic reducedMotion={reduced} className="visual-dice-world"/>
      </div>,
      document.body,
    )}
    {aggregate.length>0&&<small className="visual-dice-legacy-note">개별 면 값이 없는 집계 결과는 물리 주사위로 표시하지 않습니다.</small>}
  </>;

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

export type StandaloneDicePresentationRoll = {
  id:string;
  label:string;
  dice:Array<{value:number;sides:4|6|8|10|12|20}>;
  modifier:number;
  total:number;
  note?:string;
};

export function StandaloneDicePresentation({roll,onFinished}:{roll:StandaloneDicePresentationRoll;onFinished?:()=>void}) {
  const reduced=typeof window!=="undefined"&&isReducedMotionPreferred();
  const [resolved,setResolved]=useState(false);
  const [fading,setFading]=useState(false);
  const [reelValue,setReelValue]=useState<number|null>(null);
  const reelTimerRef=useRef<number|null>(null);
  const fallbackTimerRef=useRef<number|null>(null);
  const fadeTimerRef=useRef<number|null>(null);
  const hideTimerRef=useRef<number|null>(null);
  const onFinishedRef=useRef(onFinished);
  onFinishedRef.current=onFinished;

  const rawTotal=roll.total-roll.modifier;
  const sides=roll.dice[0]?.sides;
  const notation=sides&&roll.dice.every((die)=>die.sides===sides)
    ? `${roll.dice.length===1?"":roll.dice.length}d${sides}`
    : roll.dice.map((die)=>`d${die.sides}`).join(" + ");
  const natural=sides===20&&roll.dice.every((die)=>die.sides===20)?rawTotal:null;
  const tone=resolved?(natural===20?"natural-20":natural===1?"natural-1":"normal"):"normal";

  const scheduleExit=useCallback(()=>{
    if (fadeTimerRef.current!==null) window.clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current!==null) window.clearTimeout(hideTimerRef.current);
    fadeTimerRef.current=window.setTimeout(()=>{
      setFading(true);
      fadeTimerRef.current=null;
      hideTimerRef.current=window.setTimeout(()=>{
        hideTimerRef.current=null;
        onFinishedRef.current?.();
      },VISUAL_DICE_RESULT_FADE_MS);
    },VISUAL_DICE_RESULT_HOLD_MS);
  },[]);

  const settle=useCallback(()=>{
    if (reelTimerRef.current!==null) window.clearInterval(reelTimerRef.current);
    reelTimerRef.current=null;
    if (fallbackTimerRef.current!==null) window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current=null;
    setReelValue(rawTotal);
    setResolved(true);
    scheduleExit();
  },[rawTotal,scheduleExit]);

  useEffect(()=>{
    if (reelTimerRef.current!==null) window.clearInterval(reelTimerRef.current);
    if (fallbackTimerRef.current!==null) window.clearTimeout(fallbackTimerRef.current);
    if (fadeTimerRef.current!==null) window.clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current!==null) window.clearTimeout(hideTimerRef.current);
    setResolved(false);
    setFading(false);
    setReelValue(null);
    const upper=Math.max(2,roll.dice.reduce((sum,die)=>sum+die.sides,0));
    reelTimerRef.current=window.setInterval(()=>setReelValue(1+Math.floor(Math.random()*upper)),42);
    if (roll.dice.length===0) fallbackTimerRef.current=window.setTimeout(settle,reduced?180:1080);
    return ()=>{
      if (reelTimerRef.current!==null) window.clearInterval(reelTimerRef.current);
      if (fallbackTimerRef.current!==null) window.clearTimeout(fallbackTimerRef.current);
      if (fadeTimerRef.current!==null) window.clearTimeout(fadeTimerRef.current);
      if (hideTimerRef.current!==null) window.clearTimeout(hideTimerRef.current);
    };
  },[roll.id,roll.dice,reduced,settle]);

  const physical=roll.dice as PhysicsDie[];
  return createPortal(
    <div className={`visual-dice-overlay v09 standalone-roll ${fading?"is-fading":""}`.trim()} data-phase={resolved?"resolved":"rolling"}>
      {physical.length>0&&<PhysicsDice3D key={roll.id} dice={physical} cinematic reducedMotion={reduced} className="visual-dice-world" onResolved={settle}/>}
      <div className={`visual-roll-notice ${resolved?"resolved rolling-complete":"rolling"} ${tone}`} role="status" aria-live="polite">
        <div className="visual-roll-notice-core">
          <span className="visual-roll-label">{roll.label}</span>
          <span className="visual-roll-die">{notation}</span>
          <span className="visual-roll-reel" aria-label={resolved?`주사위 결과 ${rawTotal}`:"주사위 굴리는 중"}><b>{reelValue??"—"}</b></span>
        </div>
        <div className="visual-roll-notice-extension">
          <span className="visual-roll-formula"><b>{notation} {rawTotal}</b><small>{modifierText(roll.modifier)} 수정치{roll.note?` · ${roll.note}`:""}</small></span>
          <span className="visual-roll-equals">=</span>
          <strong className="visual-roll-total">{roll.total}</strong>
        </div>
        {resolved&&tone!=="normal"&&<span className="visual-roll-natural">{tone==="natural-20"?"NATURAL 20":"NATURAL 1"}</span>}
      </div>
    </div>,
    document.body,
  );
}

export function VisualDiceBridge() {
  const { snapshot } = useSimpleVtt();
  const resolution = snapshot?.resolution ?? null;
  const animated = Boolean(resolution && ANIMATED_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);
  const [replay,setReplay] = useState<DiceReplay|null>(null);
  const [resolved,setResolved] = useState(false);
  const [fading,setFading] = useState(false);
  const [reelValue,setReelValue] = useState<number|null>(null);
  const fadeTimerRef = useRef<number|null>(null);
  const hideTimerRef = useRef<number|null>(null);
  const settleTimerRef = useRef<number|null>(null);
  const reelTimerRef = useRef<number|null>(null);
  const activeReplayKeyRef = useRef<string|null>(null);

  const scheduleReplayExit = useCallback((key:string) => {
    if (fadeTimerRef.current!==null) window.clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current!==null) window.clearTimeout(hideTimerRef.current);
    fadeTimerRef.current=window.setTimeout(()=>{
      if (activeReplayKeyRef.current!==key) return;
      setFading(true);
      fadeTimerRef.current=null;
      hideTimerRef.current=window.setTimeout(()=>{
        if (activeReplayKeyRef.current!==key) return;
        setReplay((current)=>current?.key===key?null:current);
        activeReplayKeyRef.current=null;
        setResolved(false);
        setFading(false);
        hideTimerRef.current=null;
      },VISUAL_DICE_RESULT_FADE_MS);
    },VISUAL_DICE_RESULT_HOLD_MS);
  },[]);

  const settleReplay = useCallback((key:string,rawTotal:number) => {
    if (activeReplayKeyRef.current!==key) return;
    if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);
    reelTimerRef.current=null;
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current=null;
    setReelValue(rawTotal);
    setResolved(true);
    scheduleReplayExit(key);
  },[scheduleReplayExit]);

  const action = useMemo(() => {
    if (!snapshot || !resolution) return undefined;
    return Object.values(snapshot.scene.actionsByActor).flat().find((candidate) => candidate.id === resolution.actionId)
      ?? (snapshot.resolutionPresentation?.resolutionId===resolution.id?snapshot.resolutionPresentation.action:undefined);
  },[snapshot,resolution]);

  const roll = useMemo(() => resolution ? buildVisualDiceRoll(resolution,action) : null,[resolution,action]);

  useEffect(() => {
    if (!animated || !roll || !resolution) return;
    const key = `${resolution.id}:${resolution.stage}:${resolution.authoritativeDice.join(",")}`;
    const reduced = isReducedMotionPreferred();
    const physical=roll.dice.filter((die)=>die.sides!==null);
    const upper=Math.max(2,physical.reduce((sum,die)=>sum+(die.sides??0),0)||Math.max(2,roll.notice.rawTotal));

    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);

    activeReplayKeyRef.current=key;
    setReplay({ key, roll });
    setResolved(false);
    setFading(false);
    setReelValue(null);
    reelTimerRef.current=window.setInterval(()=>setReelValue(1+Math.floor(Math.random()*upper)),42);

    // Structured physical dice resolve the reel from the actual convergence
    // callback. Legacy aggregate-only results retain a timed text fallback.
    if (physical.length===0) {
      const settleAt=reduced?180:1080;
      settleTimerRef.current=window.setTimeout(()=>settleReplay(key,roll.notice.rawTotal),settleAt);
    }

  },[animated,roll,resolution,settleReplay]);

  useEffect(() => () => {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    if (reelTimerRef.current !== null) window.clearInterval(reelTimerRef.current);
    activeReplayKeyRef.current=null;
  },[]);

  const physical=useMemo(()=>replay
    ? replay.roll.dice.filter((die):die is {value:number;sides:4|6|8|10|12|20;authoritative:true}=>die.sides!==null) as PhysicsDie[]
    : [],[replay]);
  if (!replay) return null;
  const tone=resolved?replay.roll.notice.tone:"normal";
  const reduced=typeof window!=="undefined"&&isReducedMotionPreferred();

  return createPortal(
    <div className={`visual-dice-overlay v09 ${fading?"is-fading":""}`.trim()} data-resolution-id={replay.roll.resolutionId} data-phase={resolved?"resolved":"rolling"}>
      {physical.length>0&&<PhysicsDice3D key={replay.key} dice={physical} cinematic reducedMotion={reduced} className="visual-dice-world" onResolved={()=>settleReplay(replay.key,replay.roll.notice.rawTotal)}/>}
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
