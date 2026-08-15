import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm } from "../../src/app/contracts";
import { resolveActionCostTransaction } from "../../src/app/realActionCostService";

const ACTOR = { id:"hero", hp:20, maxHp:20, tempHp:0 };
const ECONOMY = { action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 };
const RESOURCES = [{ id:"resource.test", label:"테스트 자원", current:2, max:2, source:"test" }];

function action(overrides:Partial<ActionVm> = {}):ActionVm {
  return {
    id:"action.test",
    actorId:"hero",
    name:"테스트 행동",
    category:"basic",
    target:"self",
    economy:"행동",
    resolutionKind:"no-roll",
    summary:"test",
    available:true,
    eligibleTargetIds:["hero"],
    details:[],
    ...overrides,
  };
}

test("Phase 09 action costs commit economy and class resource spend as one ResolutionEvent transaction", () => {
  const result = resolveActionCostTransaction({
    resolutionId:"phase09.costs.commit",
    action:action({ resourceCost:{ resourceId:"resource.test", amount:1 } }),
    actor:ACTOR,
    economy:ECONOMY,
    resources:RESOURCES,
    initiativeMode:true,
  });

  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.economy.action,false);
  assert.equal(result.resources[0]?.current,1);
  assert.equal(result.eventCount,2);
  assert.deepEqual(result.stateChanges,["행동 사용","테스트 자원 2 → 1"]);
  assert.ok(result.provenance.some((entry) => entry.includes("action.test") && entry.includes("action spent")));
  assert.ok(result.provenance.some((entry) => entry.includes("테스트 자원 2 -> 1")));
});

test("Phase 09 action costs reject atomically when a later resource spend is invalid", () => {
  const result = resolveActionCostTransaction({
    resolutionId:"phase09.costs.rollback",
    action:action({ resourceCost:{ resourceId:"resource.test", amount:3 } }),
    actor:ACTOR,
    economy:ECONOMY,
    resources:RESOURCES,
    initiativeMode:true,
  });

  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/cannot spend 3/);
  assert.equal(result.economy.action,true,"economy spend must roll back with the rejected transaction");
  assert.equal(result.resources[0]?.current,2);
  assert.deepEqual(result.stateChanges,[]);
  assert.equal(result.eventCount,0);
});

test("Phase 09 action costs preserve freeform economy while still spending class resources", () => {
  const result = resolveActionCostTransaction({
    resolutionId:"phase09.costs.freeform",
    action:action({ economy:"추가 행동", resourceCost:{ resourceId:"resource.test", amount:1 } }),
    actor:ACTOR,
    economy:ECONOMY,
    resources:RESOURCES,
    initiativeMode:false,
  });

  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.economy.bonusAction,true);
  assert.equal(result.resources[0]?.current,1);
  assert.deepEqual(result.stateChanges,["테스트 자원 2 → 1"]);
  assert.equal(result.eventCount,1);
});

test("Phase 09 Bonus Action costs use an explicit granting rule at the application boundary", () => {
  const result = resolveActionCostTransaction({
    resolutionId:"phase09.costs.bonus",
    action:action({ economy:"추가 행동" }),
    actor:ACTOR,
    economy:ECONOMY,
    resources:RESOURCES,
    initiativeMode:true,
  });

  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.economy.bonusAction,false);
  assert.deepEqual(result.stateChanges,["추가 행동 사용"]);
});
