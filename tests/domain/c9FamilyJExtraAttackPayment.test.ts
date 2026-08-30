import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
} from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function replacementDefinition(id:string,entryPointId:string):CommonPlayOperationDefinition {
  return {
    schemaVersion:"0.2-draft",
    id,
    payments:[{
      kind:"economy",
      bucket:"action",
      amount:{value:1},
      consumeAt:"commit",
      refundOnCancel:true,
      actionKind:"attack",
      attacksPerAction:2,
    }],
    entryPoints:[{id:entryPointId,invocation:"manual",operations:[]}],
  };
}

function resolveReplacement(
  state:ReturnType<typeof runtimeState>,
  definition:CommonPlayOperationDefinition,
  entryPointId:string,
  suffix:string,
) {
  return resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{
    resolutionId:`resolution.${suffix}`,
    actorId:"hero",
    entryPointId,
  });
}

function readyState() {
  const state=runtimeState();
  state.clock.activeActorId="hero";
  state.clock.phase="action";
  return state;
}

test("unknown external control action replaces one attack through portable Extra Attack economy", () => {
  const definition=replacementDefinition("external.control.grapple-probe","attempt");
  const first=resolveReplacement(readyState(),definition,"attempt","first");
  assert.equal(first.status,"committed");
  if(first.status!=="committed") return;
  assert.equal(first.state.combatants.hero.economy.action,false);
  assert.equal(first.state.combatants.hero.economy.extraAttacks?.length,1);

  const second=resolveReplacement(first.state,definition,"attempt","second");
  assert.equal(second.status,"committed");
  if(second.status!=="committed") return;
  assert.equal(second.state.combatants.hero.economy.action,false);
  assert.equal(second.state.combatants.hero.economy.extraAttacks?.length,0);

  const third=resolveReplacement(second.state,definition,"attempt","third");
  assert.equal(third.status,"rejected");
});

test("renaming external control content preserves portable Extra Attack semantics", () => {
  const run=(id:string,entryPointId:string) => {
    const definition=replacementDefinition(id,entryPointId);
    const first=resolveReplacement(readyState(),definition,entryPointId,`${id}.first`);
    assert.equal(first.status,"committed");
    if(first.status!=="committed") return undefined;
    const second=resolveReplacement(first.state,definition,entryPointId,`${id}.second`);
    assert.equal(second.status,"committed");
    if(second.status!=="committed") return undefined;
    return {
      action:second.state.combatants.hero.economy.action,
      extraAttacks:second.state.combatants.hero.economy.extraAttacks?.length??0,
    };
  };

  assert.deepEqual(
    run("external.control.alpha","attempt-alpha"),
    run("external.control.renamed-beta","attempt-renamed-beta"),
  );
});

test("Extra Attack payment metadata is rejected outside the action attack bucket", () => {
  const invalid:CommonPlayOperationDefinition={
    schemaVersion:"0.2-draft",
    id:"external.control.invalid-extra-attack",
    payments:[{
      kind:"economy",
      bucket:"reaction",
      amount:{value:1},
      consumeAt:"commit",
      refundOnCancel:true,
      actionKind:"attack",
      attacksPerAction:2,
    }],
    entryPoints:[{id:"attempt",invocation:"manual",operations:[]}],
  };

  assert.throws(
    () => resolveReplacement(readyState(),invalid,"attempt","invalid"),
    /attacksPerAction requires bucket=action and actionKind=attack/,
  );
});
