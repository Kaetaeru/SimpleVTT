import assert from "node:assert/strict";
import test from "node:test";
import { activeCastingProcess, advanceCastingProcess, beginCastingProcess, cancelCastingProcessOperations } from "../../src/domain/commonPlayCastingProcessRuntime";
import { normalizedSpellDefinitionById } from "../../src/domain/spellExecutionCatalog";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { compileInterruptedSpellCast, type SpellCasterContext } from "../../src/domain/spellcasting";
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

test("a different maintained cast replaces the old process atomically",()=>{
  const state=runtimeState();
  const first=resolvePendingResolution(TEST_PROFILE,state,beginCastingProcess({state,id:"cast.first",actorId:"hero",definitionId:"external.first",kind:"long-cast",requiredSeconds:60,useActionEconomy:false}));
  assert.equal(first.status,"committed");
  if(first.status!=="committed")return;
  const replacement=resolvePendingResolution(TEST_PROFILE,first.state,beginCastingProcess({state:first.state,id:"cast.second",actorId:"hero",definitionId:"external.second",kind:"ritual",requiredSeconds:600,useActionEconomy:false,replaceActive:true}));
  assert.equal(replacement.status,"committed");
  if(replacement.status!=="committed")return;
  assert.equal(activeCastingProcess(replacement.state,"hero","external.first"),undefined);
  assert.equal(activeCastingProcess(replacement.state,"hero","external.second","ritual")?.activity.status,"active");
  assert.equal(replacement.state.concentration.hero?.sourceId,"external.second");
});

test("interrupted casting spends its economy but preserves its slot under renamed external identity",()=>{
  const template=normalizedSpellDefinitionById("dnd.srd521.spell.counterspell");
  assert.ok(template);
  const caster:SpellCasterContext={characterLevel:5,spellAttackModifier:5,spellSaveDc:14,spellcastingAbilityModifier:3,preparedSpellIds:[],alwaysPreparedSpellIds:[],cantripSpellIds:[],slotResourceIds:{3:"spell-slot-1"}};
  const execute=(spellId:string)=>{
    const state=runtimeState();
    const definition={...structuredClone(template),spellId};
    const result=resolvePendingResolution(TEST_PROFILE,state,compileInterruptedSpellCast(definition,{
      id:`interrupt:${spellId}`,actorId:"hero",spellId,source:"prepared",expectedRevision:state.revision,caster,targets:[],slotLevel:3,useActionEconomy:true,
    }));
    assert.equal(result.status,"committed");
    if(result.status!=="committed")throw new Error(result.error);
    return {reaction:result.state.combatants.hero.economy.reaction,slot:result.state.combatants.hero.resources[0].current};
  };
  assert.deepEqual(execute("external.spell.counter-alpha"),execute("renamed.module.interrupt-omega"));
  assert.deepEqual(execute("external.spell.counter-alpha"),{reaction:false,slot:2});
});
