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

MockAdapter.prototype.adjustDmInventory=function adjustDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseAdjust>){
  requireLiveOwnerConnection(this);
  return baseAdjust.apply(this,args);
};

MockAdapter.prototype.undoDmInventoryAdjustment=function undoDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseUndo>){
  requireLiveOwnerConnection(this);
  return baseUndo.apply(this,args);
};

MockAdapter.prototype.undoLastDmInventoryAdjustment=function undoLastDmInventoryWithLiveConnectionGuard(...args:Parameters<typeof baseUndoLast>){
  requireLiveOwnerConnection(this);
  return baseUndoLast.apply(this,args);
};

export {};
