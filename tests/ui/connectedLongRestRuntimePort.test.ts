import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogEntry, CharacterSheet, EconomyVm, SceneEntity } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { HostSessionLedger, type SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";
import {
  abortConnectedLongRestOwner,
  authorizeConnectedLongRestHostDecision,
  beginConnectedLongRestHostOffer,
  completeConnectedLongRestHostOwnerMaterialization,
  connectedLongRestClientRecoveryMessages,
  connectedLongRestHostRecoveryMessages,
  connectedLongRestOwnerPrompts,
  decideConnectedLongRestOwnerOffer,
  materializeConnectedLongRestOwnerAfterGlobalCommit,
  prepareAuthorizedConnectedLongRestOwner,
  receiveConnectedLongRestOwnerOffer,
  recordConnectedLongRestHostOwnerPrepared,
} from "../../src/app/connectedLongRestRuntimePort";

const SOURCE_ID="dnd.srd-5.2.1";
const VERSION="2024";
const SESSION_ID="session.connected-long-rest";
const PEER="peer.remote-rest";

function entry(contentId:string,category:CatalogEntry["category"],nameKo:string,nameEn:string):CatalogEntry & {contentId:string;sourceId:string} {
  return {
    id:catalogQualifiedId(contentId,SOURCE_ID,VERSION),contentId,sourceId:SOURCE_ID,category,nameKo,nameEn,
    scope:"builtin",source:"SRD 5.2.1",version:VERSION,description:"test",relationships:[],capabilities:[],
  };
}

const catalog:CatalogEntry[]=[
  entry("dnd.srd521.class.fighter","class","파이터","Fighter"),
  entry("dnd.srd521.species.human","species","인간","Human"),
  entry("dnd.srd521.background.soldier","background","군인","Soldier"),
];

function remoteCharacter():CharacterSheet {
  return {
    id:"char.remote-rest",name:"Remote Rest",className:"파이터",level:1,species:"인간",background:"군인",
    hp:5,maxHp:12,tempHp:3,ac:12,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:8},saves:[],skills:["운동"],features:["Second Wind"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"재기의 바람",current:0,max:2,source:"SRD Fighter"}],attacks:[],
    rulesProfileId:"dnd.srd-5.2.1",rulesProfileVersion:"0.1-draft",sourceRevision:4,runtimeRevision:6,
    classLevels:[{classId:"dnd.srd521.class.fighter",level:1}],
  };
}

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {
    protocolVersion:1,
    rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1","connected-long-rest-v1"],
    character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0},
  };
}

function entity(sheet:CharacterSheet):SceneEntity {
  return {
    id:sheet.id,name:sheet.name,side:"ally",kind:"character",hp:sheet.hp,maxHp:sheet.maxHp,tempHp:sheet.tempHp,ac:sheet.ac,
    initiative:14,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
  };
}

async function setupPair() {
  const host=new MockAdapter();
  const client=new MockAdapter();
  const sheet=remoteCharacter();
  (host as unknown as {catalog:CatalogEntry[]}).catalog=structuredClone(catalog);
  const clientState=client as unknown as {catalog:CatalogEntry[];activeCharacter:CharacterSheet;characters:CharacterSheet[];scene:{entities:SceneEntity[];currentActorId:string;selectedActorId:string}};
  clientState.catalog=structuredClone(catalog);
  clientState.activeCharacter=structuredClone(sheet);
  clientState.characters=[structuredClone(sheet)];
  clientState.scene.entities=[entity(sheet)];
  clientState.scene.currentActorId=sheet.id;
  clientState.scene.selectedActorId=sheet.id;
  await client.getSnapshot();
  await host.getSnapshot();

  await host.createCampaign({campaignId:"campaign.connected-rest",name:"Connected Rest"});
  await host.configureCampaignCalendar("campaign.connected-rest",{enabled:true,providerId:"builtin.gregorian"});
  await host.configureCampaignRations("campaign.connected-rest",{enabled:true,providerId:"builtin.tracking-only"});
  await host.adjustCampaignRations("campaign.connected-rest",{amount:5,note:"seed"});
  await host.upsertCampaignRosterMember("campaign.connected-rest",{
    rosterMemberId:"connected:char.remote-rest",label:sheet.name,kind:"player-character-ref",
    characterRef:{ownerHint:`client:${sheet.id}`,characterId:sheet.id},active:true,countsForRations:true,rationUnitsPerDay:1,stashPermission:"request",
  });

  const projection=buildCharacterSessionProjectionV1(sheet,catalog);
  assert.equal(acceptHostCharacterSessionProjection(host,PEER,manifest(sheet),projection).status,"accepted");
  const hostManifest:SessionCompatibilityManifest={
    protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",
    capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1","connected-long-rest-v1"],
  };
  const hostConnected=connectedStateFor(host);
  hostConnected.mode="host";
  hostConnected.sessionId=SESSION_ID;
  hostConnected.ledger=new HostSessionLedger(SESSION_ID,hostManifest);
  hostConnected.peerParticipants.set(PEER,`client:${sheet.id}`);
  hostConnected.peerManifests.set(PEER,manifest(sheet));
  const clientConnected=connectedStateFor(client);
  clientConnected.mode="client";
  clientConnected.sessionId=SESSION_ID;

  return {host,client,sheet};
}

test("connected Long Rest commits Campaign before owner materialization and refreshes only remote durable projection",async()=>{
  const {host,client,sheet}=await setupPair();
  const hostRuntime=host as unknown as {scene:{entities:SceneEntity[];economyByActor:Record<string,EconomyVm>};characters:Array<{id:string}>};
  const remoteEntity=hostRuntime.scene.entities.find((candidate)=>candidate.id===sheet.id)!;
  remoteEntity.status=["준비 행동"];
  remoteEntity.initiative=19;
  const preservedEconomy:EconomyVm={action:false,bonusAction:true,reaction:true,movement:12,movementMax:30};
  hostRuntime.scene.economyByActor[sheet.id]=structuredClone(preservedEconomy);

  const started=await beginConnectedLongRestHostOffer(host,{characterId:sheet.id,transactionId:"long-rest.runtime.1",advanceMinutes:480,consumeRations:true});
  assert.equal(started.peer,PEER);
  const preview=receiveConnectedLongRestOwnerOffer(client,started.offer);
  assert.equal(preview.sheet.hp,12);
  assert.deepEqual(connectedLongRestOwnerPrompts(client)[0].hp,{before:5,after:12});
  assert.equal((await client.getSnapshot()).activeCharacter.hp,5);

  const decision=decideConnectedLongRestOwnerOffer(client,started.offer.transactionId,true);
  assert.equal(connectedLongRestClientRecoveryMessages(client)[0]?.type,"long-rest-decision");
  const authorized=await authorizeConnectedLongRestHostDecision(host,PEER,decision);
  assert.equal(authorized.status,"ready");
  if(authorized.status!=="ready") return;
  assert.equal(connectedLongRestHostRecoveryMessages(host,PEER)[0]?.type,"long-rest-prepare-authorized");

  const prepared=await prepareAuthorizedConnectedLongRestOwner(client,authorized.preflight);
  assert.equal((await client.getSnapshot()).activeCharacter.hp,5,"owner prepare must remain invisible");
  assert.equal(connectedLongRestClientRecoveryMessages(client)[0]?.type,"long-rest-owner-prepared");

  const global=await recordConnectedLongRestHostOwnerPrepared(host,PEER,prepared);
  assert.equal(global.status,"committed");
  if(global.status!=="committed") return;
  assert.equal(global.snapshot.campaignSessionSystems?.calendar.absoluteMinute,480);
  assert.equal(global.snapshot.campaignSessionSystems?.rations.balance,4);
  assert.equal((await client.getSnapshot()).activeCharacter.hp,5,"global Campaign commit does not materialize owner Character by itself");
  assert.equal(connectedLongRestHostRecoveryMessages(host,PEER)[0]?.type,"long-rest-global-commit");

  const owner=await materializeConnectedLongRestOwnerAfterGlobalCommit(client,global.commit);
  assert.equal(owner.snapshot.activeCharacter.hp,12);
  assert.equal(owner.snapshot.activeCharacter.tempHp,0);
  assert.equal(owner.projection.runtimeRevision,7);
  assert.equal(connectedLongRestClientRecoveryMessages(client)[0]?.type,"long-rest-owner-materialized");

  const complete=await completeConnectedLongRestHostOwnerMaterialization(host,PEER,owner.materialized,owner.projection);
  assert.equal(complete.phase,"complete");
  assert.equal(projectedCharacterById(host,sheet.id)?.sheet.hp,12);
  const hostSnapshot=await host.getSnapshot();
  const projectedEntity=hostSnapshot.scene.entities.find((candidate)=>candidate.id===sheet.id)!;
  assert.equal(projectedEntity.hp,12);
  assert.equal(projectedEntity.tempHp,0);
  assert.equal(projectedEntity.initiative,19,"Host initiative remains Session authority");
  assert.deepEqual(projectedEntity.status,["준비 행동"],"Host transient status survives durable Character refresh");
  assert.deepEqual(hostSnapshot.scene.economyByActor[sheet.id],preservedEconomy,"turn economy remains Session authority");
  assert.equal(hostRuntime.characters.some((entry)=>entry.id===sheet.id),false,"remote Character is never copied into Host Character library");
  assert.equal(connectedLongRestHostRecoveryMessages(host,PEER).length,0);
});

test("connected Long Rest aborts owner preparation when Campaign revision drifts before global commit",async()=>{
  const {host,client,sheet}=await setupPair();
  const started=await beginConnectedLongRestHostOffer(host,{characterId:sheet.id,transactionId:"long-rest.runtime.stale",advanceMinutes:480,consumeRations:true});
  receiveConnectedLongRestOwnerOffer(client,started.offer);
  const decision=decideConnectedLongRestOwnerOffer(client,started.offer.transactionId,true);
  const authorized=await authorizeConnectedLongRestHostDecision(host,PEER,decision);
  assert.equal(authorized.status,"ready");
  if(authorized.status!=="ready") return;
  const prepared=await prepareAuthorizedConnectedLongRestOwner(client,authorized.preflight);

  await host.adjustCampaignRations("campaign.connected-rest",{amount:1,note:"concurrent mutation"});
  const global=await recordConnectedLongRestHostOwnerPrepared(host,PEER,prepared);
  assert.equal(global.status,"aborted");
  if(global.status!=="aborted") return;
  await abortConnectedLongRestOwner(client,global.transactionId,global.reason);

  const ownerSnapshot=await client.getSnapshot();
  assert.equal(ownerSnapshot.activeCharacter.hp,5);
  assert.equal(ownerSnapshot.activeCharacter.tempHp,3);
  const hostSnapshot=await host.getSnapshot();
  assert.equal(hostSnapshot.campaignSessionSystems?.calendar.absoluteMinute,0);
  assert.equal(hostSnapshot.campaignSessionSystems?.rations.balance,6);
  assert.equal(connectedLongRestOwnerPrompts(client)[0].phase,"aborted");
  assert.equal(connectedLongRestHostRecoveryMessages(host,PEER)[0]?.type,"long-rest-abort");
});
