import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { combatBannerText, diffCombatFeedback, resolutionFeedback, type CombatFeedbackEvent } from "./app/combatFeedback";
import type { SceneEntity } from "./app/contracts";
import { isReducedMotionPreferred } from "./app/motionPreferences";
import "./combat-feedback.css";

/**
 * V1.5 F1-01/F1-02 — floating combat numbers over the actor cards, an impact class on the card, and a result
 * banner over the stage. Derived from snapshot deltas and the resolution view, so it renders identically for the
 * Host and every player, in Initiative and in 자유 진행.
 */
type Placed=CombatFeedbackEvent&{x:number;y:number;offset:number;until:number};
type Banner={key:string;title:string;detail:string;tone:string;semantic:string|null;until:number};

const CARD_CLASS:Record<string,string>={damage:"feedback-damage",critical:"feedback-critical",heal:"feedback-heal",revive:"feedback-heal","temp-hp":"feedback-heal",miss:"feedback-miss",down:"feedback-down","save-failure":"feedback-damage","save-success":"feedback-saved",condition:"feedback-condition"};

function cardOf(entityId:string):HTMLElement|null {
  return [...document.querySelectorAll<HTMLElement>(".session-actor-card[data-actor-id]")].find((element)=>element.dataset.actorId===entityId)??null;
}
function stageRect():DOMRect|null {
  return document.querySelector(".session-reference-stage-focus")?.getBoundingClientRect()??null;
}
function pointFor(entityId:string,fallbackIndex:number):{x:number;y:number} {
  const card=cardOf(entityId);
  if(card){const rect=card.getBoundingClientRect();if(rect.width>0&&rect.height>0)return {x:rect.left+rect.width*.62,y:rect.top+rect.height*.35};}
  const stage=stageRect();
  if(stage)return {x:stage.left+stage.width*.5,y:stage.top+stage.height*.42+fallbackIndex*26};
  return {x:window.innerWidth*.5,y:window.innerHeight*.4+fallbackIndex*26};
}
function flashCard(entityId:string,kind:string,duration:number) {
  const card=cardOf(entityId);const className=CARD_CLASS[kind];
  if(!card||!className)return;
  card.classList.remove(className);void card.offsetWidth;card.classList.add(className);
  window.setTimeout(()=>card.classList.remove(className),duration);
}

export function SessionCombatFeedback() {
  const {snapshot}=useSimpleVtt();
  const previousEntities=useRef<SceneEntity[]|null>(null);
  const seenOutcomes=useRef(new Set<string>());
  const sequence=useRef(0);
  const bannerKey=useRef("");
  const [floats,setFloats]=useState<Placed[]>([]);
  const [banner,setBanner]=useState<Banner|null>(null);

  useEffect(()=>{
    if(!snapshot)return;
    const entities=snapshot.scene.entities;
    const resolution=snapshot.resolution;
    const reduced=isReducedMotionPreferred();
    const life=reduced?900:1500;
    sequence.current+=1;
    const events=[
      ...diffCombatFeedback(previousEntities.current,entities,resolution,sequence.current),
      ...resolutionFeedback(resolution,entities,seenOutcomes.current),
    ];
    previousEntities.current=entities;
    if(events.length){
      const now=performance.now();
      const perEntity=new Map<string,number>();
      const placed=events.map((event,index)=>{
        const offset=perEntity.get(event.entityId)??0;perEntity.set(event.entityId,offset+1);
        const point=pointFor(event.entityId,index);
        flashCard(event.entityId,event.kind,event.kind==="critical"?900:600);
        // Stack downwards (the float itself rises) and keep clear of the chrome above the rail.
        return {...event,x:point.x,y:Math.max(72,point.y)+offset*22,offset,until:now+life+offset*120};
      });
      setFloats((current)=>[...current.filter((entry)=>entry.until>now),...placed]);
      window.setTimeout(()=>{const at=performance.now();setFloats((current)=>current.filter((entry)=>entry.until>at));},life+events.length*120+40);
    }
    if(resolution){
      const key=`${resolution.id}:${resolution.stage}`;
      if(bannerKey.current!==key){
        const text=combatBannerText(resolution,entities);
        if(text){bannerKey.current=key;const until=performance.now()+(reduced?1400:2600);setBanner({key,...text,until});window.setTimeout(()=>setBanner((current)=>current?.key===key&&performance.now()>=until-5?null:current),reduced?1400:2600);}
      }
    }
  },[snapshot]);

  if(!floats.length&&!banner)return null;
  const stage=stageRect();
  // Below the initiative strip, above the current-turn focus.
  const bannerStyle:CSSProperties=stage?{left:stage.left+stage.width/2,top:stage.top+64}:{left:"50%",top:96};
  return createPortal(<>
    {banner&&<div key={banner.key} className={`combat-feedback-banner tone-${banner.tone}${banner.semantic?` semantic-${banner.semantic}`:""}`} style={bannerStyle} role="status" aria-live="polite">
      <span className="combat-feedback-banner-title">{banner.title}</span>
      <strong className="combat-feedback-banner-detail">{banner.detail}</strong>
    </div>}
    {floats.map((event)=><span key={event.id} className={`combat-feedback-float kind-${event.kind} tone-${event.tone}${event.semantic?` semantic-${event.semantic}`:""}`} style={{left:event.x,top:event.y}} aria-hidden="true">{event.label}</span>)}
  </>,document.body);
}
