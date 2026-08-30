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

const TARGET_ID="combatant.goblin-a";
const CHARACTER_TARGET_ID="char.aelar";

function packagePayload(prefix:string,multiplier?:number,amount=4,target:"target"|"self"="target") {
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.damage`;
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Damage Defense Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Damage Probe",locales:{en:{name:"Portable Damage Probe"}}},
      mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[{
        id:"apply",invocation:"manual",...(target==="target"?{targeting:{from:"targets",min:1,max:1}}:{}),
        operations:[{kind:"damage.apply",amount:{value:amount},damageType:"fire",...(multiplier===undefined?{}:{multiplier}),target}],
      }]}}],
    }],
  })};
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const value=snapshot.scene.entities.find((entity)=>entity.id===actorId)?.hp;
  assert.equal(typeof value,"number");
  return value as number;
}

async function execute(prefix:string,kind?:DamageDefenseKind,multiplier?:number) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,multiplier);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist after initiative starts");
  runtime.state.combatants[TARGET_ID].damageDefenses=kind?[{source:`${prefix}.runtime-defense`,kind,damageType:"fire"}]:[];

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  let snapshot=await adapter.getSnapshot();
  const before=hp(snapshot,TARGET_ID);
  snapshot=await adapter.resolveAction(action,[TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const after=hp(snapshot,TARGET_ID);
  await adapter.undoLastResolution();
  assert.equal(hp(await adapter.getSnapshot(),TARGET_ID),before,"Undo must restore HP");
  return before-after;
}

async function executeInstantDeath(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix,undefined,100,"self");
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(CHARACTER_TARGET_ID);

  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist after initiative starts");
  const before=structuredClone(runtime.state.combatants[CHARACTER_TARGET_ID].life);
  assert.equal(before.hp.current,31);
  assert.equal(before.hp.maximum,42);
  assert.equal(before.hp.temporary,5);

  const action=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"apply",
  });
  const snapshot=await adapter.resolveAction(action,[CHARACTER_TARGET_ID]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));

  const after=turnRuntimeSessions.get(adapter)!.state.combatants[CHARACTER_TARGET_ID].life;
  assert.equal(after.hp.current,0);
  assert.equal(after.dead,true,"64 overflow damage must meet the 42 max-HP instant-death threshold");
  assert.equal(after.unconscious,false,"instant death must not leave the character merely unconscious");

  await adapter.undoLastResolution();
  assert.deepEqual(turnRuntimeSessions.get(adapter)!.state.combatants[CHARACTER_TARGET_ID].life,before,"Undo must restore the complete pre-damage life state");
  return {current:after.hp.current,dead:after.dead,unconscious:after.unconscious};
}

test("unknown installed damage.apply honors generic target damage defenses with rename invariance and Undo",async()=>{
  const expected:Record<DamageDefenseKind,number>={resistance:2,vulnerability:8,immunity:0};
  for(const kind of ["resistance","vulnerability","immunity"] as const) {
    assert.equal(await execute(`external.family-l-${kind}`,kind),expected[kind]);
    assert.equal(await execute(`completely.renamed-family-l-${kind}`,kind),expected[kind]);
  }
});

test("unknown installed damage.apply honors schema-declared multiplier with profile rounding, rename invariance, and Undo",async()=>{
  assert.equal(await execute("external.family-l-multiplier",undefined,0.6),2);
  assert.equal(await execute("completely.renamed-family-l-multiplier",undefined,0.6),2);
});

test("unknown installed damage.apply enforces character instant-death overkill with rename invariance and Undo",async()=>{
  assert.deepEqual(
    await executeInstantDeath("external.family-l-instant-death"),
    await executeInstantDeath("completely.renamed-family-l-instant-death"),
  );
});
