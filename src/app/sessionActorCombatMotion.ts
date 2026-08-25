import type { ResolutionView } from "./contracts";

export type SessionActorCombatMotion="attacking"|"targeted"|"braced"|"dodged"|"hit";

export function sessionActorCombatMotion(resolution:ResolutionView|null,actorId:string):SessionActorCombatMotion|null {
  if(!resolution?.attackOutcome)return null;
  if(resolution.actorId===actorId)return resolution.stage==="roll-animation"?"attacking":null;
  if(!resolution.targetIds.includes(actorId))return null;
  if(resolution.stage==="roll-animation")return "targeted";
  if(resolution.stage==="interrupt")return "braced";
  if(resolution.stage==="attack-result")return resolution.attackOutcome==="빗나감"?"dodged":"braced";
  if(resolution.stage==="damage-animation"&&resolution.attackOutcome==="명중")return "hit";
  return null;
}
