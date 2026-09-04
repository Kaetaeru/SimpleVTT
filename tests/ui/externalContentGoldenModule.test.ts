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
  assert.equal(snapshot.contentImport?.package?.entries.length,4);
  snapshot=await adapter.activateContentImport();
  assert.equal(snapshot.contentImport,null,"activation clears the preview");
  return {adapter,store,snapshot};
}

test("golden module: one Background, one Subclass, one executable feature, and one feat parse through the production package path",()=>{
  const parsed=parseRuleModulePackage(golden);
  assert.equal(parsed.module.moduleId,MODULE_ID);
  assert.deepEqual(parsed.entries.map((entry)=>[entry.contentId,entry.category]),[
    ["background.wayfarer","background"],["subclass.spellblade","subclass"],["feature.spellblade.arcane-strike","option"],["feat.spellblade.battle-focus","feat"],
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
  assert.equal(installed.length,4);
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
  assert.equal(restored.catalog.filter((entry)=>entry.sourceId===MODULE_ID).length,4,"activation is resolvable after restart");
  assert.ok(backgroundOptions().some((option)=>option.name===BACKGROUND_NAME));
  assert.equal((await store.readGenerations()).length,1,"one durable generation for the whole package");
});

const FEAT_ID="feat.spellblade.battle-focus";
const FEAT_NAME="전투 집중";
const SUBCLASS_ID="subclass.spellblade";
const SUBCLASS_NAME="주문검사";
const FIGHTER_ID="dnd.srd521.class.fighter";
const FIGHTER_SUBCLASS_CHOICE_ID=`progression.${FIGHTER_ID}.3.subclass`;
const FIGHTER_ASI_CHOICE_ID=`progression.${FIGHTER_ID}.4.asi`;

/** Rewrites the seeded Fighter into a fresh level-N Fighter with no subclass, the state a Character created through the Creator reaches before its first subclass level. */
async function freshFighter(adapter:MockAdapter,level:number) {
  const baseline=(await adapter.getSnapshot()).activeCharacter;
  const internal=adapter as unknown as {activeCharacter:typeof baseline};
  internal.activeCharacter={
    ...baseline,
    name:"골든 길잡이",
    level,
    subclassName:"",
    classLevels:[{classId:FIGHTER_ID,className:"전사",level}],
    subclassIds:{},
    subclassSources:{},
    subclassFeatureIds:[],
    subclassFeatureSources:{},
    installedProgressionGrantIds:[],
    proficiencyBonus:2,
    hitDiceByDie:{d10:level},
  } as typeof baseline;
  return adapter.getSnapshot();
}

async function levelUpOnce(adapter:MockAdapter,select:(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>)=>Promise<void>) {
  let snapshot=await adapter.getSnapshot();
  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot=await adapter.getSnapshot();
  await select(snapshot);
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  return adapter.commitLevelUp();
}

test("golden module: the imported Subclass joins the Fighter 3 subclass choice, is chosen, grants its feature by stable ID, survives restart, and resolves in a Session",async()=>{
  const characterStore=new DurableMemoryCharacterLibraryStore();
  const {adapter,store}=await installGolden(new MemoryInstalledContentStore(),characterStore);
  await freshFighter(adapter,2);
  const commands=adapter as unknown as Phase07AdapterCommands;

  let snapshot=await levelUpOnce(adapter,async(plan)=>{
    assert.equal(plan.progressionPlan?.targetClassId,FIGHTER_ID);
    const subclassChoice=plan.progressionPlan?.choices.find((entry)=>entry.id===FIGHTER_SUBCLASS_CHOICE_ID);
    assert.ok(subclassChoice,"Fighter 3 exposes the subclass acquisition choice");
    assert.deepEqual(subclassChoice.options.map((option)=>option.id),["subclass:챔피언",`installed-subclass:${SUBCLASS_ID}`],"the imported Subclass is a legal option next to the SRD one");
    assert.equal(subclassChoice.options[1]?.label,SUBCLASS_NAME);
    await commands.setProgressionChoice(FIGHTER_SUBCLASS_CHOICE_ID,{kind:"options",optionIds:[`installed-subclass:${SUBCLASS_ID}`]});
  });
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.subclassName,SUBCLASS_NAME);
  assert.equal(snapshot.activeCharacter.classLevels?.[0]?.subclassName,SUBCLASS_NAME);
  assert.equal(snapshot.activeCharacter.subclassIds?.[FIGHTER_ID],SUBCLASS_ID,"the stable content id is recorded, not an SRD fallback");
  assert.match(snapshot.activeCharacter.subclassSources?.[FIGHTER_ID]??"",/golden external module/);
  assert.ok(snapshot.activeCharacter.installedProgressionGrantIds?.includes("feature.spellblade.arcane-strike"),JSON.stringify(snapshot.activeCharacter.installedProgressionGrantIds));
  assert.ok(snapshot.activeCharacter.features.includes(FEATURE_NAME));
  assert.ok(snapshot.activeCharacter.features.includes(SUBCLASS_NAME));
  assert.equal(snapshot.activeCharacter.subclassFeatureIds?.some((id)=>id.includes("champion")),false,"choosing the imported Subclass grants no SRD Champion feature");

  const restarted=new MockAdapter();
  setCharacterLibraryStoreForTests(restarted,characterStore);
  setInstalledContentStoreForTests(restarted,store);
  let restored=await restarted.getSnapshot();
  assert.ok(restored.activeCharacter.features.includes(FEATURE_NAME),"the grant survives restart");
  assert.equal(restored.activeCharacter.subclassIds?.[FIGHTER_ID],SUBCLASS_ID,"the installed subclass id survives restart");
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

test("golden module: choosing the SRD Champion at Fighter 3 grants the Champion features and not the imported Subclass feature",async()=>{
  const {adapter}=await installGolden();
  await freshFighter(adapter,2);
  const commands=adapter as unknown as Phase07AdapterCommands;
  const snapshot=await levelUpOnce(adapter,async()=>{
    await commands.setProgressionChoice(FIGHTER_SUBCLASS_CHOICE_ID,{kind:"options",optionIds:["subclass:챔피언"]});
  });
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.subclassName,"챔피언");
  assert.notEqual(snapshot.activeCharacter.subclassIds?.[FIGHTER_ID],SUBCLASS_ID);
  assert.deepEqual(snapshot.activeCharacter.installedProgressionGrantIds??[],[],"a subclass-owned contribution stays inactive for another subclass");
  assert.equal(snapshot.activeCharacter.features.includes(FEATURE_NAME),false);
  assert.ok(snapshot.activeCharacter.subclassFeatureIds?.includes("dnd.srd521.feature.fighter.champion.improved-critical"));
});

test("golden module: the imported feat joins the Fighter 4 ability-score-or-feat choice and is recorded on the sheet",async()=>{
  const {adapter}=await installGolden();
  await freshFighter(adapter,3);
  const commands=adapter as unknown as Phase07AdapterCommands;
  const snapshot=await levelUpOnce(adapter,async(plan)=>{
    const asi=plan.progressionPlan?.choices.find((entry)=>entry.id===FIGHTER_ASI_CHOICE_ID);
    assert.ok(asi,"Fighter 4 exposes the ability-score-or-feat choice");
    // Installed content is addressed by its qualified catalog id (module@version#contentId), like every other catalog-backed option.
    const featOptionId=`feat:content:${MODULE_ID}@1#${FEAT_ID}`;
    const option=asi.options.find((entry)=>entry.id===featOptionId);
    assert.ok(option,`the imported feat is a legal level-up option with module provenance; got ${asi.options.map((entry)=>entry.id).join("|")}`);
    assert.equal(option.label,FEAT_NAME);
    await commands.setProgressionChoice(FIGHTER_ASI_CHOICE_ID,{kind:"asi",mode:"feat",featId:featOptionId.slice("feat:".length)});
    // Fighter 4 also asks for its Weapon Mastery increase; resolve every other required option choice with its first legal option so only the feat is under test.
    for(const choice of plan.progressionPlan?.choices??[]){
      if(choice.id===FIGHTER_ASI_CHOICE_ID||!choice.required||!choice.options.length) continue;
      const legal=choice.options.find((entry)=>!entry.disabledReason);
      if(legal) await commands.setProgressionChoice(choice.id,{kind:"options",optionIds:[legal.id]});
    }
  });
  assert.equal(snapshot.activeCharacter.level,4);
  assert.ok(snapshot.activeCharacter.features.includes(FEAT_NAME),JSON.stringify(snapshot.activeCharacter.features));
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
