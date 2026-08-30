import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

const FIXTURE=JSON.parse(readFileSync(new URL("../fixtures/play-contract/multi-target-save-damage.json",import.meta.url),"utf8"));

function payload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.spell`;
  const mechanicId=`${prefix}.mechanic`;
  const config=structuredClone(FIXTURE);
  config.id=mechanicId;
  config.entryPoints[0].test.dc={value:10};
  return {moduleId,contentId,mechanicId,json:JSON.stringify({
    schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
    source:{document:"Save Damage Semantic Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{id:contentId,category:"spell",presentation:{defaultLocale:"en",originalName:"Save Damage Probe",locales:{en:{name:"Save Damage Probe"}}},mechanics:[{kind:"common-play",config}]}],
  })};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const pack=payload(prefix);
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  const actionId=installedCommonPlayActionId({catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"release"});
  await adapter.setQueuedD20(4);
  const snapshot=await adapter.resolveAction(actionId,["combatant.goblin-a","combatant.goblin-b"]);
  assert.equal(snapshot.resolution?.stage,"complete",JSON.stringify(snapshot.resolution));
  const history=runtimeResolutionEventHistory(adapter);
  const outcomes=(history?.events??[]).filter((event)=>event.kind==="save.success"||event.kind==="save.failure").map((event)=>({actorId:event.actorId,kind:event.kind}));
  assert.deepEqual(outcomes,[{actorId:"combatant.goblin-a",kind:"save.failure"},{actorId:"combatant.goblin-b",kind:"save.success"}],JSON.stringify(history));
  return outcomes;
}

test("unknown multi-target save-damage emits authoritative semantic outcomes for every target",async()=>{await run("unknown-save-damage-semantic");});
test("multi-target save-damage semantic outcomes are invariant to external identities",async()=>{
  assert.deepEqual(await run("renamed-save-damage-semantic"),await run("unknown-save-damage-semantic"));
});
