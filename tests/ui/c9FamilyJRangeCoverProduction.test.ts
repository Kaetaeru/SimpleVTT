import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const TARGET_ID="combatant.goblin-a";
const DAMAGE={kind:"damage.apply",amount:{value:2},damageType:"piercing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}};

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.range-cover`;
  const mechanicId=`${prefix}.mechanic`;
  const attack=(id:string,operations:Record<string,unknown>[])=>({
    id,invocation:"manual",targeting:{from:"targets",min:1,max:1},
    test:{kind:"attack-roll",roller:"actor",dc:{value:15},perTarget:false},
    operations:[...operations,DAMAGE],
  });
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    attack("baseline",[]),
    attack("long-range",[{kind:"roll.modify",mode:"disadvantage"}]),
    attack("half-cover",[{kind:"roll.modify",mode:"target-add",value:{value:2}}]),
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Family J range and cover probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Range Cover Probe",locales:{en:{name:"Portable Range Cover Probe"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  })};
}

async function install(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  let snapshot=await adapter.previewContentImport(pack.json);
  assert.ok(!snapshot.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(snapshot.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {adapter,action};
}

async function exercise(prefix:string) {
  const {adapter,action}=await install(prefix);
  const initial=(await adapter.getSnapshot()).scene.entities.find((entity)=>entity.id===TARGET_ID)!.hp;

  await adapter.setQueuedD20(18);
  let snapshot=await adapter.resolveAction(action("baseline"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"attack");
  assert.equal(snapshot.resolution?.rollTotal,18);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===TARGET_ID)?.hp,initial-2,"baseline hit must apply damage");
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===TARGET_ID)?.hp,initial,"Undo must restore baseline damage");

  await adapter.setQueuedD20(18);
  snapshot=await adapter.resolveAction(action("long-range"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"attack");
  assert.equal(snapshot.resolution?.rollTotal,12,"long-range disadvantage must select the lower authoritative d20");
  assert.match(snapshot.resolution?.compact??"",/vs 15 .* failure/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===TARGET_ID)?.hp,initial,"failed long-range attack must not apply hit-only damage");

  await adapter.setQueuedD20(16);
  snapshot=await adapter.resolveAction(action("half-cover"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"attack");
  assert.equal(snapshot.resolution?.rollTotal,16);
  assert.match(snapshot.resolution?.compact??"",/vs 17 .* failure/);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===TARGET_ID)?.hp,initial,"cover-adjusted miss must not apply hit-only damage");
}

test("unknown installed Common Play composes long-range disadvantage and cover target adjustment through attack resolution",async()=>{
  await exercise("unknown-family-j-range-cover");
  await exercise("renamed-family-j-range-cover");
});
