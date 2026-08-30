import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayEntryPointOperations, parseCommonPlayOperationDefinition } from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("portable attack DC can read structural target profile properties",()=>{
  const definition=parseCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",id:"external.target-ac",
    entryPoints:[{id:"attack",invocation:"manual",test:{kind:"attack-roll",roller:"actor",dc:{ref:"target.defense.ac"}},operations:[]}],
  });
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"target-ac",actorId:"hero",entryPointId:"attack",targetId:"goblin",
    actorProperties:{},targetProperties:{"defense.ac":17},
    d20:{faces:[12],targetId:"goblin",modifierContributions:[]},
  });
  const operation=pending.operations.find((candidate)=>candidate.kind==="d20");
  assert.equal(operation?.kind,"d20");
  if(operation?.kind==="d20") assert.equal(operation.request.target,17);
  assert.throws(()=>compileCommonPlayEntryPointOperations(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"missing-target-ac",actorId:"hero",entryPointId:"attack",targetId:"goblin",
    actorProperties:{},targetProperties:{},d20:{faces:[12],targetId:"goblin",modifierContributions:[]},
  }),/d20 target property is unavailable: target\.defense\.ac/);
});
