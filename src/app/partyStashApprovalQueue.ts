import type { PartyStashTransferCommand } from "./contracts";

export type PartyStashApprovalTerminalState="committed"|"rejected"|"cancelled";
export type PartyStashApprovalState="pending"|PartyStashApprovalTerminalState;

export interface PartyStashApprovalSubmission {
  command:PartyStashTransferCommand;
  participantId:string;
  participantName:string;
  characterName:string;
  requestedAt:string;
}

export interface PartyStashApprovalRecord extends PartyStashApprovalSubmission {
  state:PartyStashApprovalState;
  error?:string;
}

const cp=<T,>(value:T):T=>structuredClone(value);
const identity=(value:PartyStashApprovalSubmission)=>JSON.stringify({
  command:value.command,
  participantId:value.participantId,
  participantName:value.participantName,
  characterName:value.characterName,
});

export class PartyStashApprovalQueue {
  private readonly records=new Map<string,PartyStashApprovalRecord>();

  submit(submission:PartyStashApprovalSubmission):PartyStashApprovalRecord {
    const requestId=submission.command.requestId;
    if(!requestId)throw new Error("Party Stash approval requestId is required");
    const existing=this.records.get(requestId);
    if(existing){
      if(identity(existing)!==identity(submission))throw new Error("Party Stash approval retry does not match the original request");
      return cp(existing);
    }
    const record:PartyStashApprovalRecord={...cp(submission),state:"pending"};
    this.records.set(requestId,record);
    return cp(record);
  }

  lookup(requestId:string){const record=this.records.get(requestId);return record?cp(record):undefined;}

  pending(){return [...this.records.values()].filter((record)=>record.state==="pending").map(cp);}

  settle(requestId:string,state:PartyStashApprovalTerminalState,error?:string):PartyStashApprovalRecord {
    const current=this.records.get(requestId);
    if(!current)throw new Error("Party Stash approval request not found");
    if(current.state!=="pending"){
      if(current.state!==state)throw new Error("Party Stash approval request already settled differently");
      return cp(current);
    }
    const next:PartyStashApprovalRecord={...current,state,...(error?{error}:{})};
    this.records.set(requestId,next);
    return cp(next);
  }

  clear(){this.records.clear();}
}
