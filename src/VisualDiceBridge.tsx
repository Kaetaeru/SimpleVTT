import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { buildVisualDiceRoll, type VisualDieVm } from "./app/diceVisuals";

const ANIMATED_STAGES = new Set(["roll-animation","save-animation","damage-animation"]);

function VisualDie({ die, index }: { die:VisualDieVm; index:number }) {
  if (die.sides === null) {
    return <div className="visual-die-scene visual-die-legacy" aria-label={`집계 결과 ${die.value}`}>
      <div className="visual-die-legacy-value">{die.value}</div>
      <small>aggregate</small>
    </div>;
  }

  const style = { "--die-index":index } as CSSProperties;
  return <div className={`visual-die-scene visual-die-d${die.sides}`} aria-label={`d${die.sides} 결과 ${die.value}`}>
    <div className={`visual-die-shell d${die.sides}`} style={style}>
      {Array.from({ length:6 },(_,facet) => <i className={`visual-die-facet f${facet}`} key={facet} aria-hidden="true" />)}
      <span className="visual-die-value">{die.value}</span>
    </div>
    <small>d{die.sides}</small>
  </div>;
}

export function VisualDiceBridge() {
  const { snapshot } = useSimpleVtt();
  const resolution = snapshot?.resolution ?? null;
  const animated = Boolean(resolution && ANIMATED_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);
  const [host,setHost] = useState<HTMLElement|null>(null);

  const action = useMemo(() => {
    if (!snapshot || !resolution) return undefined;
    return Object.values(snapshot.scene.actionsByActor).flat().find((candidate) => candidate.id === resolution.actionId);
  },[snapshot,resolution]);

  const roll = useMemo(
    () => resolution ? buildVisualDiceRoll(resolution,action) : null,
    [resolution,action],
  );

  useEffect(() => {
    if (!animated) {
      setHost(null);
      return;
    }
    let frame = 0;
    let mounted:HTMLElement|null = null;
    const connect = () => {
      const next = document.querySelector<HTMLElement>(".dice-animation");
      if (!next) {
        frame = requestAnimationFrame(connect);
        return;
      }
      mounted = next;
      next.classList.add("visual-dice-mounted");
      setHost(next);
    };
    frame = requestAnimationFrame(connect);
    return () => {
      cancelAnimationFrame(frame);
      mounted?.classList.remove("visual-dice-mounted");
      setHost(null);
    };
  },[animated,resolution?.id,resolution?.stage]);

  if (!animated || !roll || !host) return null;

  return createPortal(
    <section className="visual-dice-stage" aria-label={`${roll.label} 3D 주사위`} data-resolution-id={roll.resolutionId}>
      <div className="visual-dice-stage-head">
        <strong>{roll.label}</strong>
        <span>authoritative result · visual replay</span>
      </div>
      <div className="visual-dice-table" role="img" aria-label={roll.dice.map((die) => die.sides ? `d${die.sides} ${die.value}` : `결과 ${die.value}`).join(", ")}>
        {roll.dice.map((die,index) => <VisualDie die={die} index={index} key={`${roll.resolutionId}:${index}:${die.value}`} />)}
      </div>
      {roll.legacyAggregate && <small className="visual-dice-legacy-note">개별 면 값이 없는 legacy aggregate는 3D 주사위로 위장하지 않습니다.</small>}
    </section>,
    host,
  );
}
