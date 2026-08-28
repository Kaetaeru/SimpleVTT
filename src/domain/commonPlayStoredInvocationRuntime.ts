import type { RulesRuntimeState } from "./combatState";
import { evaluateSemanticPredicate, type RulesProfileLike, type SemanticPredicate, type SemanticValue } from "./profileEngine";
import { resolvePendingResolution } from "./resolution";
import type { PendingResolution, ResolutionCommit, ResolutionOperation } from "./resolutionTypes";
import { expireRuntimeArtifactsAtClock, type RuntimeArtifactExpiry, type RuntimeArtifactInstance } from "./runtimeArtifact";

export interface CommonPlayStoredInvocationCapture {
  resolutionId:string;
  actorId:string;
  definitionId:string;
  entryPointId:string;
  definitionRevision:string;
  binding:"snapshot"|"live";
  trigger:SemanticPredicate;
  expiry?:RuntimeArtifactExpiry;
  concentrationGroupId?:string;
  onTriggerConcentration?:"retain"|"end";
  captureOperations?:ResolutionOperation[];
}

export interface CommonPlayStoredInvocationTrigger {
  resolutionId:string;
  artifactId:string;
  expectedRevision:number;
  definitionRevision:string;
  eventFacts:Record<string,SemanticValue>;
  invocation:PendingResolution;
}

export type CommonPlayStoredInvocationResult=ResolutionCommit|{status:"no-match";state:RulesRuntimeState;reason:string};

function rejected(state:RulesRuntimeState,error:string):Extract<ResolutionCommit,{status:"rejected"}> {
  return {status:"rejected",state,events:[],results:{},error};
}

function activeStoredInvocation(state:RulesRuntimeState,artifactId:string):RuntimeArtifactInstance|undefined {
  const artifact=(state.artifacts??[]).find((candidate)=>candidate.id===artifactId&&candidate.artifactKind==="stored-invocation");
  if(!artifact) return undefined;
  return expireRuntimeArtifactsAtClock([artifact],state.clock).active[0];
}

export function compileCommonPlayStoredInvocationCapture(
  state:RulesRuntimeState,
  request:CommonPlayStoredInvocationCapture,
):PendingResolution {
  if(!request.resolutionId||!request.actorId||!request.definitionId||!request.entryPointId||!request.definitionRevision) throw new Error("stored invocation capture identity is required");
  const artifactId=`${request.resolutionId}:stored-invocation`;
  return {
    id:request.resolutionId,actorId:request.actorId,sourceId:request.definitionId,expectedRevision:state.revision,
    operations:[
      ...(request.captureOperations??[]),
      {
        id:`${request.resolutionId}:store`,kind:"spawn-artifact",
        artifact:{
          id:artifactId,sourceId:request.definitionId,sourceActorId:request.actorId,templateId:request.entryPointId,
          artifactKind:"stored-invocation",
          expiry:request.expiry??{kind:"turn-boundary",actorId:request.actorId,round:state.clock.round+1,boundary:"start"},
          storedInvocation:{
            ownerActorId:request.actorId,definitionId:request.definitionId,entryPointId:request.entryPointId,
            binding:request.binding,definitionRevision:request.definitionRevision,trigger:structuredClone(request.trigger),
            ...(request.concentrationGroupId?{concentrationGroupId:request.concentrationGroupId}:{}),
            ...(request.onTriggerConcentration?{onTriggerConcentration:request.onTriggerConcentration}:{}),
          },
        },
      },
    ],
  };
}

export function resolveCommonPlayStoredInvocationCapture(
  profile:RulesProfileLike,state:RulesRuntimeState,request:CommonPlayStoredInvocationCapture,
):ResolutionCommit {
  try { return resolvePendingResolution(profile,state,compileCommonPlayStoredInvocationCapture(state,request)); }
  catch(error) { return rejected(state,error instanceof Error?error.message:String(error)); }
}

export function resolveCommonPlayStoredInvocationTrigger(
  profile:RulesProfileLike,state:RulesRuntimeState,request:CommonPlayStoredInvocationTrigger,
):CommonPlayStoredInvocationResult {
  try {
    const artifact=activeStoredInvocation(state,request.artifactId);
    if(!artifact?.storedInvocation) return {status:"no-match",state,reason:"stored invocation is missing, expired, or already consumed"};
    const stored=artifact.storedInvocation;
    if(!evaluateSemanticPredicate(stored.trigger,(ref)=>request.eventFacts[ref])) return {status:"no-match",state,reason:"stored invocation trigger predicate did not match"};
    if(request.invocation.actorId!==stored.ownerActorId||request.invocation.sourceId!==stored.definitionId) throw new Error("stored invocation actor or definition identity mismatch");
    if(request.invocation.expectedRevision!==request.expectedRevision) throw new Error("stored invocation revision authority mismatch");
    if(stored.binding==="snapshot"&&request.definitionRevision!==stored.definitionRevision) throw new Error("snapshot stored invocation definition revision mismatch");
    if(!request.definitionRevision) throw new Error("stored invocation definition revision is required");
    if(request.invocation.operations.some((operation)=>operation.kind==="use-economy")) throw new Error("stored invocation payload cannot spend action economy; Reaction is owned by the stored invocation");
    if(stored.concentrationGroupId&&state.concentration[stored.ownerActorId]?.groupId!==stored.concentrationGroupId) {
      return {status:"no-match",state,reason:"stored invocation concentration is no longer maintained"};
    }
    const generatedIds=new Set([`${request.resolutionId}:reaction`,`${request.resolutionId}:consume`,`${request.resolutionId}:end-held-concentration`]);
    if(request.invocation.operations.some((operation)=>generatedIds.has(operation.id))) throw new Error("stored invocation operation identity collides with lifecycle operations");
    const lifecycle:ResolutionOperation[]=[{
      id:`${request.resolutionId}:reaction`,kind:"use-economy",actorId:stored.ownerActorId,slot:"reaction",
    }];
    if(stored.concentrationGroupId&&stored.onTriggerConcentration==="end") lifecycle.push({
      id:`${request.resolutionId}:end-held-concentration`,kind:"end-concentration",actorId:stored.ownerActorId,reason:"stored invocation released",
    });
    lifecycle.push(...structuredClone(request.invocation.operations),{
      id:`${request.resolutionId}:consume`,kind:"remove-artifact",artifactId:artifact.id,
    });
    return resolvePendingResolution(profile,state,{
      id:request.resolutionId,actorId:stored.ownerActorId,sourceId:stored.definitionId,
      expectedRevision:request.expectedRevision,operations:lifecycle,
    });
  } catch(error) { return rejected(state,error instanceof Error?error.message:String(error)); }
}

export function resolveCommonPlayStoredInvocationCancel(
  profile:RulesProfileLike,state:RulesRuntimeState,request:{resolutionId:string;artifactId:string;expectedRevision:number},
):CommonPlayStoredInvocationResult {
  const artifact=activeStoredInvocation(state,request.artifactId);
  if(!artifact?.storedInvocation) return {status:"no-match",state,reason:"stored invocation is missing, expired, or already consumed"};
  const operations:ResolutionOperation[]=[];
  const groupId=artifact.storedInvocation.concentrationGroupId;
  if(groupId&&state.concentration[artifact.storedInvocation.ownerActorId]?.groupId===groupId) operations.push({
    id:`${request.resolutionId}:end-held-concentration`,kind:"end-concentration",actorId:artifact.storedInvocation.ownerActorId,reason:"stored invocation cancelled",
  });
  operations.push({id:`${request.resolutionId}:cancel`,kind:"remove-artifact",artifactId:artifact.id});
  return resolvePendingResolution(profile,state,{
    id:request.resolutionId,actorId:artifact.storedInvocation.ownerActorId,sourceId:artifact.sourceId,
    expectedRevision:request.expectedRevision,operations,
  });
}
