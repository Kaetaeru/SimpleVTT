import { DomainEvaluationError, type ProvenanceRecord } from "./profileEngine";
import type { RuntimeClock } from "./effects";

export type RuntimeArtifactKind = "zone";

export type RuntimeArtifactExpiry =
  | { kind:"time"; elapsedSeconds:number }
  | { kind:"permanent" };

export interface RuntimeArtifactInstance {
  id:string;
  sourceId:string;
  sourceActorId?:string;
  templateId:string;
  artifactKind:RuntimeArtifactKind;
  placementRef:string;
  expiry:RuntimeArtifactExpiry;
  metadata?:Record<string,string|number|boolean>;
}

export interface RuntimeArtifactSpawnRequest {
  id:string;
  sourceId:string;
  sourceActorId?:string;
  templateId:string;
  artifactKind:RuntimeArtifactKind;
  placementRef:string;
  expiry:RuntimeArtifactExpiry;
  metadata?:Record<string,string|number|boolean>;
}

export interface RuntimeArtifactExpiryResolution {
  active:RuntimeArtifactInstance[];
  expired:RuntimeArtifactInstance[];
  provenance:ProvenanceRecord[];
}

export function createRuntimeArtifact(request:RuntimeArtifactSpawnRequest):RuntimeArtifactInstance {
  if (!request.id) throw new DomainEvaluationError("runtime artifact id is required");
  if (!request.sourceId) throw new DomainEvaluationError("runtime artifact sourceId is required");
  if (!request.templateId) throw new DomainEvaluationError("runtime artifact templateId is required");
  if (request.artifactKind!=="zone") throw new DomainEvaluationError(`unsupported runtime artifact kind: ${request.artifactKind}`);
  if (!request.placementRef) throw new DomainEvaluationError("runtime artifact placementRef is required");
  if (request.expiry.kind==="time"&&(!Number.isFinite(request.expiry.elapsedSeconds)||request.expiry.elapsedSeconds<0)) {
    throw new DomainEvaluationError("runtime artifact expiry must be a non-negative finite elapsed time");
  }
  return structuredClone(request);
}

export function expireRuntimeArtifactsAtClock(
  artifacts:RuntimeArtifactInstance[],
  clock:RuntimeClock,
):RuntimeArtifactExpiryResolution {
  const active:RuntimeArtifactInstance[]=[];
  const expired:RuntimeArtifactInstance[]=[];
  for (const artifact of artifacts) {
    if (artifact.expiry.kind==="time"&&clock.elapsedSeconds>=artifact.expiry.elapsedSeconds) expired.push(artifact);
    else active.push(artifact);
  }
  return {
    active,
    expired,
    provenance:expired.map((artifact)=>({
      source:artifact.sourceId,
      status:"applied",
      reason:`runtime artifact ${artifact.id} expired at ${clock.elapsedSeconds}s`,
    })),
  };
}
