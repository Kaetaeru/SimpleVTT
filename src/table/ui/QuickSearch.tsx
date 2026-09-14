import { useEffect, useState } from "react";
import { searchEverything, type SearchHit, type SidebarTab, type WorkspaceRole } from "./model";
import type { ActionVm, SceneEntity } from "../../app/contracts";

/** Ctrl+K: one search over the tabs; Enter runs the hit's default verb (DM_WORKSPACE.md §2). */
export function QuickSearch({entities,actions,selectedActorId,role,onPick,onClose}:{entities:SceneEntity[];actions:Record<string,ActionVm[]>;selectedActorId:string|null;role:WorkspaceRole;onPick(hit:SearchHit):void;onClose():void}) {
  const [query,setQuery]=useState("");
  const [active,setActive]=useState(0);
  const hits=searchEverything(query,{entities,actions,selectedActorId,role});
  useEffect(()=>setActive(0),[query]);
  return <div className="tw-search" role="dialog" aria-label="검색" onClick={onClose}>
    <div className="tw-search-box" onClick={(event)=>event.stopPropagation()}>
      <input autoFocus type="search" value={query} placeholder="액터, 행동, 상태, 몬스터, 탭… (Esc 닫기)" aria-label="통합 검색" onChange={(event)=>setQuery(event.target.value)} onKeyDown={(event)=>{
        if(event.key==="ArrowDown") { event.preventDefault(); setActive((active+1)%Math.max(1,hits.length)); }
        else if(event.key==="ArrowUp") { event.preventDefault(); setActive((active-1+Math.max(1,hits.length))%Math.max(1,hits.length)); }
        else if(event.key==="Enter"&&hits[active]) { onPick(hits[active]); onClose(); }
        else if(event.key==="Escape") onClose();
      }}/>
      <div className="tw-hits" role="listbox">
        {hits.map((hit,index)=><button type="button" key={hit.id} role="option" aria-selected={index===active} className={`tw-hit ${index===active?"active":""}`} onMouseEnter={()=>setActive(index)} onClick={()=>{ onPick(hit); onClose(); }}><div className="tw-grow"><strong>{hit.label}</strong><small>{hit.detail}</small></div><em>{hit.verb}</em><span className="tw-chip">{hit.tab}</span></button>)}
        {query.trim()&&hits.length===0&&<div className="tw-empty">일치하는 항목이 없습니다.</div>}
      </div>
    </div>
  </div>;
}
