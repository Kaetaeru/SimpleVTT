import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";
import { snapshotAdapterTurnRuntimeState } from "../../src/app/turnRuntimeSessionRegistry";

function packagePayload(prefix:string) {
  const moduleId=`${prefix}.module`;
  const contentId=`${prefix}.content`;
  const mechanicId=`${prefix}.extra-attack`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown portable Extra Attack probe",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Extra Attack",locales:{en:{name:"Portable Extra Attack"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          payments:[{
            kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,
            actionKind:"attack",attacksPerAction:2,
          }],
          entryPoints:[{id:"attack",invocation:"manual",operations:[]}],
        }}],
      }],
    }),
  };
}

function actorEconomy(adapter:MockAdapter,snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,actorId:string) {
  const state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene);
  const actor=state?.combatants[actorId];
  assert.ok(actor,`missing runtime combatant ${actorId}`);
  return {state,actor,economy:actor.economy};
}

async function run(prefix:string) {
  const adapter=new MockAdapter();
  const pack=packagePayload(prefix);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(pack.json);
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),
    mechanicId:pack.mechanicId,
    entryPointId:"attack",
  });

  let runtime=actorEconomy(adapter,snapshot,actorId);
  assert.equal(runtime.economy.action,true);
  assert.equal(runtime.economy.extraAttacks?.length,0);

  await adapter.resolveAction(actionId,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  runtime=actorEconomy(adapter,snapshot,actorId);
  assert.equal(runtime.economy.action,false,"first attack must spend the standard Action");
  assert.equal(runtime.economy.extraAttacks?.length,1,"Attack Action must grant one remaining attack");

  await adapter.resolveAction(actionId,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  runtime=actorEconomy(adapter,snapshot,actorId);
  assert.equal(runtime.economy.action,false);
  assert.equal(runtime.economy.extraAttacks?.length,0,"second attack must spend the Extra Attack grant");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  runtime=actorEconomy(adapter,snapshot,actorId);
  assert.equal(runtime.economy.action,false,"Undo of the second attack must not refund the already-spent Action");
  assert.equal(runtime.economy.extraAttacks?.length,1,"event-native Undo must restore the consumed Extra Attack grant");

  await adapter.resolveAction(actionId,[actorId]);
  snapshot=await adapter.getSnapshot();
  runtime=actorEconomy(adapter,snapshot,actorId);
  const revisionAfterSecond=runtime.state?.revision;
  assert.equal(runtime.economy.extraAttacks?.length,0);

  await adapter.resolveAction(actionId,[actorId]);
  snapshot=await adapter.getSnapshot();
  runtime=actorEconomy(adapter,snapshot,actorId);
  assert.equal(runtime.state?.revision,revisionAfterSecond,"third attack must reject without committing runtime state");
  assert.equal(runtime.economy.extraAttacks?.length,0);
}

test("unknown installed Common Play Attack Action spends one Action then one Extra Attack grant",async()=>{
  await run("external-family-j-extra-attack");
});

test("renaming every external Extra Attack identity preserves production economy semantics",async()=>{
  await run("renamed-family-j-extra-attack");
});
