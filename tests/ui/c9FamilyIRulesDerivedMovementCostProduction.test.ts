import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function moduleJson(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.rules-movement-cost`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {
      id:"apply-cost-rule",
      invocation:"manual",
      operations:[{
        kind:"property.modify",
        property:"movement.cost.multiplier",
        operation:"set",
        value:{value:2},
        target:"actor",
        owner:"effect",
        source:"definition",
        duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},
        lifetime:{kind:"until-duration",onEnd:"destroy"},
        instancePolicy:"stack",
      }],
    },
    {
      id:"apply-drag-carry-rule",
      invocation:"manual",
      operations:[{
        kind:"property.modify",
        property:"movement.drag-carry.multiplier",
        operation:"set",
        value:{value:2},
        target:"actor",
        owner:"effect",
        source:"definition",
        duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},
        lifetime:{kind:"until-duration",onEnd:"destroy"},
        instancePolicy:"stack",
      }],
    },
    {
      id:"move",
      invocation:"manual",
      operations:[{
        kind:"movement.relocate",
        mode:"move",
        movementType:"walk",
        target:"actor",
        distance:{value:5},
        destinationFact:{
          id:"rules-cost-destination",
          fact:"spatial.legal-destination",
          subject:"actor",
          authority:"actor-owner",
          visibility:"actor-and-dm",
          unknownPolicy:"request-authority",
        },
      }],
    },
  ]};
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",
      moduleId,
      moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
      defaultLocale:"en",
      source:{document:"Unknown rules-derived movement cost module",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,
        category:"option",
        presentation:{defaultLocale:"en",originalName:"Unknown Movement Cost Rule",locales:{en:{name:"Unknown Movement Cost Rule"}}},
        mechanics:[{kind:"common-play",config}],
      }],
    }),
  };
}

async function run(prefix:string,ruleEntryPoint="apply-cost-rule",property="movement.cost.multiplier") {
  const adapter=new MockAdapter();
  const pack=moduleJson(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId,
  });

  const before=(await adapter.getSnapshot()).scene.economyByActor["char.aelar"]!.movement;
  await adapter.resolveAction(action(ruleEntryPoint),["char.aelar"]);
  const modified=await adapter.getSnapshot();
  assert.equal(modified.resolution?.stage,"complete",JSON.stringify(modified.resolution));
  assert.deepEqual(snapshotAdapterTurnRuntimeState(adapter,modified.scene)?.effects.at(-1)?.propertyModifier,{
    property,operation:"set",value:{value:2},source:"definition",instancePolicy:"stack",
  });

  await adapter.resolveAction(action("move"),["char.aelar"]);
  const moved=await adapter.getSnapshot();
  assert.equal(moved.resolution?.stage,"complete",JSON.stringify(moved.resolution));
  assert.equal(before-moved.scene.economyByActor["char.aelar"]!.movement,10,"rules-derived multiplier must double the cost of a 5-foot move");
  await adapter.undoLastResolution();
  const undone=await adapter.getSnapshot();
  assert.equal(undone.scene.economyByActor["char.aelar"]!.movement,before,"movement Undo must restore the exact budget while the rule Effect remains active");
  return before-moved.scene.economyByActor["char.aelar"]!.movement;
}

test("unknown installed Common Play consumes a rules-derived movement cost Effect through production movement",async()=>{
  assert.equal(await run("external-family-i-rules-cost"),10);
});

test("renaming the external movement-cost rule preserves production semantics",async()=>{
  assert.equal(await run("renamed-family-i-rules-cost"),10);
});

test("unknown installed Common Play consumes a drag/carry multiplier through production movement",async()=>{
  assert.equal(await run("external-family-i-drag-carry","apply-drag-carry-rule","movement.drag-carry.multiplier"),10);
});

test("renaming the drag/carry rule preserves production movement semantics",async()=>{
  assert.equal(await run("renamed-family-i-drag-carry","apply-drag-carry-rule","movement.drag-carry.multiplier"),10);
});
