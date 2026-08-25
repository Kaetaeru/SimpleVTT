import type { ActionVm, CharacterResourceVm, EconomyVm, SceneEntity } from "./contracts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionOperation } from "../domain/resolutionTypes";

export interface ActionCostTransactionRequest {
  resolutionId:string;
  action:ActionVm;
  actor:Pick<SceneEntity,"id"|"hp"|"maxHp"|"tempHp">;
  economy:EconomyVm;
  resources:CharacterResourceVm[];
  initiativeMode:boolean;
}

export type ActionCostTransactionResult =
  | {
      status:"committed";
      economy:EconomyVm;
      resources:CharacterResourceVm[];
      stateChanges:string[];
      provenance:string[];
      eventCount:number;
    }
  | {
      status:"rejected";
      error:string;
      economy:EconomyVm;
      resources:CharacterResourceVm[];
      stateChanges:[];
      provenance:[];
      eventCount:0;
    };

function cloneResources(resources:CharacterResourceVm[]) {
  return resources.map((resource) => ({ ...resource }));
}

function economyOperation(action:ActionVm):ResolutionOperation|undefined {
  if (action.economy === "없음") return undefined;
  const slot = action.economy === "행동"
    ? "action"
    : action.economy === "추가 행동"
      ? "bonus-action"
      : "reaction";
  return {
    id:`${action.id}:economy`,
    kind:"use-economy",
    actorId:action.actorId,
    slot,
    bonusActionGranted:slot === "bonus-action" ? true : undefined,
    actionKind:action.category === "magic" ? "magic" : "other",
  };
}

function runtimeState(request:ActionCostTransactionRequest):RulesRuntimeState {
  return {
    revision:0,
    clock:{
      round:1,
      elapsedSeconds:0,
      activeActorId:request.initiativeMode ? request.actor.id : undefined,
    },
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
        resources:request.resources.map((resource) => ({
          id:resource.id,
          label:resource.label,
          current:resource.current,
          maximum:resource.max,
        })),
        hitDice:[],
      },
    },
    effects:[],
    concentration:{},
    history:[],
  };
}

function projectStateChanges(
  beforeEconomy:EconomyVm,
  afterEconomy:EconomyVm,
  beforeResources:CharacterResourceVm[],
  afterResources:CharacterResourceVm[],
) {
  const changes:string[] = [];
  if (beforeEconomy.action && !afterEconomy.action) changes.push("행동 사용");
  if (beforeEconomy.bonusAction && !afterEconomy.bonusAction) changes.push("추가 행동 사용");
  if (beforeEconomy.reaction && !afterEconomy.reaction) changes.push("반응 사용");
  for (const before of beforeResources) {
    const after = afterResources.find((resource) => resource.id === before.id);
    if (after && before.current !== after.current) changes.push(`${before.label} ${before.current} → ${after.current}`);
  }
  return changes;
}

export function resolveActionCostTransaction(request:ActionCostTransactionRequest):ActionCostTransactionResult {
  const beforeResources = cloneResources(request.resources);
  const operations:ResolutionOperation[] = [];
  if (request.initiativeMode) {
    const economy = economyOperation(request.action);
    if (economy) operations.push(economy);
  }
  if (request.action.resourceCost) {
    operations.push({
      id:`${request.action.id}:resource`,
      kind:"spend-resource",
      actorId:request.action.actorId,
      resourceId:request.action.resourceCost.resourceId,
      amount:request.action.resourceCost.amount,
    });
  }

  if (operations.length === 0) {
    return {
      status:"committed",
      economy:{ ...request.economy },
      resources:beforeResources,
      stateChanges:[],
      provenance:[],
      eventCount:0,
    };
  }

  const input = runtimeState(request);
  const committed = resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,input,{
    id:`${request.resolutionId}:costs`,
    actorId:request.actor.id,
    sourceId:request.action.id,
    expectedRevision:input.revision,
    operations,
  });
  if (committed.status === "rejected") {
    return {
      status:"rejected",
      error:committed.error,
      economy:{ ...request.economy },
      resources:beforeResources,
      stateChanges:[],
      provenance:[],
      eventCount:0,
    };
  }

  const actor = committed.state.combatants[request.actor.id];
  const economy:EconomyVm = {
    action:actor.economy.action,
    bonusAction:actor.economy.bonusAction,
    reaction:actor.economy.reaction,
    movement:actor.economy.movement,
    movementMax:actor.economy.movementMaximum,
    ...(actor.economy.extraActions?.length?{extraActions:structuredClone(actor.economy.extraActions)}:{}),
    ...(actor.economy.extraAttacks?.length?{extraAttacks:structuredClone(actor.economy.extraAttacks)}:{}),
  };
  const resources = beforeResources.map((resource) => {
    const pool = actor.resources.find((entry) => entry.id === resource.id);
    return pool ? { ...resource, current:pool.current, max:pool.maximum } : resource;
  });
  return {
    status:"committed",
    economy,
    resources,
    stateChanges:projectStateChanges(request.economy,economy,beforeResources,resources),
    provenance:committed.events.flatMap((event) => event.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`)),
    eventCount:committed.events.length,
  };
}
