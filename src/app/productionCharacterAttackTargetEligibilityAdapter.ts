import type { ActionVm, SceneEntity } from "./contracts";
import { MockAdapter } from "./mockAdapter";

type EligibilityPrototype={
  eligible(action:ActionVm):string[];
};

type EligibilityState={
  scene:{entities:SceneEntity[]};
};

const prototype=MockAdapter.prototype as unknown as EligibilityPrototype;
const previousEligible=prototype.eligible;

prototype.eligible=function productionCharacterAttackTargetEligibility(this:MockAdapter,action:ActionVm){
  const baseline=previousEligible.call(this,action);
  if((action.target!=="enemy"&&action.target!=="multi-enemy")||action.resolutionKind!=="attack")return baseline;
  const scene=(this as unknown as EligibilityState).scene;
  const actor=scene.entities.find((entity)=>entity.id===action.actorId);
  if(!actor)return baseline;
  return scene.entities
    .filter((entity)=>entity.id!==actor.id&&(entity.side!==actor.side||entity.kind==="character"))
    .map((entity)=>entity.id);
};
