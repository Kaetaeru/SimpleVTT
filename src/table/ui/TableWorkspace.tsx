import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useSimpleVtt } from "../../app/AppProvider";
import type { AppSnapshot, SceneEntity } from "../../app/contracts";
import type { TableSessionFacade } from "../facade";
import { LOCAL_PLAYER_PEER } from "../facade";
import { HOST_ORIGIN, type TableCommand } from "../commands";
import { CommandCenter, FreeActionBar, type TargetingState } from "./CommandCenter";
import { useTableFacade } from "./context";
import { DiscretionBar } from "./DiscretionBar";
import { Focus } from "./Focus";
import { QuickSearch } from "./QuickSearch";
import { SheetDrawer } from "./SheetDrawer";
import { TableStage } from "./TableStage";
import { TokenHud } from "./TokenCard";
import { TopBar } from "./TopBar";
import { ActorsTab, CombatTab, ItemsTab, LogTab, MaterialsTab, RulesTab, SessionTab } from "./tabs";
import { DM_TABS, PLAYER_TABS, nextSelection, rulingFrom, type DiscretionInput, type SearchHit, type SidebarTab, type WorkspaceRole } from "./model";
import type { DragPayload } from "./drag";
import { bundleSpecs, hostLibrary } from "../library";
import "./workspace.css";

/**
 * The V2 workspace (DM_WORKSPACE.md): one skeleton for the DM and the player. The DM drives the selected token; the
 * player drives their own character. Every button is a table command through the facade; nothing here resolves rules.
 */
export function TableWorkspace({onLeave}:{onLeave():void}) {
  const {snapshot,stopSession}=useSimpleVtt();
  const facade=useTableFacade();
  if(!snapshot) return null;
  return <WorkspaceView snapshot={snapshot} facade={facade} onLeave={onLeave} onStop={()=>void stopSession()}/>;
}

/** The workspace body over an explicit snapshot (the provider's, or a test's). */
export function WorkspaceView({snapshot,facade,onLeave,onStop,initialSelectedIds=[]}:{snapshot:AppSnapshot;facade:TableSessionFacade|null;onLeave():void;onStop():void;initialSelectedIds?:string[]}) {
  const role:WorkspaceRole=snapshot?.session.role==="client"?"player":snapshot?.session.role==="host"||snapshot?.role==="dm"?"dm":"player";
  const peerId=role==="dm"?HOST_ORIGIN.peerId:facade?.client?.peerId??LOCAL_PLAYER_PEER;
  const [selectedIds,setSelectedIds]=useState<string[]>(initialSelectedIds);
  const [tab,setTab]=useState<SidebarTab>(role==="dm"?"actors":"combat");
  const [sidebarOpen,setSidebarOpen]=useState(role==="dm");
  const [hud,setHud]=useState<{id:string;left:number;top:number}|null>(null);
  const hudId=hud?.id??null;
  const setHudId=(id:string|null)=>{ if(id===null) setHud(null); };
  const [sheetId,setSheetId]=useState<string|null>(null);
  const [targeting,setTargeting]=useState<TargetingState|null>(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [dismissedResolution,setDismissedResolution]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const feedback=(message:string)=>{ setToast(message); window.setTimeout(()=>setToast((current)=>current===message?null:current),2400); };
  const dispatch=async(command:TableCommand)=>facade?facade.dispatch(command):Promise.resolve({status:"refused" as const,refusal:{code:"no-table",message:"테이블 런타임이 없습니다.",id:0}});

  const entities=snapshot?.scene.entities??[];
  const ownId=snapshot?.activeCharacter.id??null;
  // The player's selection is always their own character; the DM's is whatever they clicked (or the current turn).
  const effectiveSelection=role==="player"?(ownId&&entities.some((entity)=>entity.id===ownId)?[ownId]:[]):selectedIds.filter((id)=>entities.some((entity)=>entity.id===id));
  useEffect(()=>{ if(role==="dm"&&!effectiveSelection.length&&snapshot?.scene.currentActorId&&entities.some((entity)=>entity.id===snapshot.scene.currentActorId)) setSelectedIds([snapshot.scene.currentActorId]); },[role,snapshot?.scene.currentActorId,entities.length]);
  const primary=effectiveSelection[0]?entities.find((entity)=>entity.id===effectiveSelection[0])??null:null;
  const selectedEntities=effectiveSelection.map((id)=>entities.find((entity)=>entity.id===id)).filter((entity):entity is SceneEntity=>Boolean(entity));
  const names=useMemo(()=>Object.fromEntries(entities.map((entity)=>[entity.id,entity.name])),[entities]);

  const confirmTargeting=()=>{ if(!targeting||!targeting.picked.length) return; void dispatch({type:"act",actorId:targeting.actorId,actionId:targeting.actionId,targetIds:targeting.picked,...(targeting.slotLevel?{slotLevel:targeting.slotLevel}:{}),...(targeting.amount!==undefined?{amount:targeting.amount}:{}),...(targeting.formId?{formId:targeting.formId}:{})}); setTargeting(null); };
  const onSelectToken=(id:string,event:MouseEvent)=>{
    if(targeting) {
      if(!targeting.eligible.includes(id)) return;
      const picked=targeting.picked.includes(id)?targeting.picked.filter((entry)=>entry!==id):[...targeting.picked,id].slice(-targeting.max);
      const next={...targeting,picked};
      if(targeting.max===1&&picked.length===1) { void dispatch({type:"act",actorId:next.actorId,actionId:next.actionId,targetIds:picked,...(next.slotLevel?{slotLevel:next.slotLevel}:{}),...(next.amount!==undefined?{amount:next.amount}:{}),...(next.formId?{formId:next.formId}:{})}); setTargeting(null); }
      else setTargeting(next);
      return;
    }
    if(role==="dm") { setSelectedIds(nextSelection(effectiveSelection,id,event.shiftKey)); setHudId(null); }
  };
  const rule=(id:string,input:DiscretionInput)=>void dispatch({type:"ruling",targetIds:[id],ruling:rulingFrom(input)});
  const tokenCommand=(id:string,kind:"hide"|"reveal"|"remove"|"bench"|"engage"|"initiative",value?:string|number)=>{
    switch(kind) {
      case "hide": void dispatch({type:"set-actor",actorId:id,patch:{hidden:true}}); break;
      case "reveal": void dispatch({type:"set-actor",actorId:id,patch:{hidden:false}}); break;
      case "remove": void dispatch({type:"remove-actor",actorId:id}); setHudId(null); break;
      case "bench": void dispatch({type:"bench",actorId:id,present:false}); setHudId(null); break;
      case "engage": if(typeof value==="string") void dispatch({type:"ruling",targetIds:[id],ruling:{kind:"engage",otherId:value,on:true}}); break;
      case "initiative": if(typeof value==="number"&&Number.isFinite(value)) void dispatch({type:"set-actor",actorId:id,patch:{initiative:value}}); break;
    }
  };
  /** Drops (DM_WORKSPACE.md §4): an actor on the table summons it there; an item on a token is a grant; a condition on a token is a ruling. */
  const dropOnTable=(side:"enemy"|"ally"|"neutral",payload:DragPayload)=>{
    if(role!=="dm") return;
    const library=hostLibrary();
    if(payload.kind==="monster") void dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:payload.monsterId,count:payload.count??1,side}]});
    else if(payload.kind==="npc") { const entry=library.get(payload.entryId); if(entry?.npc) void dispatch({type:"add-actors",specs:[{kind:"npc",definition:entry.npc,count:payload.count??1,side}]}); }
    else if(payload.kind==="preset") { const entry=library.get(payload.entryId); if(entry?.preset) { const sheet=structuredClone(entry.preset); sheet.id=`${sheet.id}.preset.${Date.now().toString(36)}`; void dispatch({type:"add-actors",specs:[{kind:"character",sheet,side}]}); } }
    else if(payload.kind==="bundle") { const entry=library.get(payload.entryId); if(entry?.bundle) { void dispatch({type:"add-actors",specs:bundleSpecs(library,entry.bundle)}); if(entry.bundle.sceneName) void dispatch({type:"scene",name:entry.bundle.sceneName,conditions:entry.bundle.conditions}); } }
    else feedback("아이템과 상태는 토큰 위에 놓으세요.");
  };
  const dropOnToken=(entityId:string,payload:DragPayload)=>{
    if(role!=="dm") return;
    const entity=entities.find((entry)=>entry.id===entityId);
    if(!entity) return;
    if(payload.kind==="item") { if(entity.tableKind!=="character") { feedback("아이템은 캐릭터에게만 지급합니다."); return; } void dispatch({type:"grant-item",actorId:entityId,item:{definitionId:payload.definitionId,name:payload.name,kind:payload.itemKind,quantity:payload.quantity}}); }
    else if(payload.kind==="condition") void dispatch({type:"ruling",targetIds:[entityId],ruling:rulingFrom({kind:"condition",conditionId:payload.conditionId,on:true,preset:"1min"})});
    else dropOnTable(entity.side,payload);
  };
  const pickSearch=(hit:SearchHit)=>{
    switch(hit.payload.kind) {
      case "entity": setSelectedIds([hit.payload.entityId]); setTab("combat"); break;
      case "monster": void dispatch({type:"add-actors",specs:[{kind:"monster",monsterId:hit.payload.monsterId}]}); setTab("actors"); break;
      case "condition": if(role==="dm"&&effectiveSelection.length) void dispatch({type:"ruling",targetIds:effectiveSelection,ruling:rulingFrom({kind:"condition",conditionId:hit.payload.conditionId,on:true,preset:"1min"})}); else setTab("rules"); break;
      case "action": { const payload=hit.payload; const action=(snapshot?.scene.actionsByActor[payload.actorId]??[]).find((entry)=>entry.id===payload.actionId); if(action&&action.available) { const targetIds=action.target==="self"?[payload.actorId]:action.target==="none"?[]:action.eligibleTargetIds.length===1?[action.eligibleTargetIds[0]]:null; if(targetIds) void dispatch({type:"act",actorId:payload.actorId,actionId:action.id,targetIds}); else setTargeting({actionId:action.id,actorId:payload.actorId,max:action.maxTargets??1,eligible:action.eligibleTargetIds,picked:[]}); } break; }
      case "tab": setTab(hit.payload.tab); setSidebarOpen(true); break;
    }
  };

  // Keyboard (DM_WORKSPACE.md §7): Ctrl+K search, N next turn, Ctrl+Z undo, Esc closes, 1–7 tabs, Tab cycles tokens.
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const editing=(event.target as HTMLElement|null)?.matches?.("input, textarea, select, [contenteditable]");
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k") { event.preventDefault(); setSearchOpen(true); return; }
      if(event.key==="Escape") { setSearchOpen(false); setHudId(null); setSheetId(null); if(targeting) setTargeting(null); else if(role==="dm") setSelectedIds([]); return; }
      if(editing) return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"&&role==="dm") { event.preventDefault(); void dispatch({type:"undo"}); return; }
      if(event.key.toLowerCase()==="n"&&role==="dm"&&snapshot?.sessionMode==="initiative") { void dispatch({type:"end-turn"}); return; }
      const tabs=role==="dm"?DM_TABS:PLAYER_TABS;
      const hit=tabs.find((entry)=>entry.key===event.key);
      if(hit) { setTab(hit.id); setSidebarOpen(true); return; }
      if(event.key==="Tab"&&role==="dm"&&entities.length) { event.preventDefault(); const index=entities.findIndex((entity)=>entity.id===effectiveSelection[0]); setSelectedIds([entities[(index+1)%entities.length].id]); }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[role,targeting,snapshot?.sessionMode,entities,effectiveSelection]);

  const tabs=role==="dm"?DM_TABS:PLAYER_TABS;
  const tabProps={snapshot,role,selectedIds:effectiveSelection,dispatch,onSelect:(id:string)=>{ if(role==="dm") setSelectedIds([id]); },onOpenCard:(resolutionId:string)=>{ setDismissedResolution(null); void resolutionId; },onOpenSheet:(id:string)=>setSheetId(id),onSave:facade?.host?()=>{ void facade.host?.save(); feedback("저장했습니다."); }:undefined,onLeave,onStop,onFeedback:feedback};
  const sheetEntity=sheetId?entities.find((entity)=>entity.id===sheetId)??null:null;
  const sheetActor=sheetId&&facade?(facade.client?.runtime.state.actors[sheetId]??facade.runtime.state.actors[sheetId])??null:null;
  const lastEntry=snapshot.activity.find((entry)=>!entry.reversed&&!entry.undoOf);
  const visibleSnapshot=dismissedResolution&&snapshot.resolution?.id===dismissedResolution?{...snapshot,resolution:null}:snapshot;

  return <div className="tw-root" data-workspace-role={role} data-session-mode={snapshot.sessionMode}>
    <TopBar snapshot={snapshot} role={role} sidebarOpen={sidebarOpen} onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)} onSearch={()=>setSearchOpen(true)} onLeave={onLeave} dispatch={dispatch}/>
    <div className={`tw-main ${sidebarOpen?"":"sidebar-collapsed"}`}>
      <TableStage entities={entities} role={role} selectedIds={effectiveSelection} currentActorId={snapshot.scene.currentActorId} targeting={targeting?{eligible:targeting.eligible,picked:targeting.picked}:null} hudId={hudId}
        onSelect={onSelectToken} onOpenSheet={(id)=>setSheetId(id)} onRule={rule} onCommand={tokenCommand} onDropOnToken={role==="dm"?dropOnToken:undefined} onDropOnTable={role==="dm"?dropOnTable:undefined} onToggleHud={(id,rect)=>setHud(hud?.id===id?null:{id,left:Math.min(rect.left,Math.max(0,window.innerWidth-336)),top:Math.min(rect.bottom+4,Math.max(0,window.innerHeight-420))})} onBackgroundClick={()=>{ setHudId(null); if(!targeting&&role==="dm") setSelectedIds([]); }}
        focus={<Focus snapshot={visibleSnapshot} role={role} peerId={peerId} dispatch={dispatch} onDismiss={()=>setDismissedResolution(snapshot.resolution?.id??null)}/>}/>
      <aside className="tw-sidebar" aria-label="사이드바">
        {sidebarOpen?<>
          <nav className="tw-tabs" role="tablist">{tabs.map((entry)=><button type="button" key={entry.id} role="tab" aria-selected={tab===entry.id} className={tab===entry.id?"active":""} onClick={()=>setTab(entry.id)}>{entry.label}<span className="k">{entry.key}</span></button>)}</nav>
          {tab==="log"&&<LogTab {...tabProps}/>}
          {tab==="combat"&&<CombatTab {...tabProps}/>}
          {tab==="actors"&&<ActorsTab {...tabProps}/>}
          {tab==="items"&&<ItemsTab {...tabProps}/>}
          {tab==="materials"&&<MaterialsTab {...tabProps}/>}
          {tab==="rules"&&<RulesTab {...tabProps}/>}
          {tab==="session"&&<SessionTab {...tabProps}/>}
        </>:<button type="button" className="tw-collapse quiet" onClick={()=>setSidebarOpen(true)}>사이드바</button>}
      </aside>
    </div>
    <div className="tw-bottom">
      <CommandCenter snapshot={snapshot} actor={primary} role={role} targeting={targeting} onStartTargeting={setTargeting} onCancelTargeting={()=>setTargeting(null)} onConfirmTargeting={confirmTargeting} dispatch={dispatch}/>
      {role==="dm"?<DiscretionBar selected={selectedEntities} lastEntry={lastEntry} dispatch={dispatch}/>:<FreeActionBar snapshot={snapshot} actor={primary} dispatch={dispatch}/>}
    </div>
    {hud&&role==="dm"&&entities.some((entity)=>entity.id===hud.id)&&<div className="tw-hud-float" style={{left:hud.left,top:hud.top}}><TokenHud entity={entities.find((entity)=>entity.id===hud.id)!} names={names} onRule={(input)=>rule(hud.id,input)} onCommand={(kind,value)=>tokenCommand(hud.id,kind,value)} onOpenSheet={()=>{ setSheetId(hud.id); setHud(null); }} onClose={()=>setHud(null)}/></div>}
    {toast&&<div className="tw-toast" role="status">{toast}</div>}
    {searchOpen&&<QuickSearch entities={entities} actions={snapshot.scene.actionsByActor} selectedActorId={primary?.id??null} role={role} onPick={pickSearch} onClose={()=>setSearchOpen(false)}/>}
    {sheetEntity&&<SheetDrawer entity={sheetEntity} actor={sheetActor} role={role} onClose={()=>setSheetId(null)}/>}
  </div>;
}
