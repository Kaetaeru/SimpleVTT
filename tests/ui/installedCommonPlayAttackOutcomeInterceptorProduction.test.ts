import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { CharacterSheet } from "../../src/app/contracts";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};

const ORIGINAL:Identity={
  moduleId:"external.attack-outcome-module",
  contentId:"item.attack-outcome-guard",
  mechanicId:"mechanic.attack-outcome-guard",
  interceptorId:"interceptor.attack-outcome-guard",
  interactionId:"interaction.attack-outcome-guard",
  displayName:"Unknown Outcome Guard",
};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",moduleId:identity.moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown attack outcome interceptor",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,category:"item",
      presentation:{defaultLocale:"en",originalName:identity.displayName,locales:{en:{name:identity.displayName}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:identity.mechanicId,
        payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
        interceptors:[{
          id:identity.interceptorId,timing:"attack.outcome-determined",
          interaction:{id:identity.interactionId,kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"always",stalePolicy:"cancel"},
          operation:"recalculate",slot:"attack.outcome",
          operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:5}}],
        }],
      }}],
    }],
  });
}

async function prepare(identity:Identity) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.startProductionLocalPlay("dm");
  const preview=await adapter.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter.items.push({
    id:`owned.${identity.contentId}`,definitionId:identity.contentId,name:identity.displayName,nameEn:identity.displayName,
    kind:"magic",quantity:1,equipped:true,passiveEffects:[],grantedActionIds:[],provenance:[identity.moduleId],
  });
  await adapter.startInitiative();
  await adapter.setCurrentActor("combatant.goblin-a");
  return adapter;
}

async function resolveGuardedAttack(adapter:MockAdapter) {
  let snapshot=await adapter.getSnapshot();
  const targetId=snapshot.activeCharacter.id;
  const targetBefore=snapshot.scene.entities.find((entry)=>entry.id===targetId)!;
  const hpBefore=targetBefore.hp;
  const tempHpBefore=targetBefore.tempHp;
  await adapter.setQueuedD20(18);
  snapshot=await adapter.resolveAction("action.scimitar",[targetId]);
  for(let guard=0;guard<6&&snapshot.resolution?.stage!=="interrupt";guard++) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  assert.match(snapshot.resolution?.interrupt?.optionName??"",/Outcome Guard|Renamed Guard/);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
  while(snapshot.resolution?.stage!=="complete") snapshot=await adapter.advanceResolution();
  const targetAfter=snapshot.scene.entities.find((entry)=>entry.id===targetId)!;
  return {
    snapshot,targetId,hpBefore,tempHpBefore,
    mechanical:{
      outcome:snapshot.resolution?.attackOutcome,
      hp:targetAfter.hp,tempHp:targetAfter.tempHp,
      reaction:snapshot.scene.economyByActor[targetId]?.reaction,
    },
  };
}

async function captureBatches(operation:()=>Promise<unknown>) {
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try { await operation(); }
  finally { tauriSessionTransport.send=originalSend; }
  return wires
    .map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
}

test("unknown installed attack.outcome-determined interceptor is production-authoritative and identity invariant",async()=>{
  const renamed:Identity={
    moduleId:"external.renamed-outcome-module",contentId:"item.renamed-outcome-guard",mechanicId:"mechanic.renamed-outcome-guard",
    interceptorId:"interceptor.renamed-outcome-guard",interactionId:"interaction.renamed-outcome-guard",displayName:"Completely Renamed Guard",
  };
  const run=async(identity:Identity)=>{
    const adapter=await prepare(identity);
    return (await resolveGuardedAttack(adapter)).mechanical;
  };
  const original=await run(ORIGINAL);
  const changed=await run(renamed);
  assert.deepEqual(changed,original);
  assert.equal(original.outcome,"빗나감");
  assert.equal(original.reaction,false);
});

test("attack.outcome-determined interceptor converges on Client/reconnect, deduplicates, and Undo restores the authoritative state",async()=>{
  const sessionId="session.attack-outcome-interceptor";
  const host=await prepare(ORIGINAL);
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  let resolved:Awaited<ReturnType<typeof resolveGuardedAttack>>|undefined;
  const batches=await captureBatches(async()=>{resolved=await resolveGuardedAttack(host);});
  assert.ok(resolved);
  assert.ok(batches.length);
  const resolutionKinds=batches.flatMap((batch)=>batch.events).flatMap((event)=>event.payload.kind==="resolution"?event.payload.resolutionEvents.map((entry)=>entry.kind):[]);
  assert.ok(resolutionKinds.includes("use-economy"),JSON.stringify(resolutionKinds));

  const client=await prepare(ORIGINAL);
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  for(const batch of batches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batches.at(-1)!.events)).status,"duplicate");
  let clientSnapshot=await client.getSnapshot();
  let hostSnapshot=await host.getSnapshot();
  assert.equal(clientSnapshot.scene.economyByActor[resolved!.targetId]?.reaction,false);
  assert.deepEqual(
    clientSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId),
    hostSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId),
  );

  const reconnect=await prepare(ORIGINAL);
  const reconnectConnected=connectedStateFor(reconnect);
  reconnectConnected.mode="client";reconnectConnected.sessionId=sessionId;reconnectConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnect.getSnapshot();
  assert.deepEqual(
    reconnectSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId),
    hostSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId),
  );
  assert.equal(reconnectSnapshot.scene.economyByActor[resolved!.targetId]?.reaction,false);

  const undoBatches=await captureBatches(()=>host.undoLastResolution());
  assert.ok(undoBatches.length);
  for(const batch of undoBatches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  hostSnapshot=await host.getSnapshot();
  clientSnapshot=await client.getSnapshot();
  const hostTarget=hostSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId)!;
  const clientTarget=clientSnapshot.scene.entities.find((entry)=>entry.id===resolved!.targetId)!;
  assert.equal(hostTarget.hp,resolved!.hpBefore);
  assert.equal(hostTarget.tempHp,resolved!.tempHpBefore);
  assert.equal(hostSnapshot.scene.economyByActor[resolved!.targetId]?.reaction,true);
  assert.deepEqual({hp:clientTarget.hp,tempHp:clientTarget.tempHp},{hp:hostTarget.hp,tempHp:hostTarget.tempHp});
  assert.equal(clientSnapshot.scene.economyByActor[resolved!.targetId]?.reaction,true);
});
