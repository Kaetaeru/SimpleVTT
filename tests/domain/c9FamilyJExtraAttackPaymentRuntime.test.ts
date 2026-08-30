import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function attackDefinition(id:string):CommonPlayOperationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id,
    payments:[{
      kind:"economy",
      bucket:"action",
      amount:{value:1},
      actionKind:"attack",
      attacksPerAction:2,
      consumeAt:"commit",
      refundOnCancel:true,
    }],
    entryPoints:[{
      id:"attack",
      invocation:"manual",
      operations:[],
    }],
  };
}

function attackState() {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  return state;
}

function resolveAttack(
  state:ReturnType<typeof runtimeState>,
  definition:CommonPlayOperationDefinition,
  resolutionId:string,
) {
  return resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId,
    actorId:"hero",
    entryPointId:"attack",
  });
}

test("portable Common Play attack payment spends one Action then its Extra Attack grant", () => {
  const definition=attackDefinition("external.family-j.extra-attack");
  const first=resolveAttack(attackState(),definition,"resolution.family-j.extra-attack.first");
  assert.equal(first.status,"committed");
  if(first.status!=="committed") return;
  assert.equal(first.state.combatants.hero.economy.action,false);
  assert.equal(first.state.combatants.hero.economy.extraAttacks?.length,1);

  const second=resolveAttack(first.state,definition,"resolution.family-j.extra-attack.second");
  assert.equal(second.status,"committed");
  if(second.status!=="committed") return;
  assert.equal(second.state.combatants.hero.economy.action,false);
  assert.equal(second.state.combatants.hero.economy.extraAttacks?.length,0);

  const third=resolveAttack(second.state,definition,"resolution.family-j.extra-attack.third");
  assert.equal(third.status,"rejected");
});

test("portable Extra Attack payment is invariant under unrelated external definition identity", () => {
  const first=resolveAttack(attackState(),attackDefinition("external.family-j.alpha"),"resolution.family-j.alpha");
  const renamed=resolveAttack(attackState(),attackDefinition("unrelated.portable.attack.beta"),"resolution.family-j.beta");
  assert.equal(first.status,"committed");
  assert.equal(renamed.status,"committed");
  if(first.status!=="committed"||renamed.status!=="committed") return;
  assert.deepEqual(
    {
      action:first.state.combatants.hero.economy.action,
      extraAttacks:first.state.combatants.hero.economy.extraAttacks?.length,
    },
    {
      action:renamed.state.combatants.hero.economy.action,
      extraAttacks:renamed.state.combatants.hero.economy.extraAttacks?.length,
    },
  );
});

test("portable attacksPerAction metadata is rejected outside an Attack Action payment", () => {
  const definition=attackDefinition("external.family-j.invalid-extra-attack");
  const payment=definition.payments?.[0];
  if(!payment||payment.kind!=="economy") throw new Error("economy payment fixture missing");
  payment.bucket="reaction";

  assert.throws(
    () => resolveAttack(attackState(),definition,"resolution.family-j.invalid-extra-attack"),
    /attacksPerAction requires bucket=action and actionKind=attack/,
  );
});
