import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { AppSnapshot, CharacterSheet } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../../src/domain/bardLoreProgression";

const INTERRUPT_ID="follow-up.d20-modification";

async function prepareLoreBard(adapter:MockAdapter,level=14){
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바드",
    subclassName:"전승 학파",
    level,
    abilities:{...internal.activeCharacter.abilities,cha:18},
    classLevels:[{classId:BARD_LORE_CLASS_ID,className:"바드",level,subclassName:"전승 학파"}],
    subclassIds:{[BARD_LORE_CLASS_ID]:BARD_COLLEGE_LORE_SUBCLASS_ID},
    resources:[
      ...internal.activeCharacter.resources.filter((entry)=>entry.id!==BARDIC_INSPIRATION_RESOURCE_ID),
      {id:BARDIC_INSPIRATION_RESOURCE_ID,label:"바드의 영감",current:4,max:4,source:"바드 클래스 기능",recovery:{shortRest:"all",longRest:"all"}},
    ],
  };
  await adapter.startProductionLocalPlay("dm");
  return adapter.getSnapshot();
}

function inspirationUses(snapshot:AppSnapshot){
  return snapshot.activeCharacter.resources.find((entry)=>entry.id===BARDIC_INSPIRATION_RESOURCE_ID)?.current;
}

function abilityCheckAction(snapshot:AppSnapshot){
  return snapshot.scene.actionsByActor[snapshot.activeCharacter.id]?.find((entry)=>entry.resolutionKind==="ability-check"&&entry.sessionStatusEffect?.minimumRoll===undefined);
}

async function startFailedCheck(adapter:MockAdapter,dcDelta:number){
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  await adapter.setCurrentActor(actorId);
  snapshot=await adapter.getSnapshot();
  const check=abilityCheckAction(snapshot);
  assert.ok(check,JSON.stringify(snapshot.scene.actionsByActor[actorId]));
  await adapter.setQueuedD20(4);
  await adapter.resolveAction(check.id,[]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!+dcDelta});
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));
  return snapshot;
}

async function finish(adapter:MockAdapter){
  for(let step=0;step<8;step++){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  throw new Error("resolution did not complete");
}

test("Lore Bard 14 Peerless Skill turns a failed ability check into success, spends Inspiration, records Activity, and Undo restores it",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  const before=inspirationUses(snapshot);
  assert.equal(before,4);
  snapshot=await startFailedCheck(adapter,4);

  await adapter.setQueuedD20(6);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.checkOutcome,"성공",JSON.stringify(snapshot.resolution));
  assert.equal(inspirationUses(snapshot),before!-1);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("비할 데 없는 기술"))),true);

  snapshot=await adapter.undoLastResolution();
  assert.equal(inspirationUses(snapshot),before);
});

test("Peerless Skill keeps Bardic Inspiration when the added die still leaves the ability check failed",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  const before=inspirationUses(snapshot);
  snapshot=await startFailedCheck(adapter,10);

  await adapter.setQueuedD20(3);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.checkOutcome,"실패",JSON.stringify(snapshot.resolution));
  assert.equal(inspirationUses(snapshot),before);
  assert.equal(snapshot.resolution?.detail.some((detail)=>detail.includes("자원 보존")),true);
});

test("Peerless Skill can turn the Lore Bard's missed production attack into a hit and Undo restores damage/resource/economy",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  await adapter.startInitiative();
  snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  const targetId="combatant.goblin-a";
  await adapter.setCurrentActor(actorId);
  snapshot=await adapter.getSnapshot();
  const attack=snapshot.scene.actionsByActor[actorId]?.find((entry)=>entry.id==="action.shortbow");
  assert.ok(attack,JSON.stringify(snapshot.scene.actionsByActor[actorId]));
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===targetId)?.hp;
  const usesBefore=inspirationUses(snapshot);

  await adapter.setQueuedD20(4);
  await adapter.resolveAction(attack.id,[targetId]);
  for(let step=0;step<4;step++){
    snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.interrupt?.id===INTERRUPT_ID)break;
    await adapter.advanceResolution();
  }
  snapshot=await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));

  await adapter.setQueuedD20(6);
  await adapter.respondToInterrupt(true);
  snapshot=await finish(adapter);
  assert.equal(snapshot.resolution?.attackOutcome,"명중",JSON.stringify(snapshot.resolution));
  assert.equal(inspirationUses(snapshot),usesBefore!-1);
  assert.ok((snapshot.scene.entities.find((entry)=>entry.id===targetId)?.hp??0)<(hpBefore??0));
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("비할 데 없는 기술"))),true,JSON.stringify(snapshot.activity));

  snapshot=await adapter.undoLastResolution();
  assert.equal(inspirationUses(snapshot),usesBefore);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===targetId)?.hp,hpBefore);
  assert.equal(snapshot.scene.economyByActor[actorId]?.action,true);
});

test("Lore Bard below level 14 does not receive Peerless Skill follow-up",async()=>{
  const adapter=new MockAdapter();
  await prepareLoreBard(adapter,13);
  await adapter.startInitiative();
  let snapshot=await adapter.getSnapshot();
  const actorId=snapshot.activeCharacter.id;
  await adapter.setCurrentActor(actorId);
  snapshot=await adapter.getSnapshot();
  const check=abilityCheckAction(snapshot);
  assert.ok(check);
  await adapter.setQueuedD20(4);
  await adapter.resolveAction(check.id,[]);
  snapshot=await adapter.advanceResolution();
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!+4});
  assert.notEqual(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);
});
