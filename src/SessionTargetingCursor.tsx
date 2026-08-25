import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TargetingAnchor { x:number; y:number }

export function targetingCurvePath(anchor:TargetingAnchor,target:TargetingAnchor) {
  const dx=target.x-anchor.x;
  const dy=target.y-anchor.y;
  const bend=Math.max(24,Math.min(90,Math.abs(dx)*.18+Math.abs(dy)*.08));
  return `M ${anchor.x} ${anchor.y} C ${anchor.x} ${anchor.y-bend}, ${target.x} ${target.y+bend}, ${target.x} ${target.y}`;
}

function actorCardCenters(targetIds:string[]) {
  const cards=[...document.querySelectorAll<HTMLElement>(".session-actor-card[data-actor-id]")];
  return targetIds.flatMap((targetId)=>{
    const card=cards.find((entry)=>entry.dataset.actorId===targetId);
    if(!card)return [];
    const rect=card.getBoundingClientRect();
    return [{id:targetId,x:rect.left+rect.width/2,y:rect.top+rect.height/2}];
  });
}

export function SessionTargetingCursor({ anchor, label, targetIds=[] }:{ anchor:TargetingAnchor; label:string; targetIds?:string[] }) {
  const [pointer,setPointer]=useState(anchor);
  const [targets,setTargets]=useState(()=>actorCardCenters(targetIds));

  useEffect(()=>{
    const move=(event:PointerEvent)=>setPointer({x:event.clientX,y:event.clientY});
    window.addEventListener("pointermove",move,{passive:true});
    return ()=>window.removeEventListener("pointermove",move);
  },[]);

  useEffect(()=>{
    const refresh=()=>setTargets(actorCardCenters(targetIds));
    refresh();
    window.addEventListener("resize",refresh);
    window.addEventListener("scroll",refresh,true);
    return ()=>{window.removeEventListener("resize",refresh);window.removeEventListener("scroll",refresh,true);};
  },[targetIds]);

  return createPortal(<div className="session-targeting-cursor" aria-hidden="true">
    <svg width="100%" height="100%" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
      <defs><marker id="session-target-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" /></marker></defs>
      {targets.map((target)=><g key={target.id} data-target-id={target.id}>
        <path className="session-targeting-arrow-shadow fixed" d={targetingCurvePath(anchor,target)} />
        <path className="session-targeting-arrow-line fixed" d={targetingCurvePath(anchor,target)} markerEnd="url(#session-target-arrow)" />
      </g>)}
      <path className="session-targeting-arrow-shadow" d={targetingCurvePath(anchor,pointer)} />
      <path className="session-targeting-arrow-line" d={targetingCurvePath(anchor,pointer)} markerEnd="url(#session-target-arrow)" />
    </svg>
    <span className="session-targeting-pointer-label" style={{left:pointer.x,top:pointer.y}}>{label} · 액터 선택</span>
  </div>,document.body);
}
