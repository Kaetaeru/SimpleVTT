import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { turnRuntimeSessions } from "../../src/app/turnRuntimeSessionRegistry";
import type { DamageDefenseKind } from "../../src/domain/damage";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Damage Defense Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Damage Probe",locales:{en:{name:"Portable Damage Probe"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"apply",invocation:"manual",operations:[{kind:"damage.apply",amount:{value:8},damageType:"fire",target:"self"}],
      }]}}],
    }],
  })};
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const value=snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp;
  assert.equal(typeof value,"number");
  return value as number;
}

async function execute(prefix:string,kind:DamageDefenseKind) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist after initiative starts");
  runtime.state.combatants["char.aelar"].damageDefenses=[{source:`${prefix}.runtime-defense`,kind,damageType:"fire"}];

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  let snapshot=await adapter.getSnapshot();
  const before=hp(snapshot,"char.aelar");
  snapshot=await adapter.resolveAction(action,["char.aelar"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const after=hp(snapshot,"char.aelar");
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),"char.aelar"),before,"Undo must restore HP");
  return before-after;
}

test("unknown installed damage.apply honors generic target damage defenses with rename invariance and Undo",async()=>{
  const expected:Record<DamageDefenseKind,number>={resistance:4,vulnerability:16,immunity:0};
  for(const kind of ["resistance","vulnerability","immunity"] as const) {
    assert.equal(await execute(`external.family-l-${kind}`,kind),expected[kind]);
    assert.equal(await execute(`completely.renamed-family-l-${kind}`,kind),expected[kind]);
  }
});
