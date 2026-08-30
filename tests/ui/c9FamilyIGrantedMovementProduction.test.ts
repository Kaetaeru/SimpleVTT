import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

function modulePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const mechanicId=`${prefix}.mechanic`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Unknown granted movement",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Granted Step",locales:{en:{name:"Portable Granted Step"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"step",invocation:"manual",operations:[{
          kind:"movement.relocate",mode:"granted",target:"actor",distance:{value:10},
          doesNotProvokeOpportunityAttacks:true,
          destinationFact:{id:"granted-destination",fact:"spatial.legal-destination",subject:"actor",authority:"actor-owner",visibility:"actor-and-dm",unknownPolicy:"request-authority"}
        }]
      }]}}]
    }]
  })};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const pack=modulePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"step"});
  await adapter.resolveAction(actionId,["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete","unknown granted movement must commit through Common Play");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"granted movement must not spend regular movement budget");
  assert.match(snapshot.resolution?.detail.join("\n")??"",/granted movement/i);
  return before;
}

test("unknown Common Play executes granted movement without named movement dispatch",async()=>{
  assert.equal(await run("external-family-i-granted"),30);
});

test("renaming external granted-movement identities preserves semantics",async()=>{
  assert.equal(await run("renamed-family-i-granted"),30);
});
