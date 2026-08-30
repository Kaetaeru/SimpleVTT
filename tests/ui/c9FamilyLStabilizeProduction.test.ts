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
    {id:"stabilize",invocation:"manual",operations:[{kind:"life.stabilize",target:"self"}]},
  ]};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable stabilization probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"Portable Stabilization",locales:{en:{name:"Portable Stabilization"}}},mechanics:[{kind:"common-play",config}]}],
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

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime);
  assert.equal(runtime.state.combatants[ACTOR_ID].life.hp.current,31);
  assert.equal(runtime.state.combatants[ACTOR_ID].life.hp.temporary,5);

  let snapshot=await adapter.resolveAction(action("down"),[ACTOR_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const down=structuredClone(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life);
  assert.equal(down.hp.current,0);
  assert.equal(down.hp.temporary,0);
  assert.equal(down.dead,false);
  assert.equal(down.unconscious,true);
  assert.equal(down.stable,false);

  snapshot=await adapter.resolveAction(action("stabilize"),[ACTOR_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const stabilized=structuredClone(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life);
  assert.equal(stabilized.hp.current,0);
  assert.equal(stabilized.dead,false);
  assert.equal(stabilized.unconscious,true);
  assert.equal(stabilized.stable,true);

  await adapter.undoLastResolution();
  assert.deepEqual(turnRuntimeSessions.get(adapter)!.state.combatants[ACTOR_ID].life,down,"Undo must restore the pre-stabilization life state");
  return {down,stabilized};
}

test("unknown installed Common Play stabilizes a living creature at 0 HP and Undo restores the unstable state under identity rename",async()=>{
  const first=await exercise("external.family-l-stabilize");
  const renamed=await exercise("renamed.family-l-stabilize");
  assert.deepEqual(renamed.stabilized,first.stabilized);
});
