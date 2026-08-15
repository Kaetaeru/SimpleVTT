import type { ActionVm, EconomyVm, ItemInstanceVm, SceneEntity } from "./contracts";
import { SIMPLEVTT_APP_RULES_PROFILE } from "./realResolutionService";
import type { RulesRuntimeState } from "../domain/combatState";
import { resolvePendingResolution } from "../domain/resolution";
import type { ResolutionOperation } from "../domain/resolutionTypes";

export interface ItemCostTransactionRequest {
  resolutionId:string;
  action:ActionVm;
  actor:Pick<SceneEntity,"id"|"hp"|"maxHp"|"tempHp">;
  economy:EconomyVm;
  items:ItemInstanceVm[];
  initiativeMode:boolean;
}

export type ItemCostTransactionResult =
  | { status:"committed"; economy:EconomyVm; items:ItemInstanceVm[]; stateChanges:string[]; provenance:string[]; eventCount:number }
  | { status:"rejected"; error:string; economy:EconomyVm; items:ItemInstanceVm[]; stateChanges:[]; provenance:[]; eventCount:0 };

const quantityPoolId = (itemId:string) => `phase09:item:${itemId}:quantity`;
const chargePoolId = (itemId:string) => `phase09:item:${itemId}:charges`;
const cloneItems = (items:ItemInstanceVm[]) => structuredClone(items);

function economyOperation(action:ActionVm):ResolutionOperation|undefined {
  if (action.economy === "없음") return undefined;
  const slot = action.economy === "행동" ? "action" : action.economy === "추가 행동" ? "bonus-action" : "reaction";
  return {
    id:`${action.id}:economy`, kind:"use-economy", actorId:action.actorId, slot,
    bonusActionGranted:slot === "bonus-action" ? true : undefined,
    actionKind:action.category === "magic" ? "magic" : "other",
  };
}

function rejected(request:ItemCostTransactionRequest,error:string):ItemCostTransactionResult {
  return { status:"rejected", error, economy:{ ...request.economy }, items:cloneItems(request.items), stateChanges:[], provenance:[], eventCount:0 };
}

export function resolveItemCostTransaction(request:ItemCostTransactionRequest):ItemCostTransactionResult {
  const cost = request.action.itemCost;
  if (!cost) return rejected(request,`item cost transaction requires itemCost: ${request.action.id}`);
  const beforeItems = cloneItems(request.items);
  const item = beforeItems.find((entry) => entry.id === cost.itemId);
  if (!item) return rejected(request,`item cost references missing ItemInstance: ${cost.itemId}`);
  if (cost.charges && !item.charges) return rejected(request,`item has no charge pool: ${item.id}`);

  const resources = [
    ...(cost.quantity ? [{ id:quantityPoolId(item.id), label:`${item.name} 수량`, current:item.quantity, maximum:Math.max(item.quantity,cost.quantity) }] : []),
    ...(cost.charges && item.charges ? [{ id:chargePoolId(item.id), label:`${item.name} 충전`, current:item.charges.current, maximum:item.charges.max }] : []),
  ];
  const operations:ResolutionOperation[] = [];
  if (request.initiativeMode) {
    const economy = economyOperation(request.action);
    if (economy) operations.push(economy);
  }
  if (cost.quantity) operations.push({ id:`${request.action.id}:item-quantity`, kind:"spend-resource", actorId:request.actor.id, resourceId:quantityPoolId(item.id), amount:cost.quantity });
  if (cost.charges) operations.push({ id:`${request.action.id}:item-charges`, kind:"spend-resource", actorId:request.actor.id, resourceId:chargePoolId(item.id), amount:cost.charges });

  const state:RulesRuntimeState = {
    revision:0,
    clock:{ round:1, elapsedSeconds:0, activeActorId:request.initiativeMode ? request.actor.id : undefined },
    combatants:{ [request.actor.id]:{
      id:request.actor.id, baseSpeed:request.economy.movementMax,
      life:{ hp:{ current:request.actor.hp, maximum:request.actor.maxHp, temporary:request.actor.tempHp }, deathSaves:{ successes:0, failures:0 }, stable:false, unconscious:false, dead:false },
      economy:{ action:request.economy.action, bonusAction:request.economy.bonusAction, reaction:request.economy.reaction, movement:request.economy.movement, movementMaximum:request.economy.movementMax, extraActions:[] },
      resources, hitDice:[],
    }},
    effects:[], concentration:{}, history:[],
  };
  const committed = resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state,{
    id:`${request.resolutionId}:item-costs`, actorId:request.actor.id, sourceId:request.action.id, expectedRevision:state.revision, operations,
  });
  if (committed.status === "rejected") return rejected(request,committed.error);

  const actor = committed.state.combatants[request.actor.id];
  const economy:EconomyVm = { action:actor.economy.action, bonusAction:actor.economy.bonusAction, reaction:actor.economy.reaction, movement:actor.economy.movement, movementMax:actor.economy.movementMaximum };
  const items = cloneItems(beforeItems);
  const projected = items.find((entry) => entry.id === item.id)!;
  const quantityPool = actor.resources.find((entry) => entry.id === quantityPoolId(item.id));
  const chargePool = actor.resources.find((entry) => entry.id === chargePoolId(item.id));
  if (quantityPool) projected.quantity = quantityPool.current;
  if (chargePool && projected.charges) projected.charges.current = chargePool.current;

  const stateChanges:string[] = [];
  if (request.economy.action && !economy.action) stateChanges.push("행동 사용");
  if (request.economy.bonusAction && !economy.bonusAction) stateChanges.push("추가 행동 사용");
  if (request.economy.reaction && !economy.reaction) stateChanges.push("반응 사용");
  if (projected.quantity !== item.quantity) stateChanges.push(`${item.name} 수량 ${item.quantity} → ${projected.quantity}`);
  if (projected.charges && item.charges && projected.charges.current !== item.charges.current) stateChanges.push(`${item.name} 충전 ${item.charges.current} → ${projected.charges.current}`);

  return {
    status:"committed", economy, items, stateChanges,
    provenance:committed.events.flatMap((event) => event.provenance.map((entry) => `${entry.source} · ${entry.status} · ${entry.reason}`)),
    eventCount:committed.events.length,
  };
}
