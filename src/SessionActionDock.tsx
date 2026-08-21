import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { DEFAULT_SESSION_HOTBAR_ROWS, readSessionHotbarCategoryOrder, readSessionHotbarRows, writeSessionHotbarCategoryOrder, writeSessionHotbarRows, type SessionHotbarCategory, type SessionHotbarRows } from "./app/sessionHotbarPreferences";
import type { TargetingAnchor } from "./SessionTargetingCursor";
import { ActionIcon } from "./ActionIcon";
import { actionIconDescriptor } from "./app/actionIconProjection";
import "./session-action-dock.css";

type HotbarPage = "mixed" | SessionHotbarCategory;
const HOTBAR_PAGES:Array<{id:HotbarPage;label:string}>=[{id:"mixed",label:"통합"},{id:"action",label:"행동"},{id:"class",label:"직업"},{id:"item",label:"아이템"},{id:"special",label:"특수"},{id:"custom",label:"커스텀"}];
const CATEGORY_LABEL:Record<SessionHotbarCategory,string>={action:"행동",class:"직업 · 마법",item:"아이템",special:"특수",custom:"커스텀"};

export interface SessionActionTargeting { action:ActionVm; selectedTargetIds:string[]; pending:boolean; feedback:string|null }

function signed(value:number|undefined) { if (value===undefined) return ""; return value>=0?`+${value}`:String(value); }
function actionEffect(action:ActionVm) {
  if (action.damage?.length) return action.damage.map((part)=>`${part.dice}${part.flat?signed(part.flat):""} ${part.type}`).join(" + ");
  if (action.healing) return `${action.healing.dice}${action.healing.flat?signed(action.healing.flat):""} 회복`;
  if (action.checkBonus!==undefined) return `판정 ${signed(action.checkBonus)}`;
  return action.summary;
}
function targetCopy(target:ActionVm["target"]) {
  if (target==="none") return "대상 없음";
  if (target==="self") return "자신";
  if (target==="ally") return "아군";
  if (target==="enemy") return "상대";
  if (target==="multi-enemy") return "여러 상대";
  return "대상 선택";
}
function actionCategory(action:ActionVm):SessionHotbarCategory {
  if (action.itemCost) return "item";
  if (action.category==="magic"||action.resourceCost) return "class";
  if (action.category==="weapon"||action.resolutionKind==="attack"||action.resolutionKind==="ability-check") return "action";
  return "special";
}
function pageIncludes(page:HotbarPage,action:ActionVm) {
  return page==="mixed"||page!=="custom"&&actionCategory(action)===page;
}
export function SessionActionDock({actorId,suspended,targeting,onBeginTargeting,onCancelTargeting,onExecuteTargeting}:{
  actorId:string|null; suspended:boolean; targeting:SessionActionTargeting|null;
  onBeginTargeting(action:ActionVm,anchor:TargetingAnchor):void; onCancelTargeting():void; onExecuteTargeting():void;
}) {
  const {snapshot,resolveAction,endTurn}=useSimpleVtt();
  const [page,setPage]=useState<HotbarPage>("mixed");
  const [rows,setRows]=useState<SessionHotbarRows>(()=>typeof window==="undefined"?DEFAULT_SESSION_HOTBAR_ROWS:readSessionHotbarRows());
  const [categoryOrder,setCategoryOrder]=useState<SessionHotbarCategory[]>(()=>typeof window==="undefined"?["action","class","item","special","custom"]:readSessionHotbarCategoryOrder());
  const [pendingActionId,setPendingActionId]=useState<string|null>(null);
  const [pendingTurn,setPendingTurn]=useState(false);
  const [feedback,setFeedback]=useState<string|null>(null);
  const [tooltip,setTooltip]=useState<{action:ActionVm;x:number;y:number;mainHand:boolean}|null>(null);
  const actions=snapshot&&actorId?snapshot.scene.actionsByActor[actorId]??[]:[];
  const ownsCharacter=Boolean(snapshot&&actorId&&snapshot.activeCharacter.id===actorId);
  const mainHandItem=ownsCharacter&&snapshot?snapshot.activeCharacter.items.find((item)=>item.equipped&&item.wielded&&item.wieldSlot==="main-hand")??null:null;
  const isMainHand=(action:ActionVm)=>Boolean(mainHandItem&&(mainHandItem.grantedActionIds.includes(action.id)||mainHandItem.name===action.name||mainHandItem.nameEn===action.name));
  const visibleActions=useMemo(()=>actions.filter((action)=>pageIncludes(page,action)),[actions,page]);
  const groupedActions=useMemo(()=>categoryOrder.map((category)=>({category,actions:actions.filter((action)=>actionCategory(action)===category)})),[actions,categoryOrder]);
  const actorEntity=snapshot&&actorId?snapshot.scene.entities.find((entity)=>entity.id===actorId)??null:null;
  const actorName=actorEntity?.name??(ownsCharacter&&snapshot?snapshot.activeCharacter.name:"액터");
  const actorHp=actorEntity?.hp??(ownsCharacter&&snapshot?snapshot.activeCharacter.hp:0);
  const actorMaxHp=actorEntity?.maxHp??(ownsCharacter&&snapshot?snapshot.activeCharacter.maxHp:0);
  const actorDamage=actorMaxHp>0?Math.max(0,Math.min(100,100-actorHp/actorMaxHp*100)):0;
  const controlledPortrait=ownsCharacter&&snapshot?sanitizeCharacterPortrait(snapshot.activeCharacter.portrait):null;
  const resources=ownsCharacter&&snapshot?snapshot.activeCharacter.resources:[];
  const economy=snapshot&&actorId&&snapshot.sessionMode==="initiative"?snapshot.scene.economyByActor[actorId]:undefined;
  const currentActor=snapshot?.scene.entities.find((entity)=>entity.id===snapshot.scene.currentActorId)??null;
  const role=snapshot?.session.role==="host"?"dm":"player";
  const playerOwnsTurn=Boolean(snapshot&&role==="player"&&currentActor?.id===snapshot.activeCharacter.id);
  const canEndTurn=Boolean(snapshot&&snapshot.sessionMode==="initiative"&&currentActor&&snapshot.connectionState==="connected"&&!snapshot.resolution&&(role==="dm"||playerOwnsTurn));
  const multiTarget=targeting?.action.target==="multi-enemy";

  useEffect(()=>{ setPage("mixed"); setFeedback(null); setPendingActionId(null); setTooltip(null); },[actorId]);
  useEffect(()=>{ if (!targeting) setTooltip(null); },[targeting?.action.id]);
  useEffect(()=>{
    const root=document.querySelector<HTMLElement>(".session-reference-play-root");
    root?.style.setProperty("--session-hotbar-rows-active",String(rows));
    return ()=>{ root?.style.removeProperty("--session-hotbar-rows-active"); };
  },[rows]);
  if (!snapshot) return null;

  const runImmediate=async(action:ActionVm,targetIds:string[])=>{
    if (pendingActionId) return;
    setPendingActionId(action.id); setFeedback(null);
    try { await resolveAction(action.id,targetIds); }
    catch { setFeedback("행동을 완료하지 못했습니다. 현재 상태를 확인하고 다시 시도하세요."); }
    finally { setPendingActionId(null); }
  };
  const chooseAction=(action:ActionVm,button:HTMLButtonElement)=>{
    if (suspended||targeting?.pending) return;
    if (!action.available) { setFeedback(action.disabledReason||"현재 사용할 수 없습니다."); return; }
    if (action.target==="none") { void runImmediate(action,[]); return; }
    if (action.target==="self"&&actorId) { void runImmediate(action,[actorId]); return; }
    const rect=button.getBoundingClientRect();
    onBeginTargeting(action,{x:rect.left+rect.width/2,y:rect.top+rect.height/2});
    setFeedback(null); setTooltip(null);
  };
  const changeRows=(next:number)=>{ const normalized=Math.max(2,Math.min(4,next)) as SessionHotbarRows; setRows(normalized); writeSessionHotbarRows(normalized); };
  const moveCategory=(category:SessionHotbarCategory,direction:-1|1)=>{
    setCategoryOrder((current)=>{
      const index=current.indexOf(category); const destination=index+direction;
      if (index<0||destination<0||destination>=current.length) return current;
      const next=[...current]; [next[index],next[destination]]=[next[destination],next[index]];
      writeSessionHotbarCategoryOrder(next); return next;
    });
  };
  const showTooltip=(action:ActionVm,button:HTMLButtonElement)=>{ const rect=button.getBoundingClientRect(); setTooltip({action,x:Math.min(window.innerWidth-280,Math.max(8,rect.left)),y:Math.max(8,rect.top-10),mainHand:isMainHand(action)}); };
  const finishTurn=async()=>{ if (!canEndTurn||pendingTurn) return; setPendingTurn(true); try { await endTurn(); } finally { setPendingTurn(false); } };
  const renderSlot=(action:ActionVm)=>{
    const unavailable=!action.available; const selected=action.id===targeting?.action.id; const mainHand=isMainHand(action);
    return <button type="button" role="listitem" key={action.id} className={`session-hotbar-slot ${selected?"selected":""} ${unavailable?"unavailable":""} ${mainHand?"main-hand":""}`} aria-label={`${action.name} · ${action.summary}${mainHand?" · 장착 주무기":""}`} aria-pressed={selected} aria-disabled={unavailable||Boolean(pendingActionId)||suspended||targeting?.pending} onPointerEnter={(event)=>showTooltip(action,event.currentTarget)} onPointerLeave={()=>setTooltip(null)} onFocus={(event)=>showTooltip(action,event.currentTarget)} onBlur={()=>setTooltip(null)} onClick={(event)=>chooseAction(action,event.currentTarget)}><ActionIcon action={action}/>{mainHand&&<span className="session-hotbar-main-hand">M</span>}<span className="session-hotbar-cost">{action.itemCost?"I":action.economy.slice(0,1)}</span></button>;
  };

  return <section className="session-command-center session-reference-command-center" data-action-dock-state={targeting?"target":"hotbar"}>
    <div className="session-command-top">
      <div className="session-command-economy" aria-label="행동 자원">{snapshot.sessionMode==="initiative"&&economy?<><span data-available={economy.action}><i/>행동</span><span data-available={economy.bonusAction}><i/>보너스</span><span data-available={economy.reaction}><i/>반응</span><span><i/>이동 {economy.movement}/{economy.movementMax}</span></>:<span className="freeform">자유 진행 · 턴 자원 없음</span>}</div>
      <div className="session-command-resources" aria-label="Resource Rail">{resources.length?resources.map((resource)=><span key={resource.id}><b>{resource.label}</b><strong>{resource.current}/{resource.max}</strong></span>):<span className="empty"><b>주요 자원</b><strong>표시할 자원 없음</strong></span>}</div>
    </div>
    <div className="session-command-body">
      <div className="session-controlled-actor" aria-label={`조작 중인 액터 ${actorName} · HP ${actorHp}/${actorMaxHp}`} title={actorName}>
        <span className="session-controlled-portrait" style={{"--session-controlled-damage":`${actorDamage}%`} as CSSProperties}>
          <span className="session-controlled-portrait-art">{controlledPortrait?<img src={controlledPortrait.asset.dataUrl} alt="" style={{objectPosition:`${controlledPortrait.focalX*100}% ${controlledPortrait.focalY*100}%`}}/>:<b>{actorName.trim().slice(0,2)||"A"}</b>}</span>
          <i className="session-controlled-damage-fill" aria-hidden="true"/><i className="session-controlled-damage-frame" aria-hidden="true"/>
        </span>
        <div className="session-controlled-info"><strong>{actorName}</strong><p>HP {actorHp}/{actorMaxHp}<br/>{mainHandItem?`주무기 · ${mainHandItem.name}`:"명시된 주무기 없음"}</p></div>
      </div>
      <div className="session-hotbar">
        <div className="session-hotbar-tabs" role="tablist" aria-label="핫바 분류">{HOTBAR_PAGES.map((entry)=><button type="button" role="tab" key={entry.id} aria-selected={page===entry.id} className={page===entry.id?"active":""} onClick={()=>{setPage(entry.id);onCancelTargeting();}}>{entry.label}</button>)}<span className="session-hotbar-row-control" aria-label="핫바 줄 수"><button type="button" aria-label="핫바 줄 줄이기" disabled={rows===2} onClick={()=>changeRows(rows-1)}>−</button><b>{rows}줄</b><button type="button" aria-label="핫바 줄 늘리기" disabled={rows===4} onClick={()=>changeRows(rows+1)}>＋</button></span></div>
        {page==="mixed"?<div className="session-hotbar-unified" style={{"--session-hotbar-rows":rows} as CSSProperties} aria-label="통합 행동 카테고리">
          {groupedActions.map((group,index)=><section className="session-hotbar-category" data-category={group.category} key={group.category}><header><strong>{CATEGORY_LABEL[group.category]}</strong><span><button type="button" aria-label={`${CATEGORY_LABEL[group.category]} 왼쪽으로 이동`} disabled={index===0} onClick={()=>moveCategory(group.category,-1)}>‹</button><button type="button" aria-label={`${CATEGORY_LABEL[group.category]} 오른쪽으로 이동`} disabled={index===groupedActions.length-1} onClick={()=>moveCategory(group.category,1)}>›</button></span></header><div className="session-hotbar-category-slots" role="list">{group.actions.map(renderSlot)}{!group.actions.length&&<span className="session-hotbar-category-empty">비어 있음</span>}</div></section>)}
        </div>:<div className="session-hotbar-slots" style={{"--session-hotbar-rows":rows} as CSSProperties} role="list" aria-label={`${HOTBAR_PAGES.find((entry)=>entry.id===page)?.label??"핫바"} 사용 가능 행동`}>
          {visibleActions.map(renderSlot)}{!visibleActions.length&&<div className="session-hotbar-empty" role="listitem">표시할 행동 없음</div>}
        </div>}
      </div>
      <div className="session-command-context">
        {targeting&&<><span className="session-command-context-label">{targeting.action.name}<br/>액터를 클릭하세요</span><button type="button" onClick={onCancelTargeting}>취소</button></>}
        {targeting&&multiTarget&&<button type="button" className="primary" disabled={!targeting.selectedTargetIds.length||targeting.pending} onClick={onExecuteTargeting}>실행 · {targeting.selectedTargetIds.length}</button>}
        {!targeting&&snapshot.sessionMode==="initiative"&&<button type="button" className="primary" disabled={!canEndTurn||pendingTurn} onClick={()=>void finishTurn()}>{pendingTurn?"…":role==="dm"?"다음 턴":"턴 종료"}</button>}
        {!targeting&&snapshot.sessionMode==="freeform"&&<span className="session-command-context-label">자유 진행</span>}
      </div>
    </div>
    {(feedback||targeting?.feedback)&&<p className="session-action-feedback session-command-feedback" role="status">{feedback||targeting?.feedback}</p>}
    {tooltip&&createPortal(<aside className="session-hotbar-tooltip" role="tooltip" style={{left:tooltip.x,top:tooltip.y,transform:"translateY(-100%)"}}><small>{tooltip.mainHand?"장착 주무기 · ":""}{actionIconDescriptor(tooltip.action).label} · {targetCopy(tooltip.action.target)} · {tooltip.action.economy}</small><strong>{tooltip.action.name}</strong><b>{actionEffect(tooltip.action)}</b><p>{tooltip.action.summary}</p>{!tooltip.action.available&&<em>{tooltip.action.disabledReason||"현재 사용할 수 없음"}</em>}</aside>,document.body)}
  </section>;
}
