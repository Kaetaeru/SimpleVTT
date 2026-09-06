import type { ResolutionView, SceneEntity } from "./contracts";
import { combatDamageSemantic } from "./combatVisuals";

/**
 * V1.5 F1-01 — combat feedback events.
 *
 * What the table must see the moment a roll lands: the number that came off (or onto) a creature, whether an
 * attack missed or crit, whether a saving throw held, when someone goes down. Everything here is derived from two
 * consecutive snapshots (entity HP/status deltas) and the resolution view, so it reads the same on the Host and on
 * every player: the same events reach every peer, and every peer derives the same feedback from them.
 */
export type CombatFeedbackKind="damage"|"heal"|"temp-hp"|"miss"|"critical"|"save-success"|"save-failure"|"check-success"|"check-failure"|"down"|"revive"|"condition";

export interface CombatFeedbackEvent {
  id:string;
  kind:CombatFeedbackKind;
  entityId:string;
  entityName:string;
  /** Damage/heal amount, save/check total. */
  amount?:number;
  /** The damage type as the rules name it ("참격", "광휘"). */
  damageType?:string;
  /** The VFX semantic of the damage type ("fire", "slashing", …) for colour. */
  semantic:string|null;
  label:string;
  tone:"bad"|"good"|"info"|"neutral"|"crit";
  resolutionId?:string;
}

export interface CombatFeedbackSnapshotView {
  entities:SceneEntity[];
  resolution:ResolutionView|null;
}

function targetDamageType(resolution:ResolutionView|null,entityId:string):string|undefined {
  if(!resolution||!resolution.targetIds.includes(entityId)) return undefined;
  const component=resolution.damageComponents.find((entry)=>entry.adjusted>0)??resolution.damageComponents[0];
  return component?.type;
}

/** HP/temp-HP/status deltas between two consecutive snapshots. */
export function diffCombatFeedback(previous:SceneEntity[]|null,next:SceneEntity[],resolution:ResolutionView|null,sequence:number):CombatFeedbackEvent[] {
  if(!previous) return [];
  const before=new Map(previous.map((entity)=>[entity.id,entity]));
  const events:CombatFeedbackEvent[]=[];
  for(const entity of next){
    const prior=before.get(entity.id);
    if(!prior) continue;
    const hpDelta=entity.hp-prior.hp;
    const tempDelta=(entity.tempHp??0)-(prior.tempHp??0);
    if(hpDelta<0){
      const damageType=targetDamageType(resolution,entity.id);
      const semantic=damageType?combatDamageSemantic(damageType):null;
      events.push({id:`${sequence}:${entity.id}:damage`,kind:"damage",entityId:entity.id,entityName:entity.name,amount:-hpDelta,damageType,semantic,label:`−${-hpDelta}${damageType?` ${damageType}`:""}`,tone:"bad",resolutionId:resolution?.id});
      if(entity.hp<=0&&prior.hp>0) events.push({id:`${sequence}:${entity.id}:down`,kind:"down",entityId:entity.id,entityName:entity.name,semantic:null,label:"쓰러짐",tone:"bad",resolutionId:resolution?.id});
    }else if(hpDelta>0){
      const revive=prior.hp<=0;
      events.push({id:`${sequence}:${entity.id}:${revive?"revive":"heal"}`,kind:revive?"revive":"heal",entityId:entity.id,entityName:entity.name,amount:hpDelta,semantic:null,label:revive?`+${hpDelta} 일어남`:`+${hpDelta}`,tone:"good",resolutionId:resolution?.id});
    }
    if(tempDelta>0) events.push({id:`${sequence}:${entity.id}:temp`,kind:"temp-hp",entityId:entity.id,entityName:entity.name,amount:tempDelta,semantic:null,label:`+${tempDelta} 임시`,tone:"info",resolutionId:resolution?.id});
    // Temporary HP soaking a hit is damage the table should see too.
    else if(tempDelta<0) events.push({id:`${sequence}:${entity.id}:temp-loss`,kind:"temp-hp",entityId:entity.id,entityName:entity.name,amount:tempDelta,semantic:null,label:`−${-tempDelta} 임시`,tone:"info",resolutionId:resolution?.id});
    const priorStatus=new Set(prior.status);
    for(const status of entity.status){
      if(priorStatus.has(status)||/^교전/.test(status)) continue;
      events.push({id:`${sequence}:${entity.id}:status:${status}`,kind:"condition",entityId:entity.id,entityName:entity.name,semantic:null,label:status,tone:"info",resolutionId:resolution?.id});
    }
  }
  return events;
}

/** Outcome feedback read off a resolution as it advances: miss, critical, saves and checks. Keyed so a stage fires once. */
export function resolutionFeedback(resolution:ResolutionView|null,entities:SceneEntity[],seen:Set<string>):CombatFeedbackEvent[] {
  if(!resolution) return [];
  const events:CombatFeedbackEvent[]=[];
  const nameOf=(id:string)=>entities.find((entity)=>entity.id===id)?.name??id;
  const once=(key:string,event:CombatFeedbackEvent)=>{const full=`${resolution.id}:${key}`;if(seen.has(full))return;seen.add(full);events.push(event);};
  // Everything lands when the resolution completes: the numbers (HP deltas), the miss, the crit and the saves arrive together.
  const landed=resolution.stage==="complete";
  if(landed&&resolution.attackOutcome==="빗나감"){
    for(const targetId of resolution.targetIds) once(`miss:${targetId}`,{id:`${resolution.id}:miss:${targetId}`,kind:"miss",entityId:targetId,entityName:nameOf(targetId),semantic:null,label:"빗나감",tone:"neutral",resolutionId:resolution.id});
  }
  if(landed&&resolution.attackOutcome==="명중"&&resolution.critical){
    for(const targetId of resolution.targetIds) once(`critical:${targetId}`,{id:`${resolution.id}:critical:${targetId}`,kind:"critical",entityId:targetId,entityName:nameOf(targetId),semantic:null,label:"치명타!",tone:"crit",resolutionId:resolution.id});
  }
  if(landed){
    for(const save of resolution.saveResults){
      const success=save.outcome==="성공";
      once(`save:${save.targetId}`,{id:`${resolution.id}:save:${save.targetId}`,kind:success?"save-success":"save-failure",entityId:save.targetId,entityName:save.targetName,amount:save.total,semantic:null,label:`내성 ${save.outcome} · ${save.total} vs DC ${save.dc}`,tone:success?"good":"bad",resolutionId:resolution.id});
    }
  }
  if(resolution.stage==="complete"&&resolution.checkOutcome&&resolution.checkTarget!==undefined){
    const success=resolution.checkOutcome==="성공";
    once("check",{id:`${resolution.id}:check`,kind:success?"check-success":"check-failure",entityId:resolution.actorId,entityName:nameOf(resolution.actorId),amount:resolution.rollTotal,semantic:null,label:`판정 ${resolution.checkOutcome} · ${resolution.rollTotal??"—"} vs DC ${resolution.checkTarget}`,tone:success?"good":"bad",resolutionId:resolution.id});
  }
  return events;
}

/** One line for the stage banner: who did what to whom, and what came of it. */
export function combatBannerText(resolution:ResolutionView,entities:SceneEntity[]):{title:string;detail:string;tone:CombatFeedbackEvent["tone"];semantic:string|null}|null {
  // One banner per resolution, when it is settled: an attack-result banner followed by a damage banner would read as two events.
  if(resolution.stage!=="complete") return null;
  const nameOf=(id:string)=>entities.find((entity)=>entity.id===id)?.name??id;
  const targets=resolution.targetIds.filter((id)=>id!==resolution.actorId).map(nameOf);
  const title=`${nameOf(resolution.actorId)} · ${resolution.actionName}${targets.length?` → ${targets.join(", ")}`:""}`;
  const damage=resolution.damageComponents.reduce((sum,component)=>sum+Math.max(0,component.adjusted),0);
  const damageType=resolution.damageComponents.find((component)=>component.adjusted>0)?.type;
  const semantic=damageType?combatDamageSemantic(damageType):null;
  if(resolution.attackOutcome==="빗나감") return {title,detail:"빗나감",tone:"neutral",semantic:null};
  if(resolution.attackOutcome==="명중") return {title,detail:`${resolution.critical?"치명타 · ":""}명중${damage?` · ${damage} ${damageType??""} 피해`:""}`.trim(),tone:resolution.critical?"crit":"bad",semantic};
  if(resolution.saveResults.length){
    const failed=resolution.saveResults.filter((save)=>save.outcome==="실패").length;
    return {title,detail:`내성 ${resolution.saveResults.length-failed} 성공 · ${failed} 실패${damage?` · ${damage} ${damageType??""} 피해`:""}`.trim(),tone:failed?"bad":"good",semantic};
  }
  if(resolution.rollKind==="healing") return {title,detail:resolution.finalOutcome||"회복",tone:"good",semantic:null};
  if(resolution.checkOutcome) return {title,detail:`판정 ${resolution.checkOutcome} · ${resolution.rollTotal??"—"} vs DC ${resolution.checkTarget??"?"}`,tone:resolution.checkOutcome==="성공"?"good":"bad",semantic:null};
  if(resolution.stage==="complete") return {title,detail:resolution.finalOutcome||resolution.compact,tone:"info",semantic};
  return null;
}
