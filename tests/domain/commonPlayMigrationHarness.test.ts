import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPoint,
  resolveCommonPlayEntryPoint,
  type CommonPlayDefinition,
} from "../../src/domain/commonPlayExecutionRuntime";
import { resolveFighterActionSurge } from "../../src/domain/fighterActionSurge";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/action-economy-migration.json",import.meta.url),
  "utf8",
)) as CommonPlayDefinition;

const PROFILE={
  ...TEST_PROFILE,
  commonPlay:{
    economyBuckets:{
      "extra-action.no-magic":{
        kind:"extra-action" as const,
        allowsMagicAction:false,
      },
    },
  },
};

function preparedState() {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  state.combatants.hero.resources.push(
    { id:"probe.daily", label:"Probe Daily", current:1, maximum:1, recovery:{ longRest:"all" } },
    { id:"probe.turn", label:"Probe Turn", current:1, maximum:1, recovery:{ turnStart:"all" } },
  );
  return state;
}

function genericInput(resolutionId="external-action-economy-resolution") {
  return {
    resolutionId,
    actorId:"hero",
    entryPointId:"activate",
  };
}

function snapshot(state: ReturnType<typeof preparedState>) {
  return {
    daily:state.combatants.hero.resources.find((resource)=>resource.id==="probe.daily")?.current,
    turn:state.combatants.hero.resources.find((resource)=>resource.id==="probe.turn")?.current,
    grants:state.combatants.hero.economy.extraActionGrants.map((grant)=>({
      allowsMagicAction:grant.allowsMagicAction,
    })),
  };
}

test("M1 generic Common Play harness lowers unknown action/resource/economy JSON into one atomic resolution",()=>{
  const state=preparedState();
  const pending=compileCommonPlayEntryPoint(PROFILE,state,DEFINITION,genericInput());

  assert.equal(pending.sourceId,"external.unknown.action-economy");
  assert.deepEqual(pending.operations.map((operation)=>operation.kind),[
    "spend-resource",
    "spend-resource",
    "grant-extra-action",
  ]);

  const resolved=resolveCommonPlayEntryPoint(PROFILE,state,DEFINITION,genericInput());
  assert.equal(resolved.status,"committed");
  if (resolved.status!=="committed") return;
  assert.deepEqual(snapshot(resolved.state),{
    daily:0,
    turn:0,
    grants:[{ allowsMagicAction:false }],
  });
});

test("M1 generic action/economy behavior matches the legacy Action Surge golden semantics",()=>{
  const genericState=preparedState();
  const legacyState=structuredClone(genericState);

  const generic=resolveCommonPlayEntryPoint(PROFILE,genericState,DEFINITION,genericInput("generic-parity"));
  const legacy=resolveFighterActionSurge(TEST_PROFILE,legacyState,{
    id:"legacy-parity",
    actorId:"hero",
    expectedRevision:legacyState.revision,
    fighterLevel:2,
    resourceId:"probe.daily",
    turnGateResourceId:"probe.turn",
  });

  assert.equal(generic.status,"committed");
  assert.equal(legacy.status,"committed");
  if (generic.status!=="committed" || legacy.status!=="committed") return;
  assert.deepEqual(snapshot(generic.state),snapshot(legacy.state));
});

test("M1 generic action/economy behavior is invariant under external content id rename",()=>{
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.action-economy";

  const first=resolveCommonPlayEntryPoint(PROFILE,preparedState(),DEFINITION,genericInput("original-id"));
  const second=resolveCommonPlayEntryPoint(PROFILE,preparedState(),renamed,genericInput("renamed-id"));

  assert.equal(first.status,"committed");
  assert.equal(second.status,"committed");
  if (first.status!=="committed" || second.status!=="committed") return;
  assert.deepEqual(snapshot(first.state),snapshot(second.state));
});

test("M1 generic legality rejects the same action when the actor is not the active actor",()=>{
  const state=preparedState();
  state.clock.activeActorId="goblin";

  const resolved=resolveCommonPlayEntryPoint(PROFILE,state,DEFINITION,genericInput("wrong-turn"));
  assert.equal(resolved.status,"rejected");
  assert.equal(resolved.state,state);
  assert.deepEqual(snapshot(state),{
    daily:1,
    turn:1,
    grants:[],
  });
});
