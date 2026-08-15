import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";

function signed(value:number) {
  return value>=0 ? `+${value}` : String(value);
}

export function ConcentrationSaveBridge() {
  const { snapshot,submitConcentrationSaveD20 }=useSimpleVtt();
  const resolution=snapshot?.resolution ?? null;
  const save=resolution?.concentrationSave;
  const pending=Boolean(
    resolution
    && save
    && resolution.stage==="save-animation"
    && resolution.authoritativeDice.length===0
    && save.natural===undefined,
  );
  const completed=Boolean(resolution && save?.natural!==undefined && resolution.stage==="complete");
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [face,setFace]=useState("10");

  useEffect(() => {
    setFace("10");
  },[resolution?.id]);

  useEffect(() => {
    if (!pending && !completed) {
      setHost(null);
      return;
    }
    let frame=0;
    let hiddenDice:HTMLElement|null=null;
    const connect=() => {
      const drawer=document.querySelector<HTMLElement>(".resolution-drawer");
      if (!drawer) {
        frame=requestAnimationFrame(connect);
        return;
      }
      if (pending) {
        hiddenDice=drawer.querySelector<HTMLElement>(".dice-animation");
        if (hiddenDice) hiddenDice.hidden=true;
      }
      setHost(drawer);
    };
    frame=requestAnimationFrame(connect);
    return () => {
      cancelAnimationFrame(frame);
      if (hiddenDice) hiddenDice.hidden=false;
      setHost(null);
    };
  },[pending,completed,resolution?.id]);

  const numericFace=useMemo(() => Number(face),[face]);
  const validFace=Number.isInteger(numericFace) && numericFace>=1 && numericFace<=20;
  if (!resolution || !save || !host || (!pending && !completed)) return null;

  if (pending) {
    return createPortal(
      <section className="interrupt-prompt" aria-label="집중 내성 입력" data-concentration-save="pending">
        <span className="badge warning">Concentration</span>
        <h3>{save.targetName} · 건강(Constitution) 내성</h3>
        <div className="review-rows">
          <div><span>기본 내성 수정치</span><strong>{signed(save.modifier)}</strong></div>
          <div><span>수정치 출처</span><strong>{save.modifierSource}</strong></div>
          <div><span>판정 DC</span><strong>피해 적용 시 Rules Domain 계산</strong></div>
        </div>
        <label className="field">
          <span>실제 d20 면</span>
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={face}
            onChange={(event)=>setFace(event.target.value)}
            aria-label="집중 내성 d20 면"
          />
        </label>
        <p>이 값을 제출하기 전에는 피해, 행동경제, 집중, 효과가 커밋되지 않습니다.</p>
        <div className="drawer-actions">
          <button
            className="primary"
            disabled={!validFace}
            onClick={()=>void submitConcentrationSaveD20(numericFace)}
          >
            d20 제출
          </button>
        </div>
      </section>,
      host,
    );
  }

  return createPortal(
    <section className="save-results" aria-label="집중 내성 결과" data-concentration-save="result">
      <div>
        <strong>{save.targetName} · 집중 내성</strong>
        <span>d20 {save.natural} {signed(save.modifier)} = {save.total} vs DC {save.dc}</span>
        <b className={save.outcome==="성공" ? "good-text" : "bad-text"}>{save.outcome}</b>
      </div>
    </section>,
    host,
  );
}
