import assert from "node:assert/strict";
import test from "node:test";
import {
  resumeCommonPlayInteraction,
  startCommonPlayResolution,
  type AwaitingCommonPlayInteraction,
  type CommonPlayReactionDefinition,
} from "../../src/domain/commonPlayRuntime";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const EXTERNAL_DEFENSE:CommonPlayReactionDefinition={
  id:"external.unknown.reaction-defense",
  payments:[
    { kind:"economy", bucket:"reaction", amount:{ value:1 }, consumeAt:"commit", refundOnCancel:true },
    { kind:"resource", resource:"spell-slot-1", amount:{ value:1 }, consumeAt:"commit", refundOnCancel:true },
  ],
  interceptors:[{
    id:"raise-defense-and-recalculate",
    timing:"attack.outcome-determined",
    interaction:{
      id:"use-defense",
      kind:"choice",
      responder:"actor-owner",
      mode:"blocking",
      input:{ type:"boolean" },
      visibility:"actor-and-dm",
      promptKey:"external.use-defense",
      revalidate:"always",
      stalePolicy:"cancel",
      idempotencyKey:"external.reaction-defense.use",
    },
    operation:"recalculate",
    slot:"attack.outcome",
    operations:[{
      kind:"property.modify",
      property:"defense.ac",
      operation:"add",
      value:{ value:5 },
    }],
  }],
};

const EXTERNAL_D20_REDUCTION:CommonPlayReactionDefinition={
  id:"external.unknown.roll-reduction",
  payments:[
    { kind:"economy", bucket:"reaction", amount:{ value:1 }, consumeAt:"commit", refundOnCancel:true },
    { kind:"resource", resource:"spell-slot-1", amount:{ value:1 }, consumeAt:"commit", refundOnCancel:true },
  ],
  interceptors:[{
    id:"subtract-authoritative-die",
    timing:"d20.outcome-determined",
    interaction:{
      id:"use-roll-reduction",
      kind:"choice",
      responder:"actor-owner",
      mode:"blocking",
      input:{ type:"boolean" },
      visibility:"actor-and-dm",
      promptKey:"external.use-roll-reduction",
      revalidate:"always",
      stalePolicy:"cancel",
      idempotencyKey:"external.roll-reduction.use",
    },
    operation:"recalculate",
    slot:"d20.roll",
    operations:[{kind:"roll.modify",mode:"subtract-die",dice:"1d8+1"}],
  }],
};

function attackPending():PendingResolution {
  return {
    id:"generic-reaction-attack",
    actorId:"goblin",
    sourceId:"external.weapon.attack",
    expectedRevision:0,
    operations:[
      {
        id:"attack",
        kind:"d20",
        actorId:"goblin",
        targetId:"hero",
        request:{
          family:"attack-roll",
          target:15,
          modifierContributions:[{ source:"external.attack-bonus", value:6 }],
          dice:{ id:"external-attack", purpose:"attack", sides:20, faces:[10] },
        },
      },
      {
        id:"damage",
        kind:"damage",
        targetId:"hero",
        damageType:"force",
        amount:7,
        creatureKind:"character",
        when:{ operationId:"attack", field:"outcome", equals:"success" },
      },
    ],
  };
}

function abilityCheckPending():PendingResolution {
  return {
    id:"generic-reaction-check",
    actorId:"goblin",
    sourceId:"external.ability.check",
    expectedRevision:0,
    operations:[{
      id:"check",
      kind:"d20",
      actorId:"goblin",
      request:{
        family:"ability-check",
        target:15,
        modifierContributions:[{source:"external.check-bonus",value:5}],
        dice:{id:"external-check",purpose:"ability check",sides:20,faces:[14]},
      },
    }],
  };
}

function requireAwaiting(value:ReturnType<typeof startCommonPlayResolution>):AwaitingCommonPlayInteraction {
  assert.equal(value.status,"awaiting-input");
  if (value.status!=="awaiting-input") throw new Error("expected awaiting-input");
  return value;
}

test("Common Play reaction preview pauses without mutating authoritative state and decline spends nothing",()=>{
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,attackPending(),EXTERNAL_DEFENSE,"hero"));

  assert.equal(state.revision,0);
  assert.equal(state.combatants.hero.economy.reaction,true);
  assert.equal(state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(state.combatants.hero.life.hp.current,20);
  assert.deepEqual(state.history,[]);
  assert.equal(awaiting.interaction.sourceId,"external.unknown.reaction-defense");
  assert.equal(awaiting.interaction.expectedRevision,0);

  const declined=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:false,
  });
  assert.equal(declined.status,"committed");
  if (declined.status!=="committed") return;
  assert.equal(declined.state.revision,1);
  assert.equal(declined.state.combatants.hero.life.hp.current,13);
  assert.equal(declined.state.combatants.hero.economy.reaction,true);
  assert.equal(declined.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal((declined.results.attack as {outcome:string}).outcome,"success");
});

test("Common Play reaction accept atomically pays costs, recalculates attack.outcome, and skips downstream damage",()=>{
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,attackPending(),EXTERNAL_DEFENSE,"hero"));
  const accepted=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  });

  assert.equal(accepted.status,"committed");
  if (accepted.status!=="committed") return;
  assert.equal(accepted.state.revision,1);
  assert.equal(accepted.state.combatants.hero.economy.reaction,false);
  assert.equal(accepted.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,1);
  assert.equal(accepted.state.combatants.hero.life.hp.current,20);
  assert.equal((accepted.results.attack as {target:number;outcome:string}).target,20);
  assert.equal((accepted.results.attack as {outcome:string}).outcome,"failure");
  assert.deepEqual(accepted.results.damage,{ skipped:true });

  const replay=resumeCommonPlayInteraction(TEST_PROFILE,accepted.state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  });
  assert.equal(replay.status,"invalidated");
  assert.equal(replay.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,1);
  assert.equal(replay.state.combatants.hero.economy.reaction,false);
});

test("Common Play stale response invalidates without payment",()=>{
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,attackPending(),EXTERNAL_DEFENSE,"hero"));
  const newer=structuredClone(state);
  newer.revision=1;

  const stale=resumeCommonPlayInteraction(TEST_PROFILE,newer,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  });
  assert.equal(stale.status,"invalidated");
  assert.equal(stale.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(stale.state.combatants.hero.economy.reaction,true);
  assert.equal(stale.state.combatants.hero.life.hp.current,20);
});

test("Common Play does not open an interaction when its payments are unavailable",()=>{
  const state=runtimeState();
  const slot=state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1");
  assert.ok(slot);
  slot.current=0;

  const resolved=startCommonPlayResolution(TEST_PROFILE,state,attackPending(),EXTERNAL_DEFENSE,"hero");
  assert.equal(resolved.status,"committed");
  if (resolved.status!=="committed") return;
  assert.equal(resolved.state.combatants.hero.life.hp.current,13);
  assert.equal(resolved.state.combatants.hero.economy.reaction,true);
  assert.equal(resolved.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,0);
});

test("generic d20.roll interceptor reduces a successful ability check with authoritative dice and atomic costs",()=>{
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,abilityCheckPending(),EXTERNAL_D20_REDUCTION,"hero"));
  const accepted=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  },{modifierDiceFaces:{0:[6]}});
  assert.equal(accepted.status,"committed");
  if(accepted.status!=="committed") return;
  const result=accepted.results.check as {natural:number;modifier:number;total:number;target:number;outcome:string};
  assert.deepEqual(
    {natural:result.natural,modifier:result.modifier,total:result.total,target:result.target,outcome:result.outcome},
    {natural:14,modifier:-2,total:12,target:15,outcome:"failure"},
  );
  assert.equal(accepted.state.combatants.hero.economy.reaction,false);
  assert.equal(accepted.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,1);
});

test("generic d20.roll interceptor preserves attack natural-20 semantics",()=>{
  const pending=attackPending();
  const attack=pending.operations[0];
  assert.equal(attack.kind,"d20");
  if(attack.kind!=="d20") return;
  attack.request.dice.faces=[20];
  attack.request.modifierContributions=[{source:"external.attack-bonus",value:0}];
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,pending,EXTERNAL_D20_REDUCTION,"hero"));
  const accepted=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  },{modifierDiceFaces:{0:[8]}});
  assert.equal(accepted.status,"committed");
  if(accepted.status!=="committed") return;
  const result=accepted.results.attack as {natural:number;total:number;outcome:string;critical:boolean};
  assert.deepEqual({natural:result.natural,total:result.total,outcome:result.outcome,critical:result.critical},{natural:20,total:11,outcome:"success",critical:true});
  assert.equal(accepted.state.combatants.hero.life.hp.current,13,"successful natural 20 still applies downstream damage");
});

test("generic d20.roll interceptor rejects accept without authoritative modifier dice and spends nothing",()=>{
  const state=runtimeState();
  const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,abilityCheckPending(),EXTERNAL_D20_REDUCTION,"hero"));
  const rejected=resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
    interactionId:awaiting.interaction.id,
    idempotencyKey:awaiting.interaction.idempotencyKey,
    value:true,
  });
  assert.equal(rejected.status,"rejected");
  assert.match(rejected.status==="rejected"?rejected.error:"",/requires authoritative die face/);
  assert.equal(rejected.state.combatants.hero.economy.reaction,true);
  assert.equal(rejected.state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(rejected.state.revision,0);
});

test("generic d20.roll interceptor mechanics are invariant under definition identity rename",()=>{
  const run=(definition:CommonPlayReactionDefinition)=>{
    const state=runtimeState();
    const awaiting=requireAwaiting(startCommonPlayResolution(TEST_PROFILE,state,abilityCheckPending(),definition,"hero"));
    return resumeCommonPlayInteraction(TEST_PROFILE,state,awaiting,{
      interactionId:awaiting.interaction.id,
      idempotencyKey:awaiting.interaction.idempotencyKey,
      value:true,
    },{modifierDiceFaces:{0:[4]}});
  };
  const original=run(EXTERNAL_D20_REDUCTION);
  const renamed=structuredClone(EXTERNAL_D20_REDUCTION);
  renamed.id="external.unknown.renamed-roll-reduction";
  renamed.interceptors[0].id="renamed-interceptor";
  renamed.interceptors[0].interaction.id="renamed-interaction";
  renamed.interceptors[0].interaction.idempotencyKey="external.renamed.use";
  const changed=run(renamed);
  assert.equal(original.status,"committed");
  assert.equal(changed.status,"committed");
  if(original.status!=="committed"||changed.status!=="committed") return;
  const mechanical=(value:typeof original)=>{
    const result=value.results.check as {natural:number;modifier:number;total:number;target:number;outcome:string};
    return {natural:result.natural,modifier:result.modifier,total:result.total,target:result.target,outcome:result.outcome};
  };
  assert.deepEqual(mechanical(changed),mechanical(original));
});
