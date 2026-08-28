import { DomainEvaluationError, type ProvenanceRecord, type SemanticPredicate } from "./profileEngine";
import type { RuntimeClock } from "./effects";

export type RuntimeArtifactKind = "zone"|"stored-invocation";
export type ZoneMembershipAuthority = "manual"|"spatial";

export type RuntimeArtifactExpiry =
  | { kind:"time"; elapsedSeconds:number }
  | { kind:"turn-boundary"; actorId:string; round:number; boundary:"start"|"end" }
  | { kind:"permanent" };

export interface StoredInvocationArtifactData {
  ownerActorId:string;
  definitionId:string;
  entryPointId:string;
  binding:"snapshot"|"live";
  definitionRevision:string;
  trigger:SemanticPredicate;
  concentrationGroupId?:string;
  onTriggerConcentration?:"retain"|"end";
}

export interface RuntimeArtifactInstance {
  id:string;
  sourceId:string;
  sourceActorId?:string;
  templateId:string;
  artifactKind:RuntimeArtifactKind;
  placementRef?:string;
  expiry:RuntimeArtifactExpiry;
  metadata?:Record<string,string|number|boolean>;
  storedInvocation?:StoredInvocationArtifactData;
}

export interface ZoneMembershipState {
  artifactId:string;
  authority:ZoneMembershipAuthority;
  memberIds:string[];
}

export interface RuntimeArtifactSpawnRequest {
  id:string;
  sourceId:string;
  sourceActorId?:string;
  templateId:string;
  artifactKind:RuntimeArtifactKind;
  placementRef?:string;
  expiry:RuntimeArtifactExpiry;
  metadata?:Record<string,string|number|boolean>;
  storedInvocation?:StoredInvocationArtifactData;
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
  if (request.artifactKind!=="zone"&&request.artifactKind!=="stored-invocation") throw new DomainEvaluationError(`unsupported runtime artifact kind: ${request.artifactKind}`);
  if(request.artifactKind==="stored-invocation") {
    const stored=request.storedInvocation;
    if(!stored?.ownerActorId||!stored.definitionId||!stored.entryPointId||!stored.definitionRevision) throw new DomainEvaluationError("stored invocation artifact requires owner and definition identity");
    if(stored.binding!=="snapshot"&&stored.binding!=="live") throw new DomainEvaluationError("stored invocation binding must be snapshot or live");
  } else if(request.storedInvocation) throw new DomainEvaluationError("only stored-invocation artifacts can contain stored invocation data");
  if (request.expiry.kind==="time"&&(!Number.isFinite(request.expiry.elapsedSeconds)||request.expiry.elapsedSeconds<0)) {
    throw new DomainEvaluationError("runtime artifact expiry must be a non-negative finite elapsed time");
  }
  if(request.expiry.kind==="turn-boundary"&&(!request.expiry.actorId||!Number.isInteger(request.expiry.round)||request.expiry.round<0)) {
    throw new DomainEvaluationError("runtime artifact turn-boundary expiry is invalid");
  }
  return structuredClone(request);
}

function boundaryReached(expiry:Extract<RuntimeArtifactExpiry,{kind:"turn-boundary"}>,clock:RuntimeClock) {
  return clock.round>expiry.round||(clock.round===expiry.round&&clock.activeActorId===expiry.actorId&&clock.phase===expiry.boundary);
}

export function expireRuntimeArtifactsAtClock(
  artifacts:RuntimeArtifactInstance[],
  clock:RuntimeClock,
):RuntimeArtifactExpiryResolution {
  const active:RuntimeArtifactInstance[]=[];
  const expired:RuntimeArtifactInstance[]=[];
  for (const artifact of artifacts) {
    if ((artifact.expiry.kind==="time"&&clock.elapsedSeconds>=artifact.expiry.elapsedSeconds)
      ||(artifact.expiry.kind==="turn-boundary"&&boundaryReached(artifact.expiry,clock))) expired.push(artifact);
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
