import assert from "node:assert/strict";
import test from "node:test";
// The fake transport must be installed before the adapters bind the transport at import time.
import { fakeDesktopTransport } from "../fixtures/fakeDesktopTransportFirst";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/campaignRuntimeAdapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedCampaignSystemsRuntimeAdapter";
import "../../src/app/connectedLongRestSessionAdapter";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { projectedCharacterById } from "../../src/app/characterSessionProjectionRegistry";
import { setCampaignLibraryStoreForTests } from "../../src/app/campaignRuntimeAdapter";
import { decodeCampaignOwnerProjectionRefresh } from "../../src/app/connectedCampaignSystemsRuntimeAdapter";
import { beginConnectedLongRestHostOffer } from "../../src/app/connectedLongRestRuntimePort";
import { notifyConnectedOwnerWriteBack } from "../../src/app/connectedOwnerWriteBackPort";
import { connectedInternal, connectedManifest } from "../../src/app/connectedSessionRuntimeAdapter";
import { connectedStateFor } from "../../src/app/connectedSessionState";
import { MemoryCampaignLibraryStore } from "../../src/app/memoryCampaignLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";

/**
 * C1-08 (seen while playing the theater-of-mind scenario on Windows): 카엘 was bitten, his library wrote the HP back
 * and advanced its runtime revision, but the Host's mounted projection kept the join-time revision — so the DM's
 * Long Rest offer reached him stamped with a stale revision and was silently refused.
 */
function remoteSheet(adapter:MockAdapter){
  const app=connectedInternal(adapter);
  const sheet=structuredClone(app.activeCharacter);
  const classEntry=app.catalog.find((entry)=>entry.category==="class");
  const speciesEntry=app.catalog.find((entry)=>entry.category==="species");
  const backgroundEntry=app.catalog.find((entry)=>entry.category==="background");
  assert.ok(classEntry&&speciesEntry&&backgroundEntry);
  sheet.id="char.connected.wounded"; sheet.name="카엘";
  sheet.className=classEntry.nameKo; sheet.species=speciesEntry.nameKo; sheet.background=backgroundEntry.nameKo;
  sheet.classLevels=[{classId:(classEntry as typeof classEntry&{contentId:string}).contentId,level:sheet.level}];
  sheet.items=[]; sheet.equipment=[]; sheet.attacks=[];
  sheet.sourceRevision=3; sheet.runtimeRevision=1;
  const optional=sheet as typeof sheet&{subclassName?:string;cantrips?:string[];preparedSpells?:string[];spellbookSpells?:string[];masteryWeapons?:string[]};
  delete optional.subclassName; optional.cantrips=[]; optional.preparedSpells=[]; optional.spellbookSpells=[]; optional.masteryWeapons=[];
  return sheet;
}

async function waitUntil(predicate:()=>boolean,label:string){
  for(let attempt=0;attempt<60;attempt+=1){if(predicate())return;await new Promise<void>((resolve)=>setTimeout(resolve,5));}
  assert.fail(`timed out: ${label}`);
}

test("C1-08: a client's write-back sends its fresh projection to the Host", async () => {
  fakeDesktopTransport.reset();
  const client=new MockAdapter();
  const app=connectedInternal(client);
  await client.getSnapshot();
  app.activeCharacter.runtimeRevision=5;
  const state=connectedStateFor(client);
  state.mode="client"; state.sessionId="session.refresh";
  await notifyConnectedOwnerWriteBack(client);
  const refresh=fakeDesktopTransport.sent().map((message)=>decodeCampaignOwnerProjectionRefresh(message)).find((entry)=>entry!==null);
  assert.ok(refresh,`the owner sends campaign-owner-projection-refresh; sent=${JSON.stringify(fakeDesktopTransport.sent().map((message)=>message.slice(0,40)))}`);
  assert.equal(refresh.sessionId,"session.refresh");
  assert.equal(refresh.actorId,app.activeCharacter.id);
  assert.equal(refresh.projection.runtimeRevision,5,"the projection carries the library's current runtime revision");
});

test("C1-08: the Host's mounted projection follows the owner's refresh, and the Long Rest offer carries the new revision", async () => {
  fakeDesktopTransport.reset();
  const host=new MockAdapter();
  setCampaignLibraryStoreForTests(host,new MemoryCampaignLibraryStore());
  await host.getSnapshot();
  await host.createCampaign({campaignId:"campaign.refresh",name:"Refresh"});
  await host.prepareCampaignSessionSnapshot("campaign.refresh",{sessionName:"Refresh Session"});
  await host.hostSession();
  const sheet=remoteSheet(host);
  const manifest=connectedManifest(host);
  manifest.character={characterId:sheet.id,sourceRevision:sheet.sourceRevision,runtimeRevision:sheet.runtimeRevision};
  fakeDesktopTransport.emitFrom("peer.wounded",{type:"hello",manifest,participantId:`client:${sheet.id}`,participantName:sheet.name,knownEventCursor:0,projection:buildCharacterSessionProjectionV1(sheet,connectedInternal(host).catalog)});
  await waitUntil(()=>Boolean(connectedStateFor(host).peerParticipants.get("peer.wounded")),"hello mounts the projection");
  assert.equal(projectedCharacterById(host,sheet.id)?.runtimeRevision,1);

  // The wolf bit him: the owner's library wrote the HP back and advanced its runtime revision.
  const wounded=structuredClone(sheet); wounded.hp=1; wounded.runtimeRevision=2;
  const sessionId=connectedStateFor(host).sessionId!;
  fakeDesktopTransport.emitRaw("peer.wounded",JSON.stringify({type:"campaign-owner-projection-refresh",sessionId,actorId:sheet.id,projection:buildCharacterSessionProjectionV1(wounded,connectedInternal(host).catalog)}));
  await waitUntil(()=>projectedCharacterById(host,sheet.id)?.runtimeRevision===2,"the Host's mount follows the owner's revision");
  assert.equal(connectedStateFor(host).peerManifests.get("peer.wounded")?.character?.runtimeRevision,2,"the peer manifest follows too");

  const offer=await beginConnectedLongRestHostOffer(host,{characterId:sheet.id,advanceMinutes:480,consumeRations:false});
  assert.equal(offer.offer.character.runtimeRevision,2,"the Long Rest offer is stamped with the owner's current revision");

  // A backwards revision is ignored.
  const stale=structuredClone(sheet); stale.runtimeRevision=1;
  fakeDesktopTransport.emitRaw("peer.wounded",JSON.stringify({type:"campaign-owner-projection-refresh",sessionId,actorId:sheet.id,projection:buildCharacterSessionProjectionV1(stale,connectedInternal(host).catalog)}));
  await new Promise<void>((resolve)=>setTimeout(resolve,20));
  assert.equal(projectedCharacterById(host,sheet.id)?.runtimeRevision,2,"a backwards revision does not move the mount");
});
