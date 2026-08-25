import type { ActionVm } from "./contracts";
import type { LayOnHandsRemovableCondition } from "../domain/paladinLayOnHands";

export const LAY_ON_HANDS_ACTION_ID="action.paladin.lay-on-hands";
export interface LayOnHandsActionOption {id:LayOnHandsRemovableCondition;label:string;cost:number}

declare module "./contracts" {
  interface ActionVm {
    layOnHands?:{maximumSpend:number;conditionOptions:LayOnHandsActionOption[]};
  }
}

export function layOnHandsMaximumHealing(action:ActionVm,conditions:LayOnHandsRemovableCondition[]) {
  if(!action.layOnHands)return 0;
  const cost=conditions.reduce((sum,id)=>sum+(action.layOnHands!.conditionOptions.find((entry)=>entry.id===id)?.cost??Number.POSITIVE_INFINITY),0);
  return Math.max(0,action.layOnHands.maximumSpend-cost);
}

export function buildLayOnHandsExecutionActionId(action:ActionVm,healingAmount:number,conditions:LayOnHandsRemovableCondition[]) {
  if(action.id!==LAY_ON_HANDS_ACTION_ID||!action.layOnHands)throw new Error("Lay On Hands action metadata is missing");
  if(!Number.isInteger(healingAmount)||healingAmount<0||healingAmount>layOnHandsMaximumHealing(action,conditions))throw new Error("치유의 손길 사용량이 현재 치유 풀을 초과합니다.");
  if(new Set(conditions).size!==conditions.length||conditions.some((id)=>!action.layOnHands!.conditionOptions.some((entry)=>entry.id===id)))throw new Error("제거할 수 없는 상태가 포함되어 있습니다.");
  if(healingAmount===0&&!conditions.length)throw new Error("회복량 또는 제거할 상태를 선택하세요.");
  const params=new URLSearchParams({healing:String(healingAmount)});if(conditions.length)params.set("remove",conditions.join(","));
  return `${LAY_ON_HANDS_ACTION_ID}?${params}`;
}

export function parseLayOnHandsExecutionActionId(actionId:string) {
  const [base,query=""]=actionId.split("?",2);if(base!==LAY_ON_HANDS_ACTION_ID)return undefined;
  const params=new URLSearchParams(query);const healing=Number(params.get("healing"));const remove=(params.get("remove")??"").split(",").filter(Boolean) as LayOnHandsRemovableCondition[];
  if(!Number.isInteger(healing)||healing<0||new Set(remove).size!==remove.length)return undefined;
  return {healingAmount:healing,removeConditions:remove};
}
