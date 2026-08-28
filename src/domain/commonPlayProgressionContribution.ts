import { DomainEvaluationError } from "./profileEngine";

export interface CommonPlayProgressionContribution {
  track:string;
  threshold:number;
  grants:string[];
}

export interface CommonPlayProgressionContributionState {
  revision:number;
  trackLevels:Record<string,number>;
  grants:string[];
}

export type CommonPlayProgressionContributionResult=
  |{status:"committed";state:CommonPlayProgressionContributionState;addedGrantIds:string[]}
  |{status:"rejected";state:CommonPlayProgressionContributionState;error:string};

export function resolveCommonPlayProgressionContributions(
  inputState:CommonPlayProgressionContributionState,
  expectedRevision:number,
  contributions:CommonPlayProgressionContribution[],
):CommonPlayProgressionContributionResult {
  try {
    if(expectedRevision!==inputState.revision)throw new DomainEvaluationError(`progression revision mismatch: expected ${expectedRevision}, current ${inputState.revision}`);
    const existing=new Set(inputState.grants);
    const added:string[]=[];
    for(const contribution of contributions){
      if(!contribution.track)throw new DomainEvaluationError("progression contribution track is required");
      if(!Number.isInteger(contribution.threshold)||contribution.threshold<0)throw new DomainEvaluationError("progression contribution threshold must be a non-negative integer");
      if(!contribution.grants.length||contribution.grants.some((id)=>!id)||new Set(contribution.grants).size!==contribution.grants.length)throw new DomainEvaluationError("progression contribution grants must be non-empty and unique");
      const level=inputState.trackLevels[contribution.track]??0;
      if(!Number.isInteger(level)||level<0)throw new DomainEvaluationError(`invalid progression track level: ${contribution.track}`);
      if(level<contribution.threshold)continue;
      for(const grant of contribution.grants)if(!existing.has(grant)){existing.add(grant);added.push(grant);}
    }
    return {status:"committed",state:{revision:inputState.revision+1,trackLevels:{...inputState.trackLevels},grants:[...existing]},addedGrantIds:added};
  }catch(error){
    return {status:"rejected",state:inputState,error:error instanceof Error?error.message:String(error)};
  }
}
