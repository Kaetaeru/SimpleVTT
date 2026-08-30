import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "../../src/app/persistenceContracts";

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

function progressionPackage(prefix:string) {
  const sourceId=`option.${prefix}.source`,baseGrantId=`option.${prefix}.base-grant`,grantId=`option.${prefix}.grant`;
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
        id:sourceId,
        category:"option",
        presentation:{defaultLocale:"ko",originalName:"Renamed progression source",locales:{ko:{name:"이름이 바뀐 진행 원천",description:"stable IDs drive progression"}}},
        progressionContributions:[{track:"dnd.srd521.class.fighter",threshold:6,grants:[baseGrantId],choices:[{
          id:`${prefix}.reward-choice`,label:"외부 진행 보상",count:1,required:true,
          options:[{id:`${prefix}.upgraded-reward`,label:"외부 보상 강화",grants:[grantId],replaces:[baseGrantId]}],
        }]}],
      },
      {
        id:baseGrantId,
        category:"option",
        presentation:{defaultLocale:"ko",originalName:"Base progression grant",locales:{ko:{name:"교체 전 외부 보상",description:"replaced in the same transaction"}}},
      },
      {
        id:grantId,
        category:"option",
        presentation:{defaultLocale:"ko",originalName:"Renamed progression grant",locales:{ko:{name:"이름이 바뀐 외부 보상",description:"projected from opaque grant identity"}}},
        mechanics:[{kind:"common-play",config:{schemaVersion:"0.2-draft",id:`${prefix}.mechanic`,entryPoints:[{id:"use",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:1},target:"self"}]}]}}],
      },
    ],
  });
}

async function executeInstalledProgression(prefix:string) {
  const sourceId=`option.${prefix}.source`,grantId=`option.${prefix}.grant`;
  const characterStore = new DurableMemoryCharacterLibraryStore();
  const installedStore = new MemoryInstalledContentStore();
  const adapter = new MockAdapter();
  setCharacterLibraryStoreForTests(adapter, characterStore);
  setInstalledContentStoreForTests(adapter, installedStore);

  let snapshot = await adapter.previewContentImport(progressionPackage(prefix));
  assert.equal(snapshot.contentImport?.validation.some((entry) => entry.severity === "blocking"), false);
  await adapter.activateContentImport();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.contentImport, null);
  assert.ok(snapshot.catalog.some((entry) => entry.contentId === sourceId && entry.progressionContributions?.[0]?.choices?.[0]?.options[0]?.grants.includes(grantId)));

  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassLevel, 6);
  const choice = snapshot.progressionPlan?.choices.find((entry) => entry.kind === "asi-or-feat");
  const installedChoice=snapshot.progressionPlan?.choices.find((entry)=>entry.id===`${prefix}.reward-choice`);
  assert.ok(choice);
  assert.ok(installedChoice,JSON.stringify({targetClassId:snapshot.progressionPlan?.targetClassId,choices:snapshot.progressionPlan?.choices.map((entry)=>entry.id),contributions:snapshot.catalog.find((entry)=>entry.contentId===sourceId)?.progressionContributions}));
  const progression = adapter as unknown as Phase07AdapterCommands;
  await progression.setProgressionChoice(choice!.id, { kind:"asi", mode:"plus-two", primary:"str" });
  await progression.setProgressionChoice(installedChoice!.id,{kind:"options",optionIds:[`${prefix}.upgraded-reward`]});
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.blocking.length, 0);

  await adapter.commitLevelUp();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.activeCharacter.level, 6);
  assert.deepEqual(snapshot.activeCharacter.installedProgressionGrantIds, [grantId]);
  assert.ok(snapshot.activeCharacter.features.includes("이름이 바뀐 외부 보상"));
  assert.ok(!snapshot.activeCharacter.features.includes("교체 전 외부 보상"));
  assert.equal(snapshot.activeCharacter.features.filter((feature) => feature === "이름이 바뀐 외부 보상").length, 1);
  assert.ok(snapshot.activity[0]?.stateChanges.includes(`installed progression grants: ${grantId}`));

  const restarted = new MockAdapter();
  setCharacterLibraryStoreForTests(restarted, characterStore);
  setInstalledContentStoreForTests(restarted,installedStore);
  let restartedSnapshot = await restarted.getSnapshot();
  assert.equal(restartedSnapshot.activeCharacter.level, 6);
  assert.deepEqual(restartedSnapshot.activeCharacter.installedProgressionGrantIds, [grantId]);
  assert.ok(restartedSnapshot.activeCharacter.features.includes("이름이 바뀐 외부 보상"));
  await restarted.startProductionLocalPlay("player");
  await restarted.startInitiative();
  await restarted.setCurrentActor(restartedSnapshot.activeCharacter.id);
  restartedSnapshot=await restarted.getSnapshot();
  const grantedAction=restartedSnapshot.scene.actionsByActor[restartedSnapshot.activeCharacter.id]?.find((action)=>action.name==="이름이 바뀐 외부 보상");
  assert.ok(grantedAction,"durable progression grant must project its installed RuleSource action");
  restartedSnapshot=await restarted.resolveAction(grantedAction!.id,[restartedSnapshot.activeCharacter.id]);
  assert.equal(restartedSnapshot.resolution?.stage,"complete",JSON.stringify(restartedSnapshot.resolution));
}

test("unknown installed RuleModule progression contribution executes through production level-up by stable IDs", async () => {
  await executeInstalledProgression("external.progression");
  await executeInstalledProgression("totally-renamed.reward-track");
});
