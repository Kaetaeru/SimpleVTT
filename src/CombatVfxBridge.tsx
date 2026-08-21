import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import type { AppSnapshot } from "./app/contracts";
import { buildCombatVfxProfile, type CombatVfxProfile } from "./app/combatVisuals";

const VFX_STAGES=new Set(["roll-animation","save-animation","damage-animation","effect-preview"]);
type Point={x:number;y:number};
type VfxReplay={key:string;profile:CombatVfxProfile;source:Point;targets:Point[]};

type VfxStyle=CSSProperties & {"--vfx-sx":string;"--vfx-sy":string;"--vfx-distance":string;"--vfx-angle":string};

function centerOf(element:Element|null):Point|null {
  if (!(element instanceof HTMLElement)) return null;
  const rect=element.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
}

function actorElement(entityId:string,snapshot:AppSnapshot) {
  const entity=snapshot.scene.entities.find((candidate)=>candidate.id===entityId);
  if (!entity) return null;
  const groupSelector=entity.kind==="combatant"?".play-v09-scene-row.upper":".play-v09-scene-row.lower";
  const group=document.querySelector(groupSelector);
  if (!group) return null;
  const peers=snapshot.scene.entities.filter((candidate)=>candidate.kind===entity.kind);
  const index=peers.findIndex((candidate)=>candidate.id===entityId);
  return index>=0?group.querySelectorAll(".play-v09-actor")[index]??null:null;
}

function fallbackPoint(kind:"source"|"target"):Point {
  return kind==="source"?{x:window.innerWidth*.5,y:window.innerHeight*.78}:{x:window.innerWidth*.5,y:window.innerHeight*.38};
}

function shotStyle(source:Point,target:Point):VfxStyle {
  const dx=target.x-source.x,dy=target.y-source.y;
  return {
    "--vfx-sx":`${source.x}px`,
    "--vfx-sy":`${source.y}px`,
    "--vfx-distance":`${Math.max(18,Math.hypot(dx,dy))}px`,
    "--vfx-angle":`${Math.atan2(dy,dx)*180/Math.PI}deg`,
  };
}

export function CombatVfxBridge() {
  const {snapshot}=useSimpleVtt();
  const resolution=snapshot?.resolution??null;
  const [replay,setReplay]=useState<VfxReplay|null>(null);
  const lastKeyRef=useRef("");
  const hideRef=useRef<number|null>(null);

  const action=useMemo(()=>{
    if(!snapshot||!resolution)return undefined;
    return Object.values(snapshot.scene.actionsByActor).flat().find((candidate)=>candidate.id===resolution.actionId);
  },[snapshot,resolution]);
  const profile=useMemo(()=>resolution?buildCombatVfxProfile(resolution,action):null,[resolution,action]);

  useEffect(()=>{
    if(!snapshot||snapshot.sessionMode!=="initiative"||!resolution||!profile||!VFX_STAGES.has(resolution.stage))return;
    const key=`${resolution.id}:${resolution.stage}:${profile.delivery}:${profile.element??profile.physical??"impact"}`;
    if(lastKeyRef.current===key)return;
    lastKeyRef.current=key;

    const source=centerOf(actorElement(resolution.actorId,snapshot))??fallbackPoint("source");
    const targetIds=resolution.targetIds.length?resolution.targetIds:[resolution.actorId];
    const targets=targetIds.map((id)=>centerOf(actorElement(id,snapshot))??fallbackPoint("target"));
    setReplay({key,profile,source,targets});
    if(hideRef.current!==null)window.clearTimeout(hideRef.current);
    hideRef.current=window.setTimeout(()=>{setReplay((current)=>current?.key===key?null:current);hideRef.current=null;},680);
  },[snapshot,resolution,profile]);

  useEffect(()=>()=>{if(hideRef.current!==null)window.clearTimeout(hideRef.current);},[]);
  if(!replay)return null;

  const semantic=replay.profile.element??replay.profile.physical??"neutral";
  return createPortal(
    <div className={`combat-vfx-overlay delivery-${replay.profile.delivery} physical-${replay.profile.physical??"none"} element-${semantic} phase-${replay.profile.phase}`} data-combat-vfx={replay.profile.label} aria-hidden="true">
      {replay.targets.map((target,index)=><div className="combat-vfx-shot" style={shotStyle(replay.source,target)} key={`${replay.key}:${index}`}>
        <i className="combat-vfx-trail"/>
        <i className="combat-vfx-core"/>
        <i className="combat-vfx-impact"/>
        <i className="combat-vfx-ring r1"/><i className="combat-vfx-ring r2"/>
        <i className="combat-vfx-particle p1"/><i className="combat-vfx-particle p2"/><i className="combat-vfx-particle p3"/><i className="combat-vfx-particle p4"/><i className="combat-vfx-particle p5"/><i className="combat-vfx-particle p6"/>
      </div>)}
    </div>,document.body,
  );
}
