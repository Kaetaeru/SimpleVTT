import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { getCharacterLibraryPersistenceStateForTests, setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { catalogQualifiedId } from "../../src/app/contentCatalogIdentity";
import { installedCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { MockAdapter } from "../../src/app/mockAdapter";

const MODULE_ID="homebrew.family-j-attack-persistence";
const CONTENT_ID="option.family-j-attack-persistence";
const MECHANIC_ID="external.unknown.family-j-attack-persistence";
const ENTRY_POINT_ID="strike";

function packagePayload() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:MODULE_ID,
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"en",
    source:{document:"Family J Attack Persistence Probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[{
      id:CONTENT_ID,
      category:"option",
      presentation:{defaultLocale:"en",originalName:"Unknown Durable Strike",locales:{en:{name:"Unknown Durable Strike"}}},
      mechanics:[{
        kind:"common-play",
        config:{
          schemaVersion:"0.2-draft",
          id:MECHANIC_ID,
          payments:[{kind:"economy",bucket:"action",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
          entryPoints:[{
            id:ENTRY_POINT_ID,
            invocation:"manual",
            targeting:{from:"targets",min:1,max:1},
            test:{kind:"attack-roll",roller:"actor",dc:{value:10}},
            operations:[{kind:"damage.apply",amount:{value:3},damageType:"force",target:"target"}],
          }],
        },
      }],
    }],
  });
}

function persistedHp(adapter:MockAdapter,characterId:string) {
  return getCharacterLibraryPersistenceStateForTests(adapter)?.document?.characters
    .find((entry)=>entry.characterId===characterId)?.runtime.hp;
}

async function restartedHp(store:MemoryCharacterLibraryStore) {
  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,store);
  return (await restarted.getSnapshot()).activeCharacter.hp;
}

test("unknown installed attack damage persists through restart and restores durably through Undo",async()=>{
  const characterStore=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());

  const preview=await adapter.previewContentImport(packagePayload());
  assert.ok(!preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  await adapter.startInitiative();
  await adapter.setCurrentActor("char.aelar");

  let snapshot=await adapter.getSnapshot();
  const characterId=snapshot.activeCharacter.id;
  const hpBefore=snapshot.activeCharacter.hp;
  const actionId=installedCommonPlayActionId({
    catalogId:catalogQualifiedId(CONTENT_ID,MODULE_ID,"1"),
    mechanicId:MECHANIC_ID,
    entryPointId:ENTRY_POINT_ID,
  });

  await adapter.setQueuedD20(15);
  await adapter.resolveAction(actionId,[characterId]);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.activeCharacter.hp,hpBefore-3,JSON.stringify(snapshot.resolution));
  assert.equal(persistedHp(adapter,characterId),hpBefore-3);
  assert.equal(await restartedHp(characterStore),hpBefore-3);

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.hp,hpBefore);
  assert.equal(persistedHp(adapter,characterId),hpBefore);
  assert.equal(await restartedHp(characterStore),hpBefore);
});
