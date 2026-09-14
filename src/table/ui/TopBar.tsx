import { useState } from "react";
import type { AppSnapshot } from "../../app/contracts";
import type { TableCommand } from "../commands";
import { formatClock, isInitiative } from "./model";

/** The top bar (DM_WORKSPACE.md §2): back, session name and connections, the mode switch, the clock, Public/DM, search. */
export function TopBar({snapshot,role,sidebarOpen,onToggleSidebar,onSearch,onLeave,dispatch}:{snapshot:AppSnapshot;role:"dm"|"player";sidebarOpen:boolean;onToggleSidebar():void;onSearch():void;onLeave():void;dispatch(command:TableCommand):Promise<unknown>}) {
  const [sceneName,setSceneName]=useState("");
  const [sceneOpen,setSceneOpen]=useState(false);
  const initiative=isInitiative(snapshot);
  const connected=snapshot.session.participants.filter((participant)=>participant.state==="connected").length;
  return <header className="tw-topbar" role="banner">
    <button type="button" className="quiet" onClick={onLeave}>← {role==="dm"?"캠페인":"나가기"}</button>
    <div className="tw-title"><strong>{snapshot.session.name||"테이블"}{snapshot.scene.sceneName?` · ${snapshot.scene.sceneName}`:""}</strong><small>연결 {connected} · {snapshot.session.compatibilityMessage}</small></div>
    {role==="dm"&&<span className="tw-seg" role="group" aria-label="진행 방식"><button type="button" className={initiative?"":"active"} onClick={()=>{ if(initiative) void dispatch({type:"end-initiative"}); }}>자유 진행</button><button type="button" className={initiative?"active":""} onClick={()=>{ if(!initiative) void dispatch({type:"start-initiative"}); }}>이니셔티브</button></span>}
    <span className="tw-clock">{snapshot.scene.clock?.timeOfDay??""} · {formatClock(snapshot.scene.clock?.elapsedSeconds??0)}{initiative?` · ${snapshot.scene.round}라운드`:""}</span>
    {role==="dm"&&<span style={{position:"relative"}}><button type="button" onClick={()=>setSceneOpen(!sceneOpen)}>장면</button>{sceneOpen&&<div className="tw-hud" style={{width:260}}><div className="tw-hud-row"><input type="text" value={sceneName} placeholder="새 장면 이름" aria-label="장면 이름" onChange={(event)=>setSceneName(event.target.value)}/><button type="button" className="primary" disabled={!sceneName.trim()} onClick={()=>{ void dispatch({type:"scene",name:sceneName.trim()}); setSceneName(""); setSceneOpen(false); }}>전환</button></div><div className="tw-hud-row"><small style={{color:"var(--muted)"}}>장면 전환은 숨음과 교전을 지우고 상태는 남깁니다. 조건(어둠·안개)은 알림일 뿐입니다 (D42).</small></div></div>}</span>}
    <div className="tw-spacer"/>
    {role==="dm"&&<span className="tw-seg" role="group" aria-label="굴림 공개"><button type="button" className={snapshot.scene.rollVisibility==="dm"?"":"active"} onClick={()=>void dispatch({type:"set-roll-visibility",visibility:"public"})}>Public</button><button type="button" className={snapshot.scene.rollVisibility==="dm"?"active":""} onClick={()=>void dispatch({type:"set-roll-visibility",visibility:"dm"})}>DM Only</button></span>}
    <button type="button" onClick={onSearch}>검색 <kbd style={{color:"var(--quiet)"}}>Ctrl+K</kbd></button>
    <button type="button" className="quiet" aria-label={sidebarOpen?"사이드바 접기":"사이드바 펼치기"} onClick={onToggleSidebar}>{sidebarOpen?"⟩":"⟨"}</button>
  </header>;
}
