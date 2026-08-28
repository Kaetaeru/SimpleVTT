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
}

export type CommonPlayProjectResult=
  |{status:"committed";project:CommonPlayProject}
  |{status:"rejected";project:CommonPlayProject;error:string};

export function advanceCommonPlayProject(project:CommonPlayProject,request:{expectedRevision:number;ownerId:string;work:number;payments?:Record<string,number>}):CommonPlayProjectResult {
  try{
    if(request.expectedRevision!==project.revision)throw new DomainEvaluationError(`project revision mismatch: expected ${request.expectedRevision}, current ${project.revision}`);
    if(request.ownerId!==project.ownerId)throw new DomainEvaluationError("project owner mismatch");
    if(project.status!=="active")throw new DomainEvaluationError("project is not active");
    if(!Number.isFinite(request.work)||request.work<=0)throw new DomainEvaluationError("project work must be positive and finite");
    if(!Number.isFinite(project.requiredWork)||project.requiredWork<=0||project.completedWork<0||project.completedWork>project.requiredWork)throw new DomainEvaluationError("project state is invalid");
    const payments={...project.payments};
    for(const [id,amount] of Object.entries(request.payments??{})){
      if(!id||!Number.isInteger(amount)||amount<0)throw new DomainEvaluationError("project payment must be a non-negative integer");
      payments[id]=(payments[id]??0)+amount;
    }
    const completedWork=Math.min(project.requiredWork,project.completedWork+request.work);
    return {status:"committed",project:{...project,revision:project.revision+1,completedWork,payments,status:completedWork===project.requiredWork?"completed":"active"}};
  }catch(error){return {status:"rejected",project,error:error instanceof Error?error.message:String(error)};}
}
