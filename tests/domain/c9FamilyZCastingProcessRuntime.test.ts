import assert from "node:assert/strict";
import test from "node:test";
import { activeCastingProcess, advanceCastingProcess, beginCastingProcess, cancelCastingProcessOperations } from "../../src/domain/commonPlayCastingProcessRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function run(definitionId:string,kind:"long-cast"|"ritual"="long-cast") {
  const initial=runtimeState();
  const begun=resolvePendingResolution(TEST_PROFILE,initial,beginCastingProcess({state:initial,id:"process",actorId:"hero",definitionId,kind,requiredSeconds:60,useActionEconomy:false}));
  assert.equal(begun.status,"committed");
  if(begun.status!=="committed")throw new Error(begun.error);
  const active=activeCastingProcess(begun.state,"hero",definitionId)!;
  const advanced=advanceCastingProcess({state:begun.state,id:"advance",actorId:"hero",definitionId,elapsedSeconds:54,useActionEconomy:false});
  assert.equal(advanced.activity.status,"active");
  const progressed=resolvePendingResolution(TEST_PROFILE,begun.state,{id:"advance",actorId:"hero",sourceId:definitionId,expectedRevision:begun.state.revision,operations:advanced.operations});
  assert.equal(progressed.status,"committed");
  if(progressed.status!=="committed")throw new Error(progressed.error);
  const completed=advanceCastingProcess({state:progressed.state,id:"finish",actorId:"hero",definitionId,elapsedSeconds:6,useActionEconomy:false});
  assert.equal(completed.activity.status,"completed");
  return {initial,begun,progressed,active,completed};
}

test("casting process persists as Resolver effect and advances to completion",()=>{
  const result=run("external.spell.alpha");
  assert.equal(activeCastingProcess(result.progressed.state,"hero")?.activity.elapsedSeconds,54);
  const cancelled=resolvePendingResolution(TEST_PROFILE,result.progressed.state,{id:"cancel",actorId:"hero",sourceId:"external.spell.alpha",expectedRevision:result.progressed.state.revision,operations:cancelCastingProcessOperations(result.active.effect,"hero","completed")});
  assert.equal(cancelled.status,"committed");
  if(cancelled.status==="committed")assert.equal(activeCastingProcess(cancelled.state,"hero"),undefined);
});

test("casting process behavior is invariant under external spell identity rename",()=>{
  const left=run("external.spell.alpha");
  const right=run("renamed.spell.omega");
  assert.deepEqual({elapsed:left.completed.activity.elapsedSeconds,status:left.completed.activity.status},{elapsed:right.completed.activity.elapsedSeconds,status:right.completed.activity.status});
});

test("ritual uses the same persisted maintained-casting lifecycle",()=>{
  const result=run("external.ritual.alpha","ritual");
  assert.equal(activeCastingProcess(result.progressed.state,"hero")?.activity.kind,"ritual");
  assert.equal(result.completed.activity.status,"completed");
});

test("generic incapacitation termination interrupts maintained casting and its concentration",()=>{
  const initial=runtimeState();
  const begun=resolvePendingResolution(TEST_PROFILE,initial,beginCastingProcess({state:initial,id:"interruptible",actorId:"hero",definitionId:"external.interruptible",kind:"long-cast",requiredSeconds:60,useActionEconomy:false}));
  assert.equal(begun.status,"committed");
  if(begun.status!=="committed")return;
  const interrupted=resolvePendingResolution(TEST_PROFILE,begun.state,{
    id:"interrupt",actorId:"goblin",sourceId:"external.stun",expectedRevision:begun.state.revision,
    operations:[{id:"stun",kind:"apply-effect",effect:{id:"stun:hero",sourceId:"external.stun",sourceActorId:"goblin",targetId:"hero",kind:"condition",conditionId:"stunned",duration:{kind:"rounds",amount:1,anchorActorId:"hero",boundary:"end"}}}],
  });
  assert.equal(interrupted.status,"committed");
  if(interrupted.status!=="committed")return;
  assert.equal(activeCastingProcess(interrupted.state,"hero"),undefined);
  assert.equal(interrupted.state.concentration.hero,undefined);
});
