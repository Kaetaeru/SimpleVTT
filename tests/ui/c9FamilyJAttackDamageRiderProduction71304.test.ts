import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const ACTOR_ID="char.aelar";
const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.mechanic`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable attack damage rider probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable attack rider",locales:{en:{name:"Portable attack rider"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:mechanicId,
        entryPoints:[
          {id:"empower",invocation:"manual",operations:[{
            kind:"property.modify",property:"attack.damage.flat",operation:"add",value:{value:2},target:"actor",owner:"effect",source:"definition",
            duration:{kind:"elapsed",amount:{value:1},unit:"minutes"},lifetime:{kind:"until-duration",onEnd:"destroy"},instancePolicy:"unique-by-source",
          }]},
          {id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},
            test:{kind:"attack-roll",roller:"actor",dc:{value:1}},
            operations:[
              {kind:"damage.apply",amount:{value:1},damageType:"bludgeoning",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}},
              {kind:"damage.apply",amount:{value:1},damageType:"force",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}},
            ]},
        ],
      }}],
    }],
  })};
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.scene.entities.find((entry)=>entry.id===TARGET_ID)?.hp;
}

async function exercise(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  const before=hp(await adapter.getSnapshot())!;

  let snapshot=await adapter.resolveAction(action("empower"),[ACTOR_ID]);
  assert.equal(snapshot.resolution?.stage,"complete");

  await adapter.setQueuedD20(15);
  snapshot=await adapter.resolveAction(action("strike"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(hp(snapshot),before-4,"+2 attack.damage.flat rider must apply once to the first successful attack damage component, not once per component");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(hp(snapshot),before,"event-native Undo must restore the complete rider-adjusted attack transaction");
}

test("unknown installed Common Play applies a persistent generic attack damage rider exactly once per attack",async()=>{
  await exercise("external-family-j-attack-rider");
});

test("complete external identity rename preserves the generic attack damage rider",async()=>{
  await exercise("renamed-family-j-attack-rider");
});
