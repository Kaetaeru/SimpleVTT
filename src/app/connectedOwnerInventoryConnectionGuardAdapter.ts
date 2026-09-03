import { connectedInternal } from "./connectedSessionRuntimeAdapter";
import { connectedStateFor } from "./connectedSessionState";
import { MockAdapter } from "./mockAdapter";

const baseAdjust=MockAdapter.prototype.adjustDmInventory;
const baseUndo=MockAdapter.prototype.undoDmInventoryAdjustment;
const baseUndoLast=MockAdapter.prototype.undoLastDmInventoryAdjustment;

function requireLiveOwnerConnection(adapter:MockAdapter) {
  const state=connectedStateFor(adapter);
  if(state.mode!=="client"||!state.sessionId)return;
  const connectionState=connectedInternal(adapter).connectionState;
  if(connectionState!=="connected"){
    throw new Error(`Connected owner inventory mutation requires an active Host connection; current state is ${connectionState}.`);
  }
}

function requireLiveRemoteOwnerRoute(adapter:MockAdapter,actorId:string) {
  const state=connectedStateFor(adapter);
  if(state.mode!=="host"||!state.sessionId)return;
  const accepted=[...state.acceptedParticipantManifests.entries()].find(([,manifest])=>manifest.character?.characterId===actorId);
  if(!accepted)return;
  const [participantId]=accepted;
  const livePeer=[...state.peerParticipants.entries()].find(([,mappedParticipantId])=>mappedParticipantId===participantId)?.[0];
  if(!livePeer||state.peerManifests.get(livePeer)?.character?.characterId!==actorId){
    throw new Error("Remote Character owner is offline; retry after the owner reconnects.");
  }
}

MockAdapter.prototype.adjustDmInventory=async function adjustDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseAdjust>){
  requireLiveOwnerConnection(this);
  requireLiveRemoteOwnerRoute(this,args[0].actorId);
  return baseAdjust.apply(this,args);
};

MockAdapter.prototype.undoDmInventoryAdjustment=async function undoDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseUndo>){
  requireLiveOwnerConnection(this);
  return baseUndo.apply(this,args);
};

MockAdapter.prototype.undoLastDmInventoryAdjustment=async function undoLastDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseUndoLast>){
  requireLiveOwnerConnection(this);
  return baseUndoLast.apply(this,args);
};

export {};
