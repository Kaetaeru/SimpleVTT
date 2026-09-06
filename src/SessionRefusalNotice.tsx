import { useEffect, useRef, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { SessionRefusalVm } from "./app/contracts";
import { isReducedMotionPreferred } from "./app/motionPreferences";
import { subscribeRefusal } from "./app/sessionRefusal";
import "./session-refusal.css";

/**
 * V1.6 S1-01 — the refusal notice. One surface for every refused command: the adapter's `snapshot.refusal` (local or
 * relayed from the Host) and the dock's own "that tile is unavailable" refusals. Shown above the command dock, in
 * the rules' words, and gone on its own a few seconds later. Reduced motion keeps the text and drops the shake.
 */
const LIFE=4200;
const LIFE_REDUCED=2600;

function actorNameOf(entities:{id:string;name:string}[],actorId?:string):string|null {
  if(!actorId) return null;
  return entities.find((entity)=>entity.id===actorId)?.name??null;
}

export function SessionRefusalNotice() {
  const {snapshot}=useSimpleVtt();
  const [current,setCurrent]=useState<SessionRefusalVm|null>(null);
  const lastSnapshotRefusal=useRef(0);
  const timer=useRef<number|null>(null);

  const show=(refusal:SessionRefusalVm)=>{
    setCurrent(refusal);
    if(timer.current!==null) window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>{setCurrent((entry)=>entry?.id===refusal.id?null:entry);timer.current=null;},isReducedMotionPreferred()?LIFE_REDUCED:LIFE);
    const dock=document.querySelector<HTMLElement>(".session-mode-action-dock");
    if(dock){dock.classList.remove("refused");void dock.offsetWidth;dock.classList.add("refused");window.setTimeout(()=>dock.classList.remove("refused"),700);}
  };

  useEffect(()=>subscribeRefusal(show),[]);
  useEffect(()=>{
    const refusal=snapshot?.refusal;
    if(!refusal||refusal.id===lastSnapshotRefusal.current) return;
    lastSnapshotRefusal.current=refusal.id;
    show(refusal);
  },[snapshot?.refusal]);
  useEffect(()=>()=>{if(timer.current!==null)window.clearTimeout(timer.current);},[]);

  if(!current) return null;
  const actor=actorNameOf(snapshot?.scene.entities??[],current.actorId);
  const kicker=current.origin==="host"?"호스트 거부":current.origin==="remote"?`${actor??"플레이어"} 거부됨`:"거부됨";
  return <div className={`session-refusal-notice origin-${current.origin}`} role="alert" data-refusal-code={current.code} key={current.id}>
    <span className="session-refusal-kicker">{kicker}</span>
    <strong className="session-refusal-message">{current.message}</strong>
  </div>;
}
