import assert from "node:assert/strict";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
} from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition() {
  return parseManualCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",
    id:"external.generic-reactive-consent",
    payments:[
      {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true},
    ],
    entryPoints:[{
      id:"reactive-mend",
      invocation:"manual",
      interaction:{
        id:"confirm-reaction",
        kind:"consent",
        responder:"actor",
        mode:"blocking",
        input:{type:"boolean"},
        revalidate:"always",
      },
      operations:[{kind:"healing.apply",amount:{value:5},target:"self"}],
    }],
  });
}

function input(interactionId="confirm-reaction") {
  return {
    resolutionId:"common-play-consent",
    actorId:"hero",
    entryPointId:"reactive-mend",
    targetId:"hero",
    interactionResponse:{interactionId,accepted:true as const},
  };
}

test("bounded actor consent and exact Reaction economy payment parse and lower through use-economy",()=>{
  const parsed=definition();
  assert.deepEqual(parsed.payments,[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}]);
  assert.deepEqual(parsed.entryPoints[0].interaction,{
    id:"confirm-reaction",kind:"consent",responder:"actor",mode:"blocking",input:{type:"boolean"},revalidate:"always",
  });
  const state=runtimeState();
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input());
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["use-economy","healing"]);
  assert.equal(pending.operations[0].kind,"use-economy");
  if(pending.operations[0].kind==="use-economy") assert.equal(pending.operations[0].slot,"reaction");
});

test("interaction compiler cannot be bypassed without matching accepted authorization",()=>{
  const state=runtimeState();
  const parsed=definition();
  assert.throws(
    ()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,{...input(),interactionResponse:undefined}),
    /requires accepted interaction authorization/,
  );
  assert.throws(
    ()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input("wrong-interaction")),
    /identity mismatch/,
  );
});

test("accepted consent spends one Reaction and applies downstream healing atomically",()=>{
  const state=runtimeState();
  state.combatants.hero.life.hp.current=10;
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition(),input());
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  assert.equal(committed.state.combatants.hero.economy.reaction,false);
  assert.equal(committed.state.combatants.hero.life.hp.current,15);
  assert.deepEqual(committed.events.map((event)=>event.kind),["use-economy","healing"]);
});

test("unavailable Reaction and later resource failure reject without any partial mutation",()=>{
  const unavailable=runtimeState();
  unavailable.combatants.hero.life.hp.current=10;
  unavailable.combatants.hero.economy.reaction=false;
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,unavailable,definition(),input());
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state.combatants.hero.life.hp.current,10);
  assert.equal(rejected.state.combatants.hero.economy.reaction,false);

  const withResource=parseManualCommonPlayOperationDefinition({
    ...definition(),
    payments:[
      {kind:"resource",resource:"spell-slot-1",amount:{value:1},consumeAt:"commit"},
      {kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true},
    ],
  });
  const insufficient=runtimeState();
  insufficient.combatants.hero.life.hp.current=10;
  insufficient.combatants.hero.resources.find((resource)=>resource.id==="spell-slot-1")!.current=0;
  const atomic=resolveCommonPlayEntryPointOperations(TEST_PROFILE,insufficient,withResource,input());
  assert.equal(atomic.status,"rejected");
  assert.equal(atomic.state.combatants.hero.economy.reaction,true);
  assert.equal(atomic.state.combatants.hero.life.hp.current,10);
});

test("target validation failure does not consume Reaction or apply downstream healing",()=>{
  const targeted=parseManualCommonPlayOperationDefinition({
    ...definition(),
    entryPoints:[{
      ...definition().entryPoints[0],
      targeting:{from:"targets",min:1,max:1},
      operations:[{kind:"healing.apply",amount:{value:5},target:"target"}],
    }],
  });
  const state=runtimeState();
  const before=state.combatants.hero.life.hp.current;
  const rejected=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,targeted,{
    ...input(),
    targetId:"missing",
    targetingTargets:[{id:"missing",kind:"creature",relation:"enemy"}],
    creatureKinds:{missing:"monster"},
  });
  assert.equal(rejected.status,"rejected");
  assert.equal(rejected.state.combatants.hero.economy.reaction,true);
  assert.equal(rejected.state.combatants.hero.life.hp.current,before);
});

test("unsupported interaction and economy payment shapes fail explicitly",()=>{
  const base=JSON.parse(JSON.stringify(definition())) as {
    payments:Array<Record<string,unknown>>;
    entryPoints:Array<{interaction:Record<string,unknown>}>;
  };
  const interactionCases:Array<[string,unknown]>= [
    ["kind","choice"],
    ["kind","adjudication"],
    ["responder","target"],
    ["responder","actor-owner"],
    ["responder","target-owner"],
    ["responder","dm"],
    ["responder","host"],
    ["mode","notice"],
    ["mode","input"],
    ["input",{type:"number"}],
    ["input",{type:"text"}],
    ["input",{type:"targets"}],
    ["input",{type:"choice",selector:{from:"targets",min:1,max:1}}],
    ["revalidate","if-revision-changed"],
    ["stalePolicy","restart"],
    ["idempotencyKey","external-key"],
  ];
  for(const [field,value] of interactionCases) {
    const candidate=structuredClone(base);
    candidate.entryPoints[0].interaction[field]=value;
    assert.throws(()=>parseManualCommonPlayOperationDefinition(candidate),/portable Common Play interaction|unsupported fields/);
  }
  const paymentCases:Array<Partial<Record<string,unknown>>>= [
    {bucket:"action"},
    {amount:{value:2}},
    {consumeAt:"stage"},
    {refundOnCancel:false},
  ];
  for(const patch of paymentCases) {
    const candidate=structuredClone(base);
    Object.assign(candidate.payments[0],patch);
    assert.throws(()=>parseManualCommonPlayOperationDefinition(candidate),/portable Common Play/);
  }
  const missingReaction=structuredClone(base);
  missingReaction.payments=[];
  assert.throws(()=>parseManualCommonPlayOperationDefinition(missingReaction),/requires exactly one Reaction/);
  const missingInteraction=structuredClone(base);
  delete (missingInteraction.entryPoints[0] as {interaction?:Record<string,unknown>}).interaction;
  assert.throws(()=>parseManualCommonPlayOperationDefinition(missingInteraction),/requires every entry point/);
});
