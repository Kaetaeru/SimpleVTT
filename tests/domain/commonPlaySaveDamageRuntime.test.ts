import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlaySaveDamageEntryPoint,
  resolveCommonPlaySaveDamageEntryPoint,
  type CommonPlaySaveDamageDefinition,
  type CommonPlaySaveDamageExecutionInput,
} from "../../src/domain/commonPlayEntryPointRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/multi-target-save-damage.json",import.meta.url),
  "utf8",
)) as CommonPlaySaveDamageDefinition;

function preparedState() {
  const state=runtimeState();
  state.combatants.goblin.life.hp={ current:30, maximum:30, temporary:0 };
  state.combatants.orc=structuredClone(state.combatants.goblin);
  state.combatants.orc.id="orc";
  state.combatants.orc.life.hp={ current:30, maximum:30, temporary:0 };
  state.combatants.orc.damageDefenses=[{
    source:"external.fire-resistance",
    kind:"resistance",
    damageType:"fire",
  }];
  return state;
}

function executionInput():CommonPlaySaveDamageExecutionInput {
  return {
    resolutionId:"external-area-save-resolution",
    actorId:"hero",
    entryPointId:"release",
    damageFaces:[6,5,4,3],
    targets:[
      {
        facts:{
          id:"goblin",
          kind:"creature",
          relation:"enemy",
          distanceFeet:20,
          visible:true,
          cover:"none",
        },
        creatureKind:"monster",
        save:{ faces:[5] },
      },
      {
        facts:{
          id:"orc",
          kind:"creature",
          relation:"enemy",
          distanceFeet:25,
          visible:true,
          cover:"none",
        },
        creatureKind:"monster",
        save:{ faces:[16] },
      },
    ],
  };
}

test("Common Play compiles an unknown multi-target save damage entry point into one shared atomic resolution",()=>{
  const state=preparedState();
  const input=executionInput();
  const pending=compileCommonPlaySaveDamageEntryPoint(state,DEFINITION,input);

  assert.equal(pending.sourceId,"external.unknown.area-save-damage");
  assert.equal(pending.operations.filter((operation)=>operation.kind==="targeting").length,1);
  assert.equal(pending.operations.filter((operation)=>operation.kind==="damage-roll").length,1);
  assert.equal(pending.operations.filter((operation)=>operation.kind==="d20").length,2);
  assert.equal(pending.operations.filter((operation)=>operation.kind==="damage").length,4);

  const resolved=resolveCommonPlaySaveDamageEntryPoint(TEST_PROFILE,state,DEFINITION,input);
  assert.equal(resolved.status,"committed");
  if (resolved.status!=="committed") return;

  assert.equal(resolved.state.revision,1);
  assert.equal(resolved.state.combatants.goblin.life.hp.current,12);
  assert.equal(resolved.state.combatants.orc.life.hp.current,26);
  assert.equal((resolved.results["common-play-shared-damage-roll"] as {total:number}).total,18);
  assert.equal((resolved.results["common-play-save-1"] as {outcome:string}).outcome,"failure");
  assert.equal((resolved.results["common-play-save-2"] as {outcome:string}).outcome,"success");
  assert.equal((resolved.results["common-play-damage-1-full"] as {finalDamage:number}).finalDamage,18);
  assert.deepEqual(resolved.results["common-play-damage-1-half"],{ skipped:true });
  assert.deepEqual(resolved.results["common-play-damage-2-full"],{ skipped:true });
  assert.equal((resolved.results["common-play-damage-2-half"] as {raw:number;finalDamage:number}).raw,9);
  assert.equal((resolved.results["common-play-damage-2-half"] as {finalDamage:number}).finalDamage,4);

  const targeting=resolved.results["common-play-targets"] as {targets:Array<{targetId:string}>};
  assert.deepEqual(targeting.targets.map((target)=>target.targetId),["goblin","orc"]);
  assert.equal(resolved.events.every((event)=>event.resolutionId===input.resolutionId),true);
  assert.equal(resolved.state.history.every((entry)=>entry.resolutionId===input.resolutionId),true);
});

test("Common Play late invalid target input rolls back damage already staged for earlier targets",()=>{
  const state=preparedState();
  const input=executionInput();
  input.targets[1].save.faces=[21];

  const rejected=resolveCommonPlaySaveDamageEntryPoint(TEST_PROFILE,state,DEFINITION,input);
  assert.equal(rejected.status,"rejected");
  if (rejected.status!=="rejected") return;
  assert.equal(rejected.failedOperationId,"common-play-save-2");
  assert.equal(rejected.state,state);
  assert.equal(state.revision,0);
  assert.equal(state.combatants.goblin.life.hp.current,30);
  assert.equal(state.combatants.orc.life.hp.current,30);
  assert.deepEqual(state.history,[]);
});

test("Common Play save damage behavior is independent of the external content id",()=>{
  const state=preparedState();
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.payload";
  const input=executionInput();
  input.resolutionId="renamed-external-resolution";

  const pending=compileCommonPlaySaveDamageEntryPoint(state,renamed,input);
  assert.equal(pending.sourceId,"external.previously-unseen.payload");

  const resolved=resolveCommonPlaySaveDamageEntryPoint(TEST_PROFILE,state,renamed,input);
  assert.equal(resolved.status,"committed");
  if (resolved.status!=="committed") return;
  assert.equal(resolved.state.combatants.goblin.life.hp.current,12);
  assert.equal(resolved.state.combatants.orc.life.hp.current,26);
});
