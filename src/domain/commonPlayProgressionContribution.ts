import { DomainEvaluationError } from "./profileEngine";
import { validateChoiceDefinitions, type ChoiceDefinition, type ChoiceSelectionMap } from "./choiceDefinition";

export interface CommonPlayProgressionChoice extends Omit<ChoiceDefinition,"kind"|"status"|"source"|"description"|"options"> {
  description?:string;
  options:Array<ChoiceDefinition["options"][number]&{grants:string[];replaces?:string[]}>;
}

export interface CommonPlayProgressionContribution {
  track:string;
  threshold:number;
  grants:string[];
  choices?:CommonPlayProgressionChoice[];
  /** When the contribution belongs to a subclass, it activates only while that subclass is the character's subclass on the track. */
  ownerSubclassId?:string;
}

export interface CommonPlayProgressionContributionState {
  revision:number;
  trackLevels:Record<string,number>;
  grants:string[];
  /** Stable subclass id per class track, including the subclass chosen in the same level-up. */
  subclassIds?:Record<string,string>;
}

export type CommonPlayProgressionContributionResult=
  |{status:"committed";state:CommonPlayProgressionContributionState;addedGrantIds:string[];removedGrantIds:string[]}
  |{status:"rejected";state:CommonPlayProgressionContributionState;error:string};

export function resolveCommonPlayProgressionContributions(
  inputState:CommonPlayProgressionContributionState,
  expectedRevision:number,
  contributions:CommonPlayProgressionContribution[],
  selections:ChoiceSelectionMap={},
):CommonPlayProgressionContributionResult {
  try {
    if(expectedRevision!==inputState.revision)throw new DomainEvaluationError(`progression revision mismatch: expected ${expectedRevision}, current ${inputState.revision}`);
    const existing=new Set(inputState.grants);
    const added:string[]=[],removed:string[]=[];
    for(const contribution of contributions){
      if(!contribution.track)throw new DomainEvaluationError("progression contribution track is required");
      if(!Number.isInteger(contribution.threshold)||contribution.threshold<0)throw new DomainEvaluationError("progression contribution threshold must be a non-negative integer");
      if(!contribution.grants.length||contribution.grants.some((id)=>!id)||new Set(contribution.grants).size!==contribution.grants.length)throw new DomainEvaluationError("progression contribution grants must be non-empty and unique");
      const level=inputState.trackLevels[contribution.track]??0;
      if(!Number.isInteger(level)||level<0)throw new DomainEvaluationError(`invalid progression track level: ${contribution.track}`);
      if(level<contribution.threshold)continue;
      if(contribution.ownerSubclassId&&(inputState.subclassIds?.[contribution.track]??"")!==contribution.ownerSubclassId)continue;
      const definitions:ChoiceDefinition[]=(contribution.choices??[]).map((choice)=>({...choice,description:choice.description??"",kind:"feature-option",status:"ready",source:contribution.track,options:choice.options.map(({grants:_,replaces:__,...option})=>option)}));
      const issues=validateChoiceDefinitions(definitions,selections).filter((issue)=>issue.severity==="blocking");
      if(issues.length)throw new DomainEvaluationError(issues.map((issue)=>issue.message).join("; "));
      for(const grant of contribution.grants)if(!existing.has(grant)){existing.add(grant);added.push(grant);}
      for(const choice of contribution.choices??[]){
        const selection=selections[choice.id];
        if(selection?.kind!=="options")continue;
        for(const optionId of selection.optionIds){
          const option=choice.options.find((entry)=>entry.id===optionId)!;
          for(const replaced of option.replaces??[])if(existing.delete(replaced)){
            const addedIndex=added.indexOf(replaced);
            if(addedIndex>=0)added.splice(addedIndex,1);
            removed.push(replaced);
          }
          for(const grant of option.grants)if(!existing.has(grant)){existing.add(grant);added.push(grant);}
        }
      }
    }
    return {status:"committed",state:{revision:inputState.revision+1,trackLevels:{...inputState.trackLevels},grants:[...existing]},addedGrantIds:added,removedGrantIds:removed};
  }catch(error){
    return {status:"rejected",state:inputState,error:error instanceof Error?error.message:String(error)};
  }
}
