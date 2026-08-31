import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayEntryPointOperations,
  parseManualCommonPlayOperationDefinition,
  resolveCommonPlayEntryPointOperations,
  type CommonPlayOperationDefinition,
  type CommonPlayOperationExecutionInput,
} from "../../src/domain/commonPlayOperationRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { RulesProfileLike } from "../../src/domain/profileEngine";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION = JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/resource-economy-action.json", import.meta.url),
  "utf8",
)) as CommonPlayOperationDefinition;

const PROFILE = {
  ...TEST_PROFILE,
  economy: {
    grantBuckets: {
      "action.extra.non-magic": {
        kind: "extra-action",
        allowsMagicAction: false,
      },
    },
  },
} as RulesProfileLike;

function preparedState() {
  const state = runtimeState();
  state.clock.activeActorId = "hero";
  state.clock.phase = "action";
  state.combatants.hero.resources.push(
    {
      id: "resource.external.primary",
      label: "External Primary",
      current: 1,
      maximum: 1,
      recovery: { shortRest: "all" },
    },
    {
      id: "resource.external.same-turn",
      label: "External Same Turn",
      current: 1,
      maximum: 1,
      recovery: { turnStart: "all" },
    },
  );
  return state;
}

function executionInput(resolutionId = "external-resource-economy-resolution"): CommonPlayOperationExecutionInput {
  return {
    resolutionId,
    actorId: "hero",
    entryPointId: "activate",
  };
}

function resourceCurrent(state: ReturnType<typeof runtimeState>, resourceId: string) {
  return state.combatants.hero.resources.find((entry) => entry.id === resourceId)?.current;
}

function useAction(
  state: ReturnType<typeof runtimeState>,
  id: string,
  actionKind: "magic" | "other",
) {
  return resolvePendingResolution(TEST_PROFILE, state, {
    id,
    actorId: "hero",
    sourceId: `external:${id}`,
    expectedRevision: state.revision,
    operations: [{
      id: `${id}:action`,
      kind: "use-economy",
      actorId: "hero",
      slot: "action",
      actionKind,
    }],
  });
}

test("Common Play lowers committed resource payments before generic economy effects", () => {
  assert.deepEqual(DEFINITION.payments?.map((payment) => payment.kind), ["resource", "resource"]);
  assert.deepEqual(DEFINITION.entryPoints[0]?.operations.map((operation) => operation.kind), ["economy.modify"]);

  const state = preparedState();
  const pending = compileCommonPlayEntryPointOperations(PROFILE, state, DEFINITION, executionInput());

  assert.equal(pending.sourceId, "external.unknown.resource-economy-action");
  assert.deepEqual(pending.operations.map((operation) => operation.kind), [
    "spend-resource",
    "spend-resource",
    "grant-extra-action",
  ]);

  const resolved = resolveCommonPlayEntryPointOperations(PROFILE, state, DEFINITION, executionInput());
  assert.equal(resolved.status, "committed");
  if (resolved.status !== "committed") return;

  assert.equal(resourceCurrent(resolved.state, "resource.external.primary"), 0);
  assert.equal(resourceCurrent(resolved.state, "resource.external.same-turn"), 0);
  assert.equal(resolved.state.combatants.hero.economy.action, true, "generic economy grant must not spend the normal Action");
  assert.deepEqual(resolved.state.combatants.hero.economy.extraActions?.map((entry) => entry.allowsMagicAction), [false]);
});

test("Common Play resource payments and economy effect commit atomically", () => {
  const state = preparedState();
  const sameTurn = state.combatants.hero.resources.find((entry) => entry.id === "resource.external.same-turn");
  assert.ok(sameTurn);
  sameTurn.current = 0;

  const rejected = resolveCommonPlayEntryPointOperations(PROFILE, state, DEFINITION, executionInput("atomic-rejection"));
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.state, state);
  assert.equal(resourceCurrent(state, "resource.external.primary"), 1, "failed later payment must roll back the earlier payment");
  assert.equal(state.combatants.hero.economy.extraActions?.length ?? 0, 0);
});

test("Common Play action and bonus-action payments spend the declared generic turn slot", () => {
  for (const bucket of ["action", "bonus-action"] as const) {
    const definition = parseManualCommonPlayOperationDefinition({
      schemaVersion:"0.2-draft",
      id:`external.unknown.${bucket}-payment`,
      payments:[{kind:"economy",bucket,amount:{value:1},consumeAt:"commit",refundOnCancel:true}],
      entryPoints:[{id:"activate",invocation:"manual",operations:[{kind:"healing.apply",amount:{value:1},target:"self"}]}],
    });
    const state=preparedState();
    state.combatants.hero.life.hp.current=10;
    const resolved=resolveCommonPlayEntryPointOperations(PROFILE,state,definition,executionInput(`${bucket}-payment`));
    assert.equal(resolved.status,"committed",resolved.status==="rejected"?resolved.error:undefined);
    if(resolved.status!=="committed") continue;
    assert.equal(resolved.state.combatants.hero.economy[bucket==="action"?"action":"bonusAction"],false);
    assert.equal(resolved.state.combatants.hero.life.hp.current,11);

    const rejected=resolveCommonPlayEntryPointOperations(PROFILE,resolved.state,definition,executionInput(`${bucket}-payment-repeat`));
    assert.equal(rejected.status,"rejected");
    assert.equal(rejected.state.combatants.hero.life.hp.current,11,"unavailable economy and downstream result stay atomic");
  }
});

test("profile-registered restricted extra Action preserves existing Magic Action policy", () => {
  const state = preparedState();
  const resolved = resolveCommonPlayEntryPointOperations(PROFILE, state, DEFINITION, executionInput("restricted-action"));
  assert.equal(resolved.status, "committed");
  if (resolved.status !== "committed") return;

  const noNormalAction = structuredClone(resolved.state);
  noNormalAction.combatants.hero.economy.action = false;
  const magic = useAction(noNormalAction, "external.magic", "magic");
  assert.equal(magic.status, "rejected");
  assert.equal(noNormalAction.combatants.hero.economy.extraActions?.length, 1);

  const attackState = structuredClone(resolved.state);
  attackState.combatants.hero.economy.action = false;
  const attack = useAction(attackState, "external.attack", "other");
  assert.equal(attack.status, "committed");
  if (attack.status !== "committed") return;
  assert.equal(attack.state.combatants.hero.economy.extraActions?.length, 0);
});

test("Common Play resource/economy semantics are invariant under external definition ID rename", () => {
  const state = preparedState();
  const renamed = structuredClone(DEFINITION);
  renamed.id = "external.previously-unseen.resource-economy-action";

  const pending = compileCommonPlayEntryPointOperations(PROFILE, state, renamed, executionInput("renamed-definition"));
  assert.equal(pending.sourceId, renamed.id);

  const resolved = resolveCommonPlayEntryPointOperations(PROFILE, state, renamed, executionInput("renamed-definition"));
  assert.equal(resolved.status, "committed");
  if (resolved.status !== "committed") return;
  assert.equal(resourceCurrent(resolved.state, "resource.external.primary"), 0);
  assert.equal(resourceCurrent(resolved.state, "resource.external.same-turn"), 0);
  assert.equal(resolved.state.combatants.hero.economy.extraActions?.[0]?.allowsMagicAction, false);
});

test("portable resource.change exposes temporary capacity through the canonical gain-resource operation",()=>{
  const definition=parseManualCommonPlayOperationDefinition({
    schemaVersion:"0.2-draft",
    id:"external.unknown.temporary-resource-capacity",
    entryPoints:[{
      id:"activate",
      invocation:"manual",
      operations:[{
        kind:"resource.change",
        resource:"resource.external.primary",
        amount:{value:0},
        maximumDelta:{value:1},
        temporaryCapacityUntilLongRest:true,
      }],
    }],
  });
  const state=preparedState();
  const pending=compileCommonPlayEntryPointOperations(PROFILE,state,definition,executionInput("portable-temporary-capacity"));
  const operation=pending.operations[0];
  assert.equal(operation?.kind,"gain-resource");
  if(operation?.kind!=="gain-resource") return;
  assert.equal(operation.amount,0);
  assert.equal(operation.maximumDelta,1);
  assert.equal(operation.temporaryCapacityUntilLongRest,true);

  const resolved=resolveCommonPlayEntryPointOperations(PROFILE,state,definition,executionInput("portable-temporary-capacity"));
  assert.equal(resolved.status,"committed",resolved.status==="rejected"?resolved.error:undefined);
  if(resolved.status!=="committed") return;
  const resource=resolved.state.combatants.hero.resources.find((entry)=>entry.id==="resource.external.primary");
  assert.equal(resource?.current,1);
  assert.equal(resource?.maximum,2);
  assert.equal(resource?.maximumAfterLongRest,1);
  const change=resolved.events.flatMap((event)=>event.stateChanges).find((entry)=>entry.kind==="resource"&&entry.resourceId==="resource.external.primary");
  assert.ok(change&&change.kind==="resource");
  assert.deepEqual(change.capacity,{
    before:{maximum:1,maximumAfterLongRest:null},
    after:{maximum:2,maximumAfterLongRest:1},
  });
});
