export interface CommonPlaySimultaneousCandidate {
  id:string;
}

export interface CommonPlaySimultaneousOrderingAuthority {
  kind:"actor-controller"|"dm";
  responderId:string;
}

export interface CommonPlaySimultaneousOrderingRequest {
  id:string;
  revision:number;
  timing:string;
  authority:CommonPlaySimultaneousOrderingAuthority;
  candidates:CommonPlaySimultaneousCandidate[];
}

export interface CommonPlaySimultaneousOrderingResponse {
  decisionId:string;
  revision:number;
  responderId:string;
  orderedCandidateIds:string[];
}

export interface CommonPlaySimultaneousTimingCandidate {
  decisionId:string;
  revision:number;
  timing:string;
  authority:CommonPlaySimultaneousOrderingAuthority;
  candidateId:string;
}

export type CommonPlaySimultaneousOrderingState =
  |{
    status:"pending";
    request:CommonPlaySimultaneousOrderingRequest;
  }
  |{
    status:"resolved";
    request:CommonPlaySimultaneousOrderingRequest;
    orderedCandidateIds:string[];
    resolvedBy:"automatic"|string;
  };

export type CommonPlaySimultaneousOrderingResponseResult =
  |{status:"resolved";state:Extract<CommonPlaySimultaneousOrderingState,{status:"resolved"}>;replay:boolean}
  |{status:"rejected";state:CommonPlaySimultaneousOrderingState;reason:string};

const cp=<T,>(value:T):T=>structuredClone(value);

function requiredString(value:string,label:string) {
  if(!value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function candidateIds(request:CommonPlaySimultaneousOrderingRequest) {
  return request.candidates.map((candidate)=>candidate.id);
}

function sameOrder(left:readonly string[],right:readonly string[]) {
  return left.length===right.length&&left.every((value,index)=>value===right[index]);
}

function isPermutation(expected:readonly string[],actual:readonly string[]) {
  if(expected.length!==actual.length) return false;
  const expectedSet=new Set(expected);
  if(expectedSet.size!==expected.length||new Set(actual).size!==actual.length) return false;
  return actual.every((id)=>expectedSet.has(id));
}

export function beginCommonPlaySimultaneousOrdering(
  input:CommonPlaySimultaneousOrderingRequest,
):CommonPlaySimultaneousOrderingState {
  const request=cp(input);
  request.id=requiredString(request.id,"Common Play simultaneous ordering id");
  request.timing=requiredString(request.timing,"Common Play simultaneous ordering timing");
  request.authority.responderId=requiredString(request.authority.responderId,"Common Play simultaneous ordering responderId");
  if(request.authority.kind!=="actor-controller"&&request.authority.kind!=="dm") {
    throw new Error("Common Play simultaneous ordering authority must be actor-controller or dm");
  }
  if(!Number.isInteger(request.revision)||request.revision<0) {
    throw new Error("Common Play simultaneous ordering revision must be a non-negative integer");
  }
  for(const [index,candidate] of request.candidates.entries()) {
    candidate.id=requiredString(candidate.id,`Common Play simultaneous ordering candidates[${index}].id`);
  }
  const ids=candidateIds(request);
  if(new Set(ids).size!==ids.length) {
    throw new Error("Common Play simultaneous ordering candidate ids must be unique");
  }
  if(ids.length<=1) {
    return {status:"resolved",request,orderedCandidateIds:ids,resolvedBy:"automatic"};
  }
  return {status:"pending",request};
}

export function collectCommonPlaySimultaneousOrderingWindows(
  input:readonly CommonPlaySimultaneousTimingCandidate[],
):CommonPlaySimultaneousOrderingState[] {
  const requests=new Map<string,CommonPlaySimultaneousOrderingRequest>();
  for(const [index,candidate] of input.entries()) {
    const decisionId=requiredString(candidate.decisionId,`Common Play simultaneous timing candidates[${index}].decisionId`);
    const candidateId=requiredString(candidate.candidateId,`Common Play simultaneous timing candidates[${index}].candidateId`);
    const existing=requests.get(decisionId);
    if(existing) {
      const sameWindow=existing.revision===candidate.revision
        &&existing.timing===candidate.timing
        &&existing.authority.kind===candidate.authority.kind
        &&existing.authority.responderId===candidate.authority.responderId;
      if(!sameWindow) throw new Error(`Common Play simultaneous timing window ${decisionId} has conflicting authority, timing, or revision`);
      existing.candidates.push({id:candidateId});
      continue;
    }
    requests.set(decisionId,{
      id:decisionId,
      revision:candidate.revision,
      timing:candidate.timing,
      authority:cp(candidate.authority),
      candidates:[{id:candidateId}],
    });
  }
  return [...requests.values()].map((request)=>beginCommonPlaySimultaneousOrdering(request));
}

export function respondToCommonPlaySimultaneousOrdering(
  state:CommonPlaySimultaneousOrderingState,
  input:CommonPlaySimultaneousOrderingResponse,
):CommonPlaySimultaneousOrderingResponseResult {
  const response=cp(input);
  if(response.decisionId!==state.request.id) return {status:"rejected",state,reason:"decision-id-mismatch"};
  if(response.revision!==state.request.revision) return {status:"rejected",state,reason:"stale-revision"};
  if(response.responderId!==state.request.authority.responderId) return {status:"rejected",state,reason:"responder-not-authorized"};
  if(!isPermutation(candidateIds(state.request),response.orderedCandidateIds)) {
    return {status:"rejected",state,reason:"invalid-ordering"};
  }
  if(state.status==="resolved") {
    if(state.resolvedBy===response.responderId&&sameOrder(state.orderedCandidateIds,response.orderedCandidateIds)) {
      return {status:"resolved",state,replay:true};
    }
    return {status:"rejected",state,reason:"decision-already-resolved"};
  }
  return {
    status:"resolved",
    state:{
      status:"resolved",
      request:state.request,
      orderedCandidateIds:cp(response.orderedCandidateIds),
      resolvedBy:response.responderId,
    },
    replay:false,
  };
}

export function orderCommonPlaySimultaneousCandidates<T extends CommonPlaySimultaneousCandidate>(
  state:CommonPlaySimultaneousOrderingState,
  candidates:readonly T[],
):T[] {
  if(state.status!=="resolved") throw new Error("Common Play simultaneous ordering decision is still pending");
  const byId=new Map(candidates.map((candidate)=>[candidate.id,candidate]));
  if(byId.size!==candidates.length||!isPermutation(state.orderedCandidateIds,candidates.map((candidate)=>candidate.id))) {
    throw new Error("Common Play simultaneous ordering candidates no longer match the resolved decision");
  }
  return state.orderedCandidateIds.map((id)=>byId.get(id)!);
}
