import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import {catalogQualifiedId} from "../../src/app/contentCatalogIdentity";
import {installedCommonPlayActionId} from "../../src/app/installedCommonPlayActionReference";
import {setInstalledContentStoreForTests} from "../../src/app/installedContentRuntimeAdapter";
import {MemoryInstalledContentStore} from "../../src/app/memoryInstalledContentStore";
import {MockAdapter} from "../../src/app/mockAdapter";
import {snapshotAdapterTurnRuntimeState} from "../../src/app/turnRuntimeSessionRegistry";

function pack(prefix:string){
  const moduleId=`${prefix}.module`,contentId=`${prefix}.content`,mechanicId=`${prefix}.mechanic`,catalogId=catalogQualifiedId(contentId,moduleId,"1");
  const action=(entryPointId:string)=>installedCommonPlayActionId({catalogId,mechanicId,entryPointId});
  return {create:action("create"),advance:action("advance"),recover:action("recover"),json:JSON.stringify({schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",source:{document:"Family AE",version:"1",license:"CC0",srdDerived:false},capabilities:[],content:[{id:contentId,category:"option",presentation:{defaultLocale:"en",locales:{en:{name:"Unknown exposure"}}},mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:mechanicId,entryPoints:[
    {id:"create",invocation:"manual",operations:[{kind:"artifact.spawn",template:"exposure"}]},
    {id:"advance",invocation:"manual",operations:[{kind:"artifact.exposure.advance",artifact:"exposure",seconds:{value:200}}]},
    {id:"recover",invocation:"manual",operations:[{kind:"artifact.exposure.recover",artifact:"exposure"}]},
  ],artifactTemplates:[{id:"exposure",artifactKind:"exposure",duration:{kind:"durable"},lifetime:{kind:"durable"},initialState:{subjectId:"actor",revision:0,elapsedSeconds:0,thresholdSeconds:100,intervalSeconds:50,appliedIntervals:0,status:"active"}}]}}]}]})};
}

async function run(prefix:string){
  const adapter=new MockAdapter(),definition=pack(prefix);setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(definition.json);assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();await adapter.startInitiative();await adapter.setCurrentActor("char.aelar");
  await adapter.resolveAction(definition.create,["char.aelar"]);await adapter.resolveAction(definition.advance,["char.aelar"]);
  let exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,revision:exposure?.revision},{elapsed:200,intervals:3,revision:1});
  await adapter.undoLastResolution();exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,revision:exposure?.revision},{elapsed:0,intervals:0,revision:0});
  await adapter.resolveAction(definition.advance,["char.aelar"]);await adapter.resolveAction(definition.recover,["char.aelar"]);
  exposure=snapshotAdapterTurnRuntimeState(adapter,(await adapter.getSnapshot()).scene)?.artifacts?.find((artifact)=>artifact.artifactKind==="exposure")?.exposure;
  assert.deepEqual({elapsed:exposure?.elapsedSeconds,intervals:exposure?.appliedIntervals,status:exposure?.status},{elapsed:0,intervals:0,status:"recovered"});
}

test("portable exposure state advances, recovers, and undoes independent of external identity",async()=>{await run("external.exposure");await run("renamed.hazard");});
