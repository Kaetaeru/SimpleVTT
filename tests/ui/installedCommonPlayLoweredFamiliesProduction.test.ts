import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/connectedTurnRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { decodeConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const SAVE=JSON.parse(readFileSync(new URL("../fixtures/play-contract/multi-target-save-damage.json",import.meta.url),"utf8"));
const EFFECT=JSON.parse(readFileSync(new URL("../fixtures/play-contract/persistent-effect-trigger.json",import.meta.url),"utf8"));
const ZONE=JSON.parse(readFileSync(new URL("../fixtures/play-contract/persistent-zone-trigger.json",import.meta.url),"utf8"));

function artifactConfig(prefix:string) {
  const duration={kind:"durable"};const lifetime={kind:"durable"};
  const actorAction=installedCommonPlayActionId({catalogId:catalogQualifiedId(`${prefix}.actor-action`,`${prefix}.module`,"1"),mechanicId:`${prefix}.actor-action`,entryPointId:"bite"});
  return {schemaVersion:"0.2-draft",id:`${prefix}.artifacts`,entryPoints:[{id:"create-artifacts",invocation:"manual",operations:[
    {kind:"artifact.spawn",template:"summon"},{kind:"artifact.spawn",template:"wall"},{kind:"artifact.spawn",template:"form"},{kind:"artifact.spawn",template:"tether"},
  ]}],artifactTemplates:[
    {id:"summon",artifactKind:"actor",duration,lifetime,initialState:{combatantId:`${prefix}.summoned`,statDefinitionId:`${prefix}.stat`,ownerId:"actor",controllerId:"actor",side:"ally",initiative:"shared",properties:{"presentation.name":"Unknown Summon","defense.ac":13,"hp.maximum":10,"movement.walk":30},actionDefinitionIds:[actorAction],resources:[]}},
    {id:"wall",artifactKind:"object",duration,lifetime,initialState:{size:"large",armorClass:15,hp:{current:20,maximum:20},repairable:true}},
    {id:"form",artifactKind:"form",duration,lifetime,initialState:{targetActorId:"actor",propertyOverlay:{"movement.fly":30},retainedProperties:[],replacementProperties:["movement.fly"],hpPolicy:"retain",actionPolicy:"grant",spellcasting:"retain",actionDefinitionIds:[`${prefix}.claw`],resources:[]}},
    {id:"tether",artifactKind:"link",duration,lifetime,initialState:{endpointIds:["actor","artifact:summon"],relation:"tether",maximumLengthFeet:30}},
  ]};
}

function actorActionConfig(prefix:string) {
  return {schemaVersion:"0.2-draft",id:`${prefix}.actor-action`,payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],entryPoints:[
    {id:"bite",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:10}},operations:[{kind:"damage.apply",amount:"1d4+1",damageType:"piercing",target:"target"}]},
  ]};
}

function payload(prefix="unknown-gate-n") {
  const moduleId=`${prefix}.module`;
  const entries=[
    {id:`${prefix}.spell`,category:"spell",name:"Unknown Save Spell",config:{...SAVE,id:`${prefix}.save`}},
    {id:`${prefix}.feat`,category:"feat",name:"Unknown Retaliatory Feat",config:{...EFFECT,id:`${prefix}.effect`}},
    {id:`${prefix}.condition`,category:"condition",name:"Unknown Persistent Condition",config:{...ZONE,id:`${prefix}.zone`}},
    {id:`${prefix}.option`,category:"option",name:"Unknown Artifact Family",config:artifactConfig(prefix)},
    {id:`${prefix}.actor-action`,category:"option",name:"Unknown Bite",config:actorActionConfig(prefix)},
  ];
  return {moduleId,entries,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown Gate N module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:entries.map((entry)=>({
      id:entry.id,category:entry.category,
      presentation:{defaultLocale:"en",originalName:entry.name,locales:{en:{name:entry.name}}},
      mechanics:[{kind:"common-play",config:entry.config}],
    })),
  })};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const {action}=await install(adapter,prefix);
  const before=await adapter.getSnapshot();
  const hpBefore=before.scene.entities.filter((entity)=>entity.id.startsWith("combatant.goblin")).map((entity)=>entity.hp);
  await adapter.resolveAction(action(0,"release"),["combatant.goblin-a","combatant.goblin-b"]);
  const afterSave=await adapter.getSnapshot();
  const hpAfter=afterSave.scene.entities.filter((entity)=>entity.id.startsWith("combatant.goblin")).map((entity)=>entity.hp);
  await adapter.resolveAction(action(1,"activate"),["char.aelar"]);
  await adapter.resolveAction(action(2,"create-zone"),["char.aelar"]);
  await adapter.resolveAction(action(3,"create-artifacts"),["char.aelar"]);
  const afterAll=await adapter.getSnapshot();
  const runtime=snapshotAdapterTurnRuntimeState(adapter,afterAll.scene)!;
  return {adapter,hpDelta:hpBefore.map((hp,index)=>hp-hpAfter[index]),saveResolution:afterSave.resolution,effects:runtime.effects.length,artifactKinds:(runtime.artifacts??[]).map((artifact)=>artifact.artifactKind),summon:afterAll.scene.entities.find((entity)=>entity.id===`${prefix}.summoned`)};
}

async function install(adapter:MockAdapter,prefix:string) {
  const pack=payload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(index:number,entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.entries[index].id,pack.moduleId,"1"),
    mechanicId:pack.entries[index].config.id,
    entryPointId,
  });
  return {pack,action};
}

test("unknown multi-category Common Play save, effect, and zone lower through one production action route",async()=>{
  const result=await run("unknown-gate-n");
  assert.deepEqual(result.hpDelta,[12,21],JSON.stringify(result.saveResolution));
  assert.equal(result.effects,1);
  assert.deepEqual(result.artifactKinds,["zone","actor","object","form","link"]);
  assert.equal(result.summon?.name,"Unknown Summon");
  await result.adapter.undoLastResolution();
  const snapshot=await result.adapter.getSnapshot();
  assert.deepEqual(snapshotAdapterTurnRuntimeState(result.adapter,snapshot.scene)?.artifacts?.map((artifact)=>artifact.artifactKind),["zone"]);
  assert.equal(snapshot.scene.entities.some((entity)=>entity.id==="unknown-gate-n.summoned"),false);
});

test("renaming every external identity preserves lowered production semantics",async()=>{
  const first=await run("unknown-gate-n-a");
  const renamed=await run("completely-renamed-b");
  assert.deepEqual({hp:first.hpDelta,effects:first.effects,artifacts:first.artifactKinds},{hp:renamed.hpDelta,effects:renamed.effects,artifacts:renamed.artifactKinds});
});

test("portable zone and summoned Actor converge once through existing Host/Client event transport",async()=>{
  const sessionId="session.common-play-lowered-zone";
  const host=new MockAdapter();
  const {action}=await install(host,"unknown-connected");
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const wires:string[]=[];
  const originalSend=tauriSessionTransport.send;
  tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
  try {
    await host.resolveAction(action(2,"create-zone"),["char.aelar"]);
    await host.resolveAction(action(3,"create-artifacts"),["char.aelar"]);
  }
  finally { tauriSessionTransport.send=originalSend; }
  const batches=wires.map((wire)=>JSON.parse(wire)).filter((wire)=>wire.type==="event-batch") as Array<{events:ConnectedSessionEvent[]}>;
  assert.equal(batches.length,2,JSON.stringify(wires));
  assert.equal(wires.every((wire)=>decodeConnectedWireMessage(wire).status==="ok"),true,"runtime artifact event batches must cross the real wire decoder");

  const client=new MockAdapter();
  await install(client,"unknown-connected");
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  for(const batch of batches) assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"applied");
  assert.equal((await applyConnectedClientEvents(client,batches[1].events)).status,"duplicate");
  const hostSnapshot=await host.getSnapshot();
  const clientSnapshot=await client.getSnapshot();
  assert.deepEqual(
    snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts,
    snapshotAdapterTurnRuntimeState(host,hostSnapshot.scene)?.artifacts,
  );
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="unknown-connected.summoned")?.name,"Unknown Summon");
  const hostAction=hostSnapshot.scene.actionsByActor["unknown-connected.summoned"]?.[0];
  const clientAction=clientSnapshot.scene.actionsByActor["unknown-connected.summoned"]?.[0];
  assert.ok(hostAction&&clientAction);
  assert.deepEqual(
    {name:clientAction.name,economy:clientAction.economy,resolutionKind:clientAction.resolutionKind,target:clientAction.target},
    {name:hostAction.name,economy:hostAction.economy,resolutionKind:hostAction.resolutionKind,target:hostAction.target},
  );

  const undoWires:string[]=[];
  tauriSessionTransport.send=async(message)=>{undoWires.push(message);return 1;};
  try { await host.undoLastResolution(); }
  finally { tauriSessionTransport.send=originalSend; }
  const undoBatch=undoWires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
  assert.ok(undoBatch,JSON.stringify(undoWires));
  assert.equal(undoWires.every((wire)=>decodeConnectedWireMessage(wire).status==="ok"),true);
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal((await client.getSnapshot()).scene.entities.some((entity)=>entity.id==="unknown-connected.summoned"),false);
});

test("summoned Actor projects and executes its portable Common Play action with economy and Undo",async()=>{
  const prefix="unknown-summoned-action";
  const adapter=new MockAdapter();
  const {action}=await install(adapter,prefix);
  await adapter.resolveAction(action(3,"create-artifacts"),["char.aelar"]);
  await adapter.setCurrentActor(`${prefix}.summoned`);
  let snapshot=await adapter.getSnapshot();
  const bite=snapshot.scene.actionsByActor[`${prefix}.summoned`]?.find((entry)=>entry.name==="Unknown Bite");
  assert.ok(bite,JSON.stringify(snapshot.scene.actionsByActor[`${prefix}.summoned`]));
  assert.equal(bite.actorId,`${prefix}.summoned`);
  assert.equal(bite.economy,"행동");
  const before=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  await adapter.setQueuedD20(20);
  await adapter.resolveAction(bite.id,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp<before);
  assert.equal(snapshot.scene.economyByActor[`${prefix}.summoned`]?.action,false);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);
  assert.equal(snapshot.scene.economyByActor[`${prefix}.summoned`]?.action,true);
});

test("summoned Actor action and Undo converge through Host-authoritative connected events",async()=>{
  const prefix="unknown-connected-action",sessionId="session.common-play-summoned-action";
  const host=new MockAdapter();const {action}=await install(host,prefix);
  const hostConnected=connectedStateFor(host);hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const originalSend=tauriSessionTransport.send,spawnWires:string[]=[];
  tauriSessionTransport.send=async(message)=>{spawnWires.push(message);return 1;};
  try { await host.resolveAction(action(3,"create-artifacts"),["char.aelar"]); }
  finally { tauriSessionTransport.send=originalSend; }
  const spawnBatch=spawnWires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]};

  const client=new MockAdapter();await install(client,prefix);
  const clientConnected=connectedStateFor(client);clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,spawnBatch.events)).status,"applied");

  const turnWires:string[]=[];tauriSessionTransport.send=async(message)=>{turnWires.push(message);return 1;};
  try { await host.setCurrentActor(`${prefix}.summoned`); }
  finally { tauriSessionTransport.send=originalSend; }
  const turnBatch=turnWires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]};
  assert.equal((await applyConnectedClientEvents(client,turnBatch.events)).status,"applied");

  const before=(await host.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  const bite=(await host.getSnapshot()).scene.actionsByActor[`${prefix}.summoned`]![0];
  const actionWires:string[]=[];tauriSessionTransport.send=async(message)=>{actionWires.push(message);return 1;};
  try { await host.setQueuedD20(20);await host.resolveAction(bite.id,["combatant.goblin-a"]); }
  finally { tauriSessionTransport.send=originalSend; }
  const actionBatch=actionWires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]};
  assert.equal((await applyConnectedClientEvents(client,actionBatch.events)).status,"applied");
  assert.equal((await client.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,(await host.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp);

  const undoWires:string[]=[];tauriSessionTransport.send=async(message)=>{undoWires.push(message);return 1;};
  try { await host.undoLastResolution(); }
  finally { tauriSessionTransport.send=originalSend; }
  const undoBatch=undoWires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]};
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  assert.equal((await client.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);
});
