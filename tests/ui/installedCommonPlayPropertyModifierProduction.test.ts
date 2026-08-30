import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.property-movement`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"slow",invocation:"manual",operations:[{kind:"property.modify",property:"movement.walk",operation:"set",value:{value:5},target:"actor",owner:"effect",source:"definition",duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"stack"}]},
    {id:"move",invocation:"manual",operations:[{kind:"movement.relocate",mode:"move",movementType:"walk",target:"actor",distance:{ref:"movement.walk"},destinationFact:{id:"property-move-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority"}}]},
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Unknown property module",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Unknown Property Movement",locales:{en:{name:"Unknown Property Movement"}}},mechanics:[{kind:"common-play",config}]}]})};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const pack=moduleJson(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});
  const before=await adapter.getSnapshot();
  const initialRemaining=before.scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action("slow"),["char.aelar"]);
  const modified=await adapter.getSnapshot();
  const modifiedState=snapshotAdapterTurnRuntimeState(adapter,modified.scene)!;
  assert.deepEqual(modifiedState.effects.at(-1)?.propertyModifier,{property:"movement.walk",operation:"set",value:{value:5},source:"definition",instancePolicy:"stack"});
  await adapter.resolveAction(action("move"),["char.aelar"]);
  const moved=await adapter.getSnapshot();
  return {spent:initialRemaining-moved.scene.economyByActor["char.aelar"]!.movement,resolution:moved.resolution};
}

test("unknown Common Play property modifier projects through Effect state into production movement",async()=>{
  const result=await run("external-property-a");
  assert.equal(result.spent,5,JSON.stringify(result.resolution));
  assert.equal(result.resolution?.stage,"complete");
});

test("renaming the external module preserves property-modified production movement",async()=>{
  const first=await run("external-property-a");
  const renamed=await run("renamed-property-b");
  assert.equal(first.spent,5);
  assert.equal(renamed.spent,5);
});
