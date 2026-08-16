import assert from "node:assert/strict";
import test from "node:test";
import { ClientSessionReplica, CONNECTED_SESSION_PROTOCOL_VERSION, HostSessionLedger } from "../../src/app/connectedSessionProtocol";

 test("client durable write-back failure does not advance the host-event cursor and the same event can be retried", async () => {
  const host=new HostSessionLedger("session.persist",{
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
  });
  const event=host.commitHostEvent({actorId:"char.aelar",payload:{
    kind:"resolution",
    resolutionId:"resolution.persist",
    resolutionEvents:[],
    stateChanges:["Character HP 10 → 7"],
    provenance:["host authoritative test"],
  }});
  const client=new ClientSessionReplica("session.persist");
  let durableAttempts=0;

  const failed=await client.applyAsync(event,async()=>{
    durableAttempts+=1;
    return {status:"rejected" as const,error:"simulated local Character persistence failure"};
  });
  assert.equal(failed.status,"rejected");
  assert.equal(client.cursor,0);
  assert.equal(host.cursor,1,"host shared history must remain committed independently of client disk failure");

  const retried=await client.applyAsync(event,async()=>{
    durableAttempts+=1;
    return {status:"committed" as const};
  });
  assert.equal(retried.status,"applied");
  assert.equal(client.cursor,1);
  assert.equal(durableAttempts,2);
  assert.equal(client.apply(event,()=>({status:"committed"})).status,"duplicate");
});
