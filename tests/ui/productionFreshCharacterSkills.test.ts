import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { AbilityKey, ActionVm, CharacterCreationSection, CharacterSheet } from "../../src/app/contracts";

const SKILLS:Array<{id:string;name:string;ability:AbilityKey}>=[
  {id:"action.skill.athletics",name:"운동",ability:"str"},
  {id:"action.skill.acrobatics",name:"곡예",ability:"dex"},
  {id:"action.skill.sleight-of-hand",name:"손재주",ability:"dex"},
  {id:"action.skill.stealth",name:"은신",ability:"dex"},
  {id:"action.skill.arcana",name:"비전",ability:"int"},
  {id:"action.skill.history",name:"역사",ability:"int"},
  {id:"action.skill.investigation",name:"조사",ability:"int"},
  {id:"action.skill.nature",name:"자연",ability:"int"},
  {id:"action.skill.religion",name:"종교",ability:"int"},
  {id:"action.skill.animal-handling",name:"동물 조련",ability:"wis"},
  {id:"action.skill.insight",name:"통찰",ability:"wis"},
  {id:"action.skill.medicine",name:"의학",ability:"wis"},
  {id:"action.skill.perception",name:"지각",ability:"wis"},
  {id:"action.skill.survival",name:"생존",ability:"wis"},
  {id:"action.skill.deception",name:"기만",ability:"cha"},
  {id:"action.skill.intimidation",name:"위협",ability:"cha"},
  {id:"action.skill.performance",name:"공연",ability:"cha"},
  {id:"action.skill.persuasion",name:"설득",ability:"cha"},
];

async function fillCurrentCreationDraft(adapter:MockAdapter) {
  for (let pass=0;pass<40;pass++) {
    const snapshot=await adapter.getSnapshot();
    const draft=snapshot.createDraft;
    const plan=snapshot.creationPlan;
    assert.ok(draft&&plan,"creation draft/plan must exist");
    let changed=false;

    const skills=plan.sections.find((section)=>section.id==="proficiencies");
    if (skills?.status==="incomplete") {
      const count=classMeta(classIdFromName(draft.className)).semantics.skills.count;
      for (const option of skills.options.filter((item)=>!item.selected).slice(0,Math.max(0,count-draft.selectedSkills.length))) {
        await adapter.updateCharacterDraft({type:"toggle-skill",value:option.name});
        changed=true;
      }
    }

    const equipment=plan.sections.find((section)=>section.id==="class-equipment");
    if (equipment?.status==="incomplete"&&equipment.options[0]) {
      await adapter.updateCharacterDraft({type:"set-equipment",value:equipment.options[0].id});
      changed=true;
    }

    const current=await adapter.getSnapshot();
    const dynamic=(current.creationPlan?.sections??[]).filter(
      (section)=>section.kind==="dynamic-choice"&&section.status==="incomplete"&&section.selection,
    ) as Array<CharacterCreationSection&{selection:{choiceId:string;count:number}}>;
    for (const section of dynamic) {
      const selectedCount=section.options.filter((option)=>option.selected).length;
      const targetIds=section.options.filter((option)=>!option.selected).slice(0,section.selection.count-selectedCount).map((option)=>option.id);
      for (const id of targetIds) {
        const latest=await adapter.getSnapshot();
        const target=latest.creationPlan?.sections.find((item)=>item.selection?.choiceId===section.selection.choiceId);
        if (!target||target.status==="complete"||target.status==="blocked") break;
        if (!target.options.some((option)=>option.id===id&&!option.selected)) continue;
        await adapter.updateCharacterDraft({type:"toggle-class-choice",choiceId:section.selection.choiceId,value:id});
        changed=true;
      }
    }

    const after=await adapter.getSnapshot();
    if ((after.creationPlan?.summary.blockingCount??1)===0) return;
    if (!changed) assert.fail("unable to complete fresh skill Character draft");
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function createFreshFighter(adapter:MockAdapter) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:"Phase14 Fresh Skill Fighter"});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  await fillCurrentCreationDraft(adapter);
  return adapter.finalizeCharacterDraft();
}

function proficient(character:CharacterSheet,name:string) {
  return character.skills.some((entry)=>entry===name||entry.startsWith(`${name} `)||entry.startsWith(`${name}+`));
}

function abilityModifier(score:number) {
  return Math.floor((score-10)/2);
}

function findSkillActions(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>) {
  const character=snapshot.activeCharacter;
  const actions=snapshot.scene.actionsByActor[character.id]??[];
  const candidates=SKILLS.map((fact)=>({fact,action:actions.find((entry)=>entry.id===fact.id)})).filter(
    (entry):entry is {fact:(typeof SKILLS)[number];action:ActionVm}=>Boolean(entry.action),
  );
  const trained=candidates.find(({fact})=>proficient(character,fact.name));
  assert.ok(trained,"fresh Character must expose at least one proficient skill action");
  const untrained=candidates.find(({fact})=>fact.ability!==trained.fact.ability&&!proficient(character,fact.name));
  assert.ok(untrained,"fresh Character must expose a non-proficient skill using a different ability");
  return {trained,untrained};
}

async function resolveSkill(
  adapter:MockAdapter,
  action:ActionVm,
  fact:(typeof SKILLS)[number],
  face:number,
  expectedModifier:number,
) {
  const before=await adapter.getSnapshot();
  const actorId=before.activeCharacter.id;
  const economy=structuredClone(before.scene.economyByActor[actorId]);
  assert.equal(before.sessionMode,"freeform");
  assert.equal(action.actorId,actorId);
  assert.equal(action.checkBonus,expectedModifier);
  assert.equal(action.details.find((entry)=>entry.label==="판정")?.value.includes(fact.name),true);

  await adapter.setQueuedD20(face);
  const preview=await adapter.resolveAction(action.id,[]);
  const resolution=preview.resolution;
  assert.ok(resolution);
  assert.equal(resolution.actorId,actorId);
  assert.equal(resolution.actionId,action.id);
  assert.equal(resolution.rollKind,"check");
  assert.deepEqual(resolution.authoritativeDice,[face]);
  assert.equal(resolution.rollTotal,face+expectedModifier);
  assert.ok(resolution.provenance.some((entry)=>entry.includes(`action:${action.id}:check-bonus`)));
  assert.deepEqual(preview.scene.economyByActor[actorId],economy,"preview must not consume Freeform economy");

  const committed=await adapter.advanceResolution();
  assert.equal(committed.resolution?.stage,"complete");
  assert.deepEqual(committed.scene.economyByActor[actorId],economy,"committed Freeform skill check must not consume action economy");
  const activity=committed.activity.find((entry)=>entry.id===resolution.id);
  assert.ok(activity,"committed skill check must create Activity");
  assert.equal(activity.actor,committed.activeCharacter.name);
  assert.ok(activity.summary.includes(`d20 ${face}`));
  assert.ok(activity.detail.some((entry)=>entry.includes(`action:${action.id}:check-bonus`)));
  assert.equal(activity.stateChanges.some((entry)=>/행동 사용|추가 행동 사용|반응 사용/.test(entry)),false);
}

async function freshFreeformFighter() {
  const store=new MemoryCharacterLibraryStore();
  const adapter=new MockAdapter();
  setCharacterLibraryStoreForTests(adapter,store);
  await adapter.getSnapshot();
  const created=await createFreshFighter(adapter);
  const characterId=created.activeCharacter.id;
  assert.notEqual(characterId,"char.aelar");
  assert.notEqual(characterId,"char.mira");
  assert.equal(created.activeCharacter.saveState,"saved");
  await adapter.startProductionLocalPlay("player");
  const freeform=await adapter.setSessionMode("freeform");
  assert.equal(freeform.activeCharacter.id,characterId);
  return {adapter,freeform,characterId};
}

test("fresh non-fixture Character resolves proficient and untrained skills with authoritative dice without Freeform economy cost",async()=>{
  const {adapter,freeform,characterId}=await freshFreeformFighter();
  const {trained,untrained}=findSkillActions(freeform);
  const character=freeform.activeCharacter;

  const trainedExpected=abilityModifier(character.abilities[trained.fact.ability])+character.proficiencyBonus;
  const untrainedExpected=abilityModifier(character.abilities[untrained.fact.ability]);
  assert.notEqual(trained.fact.ability,untrained.fact.ability);
  assert.equal(proficient(character,trained.fact.name),true);
  assert.equal(proficient(character,untrained.fact.name),false);

  await resolveSkill(adapter,trained.action,trained.fact,7,trainedExpected);
  await resolveSkill(adapter,untrained.action,untrained.fact,16,untrainedExpected);

  const done=await adapter.getSnapshot();
  assert.equal(done.activeCharacter.id,characterId);
  const skillActivities=done.activity.filter((entry)=>entry.actor===done.activeCharacter.name&&entry.detail.some((detail)=>detail.includes(":check-bonus")));
  assert.ok(skillActivities.length>=2);
});

test("fresh non-fixture Character commits a canonical weapon attack and a non-weapon Dash action",async()=>{
  const {adapter,freeform,characterId}=await freshFreeformFighter();
  const actions=freeform.scene.actionsByActor[characterId]??[];
  const attack=actions
    .filter((action)=>action.resolutionKind==="attack"&&action.runtimeAttack)
    .sort((a,b)=>(b.runtimeAttack?.rangeFeet??0)-(a.runtimeAttack?.rangeFeet??0))[0];
  assert.ok(attack,"fresh Fighter must expose a runtime-backed weapon attack");
  assert.equal(attack.actorId,characterId);
  assert.ok(attack.runtimeAttack?.damageSource.includes(`character:${characterId}:attack:`));

  const range=attack.runtimeAttack?.rangeFeet??0;
  const target=freeform.scene.entities.find((entity)=>{
    if (entity.side==="ally"||entity.reactions.length) return false;
    const distance=Number.parseInt(entity.distance??"");
    return Number.isFinite(distance)&&distance<=range;
  });
  assert.ok(target,`fresh Fighter attack requires an enemy within ${range} feet`);
  const targetHp=target.hp;
  const economy=structuredClone(freeform.scene.economyByActor[characterId]);

  await adapter.setQueuedD20(20);
  let attackState=await adapter.resolveAction(attack.id,[target.id]);
  const attackResolutionId=attackState.resolution?.id;
  assert.ok(attackResolutionId);
  assert.equal(attackState.resolution?.actorId,characterId);
  assert.deepEqual(attackState.resolution?.authoritativeDice,[20]);
  assert.equal(attackState.resolution?.attackOutcome,"명중");
  assert.equal(attackState.resolution?.critical,true);
  for (let step=0;step<4&&attackState.resolution?.stage!=="complete";step++) {
    attackState=await adapter.advanceResolution();
  }
  assert.equal(attackState.resolution?.stage,"complete");
  assert.ok((attackState.scene.entities.find((entity)=>entity.id===target.id)?.hp??targetHp)<targetHp);
  assert.deepEqual(attackState.scene.economyByActor[characterId],economy,"Freeform weapon attack must not consume hidden initiative economy");
  const attackActivity=attackState.activity.find((entry)=>entry.id===attackResolutionId);
  assert.ok(attackActivity,"weapon attack must project committed ResolutionEvent activity");
  assert.ok(attackActivity.stateChanges.some((entry)=>entry.includes(target.id)&&entry.includes("HP")));

  const dash=(attackState.scene.actionsByActor[characterId]??[]).find((action)=>action.id==="action.dash");
  assert.ok(dash,"fresh Fighter must expose the basic Dash action");
  assert.equal(dash.actorId,characterId);
  const movementBefore=attackState.scene.economyByActor[characterId]?.movementMax??0;
  const dashPreview=await adapter.resolveAction(dash.id,[characterId]);
  const dashResolutionId=dashPreview.resolution?.id;
  assert.ok(dashResolutionId);
  assert.equal(dashPreview.resolution?.actorId,characterId);
  const dashCommitted=await adapter.advanceResolution();
  assert.equal(dashCommitted.resolution?.stage,"complete");
  assert.ok((dashCommitted.scene.economyByActor[characterId]?.movementMax??0)>movementBefore);
  assert.equal(dashCommitted.scene.economyByActor[characterId]?.action,economy.action);
  const dashActivity=dashCommitted.activity.find((entry)=>entry.id===dashResolutionId);
  assert.ok(dashActivity,"Dash must produce Activity");
  assert.ok(dashActivity.stateChanges.some((entry)=>entry.includes("이동 가능량")));
});
