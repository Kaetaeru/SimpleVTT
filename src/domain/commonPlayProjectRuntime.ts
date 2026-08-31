import { DomainEvaluationError } from "./profileEngine";

export interface CommonPlayProject {
  id:string;
  ownerId:string;
  definitionId:string;
  revision:number;
  requiredWork:number;
  completedWork:number;
  status:"active"|"completed"|"cancelled";
  payments:Record<string,number>;
  contributors?:string[];
  requirements?:{
    toolProficiencyIds?:string[];
    preparedSpellDefinitionIds?:string[];
  };
}

export type CommonPlayProjectResult=
  |{status:"committed";project:CommonPlayProject}
  |{status:"rejected";project:CommonPlayProject;error:string};

export function validateCommonPlayProject(project:CommonPlayProject) {
  if(!project.id||!project.ownerId||!project.definitionId)throw new DomainEvaluationError("project identity, owner, and definition are required");
  if(!Number.isInteger(project.revision)||project.revision<0)throw new DomainEvaluationError("project revision must be a non-negative integer");
  if(!Number.isFinite(project.requiredWork)||project.requiredWork<=0||project.completedWork<0||project.completedWork>project.requiredWork)throw new DomainEvaluationError("project state is invalid");
  const contributors=project.contributors??[];
  if(contributors.some((id)=>!id)||new Set(contributors).size!==contributors.length)throw new DomainEvaluationError("project contributors must be unique non-empty identities");
  if(contributors.includes(project.ownerId))throw new DomainEvaluationError("project owner must not be duplicated in contributors");
  for(const [label,ids] of [["tool proficiency",project.requirements?.toolProficiencyIds],["prepared spell",project.requirements?.preparedSpellDefinitionIds]] as const) {
    if(ids?.some((id)=>!id)||ids&&new Set(ids).size!==ids.length)throw new DomainEvaluationError(`project ${label} requirements must be unique non-empty identities`);
  }
}

function validateRevisionOwner(project:CommonPlayProject,expectedRevision:number,ownerId:string) {
  if(expectedRevision!==project.revision)throw new DomainEvaluationError(`project revision mismatch: expected ${expectedRevision}, current ${project.revision}`);
  if(ownerId!==project.ownerId)throw new DomainEvaluationError("project owner mismatch");
}

export function advanceCommonPlayProject(project:CommonPlayProject,request:{expectedRevision:number;ownerId:string;contributorId?:string;work:number;payments?:Record<string,number>;toolProficiencyIds?:string[];preparedSpellDefinitionIds?:string[]}):CommonPlayProjectResult {
  try{
    validateCommonPlayProject(project);
    validateRevisionOwner(project,request.expectedRevision,request.ownerId);
    if(project.status!=="active")throw new DomainEvaluationError("project is not active");
    const contributorId=request.contributorId??request.ownerId;
    if(contributorId!==project.ownerId&&!project.contributors?.includes(contributorId))throw new DomainEvaluationError("project contributor is not authorized");
    const tools=new Set(request.toolProficiencyIds??[]),spells=new Set(request.preparedSpellDefinitionIds??[]);
    if(project.requirements?.toolProficiencyIds?.some((id)=>!tools.has(id)))throw new DomainEvaluationError("project tool proficiency requirement is not satisfied");
    if(project.requirements?.preparedSpellDefinitionIds?.some((id)=>!spells.has(id)))throw new DomainEvaluationError("project prepared spell requirement is not satisfied");
    if(!Number.isFinite(request.work)||request.work<=0)throw new DomainEvaluationError("project work must be positive and finite");
    const payments={...project.payments};
    for(const [id,amount] of Object.entries(request.payments??{})){
      if(!id||!Number.isInteger(amount)||amount<0)throw new DomainEvaluationError("project payment must be a non-negative integer");
      payments[id]=(payments[id]??0)+amount;
    }
    const completedWork=Math.min(project.requiredWork,project.completedWork+request.work);
    return {status:"committed",project:{...project,contributors:project.contributors?[...project.contributors]:undefined,revision:project.revision+1,completedWork,payments,status:completedWork===project.requiredWork?"completed":"active"}};
  }catch(error){return {status:"rejected",project,error:error instanceof Error?error.message:String(error)};}
}

export function cancelCommonPlayProject(project:CommonPlayProject,request:{expectedRevision:number;ownerId:string}):CommonPlayProjectResult {
  try{
    validateCommonPlayProject(project);
    validateRevisionOwner(project,request.expectedRevision,request.ownerId);
    if(project.status!=="active")throw new DomainEvaluationError("project is not active");
    return {status:"committed",project:{...project,contributors:project.contributors?[...project.contributors]:undefined,revision:project.revision+1,status:"cancelled",payments:{...project.payments}}};
  }catch(error){return {status:"rejected",project,error:error instanceof Error?error.message:String(error)};}
}
