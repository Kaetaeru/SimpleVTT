import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, hp, table } from "./fixtures";

/** Weapon Mastery (2024 PHB / SRD 5.2.1, §22.7): Graze, Vex, Sap, Slow, Topple, Push on the table. Cleave and Nick are not automated. */
type Weapon={id:string;definitionId:string;name:string;damage:string};
const WEAPONS:Record<string,Weapon>={
  greatsword:{id:"item.greatsword",definitionId:"dnd.srd521.item.weapon.greatsword",name:"그레이트소드",damage:"2d6 + 4 참격"},
  rapier:{id:"item.rapier",definitionId:"dnd.srd521.item.weapon.rapier",name:"레이피어",damage:"1d8 + 4 관통"},
  longsword:{id:"item.longsword",definitionId:"dnd.srd521.item.weapon.longsword",name:"롱소드",damage:"1d8 + 4 참격"},
  javelin:{id:"item.javelin",definitionId:"dnd.srd521.item.weapon.javelin",name:"재블린",damage:"1d6 + 4 관통"},
  maul:{id:"item.maul",definitionId:"dnd.srd521.item.weapon.maul",name:"마울",damage:"2d6 + 4 타격"},
  warhammer:{id:"item.warhammer",definitionId:"dnd.srd521.item.weapon.warhammer",name:"워해머",damage:"1d8 + 4 타격"},
};
/** 카엘의 사촌 브렌: 5레벨 전사, 근력 18 · 민첩 14 · 숙련 +3, 무기 하나를 들고 그 무기의 숙련을 안다. */
function master(weapon:Weapon,mastered=true):CharacterSheet {
  return {
    id:"char.bren",name:"브렌",className:"전사",subclassName:"챔피언",level:5,classLevels:[{classId:"dnd.srd521.class.fighter",className:"전사",level:5}],species:"인간",background:"군인",
    hp:44,maxHp:44,tempHp:0,ac:18,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:18,dex:14,con:16,int:10,wis:12,cha:8},saves:["근력 +7","건강 +6"],skills:["운동 +7"],features:[],equipment:[],
    items:[{id:weapon.id,definitionId:weapon.definitionId,name:weapon.name,kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:[`action.${weapon.id.slice(5)}`],provenance:[]}],
    resources:[],attacks:[{id:`action.${weapon.id.slice(5)}`,name:weapon.name,bonus:7,damage:weapon.damage}],
    weaponMasteryIds:mastered?[weapon.definitionId]:[],
  } as unknown as CharacterSheet;
}
const setup=(weapon:Weapon,goblins=1,mastered=true)=>{
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:master(weapon,mastered),controllerPeer:P1.peerId},...Array.from({length:goblins},()=>({kind:"monster" as const,monsterId:GOBLIN}))]});
  return {runtime,dice,bren:"char.bren",gob:`${GOBLIN}.instance-1`,gob2:`${GOBLIN}.instance-2`,actionId:`action.${weapon.id.slice(5)}`};
};

test("Graze: a greatsword miss still deals the Strength modifier; without the mastery it deals nothing", () => {
  const {runtime,dice,bren,gob,actionId}=setup(WEAPONS.greatsword);
  dice.push(3,3,1,1,1,1); // 3 + 7 = 10 vs AC 15 → 빗나감 · 2d6 얼굴 4개
  const miss=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(miss.status,"committed",JSON.stringify(miss));
  assert.equal(miss.resolution?.attackOutcome,"빗나감");
  assert.equal(hp(runtime,gob),6,"4 (STR) on a miss");
  assert.ok(miss.resolution?.stateChanges.some((line)=>/훑기/.test(line)),JSON.stringify(miss.resolution?.stateChanges));
  assert.equal(dice.remaining(),0);
  const plain=setup(WEAPONS.greatsword,1,false);
  plain.dice.push(3,3,1,1,1,1);
  plain.runtime.dispatch({type:"act",actorId:plain.bren,actionId:plain.actionId,targetIds:[plain.gob]},P1);
  assert.equal(hp(plain.runtime,plain.gob),10,"no mastery, no graze");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
});

test("Vex: a rapier hit grants advantage on the next attack against that creature only", () => {
  const {runtime,dice,bren,gob,gob2,actionId}=setup(WEAPONS.rapier,2);
  dice.push(15,15,3,3);
  const hitOne=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(hitOne.status,"committed",JSON.stringify(hitOne));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===bren&&effect.metadata?.vexTargetId===gob),"vex grant recorded");
  dice.push(10,10,3,3); // 다른 고블린: 유리 없음, 그랜트는 남는다
  const other=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob2]},P1);
  assert.equal(other.status,"committed");
  assert.doesNotMatch(other.resolution?.detail[0]??"",/유리/);
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===bren&&effect.metadata?.vexTargetId===gob),"still held");
  dice.push(2,18,3,3); // 표식된 고블린: 유리 → 18
  const again=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(again.status,"committed");
  assert.match(again.resolution?.detail[0]??"",/유리/);
  assert.equal(again.resolution?.attackOutcome,"명중");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("Sap: a longsword hit gives the goblin disadvantage on its next attack roll", () => {
  const {runtime,dice,bren,gob,actionId}=setup(WEAPONS.longsword);
  dice.push(15,15,3,3);
  assert.equal(runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1).status,"committed");
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===gob&&effect.metadata?.d20RollState==="disadvantage"),"sap on the goblin");
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  dice.push(18,4,2,2); // 불리 → 4
  const swing=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[bren]});
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.match(swing.resolution?.detail[0]??"",/불리/);
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===gob&&effect.metadata?.d20RollState==="disadvantage"),"spent");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("Slow: a javelin hit in initiative marks the goblin and takes 10 feet off its movement", () => {
  const {runtime,dice,bren,gob,actionId}=setup(WEAPONS.javelin);
  dice.push(20,1);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,bren);
  dice.push(15,15,3,3);
  const hit=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===gob&&/둔화/.test(String(effect.metadata?.publicLabel))));
  assert.equal(runtime.state.rules.combatants[gob].economy.movementMaximum,20);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("Topple: a maul hit forces a Constitution save (DC 8 + prof + STR) or the goblin falls prone", () => {
  const {runtime,dice,bren,gob,actionId}=setup(WEAPONS.maul);
  dice.push(15,15,1,1,1,1, 2,2); // 명중 · 2d6 (얼굴 4개) · 고블린 건강 내성 2 vs DC 15 → 실패
  const hit=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  assert.ok(hit.resolution?.stateChanges.some((line)=>/넘어뜨림.*DC 15.*실패/.test(line)),JSON.stringify(hit.resolution?.stateChanges));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===gob&&effect.conditionId==="prone"));
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("Push: a warhammer hit shoves the goblin 10 feet away, ending the engagement it had with 브렌", () => {
  const {runtime,dice,bren,gob,actionId}=setup(WEAPONS.warhammer);
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  dice.push(2,2,2,2);
  runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[bren]});
  assert.equal(runtime.state.engagements.length,1,"the goblin's swing engaged them");
  dice.push(15,15,3,3);
  const hit=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  assert.ok(hit.resolution?.stateChanges.some((line)=>/밀치기/.test(line)));
  assert.equal(runtime.state.engagements.length,0,"pushed out of reach");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

/** Cleave and Nick (2024): two more masteries that open tiles instead of riding on the hit. */
const CLEAVE_NICK:Record<string,Weapon>={
  greataxe:{id:"item.greataxe",definitionId:"dnd.srd521.item.weapon.greataxe",name:"그레이트액스",damage:"1d12 + 4 참격"},
  scimitar:{id:"item.scimitar",definitionId:"dnd.srd521.item.weapon.scimitar",name:"시미터",damage:"1d6 + 4 참격"},
  dagger:{id:"item.dagger",definitionId:"dnd.srd521.item.weapon.dagger",name:"단검",damage:"1d4 + 4 관통"},
};

test("Cleave: after a greataxe hit in initiative one free swing at a different creature, without the ability modifier, once per turn", () => {
  const {runtime,dice,bren,gob,gob2,actionId}=setup(CLEAVE_NICK.greataxe,2);
  dice.push(15,10,9);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,bren);
  const cleaveId=`${actionId}.cleave`;
  const tiles=()=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[bren];
  assert.ok(tiles().some((action)=>action.id===cleaveId),"the tile exists for a mastered heavy weapon");
  const early=runtime.dispatch({type:"act",actorId:bren,actionId:cleaveId,targetIds:[gob2]},P1);
  assert.equal(early.status==="refused"&&early.refusal.message,"먼저 이 무거운 무기로 명중하세요.");
  dice.push(15,15,3,3); // 15 + 7 = 22 vs AC 15 명중 · 1d12 3 + 4 = 7
  const hit=runtime.dispatch({type:"act",actorId:bren,actionId,targetIds:[gob]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  assert.equal(hp(runtime,gob),3);
  assert.ok(hit.resolution?.stateChanges.some((line)=>/베어가르기/.test(line)),JSON.stringify(hit.resolution?.stateChanges));
  const same=runtime.dispatch({type:"act",actorId:bren,actionId:cleaveId,targetIds:[gob]},P1);
  assert.equal(same.status==="refused"&&same.refusal.code,"cleave-same-target");
  dice.push(12,12,5,5); // 12 + 7 = 19 명중 · 1d12 5, 능력 수정치 없음
  const cleave=runtime.dispatch({type:"act",actorId:bren,actionId:cleaveId,targetIds:[gob2]},P1);
  assert.equal(cleave.status,"committed",JSON.stringify(cleave));
  assert.equal(hp(runtime,gob2),5,"1d12 only");
  assert.equal(runtime.state.rules.combatants[bren].economy.bonusAction,true,"cleave costs nothing");
  const again=runtime.dispatch({type:"act",actorId:bren,actionId:cleaveId,targetIds:[gob2]},P1);
  assert.equal(again.status==="refused"&&again.refusal.message,"베어가르기는 턴마다 한 번입니다.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("Nick: the Light extra attack with a mastered scimitar is part of the Attack action, keeps the bonus action, once per turn", () => {
  const {runtime,dice}=table([]);
  const sheet=master(CLEAVE_NICK.scimitar);
  const dagger=CLEAVE_NICK.dagger;
  sheet.items.push({id:dagger.id,definitionId:dagger.definitionId,name:dagger.name,kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.dagger"],provenance:[]} as unknown as CharacterSheet["items"][number]);
  sheet.items[0].wieldSlot="off-hand";
  sheet.attacks.push({id:"action.dagger",name:dagger.name,bonus:7,damage:dagger.damage} as unknown as CharacterSheet["attacks"][number]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet,controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const bren="char.bren",gob=`${GOBLIN}.instance-1`;
  dice.push(15,10);
  runtime.dispatch({type:"start-initiative"});
  const tiles=()=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[bren];
  assert.ok(tiles().some((action)=>action.id==="action.scimitar.nick"),"the mastered scimitar's extra attack is a Nick tile");
  assert.ok(!tiles().some((action)=>action.id==="action.scimitar.offhand"),"and replaces the bonus-action tile");
  assert.ok(tiles().some((action)=>action.id==="action.dagger.offhand"),"the unmastered dagger keeps the bonus-action tile");
  const early=runtime.dispatch({type:"act",actorId:bren,actionId:"action.scimitar.nick",targetIds:[gob]},P1);
  assert.equal(early.status==="refused"&&early.refusal.message,"먼저 공격 행동으로 다른 가벼운 무기를 휘두르세요.");
  dice.push(15,15,2,2); // 단검 명중 · 1d4 2 + 4 = 6
  assert.equal(runtime.dispatch({type:"act",actorId:bren,actionId:"action.dagger",targetIds:[gob]},P1).status,"committed");
  assert.equal(hp(runtime,gob),4);
  dice.push(15,15,3,3); // 시미터 명중 · 1d6 3, 능력 수정치 없음
  const nick=runtime.dispatch({type:"act",actorId:bren,actionId:"action.scimitar.nick",targetIds:[gob]},P1);
  assert.equal(nick.status,"committed",JSON.stringify(nick));
  assert.equal(hp(runtime,gob),1,"1d6 only");
  assert.equal(runtime.state.rules.combatants[bren].economy.bonusAction,true,"the bonus action is still free");
  const again=runtime.dispatch({type:"act",actorId:bren,actionId:"action.scimitar.nick",targetIds:[gob]},P1);
  assert.equal(again.status==="refused"&&again.refusal.message,"찌르기의 추가 공격은 턴마다 한 번입니다.");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
