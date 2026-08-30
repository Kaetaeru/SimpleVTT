import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
} from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const AUTHORED={
  schemaVersion:"0.2-draft",
  id:"external.unknown.family-l-stabilization",
  entryPoints:[{
    id:"stabilize-target",
    invocation:"manual",
    operations:[{kind:"life.stabilize",target:"target"}],
  }],
};

function dyingState() {
  const state=runtimeState();
  state.combatants.goblin.life.hp.current=0;
  state.combatants.goblin.life.unconscious=true;
  state.combatants.goblin.life.deathSaves={successes:1,failures:2};
  return state;
}

test("unknown Common Play lowers portable stabilization through the generic Resolver",()=>{
  const parsed=parseManualCommonPlayOperationDefinition(AUTHORED);
  const state=dyingState();
  const input={resolutionId:"external-stabilize",actorId:"hero",targetId:"goblin",entryPointId:"stabilize-target"};
  const pending=compileCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input);
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),["stabilize"]);
  assert.equal((pending.operations[0] as {targetId?:string}).targetId,"goblin");

  const result=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,parsed,input);
  assert.equal(result.status,"committed");
  if(result.status!=="committed") return;
  assert.equal(result.state.combatants.goblin.life.stable,true);
  assert.equal(result.state.combatants.goblin.life.unconscious,true);
  assert.deepEqual(result.state.combatants.goblin.life.deathSaves,{successes:0,failures:0});
  assert.equal(result.events.some((event)=>event.kind==="stabilize"&&event.targetId==="goblin"),true);
});

test("portable stabilization is invariant under external definition and entry-point rename",()=>{
  const execute=(definition:typeof AUTHORED,entryPointId:string)=>{
    const result=resolveCommonPlayEntryPointOperations(TEST_PROFILE,dyingState(),parseManualCommonPlayOperationDefinition(definition),{
      resolutionId:"renamed-stabilize",actorId:"hero",targetId:"goblin",entryPointId,
    });
    assert.equal(result.status,"committed");
    if(result.status!=="committed") return undefined;
    return {life:result.state.combatants.goblin.life,eventKind:result.events.at(-1)?.kind};
  };
  const renamed=structuredClone(AUTHORED);
  renamed.id="external.unknown.family-l-stabilization-renamed";
  renamed.entryPoints[0].id="renamed-stabilize";
  assert.deepEqual(execute(renamed,"renamed-stabilize"),execute(AUTHORED,"stabilize-target"));
});

test("portable stabilization rejects named target dispatch and is present in the public schema",()=>{
  const invalid=structuredClone(AUTHORED) as any;
  invalid.entryPoints[0].operations[0].target="named-goblin";
  assert.throws(()=>parseManualCommonPlayOperationDefinition(invalid),/actor, self, or target/);

  const schema=JSON.parse(readFileSync(new URL("../../schemas/common-play-contract.schema.json",import.meta.url),"utf8"));
  assert.equal(schema.$defs.lifeStabilize.properties.kind.const,"life.stabilize");
  assert.equal(schema.$defs.operation.oneOf.some((entry:{"$ref"?:string})=>entry.$ref==="#/$defs/lifeStabilize"),true);
});
