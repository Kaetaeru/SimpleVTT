import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import {applyConnectedClientEvents,connectedManifest} from "../../src/app/connectedSessionRuntimeAdapter";
import {connectedStateFor} from "../../src/app/connectedSessionState";
import {ClientSessionReplica,HostSessionLedger,type ConnectedSessionEvent} from "../../src/app/connectedSessionProtocol";
import {catalogQualifiedId} from "../../src/app/contentCatalogIdentity";
import {installedCommonPlayActionId} from "../../src/app/installedCommonPlayActionReference";
import {setInstalledContentStoreForTests} from "../../src/app/installedContentRuntimeAdapter";
import {MemoryInstalledContentStore} from "../../src/app/memoryInstalledContentStore";
import {MockAdapter} from "../../src/app/mockAdapter";
import {snapshotAdapterTurnRuntimeState} from "../../src/app/turnRuntimeSessionRegistry";
import {tauriSessionTransport} from "../../src/app/tauriSessionTransport";

function pack(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.mechanic`,catalogId=catalogQualifiedId(contentId,moduleId,"1");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId,mechanicId,entryPointId});
  return {create:action("create"),advance:action("advance"),recover:action("recover"),fall:action("fall"),trap:action("trap"),json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AE",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown exposure"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"exposure"}]},
    {id:"advance",invocation:"manual",operations:[{kind:"time.elapse",seconds:{value:200}},{kind:"exposure.advance",artifact:"exposure",seconds:{value:200},onInterval:{test:{kind:"saving-throw",roller:"actor",property:"save.con.modifier",dc:{value:100}},operations:[{kind:"damage.apply",amount:{value:1},damageType:"necrotic",target:"self",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}},{kind:"condition.apply",condition:"exhaustion",target:"self",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}]}}]},
    {id:"recover",invocation:"manual",operations:[{kind:"exposure.recover",artifact:"exposure"}]},
    {id:"fall",invocation:"manual",operations:[{kind:"environment.fall",target:"self",distanceFeet:{value:250},feetPerDie:10,maximumDice:20,damageType:"bludgeoning"}]},
    {id:"trap",invocation:"manual",test:{kind:"saving-throw",roller:"actor",property:"save.dex.modifier",dc:{value:100}},operations:[{kind:"damage.apply",amount:{value:1},damageType:"poison",target:"self",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}},{kind:"condition.apply",condition:"poisoned",target:"self",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"failure"}}}]},
  ],artifactTemplates:[{id:"exposure",artifactKind:"exposure",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{subjectId:"actor",revision:0,elapsedSeconds:0,thresholdSeconds:100,intervalSeconds:50,appliedIntervals:0,status:"active"}}]}}]}]})};
}

async function setup(prefix:string){
  const adapter=new MockAdapter(),definition=pack(prefix);setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(definition.json);assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();await adapter.startInitiative();await adapter.setCurrentActor("char.aelar");
  return {adapter,definition};
}
async function capture(adapter:MockAdapter,operation:()=>Promise<unknown>){const state=connectedStateFor(adapter);assert.ok(state.ledger);const cursor=state.ledger.cursor,send=tauriSessionTransport.send;tauriSessionTransport.send=async()=>1;try{await operation();}finally{tauriSessionTransport.send=send;}return state.ledger.eventsAfter(cursor) as ConnectedSessionEvent[];}
function exposureState(adapter:MockAdapter,scene:Awaited<ReturnType<MockAdapter["getSnapshot"]>>["scene"]){const state=snapshotAdapterTurnRuntimeState(adapter,scene)!;return {elapsed:state.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure?.elapsedSeconds,intervals:state.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure?.appliedIntervals,exhaustion:state.effects.filter((effect)=>effect.targetId==="char.aelar"&&effect.conditionId==="exhaustion").length};}

async function run(prefix:string){
  const {adapter,definition}=await setup(prefix);
  await adapter.resolveAction(definition.create,["char.aelar"]);const beforeSnapshot=await adapter.getSnapshot();const before=snapshotAdapterTurnRuntimeState(adapter,beforeSnapshot.scene)!;const life=before.combatants["char.aelar"].life.hp,hpTotal=life.current+life.temporary;const advancedSnapshot=await adapter.resolveAction(definition.advance,["char.aelar"]);assert.equal(advancedSnapshot.resolution?.actionId,definition.advance,JSON.stringify(advancedSnapshot.resolution));
  let exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,revision:exposure?.revision},{elapsed:200,intervals:3,revision:1},JSON.stringify(advancedSnapshot.resolution));
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.clock.elapsedSeconds,200);
  let state=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!;assert.equal(state.combatants["char.aelar"].life.hp.current+state.combatants["char.aelar"].life.hp.temporary,hpTotal-3,JSON.stringify(advancedSnapshot.resolution));assert.equal(state.effects.filter((effect)=>effect.targetId==="char.aelar"&&effect.conditionId==="exhaustion").length,3);
  await adapter.undoLastResolution();exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,revision:exposure?.revision},{elapsed:0,intervals:0,revision:0});
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.clock.elapsedSeconds,0);
  state=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!;assert.equal(state.combatants["char.aelar"].life.hp.current+state.combatants["char.aelar"].life.hp.temporary,hpTotal);assert.equal(state.effects.filter((effect)=>effect.targetId==="char.aelar"&&effect.conditionId==="exhaustion").length,0);
  await adapter.resolveAction(definition.advance,["char.aelar"]);await adapter.resolveAction(definition.recover,["char.aelar"]);
  exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,status:exposure?.status},{elapsed:0,intervals:0,status:"recovered"});
  await adapter.resolveAction(definition.trap,["char.aelar"]);assert.ok(snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!.effects.some((effect)=>effect.targetId==="char.aelar"&&effect.conditionId==="poisoned"));await adapter.undoLastResolution();
  const beforeFall=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!.combatants["char.aelar"].life.hp;await adapter.resolveAction(definition.fall,["char.aelar"]);const afterFall=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)!.combatants["char.aelar"].life.hp;assert.ok(afterFall.current+afterFall.temporary<beforeFall.current+beforeFall.temporary);
}

test("portable suffocation, deprivation, and extreme exposure share one identity-independent lifecycle",async()=>{for(const id of ["external.suffocation","external.dehydration","external.malnutrition","external.extreme-exposure","renamed.hazard"])await run(id);});

test("exposure intervals converge through connected replay, duplicate delivery, reconnect, and Undo",async()=>{const sessionId="session.family-ae",{adapter:host,definition}=await setup("external.connected-exposure"),hostConnection=connectedStateFor(host);hostConnection.mode="host";hostConnection.sessionId=sessionId;hostConnection.ledger=new HostSessionLedger(sessionId,connectedManifest(host));const created=await capture(host,()=>host.resolveAction(definition.create,["char.aelar"])),advanced=await capture(host,()=>host.resolveAction(definition.advance,["char.aelar"]));const {adapter:client}=await setup("external.connected-exposure"),clientConnection=connectedStateFor(client);clientConnection.mode="client";clientConnection.sessionId=sessionId;clientConnection.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(client,[...created,...advanced])).status,"applied");assert.deepEqual(exposureState(client,(await client.getSnapshot()).scene),exposureState(host,(await host.getSnapshot()).scene));assert.equal((await applyConnectedClientEvents(client,advanced)).status,"duplicate");const {adapter:reconnect}=await setup("external.connected-exposure"),reconnectConnection=connectedStateFor(reconnect);reconnectConnection.mode="client";reconnectConnection.sessionId=sessionId;reconnectConnection.replica=new ClientSessionReplica(sessionId);assert.equal((await applyConnectedClientEvents(reconnect,hostConnection.ledger.eventsAfter(0))).status,"applied");assert.deepEqual(exposureState(reconnect,(await reconnect.getSnapshot()).scene),exposureState(host,(await host.getSnapshot()).scene));const undone=await capture(host,()=>host.undoLastResolution());assert.equal((await applyConnectedClientEvents(client,undone)).status,"applied");assert.deepEqual(exposureState(client,(await client.getSnapshot()).scene),{elapsed:0,intervals:0,exhaustion:0});});
