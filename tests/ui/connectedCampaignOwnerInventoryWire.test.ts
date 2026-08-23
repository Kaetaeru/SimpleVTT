import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";

const {decodeCampaignOwnerInventoryRequest,decodeCampaignOwnerInventoryResult}=await import("../../src/app/connectedCampaignSystemsRuntimeAdapter");

test("connected Campaign owner inventory wire accepts exact apply and undo requests",()=>{
  const apply=decodeCampaignOwnerInventoryRequest(JSON.stringify({
    type:"campaign-owner-inventory",
    sessionId:"session.owner-inventory",
    correlationId:"request-1:apply",
    operation:"apply",
    command:{requestId:"request-1",actorId:"char.remote",operation:"grant-currency",amount:25},
  }));
  assert.equal(apply?.operation,"apply");
  if(apply?.operation==="apply")assert.equal(apply.command.actorId,"char.remote");

  const undo=decodeCampaignOwnerInventoryRequest(JSON.stringify({
    type:"campaign-owner-inventory",
    sessionId:"session.owner-inventory",
    correlationId:"request-1:undo",
    operation:"undo",
    actorId:"char.remote",
    requestId:"request-1",
  }));
  assert.equal(undo?.operation,"undo");
  if(undo?.operation==="undo")assert.equal(undo.requestId,"request-1");
});

test("connected Campaign owner inventory wire rejects malformed or non-positive mutations",()=>{
  assert.equal(decodeCampaignOwnerInventoryRequest("not-json"),null);
  assert.equal(decodeCampaignOwnerInventoryRequest(JSON.stringify({
    type:"campaign-owner-inventory",sessionId:"s",correlationId:"c",operation:"apply",
    command:{requestId:"r",actorId:"char.remote",operation:"grant-currency",amount:0},
  })),null);
  assert.equal(decodeCampaignOwnerInventoryRequest(JSON.stringify({
    type:"campaign-owner-inventory",sessionId:"s",correlationId:"c",operation:"undo",actorId:"char.remote",
  })),null);
});

test("accepted owner inventory result requires fresh Character revision identity",()=>{
  assert.equal(decodeCampaignOwnerInventoryResult(JSON.stringify({
    type:"campaign-owner-inventory-result",sessionId:"s",correlationId:"c",actorId:"char.remote",accepted:true,
  })),null);

  const accepted=decodeCampaignOwnerInventoryResult(JSON.stringify({
    type:"campaign-owner-inventory-result",
    sessionId:"s",
    correlationId:"c",
    actorId:"char.remote",
    accepted:true,
    projection:{characterId:"char.remote",sourceRevision:3,runtimeRevision:9},
  }));
  assert.equal(accepted?.accepted,true);
  assert.equal(accepted?.projection?.runtimeRevision,9);

  const rejected=decodeCampaignOwnerInventoryResult(JSON.stringify({
    type:"campaign-owner-inventory-result",sessionId:"s",correlationId:"c2",actorId:"char.remote",accepted:false,error:"owner write failed",
  }));
  assert.equal(rejected?.accepted,false);
  assert.equal(rejected?.error,"owner write failed");
});
