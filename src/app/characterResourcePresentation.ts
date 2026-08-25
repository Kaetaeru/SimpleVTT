import type { CharacterResourceVm } from "./contracts";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
  FIGHTER_SECOND_WIND_RESOURCE_ID,
} from "../domain/coreClassResources";

const LABELS:Record<string,string>={
  [FIGHTER_SECOND_WIND_RESOURCE_ID]:"세컨드 윈드",
  [FIGHTER_ACTION_SURGE_RESOURCE_ID]:"액션 서지",
};

export function visibleCharacterResources(resources:CharacterResourceVm[]) {
  const ids=new Set(resources.map((resource)=>resource.id));
  return resources
    .filter((resource)=>resource.id!==FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)
    .filter((resource)=>resource.id!=="resource.second-wind"||!ids.has(FIGHTER_SECOND_WIND_RESOURCE_ID))
    .filter((resource)=>resource.id!=="resource.action-surge"||!ids.has(FIGHTER_ACTION_SURGE_RESOURCE_ID))
    .map((resource)=>LABELS[resource.id]?{...resource,label:LABELS[resource.id]}:resource);
}
