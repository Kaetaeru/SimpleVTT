import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

function modulePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const mechanicId=`${prefix}.mechanic`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",
      moduleId,
      moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
      defaultLocale:"en",
      source:{document:"Unknown Family I granted movement",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,
        category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Granted Movement",locales:{en:{name:"Portable Granted Movement"}}},
        mechanics:[{
          kind:"common-play",
          config:{
            schemaVersion:"0.2-draft",
            id:mechanicId,
            entryPoints:[{
              id:"move-now",
              invocation:"manual",
              operations:[{
                kind:"movement.grant",
                target:"actor",
                distance:{ref:"movement.walk"},
                maximumDistance:{ref:"movement.walk"},
                doesNotProvokeOpportunityAttacks:true,
              }],
            }],
          },
        }],
      }],
    }),
  };
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
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"move-now",
  });
  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(actionId,["char.aelar"]);
  const snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.economyByActor["char.aelar"]?.movement,before,"granted movement must not spend regular movement budget");
  const history=runtimeResolutionEventHistory(adapter);
  assert.equal(history?.events.length,1);
  assert.equal(history?.events[0]?.kind,"free-move");
  assert.deepEqual(history?.events[0]?.result,{
    distanceFeet:30,
    maximumDistanceFeet:30,
    regularMovementSpent:0,
    doesNotProvokeOpportunityAttacks:true,
  });
  assert.match(history?.events[0]?.provenance[0]?.reason??"",/without provoking Opportunity Attacks/);
  await adapter.undoLastResolution();
  assert.equal((await adapter.getSnapshot()).scene.economyByActor["char.aelar"]?.movement,before);
}

test("unknown Common Play executes granted movement through the generic free-move kernel",async()=>{
  await run("external-family-i-free-move");
});

test("renaming every external identity preserves granted movement semantics",async()=>{
  await run("renamed-family-i-free-move");
});
