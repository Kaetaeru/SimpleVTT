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
import { installedCommonPlayActionId, parseStoredInvocationCancelActionId, parseStoredInvocationCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";
import { decodeConnectedWireMessage } from "../../src/app/connectedSessionWire";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { readyActionConfigurationFor } from "../../src/app/standardActionReadyState";

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

function storedPayloadConfig(prefix:string) {
  return {schemaVersion:"0.2-draft",id:`${prefix}.ready-payload`,entryPoints:[{
    id:"release",invocation:"manual",targeting:{from:"targets",min:1,max:1},
    test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
    operations:[{kind:"damage.apply",amount:"1d4+1",damageType:"force",target:"target"}],
  }]};
}

function storedCaptureConfig(prefix:string) {
  return {schemaVersion:"0.2-draft",id:`${prefix}.ready-capture`,payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:"prepare",invocation:"manual",operations:[{kind:"artifact.spawn",template:"ready"}]}],
    artifactTemplates:[{id:"ready",artifactKind:"stored-invocation",duration:{kind:"durable"},lifetime:{kind:"until-trigger"},initialState:{
      ownerActorId:"actor",definitionId:`${prefix}.ready-payload`,entryPointId:"release",definitionRevision:"1",binding:"live",trigger:true,
    }}],
  };
}

function storedMovementPayloadConfig(prefix:string) {
  return {schemaVersion:"0.2-draft",id:`${prefix}.ready-movement-payload`,entryPoints:[{
    id:"release",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{value:10},destinationFact:{
      id:"ready-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority",
    }}],
  }]};
}

function storedMovementCaptureConfig(prefix:string) {
  return {schemaVersion:"0.2-draft",id:`${prefix}.ready-movement-capture`,payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
    entryPoints:[{id:"prepare",invocation:"manual",operations:[{kind:"artifact.spawn",template:"ready-movement"}]}],
    artifactTemplates:[{id:"ready-movement",artifactKind:"stored-invocation",duration:{kind:"durable"},lifetime:{kind:"until-trigger"},initialState:{
      ownerActorId:"actor",definitionId:`${prefix}.ready-movement-payload`,entryPointId:"release",definitionRevision:"1",binding:"live",trigger:true,
    }}],
  };
}

function storedConcentrationCaptureConfig(prefix:string) {
  const config=storedCaptureConfig(prefix);
  const initial=config.artifactTemplates[0].initialState as Record<string,unknown>;
  initial.concentrationGroupId="held-spell";
  initial.onTriggerConcentration="end";
  config.id=`${prefix}.ready-concentration-capture`;
  return config;
}

function payload(prefix="unknown-gate-n",paidIndex?:number) {
  const moduleId=`${prefix}.module`;
  const entries=[
    {id:`${prefix}.spell`,category:"spell",name:"Unknown Save Spell",config:{...SAVE,id:`${prefix}.save`}},
    {id:`${prefix}.feat`,category:"feat",name:"Unknown Retaliatory Feat",config:{...EFFECT,id:`${prefix}.effect`}},
    {id:`${prefix}.condition`,category:"condition",name:"Unknown Persistent Condition",config:{...ZONE,id:`${prefix}.zone`}},
    {id:`${prefix}.option`,category:"option",name:"Unknown Artifact Family",config:artifactConfig(prefix)},
    {id:`${prefix}.actor-action`,category:"option",name:"Unknown Bite",config:actorActionConfig(prefix)},
    {id:`${prefix}.ready-payload-content`,category:"spell",name:"Unknown Held Bolt",config:storedPayloadConfig(prefix)},
    {id:`${prefix}.ready-capture-content`,category:"option",name:"Unknown Prepare Bolt",config:storedCaptureConfig(prefix)},
    {id:`${prefix}.ready-movement-payload-content`,category:"option",name:"Unknown Held Movement",config:storedMovementPayloadConfig(prefix)},
    {id:`${prefix}.ready-movement-capture-content`,category:"option",name:"Unknown Prepare Movement",config:storedMovementCaptureConfig(prefix)},
    {id:`${prefix}.ready-concentration-capture-content`,category:"option",name:"Unknown Prepare Concentration",config:storedConcentrationCaptureConfig(prefix)},
  ];
  if(paidIndex!==undefined) Object.assign(entries[paidIndex].config,{
    payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
  });
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

async function install(adapter:MockAdapter,prefix:string,paidIndex?:number) {
  const pack=payload(prefix,paidIndex);
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

test("every non-operation lowerer commits its PaymentContract with the result and restores both on Undo",async()=>{
  const calls=[
    {entryPoint:"release",targets:["combatant.goblin-a","combatant.goblin-b"]},
    {entryPoint:"activate",targets:["char.aelar"]},
    {entryPoint:"create-zone",targets:["char.aelar"]},
    {entryPoint:"create-artifacts",targets:["char.aelar"]},
  ];
  for(const [index,call] of calls.entries()) {
    const adapter=new MockAdapter();
    const {action}=await install(adapter,`unknown-paid-${index}`,index);
    await adapter.resolveAction(action(index,call.entryPoint),call.targets);
    let snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false,`lowerer ${index} must commit its Action payment`);
    await adapter.undoLastResolution();
    snapshot=await adapter.getSnapshot();
    assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,true,`lowerer ${index} Undo must restore its Action payment`);
  }
});

test("portable zone and summoned Actor converge once through existing Host/Client event transport",async()=>{
  const sessionId="session.common-play-lowered-zone";
  const host=new MockAdapter();
  const {action}=await install(host,"unknown-connected",3);
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
  await install(client,"unknown-connected",3);
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
  assert.equal(clientSnapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(hostSnapshot.scene.economyByActor["char.aelar"]?.action,false);
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
  const clientAfterUndo=await client.getSnapshot();
  assert.equal(clientAfterUndo.scene.entities.some((entity)=>entity.id==="unknown-connected.summoned"),false);
  assert.equal(clientAfterUndo.scene.economyByActor["char.aelar"]?.action,true);
});

test("arbitrary installed stored invocation captures, fires off turn once, and restores through Undo",async()=>{
  const prefix="unknown-stored-invocation";
  const adapter=new MockAdapter();const {action}=await install(adapter,prefix);
  await adapter.resolveAction(action(6,"prepare"),["char.aelar"]);
  let snapshot=await adapter.getSnapshot();
  let runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(runtime.artifacts?.filter((artifact)=>artifact.artifactKind==="stored-invocation").length,1);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);

  await adapter.endTurn();
  snapshot=await adapter.getSnapshot();
  const trigger=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id));
  assert.ok(trigger,JSON.stringify(snapshot.scene.actionsByActor["char.aelar"]));
  assert.equal(trigger.economy,"반응");
  assert.equal(trigger.available,true);
  const before=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  await adapter.setQueuedD20(20);
  await adapter.resolveAction(trigger.id,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp<before);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(runtime.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),false);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,before);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,true);
  assert.equal(runtime.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);
});

test("stored invocation capture, trigger, and Undo converge through Host-authoritative event replay",async()=>{
  const prefix="unknown-connected-stored",sessionId="session.common-play-stored";
  const host=new MockAdapter();const {action}=await install(host,prefix);
  const hostConnected=connectedStateFor(host);hostConnected.mode="host";hostConnected.sessionId=sessionId;hostConnected.ledger=new HostSessionLedger(sessionId,connectedManifest(host));
  const originalSend=tauriSessionTransport.send;
  const runHost=async(operation:()=>Promise<unknown>)=>{
    const wires:string[]=[];tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};
    try { await operation(); } finally { tauriSessionTransport.send=originalSend; }
    const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;
    assert.ok(batch,JSON.stringify(wires));return batch;
  };
  const captureBatch=await runHost(()=>host.resolveAction(action(6,"prepare"),["char.aelar"]));

  const client=new MockAdapter();await install(client,prefix);
  const clientConnected=connectedStateFor(client);clientConnected.mode="client";clientConnected.sessionId=sessionId;clientConnected.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(client,captureBatch.events)).status,"applied");
  let clientSnapshot=await client.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);

  const turnBatch=await runHost(()=>host.endTurn());
  assert.equal((await applyConnectedClientEvents(client,turnBatch.events)).status,"applied");
  const trigger=(await host.getSnapshot()).scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id));
  assert.ok(trigger);
  await host.setQueuedD20(20);
  const triggerBatch=await runHost(()=>host.resolveAction(trigger.id,["combatant.goblin-a"]));
  assert.equal((await applyConnectedClientEvents(client,triggerBatch.events)).status,"applied");
  const hostAfter=await host.getSnapshot();clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp,hostAfter.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")?.hp);
  assert.equal(clientSnapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts,snapshotAdapterTurnRuntimeState(host,hostAfter.scene)?.artifacts);

  const undoBatch=await runHost(()=>host.undoLastResolution());
  assert.equal((await applyConnectedClientEvents(client,undoBatch.events)).status,"applied");
  clientSnapshot=await client.getSnapshot();
  assert.equal(clientSnapshot.scene.economyByActor["char.aelar"]?.reaction,true);
  assert.equal(snapshotAdapterTurnRuntimeState(client,clientSnapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);

  const reconnected=new MockAdapter();await install(reconnected,prefix);
  const reconnectState=connectedStateFor(reconnected);reconnectState.mode="client";reconnectState.sessionId=sessionId;reconnectState.replica=new ClientSessionReplica(sessionId);
  assert.equal((await applyConnectedClientEvents(reconnected,hostConnected.ledger!.eventsAfter(0))).status,"applied");
  const reconnectSnapshot=await reconnected.getSnapshot();
  const hostAfterUndo=await host.getSnapshot();
  assert.equal(reconnectSnapshot.scene.economyByActor["char.aelar"]?.reaction,true);
  assert.deepEqual(snapshotAdapterTurnRuntimeState(reconnected,reconnectSnapshot.scene)?.artifacts,snapshotAdapterTurnRuntimeState(host,hostAfterUndo.scene)?.artifacts);
});

test("stored invocation executes mapless movement from an actor-authority destination fact",async()=>{
  const prefix="unknown-stored-movement";
  const adapter=new MockAdapter();const {action}=await install(adapter,prefix);
  await adapter.resolveAction(action(8,"prepare"),["char.aelar"]);
  await adapter.endTurn();
  let snapshot=await adapter.getSnapshot();
  const trigger=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id));
  assert.ok(trigger);
  const before=snapshot.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(trigger.id,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before-10);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.ok(snapshot.activity[0]?.stateChanges.some((change)=>change.includes("movement")));
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,true);
});

test("Ready UI captures an installed Common Play payload without the legacy WeakMap execution path",async()=>{
  const prefix="unknown-ready-ui";
  const adapter=new MockAdapter();const {action}=await install(adapter,prefix);
  const payloadAction=action(5,"release");
  await adapter.configureReadyAction({actorId:"char.aelar",actionId:payloadAction,trigger:"적이 움직이면"});
  let snapshot=await adapter.getSnapshot();
  assert.equal(readyActionConfigurationFor(adapter),undefined);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.action,false);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"&&artifact.metadata?.triggerLabel==="적이 움직이면"),true);
  const cancel=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCancelActionId(candidate.id));
  assert.ok(cancel);
  await adapter.resolveAction(cancel.id,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),false);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);
  await adapter.endTurn();snapshot=await adapter.getSnapshot();
  const trigger=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id));
  assert.ok(trigger);
  assert.match(trigger.summary,/적이 움직이면/);
  await adapter.setQueuedD20(20);
  await adapter.resolveAction(trigger.id,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,false);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),false);
});

test("stored invocation expires at the owner's next turn start without firing",async()=>{
  const prefix="unknown-stored-expiry";
  const adapter=new MockAdapter();const {action}=await install(adapter,prefix);
  await adapter.resolveAction(action(6,"prepare"),["char.aelar"]);
  for(let turns=0;turns<10;turns+=1) {
    await adapter.endTurn();
    if((await adapter.getSnapshot()).scene.currentActorId==="char.aelar") break;
  }
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.currentActorId,"char.aelar");
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),false);
  assert.equal(snapshot.scene.actionsByActor["char.aelar"]?.some((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id)),false);
});

test("installed held-Concentration stored spell rejects after loss and restores release/cancel through Undo",async()=>{
  const prefix="unknown-stored-concentration";
  const adapter=new MockAdapter();const {action}=await install(adapter,prefix);
  const seedConcentration=(active:boolean)=>{
    const before=snapshotAdapterTurnRuntimeState(adapter,(adapter as unknown as {scene:Parameters<typeof snapshotAdapterTurnRuntimeState>[1]}).scene)!;
    const next=structuredClone(before);
    next.concentration["char.aelar"]=active?{actorId:"char.aelar",groupId:"held-spell",sourceId:`${prefix}.ready-payload`}:undefined;
    next.revision+=1;
    assert.equal(commitAdapterTurnRuntimeState(adapter,(adapter as unknown as {scene:Parameters<typeof snapshotAdapterTurnRuntimeState>[1]}).scene,before.revision,next),true);
  };
  seedConcentration(true);
  await adapter.resolveAction(action(9,"prepare"),["char.aelar"]);
  await adapter.endTurn();
  let snapshot=await adapter.getSnapshot();
  const trigger=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCommonPlayActionId(candidate.id));
  assert.ok(trigger);
  const hpBefore=snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;

  seedConcentration(false);
  await adapter.resolveAction(trigger.id,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hpBefore);
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.reaction,true);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);

  seedConcentration(true);
  await adapter.setQueuedD20(20);
  await adapter.resolveAction(trigger.id,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.ok(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp<hpBefore);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.concentration["char.aelar"],undefined);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp,hpBefore);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.concentration["char.aelar"]?.groupId,"held-spell");

  const cancel=snapshot.scene.actionsByActor["char.aelar"]?.find((candidate)=>parseStoredInvocationCancelActionId(candidate.id));
  assert.ok(cancel);
  await adapter.resolveAction(cancel.id,["char.aelar"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.concentration["char.aelar"],undefined);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),false);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.concentration["char.aelar"]?.groupId,"held-spell");
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.artifacts?.some((artifact)=>artifact.artifactKind==="stored-invocation"),true);
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
