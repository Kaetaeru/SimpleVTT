import { effectIsActive } from "../domain/effects";
import type { ActionVm, ActivityEntry, EconomyVm, ResolutionView, SceneEntity, SceneVm, SessionRefusalVm } from "../app/contracts";
import { conditionLabelKo } from "../app/srdMonsterCatalog";
import { actionsFor, actorAc } from "./actors";
import { availabilityOf, eligibleTargetIds } from "./availability";
import type { TableRefusal } from "./refusal";
import { actorIds, type Actor, type TableMode, type TableState } from "./state";

export const PUBLIC_EFFECT_PREFIX="✦ ";
const BADGE_LABEL:Record<string,string>={hidden:"숨음","cover-half":"엄폐 절반","cover-three-quarters":"엄폐 ¾"};

export interface TableViewer {
  role:"dm"|"player";
  peerId?:string;
}

export interface TableView {
  sessionMode:TableMode;
  scene:SceneVm;
  activity:ActivityEntry[];
  resolution:ResolutionView|null;
  refusal:SessionRefusalVm|null;
}

/** Displayed AC: the source's AC plus active effect bonuses and floors, as the kernel judges attacks. */
export function displayedAc(state:TableState,actor:Actor):number {
  let ac=actorAc(actor);
  for(const effect of state.rules.effects) {
    if(!effectIsActive(effect)||effect.kind!=="modifier"||effect.targetId!==actor.id) continue;
    const bonus=typeof effect.metadata?.acBonus==="number"?effect.metadata.acBonus:0;
    ac+=bonus;
    const floor=typeof effect.metadata?.acFloor==="number"?effect.metadata.acFloor:0;
    if(floor&&ac<floor) ac=floor;
  }
  return ac;
}

export function statusChips(state:TableState,actor:Actor,viewer:TableViewer):string[] {
  const combatant=state.rules.combatants[actor.id];
  const chips:string[]=[];
  if(combatant?.life.dead) chips.push("사망");
  else if(combatant&&combatant.life.hp.current<=0) chips.push(combatant.life.stable?"안정":`의식불명 · 성공 ${combatant.life.deathSaves.successes} 실패 ${combatant.life.deathSaves.failures}`);
  const seen=new Set<string>();
  for(const effect of state.rules.effects) {
    if(effect.targetId!==actor.id||!effectIsActive(effect)) continue;
    const label=effect.kind==="condition"&&effect.conditionId?conditionLabelKo(effect.conditionId):typeof effect.metadata?.publicLabel==="string"?effect.metadata.publicLabel:null;
    if(!label||seen.has(label)) continue;
    seen.add(label);
    chips.push(`${PUBLIC_EFFECT_PREFIX}${label}`);
  }
  for(const badge of actor.badges) if(viewer.role==="dm"||badge!=="hidden") chips.push(BADGE_LABEL[badge]??badge);
  return chips;
}

function economyView(state:TableState,actorId:string):EconomyVm {
  const economy=state.rules.combatants[actorId]?.economy;
  if(!economy) return {action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  return {action:economy.action,bonusAction:economy.bonusAction,reaction:economy.reaction,movement:economy.movement,movementMax:economy.movementMaximum,...(economy.extraActions?.length?{extraActions:economy.extraActions}:{}),...(economy.extraAttacks?.length?{extraAttacks:economy.extraAttacks}:{})};
}

function entityFor(state:TableState,actor:Actor,viewer:TableViewer):SceneEntity {
  const combatant=state.rules.combatants[actor.id];
  const defenses=combatant?.damageDefenses??[];
  const entity:SceneEntity&{runtimeLife?:unknown;engagement?:string[]}={
    id:actor.id,name:actor.name,side:actor.side,kind:actor.kind==="character"?"character":"combatant",
    hp:combatant?.life.hp.current??0,maxHp:combatant?.life.hp.maximum??0,tempHp:combatant?.life.hp.temporary??0,ac:displayedAc(state,actor),
    initiative:actor.initiative,status:statusChips(state,actor,viewer),
    resistances:defenses.filter((entry)=>entry.kind==="resistance").map((entry)=>entry.damageType),
    immunities:defenses.filter((entry)=>entry.kind==="immunity").map((entry)=>entry.damageType),
    vulnerabilities:defenses.filter((entry)=>entry.kind==="vulnerability").map((entry)=>entry.damageType),
    reactions:[],
    ...(actor.controllerPeer?{controllerId:actor.controllerPeer}:{}),
  };
  if(combatant) entity.runtimeLife={deathSaves:{...combatant.life.deathSaves},stable:combatant.life.stable,unconscious:combatant.life.unconscious,dead:combatant.life.dead};
  entity.engagement=[...actor.engagement];
  return entity;
}

export function projectedActions(state:TableState,actor:Actor):ActionVm[] {
  return actionsFor(actor).map((action)=>{
    const availability=availabilityOf(state,action);
    return {...action,eligibleTargetIds:eligibleTargetIds(state,action),available:availability.available,...(availability.reason?{disabledReason:availability.reason}:{})};
  });
}

export function projectTable(state:TableState,viewer:TableViewer,refusal?:(TableRefusal&{id:number})|null):TableView {
  const visible=actorIds(state).filter((id)=>state.actors[id]&&(viewer.role==="dm"||!state.actors[id].hidden));
  const entities=visible.map((id)=>entityFor(state,state.actors[id],viewer));
  const actionsByActor=Object.fromEntries(visible.map((id)=>[id,projectedActions(state,state.actors[id])]));
  const economyByActor=Object.fromEntries(visible.map((id)=>[id,economyView(state,id)]));
  const scene:SceneVm={id:state.sessionId,name:"",round:state.round,currentActorId:state.currentActorId??"",selectedActorId:"",entities,actionsByActor,economyByActor};
  const activity:ActivityEntry[]=state.log.filter((entry)=>viewer.role==="dm"||entry.visibility==="public").map((entry)=>({
    id:entry.id,time:entry.time,actor:entry.actor,title:entry.title,summary:entry.summary,detail:[...entry.detail],stateChanges:[...entry.stateChanges],
    ...(entry.ruling?{ruling:entry.ruling}:{}),...(entry.undoOf?{undoOf:entry.undoOf}:{}),...(entry.reversed?{reversed:true}:{}),
  }));
  const resolution=state.activeResolution&&(viewer.role==="dm"||state.activeResolution.visibility==="public")?state.activeResolution:null;
  return {
    sessionMode:state.mode,scene,activity,resolution,
    refusal:refusal?{id:refusal.id,code:refusal.code,message:refusal.message,origin:"local",...(refusal.actionId?{actionId:refusal.actionId}:{}),...(refusal.actorId?{actorId:refusal.actorId}:{})}:null,
  };
}
