import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAutomaticCommonPlayInterceptor,
  startCommonPlayResolution,
  type CommonPlayReactionDefinition,
} from "../../src/domain/commonPlayRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

// X1-02: an interceptor without `interaction` is automatic — applied whenever eligible, without a blocking choice.
const AUTOMATIC_ATTACK_BONUS:CommonPlayReactionDefinition={
  id:"external.feat.archery-like",
  payments:[],
  interceptors:[{
    id:"ranged-attack-bonus",
    timing:"d20.outcome-determined",
    operation:"recalculate",
    slot:"d20.roll",
    families:["attack-roll"],
    operations:[{kind:"roll.modify",mode:"add-flat",value:{value:2}}],
  }],
};

const AUTOMATIC_DEFENSE:CommonPlayReactionDefinition={
  id:"external.feat.defense-like",
  payments:[],
  interceptors:[{
    id:"armored-ac-bonus",
    timing:"attack.outcome-determined",
    operation:"recalculate",
    slot:"attack.outcome",
    operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:1}}],
  }],
};

function attackPending(natural:number,target:number):PendingResolution {
  return {
    id:"automatic-attack",
    actorId:"goblin",
    sourceId:"external.weapon.attack",
    expectedRevision:0,
    operations:[
      {
        id:"attack",kind:"d20",actorId:"goblin",targetId:"hero",
        request:{family:"attack-roll",target,modifierContributions:[{source:"external.attack-bonus",value:6}],dice:{id:"external-attack",purpose:"attack",sides:20,faces:[natural]}},
      },
      {id:"damage",kind:"damage",targetId:"hero",damageType:"force",amount:7,creatureKind:"character",when:{operationId:"attack",field:"outcome",equals:"success"}},
    ],
  };
}

test("an automatic d20 interceptor adds its flat bonus on every outcome and the downstream damage follows the new result",()=>{
  const state=runtimeState();
  // 10 + 6 = 16 misses AC 17; +2 turns it into a hit, so the conditional damage applies.
  const applied=applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(10,17),AUTOMATIC_ATTACK_BONUS,"goblin");
  assert.equal(applied.status,"committed");
  if(applied.status!=="committed")return;
  const attack=applied.results.attack as {total:number;modifier:number;outcome:string};
  assert.equal(attack.total,18);
  assert.equal(attack.modifier,8,"the bonus lands in the modifier so presentations can show +2");
  assert.equal(attack.outcome,"success");
  assert.equal(applied.state.combatants.hero.life.hp.current,13);
  assert.equal(applied.state.combatants.goblin.economy.reaction,true,"no payment was declared, so nothing was spent");
});

test("an automatic d20 interceptor honours a narrowed outcome selector",()=>{
  const state=runtimeState();
  const successOnly:CommonPlayReactionDefinition={...AUTOMATIC_ATTACK_BONUS,interceptors:[{...AUTOMATIC_ATTACK_BONUS.interceptors[0],outcomes:["success"]} as CommonPlayReactionDefinition["interceptors"][number]]};
  const applied=applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(10,17),successOnly,"goblin");
  assert.equal(applied.status,"not-applicable");
});

test("an automatic attack.outcome interceptor raises the defender's AC and turns a marginal hit into a miss",()=>{
  const state=runtimeState();
  // 9 + 6 = 15 hits AC 15 exactly; Defense-like +1 makes the target 16.
  const applied=applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(9,15),AUTOMATIC_DEFENSE,"hero");
  assert.equal(applied.status,"committed");
  if(applied.status!=="committed")return;
  const attack=applied.results.attack as {target:number;outcome:string};
  assert.equal(attack.target,16);
  assert.equal(attack.outcome,"failure");
  assert.deepEqual(applied.results.damage,{skipped:true});
  assert.equal(applied.state.combatants.hero.life.hp.current,20);
});

test("an automatic attack.outcome interceptor is not applicable when the source is not the attack target or the attack already misses",()=>{
  const state=runtimeState();
  assert.equal(applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(9,15),AUTOMATIC_DEFENSE,"goblin").status,"not-applicable");
  assert.equal(applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(2,15),AUTOMATIC_DEFENSE,"hero").status,"not-applicable");
});

test("an automatic interceptor with an unaffordable payment is not applicable and spends nothing",()=>{
  const state=runtimeState();
  state.combatants.goblin.economy.reaction=false;
  const paid:CommonPlayReactionDefinition={...AUTOMATIC_ATTACK_BONUS,payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"}]};
  const applied=applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(10,17),paid,"goblin");
  assert.equal(applied.status,"not-applicable");
  assert.equal(state.revision,0);
});

test("the interactive entry point refuses an automatic interceptor and the automatic entry point refuses an interactive one",()=>{
  const state=runtimeState();
  const started=startCommonPlayResolution(TEST_PROFILE,state,attackPending(10,17),AUTOMATIC_ATTACK_BONUS,"goblin");
  assert.equal(started.status,"rejected");
  const interactive:CommonPlayReactionDefinition={...AUTOMATIC_DEFENSE,interceptors:[{
    ...AUTOMATIC_DEFENSE.interceptors[0],
    interaction:{id:"use",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"always"},
  } as CommonPlayReactionDefinition["interceptors"][number]]};
  const applied=applyAutomaticCommonPlayInterceptor(TEST_PROFILE,state,attackPending(9,15),interactive,"hero");
  assert.equal(applied.status,"rejected");
});

test("lowering keeps `interaction` optional on d20, damage, and attack.outcome interceptors",()=>{
  const canonical=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id:"external.feat.lowering-probe",
    interceptors:[
      {id:"bonus",timing:"d20.outcome-determined",operation:"recalculate",slot:"d20.roll",families:["attack-roll"],
        factQueries:[{id:"ranged",fact:"attack.weapon.ranged",subject:"intercepted.actor",authority:"host",visibility:"public",unknownPolicy:"treat-false"}],
        when:{op:"eq",left:{ref:"ranged"},right:{value:true}},
        operations:[{kind:"roll.modify",mode:"add-flat",value:{value:2}}]},
      {id:"defense",timing:"attack.outcome-determined",operation:"recalculate",slot:"attack.outcome",
        operations:[{kind:"property.modify",property:"defense.ac",operation:"add",value:{value:1}}]},
      {id:"halve",timing:"damage.rolled",operation:"recalculate",slot:"primary.damage",
        operations:[{kind:"roll.modify",mode:"multiply",value:{value:0.5}}]},
    ],
  },"lowering probe");
  const lowered=lowerCommonPlayReactionDefinition(canonical);
  assert.ok(lowered);
  assert.equal(lowered.interceptors.length,3);
  for(const interceptor of lowered.interceptors)assert.equal(interceptor.interaction,undefined);
  assert.deepEqual(lowered.interceptors[0].eligibility?.factQueries.map((query)=>query.fact),["attack.weapon.ranged"]);
});
