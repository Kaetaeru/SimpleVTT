import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { ActionVm, AppSnapshot, CharacterSheet, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { BARDIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/bardicInspiration";
import { BARD_COLLEGE_LORE_SUBCLASS_ID } from "../../src/domain/bardCollegeLore";
import { BARD_LORE_CLASS_ID } from "../../src/domain/bardLoreProgression";

const INTERRUPT_ID="follow-up.bard.college-of-lore.cutting-words";
const GOBLIN_ID="combatant.goblin-a";

async function prepareLoreBard(adapter:MockAdapter,level=5){
  const internal=adapter as unknown as {activeCharacter:CharacterSheet};
  internal.activeCharacter={
    ...internal.activeCharacter,
    className:"바드",
    subclassName:"전승 학파",
    level,
    hp:30,
    maxHp:30,
    tempHp:0,
    ac:15,
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

async function beginGoblinTurn(adapter:MockAdapter){
  await adapter.startInitiative();
  await adapter.setCurrentActor(GOBLIN_ID);
  return adapter.getSnapshot();
}

async function waitForInterrupt(adapter:MockAdapter,maximum=6){
  for(let step=0;step<maximum;step++){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.interrupt?.id===INTERRUPT_ID)return snapshot;
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  return adapter.getSnapshot();
}

async function finish(adapter:MockAdapter){
  for(let step=0;step<8;step++){
    const snapshot=await adapter.getSnapshot();
    if(snapshot.resolution?.stage==="complete")return snapshot;
    await adapter.advanceResolution();
  }
  throw new Error("resolution did not complete");
}

function goblinCheckAction():ActionVm{
  return {
    id:"action.goblin.cutting-words-check",
    actorId:GOBLIN_ID,
    name:"고블린 운동 판정",
    category:"basic",
    target:"none",
    economy:"없음",
    resolutionKind:"ability-check",
    summary:"근력(운동) +4",
    available:true,
    eligibleTargetIds:[],
    checkBonus:4,
    details:[{label:"판정",value:"근력(운동)"}],
  };
}

test("Cutting Words reduces another creature's successful ability check and Undo restores Inspiration/Reaction",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  const usesBefore=inspirationUses(snapshot);
  snapshot=await beginGoblinTurn(adapter);
  const internal=adapter as unknown as {scene:SceneVm};
  internal.scene.actionsByActor[GOBLIN_ID]=[
    ...(internal.scene.actionsByActor[GOBLIN_ID]??[]),
    goblinCheckAction(),
  ];

  await adapter.setQueuedD20(15);
  await adapter.resolveAction("action.goblin.cutting-words-check",[]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  const total=snapshot.resolution?.rollTotal;
  assert.equal(typeof total,"number");
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:total!-2});
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));

  await adapter.setQueuedD20(6);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.checkOutcome,"실패",JSON.stringify(snapshot.resolution));
  assert.equal(inspirationUses(snapshot),usesBefore!-1);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.reaction,false);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("도발의 말"))),true);

  snapshot=await adapter.undoLastResolution();
  assert.equal(inspirationUses(snapshot),usesBefore);
  assert.equal(snapshot.scene.economyByActor[snapshot.activeCharacter.id]?.reaction,true);
});

test("Cutting Words can turn another creature's successful attack into a miss and Undo restores its cost",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  const usesBefore=inspirationUses(snapshot);
  snapshot=await beginGoblinTurn(adapter);
  const bardId=snapshot.activeCharacter.id;
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===bardId)?.hp;

  await adapter.setQueuedD20(18);
  await adapter.resolveAction("action.scimitar",[bardId]);
  snapshot=await waitForInterrupt(adapter);
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));

  await adapter.setQueuedD20(8);
  await adapter.respondToInterrupt(true);
  snapshot=await finish(adapter);
  assert.equal(snapshot.resolution?.attackOutcome,"빗나감",JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===bardId)?.hp,hpBefore);
  assert.equal(inspirationUses(snapshot),usesBefore!-1);
  assert.equal(snapshot.scene.economyByActor[bardId]?.reaction,false);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("도발의 말"))),true);

  snapshot=await adapter.undoLastResolution();
  assert.equal(inspirationUses(snapshot),usesBefore);
  assert.equal(snapshot.scene.economyByActor[bardId]?.reaction,true);
});

test("Cutting Words reduces the staged damage roll before authoritative attack commit and Undo restores HP/cost",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter);
  const usesBefore=inspirationUses(snapshot);
  snapshot=await beginGoblinTurn(adapter);
  const bardId=snapshot.activeCharacter.id;
  const hpBefore=snapshot.scene.entities.find((entry)=>entry.id===bardId)?.hp??0;

  await adapter.setQueuedD20(18);
  await adapter.resolveAction("action.scimitar",[bardId]);
  snapshot=await waitForInterrupt(adapter);
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));
  snapshot=await adapter.respondToInterrupt(false);
  assert.equal(snapshot.resolution?.stage,"attack-result",JSON.stringify(snapshot.resolution));

  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));
  assert.equal(snapshot.resolution?.rollKind,"damage");
  await adapter.setQueuedD20(4);
  snapshot=await adapter.respondToInterrupt(true);
  snapshot=await finish(adapter);

  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===bardId)?.hp,hpBefore-1,JSON.stringify(snapshot.resolution));
  assert.equal(inspirationUses(snapshot),usesBefore!-1);
  assert.equal(snapshot.scene.economyByActor[bardId]?.reaction,false);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("도발의 말"))),true);

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===bardId)?.hp,hpBefore);
  assert.equal(inspirationUses(snapshot),usesBefore);
  assert.equal(snapshot.scene.economyByActor[bardId]?.reaction,true);
});

test("Cutting Words is not offered below College of Lore level 3",async()=>{
  const adapter=new MockAdapter();
  let snapshot=await prepareLoreBard(adapter,2);
  snapshot=await beginGoblinTurn(adapter);
  const bardId=snapshot.activeCharacter.id;
  await adapter.setQueuedD20(18);
  await adapter.resolveAction("action.scimitar",[bardId]);
  for(let step=0;step<3;step++){
    snapshot=await adapter.getSnapshot();
    assert.notEqual(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);
    if(snapshot.resolution?.stage==="complete")break;
    await adapter.advanceResolution();
  }
});
