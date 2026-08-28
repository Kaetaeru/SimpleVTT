import { requireCombatant } from "./combatState";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import { artifactStateChange, zoneMembershipStateChange, type RuntimeStateChange } from "./runtimeStateChange";
import { createRuntimeArtifact, type ZoneMembershipState } from "./runtimeArtifact";
import type { ResolutionOperation } from "./resolutionTypes";
import { resolveDamage, resolveHealing } from "./damage";

type SpawnArtifactOp=Extract<ResolutionOperation,{kind:"spawn-artifact"}>;
type UpdateArtifactOp=Extract<ResolutionOperation,{kind:"update-artifact"}>;
type DamageArtifactOp=Extract<ResolutionOperation,{kind:"damage-artifact"}>;
type RepairArtifactOp=Extract<ResolutionOperation,{kind:"repair-artifact"}>;
type RelocateArtifactOp=Extract<ResolutionOperation,{kind:"relocate-artifact"}>;
type SetArtifactControllerOp=Extract<ResolutionOperation,{kind:"set-artifact-controller"}>;
type RemoveArtifactOp=Extract<ResolutionOperation,{kind:"remove-artifact"}>;
type SetZoneMembershipOp=Extract<ResolutionOperation,{kind:"set-zone-membership"}>;

function artifacts(ctx:ResolutionExecutionContext) {
  return ctx.state.artifacts ?? (ctx.state.artifacts=[]);
}

function zoneMemberships(ctx:ResolutionExecutionContext) {
  return ctx.state.zoneMemberships ?? (ctx.state.zoneMemberships=[]);
}

export function executeSpawnArtifact(ctx:ResolutionExecutionContext,operation:SpawnArtifactOp):OperationExecution {
  if (artifacts(ctx).some((artifact)=>artifact.id===operation.artifact.id)) {
    throw new DomainEvaluationError(`runtime artifact already exists: ${operation.artifact.id}`);
  }
  if (zoneMemberships(ctx).some((membership)=>membership.artifactId===operation.artifact.id)) {
    throw new DomainEvaluationError(`zone membership already exists: ${operation.artifact.id}`);
  }
  const artifact=createRuntimeArtifact(operation.artifact);
  if(artifact.artifactKind==="zone"&&operation.zoneMembershipAuthority!=="manual"&&operation.zoneMembershipAuthority!=="spatial") throw new DomainEvaluationError(`unsupported zone membership authority: ${operation.zoneMembershipAuthority}`);
  if(artifact.artifactKind!=="zone"&&operation.zoneMembershipAuthority!==undefined) throw new DomainEvaluationError("zone membership authority applies only to zone artifacts");
  if(artifact.artifactKind==="form") requireCombatant(ctx.state,artifact.form!.targetActorId);
  if(artifact.artifactKind==="actor"&&(ctx.state.combatants[artifact.actor!.combatantId]||(ctx.state.artifacts??[]).some((entry)=>entry.actor?.combatantId===artifact.actor!.combatantId))) throw new DomainEvaluationError(`actor artifact combatant identity already exists: ${artifact.actor!.combatantId}`);
  if(artifact.artifactKind==="link") for(const endpointId of artifact.link!.endpointIds) {
    if(!ctx.state.combatants[endpointId]&&!artifacts(ctx).some((entry)=>entry.id===endpointId)) throw new DomainEvaluationError(`link endpoint not found: ${endpointId}`);
  }
  const membership:ZoneMembershipState|undefined=artifact.artifactKind==="zone"?{
    artifactId:artifact.id,authority:operation.zoneMembershipAuthority!,memberIds:[],
  }:undefined;
  ctx.state.artifacts!.push(artifact);
  if(membership) ctx.state.zoneMemberships!.push(membership);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:membership
      ? `runtime ${artifact.artifactKind} artifact ${artifact.id} spawned with ${membership.authority} membership authority`
      : `runtime ${artifact.artifactKind} artifact ${artifact.id} spawned`,
  }];
  const stateChanges:RuntimeStateChange[]=[
    artifactStateChange(artifact.id,artifact.id,"added",provenance,undefined,artifact),
  ];
  if(membership) stateChanges.push(zoneMembershipStateChange(artifact.id,"added",provenance,undefined,membership));
  const result={spawned:true,artifact:structuredClone(artifact),...(membership?{membership:structuredClone(membership)}:{})};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} spawned`,result,provenance,stateChanges),
  };
}

export function executeDamageArtifact(ctx:ResolutionExecutionContext,operation:DamageArtifactOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId&&candidate.artifactKind==="object");
  if(!artifact?.object) throw new DomainEvaluationError(`active object artifact not found: ${operation.artifactId}`);
  const before=structuredClone(artifact);
  let damage=resolveDamage({
    hp:{current:artifact.object.hp.current,maximum:artifact.object.hp.maximum,temporary:0},
    amount:operation.amount,damageType:operation.damageType,defenses:artifact.object.damageDefenses,
  });
  if(damage.finalDamage<(artifact.object.damageThreshold??0)) damage={
    ...damage,finalDamage:0,hpDamage:0,nextHp:{current:artifact.object.hp.current,maximum:artifact.object.hp.maximum,temporary:0},
    provenance:[...damage.provenance,{source:`artifact:${artifact.id}:damage-threshold`,status:"applied",reason:`damage ${damage.finalDamage} is below threshold ${artifact.object.damageThreshold}`}],
  };
  artifact.object.hp={current:damage.nextHp.current,maximum:damage.nextHp.maximum};
  const destroyed=artifact.object.hp.current===0&&artifact.object.destroyOnZero!==false;
  if(destroyed) ctx.state.artifacts=artifacts(ctx).filter((entry)=>entry.id!==artifact.id);
  const after=destroyed?undefined:structuredClone(artifact);
  const changes:RuntimeStateChange[]=[artifactStateChange(artifact.id,artifact.id,destroyed?"removed":"updated",damage.provenance,before,after)];
  const result={...damage,destroyed,artifact:after};
  return {result,event:makeEvent(ctx.pending,operation,`object artifact ${artifact.id} takes ${damage.finalDamage} damage`,result,damage.provenance,changes,artifact.id)};
}

export function executeRepairArtifact(ctx:ResolutionExecutionContext,operation:RepairArtifactOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId&&candidate.artifactKind==="object");
  if(!artifact?.object) throw new DomainEvaluationError(`active object artifact not found: ${operation.artifactId}`);
  if(artifact.object.repairable!==true) throw new DomainEvaluationError(`object artifact is not repairable: ${artifact.id}`);
  const before=structuredClone(artifact);
  const healing=resolveHealing({current:artifact.object.hp.current,maximum:artifact.object.hp.maximum,temporary:0},operation.amount);
  artifact.object.hp={current:healing.nextHp.current,maximum:healing.nextHp.maximum};
  const after=structuredClone(artifact);
  return {result:{...healing,artifact:after},event:makeEvent(ctx.pending,operation,`object artifact ${artifact.id} repaired ${healing.restored}`,
    {...healing,artifact:after},healing.provenance,[artifactStateChange(artifact.id,artifact.id,"updated",healing.provenance,before,after)],artifact.id)};
}

export function executeRelocateArtifact(ctx:ResolutionExecutionContext,operation:RelocateArtifactOp):OperationExecution {
  if(!operation.placementRef) throw new DomainEvaluationError("artifact relocation requires an authoritative placement reference");
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId);
  if(!artifact) throw new DomainEvaluationError(`runtime artifact not found: ${operation.artifactId}`);
  const before=structuredClone(artifact);artifact.placementRef=operation.placementRef;const after=structuredClone(artifact);
  const provenance:ProvenanceRecord[]=[{source:ctx.pending.sourceId,status:"applied",reason:`artifact ${artifact.id} relocated to authoritative placement ${operation.placementRef}`}];
  return {result:{relocated:true,artifact:after},event:makeEvent(ctx.pending,operation,`artifact ${artifact.id} relocated`,{relocated:true,artifact:after},provenance,[artifactStateChange(artifact.id,artifact.id,"updated",provenance,before,after)],artifact.id)};
}

export function executeSetArtifactController(ctx:ResolutionExecutionContext,operation:SetArtifactControllerOp):OperationExecution {
  if(!operation.controllerId) throw new DomainEvaluationError("artifact controller identity is required");
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId&&(candidate.artifactKind==="actor"||candidate.artifactKind==="form"));
  if(!artifact) throw new DomainEvaluationError(`controllable artifact not found: ${operation.artifactId}`);
  const before=structuredClone(artifact);
  if(artifact.actor) artifact.actor.controllerId=operation.controllerId;
  else artifact.form!.controllerId=operation.controllerId;
  const after=structuredClone(artifact);
  const provenance:ProvenanceRecord[]=[{source:ctx.pending.sourceId,status:"applied",reason:`artifact ${artifact.id} controller changed to ${operation.controllerId}`}];
  return {result:{controllerId:operation.controllerId,artifact:after},event:makeEvent(ctx.pending,operation,`artifact ${artifact.id} controller changed`,{controllerId:operation.controllerId,artifact:after},provenance,[artifactStateChange(artifact.id,artifact.id,"updated",provenance,before,after)],artifact.id)};
}

export function executeUpdateArtifact(ctx:ResolutionExecutionContext,operation:UpdateArtifactOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId);
  if (!artifact) throw new DomainEvaluationError(`runtime artifact not found: ${operation.artifactId}`);
  const before=structuredClone(artifact);
  artifact.metadata={...(artifact.metadata??{}),...structuredClone(operation.metadataPatch)};
  const after=structuredClone(artifact);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`runtime artifact ${artifact.id} metadata updated`,
  }];
  const stateChanges:RuntimeStateChange[]=[artifactStateChange(artifact.id,artifact.id,"updated",provenance,before,after)];
  const result={updated:true,artifact:after};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} updated`,result,provenance,stateChanges),
  };
}

export function executeRemoveArtifact(ctx:ResolutionExecutionContext,operation:RemoveArtifactOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId);
  if (!artifact) throw new DomainEvaluationError(`runtime artifact not found: ${operation.artifactId}`);
  const membership=zoneMemberships(ctx).find((candidate)=>candidate.artifactId===operation.artifactId);
  ctx.state.artifacts=artifacts(ctx).filter((candidate)=>candidate.id!==operation.artifactId);
  ctx.state.zoneMemberships=zoneMemberships(ctx).filter((candidate)=>candidate.artifactId!==operation.artifactId);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`runtime artifact ${artifact.id} removed`,
  }];
  const stateChanges:RuntimeStateChange[]=[artifactStateChange(artifact.id,artifact.id,"removed",provenance,artifact,undefined)];
  if (membership) stateChanges.push(zoneMembershipStateChange(artifact.id,"removed",provenance,membership,undefined));
  const result={removed:true,artifact:structuredClone(artifact),membership:membership?structuredClone(membership):undefined};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} removed`,result,provenance,stateChanges),
  };
}

export function executeSetZoneMembership(ctx:ResolutionExecutionContext,operation:SetZoneMembershipOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId&&candidate.artifactKind==="zone");
  if (!artifact) throw new DomainEvaluationError(`active zone artifact not found: ${operation.artifactId}`);
  requireCombatant(ctx.state,operation.memberId);
  const membership=zoneMemberships(ctx).find((candidate)=>candidate.artifactId===operation.artifactId);
  if (!membership) throw new DomainEvaluationError(`zone membership not found: ${operation.artifactId}`);
  if (membership.authority!==operation.authority) {
    throw new DomainEvaluationError(`zone membership authority mismatch: expected ${membership.authority}, received ${operation.authority}`);
  }
  const alreadyPresent=membership.memberIds.includes(operation.memberId);
  if (alreadyPresent===operation.present) {
    const result={changed:false,artifactId:operation.artifactId,memberId:operation.memberId,present:operation.present};
    return {
      result,
      event:makeEvent(ctx.pending,operation,`zone membership unchanged for ${operation.memberId}`,result,[],[],operation.memberId),
    };
  }
  const before=structuredClone(membership);
  membership.memberIds=operation.present
    ? [...membership.memberIds,operation.memberId]
    : membership.memberIds.filter((memberId)=>memberId!==operation.memberId);
  const after=structuredClone(membership);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`${operation.memberId} ${operation.present?"entered":"left"} runtime zone ${artifact.id}`,
  }];
  const stateChanges:RuntimeStateChange[]=[zoneMembershipStateChange(artifact.id,"updated",provenance,before,after)];
  const result={
    changed:true,
    artifactId:operation.artifactId,
    memberId:operation.memberId,
    present:operation.present,
    semanticEvent:operation.present?"zone.entered":"zone.left",
  };
  return {
    result,
    event:makeEvent(ctx.pending,operation,`zone membership changed for ${operation.memberId}`,result,provenance,stateChanges,operation.memberId),
  };
}
