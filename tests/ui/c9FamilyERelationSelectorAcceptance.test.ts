import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

interface Identity {
  moduleId:string;
  contentId:string;
  mechanicId:string;
  entryPointId:string;
  displayName:string;
}

const ORIGINAL:Identity={
  moduleId:"homebrew.family-e-relation-probe",
  contentId:"option.family-e-relation-probe",
  mechanicId:"external.unknown.family-e-relation-probe",
  entryPointId:"mend-enemy",
  displayName:"Portable Relation Probe",
};

function packagePayload(identity:Identity) {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:identity.moduleId,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family E Relation Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:identity.contentId,
      category:"option",
      presentation:{
        defaultLocale:"en",
        originalName:identity.displayName,
        locales:{en:{name:identity.displayName,description:"Portable relation-selector persistence probe"}},
      },
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:identity.mechanicId,
          entryPoints:[{
            id:identity.entryPointId,
            invocation:"manual",
            targeting:{
              from:"targets",
              where:{op:"relation-matches",ref:"relation",value:"enemy"},
              min:1,
              max:1,
            },
            operations:[{kind:"healing.apply",amount:{value:5},target:"target"}],
          }],
        },
      }],
    }],
  });
}

function actionId(identity:Identity) {
  return installedCommonPlayActionId({
    catalogId:catalogQualifiedId(identity.contentId,identity.moduleId,"1"),
    mechanicId:identity.mechanicId,
    entryPointId:identity.entryPointId,
  });
}

function injureActiveCharacter(adapter:MockAdapter,amount:number) {
  const internal=adapter as unknown as {
    activeCharacter:{id:string;hp:number;maxHp:number};
    scene:{entities:Array<{id:string;hp:number}>};
  };
  const hp=Math.max(0,internal.activeCharacter.maxHp-amount);
  internal.activeCharacter.hp=hp;
  internal.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp=hp;
}

function injureSceneEntity(adapter:MockAdapter,id:string,amount:number) {
  const internal=adapter as unknown as {scene:{entities:Array<{id:string;hp:number;maxHp:number}>}};
  const entity=internal.scene.entities.find((candidate)=>candidate.id===id)!;
  entity.hp=Math.max(0,entity.maxHp-amount);
}

async function executeAfterRestart(identity:Identity) {
  const store=new MemoryInstalledContentStore();
  const installer=new MockAdapter();
  setInstalledContentStoreForTests(installer,store);
  const preview=await installer.previewContentImport(packagePayload(identity));
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await installer.activateContentImport();

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,store);
  injureActiveCharacter(restarted,10);
  injureSceneEntity(restarted,"combatant.goblin-a",10);
  await restarted.startInitiative();
  await restarted.setCurrentActor("char.aelar");

  const id=actionId(identity);
  const before=await restarted.getSnapshot();
  assert.ok(before.catalog.some((entry)=>entry.contentId===identity.contentId),"fresh adapter must rehydrate installed content");

  const selfBefore=before.activeCharacter.hp;
  await restarted.resolveAction(id,["char.aelar"]);
  assert.equal((await restarted.getSnapshot()).activeCharacter.hp,selfBefore,"enemy relation must reject self after restart");

  const enemyBefore=(await restarted.getSnapshot()).scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp;
  await restarted.resolveAction(id,["combatant.goblin-a"]);
  const snapshot=await restarted.getSnapshot();
  return {
    actionId:id,
    healed:snapshot.scene.entities.find((entity)=>entity.id==="combatant.goblin-a")!.hp-enemyBefore,
    stage:snapshot.resolution?.stage,
    targetIds:snapshot.resolution?.targetIds,
  };
}

test("portable relation selector survives installed-content restart and external identity rename",async()=>{
  const original=await executeAfterRestart(ORIGINAL);
  const renamed=await executeAfterRestart({
    moduleId:"homebrew.previously-unseen.relation-module",
    contentId:"option.previously-unseen.relation-content",
    mechanicId:"external.previously-unseen.relation-definition",
    entryPointId:"renamed-enemy-action",
    displayName:"Completely Renamed Relation Action",
  });

  assert.notEqual(original.actionId,renamed.actionId);
  assert.deepEqual(
    {healed:renamed.healed,stage:renamed.stage,targetIds:renamed.targetIds},
    {healed:original.healed,stage:original.stage,targetIds:original.targetIds},
  );
  assert.equal(original.healed,5);
  assert.equal(original.stage,"complete");
  assert.deepEqual(original.targetIds,["combatant.goblin-a"]);
});
