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
import { exhaustionLevel } from "../../src/domain/conditions";
import { conditionEffectsFor } from "../../src/domain/combatState";

const TARGET_ID="combatant.goblin-a";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.condition`,mechanicId=`${prefix}.mechanic`;
  const config={
    schemaVersion:"0.2-draft",id:mechanicId,
    entryPoints:[{
      id:"exhaust",invocation:"manual",targeting:{from:"targets",min:1,max:1},
      operations:[{kind:"condition.apply",condition:"exhaustion",target:"target"}],
    }],
  };
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Family M exhaustion stacking probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],
      content:[{
        id:contentId,category:"condition",
        presentation:{defaultLocale:"en",originalName:"Exhaustion Probe",locales:{en:{name:"Exhaustion Probe"}}},
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
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"exhaust",
  });

  for(let level=1;level<=6;level+=1) {
    const snapshot=await adapter.resolveAction(actionId,[TARGET_ID]);
    assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
    const runtime=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
    const effects=conditionEffectsFor(runtime,TARGET_ID);
    assert.equal(exhaustionLevel(effects),level);
    assert.equal(runtime.combatants[TARGET_ID].life.dead,level===6);
  }

  await adapter.undoLastResolution();
  const undone=await adapter.getSnapshot();
  const runtime=snapshotAdapterTurnRuntimeState(adapter,undone.scene)!;
  const effects=conditionEffectsFor(runtime,TARGET_ID);
  assert.equal(exhaustionLevel(effects),5);
  assert.equal(runtime.combatants[TARGET_ID].life.dead,false);
}

test("unknown installed Common Play stacks Exhaustion to level 6 death and Undo restores level 5 under identity rename",async()=>{
  await exercise("unknown-family-m-exhaustion");
  await exercise("renamed-family-m-exhaustion");
});
