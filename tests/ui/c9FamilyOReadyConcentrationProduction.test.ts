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

function readyConfig(prefix:string) {
  return {
    schemaVersion:"0.2-draft",
    id:`${prefix}.ready-spell`,
    entryPoints:[{
      id:"release",
      invocation:"manual",
      operations:[{kind:"healing.apply",amount:{value:1},target:"actor"}],
    }],
  };
}

async function install(adapter:MockAdapter,prefix:string,category:"spell"|"feat"="spell") {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const config=readyConfig(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId,moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Unknown Ready module",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:contentId,category,
      presentation:{defaultLocale:"en",originalName:"Unknown Ready Option",locales:{en:{name:"Unknown Ready Option"}}},
      mechanics:[{kind:"common-play",config}],
    }],
  }));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");
  return {
    actionId:installedCommonPlayActionId({
      catalogId:catalogQualifiedId(contentId,moduleId,"1"),
      mechanicId:config.id,
      entryPointId:"release",
    }),
    mechanicId:config.id,
  };
}

function heldShape(adapter:MockAdapter) {
  const scene=(adapter as unknown as {scene:Parameters<typeof snapshotAdapterTurnRuntimeState>[1]}).scene;
  const state=snapshotAdapterTurnRuntimeState(adapter,scene)!;
  const concentration=state.concentration["char.aelar"];
  const stored=state.artifacts.find((artifact)=>artifact.artifactKind==="stored-invocation")?.storedInvocation;
  return {
    active:Boolean(concentration),
    sourceMatches:Boolean(concentration&&stored&&concentration.groupId===stored.concentrationGroupId),
    triggerEndsHeld:stored?.onTriggerConcentration==="end",
    actionAvailable:state.combatants["char.aelar"].economy.action,
    artifactCount:state.artifacts.filter((artifact)=>artifact.artifactKind==="stored-invocation").length,
    sourceId:concentration?.sourceId,
  };
}

test("unknown installed spell Ready starts held concentration in the capture transaction and Undo reverses it",async()=>{
  const adapter=new MockAdapter();
  const {actionId,mechanicId}=await install(adapter,"unknown-family-o-ready");
  await adapter.configureReadyAction({actorId:"char.aelar",actionId,trigger:"when the bell rings"});
  let shape=heldShape(adapter);
  assert.deepEqual(shape,{
    active:true,sourceMatches:true,triggerEndsHeld:true,actionAvailable:false,artifactCount:1,sourceId:mechanicId,
  });

  await adapter.undoLastResolution();
  shape=heldShape(adapter);
  assert.deepEqual(shape,{
    active:false,sourceMatches:false,triggerEndsHeld:false,actionAvailable:true,artifactCount:0,sourceId:undefined,
  });
});

test("Ready concentration selection is structural and rename invariant",async()=>{
  const run=async(prefix:string,category:"spell"|"feat")=>{
    const adapter=new MockAdapter();
    const {actionId}=await install(adapter,prefix,category);
    await adapter.configureReadyAction({actorId:"char.aelar",actionId,trigger:"declared trigger"});
    const {sourceId:_,...shape}=heldShape(adapter);
    return shape;
  };
  assert.deepEqual(await run("external-ready-alpha","spell"),await run("renamed-ready-omega","spell"));
  assert.deepEqual(await run("external-ready-feature","feat"),{
    active:false,sourceMatches:false,triggerEndsHeld:false,actionAvailable:false,artifactCount:1,
  });
});
