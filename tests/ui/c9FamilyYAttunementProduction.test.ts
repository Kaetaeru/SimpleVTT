import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { acceptHostCharacterSessionProjection } from "../../src/app/connectedCharacterProjectionHandshake";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { applyCommonPlayItemAttunement, applyCommonPlayItemAttunementLoss } from "../../src/app/commonPlayItemInventoryProjection";
import type { AppSnapshot, CharacterSheet, ItemInstanceVm } from "../../src/app/contracts";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SessionCompatibilityManifest } from "../../src/app/connectedSessionProtocol";

const DEFINITION_ID="dnd.srd521.item.armor.chain-mail";

function item(id:string,overrides:Partial<ItemInstanceVm>={}):ItemInstanceVm {
  return {
    id,definitionId:DEFINITION_ID,name:"Attunement Probe",kind:"magic",quantity:1,equipped:true,
    attunementRequired:true,attuned:false,passiveEffects:["active only while attuned"],grantedActionIds:[],
    provenance:["Family Y production probe"],...overrides,
  };
}

test("app projection preserves generic prerequisite, capacity, cursed, and loss semantics for renamed item instances",()=>{
  for(const id of ["family-y-item-a","renamed-external-item-b"]){
    const base=item(id,{attunementPolicy:{prerequisite:{op:"gte",left:{ref:"actor.level"},right:{value:5}},cursed:true,loss:{onDeath:true}}});
    assert.throws(()=>applyCommonPlayItemAttunement({ownerId:"owner",revision:2,items:[base],itemId:id,action:"attune",maximum:3,facts:{"actor.level":5}}),/Short Rest/);
    assert.throws(()=>applyCommonPlayItemAttunement({ownerId:"owner",revision:2,items:[base],itemId:id,action:"attune",shortRestCompleted:true,maximum:3,facts:{"actor.level":4}}),/prerequisite/);
    const attuned=applyCommonPlayItemAttunement({ownerId:"owner",revision:2,items:[base],itemId:id,action:"attune",shortRestCompleted:true,maximum:3,facts:{"actor.level":5}});
    assert.equal(attuned.items[0].attuned,true);
    assert.throws(()=>applyCommonPlayItemAttunement({ownerId:"owner",revision:attuned.revision,items:attuned.items,itemId:id,action:"unattune",maximum:3}),/cursed/);
    const lost=applyCommonPlayItemAttunementLoss({ownerId:"owner",revision:attuned.revision,items:attuned.items,itemId:id,ownerDead:true});
    assert.equal(lost.items[0].attuned,false);
  }
  const full=[item("one",{attuned:true}),item("two",{attuned:true}),item("three",{attuned:true}),item("four")];
  assert.throws(()=>applyCommonPlayItemAttunement({ownerId:"owner",revision:7,items:full,itemId:"four",action:"attune",shortRestCompleted:true,maximum:3}),/maximum/);
});

function manifest(sheet:CharacterSheet):SessionCompatibilityManifest {
  return {protocolVersion:1,rulesProfileId:"dnd.srd-5.2.1",capabilities:["resolution-event-v1","character-projection-v1","event-cursor-v1"],character:{characterId:sheet.id,sourceRevision:sheet.sourceRevision??0,runtimeRevision:sheet.runtimeRevision??0}};
}

async function exercise(instanceId:string) {
  const store=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();setCharacterLibraryStoreForTests(adapter,store);
  let snapshot=await adapter.getSnapshot();
  const state=adapter as unknown as {activeCharacter:CharacterSheet};
  const source=state.activeCharacter.items.find((candidate)=>candidate.nameEn==="Chain Mail");
  assert.ok(source);
  Object.assign(source,item(instanceId,{attunementPolicy:{prerequisite:{op:"gte",left:{ref:"actor.level"},right:{value:1}},loss:{onDeath:true}}}));

  snapshot=await adapter.toggleItemAttunement(instanceId);
  assert.equal(snapshot.activeCharacter.items.find((candidate)=>candidate.id===instanceId)?.attuned,true);
  assert.match(snapshot.activity[0]?.summary??"",/짧은 휴식/);

  const restarted=new MockAdapter();setCharacterLibraryStoreForTests(restarted,store);
  snapshot=await restarted.getSnapshot();
  const durable=snapshot.activeCharacter.items.find((candidate)=>candidate.id===instanceId);
  assert.equal(durable?.attuned,true);
  assert.deepEqual(durable?.attunementPolicy?.loss,{onDeath:true});

  const host=new MockAdapter();
  setCharacterLibraryStoreForTests(host,new MemoryCharacterLibraryStore());
  await host.getSnapshot();
  const hostState=host as unknown as {catalog:AppSnapshot["catalog"]};hostState.catalog=structuredClone(snapshot.catalog);
  const projectedSheet={...snapshot.activeCharacter,id:`char.${instanceId}`,name:`Owner ${instanceId}`,items:[structuredClone(durable!)],equipment:[durable!.name]};
  const projection=buildCharacterSessionProjectionV1(projectedSheet,snapshot.catalog);
  const accepted=acceptHostCharacterSessionProjection(host,`peer.${instanceId}`,manifest(projectedSheet),projection);
  assert.equal(accepted.status,"accepted",accepted.status==="rejected"?accepted.error:undefined);
  const hostInventory=(await host.getSnapshot()).sessionCharacterInventories?.[projectedSheet.id];
  assert.equal(hostInventory?.items.find((candidate)=>candidate.id===instanceId)?.attuned,true);
  return {sourceRevision:snapshot.activeCharacter.sourceRevision,runtimeRevision:snapshot.activeCharacter.runtimeRevision};
}

test("Short Rest attunement persists and reconstructs on Host for arbitrary item instance identity",async()=>{
  const first=await exercise("family-y-production-a");
  const renamed=await exercise("renamed-family-y-production-b");
  assert.deepEqual(renamed,first);
});
