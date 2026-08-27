import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { OperationExecution, ResolutionExecutionContext } from "./resolutionContext";
import { makeEvent } from "./resolutionContext";
import { artifactStateChange } from "./runtimeStateChange";
import { createRuntimeArtifact } from "./runtimeArtifact";
import type { ResolutionOperation } from "./resolutionTypes";

type SpawnArtifactOp=Extract<ResolutionOperation,{kind:"spawn-artifact"}>;
type UpdateArtifactOp=Extract<ResolutionOperation,{kind:"update-artifact"}>;
type RemoveArtifactOp=Extract<ResolutionOperation,{kind:"remove-artifact"}>;

function artifacts(ctx:ResolutionExecutionContext) {
  return ctx.state.artifacts ?? (ctx.state.artifacts=[]);
}

export function executeSpawnArtifact(ctx:ResolutionExecutionContext,operation:SpawnArtifactOp):OperationExecution {
  if (artifacts(ctx).some((artifact)=>artifact.id===operation.artifact.id)) {
    throw new DomainEvaluationError(`runtime artifact already exists: ${operation.artifact.id}`);
  }
  const artifact=createRuntimeArtifact(operation.artifact);
  ctx.state.artifacts!.push(artifact);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`runtime ${artifact.artifactKind} artifact ${artifact.id} spawned`,
  }];
  const stateChanges=[artifactStateChange(artifact.placementRef,artifact.id,"added",provenance,undefined,artifact)];
  const result={spawned:true,artifact:structuredClone(artifact)};
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
  const stateChanges=[artifactStateChange(artifact.placementRef,artifact.id,"updated",provenance,before,after)];
  const result={updated:true,artifact:after};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} updated`,result,provenance,stateChanges),
  };
}

export function executeRemoveArtifact(ctx:ResolutionExecutionContext,operation:RemoveArtifactOp):OperationExecution {
  const artifact=artifacts(ctx).find((candidate)=>candidate.id===operation.artifactId);
  if (!artifact) throw new DomainEvaluationError(`runtime artifact not found: ${operation.artifactId}`);
  ctx.state.artifacts=artifacts(ctx).filter((candidate)=>candidate.id!==operation.artifactId);
  const provenance:ProvenanceRecord[]=[{
    source:artifact.sourceId,
    status:"applied",
    reason:`runtime artifact ${artifact.id} removed`,
  }];
  const stateChanges=[artifactStateChange(artifact.placementRef,artifact.id,"removed",provenance,artifact,undefined)];
  const result={removed:true,artifact:structuredClone(artifact)};
  return {
    result,
    event:makeEvent(ctx.pending,operation,`runtime artifact ${artifact.id} removed`,result,provenance,stateChanges),
  };
}
