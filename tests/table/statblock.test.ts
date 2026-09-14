import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterSheet } from "../../src/app/contracts";
import { parseDiceNotation } from "../../src/table/dice";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import type { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, fighter, hp, table } from "./fixtures";

/** RULES_RUNTIME_SPECS.md §2/§3 follow-ups (§22.7, §22.9, §22.14): stat-block counters, sight, effect riders, save rerolls. */
const WYRMLING="dnd.srd521.monster.black-dragon-wyrmling"; // 산성 브레스: 민첩 내성 DC 11 · 5d8 · 재충전 5–6
const WHITE_DRAGON="dnd.srd521.monster.adult-white-dragon"; // 전설 행동 3 · 급습 = 찢기 공격 한 번
const P2={peerId:"peer.p2",role:"player" as const};
const tile=(runtime:TableRuntime,actorId:string,actionId:string)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.id===actionId);
const byName=(runtime:TableRuntime,actorId:string,pattern:RegExp)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>pattern.test(action.name))!;
const pool=(runtime:TableRuntime,id:string,resourceId:string)=>runtime.state.rules.combatants[id].resources.find((entry)=>entry.id===resourceId)?.current;
const base=(sheet:Partial<CharacterSheet>&{id:string;name:string;className:string;classId:string;level:number;hitDie:number;abilities:CharacterSheet["abilities"];proficiencyBonus:number}):CharacterSheet=>({
  subclassName:"",species:"인간",background:"",hp:sheet.level*sheet.hitDie,maxHp:sheet.level*sheet.hitDie,tempHp:0,ac:14,speed:30,saveState:"saved",saves:[],skills:[],features:[],equipment:[],items:[],resources:[],attacks:[],
  ...sheet,classLevels:[{classId:sheet.classId,className:sheet.className,level:sheet.level}],
} as unknown as CharacterSheet);
const longsword={id:"item.longsword",definitionId:"dnd.srd521.item.weapon.longsword",name:"롱소드",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.longsword"],provenance:[]};
const fighter9=()=>base({id:"char.bram",name:"브람",className:"전사",classId:"dnd.srd521.class.fighter",level:9,hitDie:10,abilities:{str:18,dex:10,con:16,int:10,wis:10,cha:8},proficiencyBonus:4,items:[longsword],attacks:[{id:"action.longsword",name:"롱소드",bonus:8,damage:"1d8 + 4 참격"}]} as Partial<CharacterSheet>&Parameters<typeof base>[0]);
const ranger=()=>({...base({id:"char.ash",name:"애쉬",className:"레인저",classId:"dnd.srd521.class.ranger",level:3,hitDie:10,abilities:{str:14,dex:16,con:12,int:10,wis:14,cha:8},proficiencyBonus:2,items:[longsword],attacks:[{id:"action.longsword",name:"롱소드",bonus:4,damage:"1d8 + 2 참격"}]} as Partial<CharacterSheet>&Parameters<typeof base>[0]),preparedSpells:["dnd.srd521.spell.hunter-s-mark"]} as unknown as CharacterSheet);
const bard=()=>base({id:"char.lio",name:"리오",className:"바드",classId:"dnd.srd521.class.bard",level:3,hitDie:8,abilities:{str:8,dex:14,con:12,int:10,wis:10,cha:16},proficiencyBonus:2});

test("§22.14 recharge: the wyrmling's breath spends its recharge pool, the tile waits, and a d6 at its turn start brings it back on 5–6", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:WYRMLING}]});
  const kael="char.kael",wyrm=`${WYRMLING}.instance-1`;
  const breath=byName(runtime,wyrm,/브레스/);
  const rechargePool=breath.resourceCost!.resourceId;
  assert.match(rechargePool,/^recharge:/);
  assert.equal(pool(runtime,wyrm,rechargePool),1);
  dice.push(5,15); // 이니셔티브: 카엘 5+2=7, 지룡 15+?
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,wyrm);
  dice.push(10,10,10,10,10,10,10,10,10,10, 8,8); // 5d8 피해 (얼굴 10개 = 5×2) · 카엘 내성 d20 2개
  const used=runtime.dispatch({type:"act",actorId:wyrm,actionId:breath.id,targetIds:[kael]});
  assert.equal(used.status,"committed",JSON.stringify(used));
  assert.equal(pool(runtime,wyrm,rechargePool),0,"spent");
  runtime.dispatch({type:"end-turn"}); // → 카엘
  dice.push(3); // 지룡 턴 시작: 재충전 d6 = 3 → 아직
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(runtime.state.currentActorId,wyrm);
  assert.equal(pool(runtime,wyrm,rechargePool),0);
  assert.equal(tile(runtime,wyrm,breath.id)?.available,false);
  assert.match(tile(runtime,wyrm,breath.id)?.disabledReason??"",/자원/);
  assert.ok(runtime.state.log[0].detail.some((line)=>/재충전 d6 3 → 아직/.test(line)),JSON.stringify(runtime.state.log[0]));
  runtime.dispatch({type:"end-turn"});
  dice.push(6); // 다음 턴 시작: 6 → 준비됨
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(pool(runtime,wyrm,rechargePool),1);
  assert.equal(tile(runtime,wyrm,breath.id)?.available,true);
  assert.equal(dice.remaining(),0);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
});

test("§22.14 legendary actions: a pool of 3 spent off-turn on '급습 · 찢기', refused on the dragon's own turn, refilled at its turn start", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:WHITE_DRAGON}]});
  const kael="char.kael",dragon=`${WHITE_DRAGON}.instance-1`;
  assert.equal(pool(runtime,dragon,"legendary-actions"),3);
  const pounce=byName(runtime,dragon,/급습 · 찢기/);
  assert.equal(pounce.economy,"없음");
  assert.deepEqual(pounce.resourceCost,{resourceId:"legendary-actions",amount:1});
  dice.push(20,1); // 카엘 먼저
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,kael);
  const damageFaces=(pounce.damage??[]).reduce((sum,entry)=>sum+(parseDiceNotation(entry.dice)?.count??0)*2,0);
  dice.push(15,15,...Array.from({length:damageFaces},()=>3)); // 찢기: 명중 d20 2개 · 피해 얼굴 (count × 2)
  const before=hp(runtime,kael);
  const used=runtime.dispatch({type:"act",actorId:dragon,actionId:pounce.id,targetIds:[kael]});
  assert.equal(used.status,"committed",JSON.stringify(used));
  assert.equal(pool(runtime,dragon,"legendary-actions"),2);
  assert.ok(hp(runtime,kael)<before,"the rend hit");
  runtime.dispatch({type:"end-turn"},P1); // → 드래곤의 턴: 전설 행동은 못 쓰고, 풀은 3으로
  assert.equal(runtime.state.currentActorId,dragon);
  assert.equal(pool(runtime,dragon,"legendary-actions"),3,"refilled at its turn start");
  assert.equal(tile(runtime,dragon,pounce.id)?.available,false);
  assert.match(tile(runtime,dragon,pounce.id)?.disabledReason??"",/다른 크리처의 턴/);
  assert.equal(runtime.dispatch({type:"act",actorId:dragon,actionId:pounce.id,targetIds:[kael]}).status,"refused");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.7 sight: a frightened goblin attacks its source at disadvantage; a hidden attacker has advantage and an unseen target imposes disadvantage", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",gob=`${GOBLIN}.instance-1`;
  const scimitar=byName(runtime,gob,/시미터/);
  runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"frightened",on:true,sourceActorId:kael}});
  dice.push(18,3,2,2); // 불리: 낮은 쪽 3 → 빗나감
  const frightened=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[kael]});
  assert.equal(frightened.status,"committed",JSON.stringify(frightened));
  assert.match(frightened.resolution?.detail[0]??"",/불리/);
  assert.equal(frightened.resolution?.attackOutcome,"빗나감");
  // 카엘이 숨는다 → 숨은 채 공격하면 유리
  runtime.dispatch({type:"ruling",targetIds:[gob],ruling:{kind:"condition",conditionId:"frightened",on:false}});
  dice.push(15,15);
  assert.equal(runtime.dispatch({type:"act",actorId:kael,actionId:"action.standard.hide",targetIds:[]},P1).status,"committed");
  dice.push(2,17,3,3);
  const hidden=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(hidden.status,"committed",JSON.stringify(hidden));
  assert.match(hidden.resolution?.detail[0]??"",/유리/);
  assert.equal(hidden.resolution?.attackOutcome,"명중");
  // 이제 고블린이 숨는다 → 카엘은 안 보이는 대상을 불리로 공격 (DM이 '보인다'고 하면 override로 뒤집는다)
  dice.push(15,15);
  assert.equal(runtime.dispatch({type:"act",actorId:gob,actionId:"action.standard.hide",targetIds:[]}).status,"committed");
  dice.push(19,4,3,3);
  const unseen=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(unseen.status,"committed",JSON.stringify(unseen));
  assert.match(unseen.resolution?.detail[0]??"",/불리/);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.8 effect riders: Hunter's Mark adds 1d6 force to the ranger's hits on the marked goblin only", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:ranger(),controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN},{kind:"monster",monsterId:GOBLIN}]});
  const ash="char.ash",gob1=`${GOBLIN}.instance-1`,gob2=`${GOBLIN}.instance-2`;
  const mark=runtime.dispatch({type:"act",actorId:ash,actionId:"spell.dnd.srd521.spell.hunter-s-mark",targetIds:[gob1]},P1);
  assert.equal(mark.status,"committed",JSON.stringify(mark));
  assert.ok(runtime.state.rules.concentration[ash]);
  dice.push(18,18,4,4);
  const marked=runtime.dispatch({type:"act",actorId:ash,actionId:"action.longsword",targetIds:[gob1]},P1);
  assert.equal(marked.status,"committed",JSON.stringify(marked));
  const types=marked.resolution?.damageComponents.map((component)=>component.type)??[];
  assert.ok(types.includes("force"),`force rider expected: ${types.join(",")}`);
  assert.ok(marked.resolution?.stateChanges.some((line)=>/표식/.test(line)),JSON.stringify(marked.resolution?.stateChanges));
  dice.push(18,18,4,4);
  const other=runtime.dispatch({type:"act",actorId:ash,actionId:"action.longsword",targetIds:[gob2]},P1);
  assert.equal(other.status,"committed");
  assert.ok(!(other.resolution?.damageComponents.map((component)=>component.type)??[]).includes("force"),"no rider on an unmarked creature");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.9 Indomitable: a 9th-level fighter who fails the breath save gets a card, rerolls with +9, and takes half", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter9(),controllerPeer:P1.peerId},{kind:"monster",monsterId:WYRMLING}]});
  const bram="char.bram",wyrm=`${WYRMLING}.instance-1`;
  assert.equal(pool(runtime,bram,"resource:fighter.indomitable"),1);
  const breath=byName(runtime,wyrm,/브레스/);
  dice.push(2,2,2,2,2,2,2,2,2,2, 2,2); // 5d8 = 10 (얼굴 10개) · 브람 내성 d20 2 → 실패 (DC 11)
  const held=runtime.dispatch({type:"act",actorId:wyrm,actionId:breath.id,targetIds:[bram]});
  assert.equal(held.status,"committed",JSON.stringify(held));
  assert.ok(runtime.state.pending,"held for the save-failed window");
  const card=runtime.state.questions.find((question)=>question.kind==="reaction-window")!;
  assert.equal(card.actorId,bram);
  assert.equal(card.toPeer,P1.peerId,"a character's failed save is its player's card");
  assert.ok(card.options.some((option)=>option.id==="indomitable"),JSON.stringify(card.options));
  assert.equal(hp(runtime,bram),90,"nothing lands while the window is open");
  dice.push(5); // 재굴림 d20 5 + 0 + 9 = 14 ≥ 11
  const answered=runtime.dispatch({type:"answer-question",questionId:card.id,optionId:"indomitable"},P1);
  assert.equal(answered.status,"committed",JSON.stringify(answered));
  assert.equal(runtime.state.pending,null);
  assert.equal(pool(runtime,bram,"resource:fighter.indomitable"),0);
  assert.equal(hp(runtime,bram),85,"half of 10");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.9 Bardic Inspiration: granted as a bonus action, spent on a missed attack to turn it into a hit", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:bard(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",lio="char.lio",gob=`${GOBLIN}.instance-1`;
  assert.equal(pool(runtime,lio,"resource:bard.bardic-inspiration"),3);
  const grant=runtime.dispatch({type:"act",actorId:lio,actionId:"action.bardic-inspiration",targetIds:[kael]},P2);
  assert.equal(grant.status,"committed",JSON.stringify(grant));
  assert.equal(pool(runtime,lio,"resource:bard.bardic-inspiration"),2);
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.tags.includes("bardic-inspiration")));
  dice.push(6,6,4,4); // 6 + 7 = 13 vs AC 15 → 빗나감 (2 모자람)
  const miss=runtime.dispatch({type:"act",actorId:kael,actionId:"action.longsword",targetIds:[gob]},P1);
  assert.equal(miss.status,"committed",JSON.stringify(miss));
  assert.ok(runtime.state.pending,"held for the attack-missed window");
  const card=runtime.state.questions.find((question)=>question.kind==="reaction-window")!;
  assert.equal(card.actorId,kael);
  assert.equal(card.toPeer,P1.peerId);
  dice.push(3); // d6 3 → 16 ≥ 15 명중
  const answered=runtime.dispatch({type:"answer-question",questionId:card.id,optionId:"inspiration"},P1);
  assert.equal(answered.status,"committed",JSON.stringify(answered));
  assert.equal(answered.resolution?.attackOutcome,"명중");
  assert.equal(hp(runtime,gob),10-8,"1d8 4 + 4");
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.tags.includes("bardic-inspiration")),"the die is spent");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.14 multiattack routine: the brown bear's one tile resolves 물기 then 발톱 against the same target, one card each, and spends the action", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:"dnd.srd521.monster.brown-bear"}]});
  const kael="char.kael",bear="dnd.srd521.monster.brown-bear.instance-1";
  const routine=tile(runtime,bear,"action.multiattack")!;
  assert.deepEqual(routine.tableRoutine?.steps.map((step)=>`${step.name}×${step.count}`),["물기×1","발톱×1"]);
  dice.push(1,20); // 곰 먼저
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,bear);
  dice.push(15,15,4,4, 15,15,2,2); // 물기 명중 1d8 4 + 3 = 7 · 발톱 명중 1d4 2 + 3 = 5
  const before=hp(runtime,kael);
  const result=runtime.dispatch({type:"act",actorId:bear,actionId:"action.multiattack",targetIds:[kael]});
  assert.equal(result.status,"committed",JSON.stringify(result));
  assert.equal(hp(runtime,kael),before-12);
  assert.equal(result.events.length,2,"one card per attack");
  assert.match(result.resolution?.detail.at(-1)??"",/다중공격: .*물기.*발톱/);
  assert.equal(runtime.state.log.filter((entry)=>/물기|발톱/.test(entry.title)).length,2);
  const bite=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[bear].find((action)=>action.name==="물기")!;
  assert.equal(bite.available,false,"the action is spent");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.14 hit riders: a ghoul's claw forces a CON save or paralysis; a crocodile's bite grapples and restrains until the escape check frees both", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:"dnd.srd521.monster.ghoul"},{kind:"monster",monsterId:"dnd.srd521.monster.crocodile"}]});
  const kael="char.kael",ghoul="dnd.srd521.monster.ghoul.instance-1",croc="dnd.srd521.monster.crocodile.instance-1";
  const claw=byName(runtime,ghoul,/^발톱$/);
  assert.deepEqual(claw.tableHitRider,{conditionIds:["paralyzed"],saveAbility:"con",saveDc:10,untilTargetNextTurnEnd:true});
  dice.push(15,15,2,2, 2,2); // 명중 · 1d4 · 카엘 건강 내성 2 + 6 = 8 vs DC 10 → 실패
  const clawed=runtime.dispatch({type:"act",actorId:ghoul,actionId:claw.id,targetIds:[kael]});
  assert.equal(clawed.status,"committed",JSON.stringify(clawed));
  assert.ok(clawed.resolution?.stateChanges.some((line)=>/건강 내성 8 vs DC 10 실패 → 마비/.test(line)),JSON.stringify(clawed.resolution?.stateChanges));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.conditionId==="paralyzed"));
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"condition",conditionId:"paralyzed",on:false}});
  const bite=byName(runtime,croc,/^물기$/);
  assert.deepEqual(bite.tableHitRider,{conditionIds:["grappled","restrained"],escapeDc:12});
  dice.push(15,15,3,3);
  const bitten=runtime.dispatch({type:"act",actorId:croc,actionId:bite.id,targetIds:[kael]});
  assert.equal(bitten.status,"committed",JSON.stringify(bitten));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.conditionId==="grappled"&&effect.metadata?.escapeDc===12));
  assert.ok(runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&effect.conditionId==="restrained"));
  dice.push(20,20);
  const escaped=runtime.dispatch({type:"act",actorId:kael,actionId:"action.escape-grapple",targetIds:[kael]},P1);
  assert.equal(escaped.status,"committed",JSON.stringify(escaped));
  assert.ok(!runtime.state.rules.effects.some((effect)=>effect.targetId===kael&&(effect.conditionId==="grappled"||effect.conditionId==="restrained")),"both end with the hold");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0,`unused dice: ${dice.remaining()}`);
});

test("§22.14 monster spellcasting: the mage's utility spells are text tiles — 투명화 spends its 2/day pool, 마법 탐지 is at will, 화염구 stays a save tile", () => {
  const MAGE="dnd.srd521.monster.mage";
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"monster",monsterId:MAGE}]});
  const mage=`${MAGE}.instance-1`;
  const invisibility=byName(runtime,mage,/^투명화 \(주문\)/);
  assert.equal(invisibility.resolutionKind,"no-roll");
  assert.equal(invisibility.economy,"행동");
  assert.match(invisibility.summary,/투명/);
  assert.equal(pool(runtime,mage,"uses:spell.1.1.invisibility"),2,"the per-day list's uses become the pool");
  const detect=byName(runtime,mage,/^마법 탐지 \(주문\)/);
  assert.equal(detect.resourceCost,undefined,"at will");
  assert.ok(byName(runtime,mage,/^화염구 \(주문 · 4레벨\)/).resolutionKind==="saving-throw","the damaging spell is still projected as a save action");
  const cast=runtime.dispatch({type:"act",actorId:mage,actionId:invisibility.id,targetIds:[]});
  assert.equal(cast.status,"committed",JSON.stringify(cast));
  assert.equal(pool(runtime,mage,"uses:spell.1.1.invisibility"),1);
  runtime.dispatch({type:"act",actorId:mage,actionId:invisibility.id,targetIds:[]});
  assert.equal(pool(runtime,mage,"uses:spell.1.1.invisibility"),0);
  const spent=runtime.dispatch({type:"act",actorId:mage,actionId:invisibility.id,targetIds:[]});
  assert.equal(spent.status,"refused","no uses left today");
  assert.equal(runtime.dispatch({type:"act",actorId:mage,actionId:detect.id,targetIds:[]}).status,"committed","at-will spells never run out");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
