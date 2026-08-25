import type { ActionVm, DamageComponentView, EconomyVm, ItemInstanceVm, SceneEntity } from "./contracts";
import type { Phase09NoRollDamageFact } from "./phase09ReferenceEffectFacts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import type { DamageDefenseContribution, DamageResolution, HealingResolution } from "../domain/damage";
import type { DamageRollResolution } from "../domain/damageRoll";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";

export type AtomicItemActionRequest =
  | {
      resolutionId:string;
      action:ActionVm;
      actor:SceneEntity;
      target:SceneEntity;
      economy:EconomyVm;
      items:ItemInstanceVm[];
      initiativeMode:boolean;
      kind:"healing";
      healingAmount:number;
    }
  | {
      resolutionId:string;
      action:ActionVm;
      actor:SceneEntity;
      target:SceneEntity;
      economy:EconomyVm;
      items:ItemInstanceVm[];
      initiativeMode:boolean;
      kind:"damage";
      damageFact:Phase09NoRollDamageFact;
    };

export type AtomicItemActionResult =
  | {
      status:"committed";
      actorEconomy:EconomyVm;
      items:ItemInstanceVm[];
      targetHp:number;
      targetTempHp:number;
      restored?:number;
      authoritativeDice:number[];
      damageComponent?:DamageComponentView;
      stateChanges:string[];
      provenance:string[];
      events:ResolutionEvent[];
    }
  | { status:"rejected"; error:string };

const quantityPoolId=(itemId:string)=>`phase09:item:${itemId}:quantity`;
const chargePoolId=(itemId:string)=>`phase09:item:${itemId}:charges`;

function defensesFor(target:SceneEntity):DamageDefenseContribution[] {
  return [
    ...target.resistances.map((damageType)=>({ source:`scene:${target.id}:resistance:${damageType}`,kind:"resistance" as const,damageType })),
    ...target.vulnerabilities.map((damageType)=>({ source:`scene:${target.id}:vulnerability:${damageType}`,kind:"vulnerability" as const,damageType })),
    ...target.immunities.map((damageType)=>({ source:`scene:${target.id}:immunity:${damageType}`,kind:"immunity" as const,damageType })),
  ];
}

function itemPools(items:ItemInstanceVm[],action:ActionVm) {
  if (!action.itemCost) return [];
  const item=items.find((entry)=>entry.id===action.itemCost!.itemId);
  if (!item) throw new Error(`missing item instance: ${action.itemCost.itemId}`);
  const pools=[];
  if (action.itemCost.quantity) pools.push({ id:quantityPoolId(item.id),label:`${item.name} 수량`,current:item.quantity,maximum:item.quantity });
  if (action.itemCost.charges) {
    if (!item.charges) throw new Error(`item has no charges: ${item.id}`);
    pools.push({ id:chargePoolId(item.id),label:`${item.name} 충전`,current:item.charges.current,maximum:item.charges.max });
  }
  return pools;
}

function runtimeCombatant(entity:SceneEntity,economy:EconomyVm,resources:ReturnType<typeof itemPools>=[]) {
  return {
    id:entity.id,
    baseSpeed:economy.movementMax,
    life:{ hp:{ current:entity.hp,maximum:entity.maxHp,temporary:entity.tempHp },deathSaves:{ successes:0,failures:0 },stable:false,unconscious:false,dead:false },
    economy:{ action:economy.action,bonusAction:economy.bonusAction,reaction:economy.reaction,movement:economy.movement,movementMaximum:economy.movementMax,extraActions:structuredClone(economy.extraActions??[]),extraAttacks:structuredClone(economy.extraAttacks??[]) },
    resources,
    hitDice:[],
    damageDefenses:defensesFor(entity),
  };
}

function runtimeState(request:AtomicItemActionRequest):RulesRuntimeState {
  const resources=itemPools(request.items,request.action);
  const actor=runtimeCombatant(request.actor,request.economy,resources);
  const combatants:RulesRuntimeState["combatants"]={ [request.actor.id]:actor };
  if (request.target.id!==request.actor.id) combatants[request.target.id]=runtimeCombatant(request.target,{ action:true,bonusAction:true,reaction:true,movement:30,movementMax:30 });
  return {
    revision:0,
    clock:{ round:1,elapsedSeconds:0,activeActorId:request.initiativeMode ? request.actor.id : undefined },
    combatants,effects:[],concentration:{},history:[],
  };
}

function economyOperation(action:ActionVm):ResolutionOperation|undefined {
  if (action.economy==="없음") return undefined;
  const slot=action.economy==="행동" ? "action" : action.economy==="추가 행동" ? "bonus-action" : "reaction";
  return { id:`${action.id}:economy`,kind:"use-economy",actorId:action.actorId,slot,bonusActionGranted:slot==="bonus-action" ? true : undefined,actionKind:action.category==="magic" ? "magic" : "other" };
}

function itemSpendOperation(action:ActionVm):ResolutionOperation {
  if (!action.itemCost) throw new Error(`atomic item action requires itemCost: ${action.id}`);
  if (action.itemCost.quantity) return { id:`${action.id}:item-quantity`,kind:"spend-resource",actorId:action.actorId,resourceId:quantityPoolId(action.itemCost.itemId),amount:action.itemCost.quantity };
  if (action.itemCost.charges) return { id:`${action.id}:item-charges`,kind:"spend-resource",actorId:action.actorId,resourceId:chargePoolId(action.itemCost.itemId),amount:action.itemCost.charges };
  throw new Error(`itemCost has no quantity or charges: ${action.id}`);
}

function projectItems(items:ItemInstanceVm[],action:ActionVm,state:RulesRuntimeState) {
  const next=items.map((entry)=>structuredClone(entry));
  if (!action.itemCost) return next;
  const item=next.find((entry)=>entry.id===action.itemCost!.itemId)!;
  const actor=state.combatants[action.actorId];
  if (action.itemCost.quantity) item.quantity=actor.resources.find((entry)=>entry.id===quantityPoolId(item.id))!.current;
  if (action.itemCost.charges&&item.charges) item.charges.current=actor.resources.find((entry)=>entry.id===chargePoolId(item.id))!.current;
  return next;
}

function projectEconomy(state:RulesRuntimeState,actorId:string):EconomyVm {
  const economy=state.combatants[actorId].economy;
  return { action:economy.action,bonusAction:economy.bonusAction,reaction:economy.reaction,movement:economy.movement,movementMax:economy.movementMaximum,...(economy.extraActions?.length?{extraActions:structuredClone(economy.extraActions)}:{}),...(economy.extraAttacks?.length?{extraAttacks:structuredClone(economy.extraAttacks)}:{}) };
}

function damageAdjustment(target:SceneEntity,type:string,raw:number,finalDamage:number) {
  if (target.immunities.includes(type)) return `${type} 면역 ${raw} → ${finalDamage}`;
  if (target.resistances.includes(type)&&target.vulnerabilities.includes(type)) return `${type} 저항/취약 ${raw} → ${finalDamage}`;
  if (target.resistances.includes(type)) return `${type} 저항 ${raw} → ${finalDamage}`;
  if (target.vulnerabilities.includes(type)) return `${type} 취약 ${raw} → ${finalDamage}`;
  return "조정 없음";
}

export function resolveAtomicItemAction(request:AtomicItemActionRequest):AtomicItemActionResult {
  if (!request.action.itemCost) return { status:"rejected",error:`atomic item action requires itemCost: ${request.action.id}` };
  let input:RulesRuntimeState;
  try { input=runtimeState(request); } catch(error) { return { status:"rejected",error:error instanceof Error ? error.message : String(error) }; }
  const operations:ResolutionOperation[]=[];
  let rollId:string|undefined;
  let damageId:string|undefined;
  let healingId:string|undefined;
  if (request.kind==="healing") {
    if (!Number.isInteger(request.healingAmount)||request.healingAmount<0) return { status:"rejected",error:"healing amount must be a non-negative integer" };
    healingId=`${request.action.id}:healing`;
    operations.push({ id:healingId,kind:"healing",targetId:request.target.id,amount:request.healingAmount });
  } else {
    const damageSpec=request.action.damage?.[0];
    if (!damageSpec) return { status:"rejected",error:`damage item action is missing damage spec: ${request.action.id}` };
    rollId=`${request.action.id}:damage-roll`;
    damageId=`${request.action.id}:damage`;
    operations.push({ id:rollId,kind:"damage-roll",request:{ dice:request.damageFact.dice,flat:request.damageFact.flat } });
    operations.push({ id:damageId,kind:"damage",targetId:request.target.id,damageType:damageSpec.type,amount:{ operationId:rollId,field:"total" },defenses:defensesFor(request.target),creatureKind:request.target.kind==="character" ? "character" : "monster" });
  }
  if (request.initiativeMode) {
    const economy=economyOperation(request.action);
    if (economy) operations.push(economy);
  }
  try { operations.push(itemSpendOperation(request.action)); } catch(error) { return { status:"rejected",error:error instanceof Error ? error.message : String(error) }; }
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{ id:`${request.resolutionId}:atomic-item`,actorId:request.actor.id,sourceId:request.action.id,expectedRevision:input.revision,operations });
  if (committed.status==="rejected") return { status:"rejected",error:committed.error };
  const targetAfter=committed.state.combatants[request.target.id].life.hp;
  const items=projectItems(request.items,request.action,committed.state);
  const actorEconomy=projectEconomy(committed.state,request.actor.id);
  const events=committed.events.map((event)=>structuredClone(event));
  const stateChanges:string[]=[];
  if (request.target.hp!==targetAfter.current) stateChanges.push(`${request.target.name} HP ${request.target.hp} → ${targetAfter.current}`);
  if (request.target.tempHp!==targetAfter.temporary) stateChanges.push(`${request.target.name} 임시 HP ${request.target.tempHp} → ${targetAfter.temporary}`);
  if (request.economy.action&&!actorEconomy.action) stateChanges.push("행동 사용");
  if (request.economy.bonusAction&&!actorEconomy.bonusAction) stateChanges.push("추가 행동 사용");
  const beforeItem=request.items.find((entry)=>entry.id===request.action.itemCost!.itemId)!;
  const afterItem=items.find((entry)=>entry.id===beforeItem.id)!;
  if (beforeItem.quantity!==afterItem.quantity) stateChanges.push(`${beforeItem.name} 수량 ${beforeItem.quantity} → ${afterItem.quantity}`);
  if (beforeItem.charges?.current!==afterItem.charges?.current) stateChanges.push(`${beforeItem.name} 충전 ${beforeItem.charges?.current ?? 0} → ${afterItem.charges?.current ?? 0}`);

  let authoritativeDice:number[]=[];
  let damageComponent:DamageComponentView|undefined;
  let restored:number|undefined;
  if (request.kind==="damage" && rollId && damageId) {
    const roll=committed.results[rollId] as DamageRollResolution;
    const damage=committed.results[damageId] as DamageResolution;
    authoritativeDice=roll.dice.flatMap((entry)=>entry.selectedFaces);
    damageComponent={ type:damage.damageType,roll:authoritativeDice.join(" + "),raw:damage.raw,adjusted:damage.finalDamage,adjustment:damageAdjustment(request.target,damage.damageType,damage.raw,damage.finalDamage),source:"Rules Domain · atomic item damage transaction" };
  }
  if (request.kind==="healing" && healingId) restored=(committed.results[healingId] as HealingResolution).restored;
  return {
    status:"committed",actorEconomy,items,targetHp:targetAfter.current,targetTempHp:targetAfter.temporary,restored,authoritativeDice,damageComponent,stateChanges,
    provenance:events.flatMap((event)=>event.provenance.map((entry)=>`${entry.source} · ${entry.status} · ${entry.reason}`)),events,
  };
}
