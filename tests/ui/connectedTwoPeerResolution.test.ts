import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { HostSessionLedger, ClientSessionReplica, CONNECTED_SESSION_PROTOCOL_VERSION } from "../../src/app/connectedSessionProtocol";
import { applyResolutionEvents } from "../../src/app/realEventApplyService";
import { takeCommittedResolutionEvents } from "../../src/app/resolutionEventCommitRegistry";

async function finishResolution(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for (let step=0;step<6&&snapshot.resolution?.stage!=="complete";step+=1) {
    assert.equal(snapshot.resolution?.canAdvance,true,`resolution stalled at ${snapshot.resolution?.stage}`);
    snapshot=await adapter.advanceResolution();
  }
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("host production ResolutionEvents converge a separate client replica exactly once", async () => {
  const host=new MockAdapter();
  const client=new MockAdapter();
  await host.startInitiative();
  await client.startInitiative();
  await host.setCurrentActor("char.aelar");
  await client.setCurrentActor("char.aelar");

  const clientBefore=await client.getSnapshot();
  await host.resolveAction("action.second-wind",["char.aelar"]);
  const hostAfter=await finishResolution(host);
  const resolutionId=hostAfter.resolution?.id;
  assert.ok(resolutionId);
  const events=takeCommittedResolutionEvents(resolutionId);
  assert.ok(events&&events.length>0,"production commit must expose canonical ResolutionEvent[] for host broadcast");

  const ledger=new HostSessionLedger("session.two-peer",{
    protocolVersion:CONNECTED_SESSION_PROTOCOL_VERSION,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],
  });
  const connected=ledger.commitHostEvent({
    actorId:"char.aelar",
    payload:{
      kind:"resolution",
      resolutionId,
      resolutionEvents:events!,
      stateChanges:[...(hostAfter.resolution?.stateChanges??[])],
      provenance:[...(hostAfter.resolution?.provenance??[])],
    },
  });
  const replica=new ClientSessionReplica("session.two-peer");
  let clientScene=structuredClone(clientBefore.scene);
  let clientResources=structuredClone(clientBefore.activeCharacter.resources);
  let clientItems=structuredClone(clientBefore.activeCharacter.items);
  let applicationCount=0;

  const apply=(payload:typeof connected.payload) => {
    if (payload.kind!=="resolution") return {status:"committed" as const};
    const applied=applyResolutionEvents(clientScene,payload.resolutionEvents,clientResources,clientItems);
    if (applied.status==="rejected") return applied;
    clientScene=applied.scene;
    clientResources=applied.resources;
    clientItems=applied.items;
    applicationCount+=1;
    return {status:"committed" as const};
  };

  assert.equal(replica.apply(connected,apply).status,"applied");
  assert.equal(replica.apply(connected,apply).status,"duplicate");
  assert.equal(applicationCount,1,"duplicate network delivery must not reapply host state");

  assert.equal(
    clientScene.entities.find((entry)=>entry.id==="char.aelar")?.hp,
    hostAfter.scene.entities.find((entry)=>entry.id==="char.aelar")?.hp,
  );
  assert.equal(clientScene.economyByActor["char.aelar"]?.bonusAction,hostAfter.scene.economyByActor["char.aelar"]?.bonusAction);
  assert.deepEqual(clientResources,hostAfter.activeCharacter.resources);
});
