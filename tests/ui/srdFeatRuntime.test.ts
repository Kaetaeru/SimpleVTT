import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import "../../src/app/connectedSessionRuntimeAdapter";
import "../../src/app/connectedActionRoutingAdapter";
import type { AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { generatedBuiltinCatalogForTests } from "../../src/app/builtinCatalogRuntimeAdapter";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { FEAT_RULE_CATALOG, featExecution } from "../../src/domain/featRuleCatalog";
import { buildCharacterSessionProjectionV1 } from "../../src/app/characterSessionProjection";
import type { CatalogEntry } from "../../src/app/contracts";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";

// X1-03: SRD feat JSON. Archery executes through the automatic interceptor seam (X1-02) on the real generated catalog.
const ARCHERY="dnd.srd521.feat.fighting-style.archery";
const GOBLIN="combatant.goblin-a";

test("every builtin Common Play mechanic parses and lowers, so passive discovery can never throw mid-resolution",()=>{
  let mechanics=0;
  for(const entry of generatedBuiltinCatalogForTests()){
    for(const [index,mechanic] of (entry.mechanics??[]).entries()){
      if(mechanic.kind!=="common-play")continue;
      mechanics+=1;
      const canonical=parseCommonPlayDefinition(mechanic.config,`${entry.id} mechanic ${index}`);
      lowerCommonPlayReactionDefinition(canonical,{resolveResourceDie:()=>8,resolveNumericReference:()=>1});
    }
  }
  assert.ok(mechanics>0,"the builtin catalog carries Common Play mechanics");
});

test("the feat rule catalog records an execution status for every SRD feat and it agrees with the builtin catalog's mechanics",()=>{
  const builtin=new Map(generatedBuiltinCatalogForTests().filter((entry)=>entry.category==="feat").map((entry)=>[entry.contentId??entry.id,entry]));
  assert.equal(FEAT_RULE_CATALOG.feats.length,17);
  for(const feat of FEAT_RULE_CATALOG.feats){
    const execution=featExecution(feat);
    assert.ok(feat.config.execution,`${feat.id} records how it executes`);
    const hasCommonPlay=(builtin.get(feat.id)?.mechanics??[]).some((mechanic)=>mechanic.kind==="common-play");
    assert.equal(hasCommonPlay,execution.status==="common-play",`${feat.id}: common-play status must match the builtin mechanics`);
    if(execution.status!=="common-play")assert.ok(execution.reason,`${feat.id}: a non-executing feat names the missing seam`);
  }
  assert.equal(featExecution(FEAT_RULE_CATALOG.feats.find((feat)=>feat.id===ARCHERY)!).status,"common-play");
  assert.equal(featExecution(FEAT_RULE_CATALOG.feats.find((feat)=>feat.id==="dnd.srd521.feat.fighting-style.defense")!).status,"derived");
});

async function attack(adapter:MockAdapter,actorId:string,actionId:string,targetId:string,natural:number) {
  await adapter.setCurrentActor(actorId);
  await adapter.setQueuedD20(natural);
  let snapshot=await adapter.resolveAction(actionId,[targetId]);
  for(let step=0;step<4&&snapshot.resolution?.stage!=="attack-result"&&snapshot.resolution?.stage!=="complete";step+=1)snapshot=await adapter.advanceResolution();
  assert.ok(snapshot.resolution?.stage==="attack-result"||snapshot.resolution?.stage==="complete",JSON.stringify(snapshot.resolution));
  return snapshot;
}

function archeryContribution(snapshot:AppSnapshot) {
  return snapshot.resolution?.rollModifierContributions?.find((entry)=>entry.source===`common-play:${ARCHERY}`);
}

test("Archery from the real SRD catalog adds +2 to a ranged weapon attack roll and nothing to a melee attack",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm};
  internal.activeCharacter.fightingStyleFeatIds=[ARCHERY];
  await adapter.startInitiative();
  const hero=internal.activeCharacter.id;
  let snapshot=await attack(adapter,hero,"action.shortbow",GOBLIN,10);
  assert.equal(snapshot.resolution?.interrupt,undefined,"Archery never asks a question");
  assert.equal(snapshot.resolution?.attackTotal,10+5+2,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  assert.equal(archeryContribution(snapshot)?.value,2);
  assert.ok(snapshot.resolution?.detail.some((line)=>/궁술/.test(line)),snapshot.resolution?.detail.join(" | "));
  while(snapshot.resolution&&snapshot.resolution.stage!=="complete"&&snapshot.resolution.canAdvance)snapshot=await adapter.advanceResolution();

  snapshot=await attack(adapter,hero,"action.longsword",GOBLIN,10);
  assert.equal(snapshot.resolution?.attackTotal,10+7);
  assert.equal(archeryContribution(snapshot),undefined,"a melee weapon attack gets no Archery bonus");
});

test("without the fighting style the same ranged attack has no Archery bonus",async()=>{
  const adapter=new MockAdapter();
  await adapter.getSnapshot();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter.fightingStyleFeatIds=[];
  await adapter.startInitiative();
  const snapshot=await attack(adapter,internal.activeCharacter.id,"action.shortbow",GOBLIN,10);
  assert.equal(snapshot.resolution?.attackTotal,15);
  assert.equal(archeryContribution(snapshot),undefined);
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

test("a Fighter created with the Archery fighting style and starting equipment B owns Archery and gets +2 on the longbow",async()=>{
  const adapter=new MockAdapter();
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:"창조된 궁수"});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  let snapshot=await adapter.getSnapshot();
  const equipment=snapshot.creationPlan?.sections.find((section)=>section.id==="class-equipment");
  const optionB=equipment?.options.find((option)=>/^B /.test(option.name)||option.id.endsWith("#B"));
  assert.ok(optionB,`Fighter loadout B is offered; got ${equipment?.options.map((option)=>option.id).join("|")}`);
  await adapter.updateCharacterDraft({type:"set-equipment",value:optionB.id});
  snapshot=await adapter.getSnapshot();
  const style=snapshot.creationPlan?.sections.find((section)=>section.selection?.choiceId==="class.fighting-style");
  assert.ok(style,"Fighter 1 offers the fighting style choice");
  await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:"class.fighting-style",value:ARCHERY});
  await fillCurrentDraft(adapter);
  await adapter.finalizeCharacterDraft();
  snapshot=await adapter.getSnapshot();
  const sheet=snapshot.activeCharacter;
  assert.deepEqual(sheet.fightingStyleFeatIds,[ARCHERY],"creation records the chosen fighting style as a feat grant");
  assert.equal(sheet.fightingStyleFeatSources?.[ARCHERY],"character creation fighting style");
  const projection=buildCharacterSessionProjectionV1(sheet,snapshot.catalog as CatalogEntry[]);
  assert.ok(projection.contentIdentities.some((entry)=>entry.contentId===ARCHERY&&entry.category==="feat"),"the projection pins Archery");

  await adapter.startInitiative();
  snapshot=await adapter.getSnapshot();
  const longbow=(snapshot.scene.actionsByActor[sheet.id]??[]).find((action)=>/장궁|longbow/i.test(action.name)&&action.resolutionKind==="attack");
  assert.ok(longbow,`the created Fighter has a longbow attack; got ${(snapshot.scene.actionsByActor[sheet.id]??[]).map((action)=>action.name).join("|")}`);
  const enemy=snapshot.scene.entities.find((entity)=>entity.side==="enemy");
  assert.ok(enemy);
  snapshot=await attack(adapter,sheet.id,longbow.id,enemy.id,10);
  assert.equal(archeryContribution(snapshot)?.value,2,JSON.stringify(snapshot.resolution?.rollModifierContributions));
  assert.equal(snapshot.resolution?.attackTotal,10+(longbow.attackBonus??0)+2);
});
