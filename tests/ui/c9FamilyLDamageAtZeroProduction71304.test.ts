import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";

const ACTOR_ID="char.aelar";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.life`;
  const config={schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"down",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:36},damageType:"force",target:"self"}]},
    {id:"damage-zero",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"self"}]},
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable damage-at-zero probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Damage At Zero",locales:{en:{name:"Portable Damage At Zero"}}},mechanics:[{kind:"common-play",config}]}],
  })};
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
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId});

  let snapshot=await adapter.resolveAction(action("down"),[ACTOR_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const down=structuredClone(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life);
  assert.equal(down.hp.current,0);
  assert.equal(down.dead,false);
  assert.equal(down.unconscious,true);
  assert.equal(down.deathSaves.failures,0);

  snapshot=await adapter.resolveAction(action("damage-zero"),[ACTOR_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const damagedAtZero=structuredClone(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life);
  assert.equal(damagedAtZero.hp.current,0);
  assert.equal(damagedAtZero.dead,false);
  assert.equal(damagedAtZero.unconscious,true);
  assert.equal(damagedAtZero.stable,false);
  assert.equal(damagedAtZero.deathSaves.failures,1);
  assert.equal((await adapter.getSnapshot()).activeCharacter.durableLifeFlags?.deathSaves?.failures,1,"damage-at-zero failure must write back durably");

  await adapter.undoLastResolution();
  assert.deepEqual(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life,down,"Undo must restore the pre-damage-at-zero life state");
  assert.equal((await adapter.getSnapshot()).activeCharacter.durableLifeFlags?.deathSaves?.failures??0,0,"Undo must reverse the durable death-save failure");
  return damagedAtZero;
}

test("unknown installed Common Play damage at 0 HP records one death-save failure durably and Undo reverses it under identity rename",async()=>{
  const first=await exercise("external.family-l-damage-zero");
  const renamed=await exercise("renamed.family-l-damage-zero");
  assert.deepEqual(renamed,first);
});
