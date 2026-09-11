import assert from "node:assert/strict";
import test from "node:test";
import { replayEvents } from "../../src/table/events";
import { projectTable } from "../../src/table/project";
import { TableRuntime } from "../../src/table/runtime";
import { createTableState } from "../../src/table/state";
import { GOBLIN, P1, cleric, fighter, hp, table } from "./fixtures";

/** Capability inventory §8: spells through the domain kernel. */
const P2={peerId:"peer.p2",role:"player" as const};
const SACRED="spell.dnd.srd521.spell.sacred-flame",HEALING_WORD="spell.dnd.srd521.spell.healing-word",CURE="spell.dnd.srd521.spell.cure-wounds",BLESS="spell.dnd.srd521.spell.bless",BOLT="spell.dnd.srd521.spell.guiding-bolt";
const slot=(runtime:TableRuntime,id:string,level:number)=>runtime.state.rules.combatants[id].resources.find((entry)=>entry.id===`spell-slot-${level}`)?.current;
const tile=(runtime:TableRuntime,actorId:string,actionId:string)=>projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[actorId].find((action)=>action.id===actionId);
const chips=(runtime:TableRuntime,id:string)=>projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===id)!.status;

test("§8 a cleric's spells are actions with slots as resources: cantrip save, healing, upcast, concentration and its damage save", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:fighter(),controllerPeer:P1.peerId},{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const kael="char.kael",sera="char.sera",gob=`${GOBLIN}.instance-1`;
  assert.equal(slot(runtime,sera,1),4,"3rd-level cleric: four 1st-level slots");
  assert.equal(slot(runtime,sera,2),2);
  assert.equal(tile(runtime,sera,SACRED)?.name,"신성한 불길");
  assert.equal(tile(runtime,sera,SACRED)?.saveDc,13);
  assert.equal(tile(runtime,sera,HEALING_WORD)?.economy,"추가 행동");
  assert.equal(tile(runtime,sera,BLESS)?.maxTargets,3);
  // 신성한 불길 → 고블린: 1d8 (6), 고블린 민첩 내성 5 + 2 = 7 vs DC 13 실패 → 6 광휘
  dice.push(6, 5,5);
  const flame=runtime.dispatch({type:"act",actorId:sera,actionId:SACRED,targetIds:[gob]},P2);
  assert.equal(flame.status,"committed",JSON.stringify(flame));
  assert.equal(hp(runtime,gob),4);
  assert.equal(flame.resolution?.saveResults[0]?.outcome,"실패");
  assert.equal(slot(runtime,sera,1),4,"a cantrip spends no slot");
  // 치유의 단어 → 카엘 (31/42): 2d4 (3+4) + 3 = 10 → 41; 1레벨 슬롯 4 → 3
  dice.push(3,4);
  const word=runtime.dispatch({type:"act",actorId:sera,actionId:HEALING_WORD,targetIds:[kael]},P2);
  assert.equal(word.status,"committed",JSON.stringify(word));
  assert.equal(hp(runtime,kael),41);
  assert.equal(slot(runtime,sera,1),3);
  // 상위 시전: 2레벨 슬롯으로 상처 치료 → 4d8 (1+1+1+1) + 3 = 7; 2레벨 슬롯 2 → 1
  runtime.dispatch({type:"ruling",targetIds:[kael],ruling:{kind:"damage",amount:20}});
  dice.push(1,1,1,1);
  const cure=runtime.dispatch({type:"act",actorId:sera,actionId:CURE,targetIds:[kael],slotLevel:2},P2);
  assert.equal(cure.status,"committed",JSON.stringify(cure));
  assert.equal(hp(runtime,kael),28);
  assert.equal(slot(runtime,sera,2),1);
  assert.equal(slot(runtime,sera,1),3,"the 1st-level slots are untouched");
  const empty=runtime.dispatch({type:"act",actorId:sera,actionId:CURE,targetIds:[kael],slotLevel:5},P2);
  assert.equal(empty.status==="refused"&&empty.refusal.message,"5레벨 주문 슬롯이 남아 있지 않습니다.");
  // 축복 (집중, 물질 구성요소는 성표로): 카엘과 세라
  const bless=runtime.dispatch({type:"act",actorId:sera,actionId:BLESS,targetIds:[kael,sera]},P2);
  assert.equal(bless.status,"committed",JSON.stringify(bless));
  assert.ok(runtime.state.rules.concentration[sera],"the cleric concentrates on Bless");
  assert.equal(slot(runtime,sera,1),2);
  // 고블린이 세라를 명중 → 집중 내성 (건강 +2): d20 3 + 2 = 5 vs DC 10 실패 → 집중 종료
  const scimitar=projectTable(runtime.state,{role:"dm"}).scene.actionsByActor[gob].find((action)=>/시미터/.test(action.name))!;
  dice.push(19,19, 4,4, 3,3);
  const cut=runtime.dispatch({type:"act",actorId:gob,actionId:scimitar.id,targetIds:[sera]});
  assert.equal(cut.status,"committed",JSON.stringify(cut));
  assert.equal(hp(runtime,sera),21);
  assert.equal(runtime.state.rules.concentration[sera],undefined,"a failed concentration save ends Bless");
  // 유도 화살: 주문 공격 +5 (19 → 24 vs AC 15 명중), 4d6 광휘 (1+2+3+4)
  dice.push(19,19, 1,2,3,4);
  const bolt=runtime.dispatch({type:"act",actorId:sera,actionId:BOLT,targetIds:[gob]},P2);
  assert.equal(bolt.status,"committed",JSON.stringify(bolt));
  assert.equal(bolt.resolution?.attackOutcome,"명중");
  assert.equal(runtime.state.rules.combatants[gob].life.dead,true,"10 damage on 4 HP");
  assert.equal(runtime.state.questions.length,0,"a spell kill does not ask 죽임/기절 (D9: melee only)");
  assert.equal(slot(runtime,sera,1),1);
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  const replica=new TableRuntime({sessionId:"table.test"});
  for(const event of runtime.ledger) replica.applyRemote(event);
  assert.deepEqual(projectTable(replica.state,{role:"player",peerId:P2.peerId}),projectTable(runtime.state,{role:"player",peerId:P2.peerId}));
  assert.equal(dice.remaining(),0);
});

test("§8 in Initiative: one slotted spell per turn, the spell's own economy, and a somatic component needs a free hand", () => {
  const {runtime,dice}=table([]);
  runtime.dispatch({type:"add-actors",specs:[{kind:"character",sheet:cleric(),controllerPeer:P2.peerId},{kind:"character",sheet:{...fighter(),hp:10},controllerPeer:P1.peerId},{kind:"monster",monsterId:GOBLIN}]});
  const sera="char.sera",kael="char.kael",gob=`${GOBLIN}.instance-1`;
  dice.push(20,1,1);
  runtime.dispatch({type:"start-initiative"});
  assert.equal(runtime.state.currentActorId,sera);
  // 치유의 단어 (추가 행동, 슬롯) → 같은 턴 상처 치료 (행동, 슬롯) 거부 → 소마법은 가능
  dice.push(2,2);
  assert.equal(runtime.dispatch({type:"act",actorId:sera,actionId:HEALING_WORD,targetIds:[kael]},P2).status,"committed");
  assert.equal(runtime.state.rules.combatants[sera].economy.bonusAction,false);
  const second=runtime.dispatch({type:"act",actorId:sera,actionId:CURE,targetIds:[kael]},P2);
  assert.equal(second.status==="refused"&&second.refusal.message,"이번 턴에 이미 슬롯 주문을 시전했습니다.");
  dice.push(4, 20,20);
  const flame=runtime.dispatch({type:"act",actorId:sera,actionId:SACRED,targetIds:[gob]},P2);
  assert.equal(flame.status,"committed",JSON.stringify(flame));
  assert.equal(flame.resolution?.saveResults[0]?.outcome,"성공");
  assert.equal(hp(runtime,gob),10,"no damage on a successful Sacred Flame save");
  assert.equal(runtime.state.rules.combatants[sera].economy.action,false);
  const spent=runtime.dispatch({type:"act",actorId:sera,actionId:SACRED,targetIds:[gob]},P2);
  assert.equal(spent.status==="refused"&&spent.refusal.message,"행동을 이미 사용했습니다.");
  // 다음 라운드: 방패를 들면 빈손이 없어 동작 구성요소 주문이 거부된다; 치유의 단어(음성만)는 가능
  runtime.dispatch({type:"end-turn"},P2);
  runtime.dispatch({type:"end-turn"});
  runtime.dispatch({type:"end-turn"},P1);
  assert.equal(runtime.state.currentActorId,sera);
  assert.equal(runtime.dispatch({type:"object",actorId:sera,op:"draw",itemId:"item.shield"},P2).status,"committed");
  assert.equal(projectTable(runtime.state,{role:"dm"}).scene.entities.find((entity)=>entity.id===sera)?.hands,"메이스 (주손) · 방패 (보조손)");
  const noHands=runtime.dispatch({type:"act",actorId:sera,actionId:SACRED,targetIds:[gob]},P2);
  assert.equal(noHands.status==="refused"&&noHands.refusal.message,"동작 구성요소에 빈손이 필요합니다. 무기를 놓거나 집어넣으세요.");
  dice.push(1,1);
  assert.equal(runtime.dispatch({type:"act",actorId:sera,actionId:HEALING_WORD,targetIds:[kael]},P2).status,"committed","Healing Word has no somatic component");
  assert.deepEqual(replayEvents(createTableState("table.test"),runtime.ledger),runtime.state);
  assert.equal(dice.remaining(),0);
});
