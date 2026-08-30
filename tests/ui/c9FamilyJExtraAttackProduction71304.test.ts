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
  const contentId=`${prefix}.fighter`;
  const mechanicId=`${prefix}.extra-attack`;
  return {
    moduleId,contentId,mechanicId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown portable Extra Attack",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Multiattack",locales:{en:{name:"Portable Multiattack"}}},
        mechanics:[{kind:"common-play",config:{
          schemaVersion:"0.2-draft",id:mechanicId,
          payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true,actionKind:"attack",attacksPerAction:2}],
          entryPoints:[{
            id:"strike",invocation:"manual",targeting:{from:"targets",min:1,max:1},
            test:{kind:"attack-roll",roller:"actor",dc:{value:1}},
            operations:[{kind:"damage.apply",amount:{value:1},damageType:"slashing",target:"target",when:{op:"eq",left:{ref:"test.outcome"},right:{value:"success"}}}],
          }],
        }}],
      }],
    }),
  };
}

function hp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  return snapshot.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")?.hp;
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
    catalogId:catalogQualifiedId(pack.contentId,pack.moduleId,"1"),mechanicId:pack.mechanicId,entryPointId:"strike",
  });
  const hpBefore=hp(snapshot);

  await adapter.setQueuedD20(15);
  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(hp(snapshot),hpBefore!-1);
  let state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.action,false);
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1,"first Attack Action must grant one portable extra attack");

  await adapter.setQueuedD20(15);
  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(hp(snapshot),hpBefore!-2,"second attack must execute without a second standard Action");
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,0);

  const revisionAfterSecond=state.revision;
  await adapter.resolveAction(actionId,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(hp(snapshot),hpBefore!-2,"third attack must be blocked once the portable attack count is exhausted");
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.revision,revisionAfterSecond);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(hp(snapshot),hpBefore!-1,"Undo must reverse the second attack damage");
  state=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)!;
  assert.equal(state.combatants[actorId].economy.extraAttacks?.length,1,"Undo must restore the consumed extra-attack grant");
}

test("unknown installed Common Play uses one Action for two structural attacks and restores the second attack on Undo",async()=>{
  await run("external-family-j-extra-attack");
});

test("renaming every external identity preserves portable Extra Attack economy",async()=>{
  await run("renamed-family-j-extra-attack");
});
