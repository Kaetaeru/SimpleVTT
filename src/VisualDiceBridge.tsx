import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { buildVisualDiceRoll, type VisualDieSides, type VisualDieVm, type VisualDiceRollVm } from "./app/diceVisuals";

const ANIMATED_STAGES = new Set(["roll-animation","save-animation","damage-animation"]);

type RenderDie = Pick<VisualDieVm,"value"|"sides">;

function VisualDie({ die, index, compact = false }: { die:RenderDie; index:number; compact?:boolean }) {
  if (die.sides === null) {
    return <div className={`visual-die-scene visual-die-legacy ${compact ? "compact" : ""}`} aria-label={`집계 결과 ${die.value}`}>
      <div className="visual-die-legacy-value">{die.value}</div>
      <small>aggregate</small>
    </div>;
  }

  const style = { "--die-index":index } as CSSProperties;
  return <div className={`visual-die-scene visual-die-d${die.sides} ${compact ? "compact" : ""}`} aria-label={`d${die.sides} 결과 ${die.value}`}>
    <div className={`visual-die-shell d${die.sides}`} style={style}>
      {Array.from({ length:6 },(_,facet) => <i className={`visual-die-facet f${facet}`} key={facet} aria-hidden="true" />)}
      <span className="visual-die-value">{die.value}</span>
    </div>
    <small>d{die.sides}</small>
  </div>;
}

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
  return <section className={`visual-dice-stage ${compact ? "compact" : ""} ${className}`.trim()} aria-label={`${label} 주사위`}>
    <div className="visual-dice-stage-head"><strong>{label}</strong><span>{caption}</span></div>
    <div className="visual-dice-table" role="img" aria-label={dice.map((die) => die.sides ? `d${die.sides} ${die.value}` : `결과 ${die.value}`).join(", ")}>
      {dice.map((die,index) => <VisualDie die={die} index={index} compact={compact} key={`${label}:${index}:${die.value}:${die.sides ?? "aggregate"}`} />)}
    </div>
  </section>;
}

type DiceReplay = {
  key:string;
  roll:VisualDiceRollVm;
};

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

  const roll = useMemo(
    () => resolution ? buildVisualDiceRoll(resolution,action) : null,
    [resolution,action],
  );

  useEffect(() => {
    if (!animated || !roll || !resolution) return;
    const key = `${resolution.id}:${resolution.stage}:${resolution.authoritativeDice.join(",")}`;
    setReplay({ key, roll });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    timerRef.current = window.setTimeout(() => {
      setReplay((current) => current?.key === key ? null : current);
      timerRef.current = null;
    }, reduced ? 900 : 1550);
  },[animated,roll,resolution]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  },[]);

  if (!replay) return null;

  return createPortal(
    <div className="visual-dice-overlay" data-resolution-id={replay.roll.resolutionId}>
      <VisualDiceTray
        key={replay.key}
        label={replay.roll.label}
        dice={replay.roll.dice}
        caption="authoritative result · visual replay"
        className="visual-dice-overlay-card"
      />
      {replay.roll.legacyAggregate && <small className="visual-dice-legacy-note">개별 면 값이 없는 legacy aggregate는 3D 주사위로 위장하지 않습니다.</small>}
    </div>,
    document.body,
  );
}
