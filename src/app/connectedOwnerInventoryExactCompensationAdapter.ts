import "./connectedPartyStashHostRecoveryAdapter";
import type { PartyStashTransferCommand } from "./contracts";
import { projectedCharacterById } from "./characterSessionProjectionRegistry";
import { connectedPartyStashHostCoordinatorStoreFor } from "./connectedPartyStashHostCoordinatorStore";
import { connectedStateFor } from "./connectedSessionState";
import { MockAdapter } from "./mockAdapter";

const activeHostStashRequest=new WeakMap<MockAdapter,string>();
const baseTransfer=MockAdapter.prototype.transferPartyStash;
const baseUndoLast=MockAdapter.prototype.undoLastDmInventoryAdjustment;

MockAdapter.prototype.transferPartyStash=async function transferPartyStashWithExactOwnerCompensation(command:PartyStashTransferCommand){
  const state=connectedStateFor(this);
  if(state.mode!=="host")return baseTransfer.call(this,command);
  const existing=activeHostStashRequest.get(this);
  if(existing&&existing!==command.requestId)throw new Error("another connected Party Stash transaction is already compensating owner inventory");

  const mounted=projectedCharacterById(this,command.actorId);
  let coordinated=false;
  if(mounted){
    const ownerParticipantId=state.peerParticipants.get(mounted.peerId);
    if(!ownerParticipantId)throw new Error("connected Party Stash owner participant is unavailable");
    await connectedPartyStashHostCoordinatorStoreFor(this).write({
      version:1,
      requestId:command.requestId,
      campaignId:command.campaignId,
      actorId:command.actorId,
      ownerParticipantId,
      command:structuredClone(command),
    });
    coordinated=true;
  }

  activeHostStashRequest.set(this,command.requestId);
  try{
    const result=await baseTransfer.call(this,command);
    if(coordinated)await connectedPartyStashHostCoordinatorStoreFor(this).delete(command.requestId).catch(()=>undefined);
    return result;
  }finally{
    if(activeHostStashRequest.get(this)===command.requestId)activeHostStashRequest.delete(this);
  }
};

MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastDmInventoryAdjustmentWithExactStashRequest(){
  const requestId=activeHostStashRequest.get(this);
  if(requestId&&connectedStateFor(this).mode==="host")return this.undoDmInventoryAdjustment(requestId);
  return baseUndoLast.call(this);
};

export {};
