import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/offlineRuntimeAdapters";
import type { ActionVm, CharacterSheet, SceneVm, SessionVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { WARLOCK_FIEND_SUBCLASS_ID } from "../../src/domain/srdSubclassCatalog";
import {
  FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID,
} from "../../src/domain/warlockFiend";
import { WARLOCK_ID } from "../../src/domain/warlockProgressionChoices";

const INTERRUPT_ID="follow-up.warlock.fiend.dark-ones-own-luck";
const SAVE_ACTION="action.test.fiend-luck-save";
const CASTER="char.test-fiend-luck-caster";
type Internal={activeCharacter:CharacterSheet;characters:CharacterSheet[];scene:SceneVm;session:SessionVm};

async function prepareFiend(adapter:MockAdapter,level=6){
  const internal=adapter as unknown as Internal;
  const fiend={
    ...structuredClone(internal.activeCharacter),
    name:"Fiend Warlock",
    className:"워락",
    subclassName:"악마 후원자",
    level,
    classLevels:[{classId:WARLOCK_ID,className:"워락",level}],
    subclassIds:{[WARLOCK_ID]:WARLOCK_FIEND_SUBCLASS_ID},
    abilities:{...internal.activeCharacter.abilities,cha:18},
    features:[],
    equipment:[],
    items:[],
    attacks:[],
    resources:[],
  };
  internal.activeCharacter=fiend;
  internal.session.role="host";
  return fiend;
}

function savingThrowAction(targetId:string):ActionVm{
  return {
    id:SAVE_ACTION,
    actorId:CASTER,
    name:"시험용 공포",
    category:"basic",
    target:"enemy",
    economy:"행동",
    resolutionKind:"saving-throw",
    summary:"지혜 내성 DC 10",
    available:true,
    eligibleTargetIds:[targetId],
    maxTargets:1,
    saveDc:10,
    saveAbility:"지혜",
    saveHalf:false,
    damage:[{type:"정신",dice:"1d6",flat:0,average:6}],
    details:[],
  };
}

async function installNpcSave(adapter:MockAdapter,targetId:string){
  await adapter.setReferenceRole("dm");
  const internal=adapter as unknown as Internal;
  const template=internal.scene.entities.find((entry)=>entry.id==="combatant.goblin-a")!;
  internal.scene.entities.push({...structuredClone(template),id:CASTER,name:"Enemy Caster",kind:"character",side:"enemy"});
  internal.scene.actionsByActor[CASTER]=[savingThrowAction(targetId)];
  internal.scene.economyByActor[CASTER]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  await adapter.startInitiative();
  await adapter.setCurrentActor(CASTER);
  await adapter.selectDmActor(CASTER);
}

test("Fiend level 6 failed ability check offers Dark One's Own Luck, spends one use, records Activity, and Undo restores it",async()=>{
  const adapter=new MockAdapter();
  const fiend=await prepareFiend(adapter);
  await adapter.startInitiative();
  await adapter.setCurrentActor(fiend.id);
  let snapshot=await adapter.getSnapshot();
  const beforeUses=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current;
  assert.equal(beforeUses,4);

  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.skill.athletics",[]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"effect-preview",JSON.stringify(snapshot.resolution));
  snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:15});
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));

  await adapter.setQueuedD20(8);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.checkOutcome,"성공");
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current,beforeUses!-1);
  assert.equal(snapshot.activity.some((entry)=>entry.detail.some((detail)=>detail.includes("어둠의 존재의 행운"))),true);

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current,beforeUses);
});

test("Fiend Dark One's Own Luck can turn the Warlock's failed saving throw into a success",async()=>{
  const adapter=new MockAdapter();
  const fiend=await prepareFiend(adapter);
  await installNpcSave(adapter,fiend.id);
  let snapshot=await adapter.getSnapshot();
  const beforeHp=snapshot.scene.entities.find((entry)=>entry.id===fiend.id)!.hp;
  const beforeUses=snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)!.current;

  await adapter.setQueuedD20(1);
  await adapter.resolveAction(SAVE_ACTION,[fiend.id]);
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.interrupt?.id,INTERRUPT_ID,JSON.stringify(snapshot.resolution));

  await adapter.setQueuedD20(10);
  snapshot=await adapter.respondToInterrupt(true);
  assert.equal(snapshot.resolution?.saveResults[0]?.outcome,"성공");
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current,beforeUses-1);

  await adapter.advanceResolution();
  snapshot=await adapter.advanceResolution();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id===fiend.id)?.hp,beforeHp);

  snapshot=await adapter.undoLastResolution();
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID)?.current,beforeUses);
});

test("Warlock below Fiend feature level does not receive Dark One's Own Luck",async()=>{
  const adapter=new MockAdapter();
  const fiend=await prepareFiend(adapter,5);
  await adapter.startInitiative();
  await adapter.setCurrentActor(fiend.id);
  await adapter.setQueuedD20(1);
  await adapter.resolveAction("action.skill.athletics",[]);
  await adapter.advanceResolution();
  const snapshot=await adapter.applyDmAdjudication({type:"ability-check-dc",scope:"resolution",value:15});
  assert.notEqual(snapshot.resolution?.interrupt?.id,INTERRUPT_ID);
  assert.equal(snapshot.activeCharacter.resources.some((entry)=>entry.id===FIEND_DARK_ONES_OWN_LUCK_RESOURCE_ID),false);
});
