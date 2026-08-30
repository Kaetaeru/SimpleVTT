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
  const contentId=`${prefix}.weapon`;
  const poolMechanicId=`${prefix}.ammunition-pool`;
  const attackMechanicId=`${prefix}.ranged-attack`;
  const resourceId=`resource.${prefix}.ammunition`;
  return {
    moduleId,contentId,poolMechanicId,attackMechanicId,resourceId,
    json:JSON.stringify({
      schemaVersion:"0.1-draft",moduleId,moduleVersion:"1",
      rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},defaultLocale:"en",
      source:{document:"Unknown portable ammunition weapon",version:"1",license:"CC0",srdDerived:false},
      dependencies:[],conflicts:[],capabilities:[],content:[{
        id:contentId,category:"option",
        presentation:{defaultLocale:"en",originalName:"Portable Ammunition Weapon",locales:{en:{name:"Portable Ammunition Weapon"}}},
        mechanics:[
          {kind:"common-play",config:{schemaVersion:"0.2-draft",id:poolMechanicId,entryPoints:[{
            id:"materialize-ammunition",invocation:"manual",operations:[{
              kind:"resource.change",resource:resourceId,amount:{value:1},target:"actor",
              createIfMissing:{label:"Portable Ammunition",maximum:{value:1}},
            }],
          }]}},
          {kind:"common-play",config:{
            schemaVersion:"0.2-draft",id:attackMechanicId,
            payments:[{kind:"resource",resource:resourceId,amount:{value:1},consumeAt:"commit"}],
            entryPoints:[{
              id:"fire",invocation:"manual",targeting:{from:"targets",min:1,max:1},
              test:{kind:"attack-roll",roller:"actor",dc:{value:1}},
              operations:[{kind:"damage.apply",amount:{value:1},damageType:"piercing",target:"target"}],
            }],
          }},
        ],
      }],
    }),
  };
}

function resourceCurrent(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,resourceId:string) {
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===resourceId)?.current;
}

function targetHp(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
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
  assert.equal(resourceCurrent(snapshot,pack.resourceId),undefined);
  const catalogId=catalogQualifiedId(pack.contentId,pack.moduleId,"1");
  const materialize=installedCommonPlayActionId({catalogId,mechanicId:pack.poolMechanicId,entryPointId:"materialize-ammunition"});
  const fire=installedCommonPlayActionId({catalogId,mechanicId:pack.attackMechanicId,entryPointId:"fire"});

  await adapter.resolveAction(materialize,[actorId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(resourceCurrent(snapshot,pack.resourceId),1);

  const hpBefore=targetHp(snapshot);
  await adapter.resolveAction(fire,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(resourceCurrent(snapshot,pack.resourceId),0,"committed attack must consume exactly one ammunition unit");

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(resourceCurrent(snapshot,pack.resourceId),1,"event-native Undo must restore ammunition");
  assert.equal(targetHp(snapshot),hpBefore,"event-native Undo must restore the downstream attack result atomically");

  await adapter.resolveAction(fire,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(resourceCurrent(snapshot,pack.resourceId),0);
  const hpAtEmpty=targetHp(snapshot);
  const revisionAtEmpty=snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.revision;
  await adapter.resolveAction(fire,["combatant.goblin-a"]);
  snapshot=await adapter.getSnapshot();
  assert.equal(resourceCurrent(snapshot,pack.resourceId),0,"empty ammunition must not underflow");
  assert.equal(targetHp(snapshot),hpAtEmpty,"failed ammunition payment must block downstream attack effects");
  assert.equal(snapshotAdapterTurnRuntimeState(adapter,snapshot.scene)?.revision,revisionAtEmpty,"failed ammunition payment must not commit runtime state");
}

test("unknown installed ranged attack consumes source-owned ammunition atomically and restores it on Undo",async()=>{
  await run("external-family-j-ammunition");
});

test("renaming every external ammunition identity preserves attack payment semantics",async()=>{
  await run("renamed-family-j-ammunition");
});
