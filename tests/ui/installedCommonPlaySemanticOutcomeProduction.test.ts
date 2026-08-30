import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

function payload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.option`;
  const mechanicId=`${prefix}.mechanic`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Semantic Outcome Probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Semantic Probe",locales:{en:{name:"Semantic Probe"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          entryPoints:[
            {id:"attack",invocation:"manual",targeting:{from:"targets",min:1,max:1},test:{kind:"attack-roll",roller:"actor",dc:{value:10}},operations:[]},
            {id:"save",invocation:"manual",test:{kind:"saving-throw",roller:"actor",dc:{value:14}},operations:[]},
          ],
        }}],
      }],
    }),
  };
}

async function prepare(prefix:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const pack=payload(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  return {adapter,action};
}

async function run(prefix:string) {
  const {adapter,action}=await prepare(prefix);
  await adapter.setQueuedD20(15);
  let snapshot=await adapter.resolveAction(action("attack"),["combatant.goblin-a"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  let history=runtimeResolutionEventHistory(adapter);
  const attack=history?.events.find((event)=>event.kind==="attack.hit");
  assert.ok(attack,JSON.stringify(history));
  assert.equal(attack.actorId,"char.aelar");
  assert.equal(attack.targetId,"combatant.goblin-a");

  await adapter.setQueuedD20(4);
  snapshot=await adapter.resolveAction(action("save"),["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  history=runtimeResolutionEventHistory(adapter);
  const save=history?.events.find((event)=>event.kind==="save.failure");
  assert.ok(save,JSON.stringify(history));
  assert.equal(save.actorId,"char.aelar");
  assert.equal(save.targetId,"char.aelar");
  return [attack.kind,save.kind];
}

test("unknown installed Common Play emits attack and save semantic outcome events through production commit",async()=>{
  assert.deepEqual(await run("unknown-semantic-a"),["attack.hit","save.failure"]);
});

test("production semantic outcome events do not depend on module, content, or mechanic identity",async()=>{
  assert.deepEqual(await run("renamed-semantic-b"),await run("unknown-semantic-a"));
});
