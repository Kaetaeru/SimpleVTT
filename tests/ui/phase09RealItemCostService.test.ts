import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm, EconomyVm, ItemInstanceVm } from "../../src/app/contracts";
import { resolveItemCostTransaction } from "../../src/app/realItemCostService";

const ACTOR = { id:"char.aelar", hp:31, maxHp:42, tempHp:5 };
const ECONOMY:EconomyVm = { action:true, bonusAction:true, reaction:true, movement:30, movementMax:30 };
const ITEMS:ItemInstanceVm[] = [
  { id:"item.potion.aelar", definitionId:"item.potion", name:"치유 물약", kind:"consumable", quantity:2, equipped:false, passiveEffects:[], grantedActionIds:["action.healing-potion"], provenance:["test"] },
  { id:"item.wand.aelar", definitionId:"item.wand", name:"마법 미사일 완드", kind:"magic", quantity:1, equipped:false, charges:{ current:7, max:7 }, passiveEffects:[], grantedActionIds:["action.wand"], provenance:["test"] },
];

function action(overrides:Partial<ActionVm>):ActionVm {
  return {
    id:"action.test-item",
    actorId:"char.aelar",
    name:"아이템 사용",
    category:"magic",
    target:"self",
    economy:"행동",
    resolutionKind:"no-roll",
    summary:"test",
    available:true,
    eligibleTargetIds:["char.aelar"],
    details:[],
    ...overrides,
  };
}

test("item quantity and Action economy commit atomically through the rules transaction", () => {
  const result = resolveItemCostTransaction({
    resolutionId:"phase09.item.quantity",
    action:action({ itemCost:{ itemId:"item.potion.aelar", quantity:1 } }),
    actor:ACTOR,
    economy:ECONOMY,
    items:ITEMS,
    initiativeMode:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.economy.action,false);
  assert.equal(result.items.find((item) => item.id === "item.potion.aelar")?.quantity,1);
  assert.deepEqual(result.stateChanges,["행동 사용","치유 물약 수량 2 → 1"]);
  assert.equal(result.eventCount,2);
  assert.ok(result.provenance.some((entry) => entry.includes("치유 물약 수량 2 -> 1")));
});

test("item charges and Action economy commit atomically through the same transaction", () => {
  const result = resolveItemCostTransaction({
    resolutionId:"phase09.item.charge",
    action:action({ itemCost:{ itemId:"item.wand.aelar", charges:1 } }),
    actor:ACTOR,
    economy:ECONOMY,
    items:ITEMS,
    initiativeMode:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.economy.action,false);
  assert.equal(result.items.find((item) => item.id === "item.wand.aelar")?.charges?.current,6);
  assert.deepEqual(result.stateChanges,["행동 사용","마법 미사일 완드 충전 7 → 6"]);
  assert.equal(result.eventCount,2);
});

test("insufficient item quantity rejects the whole transaction and leaves Action available", () => {
  const result = resolveItemCostTransaction({
    resolutionId:"phase09.item.rollback",
    action:action({ itemCost:{ itemId:"item.potion.aelar", quantity:3 } }),
    actor:ACTOR,
    economy:ECONOMY,
    items:ITEMS,
    initiativeMode:true,
  });
  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/cannot spend 3/);
  assert.equal(result.economy.action,true);
  assert.equal(result.items.find((item) => item.id === "item.potion.aelar")?.quantity,2);
  assert.deepEqual(result.stateChanges,[]);
});

test("missing ItemInstance rejects before any economy projection", () => {
  const result = resolveItemCostTransaction({
    resolutionId:"phase09.item.missing",
    action:action({ itemCost:{ itemId:"item.missing", quantity:1 } }),
    actor:ACTOR,
    economy:ECONOMY,
    items:ITEMS,
    initiativeMode:true,
  });
  assert.equal(result.status,"rejected");
  if (result.status !== "rejected") return;
  assert.match(result.error,/missing ItemInstance/);
  assert.equal(result.economy.action,true);
});
