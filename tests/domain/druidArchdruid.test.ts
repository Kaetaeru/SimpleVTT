import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUID_NATURE_MAGICIAN_RESOURCE_ID,
  DRUID_WILD_SHAPE_RESOURCE_ID,
} from "../../src/domain/coreClassResources";
import {
  natureMagicianSlotLevel,
  resolveArchdruidInitiative,
  resolveNatureMagician,
} from "../../src/domain/druidArchdruid";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function archdruidState(wildShapeCurrent = 4) {
  const state = runtimeState();
  state.combatants.hero.resources.push(
    {
      id:DRUID_WILD_SHAPE_RESOURCE_ID,
      label:"Wild Shape",
      current:wildShapeCurrent,
      maximum:4,
      recovery:{ shortRest:1, longRest:"all" },
    },
    {
      id:DRUID_NATURE_MAGICIAN_RESOURCE_ID,
      label:"Nature Magician",
      current:1,
      maximum:1,
      recovery:{ longRest:"all" },
    },
    {
      id:"spell-slot-2",
      label:"2nd-level Spell Slot",
      current:3,
      maximum:3,
      recovery:{ longRest:"all" },
    },
    {
      id:"spell-slot-4",
      label:"4th-level Spell Slot",
      current:2,
      maximum:3,
      recovery:{ longRest:"all" },
    },
    {
      id:"spell-slot-6",
      label:"6th-level Spell Slot",
      current:0,
      maximum:2,
      recovery:{ longRest:"all" },
    },
    {
      id:"spell-slot-8",
      label:"8th-level Spell Slot",
      current:1,
      maximum:1,
      recovery:{ longRest:"all" },
    },
  );
  return state;
}

const slotResourceIds = {
  2:"spell-slot-2",
  4:"spell-slot-4",
  6:"spell-slot-6",
  8:"spell-slot-8",
};

test("Nature Magician converts 1-4 Wild Shape uses into exactly 2/4/6/8 spell levels", () => {
  assert.equal(natureMagicianSlotLevel(1),2);
  assert.equal(natureMagicianSlotLevel(2),4);
  assert.equal(natureMagicianSlotLevel(3),6);
  assert.equal(natureMagicianSlotLevel(4),8);
  assert.throws(() => natureMagicianSlotLevel(0),/1-4 Wild Shape/);
  assert.throws(() => natureMagicianSlotLevel(5),/1-4 Wild Shape/);
});

test("Nature Magician atomically spends Wild Shape plus its Long-Rest gate and creates one temporary spell-slot capacity", () => {
  const state = archdruidState(4);
  const result = resolveNatureMagician(TEST_PROFILE,state,{
    id:"archdruid.nature-magician.4",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    wildShapeUses:2,
    slotResourceIds,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const wildShape = result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID);
  const usage = result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID);
  const slot = result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-4");
  assert.equal(wildShape?.current,2);
  assert.equal(usage?.current,0);
  assert.deepEqual(
    { current:slot?.current, maximum:slot?.maximum, maximumAfterLongRest:slot?.maximumAfterLongRest },
    { current:3, maximum:4, maximumAfterLongRest:3 },
  );
});

test("Nature Magician supports the maximum four-use conversion to a level-8 slot and rejects missing uses atomically", () => {
  const state = archdruidState(4);
  const success = resolveNatureMagician(TEST_PROFILE,state,{
    id:"archdruid.nature-magician.8",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    wildShapeUses:4,
    slotResourceIds,
  });
  assert.equal(success.status,"committed");
  if (success.status !== "committed") return;
  const slot = success.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-8");
  assert.deepEqual({ current:slot?.current, maximum:slot?.maximum },{ current:2, maximum:2 });

  const insufficient = archdruidState(1);
  const rejected = resolveNatureMagician(TEST_PROFILE,insufficient,{
    id:"archdruid.nature-magician.reject",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    wildShapeUses:2,
    slotResourceIds,
  });
  assert.equal(rejected.status,"rejected");
  assert.match(rejected.status === "rejected" ? rejected.error : "",/requires 2 unexpended Wild Shape uses/);
  assert.equal(rejected.state,insufficient);
  assert.equal(insufficient.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID)?.current,1);
});

test("Long Rest removes Nature Magician temporary slot capacity and restores ordinary slot and feature resources", () => {
  const state = archdruidState(4);
  const created = resolveNatureMagician(TEST_PROFILE,state,{
    id:"archdruid.nature-magician.long-rest",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    wildShapeUses:1,
    slotResourceIds,
  });
  assert.equal(created.status,"committed");
  if (created.status !== "committed") return;
  let slot = created.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2");
  assert.deepEqual({ current:slot?.current, maximum:slot?.maximum, maximumAfterLongRest:slot?.maximumAfterLongRest },{
    current:4,
    maximum:4,
    maximumAfterLongRest:3,
  });

  const rested = resolvePendingResolution(TEST_PROFILE,created.state,{
    id:"archdruid.long-rest",
    actorId:"hero",
    sourceId:"test:long-rest",
    expectedRevision:1,
    operations:[{ id:"archdruid.long-rest:rest", kind:"long-rest", targetId:"hero" }],
  });
  assert.equal(rested.status,"committed");
  if (rested.status !== "committed") return;
  slot = rested.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2");
  assert.deepEqual({ current:slot?.current, maximum:slot?.maximum, maximumAfterLongRest:slot?.maximumAfterLongRest },{
    current:3,
    maximum:3,
    maximumAfterLongRest:undefined,
  });
  assert.equal(rested.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURE_MAGICIAN_RESOURCE_ID)?.current,1);
  assert.equal(rested.state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,4);
});

test("Evergreen Wild Shape restores exactly one use only when a level-20 Druid actually rolls Initiative at zero uses", () => {
  const state = archdruidState(0);
  const result = resolveArchdruidInitiative(TEST_PROFILE,state,{
    id:"archdruid.initiative",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    entries:[
      { id:"goblin", controller:"gm", total:17 },
      { id:"hero", controller:"player", total:12 },
    ],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.restoredWildShape,true);
  assert.deepEqual(result.initiative.map((group) => group.participantIds),[["goblin"],["hero"]]);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
});

test("Evergreen Wild Shape neither overfills an existing use nor fires without an Initiative entry", () => {
  const state = archdruidState(1);
  const noRestore = resolveArchdruidInitiative(TEST_PROFILE,state,{
    id:"archdruid.initiative.no-restore",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    entries:[{ id:"hero", controller:"player", total:12 }],
  });
  assert.equal(noRestore.status,"committed");
  if (noRestore.status === "committed") {
    assert.equal(noRestore.restoredWildShape,false);
    assert.equal(noRestore.state.combatants.hero.resources.find((pool) => pool.id === DRUID_WILD_SHAPE_RESOURCE_ID)?.current,1);
  }

  const missing = archdruidState(0);
  const rejected = resolveArchdruidInitiative(TEST_PROFILE,missing,{
    id:"archdruid.initiative.missing",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:20,
    entries:[{ id:"goblin", controller:"gm", total:17 }],
  });
  assert.equal(rejected.status,"rejected");
  assert.match(rejected.status === "rejected" ? rejected.error : "",/requires the actor to roll Initiative/);
  assert.equal(rejected.state,missing);
});
