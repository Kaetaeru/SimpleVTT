import { requireCombatant } from "./combatState";
import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import { artifactStateChange, zoneMembershipStateChange } from "./runtimeStateChange";
import { createRuntimeArtifact, type ZoneMembershipState } from "./runtimeArtifact";
import type { ResolutionOperation } from "./resolutionTypes";

type SpawnArtifactOp=Extract<ResolutionOperation,{kind:"spawn-artifact"}>;
type UpdateArtifactOp=Extract<ResolutionOperation,{kind:"update-artifact"}>;
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
  if (operation.zoneMembershipAuthority!=="manual"&&operation.zoneMembershipAuthority!=="spatial") {
    throw new DomainEvaluationError(`unsupported zone membership authority: ${operation.zoneMembershipAuthority}`);
  }
  const artifact=createRuntimeArtifact(operation.artifact);
  const membership:ZoneMembershipState={
    artifactId:artifact.id,
    authority:operation.zoneMembershipAuthority,
    memberIds:[],
  };
  ctx.state.artifacts!.push(artifact);
  ctx.state.zoneMemberships!.push(membership);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`runtime ${artifact.artifactKind} artifact ${artifact.id} spawned with ${membership.authority} membership authority`,
  }];
  const stateChanges=[
    artifactStateChange(artifact.id,artifact.id,"added",provenance,undefined,artifact),
    zoneMembershipStateChange(artifact.id,"added",provenance,undefined,membership),
  ];
  const result={spawned:true,artifact:structuredClone(artifact),membership:structuredClone(membership)};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} spawned`,result,provenance,stateChanges),
  };
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
  const stateChanges=[artifactStateChange(artifact.id,artifact.id,"updated",provenance,before,after)];
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
  const stateChanges=[artifactStateChange(artifact.id,artifact.id,"removed",provenance,artifact,undefined)];
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
  const stateChanges=[zoneMembershipStateChange(artifact.id,"updated",provenance,before,after)];
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
