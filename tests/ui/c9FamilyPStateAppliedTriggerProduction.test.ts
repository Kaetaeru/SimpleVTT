import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

function payload(suffix:string) {
  const moduleId=`homebrew.state-applied-${suffix}`;
  const contentId=`option.state-applied-${suffix}`;
  const listenerId=`external.listener-${suffix}`;
  const appliedId=`external.applied-${suffix}`;
  return {moduleId,contentId,listenerId,appliedId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"State Applied Probe",version:"1",license:"CC0",srdDerived:false},dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",originalName:"State Applied Probe",locales:{en:{name:"State Applied Probe",description:"Portable semantic-event dispatcher probe"}}},mechanics:[
      {kind:"common-play",config:{schemaVersion:"0.2-draft",id:listenerId,entryPoints:[{id:"activate-listener",invocation:"manual",operations:[{kind:"effect.apply",template:"listener",target:"actor"}]}],artifactTemplates:[{id:"listener",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:1},unit:"hours"},rules:[{id:"on-state-applied",event:"state.applied",frequency:"once-per-resolution",operations:[{kind:"damage.apply",amount:{value:2},damageType:"force",target:"event.target"}]}],lifetime:{kind:"until-duration",onEnd:"destroy"}}]}},
      {kind:"common-play",config:{schemaVersion:"0.2-draft",id:appliedId,entryPoints:[{id:"apply-marker",invocation:"manual",operations:[{kind:"effect.apply",template:"marker",target:"actor"}]}],artifactTemplates:[{id:"marker",artifactKind:"effect",duration:{kind:"elapsed",amount:{value:1},unit:"hours"},rules:[{id:"noop",event:"damage.taken",frequency:"once",operations:[{kind:"damage.apply",amount:{value:0},damageType:"force",target:"event.actor"}]}],lifetime:{kind:"until-duration",onEnd:"destroy"}}]}}
    ]}]
  })};
}

function effectiveHp(entity:{hp:number;tempHp:number}) { return entity.hp+entity.tempHp; }

async function run(suffix:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const probe=payload(suffix);
  const preview=await adapter.previewContentImport(probe.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  const catalogId=catalogQualifiedId(probe.contentId,probe.moduleId,"1");
  const listenerAction=installedCommonPlayActionId({catalogId,mechanicId:probe.listenerId,entryPointId:"activate-listener"});
  const appliedAction=installedCommonPlayActionId({catalogId,mechanicId:probe.appliedId,entryPointId:"apply-marker"});
  const actorId=(adapter as unknown as {activeCharacter:{id:string}}).activeCharacter.id;
  await adapter.startInitiative();
  await adapter.setCurrentActor(actorId);
  let snapshot=await adapter.getSnapshot();
  const before=effectiveHp(snapshot.scene.entities.find((entity)=>entity.id===actorId)!);

  await adapter.resolveAction(listenerAction,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(effectiveHp(snapshot.scene.entities.find((entity)=>entity.id===actorId)!),before);

  await adapter.resolveAction(appliedAction,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  assert.equal(effectiveHp(snapshot.scene.entities.find((entity)=>entity.id===actorId)!),before-2);
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("state.applied")),JSON.stringify(snapshot.resolution));
  assert.ok(snapshot.resolution?.detail.some((line)=>line.includes("takes 2 force damage")),JSON.stringify(snapshot.resolution));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(effectiveHp(snapshot.scene.entities.find((entity)=>entity.id===actorId)!),before);
  return 2;
}

test("unknown installed state.applied rule dispatches atomically through Common Play and remains rename invariant",async()=>{
  assert.equal(await run("first"),2);
  assert.equal(await run("renamed"),2);
});
