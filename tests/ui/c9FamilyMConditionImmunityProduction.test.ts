import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/installedContentRuntimeAdapter";
import type { SceneVm } from "../../src/app/contracts";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { commitAdapterTurnRuntimeState, snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.mechanic`;
  const config={
    schemaVersion:"0.2-draft",id:mechanicId,
    entryPoints:[
      {id:"poison",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"condition.apply",condition:"poisoned",target:"target"}]},
      {id:"petrify",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"condition.apply",condition:"petrified",target:"target"}]},
      {id:"clear-petrified",invocation:"manual",targeting:{from:"targets",min:1,max:1},operations:[{kind:"condition.remove",condition:"petrified",target:"target"}]},
    ],
  };
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Family M condition immunity probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"condition",
        presentation:{defaultLocale:"en",originalName:"Condition Immunity Probe",locales:{en:{name:"Condition Immunity Probe"}}},
        mechanics:[{kind:"common-play",config}],
      }],
    }),
  };
}

async function exercise(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const action=(entryPointId:string)=>installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId,
  });
  const scene=(adapter as unknown as {scene:SceneVm}).scene;

  const seed=snapshotAdapterTurnRuntimeState(adapter,scene)!;
  const immune=structuredClone(seed);
  immune.combatants[TARGET_ID].conditionImmunities=["poisoned"];
  immune.revision+=1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,seed.revision,immune),true);
  let snapshot=await adapter.resolveAction(action("poison"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.match(snapshot.resolution?.detail.join("\n")??"",/poisoned suppressed by immunity/);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="poisoned"),false);

  const explicit=snapshotAdapterTurnRuntimeState(adapter,scene)!;
  const clearExplicit=structuredClone(explicit);
  clearExplicit.combatants[TARGET_ID].conditionImmunities=[];
  clearExplicit.revision+=1;
  assert.equal(commitAdapterTurnRuntimeState(adapter,scene,explicit.revision,clearExplicit),true);

  snapshot=await adapter.resolveAction(action("petrify"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="petrified"),true);

  snapshot=await adapter.resolveAction(action("poison"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.match(snapshot.resolution?.detail.join("\n")??"",/poisoned suppressed by immunity/);
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="poisoned"),false);

  snapshot=await adapter.resolveAction(action("clear-petrified"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.resolveAction(action("poison"),[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="poisoned"),true);
  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.effects.some((effect)=>effect.targetId===TARGET_ID&&effect.conditionId==="poisoned"),false);
}

test("unknown installed Common Play condition application honors explicit and rules-derived immunity under identity rename",async()=>{
  await exercise("unknown-family-m-immunity");
  await exercise("renamed-family-m-immunity");
});
