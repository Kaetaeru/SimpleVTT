import { DomainEvaluationError, type ProvenanceRecord, type SemanticPredicate } from "./profileEngine";
import type { RuntimeClock } from "./effects";
import type { DamageDefenseContribution } from "./damage";

export type RuntimeArtifactKind = "zone"|"stored-invocation"|"object"|"link"|"actor"|"form";
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

export interface ObjectArtifactData {
  size:"tiny"|"small"|"medium"|"large"|"huge"|"gargantuan";
  armorClass:number;
  hp:{current:number;maximum:number};
  damageThreshold?:number;
  damageDefenses?:DamageDefenseContribution[];
  repairable?:boolean;
  destroyOnZero?:boolean;
}

export interface LinkArtifactData {
  endpointIds:[string,string];
  relation:"barrier"|"wall"|"portal"|"tether"|"rope";
  blocksMovement?:boolean;
  blocksLineOfEffect?:boolean;
  maximumLengthFeet?:number;
}

export interface ActorArtifactData {
  combatantId:string;
  statDefinitionId:string;
  ownerId:string;
  controllerId:string;
  side:"ally"|"enemy";
  initiative:"shared"|"independent"|"none";
  properties:Record<string,string|number|boolean>;
  actionDefinitionIds:string[];
  resources:Array<{id:string;current:number;maximum:number}>;
}

export interface FormArtifactData {
  targetActorId:string;
  controllerId?:string;
  propertyOverlay:Record<string,string|number|boolean>;
  retainedProperties:string[];
  replacementProperties:string[];
  hpPolicy:"retain"|"temporary-hp"|"replace";
  actionPolicy:"retain"|"replace"|"grant";
  spellcasting:"retain"|"restricted"|"blocked";
  actionDefinitionIds:string[];
  resources:Array<{id:string;current:number;maximum:number}>;
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
  object?:ObjectArtifactData;
  link?:LinkArtifactData;
  actor?:ActorArtifactData;
  form?:FormArtifactData;
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
  object?:ObjectArtifactData;
  link?:LinkArtifactData;
  actor?:ActorArtifactData;
  form?:FormArtifactData;
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
  if (!["zone","stored-invocation","object","link","actor","form"].includes(request.artifactKind)) throw new DomainEvaluationError(`unsupported runtime artifact kind: ${request.artifactKind}`);
  if(request.artifactKind==="stored-invocation") {
    const stored=request.storedInvocation;
    if(!stored?.ownerActorId||!stored.definitionId||!stored.entryPointId||!stored.definitionRevision) throw new DomainEvaluationError("stored invocation artifact requires owner and definition identity");
    if(stored.binding!=="snapshot"&&stored.binding!=="live") throw new DomainEvaluationError("stored invocation binding must be snapshot or live");
  } else if(request.storedInvocation) throw new DomainEvaluationError("only stored-invocation artifacts can contain stored invocation data");
  if(request.artifactKind==="object") {
    const object=request.object;
    if(!object||!Number.isInteger(object.armorClass)||object.armorClass<0||!Number.isInteger(object.hp.current)||!Number.isInteger(object.hp.maximum)||object.hp.current<0||object.hp.maximum<1||object.hp.current>object.hp.maximum) throw new DomainEvaluationError("object artifact requires valid AC and HP");
    if(object.damageThreshold!==undefined&&(!Number.isInteger(object.damageThreshold)||object.damageThreshold<0)) throw new DomainEvaluationError("object damage threshold must be a non-negative integer");
  } else if(request.object) throw new DomainEvaluationError("only object artifacts can contain object data");
  if(request.artifactKind==="link") {
    const link=request.link;
    if(!link||link.endpointIds.length!==2||link.endpointIds.some((id)=>!id)||link.endpointIds[0]===link.endpointIds[1]) throw new DomainEvaluationError("link artifact requires two distinct endpoints");
    if(link.maximumLengthFeet!==undefined&&(!Number.isFinite(link.maximumLengthFeet)||link.maximumLengthFeet<0)) throw new DomainEvaluationError("link maximum length must be non-negative and finite");
  } else if(request.link) throw new DomainEvaluationError("only link artifacts can contain link data");
  if(request.artifactKind==="actor") {
    const actor=request.actor;
    if(!actor?.combatantId||!actor.statDefinitionId||!actor.ownerId||!actor.controllerId||(actor.side!=="ally"&&actor.side!=="enemy")) throw new DomainEvaluationError("actor artifact requires combatant, stat, owner, controller, and side");
    if(new Set(actor.actionDefinitionIds).size!==actor.actionDefinitionIds.length||actor.resources.some((resource)=>!resource.id||!Number.isInteger(resource.current)||!Number.isInteger(resource.maximum)||resource.current<0||resource.maximum<0||resource.current>resource.maximum)) throw new DomainEvaluationError("actor artifact action or resource projection is invalid");
    const maximum=actor.properties["hp.maximum"],current=actor.properties["hp.current"]??maximum,temporary=actor.properties["hp.temporary"]??0,speed=actor.properties["movement.walk"],armorClass=actor.properties["defense.ac"],initiative=actor.properties.initiative;
    if(!Number.isInteger(maximum)||Number(maximum)<1||!Number.isInteger(current)||Number(current)<0||Number(current)>Number(maximum)||!Number.isInteger(temporary)||Number(temporary)<0||!Number.isInteger(speed)||Number(speed)<0||!Number.isInteger(armorClass)||Number(armorClass)<0||(actor.initiative==="independent"&&!Number.isInteger(initiative))) throw new DomainEvaluationError("actor artifact requires valid HP, movement.walk, defense.ac, and independent initiative properties");
  } else if(request.actor) throw new DomainEvaluationError("only actor artifacts can contain actor data");
  if(request.artifactKind==="form") {
    const form=request.form;
    if(!form?.targetActorId||new Set(form.retainedProperties).size!==form.retainedProperties.length||new Set(form.replacementProperties).size!==form.replacementProperties.length||new Set(form.actionDefinitionIds).size!==form.actionDefinitionIds.length||form.resources.some((resource)=>!resource.id||resource.current<0||resource.maximum<resource.current)) throw new DomainEvaluationError("form artifact requires target and valid property/action/resource policies");
  } else if(request.form) throw new DomainEvaluationError("only form artifacts can contain form data");
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
