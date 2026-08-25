import type { ActionVm, DamageComponentView, EconomyVm, SceneEntity } from "./contracts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import type { DamageDefenseContribution, DamageResolution } from "../domain/damage";
import type { D20TestResult } from "../domain/d20";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionEvent, ResolutionOperation } from "../domain/resolutionTypes";

export interface AtomicSavingThrowTarget {
  entity:SceneEntity;
  economy:EconomyVm;
  modifier:number;
  modifierSource:string;
  d20:number;
  expectedTotal:number;
  expectedOutcome:"성공"|"실패";
}

export interface AtomicSavingThrowTransactionRequest {
  resolutionId:string;
  action:ActionVm;
  actor:SceneEntity;
  actorEconomy:EconomyVm;
  targets:AtomicSavingThrowTarget[];
  initiativeMode:boolean;
}

export type AtomicSavingThrowTransactionResult =
  | {
      status:"committed";
      actorEconomy:EconomyVm;
      targets:Array<{
        id:string;
        hp:number;
        tempHp:number;
        d20:number;
        total:number;
        outcome:"성공"|"실패";
        finalDamage:number;
      }>;
      damageComponents:DamageComponentView[];
      stateChanges:string[];
      provenance:string[];
      events:ResolutionEvent[];
    }
  | { status:"rejected"; error:string };

function defensesFor(target:SceneEntity):DamageDefenseContribution[] {
  return [
    ...target.resistances.map((damageType)=>({ source:`scene:${target.id}:resistance:${damageType}`,kind:"resistance" as const,damageType })),
    ...target.vulnerabilities.map((damageType)=>({ source:`scene:${target.id}:vulnerability:${damageType}`,kind:"vulnerability" as const,damageType })),
    ...target.immunities.map((damageType)=>({ source:`scene:${target.id}:immunity:${damageType}`,kind:"immunity" as const,damageType })),
  ];
}

function runtimeCombatant(entity:SceneEntity,economy:EconomyVm) {
  return {
    id:entity.id,
    baseSpeed:economy.movementMax,
    life:{
      hp:{ current:entity.hp,maximum:entity.maxHp,temporary:entity.tempHp },
      deathSaves:{ successes:0,failures:0 },
      stable:false,
      unconscious:false,
      dead:false,
    },
    economy:{
      action:economy.action,
      bonusAction:economy.bonusAction,
      reaction:economy.reaction,
      movement:economy.movement,
      movementMaximum:economy.movementMax,
      extraActions:structuredClone(economy.extraActions ?? []),
      extraAttacks:structuredClone(economy.extraAttacks ?? []),
    },
    resources:[],
    hitDice:[],
    damageDefenses:defensesFor(entity),
  };
}

function runtimeState(request:AtomicSavingThrowTransactionRequest):RulesRuntimeState {
  const combatants:RulesRuntimeState["combatants"]={
    [request.actor.id]:runtimeCombatant(request.actor,request.actorEconomy),
  };
  for (const target of request.targets) {
    if (combatants[target.entity.id]) throw new Error(`duplicate atomic saving-throw combatant: ${target.entity.id}`);
    combatants[target.entity.id]=runtimeCombatant(target.entity,target.economy);
  }
  return {
    revision:0,
    clock:{ round:1,elapsedSeconds:0,activeActorId:request.initiativeMode ? request.actor.id : undefined },
    combatants,
    effects:[],
    concentration:{},
    history:[],
  };
}

function economyOperation(action:ActionVm):ResolutionOperation|undefined {
  if (action.economy==="없음") return undefined;
  const slot=action.economy==="행동" ? "action" : action.economy==="추가 행동" ? "bonus-action" : "reaction";
  return {
    id:`${action.id}:economy`,
    kind:"use-economy",
    actorId:action.actorId,
    slot,
    bonusActionGranted:slot==="bonus-action" ? true : undefined,
    actionKind:action.category==="magic" ? "magic" : "other",
  };
}

function projectEconomy(state:RulesRuntimeState,actorId:string):EconomyVm {
  const economy=state.combatants[actorId].economy;
  return {
    action:economy.action,
    bonusAction:economy.bonusAction,
    reaction:economy.reaction,
    movement:economy.movement,
    movementMax:economy.movementMaximum,
    ...(economy.extraActions?.length?{extraActions:structuredClone(economy.extraActions)}:{}),
    ...(economy.extraAttacks?.length?{extraAttacks:structuredClone(economy.extraAttacks)}:{}),
  };
}

function damageAdjustment(target:SceneEntity,type:string,raw:number,finalDamage:number) {
  if (target.immunities.includes(type)) return `${type} 면역 ${raw} → ${finalDamage}`;
  if (target.resistances.includes(type)&&target.vulnerabilities.includes(type)) return `${type} 저항/취약 ${raw} → ${finalDamage}`;
  if (target.resistances.includes(type)) return `${type} 저항 ${raw} → ${finalDamage}`;
  if (target.vulnerabilities.includes(type)) return `${type} 취약 ${raw} → ${finalDamage}`;
  return "조정 없음";
}

export function resolveAtomicSavingThrowTransaction(request:AtomicSavingThrowTransactionRequest):AtomicSavingThrowTransactionResult {
  if (request.action.resolutionKind!=="saving-throw") {
    return { status:"rejected",error:`atomic saving throw requires a saving-throw action: ${request.action.id}` };
  }
  const dc=request.action.saveDc;
  const damageSpec=request.action.damage?.[0];
  if (!Number.isFinite(dc)) return { status:"rejected",error:`atomic saving throw requires a finite DC: ${request.action.id}` };
  if (!damageSpec) return { status:"rejected",error:`atomic saving throw requires one damage component: ${request.action.id}` };
  if (request.targets.length===0) return { status:"rejected",error:"atomic saving throw requires at least one target" };
  if (!Number.isInteger(damageSpec.average)||damageSpec.average<0) {
    return { status:"rejected",error:`atomic saving throw requires a non-negative integer average damage: ${request.action.id}` };
  }

  let input:RulesRuntimeState;
  try { input=runtimeState(request); }
  catch(error) { return { status:"rejected",error:error instanceof Error ? error.message : String(error) }; }

  const operations:ResolutionOperation[]=[];
  const ids=new Map<string,{ save:string; failure:string; success:string }>();
  const ability=request.action.saveAbility ?? "내성";
  for (const target of request.targets) {
    const saveId=`${request.action.id}:save:${target.entity.id}`;
    const failureId=`${request.action.id}:damage-failure:${target.entity.id}`;
    const successId=`${request.action.id}:damage-success:${target.entity.id}`;
    ids.set(target.entity.id,{ save:saveId,failure:failureId,success:successId });
    operations.push({
      id:saveId,
      kind:"d20",
      actorId:target.entity.id,
      targetId:request.actor.id,
      request:{
        family:"saving-throw",
        target:dc!,
        targetSource:`action:${request.action.id}:save-dc`,
        modifierContributions:[{ source:target.modifierSource,value:target.modifier }],
        dice:{
          id:`${request.resolutionId}:${target.entity.id}:d20`,
          purpose:`${request.action.name} · ${target.entity.name} ${ability} 내성`,
          sides:20,
          faces:[target.d20],
        },
      },
    });
    operations.push({
      id:failureId,
      kind:"damage",
      targetId:target.entity.id,
      damageType:damageSpec.type,
      amount:damageSpec.average,
      creatureKind:target.entity.kind==="character" ? "character" : "monster",
      when:{ operationId:saveId,field:"outcome",equals:"failure" },
    });
    operations.push({
      id:successId,
      kind:"damage",
      targetId:target.entity.id,
      damageType:damageSpec.type,
      amount:request.action.saveHalf ? Math.floor(damageSpec.average/2) : 0,
      creatureKind:target.entity.kind==="character" ? "character" : "monster",
      when:{ operationId:saveId,field:"outcome",equals:"success" },
    });
  }
  if (request.initiativeMode) {
    const economy=economyOperation(request.action);
    if (economy) operations.push(economy);
  }

  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{
    id:`${request.resolutionId}:atomic-saving-throw`,
    actorId:request.actor.id,
    sourceId:request.action.id,
    expectedRevision:input.revision,
    operations,
  });
  if (committed.status==="rejected") return { status:"rejected",error:committed.error };

  const projectedTargets=[] as Extract<AtomicSavingThrowTransactionResult,{ status:"committed" }>["targets"];
  const damageComponents:DamageComponentView[]=[];
  const stateChanges:string[]=[];
  for (const target of request.targets) {
    const operationIds=ids.get(target.entity.id)!;
    const save=committed.results[operationIds.save] as D20TestResult;
    const expectedOutcome=target.expectedOutcome==="성공" ? "success" : "failure";
    if (save.natural!==target.d20||save.total!==target.expectedTotal||save.outcome!==expectedOutcome) {
      return {
        status:"rejected",
        error:`saving-throw preview drift for ${target.entity.id}: expected d20 ${target.d20}, total ${target.expectedTotal}, ${expectedOutcome}; domain produced d20 ${save.natural}, total ${save.total}, ${save.outcome}`,
      };
    }
    const damageId=save.outcome==="success" ? operationIds.success : operationIds.failure;
    const damage=committed.results[damageId] as DamageResolution;
    const life=committed.state.combatants[target.entity.id].life.hp;
    const outcome=(save.outcome==="success" ? "성공" : "실패") as "성공"|"실패";
    projectedTargets.push({
      id:target.entity.id,
      hp:life.current,
      tempHp:life.temporary,
      d20:save.natural,
      total:save.total,
      outcome,
      finalDamage:damage.finalDamage,
    });
    if (target.entity.tempHp!==life.temporary) stateChanges.push(`${target.entity.name} 임시 HP ${target.entity.tempHp} → ${life.temporary}`);
    if (target.entity.hp!==life.current) stateChanges.push(`${target.entity.name} HP ${target.entity.hp} → ${life.current}`);
    damageComponents.push({
      type:damage.damageType,
      roll:String(damage.raw),
      raw:damage.raw,
      adjusted:damage.finalDamage,
      adjustment:damageAdjustment(target.entity,damage.damageType,damage.raw,damage.finalDamage),
      source:`${target.entity.name} · Rules Domain · atomic saving-throw transaction`,
    });
  }

  const actorEconomy=projectEconomy(committed.state,request.actor.id);
  if (request.actorEconomy.action&&!actorEconomy.action) stateChanges.push("행동 사용");
  if (request.actorEconomy.bonusAction&&!actorEconomy.bonusAction) stateChanges.push("추가 행동 사용");
  if (request.actorEconomy.reaction&&!actorEconomy.reaction) stateChanges.push("반응 사용");
  const events=committed.events.map((event)=>structuredClone(event));
  return {
    status:"committed",
    actorEconomy,
    targets:projectedTargets,
    damageComponents,
    stateChanges,
    provenance:events.flatMap((event)=>event.provenance.map((entry)=>`${entry.source} · ${entry.status} · ${entry.reason}`)),
    events,
  };
}
