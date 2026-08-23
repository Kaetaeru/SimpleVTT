import type { PartyStashTransferCommand } from "./contracts";
import { connectedStateFor } from "./connectedSessionState";
import { MockAdapter } from "./mockAdapter";

const activeHostStashRequest=new WeakMap<MockAdapter,string>();
const baseTransfer=MockAdapter.prototype.transferPartyStash;
const baseUndoLast=MockAdapter.prototype.undoLastDmInventoryAdjustment;

MockAdapter.prototype.transferPartyStash=async function transferPartyStashWithExactOwnerCompensation(command:PartyStashTransferCommand){
  if(connectedStateFor(this).mode!=="host")return baseTransfer.call(this,command);
  const existing=activeHostStashRequest.get(this);
  if(existing&&existing!==command.requestId)throw new Error("another connected Party Stash transaction is already compensating owner inventory");
  activeHostStashRequest.set(this,command.requestId);
  try{return await baseTransfer.call(this,command);}
  finally{if(activeHostStashRequest.get(this)===command.requestId)activeHostStashRequest.delete(this);}
};

MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastDmInventoryAdjustmentWithExactStashRequest(){
  const requestId=activeHostStashRequest.get(this);
  if(requestId&&connectedStateFor(this).mode==="host")return this.undoDmInventoryAdjustment(requestId);
  return baseUndoLast.call(this);
};

export {};
