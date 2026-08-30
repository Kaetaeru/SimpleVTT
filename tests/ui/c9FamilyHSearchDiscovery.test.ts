import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";
import { SIMPLEVTT_APP_RULES_PROFILE } from "../../src/app/realResolutionService";
import { resolvePendingResolution } from "../../src/domain/resolution";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.search`,mechanicId=`${prefix}.mechanic`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:"discover-hidden",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"ability-check",roller:"actor",dc:{value:10},perTarget:false},operations:[{kind:"effect.remove",selector:{from:"effects",where:{op:"all",args:[{op:"has-tag",ref:"tags",value:"hidden"},{op:"eq",left:{ref:"target.selected"},right:{value:true}}]},min:1,max:1,selection:"automatic"},when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}]}]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family H portable discovery probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Discovery",locales:{en:{name:"Portable Discovery"}}},mechanics:[{kind:"common-play",config}]}]})};
}

function scene(adapter:MockAdapter){return (adapter as unknown as {scene:SceneVm}).scene;}
function hidden(adapter:MockAdapter,targetId=TARGET_ID){return snapshotAdapterTurnRuntimeState(adapter,scene(adapter))?.effects.some((effect)=>effect.targetId===targetId&&effect.tags.includes("hidden"))??false;}
function seedHidden(adapter:MockAdapter,actorId:string,targetId=TARGET_ID){
  const state=snapshotAdapterTurnRuntimeState(adapter,scene(adapter)); assert.ok(state);
  const committed=resolvePendingResolution(SIMPLEVTT_APP_RULES_PROFILE,state!,{id:`resolution.portable-hidden.${targetId}`,actorId,sourceId:"external.portable-hidden",expectedRevision:state!.revision,operations:[{id:`op.portable-hidden.${targetId}`,kind:"apply-effect",effect:{id:`effect.portable-hidden.${targetId}`,sourceId:"external.portable-hidden",sourceActorId:targetId,targetId,kind:"marker",tags:["hidden"],duration:{kind:"special",key:"hidden-until-discovered"}}}]});
  assert.notEqual(committed.status,"rejected"); if(committed.status!=="rejected") assert.equal(commitAdapterTurnRuntimeState(adapter,scene(adapter),state!.revision,committed.state),true);
}

async function exercise(prefix:string){
  const adapter=new MockAdapter(); const pack=packagePayload(prefix); setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  let snapshot=await adapter.previewContentImport(pack.json); assert.ok(!snapshot.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(snapshot.contentImport?.validation));
  await adapter.activateContentImport(); await adapter.startInitiative(); const actorId=(await adapter.getSnapshot()).activeCharacter.id; await adapter.setCurrentActor(actorId); seedHidden(adapter,actorId);
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"discover-hidden"});
  await adapter.setQueuedD20(20); snapshot=await adapter.resolveAction(actionId,[TARGET_ID]); assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution)); assert.equal(hidden(adapter),false); assert.equal(snapshot.scene.economyByActor[actorId]?.action,false);
  snapshot=await adapter.undoLastResolution(); assert.equal(hidden(adapter),true); assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);
  await adapter.setQueuedD20(1); snapshot=await adapter.resolveAction(actionId,[TARGET_ID]); assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution)); assert.equal(hidden(adapter),true);
  return {failurePreserved:hidden(adapter),actionSpent:snapshot.scene.economyByActor[actorId]?.action===false};
}

test("unknown installed Common Play discovers Hidden through generic effect.remove and is identity invariant",async()=>{assert.deepEqual(await exercise("external.unknown-family-h-discovery"),await exercise("external.fully-renamed-family-h-discovery"));});
