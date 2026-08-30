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
  const moduleId=`${prefix}.module`,contentId=`${prefix}.option`,mechanicId=`${prefix}.artifacts`;
  const durable={kind:"durable"};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Portable Object Vehicle Damage Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],content:[{
      id:contentId,category:"option",
      presentation:{defaultLocale:"en",originalName:"Portable Artifact Damage",locales:{en:{name:"Portable Artifact Damage"}}},
      mechanics:[{kind:"common-play",config:{
        schemaVersion:"0.2-draft",id:mechanicId,
        entryPoints:[
          {id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"wall"},{kind:"artifact.spawn",template:"vehicle"}]},
          {id:"wall-threshold",invocation:"manual",operations:[{kind:"artifact.damage",artifact:"wall",amount:{value:8},damageType:"slashing"}]},
          {id:"wall-force",invocation:"manual",operations:[{kind:"artifact.damage",artifact:"wall",amount:{value:7},damageType:"force"}]},
          {id:"wall-repair",invocation:"manual",operations:[{kind:"artifact.repair",artifact:"wall",amount:{value:3}}]},
          {id:"vehicle-hit",invocation:"manual",operations:[{kind:"artifact.damage",artifact:"vehicle",amount:{value:4},damageType:"lightning"}]},
        ],
        artifactTemplates:[
          {id:"wall",artifactKind:"object",duration:durable,lifetime:{kind:"until-destroyed"},initialState:{size:"large",armorClass:15,hp:{current:20,maximum:20},damageThreshold:5,damageDefenses:[{source:"portable.stone",kind:"resistance",damageType:"slashing"}],repairable:true}},
          {id:"vehicle",artifactKind:"object",duration:durable,lifetime:{kind:"until-destroyed"},initialState:{size:"huge",armorClass:13,hp:{current:30,maximum:30},damageThreshold:2,damageDefenses:[{source:"portable.conductive",kind:"vulnerability",damageType:"lightning"}],repairable:true}},
        ],
      }}],
    }],
  })};
}

async function action(adapter:MockAdapter,pack:ReturnType<typeof packagePayload>,entryPointId:string) {
  return adapter.resolveAction(installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,entryPointId,
  }),[]);
}

function objectState(adapter:MockAdapter,templateId:string) {
  const runtime=turnRuntimeSessions.get(adapter);
  assert.ok(runtime,"turn runtime must exist");
  const artifact=runtime.state.artifacts?.find((candidate)=>candidate.sourceActorId===ACTOR_ID&&candidate.templateId===templateId);
  assert.equal(artifact?.artifactKind,"object");
  assert.ok(artifact?.object);
  return artifact!.object!;
}

async function execute(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor(ACTOR_ID);

  assert.equal((await action(adapter,pack,"create")).resolution?.stage,"complete");
  assert.equal(objectState(adapter,"wall").hp.current,20);
  assert.equal(objectState(adapter,"vehicle").hp.current,30);

  assert.equal((await action(adapter,pack,"wall-threshold")).resolution?.stage,"complete");
  assert.equal(objectState(adapter,"wall").hp.current,20,"slashing 8 -> resistance 4 -> threshold 5 blocks damage");

  assert.equal((await action(adapter,pack,"wall-force")).resolution?.stage,"complete");
  assert.equal(objectState(adapter,"wall").hp.current,13);
  await adapter.undoLastResolution();
  assert.equal(objectState(adapter,"wall").hp.current,20,"event-native Undo restores object HP");

  assert.equal((await action(adapter,pack,"wall-repair")).resolution?.stage,"complete");
  assert.equal(objectState(adapter,"wall").hp.current,20,"repair remains capped at max HP");

  assert.equal((await action(adapter,pack,"vehicle-hit")).resolution?.stage,"complete");
  assert.equal(objectState(adapter,"vehicle").hp.current,22,"lightning vulnerability doubles 4 to 8 before threshold");
  await adapter.undoLastResolution();
  assert.equal(objectState(adapter,"vehicle").hp.current,30,"event-native Undo restores vehicle-like object HP");
  return {wall:objectState(adapter,"wall").hp.current,vehicle:objectState(adapter,"vehicle").hp.current};
}

test("unknown installed Common Play applies Object/Vehicle artifact threshold, defenses, repair, and Undo without identity dispatch",async()=>{
  assert.deepEqual(await execute("external.family-l-artifact"),{wall:20,vehicle:30});
  assert.deepEqual(await execute("completely.renamed-family-l-artifact"),{wall:20,vehicle:30});
});
