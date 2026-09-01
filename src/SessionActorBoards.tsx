import { useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { projectedCharacterById } from "./app/characterSessionProjectionRegistry";
import { mockAdapter } from "./app/mockAdapter";
import { sessionActorCombatMotion } from "./app/sessionActorCombatMotion";
import { isOpportunityAttackAction, opportunityAttackCommand } from "./app/manualMovementReactionContracts";
import "./session-actor-boards.css";

type BoardPosition="upper"|"lower";
type SessionRole="dm"|"player";
function relationLabel(entity:SceneEntity) { return entity.side==="enemy"?"상대":"아군"; }
function hpPercent(entity:SceneEntity) { return entity.maxHp<=0?0:Math.max(0,Math.min(100,entity.hp/entity.maxHp*100)); }

export function SessionActorBoard({position,role,targetingAction,selectedTargetIds,targetingPending,onTarget}:{
  position:BoardPosition; role:SessionRole; targetingAction:ActionVm|null; selectedTargetIds:string[]; targetingPending:boolean; onTarget(entityId:string):void;
}) {
  const {snapshot,selectDmActor,declareManualMovementReaction}=useSimpleVtt();
  const [pendingActorId,setPendingActorId]=useState<string|null>(null);
  if (!snapshot) return null;
  const wantedSide=position==="upper"?"enemy":"ally";
  const actors=snapshot.scene.entities.filter((entity)=>entity.side===wantedSide);
  const boardLabel=position==="upper"?"상대 Actor Board":"아군 Actor Board";
  const currentActor=snapshot.scene.entities.find((entity)=>entity.id===snapshot.scene.currentActorId);
  const controlsCurrentTurn=Boolean(snapshot.sessionMode==="initiative"&&currentActor&&(role==="dm"?currentActor.kind==="combatant":currentActor.id===snapshot.activeCharacter.id));
  const selectActor=async(entity:SceneEntity)=>{
    if (targetingAction) { onTarget(entity.id); return; }
    if (role!=="dm"||pendingActorId||snapshot.resolution||entity.id===snapshot.scene.selectedActorId) return;
    setPendingActorId(entity.id); try { await selectDmActor(entity.id); } finally { setPendingActorId(null); }
  };
  return <section className={`session-actor-board session-actor-board-${position}`} aria-label={boardLabel} data-board-position={position} data-targeting={Boolean(targetingAction)}>
    <div className="session-actor-board-label" aria-hidden="true"><span>{position==="upper"?"OPPOSING":"ALLIED"}</span><strong>{actors.length}</strong></div>
    <div className="session-actor-board-scroll" role="list">
      {!actors.length?<div className="session-actor-board-empty" role="listitem"><strong>{position==="upper"?"상대 Actor 없음":"아군 Actor 없음"}</strong></div>:actors.map((entity)=>{
        const opportunityActions=controlsCurrentTurn&&currentActor&&entity.id!==currentActor.id&&entity.side!==currentActor.side&&entity.hp>0&&snapshot.scene.economyByActor[entity.id]?.reaction&&!currentActor.status.includes("이탈")
          ? (snapshot.scene.actionsByActor[entity.id]??[]).filter(isOpportunityAttackAction)
          : [];
        return <SessionActorCard key={entity.id} entity={entity} role={role} controlled={role==="dm"?entity.id===snapshot.scene.selectedActorId:entity.id===snapshot.activeCharacter.id} currentTurn={snapshot.sessionMode==="initiative"&&entity.id===snapshot.scene.currentActorId} pending={pendingActorId===entity.id||targetingPending} targeting={Boolean(targetingAction)} validTarget={Boolean(targetingAction?.eligibleTargetIds.includes(entity.id))} targetReason={targetingAction?.eligibleTargetReasons?.[entity.id]??null} selectedTarget={selectedTargetIds.includes(entity.id)} position={position} opportunityActions={opportunityActions} onOpportunity={(action)=>void declareManualMovementReaction(opportunityAttackCommand(currentActor!.id,entity.id,action))} onSelect={()=>void selectActor(entity)}/>;
      }) }
    </div>
  </section>;
}

function SessionActorCard({entity,role,controlled,currentTurn,pending,targeting,validTarget,targetReason,selectedTarget,position,opportunityActions,onOpportunity,onSelect}:{
  entity:SceneEntity; role:SessionRole; controlled:boolean; currentTurn:boolean; pending:boolean; targeting:boolean; validTarget:boolean; targetReason:string|null; selectedTarget:boolean; position:BoardPosition; opportunityActions:ActionVm[]; onOpportunity(action:ActionVm):void; onSelect():void;
}) {
  const {snapshot}=useSimpleVtt();
  const [tip,setTip]=useState<{x:number;y:number}|null>(null);
  if (!snapshot) return null;
  const character=entity.id===snapshot.activeCharacter.id?snapshot.activeCharacter:projectedCharacterById(mockAdapter,entity.id)?.sheet;
  const portrait=sanitizeCharacterPortrait(character?.portrait);
  const initials=entity.name.trim().slice(0,2)||"A";
  const disabled=Boolean(snapshot.resolution)||pending||(role!=="dm"&&!targeting);
  const invalidReason=targeting&&!validTarget?targetReason:null;
  const combatMotion=sessionActorCombatMotion(snapshot.resolution,entity.id);
  const stateCopy=[controlled?"조작":null,currentTurn?"현재 턴":null,...entity.status].filter(Boolean).join(" · ");
  const className=["session-actor-card",entity.side==="enemy"?"hostile":"allied",controlled?"controlled":"",currentTurn?"current-turn":"",targeting?"targeting":"",validTarget?"valid-target":"",selectedTarget?"selected-target":"",targeting&&!validTarget?"invalid-target":"",combatMotion?`combat-${combatMotion}`:""].filter(Boolean).join(" ");
  const combatCopy=combatMotion==="attacking"?" · 공격 중":combatMotion==="targeted"||combatMotion==="braced"?" · 공격 대상":combatMotion==="dodged"?" · 회피":combatMotion==="hit"?" · 피격":"";
  const show=(button:HTMLButtonElement)=>{const rect=button.getBoundingClientRect();setTip({x:Math.min(window.innerWidth-230,Math.max(8,rect.left)),y:position==="upper"?rect.bottom+8:rect.top-8});};
  return <div className="session-actor-card-shell" role="listitem">
    <button type="button" data-actor-id={entity.id} data-combat-motion={combatMotion??undefined} className={className} aria-pressed={targeting?selectedTarget:controlled} aria-disabled={disabled||(targeting&&!validTarget)} aria-label={`${entity.name} · ${relationLabel(entity)} · HP ${entity.hp}/${entity.maxHp} · AC ${entity.ac}${stateCopy?` · ${stateCopy}`:""}${combatCopy}`} disabled={disabled} onClick={()=>{if(!targeting||validTarget)onSelect();}} onPointerEnter={(event)=>show(event.currentTarget)} onPointerLeave={()=>setTip(null)} onFocus={(event)=>show(event.currentTarget)} onBlur={()=>setTip(null)} style={{"--session-actor-damage":`${100-hpPercent(entity)}%`} as React.CSSProperties}>
      <span className="session-actor-card-portrait">{portrait?<img src={portrait.asset.dataUrl} alt="" style={{objectPosition:`${portrait.focalX*100}% ${portrait.focalY*100}%`}}/>:<span className="session-actor-card-fallback" aria-hidden="true"><i/><b>{initials}</b></span>}</span>
      {entity.status.length>0&&<span className="session-actor-card-statuses" aria-label="공개 컨디션">{entity.status.map((status)=><span key={status} title={status}>{status}</span>)}</span>}
      <span className="session-actor-damage-fill" aria-hidden="true"/>
      <span className="session-actor-damage-frame" aria-hidden="true"/>
      {pending&&<span className="session-actor-card-pending">…</span>}
    </button>
    {opportunityActions.length>0&&<button type="button" className="session-opportunity-trigger" disabled={pending||Boolean(snapshot.resolution)} onClick={()=>onOpportunity(opportunityActions[0])} aria-label={`${entity.name}의 기회공격 유발${opportunityActions.length>1?` · ${opportunityActions[0].name} 사용`:""}`} title={`${entity.name} · ${opportunityActions[0].name}`}>기회공격 유발</button>}
    {tip&&createPortal(<aside className="session-actor-tooltip" role="tooltip" style={{left:tip.x,top:tip.y,transform:position==="lower"?"translateY(-100%)":undefined}}><small>{relationLabel(entity)}{entity.distance?` · ${entity.distance}`:""}{stateCopy?` · ${stateCopy}`:""}</small><strong>{entity.name}</strong><div><span>HP <b>{entity.hp}/{entity.maxHp}</b>{entity.tempHp>0?` +${entity.tempHp} 임시`:""}</span><span>AC <b>{entity.ac}</b></span></div><span className="session-actor-tooltip-hp" aria-hidden="true"><i style={{width:`${hpPercent(entity)}%`}}/></span>{invalidReason&&<p className="session-actor-tooltip-reason">{invalidReason}</p>}{entity.status.length>0&&<p>{entity.status.join(" · ")}</p>}</aside>,document.body)}
  </div>;
}
