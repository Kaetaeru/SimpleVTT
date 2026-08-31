import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

const TARGET_ID="combatant.goblin-a";

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.mechanic`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
    id:"push",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
    operations:[{kind:"movement.relocate",mode:"push",target:"target",distance:{value:10},when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}},destinationFact:{id:"push-destination",fact:"spatial.legal-destination",subject:"target",authority:"host",visibility:"public",unknownPolicy:"request-authority"}}],
  }]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Unknown Family K Push probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Push",locales:{en:{name:"Portable Push"}}},mechanics:[{kind:"common-play",config}]}]})};
}

async function exercise(prefix:string,face:number) {
  const adapter=new MockAdapter(),pack=moduleJson(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"push"});
  await adapter.setQueuedD20(face);
  const snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  return (runtimeResolutionEventHistory(adapter)?.events??[]).filter((event)=>event.kind==="free-move");
}

test("unknown installed Common Play pushes the selected target only after a successful attack",async()=>{
  const hit=await exercise("external-family-k-push",15);
  assert.equal(hit.length,1);
  assert.equal(hit[0]?.actorId,"char.aelar");
  assert.equal(hit[0]?.targetId,TARGET_ID);
  const result=hit[0]?.result as {distanceFeet?:number;maximumDistanceFeet?:number;regularMovementSpent?:number;movementMode?:string;destinationRef?:string};
  assert.equal(result.distanceFeet,10);
  assert.equal(result.maximumDistanceFeet,10);
  assert.equal(result.regularMovementSpent,0);
  assert.equal(result.movementMode,"push");
  assert.match(String(result.destinationRef),/^manual:/);
  const miss=await exercise("external-family-k-push-miss",1);
  assert.equal(miss.length,1);
  assert.deepEqual(miss[0]?.result,{skipped:true});
});

test("Push-like conditional target movement is invariant to external module/content/mechanic identity",async()=>{
  const first=await exercise("external-family-k-push-a",15),renamed=await exercise("renamed-family-k-push-b",15);
  assert.equal(first[0]?.targetId,TARGET_ID);
  assert.equal(renamed[0]?.targetId,TARGET_ID);
  assert.equal((first[0]?.result as {movementMode?:string})?.movementMode,"push");
  assert.equal((renamed[0]?.result as {movementMode?:string})?.movementMode,"push");
});
