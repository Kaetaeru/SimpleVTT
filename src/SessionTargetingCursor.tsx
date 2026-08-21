import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface TargetingAnchor { x:number; y:number }

export function SessionTargetingCursor({ anchor, label }:{ anchor:TargetingAnchor; label:string }) {
  const [pointer,setPointer]=useState(anchor);

  useEffect(()=>{
    const move=(event:PointerEvent)=>setPointer({x:event.clientX,y:event.clientY});
    window.addEventListener("pointermove",move,{passive:true});
    return ()=>window.removeEventListener("pointermove",move);
  },[]);

  const dx=pointer.x-anchor.x;
  const dy=pointer.y-anchor.y;
  const bend=Math.max(24,Math.min(90,Math.abs(dx)*.18+Math.abs(dy)*.08));
  const path=`M ${anchor.x} ${anchor.y} C ${anchor.x} ${anchor.y-bend}, ${pointer.x} ${pointer.y+bend}, ${pointer.x} ${pointer.y}`;

  return createPortal(<div className="session-targeting-cursor" aria-hidden="true">
    <svg width="100%" height="100%" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`} preserveAspectRatio="none">
      <defs><marker id="session-target-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" /></marker></defs>
      <path className="session-targeting-arrow-shadow" d={path} />
      <path className="session-targeting-arrow-line" d={path} markerEnd="url(#session-target-arrow)" />
    </svg>
    <span className="session-targeting-pointer-label" style={{left:pointer.x,top:pointer.y}}>{label} · 액터 선택</span>
  </div>,document.body);
}
