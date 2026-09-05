import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/characterCreationV10Adapter";
import "../../src/app/progressionContracts";
import { compileSupplement } from "../../tools/supplement/compileSupplement";
import { parseRuleModulePackage } from "../../src/app/ruleModulePackageImport";
import { MockAdapter } from "../../src/app/mockAdapter";
import { setInstalledContentStoreForTests } from "../../src/app/installedContentRuntimeAdapter";
import { MemoryInstalledContentStore } from "../../src/app/memoryInstalledContentStore";
import { allOriginFeatOptions, backgroundOptions, classIdFromName, classMeta, speciesOptions, spellOptions } from "../../src/app/characterCreationV10Data";
import { spellPresentationById } from "../../src/app/spellPresentation";
import { clearInstalledSpellEntriesForTests } from "../../src/app/installedSpellRuntime";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";
import type { CharacterSheet } from "../../src/app/contracts";

// X1-07/X1-08: the supplement compiler turns a translation checkout into an add-on that creation, level-up, and casting consume.
const FIXTURE=join(dirname(fileURLToPath(import.meta.url)),"..","fixtures","supplement");
const PREFIX="synth";
const SPECIES_ID=`${PREFIX}.species.mothfolk`;
const BACKGROUND_ID=`${PREFIX}.background.lighthouse-keeper`;
const ORIGIN_FEAT_ID=`${PREFIX}.feat.lantern-bearer`;
const GENERAL_FEAT_ID=`${PREFIX}.feat.steady-hands`;
const SUBCLASS_ID=`${PREFIX}.subclass.storm-knight`;
const SPELL_ID=`${PREFIX}.spell.tide-bolt`;
const FIGHTER_ID="dnd.srd521.class.fighter";

function compileFixture() {
  return compileSupplement({
    sourceRoot:join(FIXTURE,"translation"),semanticsRoot:join(FIXTURE,"semantics"),
    moduleId:"synthetic-supplement",idPrefix:PREFIX,document:"Synthetic supplement fixture",license:"CC0-1.0",
  });
}

test("the compiler derives ids, presentation, declarative definitions, and progression structure from the checkout and semantic maps",()=>{
  const result=compileFixture();
  assert.deepEqual(result.warnings,[]);
  assert.deepEqual(result.counts,{subclass:1,subclassFeature:3,background:1,species:1,feat:2,spell:1});
  const parsed=parseRuleModulePackage(JSON.stringify(result.module));
  const byId=new Map(parsed.entries.map((entry)=>[entry.contentId,entry]));
  assert.equal(parsed.entries.length,9);

  const origin=byId.get(ORIGIN_FEAT_ID)!;
  const originDefinition=origin.mechanics?.find((mechanic)=>mechanic.kind==="feat-definition");
  assert.equal(originDefinition?.kind,"feat-definition");
  assert.equal((originDefinition as {config:{tier?:string}}).config.tier,"origin");
  const general=byId.get(GENERAL_FEAT_ID)!.mechanics?.find((mechanic)=>mechanic.kind==="feat-definition") as {config:Record<string,unknown>};
  assert.deepEqual(general.config.abilityPrerequisite,{any:["dex"],minimum:13});
  assert.equal(general.config.minimumLevel,4);
  assert.deepEqual(general.config.abilityIncrease,{any:["dex","wis"],amount:1,maximum:20});
  assert.equal(general.config.repeatable,false,"the feats.json map merged into the definition");

  const background=byId.get(BACKGROUND_ID)!.mechanics?.find((mechanic)=>mechanic.kind==="background-definition") as {config:Record<string,unknown>};
  assert.deepEqual(background.config.abilityChoices,["con","wis","cha"]);
  assert.deepEqual(background.config.skills,["perception","survival"]);
  assert.equal(background.config.tool,"navigators-tools");
  assert.equal(background.config.originFeat,ORIGIN_FEAT_ID,"the origin feat link resolves to the compiled feat id");
  assert.equal(background.config.equipmentChoice,true);

  const species=byId.get(SPECIES_ID)!.mechanics?.find((mechanic)=>mechanic.kind==="species-definition") as {config:Record<string,unknown>};
  assert.deepEqual(species.config.size,["small","medium"]);
  assert.equal(species.config.speed,30);
  assert.equal(species.config.darkvision,60);
  assert.deepEqual((species.config.semantics as {baseFeatures:string[]}).baseFeatures.length,3);

  const subclass=byId.get(SUBCLASS_ID)!;
  assert.deepEqual(subclass.semanticRelationships?.map((relationship)=>relationship.target),[FIGHTER_ID]);
  assert.deepEqual(subclass.progressionContributions?.map((contribution)=>[contribution.threshold,contribution.grants.length]),[[3,2],[7,1]]);
  const feature=byId.get(`${SUBCLASS_ID}.feature.3-1`)!;
  assert.equal(feature.category,"option");
  assert.equal(feature.nameKo,"번개 재정비");
  assert.ok(feature.mechanics?.some((mechanic)=>mechanic.kind==="common-play"),"subclasses.json attached the executable feature");

  const spell=byId.get(SPELL_ID)!;
  const spellDefinition=spell.mechanics?.find((mechanic)=>mechanic.kind==="spell-definition") as {config:Record<string,unknown>};
  assert.equal(spellDefinition.config.level,0);
  assert.equal(spellDefinition.config.school,"evocation");
  assert.equal(spellDefinition.config.rangeText,"60피트");
  assert.deepEqual(spellDefinition.config.classes,["wizard","sorcerer"]);
  assert.ok(spell.mechanics?.some((mechanic)=>mechanic.kind==="spell-mechanic"));
  assert.ok(!JSON.stringify(result.module).includes("검수 기록"),"review logs are not shipped");
});

async function fillCurrentDraft(adapter:MockAdapter) {
  for (let pass=0;pass<40;pass+=1) {
    const snapshot=await adapter.getSnapshot();
    const draft=snapshot.createDraft,plan=snapshot.creationPlan;
    assert.ok(draft&&plan);
    let changed=false;
    const skills=plan.sections.find((section)=>section.id==="proficiencies");
    if (skills?.status==="incomplete") {
      const count=classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item)=>!item.selected).slice(0,Math.max(0,count-draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({type:"toggle-skill",value:option.name});changed=true;
      }
    }
    const equipment=plan.sections.find((section)=>section.id==="class-equipment");
    if (equipment?.status==="incomplete"&&equipment.options[0]) { await adapter.updateCharacterDraft({type:"set-equipment",value:equipment.options[0].id});changed=true; }
    const current=await adapter.getSnapshot();
    for (const section of (current.creationPlan?.sections??[]).filter((entry)=>entry.kind==="dynamic-choice"&&entry.status==="incomplete"&&entry.selection)) {
      const selection=section.selection!;
      const wanted=selection.count-section.options.filter((option)=>option.selected).length;
      for (const option of section.options.filter((entry)=>!entry.selected).slice(0,Math.max(0,wanted))) {
        const latest=await adapter.getSnapshot();
        const target=latest.creationPlan?.sections.find((item)=>item.selection?.choiceId===selection.choiceId);
        if (!target||target.status==="complete"||target.status==="blocked") break;
        await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:selection.choiceId,value:option.id});changed=true;
      }
    }
    const after=await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount??1)===0) return after;
    if (!changed) assert.fail(`unable to complete draft: ${after.creationPlan?.validation.map((item)=>item.message).join(" | ")}`);
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function installFixture() {
  clearInstalledSpellEntriesForTests();
  const adapter=new MockAdapter();
  setInstalledContentStoreForTests(adapter,new MemoryInstalledContentStore());
  await adapter.getSnapshot();
  const preview=await adapter.previewContentImport(JSON.stringify(compileFixture().module));
  assert.deepEqual(preview.contentImport?.validation.filter((entry)=>entry.severity==="blocking"),[],JSON.stringify(preview.contentImport?.validation));
  await adapter.activateContentImport();
  return adapter;
}

test("the compiled supplement installs and its species, background, origin feat, and spell join Character creation",async()=>{
  const adapter=await installFixture();
  assert.ok(speciesOptions().some((option)=>option.id===SPECIES_ID&&option.name==="나방족"),"installed species is offered");
  assert.ok(backgroundOptions().some((option)=>option.id===BACKGROUND_ID),"installed background is offered");
  assert.ok(allOriginFeatOptions().some((option)=>option.id===ORIGIN_FEAT_ID),"installed origin feat is offered for the human origin-feat choice");
  assert.ok(spellOptions("dnd.srd521.class.wizard",0).some((option)=>option.id===SPELL_ID),"installed cantrip is on the wizard list");
  assert.equal(spellPresentationById(SPELL_ID)?.name,"조수 화살");

  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:"등대의 나방"});
  await adapter.updateCharacterDraft({type:"set-species",value:"나방족"});
  await adapter.updateCharacterDraft({type:"set-background",value:"등대지기"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  let snapshot=await adapter.getSnapshot();
  const sizeChoice=snapshot.creationPlan?.sections.find((section)=>section.selection?.choiceId==="species.size");
  assert.ok(sizeChoice,"the two-size species asks for a size");
  assert.deepEqual(sizeChoice.options.map((option)=>option.id),["small","medium"]);
  const backgroundSection=snapshot.creationPlan?.sections.find((section)=>section.id==="background");
  assert.ok(backgroundSection?.automaticGrants.some((grant)=>/지각|perception/i.test(grant)),JSON.stringify(backgroundSection?.automaticGrants));
  await fillCurrentDraft(adapter);
  await adapter.finalizeCharacterDraft();
  snapshot=await adapter.getSnapshot();
  const sheet=snapshot.activeCharacter;
  assert.equal(sheet.species,"나방족");
  assert.equal(sheet.background,"등대지기");
  assert.ok(sheet.featIds?.includes(ORIGIN_FEAT_ID),`the installed origin feat is a grant; got ${JSON.stringify(sheet.featIds)}`);
  assert.ok(sheet.features.some((feature)=>/등불지기/.test(feature)),"the origin feat label uses the installed name");
  assert.ok(sheet.features.some((feature)=>/달빛 감각/.test(feature)),`species trait labels land on the sheet; got ${sheet.features.join("|")}`);
  assert.ok(sheet.skills.includes("지각")&&sheet.skills.includes("생존"),`background skills apply; got ${sheet.skills.join("|")}`);
  clearInstalledSpellEntriesForTests();
});

test("a Fighter levels into the compiled subclass and its level-3 executable feature becomes an owned action",async()=>{
  const adapter=await installFixture();
  const baseline=(await adapter.getSnapshot()).activeCharacter;
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...baseline,level:2,subclassName:"",classLevels:[{classId:FIGHTER_ID,className:"전사",level:2}],
    subclassIds:{},subclassSources:{},subclassFeatureIds:[],subclassFeatureSources:{},installedProgressionGrantIds:[],featIds:[],featSources:{},
    proficiencyBonus:2,hitDiceByDie:{d10:2},
  } as CharacterSheet;
  const commands=adapter as unknown as Phase07AdapterCommands;
  let snapshot=await adapter.getSnapshot();
  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot=await adapter.getSnapshot();
  const choiceId=`progression.${FIGHTER_ID}.3.subclass`;
  const subclassChoice=snapshot.progressionPlan?.choices.find((entry)=>entry.id===choiceId);
  assert.ok(subclassChoice,"Fighter 3 exposes the subclass choice");
  const option=subclassChoice.options.find((entry)=>entry.id===`installed-subclass:${SUBCLASS_ID}`);
  assert.ok(option,`the compiled subclass is a legal option; got ${subclassChoice.options.map((entry)=>entry.id).join("|")}`);
  assert.equal(option.label,"폭풍 기사");
  await commands.setProgressionChoice(choiceId,{kind:"options",optionIds:[option.id]});
  snapshot=await adapter.getSnapshot();
  for (const choice of snapshot.progressionPlan?.choices??[]) {
    if (choice.id===choiceId||!choice.required||!choice.options.length) continue;
    const legal=choice.options.find((entry)=>!entry.disabledReason);
    if (legal) await commands.setProgressionChoice(choice.id,{kind:"options",optionIds:[legal.id]});
  }
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  snapshot=await adapter.commitLevelUp();
  assert.equal(snapshot.activeCharacter.level,3);
  assert.equal(snapshot.activeCharacter.subclassIds?.[FIGHTER_ID],SUBCLASS_ID);
  assert.deepEqual(new Set(snapshot.activeCharacter.installedProgressionGrantIds),new Set([`${SUBCLASS_ID}.feature.3-1`,`${SUBCLASS_ID}.feature.3-2`]),"both level-3 features are granted by stable id");
  assert.ok(snapshot.activeCharacter.features.some((feature)=>/번개 재정비/.test(feature)),snapshot.activeCharacter.features.join("|"));

  await adapter.startInitiative();
  await adapter.setCurrentActor(snapshot.activeCharacter.id);
  snapshot=await adapter.getSnapshot();
  const actions=snapshot.scene.actionsByActor[snapshot.activeCharacter.id]??[];
  const feature=actions.find((action)=>/번개 재정비/.test(action.name));
  assert.ok(feature,`the executable level-3 feature is an owned action; got ${actions.map((action)=>action.name).join("|")}`);
  clearInstalledSpellEntriesForTests();
});
