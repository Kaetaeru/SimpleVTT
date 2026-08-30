import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

async function ready(adapter:MockAdapter) {
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  await adapter.selectDmActor("char.aelar");
}

async function finish(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  for(let step=0;step<6&&snapshot.resolution?.stage!=="complete";step+=1) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  return snapshot;
}

test("Unarmed Strike damage is a zero-die flat hit and participates in Extra Attack", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  let snapshot=await adapter.getSnapshot();
  const action=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.unarmed-strike.damage");
  assert.equal(action?.runtimeAttack?.sourceKind,"unarmed");
  assert.equal(action?.damage?.[0].dice,"0d2");
  const before=snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp;
  await adapter.setQueuedD20(20);
  await adapter.resolveAction("action.unarmed-strike.damage",["combatant.goblin-a"]);
  snapshot=await finish(adapter);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!.hp,before-(action?.damage?.[0].flat??0));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);
});

test("Unarmed grapple uses the target's better STR/DEX save, publishes condition, and Undo removes it", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.unarmed-strike.grapple",["combatant.goblin-a"]);
  let snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.saveResults[0]?.total,3,"Goblin chooses DEX +2 instead of STR -1");
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")&&status.includes("맨손 타격")));
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.extraAttacks?.length,1);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")),false);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true);
});

test("Unarmed shove applies public Prone without a spatial-module distance gate", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.unarmed-strike.shove-prone",["combatant.goblin-b"]);
  const snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-b")?.status.some((status)=>status.includes("넘어짐")));
  assert.equal(snapshot.resolution?.finalOutcome,"넘어짐 적용");
});

test("Unarmed control runtime follows payload semantics after action ID rename", async () => {
  const adapter=new MockAdapter();
  await ready(adapter);
  const originalGetSnapshot=adapter.getSnapshot.bind(adapter);
  adapter.getSnapshot=async()=>{
    const snapshot=await originalGetSnapshot();
    const action=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id==="action.unarmed-strike.grapple");
    if(action) action.id="action.external.renamed-control-probe";
    return snapshot;
  };
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.external.renamed-control-probe",["combatant.goblin-a"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.actionId,"action.external.renamed-control-probe");
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")));
});

test("Unarmed damage grapple and shove execute from structural payloads after action identity and presentation rename", async () => {
  const cases=[
    {canonicalId:"action.unarmed-strike.damage",renamedId:"action.external.unarmed.damage",targetId:"combatant.goblin-a",kind:"damage" as const},
    {canonicalId:"action.unarmed-strike.grapple",renamedId:"action.external.unarmed.control-a",targetId:"combatant.goblin-a",kind:"grapple" as const},
    {canonicalId:"action.unarmed-strike.shove-prone",renamedId:"action.external.unarmed.control-b",targetId:"combatant.goblin-b",kind:"shove" as const},
  ];

  for(const probe of cases) {
    const adapter=new MockAdapter();
    await ready(adapter);
    const baseline=await adapter.getSnapshot();
    const source=baseline.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id===probe.canonicalId);
    assert.ok(source);
    if(probe.kind==="damage") {
      assert.equal(source.runtimeAttack?.sourceKind,"unarmed");
      assert.equal(source.damage?.[0].dice,"0d2");
    } else {
      assert.equal(source.runtimeSaveCondition?.choose,"highest");
      assert.deepEqual(source.runtimeSaveCondition?.abilities,["str","dex"]);
    }

    const beforeHp=baseline.scene.entities.find((entry)=>entry.id===probe.targetId)?.hp;
    const originalGetSnapshot=adapter.getSnapshot.bind(adapter);
    adapter.getSnapshot=async()=>{
      const snapshot=await originalGetSnapshot();
      const action=snapshot.scene.actionsByActor["char.aelar"]?.find((entry)=>entry.id===probe.canonicalId);
      if(action) {
        action.id=probe.renamedId;
        action.name=`External ${probe.kind}`;
      }
      return snapshot;
    };

    await adapter.setQueuedD20(probe.kind==="damage"?20:1);
    await adapter.resolveAction(probe.renamedId,[probe.targetId]);
    const snapshot=probe.kind==="damage"?await finish(adapter):await adapter.getSnapshot();
    assert.equal(snapshot.resolution?.actionId,probe.renamedId);
    if(probe.kind==="damage") {
      assert.equal(snapshot.scene.entities.find((entry)=>entry.id===probe.targetId)?.hp,beforeHp!-(source.damage?.[0].flat??0));
    } else if(probe.kind==="grapple") {
      assert.ok(snapshot.scene.entities.find((entry)=>entry.id===probe.targetId)?.status.some((status)=>status.includes("붙잡힘")));
    } else {
      assert.ok(snapshot.scene.entities.find((entry)=>entry.id===probe.targetId)?.status.some((status)=>status.includes("넘어짐")));
    }
  }
});

test("connected unarmed condition converges once on every client", async () => {
  const sessionId="session.unarmed-condition";
  const host=new MockAdapter();
  await ready(host);
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await host.setQueuedD20(1);await host.resolveAction("action.unarmed-strike.grapple",["combatant.goblin-a"]); }
  finally { tauriSessionTransport.send=send; }
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(batch);

  const client=new MockAdapter();
  await ready(client);
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");
  const snapshot=await client.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.status.some((status)=>status.includes("붙잡힘")));
});
