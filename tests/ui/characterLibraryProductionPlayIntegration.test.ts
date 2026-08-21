import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import { MockAdapter } from "../../src/app/mockAdapter";
import { MemoryCharacterLibraryStore } from "../../src/app/memoryCharacterLibraryStore";
import { setCharacterLibraryStoreForTests } from "../../src/app/characterLibraryRuntimeAdapter";
import { classIdFromName, classMeta } from "../../src/app/characterCreationV10Data";
import type { CharacterCreationSection } from "../../src/app/contracts";

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
    if ((after.creationPlan?.summary.blockingCount??1)===0) return after;
    if (!changed) {
      const unresolved=after.creationPlan?.sections
        .filter((section)=>section.status==="incomplete"||section.status==="blocked")
        .map((section)=>`${section.id}:${section.status}`)
        .join(", ");
      assert.fail(`unable to complete creation draft: ${unresolved}`);
    }
  }
  assert.fail("creation completion exceeded 40 passes");
}

async function createFreshFighter(adapter:MockAdapter) {
  await adapter.createCharacterDraft("guided");
  await adapter.updateCharacterDraft({type:"set-name",value:"Phase14 Fresh Production Fighter"});
  await adapter.updateCharacterDraft({type:"set-species",value:"드워프"});
  await adapter.updateCharacterDraft({type:"set-background",value:"범죄자"});
  await adapter.updateCharacterDraft({type:"set-class",value:"파이터"});
  await adapter.updateCharacterDraft({type:"apply-recommended-array"});
  const ready=await fillCurrentCreationDraft(adapter);
  assert.equal(ready.creationPlan?.summary.blockingCount,0);
  return adapter.finalizeCharacterDraft();
}

function assertFreshCharacterIsLiveProductionActor(snapshot:Awaited<ReturnType<MockAdapter["getSnapshot"]>>,characterId:string) {
  assert.equal(snapshot.activeCharacter.id,characterId);
  assert.notEqual(characterId,"char.aelar");
  assert.notEqual(characterId,"char.mira");
  const entity=snapshot.scene.entities.find((entry)=>entry.id===characterId);
  assert.ok(entity,"fresh Character must materialize into the live Scene");
  assert.equal(entity.kind,"character");
  assert.equal(entity.name,snapshot.activeCharacter.name);
  assert.equal(entity.hp,snapshot.activeCharacter.hp);
  assert.equal(entity.maxHp,snapshot.activeCharacter.maxHp);
  assert.equal(entity.tempHp,snapshot.activeCharacter.tempHp);
  assert.equal(entity.ac,snapshot.activeCharacter.ac);
  assert.equal(snapshot.scene.entities.some((entry)=>entry.id==="char.aelar"||entry.id==="char.mira"),false,"reference Character actors must not remain in the production Scene");

  const actions=snapshot.scene.actionsByActor[characterId]??[];
  assert.ok(actions.length>=19,"fresh Character must receive derived production actions");
  assert.ok(actions.every((action)=>action.actorId===characterId));
  assert.ok(actions.some((action)=>action.id==="action.dash"));
  assert.ok(actions.some((action)=>action.id==="action.skill.athletics"));
}

test("freshly authored Character persists, enters local production play, and re-enters after storage restart",async()=>{
  const store=new MemoryCharacterLibraryStore();
  const writer=new MockAdapter();
  setCharacterLibraryStoreForTests(writer,store);
  await writer.getSnapshot();

  const committed=await createFreshFighter(writer);
  const characterId=committed.activeCharacter.id;
  assert.equal(committed.activeCharacter.saveState,"saved");
  assert.equal(committed.persistence?.storageRevision,1);
  assert.ok((await store.readGenerations()).length>0);

  const firstPlay=await writer.startProductionLocalPlay("player");
  assertFreshCharacterIsLiveProductionActor(firstPlay,characterId);
  assert.equal(firstPlay.connectionState,"connected");
  assert.equal(firstPlay.session.address,"local");
  assert.ok(firstPlay.session.participants.some((participant)=>participant.characterName===committed.activeCharacter.name));

  const reader=new MockAdapter();
  setCharacterLibraryStoreForTests(reader,store);
  const restored=await reader.getSnapshot();
  assert.equal(restored.activeCharacter.id,characterId);
  assert.equal(restored.activeCharacter.name,"Phase14 Fresh Production Fighter");
  assert.equal(restored.persistence?.storageRevision,1);
  assertFreshCharacterIsLiveProductionActor(restored,characterId);

  const replay=await reader.startProductionLocalPlay("player");
  assertFreshCharacterIsLiveProductionActor(replay,characterId);
  assert.equal(replay.connectionState,"connected");
  assert.equal(replay.session.address,"local");
  assert.equal(replay.session.role,"offline");
});
