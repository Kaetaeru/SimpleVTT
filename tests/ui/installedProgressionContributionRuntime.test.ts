import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/characterLibraryRuntimeAdapter";
import "../../src/app/installedContentRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "../../src/app/persistenceContracts";

const SOURCE_ID = "option.external.progression-source";
const GRANT_ID = "option.external.progression-grant";

class DurableMemoryCharacterLibraryStore implements CharacterLibraryStore {
  readonly durability = "durable" as const;
  private generations = new Map<number,string>();

  async readGenerations():Promise<CharacterLibraryStoredGeneration[]> {
    return [...this.generations.entries()]
      .map(([generation,payload]) => ({ generation,payload }))
      .sort((a,b) => b.generation-a.generation);
  }

  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    const current = Math.max(0,...this.generations.keys());
    assert.equal(current,expectedGeneration);
    assert.equal(nextGeneration,expectedGeneration+1);
    this.generations.set(nextGeneration,payload);
  }
}

function progressionPackage() {
  return JSON.stringify({
    schemaVersion:"0.1-draft",
    moduleId:"homebrew.family-aa-progression",
    moduleVersion:"1",
    rulesProfile:{id:"dnd.srd-5.2.1",version:"0.1-draft"},
    defaultLocale:"ko",
    source:{document:"Family AA progression probe",version:"1",license:"CC0",srdDerived:false},
    dependencies:[],conflicts:[],capabilities:[],
    content:[
      {
        id:SOURCE_ID,
        category:"option",
        presentation:{defaultLocale:"ko",originalName:"Renamed progression source",locales:{ko:{name:"이름이 바뀐 진행 원천",description:"stable IDs drive progression"}}},
        progressionContributions:[{track:"dnd.srd521.class.fighter",threshold:6,grants:[GRANT_ID]}],
      },
      {
        id:GRANT_ID,
        category:"option",
        presentation:{defaultLocale:"ko",originalName:"Renamed progression grant",locales:{ko:{name:"이름이 바뀐 외부 보상",description:"projected from opaque grant identity"}}},
      },
    ],
  });
}

test("unknown installed RuleModule progression contribution executes through production level-up by stable IDs", async () => {
  const characterStore = new DurableMemoryCharacterLibraryStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter, characterStore);
  setInstalledContentStoreForTests(adapter, new MemoryInstalledContentStore());

  let snapshot = await adapter.previewContentImport(progressionPackage());
  assert.equal(snapshot.contentImport?.validation.some((entry) => entry.severity === "blocking"), false);
  await adapter.activateContentImport();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.contentImport, null);
  assert.ok(snapshot.catalog.some((entry) => entry.contentId === SOURCE_ID && entry.progressionContributions?.[0]?.grants.includes(GRANT_ID)));

  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassLevel, 6);
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "asi-or-feat");
  assert.ok(choice);
  const progression = adapter as unknown as Phase07AdapterCommands;
  await progression.setProgressionChoice(choice!.id, { kind:"asi", mode:"plus-two", primary:"str" });
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 6);
  assert.deepEqual(snapshot.activeCharacter.installedProgressionGrantIds, [GRANT_ID]);
  assert.ok(snapshot.activeCharacter.features.includes("이름이 바뀐 외부 보상"));
  assert.equal(snapshot.activeCharacter.features.filter((feature) => feature === "이름이 바뀐 외부 보상").length, 1);
  assert.ok(snapshot.activity[0]?.stateChanges.includes(`installed progression grants: ${GRANT_ID}`));

  const restarted = new MockAdapter();
  setCharacterLibraryStoreForTests(restarted, characterStore);
  const restartedSnapshot = await restarted.getSnapshot();
  assert.equal(restartedSnapshot.activeCharacter.level, 6);
  assert.deepEqual(restartedSnapshot.activeCharacter.installedProgressionGrantIds, [GRANT_ID]);
  assert.ok(restartedSnapshot.activeCharacter.features.includes("이름이 바뀐 외부 보상"));
});
