import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/characterCreationV10Adapter";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import "../../src/app/progressionContracts";
import type { CatalogEntry, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { generatedBuiltinCatalogForTests } from "../../src/app/builtinCatalogRuntimeAdapter";
import { setBuiltinCommonPlayCatalogForTests } from "../../src/app/installedCommonPlayRuntimeAdapter";
import { parseRuntimeArtifactCommonPlayActionId } from "../../src/app/installedCommonPlayActionReference";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import { buildCharacterLibraryRecordV1, materializeCharacterRecordV1 } from "../../src/app/characterLibraryPersistence";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { Phase07AdapterCommands } from "../../src/app/progressionRuntimeAdapter";

const ALERT="dnd.srd521.feat.alert";
const GRAPPLER="dnd.srd521.feat.grappler";
const FIGHTER_ID="dnd.srd521.class.fighter";
const FIGHTER_ASI_CHOICE_ID=`progression.${FIGHTER_ID}.4.asi`;

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

// X1-01: a feat the Character chose must be a grant, not only a label, so its Common Play mechanics can execute.
test("character creation records the background's origin feat by stable id and the projection pins it as a feat identity",async()=>{
  const adapter=new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:"경계 파이터"});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  await fillCurrentDraft(adapter);
  await adapter.finalizeCharacterDraft();
  const snapshot=await adapter.getSnapshot();
  const sheet=snapshot.activeCharacter;
  assert.ok(sheet.featIds?.includes(ALERT),`the Criminal background grants Alert by id; got ${JSON.stringify(sheet.featIds)}`);
  assert.equal(sheet.featSources?.[ALERT],"character creation origin feat");
  assert.ok(sheet.features.some((feature)=>/경계/.test(feature)),"the label stays on the sheet");

  const projection=buildCharacterSessionProjectionV1(sheet,snapshot.catalog as CatalogEntry[]);
  const identity=projection.contentIdentities.find((entry)=>entry.contentId===ALERT);
  assert.ok(identity,"the feat is pinned as a content identity");
  assert.equal(identity.category,"feat");

  // Durable round trip keeps the ids.
  const record=buildCharacterLibraryRecordV1(sheet);
  const restored=materializeCharacterRecordV1(record);
  assert.deepEqual(restored.featIds,sheet.featIds);
  assert.deepEqual(restored.featSources,sheet.featSources);
});

test("a feat taken in place of the Fighter 4 ability score increase is recorded by stable id",async()=>{
  const adapter=new MockAdapter();
  const baseline=(await adapter.getSnapshot()).activeCharacter;
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...baseline,level:3,subclassName:"",classLevels:[{classId:FIGHTER_ID,className:"전사",level:3}],
    subclassIds:{},subclassSources:{},subclassFeatureIds:[],subclassFeatureSources:{},installedProgressionGrantIds:[],featIds:[],featSources:{},
    proficiencyBonus:2,hitDiceByDie:{d10:3},abilities:{...baseline.abilities,str:16,dex:12},
  } as CharacterSheet;
  const commands=adapter as unknown as Phase07AdapterCommands;
  let snapshot=await adapter.getSnapshot();
  await adapter.startLevelUp(snapshot.activeCharacter.id);
  snapshot=await adapter.getSnapshot();
  const asi=snapshot.progressionPlan?.choices.find((entry)=>entry.id===FIGHTER_ASI_CHOICE_ID);
  assert.ok(asi,"Fighter 4 exposes the ability-score-or-feat choice");
  const GRAPPLER_OPTION=`content:dnd.srd-5.2.1@0.1-draft#${GRAPPLER}`;
  const option=asi.options.find((entry)=>entry.id===`feat:${GRAPPLER_OPTION}`);
  assert.ok(option,`Grappler is a legal option; got ${asi.options.map((entry)=>entry.id).join("|")}`);
  await commands.setProgressionChoice(FIGHTER_ASI_CHOICE_ID,{kind:"asi",mode:"feat",featId:GRAPPLER_OPTION});
  snapshot=await adapter.getSnapshot();
  for (const choice of snapshot.progressionPlan?.choices??[]) {
    if (choice.id===FIGHTER_ASI_CHOICE_ID||!choice.required||!choice.options.length) continue;
    const legal=choice.options.find((entry)=>!entry.disabledReason);
    if (legal) await commands.setProgressionChoice(choice.id,{kind:"options",optionIds:[legal.id]});
  }
  snapshot=await adapter.getSnapshot();
  assert.deepEqual(snapshot.progressionPlan?.blocking,[]);
  snapshot=await adapter.commitLevelUp();
  assert.equal(snapshot.activeCharacter.level,4);
  assert.ok(snapshot.activeCharacter.featIds?.includes(GRAPPLER),`the chosen feat is recorded by id; got ${JSON.stringify(snapshot.activeCharacter.featIds)}`);
  assert.match(snapshot.activeCharacter.featSources?.[GRAPPLER]??"",/ability-score-or-feat/);
});

test("a builtin feat that carries a manual Common Play entry point becomes an owned action once the feat is a grant",async()=>{
  const adapter=new MockAdapter();
  const alert=structuredClone(generatedBuiltinCatalogForTests().find((entry)=>(entry.contentId??entry.id)===ALERT));
  assert.ok(alert,"the generated builtin catalog carries Alert");
  alert.mechanics=[{kind:"common-play",config:{
    "$schema":"https://simplevtt.local/schemas/common-play-contract.schema.json",schemaVersion:"0.2-draft",id:"feat.alert.test-focus",
    entryPoints:[{id:"focus",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:1},target:"self"}]}],
  }}];
  setBuiltinCommonPlayCatalogForTests(adapter,[alert]);
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  let snapshot=await adapter.getSnapshot();
  const ownedFeatAction=(actions:{id:string}[]|undefined)=>(actions??[]).find((action)=>parseRuntimeArtifactCommonPlayActionId(action.id)?.definitionActionId===ALERT);
  assert.equal(ownedFeatAction(snapshot.scene.actionsByActor[internal.activeCharacter.id]),undefined,"without the grant the feat's entry point is not offered");

  internal.activeCharacter.featIds=[ALERT];
  snapshot=await adapter.getSnapshot();
  const action=ownedFeatAction(snapshot.scene.actionsByActor[internal.activeCharacter.id]);
  assert.ok(action,`the feat's manual entry point is an owned action; got ${(snapshot.scene.actionsByActor[internal.activeCharacter.id]??[]).map((entry)=>entry.id).join("|")}`);

  const hpBefore=snapshot.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp;
  internal.activeCharacter.hp=Math.max(1,hpBefore-3);
  for (const entity of internal.scene.entities) if (entity.id===internal.activeCharacter.id) entity.hp=internal.activeCharacter.hp;
  await adapter.resolveAction(action.id,[internal.activeCharacter.id]);
  snapshot=await adapter.getSnapshot();
  for (let step=0;step<6&&snapshot.resolution&&snapshot.resolution.stage!=="complete";step+=1) { if(!snapshot.resolution.canAdvance) break; snapshot=await adapter.advanceResolution(); }
  assert.equal(snapshot.resolution?.stage,"complete",snapshot.resolution?.finalOutcome);
  assert.equal(snapshot.scene.entities.find((entity)=>entity.id===internal.activeCharacter.id)!.hp,internal.activeCharacter.hp,"the feat's operation executed through the Common Play runtime");
});
