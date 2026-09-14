import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import type { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** RULES_RUNTIME_SPECS.md §3 — class features on the table: resource pools, feature actions, attack riders. */
const P2={peerId:"peer.p2",role:"player" as const};
const tile=(runtime:TableRuntime,actorId:string,actionId:string)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.id===actionId);
const pool=(runtime:TableRuntime,id:string,resourceId:string)=>runtime.state.rules.combatants[id].resources.find((entry)=>entry.id===resourceId)?.current;
const base=(sheet:Partial<CharacterSheet>&{id:string;name:string;className:string;classId:string;level:number;hitDie:number;abilities:CharacterSheet["abilities"];proficiencyBonus:number}):CharacterSheet=>({
  subclassName:"",species:"인간",background:"",hp:sheet.level*sheet.hitDie,maxHp:sheet.level*sheet.hitDie,tempHp:0,ac:14,speed:30,saveState:"saved",saves:[],skills:[],features:[],equipment:[],items:[],resources:[],attacks:[],
  ...sheet,classLevels:[{classId:sheet.classId,className:sheet.className,level:sheet.level}],
} as unknown as CharacterSheet);
const rogue=()=>base({id:"char.lily",name:"릴리",className:"로그",classId:"dnd.srd521.class.rogue",level:5,hitDie:8,abilities:{str:10,dex:16,con:12,int:12,wis:10,cha:14},proficiencyBonus:3,skills:["은신 +6"],
  items:[{id:"item.dagger",definitionId:"dnd.srd521.item.weapon.dagger",name:"단검",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.dagger"],provenance:[]} as never],
  attacks:[{id:"action.dagger",name:"단검",bonus:6,damage:"1d4 + 3 관통"}]});
const monk=()=>base({id:"char.jin",name:"진",className:"몽크",classId:"dnd.srd521.class.monk",level:5,hitDie:8,abilities:{str:10,dex:16,con:14,int:10,wis:14,cha:8},proficiencyBonus:3});
const barbarian=()=>base({id:"char.grok",name:"그록",className:"바바리안",classId:"dnd.srd521.class.barbarian",level:3,hitDie:12,abilities:{str:16,dex:12,con:14,int:8,wis:10,cha:8},proficiencyBonus:2,
  items:[{id:"item.greataxe",definitionId:"dnd.srd521.item.weapon.greataxe",name:"대형 도끼",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"two-hand",passiveEffects:[],grantedActionIds:["action.greataxe"],provenance:[]} as never],
  attacks:[{id:"action.greataxe",name:"대형 도끼",bonus:5,damage:"1d12 + 3 참격"}]});
const paladin=()=>base({id:"char.aria",name:"아리아",className:"팔라딘",classId:"dnd.srd521.class.paladin",level:3,hitDie:10,abilities:{str:16,dex:10,con:14,int:8,wis:10,cha:16},proficiencyBonus:2});
const warlock=()=>({...base({id:"char.vex",name:"벡스",className:"워락",classId:"dnd.srd521.class.warlock",level:3,hitDie:8,abilities:{str:8,dex:14,con:14,int:10,wis:10,cha:16},proficiencyBonus:2}),preparedSpells:["dnd.srd521.spell.cure-wounds"]} as unknown as CharacterSheet);

test("§3 Sneak Attack rides a finesse attack only when an ally is engaged with the target (or advantage is granted)", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:rogue(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",lily="char.lily",gob=`${GOBLIN}.instance-1`;
  // 아군이 교전 중이지 않다: 단검 15 + 6 = 21 명중, 2 + 3 = 5
  dice.push(15,15,2,2);
  const plain=runtime.dispatch({type:"act",actorId:lily,actionId:"action.dagger",targetIds:[gob]},P2);
  assert.equal(plain.status,"committed",JSON.stringify(plain));
  assert.equal(hp(runtime,gob),5);
  assert.ok(!plain.resolution?.stateChanges.some((line)=>line.includes("암습")),JSON.stringify(plain.resolution?.stateChanges));
  // 카엘이 고블린과 교전 (빗나감이어도 교전) → 암습 3d6 (4+5+6)
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(runtime.state.engagements.length,2,"lily's own melee attack engaged her too; kael's is the ally engagement");
  dice.push(15,15,2,2,4,5,6,1,1,1);
  const sneak=runtime.dispatch({type:"act",actorId:lily,actionId:"action.dagger",targetIds:[gob]},P2);
  assert.equal(sneak.status,"committed",JSON.stringify(sneak));
  assert.ok(sneak.resolution?.stateChanges.includes("릴리 암습 적용"),JSON.stringify(sneak.resolution?.stateChanges));
  assert.equal(runtime.state.rules.combatants[gob].life.dead,true,"5 + 15 sneak attack damage kills the goblin");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Monk: Martial Arts uses DEX and the die; the bonus strike needs a monk attack first; Flurry of Blows spends Focus; Patient Defense with Focus dodges and disengages", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:monk(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN,count:2}]});
  const jin="char.jin",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  assert.equal(pool(runtime,jin,"resource:monk.focus-points"),5);
  assert.equal(tile(runtime,jin,"action.unarmed-strike.damage")?.summary,"+6 · 무예 1d8 +3");
  dice.push(20,5,5);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,jin);
  const early=runtime.dispatch({type:"act",actorId:jin,actionId:"action.martial-arts.strike",targetIds:[gob1]},P1);
  assert.equal(early.status==="refused"&&early.refusal.message,"먼저 공격 행동으로 맨손 타격이나 몽크 무기를 쓰세요.");
  dice.push(15,15,6,6);
  assert.equal(runtime.dispatch({type:"act",actorId:jin,actionId:"action.unarmed-strike.damage",targetIds:[gob1]},P1).status,"committed");
  assert.equal(hp(runtime,gob1),1,"1d8 6 + 3 = 9");
  dice.push(15,15,2,2);
  const bonus=runtime.dispatch({type:"act",actorId:jin,actionId:"action.martial-arts.strike",targetIds:[gob1]},P1);
  assert.equal(bonus.status,"committed",JSON.stringify(bonus));
  assert.equal(runtime.state.rules.combatants[gob1].life.dead,true);
  assert.equal(runtime.state.rules.combatants[jin].economy.bonusAction,false);
  // 다음 라운드: 질풍 연타 (기 1, 맨손 타격 2회)
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,jin);
  dice.push(15,15,3,3);
  const flurry=runtime.dispatch({type:"act",actorId:jin,actionId:"action.flurry-of-blows",targetIds:[gob2]},P1);
  assert.equal(flurry.status,"committed",JSON.stringify(flurry));
  assert.equal(pool(runtime,jin,"resource:monk.focus-points"),4);
  assert.equal(hp(runtime,gob2),4,"3 + 3 = 6");
  // 다음 라운드: 인내의 방어 (기 1) → 회피 + 이탈
  runtime.dispatch({type:"end-turn"},P1);
  runtime.dispatch({type:"end-turn"});
  const defend=runtime.dispatch({type:"act",actorId:jin,actionId:"action.patient-defense.focus",targetIds:[jin]},P1);
  assert.equal(defend.status,"committed",JSON.stringify(defend));
  assert.equal(pool(runtime,jin,"resource:monk.focus-points"),3);
  const labels=runtime.state.rules.effects.filter((effect)=>effect.targetId===jin).map((effect)=>effect.metadata?.publicLabel);
  assert.ok(labels.includes("회피")&&labels.includes("이탈"),JSON.stringify(labels));
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Barbarian: Rage adds damage to Strength melee attacks and halves bludgeoning/piercing/slashing damage until it ends", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:barbarian(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const grok="char.grok",gob=`${GOBLIN}.instance-1`;
  assert.equal(pool(runtime,grok,"resource:barbarian.rage"),3);
  const rage=runtime.dispatch({type:"act",actorId:grok,actionId:"action.rage",targetIds:[grok]},P1);
  assert.equal(rage.status,"committed",JSON.stringify(rage));
  assert.equal(pool(runtime,grok,"resource:barbarian.rage"),2);
  const again=runtime.dispatch({type:"act",actorId:grok,actionId:"action.rage",targetIds:[grok]},P1);
  assert.equal(again.status==="refused"&&again.refusal.message,"이미 격노 중입니다.");
  dice.push(15,15,7,7);
  const swing=runtime.dispatch({type:"act",actorId:grok,actionId:"action.greataxe",targetIds:[gob]},P1);
  assert.equal(swing.status,"committed",JSON.stringify(swing));
  assert.ok(swing.resolution?.stateChanges.includes("그록 격노 적용"),JSON.stringify(swing.resolution?.stateChanges));
  assert.equal(runtime.state.rules.combatants[gob].life.dead,true,"7 + 3 + 2 = 12 ≥ 10");
  const before=hp(runtime,grok);
  runtime.dispatch({type:"ruling",targetIds:[grok],ruling:{kind:"damage",amount:10,damageType:"slashing"}});
  assert.equal(hp(runtime,grok),before-5,"resistance halves slashing damage");
  assert.equal(runtime.dispatch({type:"act",actorId:grok,actionId:"action.rage-end",targetIds:[grok]},P1).status,"committed");
  runtime.dispatch({type:"ruling",targetIds:[grok],ruling:{kind:"damage",amount:10,damageType:"slashing"}});
  assert.equal(hp(runtime,grok),before-15);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Paladin: Lay on Hands heals the amount the player names from the pool and cures Poisoned for 5", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:paladin(),controllerPeer:P2.peerId}]});
  const kael="char.kael",aria="char.aria";
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"damage",amount:20}});
  assert.equal(pool(runtime,aria,"resource:paladin.lay-on-hands"),15);
  const noAmount=runtime.dispatch({type:"act",actorId:aria,actionId:"action.lay-on-hands",targetIds:[kael]},P2);
  assert.equal(noAmount.status==="refused"&&noAmount.refusal.code,"amount-required");
  const heal=runtime.dispatch({type:"act",actorId:aria,actionId:"action.lay-on-hands",targetIds:[kael],amount:7},P2);
  assert.equal(heal.status,"committed",JSON.stringify(heal));
  assert.equal(hp(runtime,kael),18);
  assert.equal(pool(runtime,aria,"resource:paladin.lay-on-hands"),8);
  const tooMuch=runtime.dispatch({type:"act",actorId:aria,actionId:"action.lay-on-hands",targetIds:[kael],amount:9},P2);
  assert.equal(tooMuch.status==="refused"&&tooMuch.refusal.message,"안수 풀이 8밖에 남지 않았습니다.");
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"condition",conditionId:"poisoned",on:true}});
  const cure=runtime.dispatch({type:"act",actorId:aria,actionId:"action.lay-on-hands.cure",targetIds:[kael]},P2);
  assert.equal(cure.status,"committed",JSON.stringify(cure));
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.conditionId==="poisoned"));
  assert.equal(pool(runtime,aria,"resource:paladin.lay-on-hands"),3);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Warlock: Pact Magic slots are one level, cast lower spells at that level, and come back on a short rest", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:warlock(),controllerPeer:P2.peerId}]});
  const kael="char.kael",vex="char.vex";
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"damage",amount:20}});
  const slots=runtime.state.rules.combatants[vex].resources.filter((entry)=>entry.id.startsWith("spell-slot-"));
  assert.deepEqual(slots.map((entry)=>[entry.id,entry.current,entry.recovery?.shortRest]),[["spell-slot-2",2,"all"]]);
  dice.push(1,1,1,1);
  const cast=runtime.dispatch({type:"act",actorId:vex,actionId:"spell.dnd.srd521.spell.cure-wounds",targetIds:[kael]},P2);
  assert.equal(cast.status,"committed",JSON.stringify(cast));
  assert.ok(hp(runtime,kael)>11);
  assert.equal(pool(runtime,vex,"spell-slot-2"),1,"a 1st-level spell cast with the pact slot");
  assert.equal(runtime.dispatch({type:"rest",kind:"short",actorIds:[vex],hitDice:{[vex]:0}}).status,"committed");
  assert.equal(runtime.dispatch({type:"rest-complete"}).status,"committed");
  assert.equal(pool(runtime,vex,"spell-slot-2"),2,"Pact Magic recovers on a short rest");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Fighter: Action Surge grants one more action this turn and spends its use; Second Wind keeps the sheet's pool", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  assert.equal(pool(runtime,kael,"resource:fighter.action-surge"),1);
  assert.equal(pool(runtime,kael,"resource.second-wind"),1,"the legacy sheet pool is kept");
  dice.push(15,10,5);
  runtime.dispatch({type:"start-initiative"});
  dice.push(1,1,2,2);
  runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(runtime.state.rules.combatants[kael].economy.action,false);
  const surge=runtime.dispatch({type:"act",actorId:kael,actionId:"action.action-surge",targetIds:[kael]},P1);
  assert.equal(surge.status,"committed",JSON.stringify(surge));
  assert.equal(runtime.state.rules.combatants[kael].economy.extraActions?.length,1,"an extra action is granted");
  assert.equal(pool(runtime,kael,"resource:fighter.action-surge"),0);
  dice.push(19,19,5,5);
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1).status,"committed");
  assert.equal(hp(runtime,gob),1);
  const spent=runtime.dispatch({type:"act",actorId:kael,actionId:"action.action-surge",targetIds:[kael]},P1);
  assert.equal(spent.status,"refused");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Druid: Wild Shape into a wolf takes the form's AC and bite, grants temp HP equal to the level, and ends on demand", () => {
  const {runtime,dice}=table([]);
  const druid=base({id:"char.oak",name:"오크",className:"드루이드",classId:"dnd.srd521.class.druid",level:4,hitDie:8,abilities:{str:10,dex:14,con:14,int:12,wis:16,cha:10},proficiencyBonus:2});
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:druid,controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const oak="char.oak",gob=`${GOBLIN}.instance-1`;
  assert.equal(pool(runtime,oak,"resource:druid.wild-shape"),2);
  assert.equal(runtime.dispatch({type:"act",actorId:oak,actionId:"action.wild-shape",targetIds:[oak]},P1).status,"refused","a form is required");
  const shaped=runtime.dispatch({type:"act",actorId:oak,actionId:"action.wild-shape",targetIds:[oak],formId:"dnd.srd521.monster.wolf"},P1);
  assert.equal(shaped.status,"committed",JSON.stringify(shaped));
  assert.equal(pool(runtime,oak,"resource:druid.wild-shape"),1);
  assert.equal(runtime.state.rules.combatants[oak].life.hp.temporary,4);
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===oak)?.ac,10,"the wolf's AC");
  assert.ok(shaped.resolution?.detail.some((line)=>/이동 .*40피트/.test(line)),JSON.stringify(shaped.resolution?.detail));
  // the form's speed applies from the druid's next turn
  dice.push(12,8);
  runtime.dispatch({type:"start-initiative"});
  for(let index=0;index<2;index+=1) runtime.dispatch({type:"end-turn"});
  assert.equal(runtime.state.currentActorId,oak);
  assert.equal(runtime.state.rules.combatants[oak].economy.movement,40,"the wolf's 40 feet, not the druid's 30");
  runtime.dispatch({type:"end-initiative"});
  const bite=tile(runtime,oak,"wild.0-bite")!;
  assert.match(bite.name,/늑대 · 물기/);
  dice.push(15,15,3,3);
  const bitten=runtime.dispatch({type:"act",actorId:oak,actionId:bite.id,targetIds:[gob]},P1);
  assert.equal(bitten.status,"committed",JSON.stringify(bitten));
  assert.equal(hp(runtime,gob),10-5,"1d6 3 + 2");
  assert.equal(runtime.dispatch({type:"act",actorId:oak,actionId:"action.wild-shape",targetIds:[oak],formId:"dnd.srd521.monster.brown-bear"},P1).status,"refused","CR 1 is beyond level 4");
  assert.equal(runtime.dispatch({type:"act",actorId:oak,actionId:"action.wild-shape-end",targetIds:[oak]},P1).status,"committed");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===oak)?.ac,14);
  assert.equal(tile(runtime,oak,"wild.0-bite"),undefined);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});

test("§3 Paladin: Divine Smite is cast as a bonus action and rides the next weapon hit as radiant damage, then is spent", () => {
  const {runtime,dice}=table([]);
  const aria={...paladin(),items:[{id:"item.longsword",definitionId:"dnd.srd521.item.weapon.longsword",name:"롱소드",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.longsword"],provenance:[]}],attacks:[{id:"action.longsword",name:"롱소드",bonus:5,damage:"1d8 + 3 참격"}],preparedSpells:["dnd.srd521.spell.divine-smite"]} as unknown as CharacterSheet;
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:aria,controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const id="char.aria",gob=`${GOBLIN}.instance-1`;
  const slots=pool(runtime,id,"spell-slot-1");
  assert.ok(slots&&slots>0,"a 3rd-level paladin has 1st-level slots");
  const cast=runtime.dispatch({type:"act",actorId:id,actionId:"spell.dnd.srd521.spell.divine-smite",targetIds:[id]},P1);
  assert.equal(cast.status,"committed",JSON.stringify(cast));
  assert.equal(pool(runtime,id,"spell-slot-1"),slots-1);
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===id&&effect.metadata?.attackDamageType==="radiant"));
  dice.push(15,15,3,3);
  const hit=runtime.dispatch({type:"act",actorId:id,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(hit.status,"committed",JSON.stringify(hit));
  const types=hit.resolution?.damageComponents.map((component)=>component.type)??[];
  assert.ok(types.includes("radiant"),types.join(","));
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===id&&effect.metadata?.attackDamageType==="radiant"),"spent on the hit");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
