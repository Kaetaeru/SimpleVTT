import type { ActionVm, CharacterResourceVm, EconomyVm, SceneEntity } from "./contracts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";

export interface AtomicSelfHealingRequest {
  resolutionId:string;
  action:ActionVm;
  actor:SceneEntity;
  economy:EconomyVm;
  resources:CharacterResourceVm[];
  initiativeMode:boolean;
  healingAmount:number;
}

export type AtomicSelfHealingResult =
  | {
      status:"committed";
      hp:number;
      tempHp:number;
      restored:number;
      economy:EconomyVm;
      resources:CharacterResourceVm[];
      stateChanges:string[];
      provenance:string[];
      events:ResolutionEvent[];
    }
  | { status:"rejected"; error:string };

function runtimeState(request:AtomicSelfHealingRequest):RulesRuntimeState {
  return {
    revision:0,
    clock:{ round:1, elapsedSeconds:0, activeActorId:request.initiativeMode ? request.actor.id : undefined },
    combatants:{
      [request.actor.id]:{
        id:request.actor.id,
        baseSpeed:request.economy.movementMax,
        life:{
          hp:{ current:request.actor.hp, maximum:request.actor.maxHp, temporary:request.actor.tempHp },
          deathSaves:{ successes:0, failures:0 },
          stable:false,
          unconscious:false,
          dead:false,
        },
        economy:{
          action:request.economy.action,
          bonusAction:request.economy.bonusAction,
          reaction:request.economy.reaction,
          movement:request.economy.movement,
          movementMaximum:request.economy.movementMax,
          extraActions:structuredClone(request.economy.extraActions ?? []),
          extraAttacks:structuredClone(request.economy.extraAttacks ?? []),
        },
        resources:request.resources.map((resource)=>({ id:resource.id,label:resource.label,current:resource.current,maximum:resource.max })),
        hitDice:[],
      },
    },
    effects:[],
    concentration:{},
    history:[],
  };
}

function economyOperation(action:ActionVm):ResolutionOperation|undefined {
  if (action.economy==="없음") return undefined;
  const slot=action.economy==="행동" ? "action" : action.economy==="추가 행동" ? "bonus-action" : "reaction";
  return {
    id:`${action.id}:economy`,kind:"use-economy",actorId:action.actorId,slot,
    bonusActionGranted:slot==="bonus-action" ? true : undefined,
    actionKind:action.category==="magic" ? "magic" : "other",
  };
}

export function resolveAtomicSelfHealing(request:AtomicSelfHealingRequest):AtomicSelfHealingResult {
  if (request.action.target!=="self" || request.action.resolutionKind!=="healing") {
    return { status:"rejected", error:`atomic self healing requires a self-target healing action: ${request.action.id}` };
  }
  if (!Number.isInteger(request.healingAmount) || request.healingAmount<0) {
    return { status:"rejected", error:"healing amount must be a non-negative integer" };
  }
  const operations:ResolutionOperation[]=[{
    id:`${request.action.id}:healing`,kind:"healing",targetId:request.actor.id,amount:request.healingAmount,
  }];
  if (request.initiativeMode) {
    const economy=economyOperation(request.action);
    if (economy) operations.push(economy);
  }
  if (request.action.resourceCost) {
    operations.push({
      id:`${request.action.id}:resource`,kind:"spend-resource",actorId:request.actor.id,
      resourceId:request.action.resourceCost.resourceId,amount:request.action.resourceCost.amount,
    });
  }
  const input=runtimeState(request);
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{
    id:`${request.resolutionId}:atomic-healing`,actorId:request.actor.id,sourceId:request.action.id,expectedRevision:input.revision,operations,
  });
  if (committed.status==="rejected") return { status:"rejected", error:committed.error };
  const actor=committed.state.combatants[request.actor.id];
  const economy:EconomyVm={
    action:actor.economy.action,bonusAction:actor.economy.bonusAction,reaction:actor.economy.reaction,
    movement:actor.economy.movement,movementMax:actor.economy.movementMaximum,
    ...(actor.economy.extraActions?.length?{extraActions:structuredClone(actor.economy.extraActions)}:{}),
    ...(actor.economy.extraAttacks?.length?{extraAttacks:structuredClone(actor.economy.extraAttacks)}:{}),
  };
  const resources=request.resources.map((resource)=>{
    const pool=actor.resources.find((entry)=>entry.id===resource.id);
    return pool ? { ...resource,current:pool.current,max:pool.maximum } : { ...resource };
  });
  const restored=actor.life.hp.current-request.actor.hp;
  const stateChanges:string[]=[];
  if (request.actor.hp!==actor.life.hp.current) stateChanges.push(`${request.actor.name} HP ${request.actor.hp} → ${actor.life.hp.current}`);
  if (request.economy.action&&!economy.action) stateChanges.push("행동 사용");
  if (request.economy.bonusAction&&!economy.bonusAction) stateChanges.push("추가 행동 사용");
  if (request.economy.reaction&&!economy.reaction) stateChanges.push("반응 사용");
  for (const before of request.resources) {
    const after=resources.find((entry)=>entry.id===before.id);
    if (after&&after.current!==before.current) stateChanges.push(`${before.label} ${before.current} → ${after.current}`);
  }
  const events=committed.events.map((event)=>structuredClone(event));
  return {
    status:"committed",hp:actor.life.hp.current,tempHp:actor.life.hp.temporary,restored,economy,resources,stateChanges,
    provenance:events.flatMap((event)=>event.provenance.map((entry)=>`${entry.source} · ${entry.status} · ${entry.reason}`)),events,
  };
}
