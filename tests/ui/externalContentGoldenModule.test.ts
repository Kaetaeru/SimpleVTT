import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { backgroundDefinition, backgroundIdFromName, backgroundOptions } from "../../src/app/characterCreationV10Data";
import { parseRuleModulePackage } from "../../src/app/ruleModulePackageImport";
import { parseInstalledBackgroundDefinition } from "../../src/app/installedBackgroundDefinition";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import type { CharacterLibraryStore, CharacterLibraryStoredGeneration } from "../../src/app/persistenceContracts";

// The same file the Contents screen offers as "예제 애드온 불러오기"; it is the V1 golden external module.
const GOLDEN_PATH=new URL("../../content/examples/homebrew-golden-v1.module.json",import.meta.url);
const golden=readFileSync(GOLDEN_PATH,"utf8");
const MODULE_ID="homebrew.golden-v1";
const BACKGROUND_NAME="떠돌이 길잡이";
const FEATURE_NAME="비전 일격";

class DurableMemoryCharacterLibraryStore implements CharacterLibraryStore {
  readonly durability="durable" as const;
  private generations=new Map<number,string>();
  async readGenerations():Promise<CharacterLibraryStoredGeneration[]> {
    return [...this.generations.entries()].map(([generation,payload])=>({generation,payload})).sort((a,b)=>b.generation-a.generation);
  }
  async writeGeneration(expectedGeneration:number,nextGeneration:number,payload:string):Promise<void> {
    assert.equal(Math.max(0,...this.generations.keys()),expectedGeneration);
    this.generations.set(nextGeneration,payload);
  }
}

function withGolden(mutate:(module:Record<string,unknown>)=>void) {
  const module=JSON.parse(golden) as Record<string,unknown>;
  mutate(module);
  return JSON.stringify(module);
}

async function installGolden(store=new MemoryInstalledContentStore(),characterStore?:CharacterLibraryStore) {
  const adapter=new MockAdapter();
  if (characterStore) setCharacterLibraryStoreForTests(adapter,characterStore);
  setInstalledContentStoreForTests(adapter,store);
  let snapshot=await adapter.previewContentImport(golden);
  assert.deepEqual(snapshot.contentImport?.validation.filter((entry)=>entry.severity==="blocking"),[]);
  assert.equal(snapshot.contentImport?.package?.moduleId,MODULE_ID);
  assert.equal(snapshot.contentImport?.package?.entries.length,3);
  snapshot=await adapter.activateContentImport();
  assert.equal(snapshot.contentImport,null,"activation clears the preview");
  return {adapter,store,snapshot};
}

test("golden module: one Background, one Subclass, and one executable feature parse through the production package path",()=>{
  const parsed=parseRuleModulePackage(golden);
  assert.equal(parsed.module.moduleId,MODULE_ID);
  assert.deepEqual(parsed.entries.map((entry)=>[entry.contentId,entry.category]),[
    ["background.wayfarer","background"],["subclass.spellblade","subclass"],["feature.spellblade.arcane-strike","option"],
  ]);
  const background=parsed.entries[0];
  assert.equal(background.nameKo,BACKGROUND_NAME);
  assert.equal(background.mechanics?.[0]?.kind,"background-definition");
  const subclass=parsed.entries[1];
  assert.deepEqual(subclass.progressionContributions,[{track:"dnd.srd521.class.fighter",threshold:3,grants:["feature.spellblade.arcane-strike"]}]);
  assert.equal(subclass.semanticRelationships?.[0]?.target,"dnd.srd521.class.fighter");
  const feature=parsed.entries[2];
  assert.equal(feature.mechanics?.[0]?.kind,"common-play");
  assert.equal(parsed.entries.every((entry)=>entry.sourceId===MODULE_ID),true,"provenance stays on the module, never the SRD builtin source");
});

test("golden module: installs through the real activation path, survives restart, and offers the Background in Character creation",async()=>{
  const {adapter,store}=await installGolden();
  const installed=(await adapter.getSnapshot()).catalog.filter((entry)=>entry.sourceId===MODULE_ID);
  assert.equal(installed.length,3);
  assert.equal(installed.every((entry)=>entry.scope==="local"),true);

  assert.ok(backgroundOptions().some((option)=>option.name===BACKGROUND_NAME),"imported Background joins the creation option list");
  assert.equal(backgroundIdFromName(BACKGROUND_NAME),"background.wayfarer");
  const definition=backgroundDefinition(BACKGROUND_NAME);
  assert.deepEqual(definition.skills,["survival","stealth"]);
  assert.equal(definition.originFeat,"dnd.srd521.feat.alert");

  let draft=await adapter.createCharacterDraft();
  draft=await adapter.updateCharacterDraft({type:"set-name",value:"골든 길잡이"});
  draft=await adapter.updateCharacterDraft({type:"set-background",value:BACKGROUND_NAME});
  assert.equal(draft.createDraft?.background,BACKGROUND_NAME);
  const section=draft.creationPlan?.sections.find((entry)=>entry.id==="background");
  assert.ok(section,"creation plan exposes the background section");
  assert.ok(section.options.some((option)=>option.name===BACKGROUND_NAME),"the plan lists the imported Background as a legal choice");
  assert.ok(section.automaticGrants.some((grant)=>/survival|생존/i.test(grant)),JSON.stringify(section.automaticGrants));

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,store);
  const restored=await restarted.getSnapshot();
  assert.equal(restored.catalog.filter((entry)=>entry.sourceId===MODULE_ID).length,3,"activation is resolvable after restart");
  assert.ok(backgroundOptions().some((option)=>option.name===BACKGROUND_NAME));
  assert.equal((await store.readGenerations()).length,1,"one durable generation for the whole package");
});

test("golden module: the imported Subclass feature is granted by stable ID and resolves in a Session",async()=>{
  const characterStore=new DurableMemoryCharacterLibraryStore();
  const {adapter,store}=await installGolden(new MemoryInstalledContentStore(),characterStore);
  let snapshot=await adapter.getSnapshot();
  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.progressionPlan?.targetClassId,"dnd.srd521.class.fighter");
  const asi=snapshot.progressionPlan?.choices.find((entry)=>entry.kind==="asi-or-feat");
  if (asi) await (adapter as unknown as Phase07AdapterCommands).setProgressionChoice(asi.id,{kind:"asi",mode:"plus-two",primary:"str"});
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  snapshot=await adapter.commitLevelUp();
  assert.ok(snapshot.activeCharacter.installedProgressionGrantIds?.includes("feature.spellblade.arcane-strike"),JSON.stringify(snapshot.activeCharacter.installedProgressionGrantIds));
  assert.ok(snapshot.activeCharacter.features.includes(FEATURE_NAME));

  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,characterStore);
  setInstalledContentStoreForTests(restarted,store);
  let restored=await restarted.getSnapshot();
  assert.ok(restored.activeCharacter.features.includes(FEATURE_NAME),"the grant survives restart");
  await restarted.startProductionLocalPlay("player");
  await restarted.startInitiative();
  await restarted.setCurrentActor(restored.activeCharacter.id);
  restored=await restarted.getSnapshot();
  const action=restored.scene.actionsByActor[restored.activeCharacter.id]?.find((entry)=>entry.name===FEATURE_NAME);
  assert.ok(action,"the imported executable feature projects a real action");
  restored=await restarted.resolveAction(action!.id,[restored.activeCharacter.id]);
  assert.equal(restored.resolution?.stage,"complete",JSON.stringify(restored.resolution));
  assert.equal(restored.activity[0]?.title.includes(FEATURE_NAME),true,"Activity uses the same path as builtin content");
});

test("golden module: uninstall removes the whole source in one generation and Character creation forgets the Background",async()=>{
  const {adapter,store}=await installGolden();
  let snapshot=await adapter.uninstallContentSource(MODULE_ID);
  assert.equal(snapshot.catalog.filter((entry)=>entry.sourceId===MODULE_ID).length,0);
  assert.equal(snapshot.contentCatalogPersistence?.status,"ready");
  assert.equal(backgroundOptions().some((option)=>option.name===BACKGROUND_NAME),false);
  assert.equal(backgroundIdFromName(BACKGROUND_NAME),"");
  assert.equal((await store.readGenerations()).length,2,"removal writes exactly one new generation");

  snapshot=await adapter.uninstallContentSource("homebrew.unknown");
  assert.equal((await store.readGenerations()).length,2,"unknown sources are a no-op");

  const restarted=new MockAdapter();
  setInstalledContentStoreForTests(restarted,store);
  const restored=await restarted.getSnapshot();
  assert.equal(restored.catalog.some((entry)=>entry.sourceId===MODULE_ID),false,"removal is durable");
  assert.equal(restored.catalog.some((entry)=>entry.scope==="builtin"),true,"builtin content is untouched");
});

test("background-definition is validated: wrong category, unknown ability, and unsupported fields are blocked before activation",async()=>{
  assert.throws(()=>parseInstalledBackgroundDefinition({abilityChoices:["luck"],abilityIncreaseModes:["2+1"],skills:["stealth"],originFeat:"x",equipmentChoice:false},"config"),/str\/dex\/con\/int\/wis\/cha/);
  assert.throws(()=>parseInstalledBackgroundDefinition({abilityChoices:["dex"],abilityIncreaseModes:["3"],skills:["stealth"],originFeat:"x",equipmentChoice:false},"config"),/2\+1 or 1\+1\+1/);
  assert.throws(()=>parseInstalledBackgroundDefinition({abilityChoices:["dex"],abilityIncreaseModes:["2+1"],skills:["stealth"],originFeat:"x",equipmentChoice:false,script:"alert(1)"},"config"),/unsupported fields/);

  const wrongCategory=withGolden((module)=>{ (module.content as Array<Record<string,unknown>>)[0].category="option"; });
  assert.throws(()=>parseRuleModulePackage(wrongCategory),/only valid on background content/);

  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  const preview=await adapter.previewContentImport(wrongCategory);
  assert.ok(preview.contentImport?.validation.some((entry)=>entry.severity==="blocking"),"the Contents screen blocks activation");
  const after=await adapter.activateContentImport();
  assert.equal(after.catalog.some((entry)=>entry.sourceId===MODULE_ID),false,"nothing half-installs");
});
