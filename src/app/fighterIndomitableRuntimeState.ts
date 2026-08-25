import type { SceneVm } from "./contracts";
import type { MockAdapter } from "./mockAdapter";
import { projectedCharacterById, projectedCharacterIds, replaceProjectedCharacterSheet } from "./characterSessionProjectionRegistry";
import { snapshotAdapterTurnRuntimeState } from "./turnRuntimeSessionRegistry";
import { FIGHTER_INDOMITABLE_RESOURCE_ID } from "../domain/coreClassResources";

const bonuses=new WeakMap<MockAdapter,{resolutionId:string;byTarget:Map<string,number>}>();

export function setFighterIndomitableModifierBonus(adapter:MockAdapter,resolutionId:string,targetId:string,bonus:number){
  const current=bonuses.get(adapter);const state=current?.resolutionId===resolutionId?current:{resolutionId,byTarget:new Map<string,number>()};state.byTarget.set(targetId,bonus);bonuses.set(adapter,state);
}

export function fighterIndomitableModifierBonus(adapter:MockAdapter,resolutionId:string,targetId:string){
  const state=bonuses.get(adapter);return state?.resolutionId===resolutionId?state.byTarget.get(targetId)??0:0;
}

export function clearFighterIndomitableResolution(adapter:MockAdapter,resolutionId:string){if(bonuses.get(adapter)?.resolutionId===resolutionId)bonuses.delete(adapter);}

export function synchronizeFighterIndomitableProjectedResources(adapter:MockAdapter){
  const scene=(adapter as unknown as {scene:SceneVm}).scene;const runtime=snapshotAdapterTurnRuntimeState(adapter,scene);if(!runtime)return;
  for(const actorId of projectedCharacterIds(adapter)){const mounted=projectedCharacterById(adapter,actorId);const current=runtime.combatants[actorId]?.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current;if(!mounted||current===undefined)continue;const sheet=structuredClone(mounted.sheet);const resource=sheet.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID);if(resource){resource.current=current;replaceProjectedCharacterSheet(adapter,sheet);}}
}
