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
import { FIGHTER_SECOND_WIND_RESOURCE_ID } from "../../src/domain/coreClassResources";

type Identity={moduleId:string;contentId:string;mechanicId:string;interceptorId:string;interactionId:string;displayName:string};
const ORIGINAL:Identity={
  moduleId:"external.attack-outcome-module",
  contentId:"item.attack-outcome-content",
  mechanicId:"mechanic.attack-outcome",
  interceptorId:"interceptor.attack-outcome",
  interactionId:"interaction.attack-outcome",
  displayName:"Unknown Outcome Guard",
};

function packagePayload(identity:Identity){
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
        payments:[
          {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"},
          {kind:"resource",resource:FIGHTER_SECOND_WIND_RESOURCE_ID,amount:{value:1},consumeAt:"commit"},
        ],
        interceptors:[{
          id:identity.interceptorId,timing:"attack.outcome-determined",operation:"recalculate",slot:"attack.outcome",
          interaction:{id:identity.interactionId,kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
          operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:100}}],
        }],
      }}],
    }],
  });
}

async function prepare(identity:Identity){
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
  return adapter;
}

function secondWind(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_SECOND_WIND_RESOURCE_ID)?.current;
}

async function executeAttack(adapter:MockAdapter){
  let snapshot=await adapter.setCurrentActor("combatant.goblin-a");
  const targetId=snapshot.activeCharacter.id;
  await adapter.setQueuedD20(18);
  snapshot=await adapter.resolveAction("action.scimitar",[targetId]);
  for(let step=0;step<5&&snapshot.resolution?.stage!=="interrupt";step++) snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"interrupt",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.respondToInterrupt(true);
  while(snapshot.resolution?.stage!=="complete") snapshot=await adapter.advanceResolution();
  return snapshot;
}

function mechanical(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>){
  const actorId=snapshot.activeCharacter.id;
  const actor=snapshot.scene.entities.find((entry)=>entry.id===actorId)!;
  return {
    outcome:snapshot.resolution?.attackOutcome,
    hp:actor.hp,
    tempHp:actor.tempHp,
    resource:secondWind(snapshot),
    reaction:snapshot.scene.economyByActor[actorId]?.reaction,
  };
}

test("installed attack.outcome-determined interceptor is production identity-invariant",async()=>{
  const renamed:Identity={
    moduleId:"external.fully-renamed-outcome",contentId:"item.fully-renamed-outcome",mechanicId:"mechanic.fully-renamed-outcome",
    interceptorId:"interceptor.fully-renamed-outcome",interactionId:"interaction.fully-renamed-outcome",displayName:"Fully Renamed Outcome Guard",
  };
  const run=async(identity:Identity)=>{
    const adapter=await prepare(identity);
    const before=await adapter.getSnapshot();
    const beforeMechanical=mechanical(before);
    const after=await executeAttack(adapter);
    return {before:beforeMechanical,after:mechanical(after)};
  };
  const original=await run(ORIGINAL);
  const changed=await run(renamed);
  assert.deepEqual(changed,original);
  assert.equal(original.after.outcome,"빗나감");
  assert.equal(original.after.hp+original.after.tempHp,original.before.hp+original.before.tempHp,"recalculated miss must prevent downstream damage");
  assert.equal(original.after.resource,original.before.resource!-1);
  assert.equal(original.after.reaction,false);
});

test("installed attack.outcome-determined interceptor converges, reconnects, deduplicates, and undoes through existing events",async()=>{
  const sessionId="session.attack-outcome-interceptor";
  const host=await prepare(ORIGINAL);
  let before=await host.getSnapshot();
  const beforeMechanical=mechanical(before);
  const hostState=connectedStateFor(host);
  hostState.mode="host";hostState.sessionId=sessionId;hostState.ledger=new HostSessionLedger(sessionId,connectedManifest(host));

  const wires:string[]=[];
  const send=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  let hostSnapshot;
  try { hostSnapshot=await executeAttack(host); }
  finally { tauriSessionTransport.send=send; }
  const forward=mechanical(hostSnapshot!);
  assert.equal(forward.outcome,"빗나감");
  assert.equal(forward.resource,beforeMechanical.resource!-1);
  assert.equal(forward.reaction,false);
  assert.equal(forward.hp+forward.tempHp,beforeMechanical.hp+beforeMechanical.tempHp);

  const batches=wires.map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
  assert.ok(batches.length,JSON.stringify(wires));

  const client=await prepare(ORIGINAL);
  const clientState=connectedStateFor(client);
  clientState.mode="client";clientState.sessionId=sessionId;clientState.replica=new ClientSessionReplica(sessionId);
  for(const batch of batches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batches.at(-1)!.events)).status,"duplicate");
  assert.deepEqual(mechanical(await client.getSnapshot()),forward);

  const reconnect=await prepare(ORIGINAL);
  const reconnectState=connectedStateFor(reconnect);
  reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnect,hostState.ledger!.eventsAfter(0))).status,"applied");
  assert.deepEqual(mechanical(await reconnect.getSnapshot()),forward);

  const undoWires:string[]=[];
  tauriSessionTransport.send=async(message)=>{undoWires.push(message);return 1;};
  try { await host.undoLastResolution(); }
  finally { tauriSessionTransport.send=send; }
  const undoBatches=undoWires.map((wire)=>JSON.parse(wire) as {type:string;events?:ConnectedSessionEvent[]})
    .filter((wire):wire is {type:"event-batch";events:ConnectedSessionEvent[]}=>wire.type==="event-batch"&&Array.isArray(wire.events));
  assert.ok(undoBatches.length,JSON.stringify(undoWires));
  for(const batch of undoBatches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  const restored=mechanical(await host.getSnapshot());
  assert.equal(restored.resource,beforeMechanical.resource);
  assert.equal(restored.reaction,true);
  assert.equal(restored.hp+restored.tempHp,beforeMechanical.hp+beforeMechanical.tempHp);
  assert.deepEqual(mechanical(await client.getSnapshot()),restored);
});
