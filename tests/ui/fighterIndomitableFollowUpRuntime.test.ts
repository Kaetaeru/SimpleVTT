import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedActionRoutingAdapter";
import type { ActionVm, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { FIGHTER_ID, FIGHTER_INDOMITABLE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { applyConnectedClientEvents, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { ClientSessionReplica, HostSessionLedger, type ConnectedSessionEvent, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import { tauriSessionTransport } from "../../src/app/tauriSessionTransport";

const SAVE_ACTION="action.test.indomitable-save";
const CASTER="char.test-enemy-caster";

type Internal={activeCharacter:CharacterSheet;characters:CharacterSheet[];scene:SceneVm};

function savingThrowAction(targetId:string):ActionVm{return{id:SAVE_ACTION,actorId:CASTER,name:"시험용 공포",category:"basic",target:"enemy",economy:"행동",resolutionKind:"saving-throw",summary:"지혜 내성 DC 15",available:true,eligibleTargetIds:[targetId],maxTargets:1,saveDc:15,saveAbility:"지혜",saveHalf:false,damage:[{type:"정신",dice:"1d6",flat:0,average:6}],details:[]};}

async function prepareFighter(adapter:MockAdapter,id?:string){const initial=await adapter.getSnapshot();const human=initial.catalog.find((entry)=>(entry as {contentId?:string}).contentId==="dnd.srd521.species.human")!;const soldier=initial.catalog.find((entry)=>(entry as {contentId?:string}).contentId==="dnd.srd521.background.soldier")!;const fighter={...structuredClone(initial.activeCharacter),id:id??initial.activeCharacter.id,name:"Indomitable Fighter",className:"파이터",subclassName:undefined,subclassIds:{},species:human.nameKo||human.nameEn,background:soldier.nameKo||soldier.nameEn,level:9,classLevels:[{classId:FIGHTER_ID,className:"파이터",level:9}],features:[],equipment:[],items:[],attacks:[],cantrips:[],preparedSpells:[],resources:[]};const internal=adapter as unknown as Internal;internal.activeCharacter=fighter;internal.characters=[fighter];await adapter.getSnapshot();return (await adapter.getSnapshot()).activeCharacter;}

async function installNpcSave(adapter:MockAdapter,targetId:string){await adapter.setReferenceRole("dm");const internal=adapter as unknown as Internal;const template=internal.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!;internal.scene.entities.push({...structuredClone(template),id:CASTER,name:"Enemy Caster",kind:"character",side:"enemy"});internal.scene.actionsByActor[CASTER]=[savingThrowAction(targetId)];internal.scene.economyByActor[CASTER]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};await adapter.startInitiative();await adapter.setCurrentActor(CASTER);await adapter.selectDmActor(CASTER);}

test("failed Fighter save offers Indomitable, uses the reroll, and Undo restores HP and resource",async()=>{
  const adapter=new MockAdapter();const fighter=await prepareFighter(adapter);await installNpcSave(adapter,fighter.id);let snapshot=await adapter.getSnapshot();assert.ok(snapshot.scene.actionsByActor[CASTER]?.some((entry)=>entry.id===SAVE_ACTION),JSON.stringify({role:snapshot.role,current:snapshot.scene.currentActorId,actions:snapshot.scene.actionsByActor[CASTER]}));const beforeHp=snapshot.scene.entities.find((entry)=>entry.id===fighter.id)!.hp;const beforeUses=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)!.current;
  await adapter.setQueuedD20(1);await adapter.resolveAction(SAVE_ACTION,[fighter.id]);snapshot=await adapter.advanceResolution();assert.equal(snapshot.resolution?.interrupt?.optionName,"불굴",JSON.stringify({resolution:snapshot.resolution,resources:snapshot.activeCharacter.resources}));const baseModifier=snapshot.resolution!.saveResults[0]!.total-snapshot.resolution!.saveResults[0]!.d20;
  await adapter.setQueuedD20(10);snapshot=await adapter.respondToInterrupt(true);assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"성공");assert.equal(snapshot.resolution?.saveResults[0]?.total,10+baseModifier+9);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current,beforeUses-1);
  await adapter.advanceResolution();snapshot=await adapter.advanceResolution();assert.equal(snapshot.resolution?.stage,"complete");assert.equal(snapshot.scene.entities.find((entry)=>entry.id===fighter.id)?.hp,beforeHp);
  snapshot=await adapter.undoLastResolution();assert.equal(snapshot.scene.entities.find((entry)=>entry.id===fighter.id)?.hp,beforeHp);assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current,beforeUses);
});

test("remote Fighter owns the private Indomitable prompt and applies the Host event exactly once",async()=>{
  const client=new MockAdapter();const fighter=await prepareFighter(client,"char.remote-indomitable");const host=new MockAdapter();const projection=buildCharacterSessionProjectionV1(fighter,(await host.getSnapshot()).catalog);const manifest:SessionCompatibilityManifest={...connectedManifest(client),character:{characterId:fighter.id,sourceRevision:fighter.sourceRevision??0,runtimeRevision:fighter.runtimeRevision??0}};
  const accepted=acceptHostCharacterSessionProjection(host,"peer.indomitable",manifest,projection);assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);await installNpcSave(host,fighter.id);const hostState=connectedStateFor(host);hostState.mode="host";hostState.sessionId="session.indomitable";hostState.ledger=new HostSessionLedger(hostState.sessionId,connectedManifest(host));hostState.peerManifests.set("peer.indomitable",manifest);
  const wires:string[]=[];const send=tauriSessionTransport.send,sendTo=tauriSessionTransport.sendTo;tauriSessionTransport.send=async(message)=>{wires.push(message);return 1;};tauriSessionTransport.sendTo=async(_peer,message)=>{wires.push(message);return 1;};try{await host.setQueuedD20(1);await host.resolveAction(SAVE_ACTION,[fighter.id]);await host.advanceResolution();assert.ok(wires.map((wire)=>JSON.parse(wire)).some((wire)=>wire.type==="resolution-interrupt-prompt"&&wire.interrupt.responderId===fighter.id));await host.setQueuedD20(10);await host.respondToInterrupt(true);await host.advanceResolution();await host.advanceResolution();}finally{tauriSessionTransport.send=send;tauriSessionTransport.sendTo=sendTo;}
  const batch=wires.map((wire)=>JSON.parse(wire)).find((wire)=>wire.type==="event-batch") as {events:ConnectedSessionEvent[]}|undefined;assert.ok(batch,JSON.stringify(wires));await installNpcSave(client,fighter.id);const beforeUses=(await client.getSnapshot()).activeCharacter.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)!.current;const clientState=connectedStateFor(client);clientState.mode="client";clientState.sessionId="session.indomitable";clientState.replica=new ClientSessionReplica(clientState.sessionId);const applied=await applyConnectedClientEvents(client,batch.events);assert.equal(applied.status,"applied",JSON.stringify(applied));assert.equal((await applyConnectedClientEvents(client,batch.events)).status,"duplicate");assert.equal((await client.getSnapshot()).activeCharacter.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current,beforeUses-1);
});
