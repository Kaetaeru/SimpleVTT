import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { projectedCharacterById } from "./app/characterSessionProjectionRegistry";
import { mockAdapter } from "./app/mockAdapter";
import "./session-main-focus.css";
import "./session-integrated-reference-chrome.css";

export function SessionMainFocus({ role, lastRollActorId, lastRollHidden=false, onDismissLastRoll }: { role: "player" | "dm"; lastRollActorId:string|null; lastRollHidden?:boolean; onDismissLastRoll?():Promise<unknown> }) {
  const { snapshot } = useSimpleVtt();
  const [dismissing,setDismissing]=useState(false);
  const [dismissError,setDismissError]=useState("");
  if (!snapshot) return null;

  if (snapshot.sessionMode === "initiative") {
    const actor=snapshot.scene.entities.find((entity)=>entity.id===snapshot.scene.currentActorId)??null;
    const character=actor?.id===snapshot.activeCharacter.id?snapshot.activeCharacter:actor?projectedCharacterById(mockAdapter,actor.id)?.sheet:undefined;
    const portrait=sanitizeCharacterPortrait(character?.portrait);
    const initials=actor?.name.trim().slice(0,2)||"?";
    return <section className="session-main-focus-state session-initiative-focus" aria-label="이니셔티브 플레이 공간">
      {actor?<div className="session-last-roll-actor session-current-turn-actor" aria-label={`현재 턴 액터 ${actor.name}`}>
        <div className="session-last-roll-art">{portrait?<img src={portrait.asset.dataUrl} alt={`${actor.name} 일러스트`} style={{objectPosition:`${portrait.focalX*100}% ${portrait.focalY*100}%`}}/>:<span aria-hidden="true"><i/><b>{initials}</b></span>}</div>
        <div className="session-last-roll-caption"><small>CURRENT TURN · ROUND {snapshot.scene.round}</small><strong>{actor.name}</strong></div>
      </div>:<div className="session-freeform-empty"><span className="eyebrow accent">이니셔티브</span><strong>현재 턴 액터 없음</strong></div>}
    </section>;
  }

  if(lastRollHidden)return <section className="session-main-focus-state session-freeform-focus" data-last-roll-hidden="true" aria-label="Last Roll 숨김"/>;
  const actor=snapshot.scene.entities.find((entity)=>entity.id===lastRollActorId)??null;
  const character=actor?.id===snapshot.activeCharacter.id?snapshot.activeCharacter:actor?projectedCharacterById(mockAdapter,actor.id)?.sheet:undefined;
  const portrait=sanitizeCharacterPortrait(character?.portrait);
  const initials=actor?.name.trim().slice(0,2)||"";
  const canDismiss=role==="dm"&&Boolean(actor)&&Boolean(onDismissLastRoll);
  const dismiss=async()=>{if(!canDismiss||dismissing)return;setDismissing(true);setDismissError("");try{await onDismissLastRoll?.();}catch(reason){setDismissError(reason instanceof Error?reason.message:String(reason));}finally{setDismissing(false);}};
  const actorContent=actor?<>
    <div className="session-last-roll-art">{portrait?<img src={portrait.asset.dataUrl} alt={`${actor.name} 일러스트`} style={{objectPosition:`${portrait.focalX*100}% ${portrait.focalY*100}%`}}/>:<span aria-hidden="true"><i/><b>{initials}</b></span>}</div>
    <div className="session-last-roll-caption"><small>{canDismiss?"LAST ROLL · 클릭해 닫기":"LAST ROLL"}</small><strong>{actor.name}</strong></div>
  </>:null;
  return <section className="session-main-focus-state session-freeform-focus" aria-label="자유 진행 플레이 공간">
    {actor?(canDismiss?<button type="button" className="session-last-roll-actor session-last-roll-dismiss" aria-label={`${actor.name} Last Roll · 다음 굴림까지 모든 화면에서 숨기기`} disabled={dismissing} onClick={()=>void dismiss()}>{actorContent}</button>:<div className="session-last-roll-actor" aria-label={`마지막 굴림 액터 ${actor.name}`}>{actorContent}</div>):<div className="session-freeform-empty"><span className="eyebrow accent">자유 진행</span><strong>첫 굴림을 기다리는 중</strong></div>}
    {dismissError&&<small className="session-last-roll-dismiss-error" role="status">{dismissError}</small>}
  </section>;
}
