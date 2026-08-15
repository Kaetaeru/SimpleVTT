import assert from "node:assert/strict";
import test from "node:test";
import {
  DRUID_CIRCLE_LAND_SUBCLASS_ID,
} from "../../src/domain/druidCircleLand";
import {
  DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID,
  DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID,
  circleLandSpellEntries,
  naturalRecoveryResourcePools,
  naturalRecoverySlotLevelBudget,
  naturalRecoverySpellEntries,
  resolveNaturalRecoveryCircleSpell,
  resolveNaturalRecoverySlotRest,
} from "../../src/domain/druidCircleLandRecovery";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import type { SpellCastRequest } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const BURNING_HANDS = "dnd.srd521.spell.burning-hands";
const FIRE_BOLT = "dnd.srd521.spell.fire-bolt";

function addRecoveryResources() {
  const state = runtimeState();
  state.combatants.hero.resources.push(
    ...naturalRecoveryResourcePools(6,DRUID_CIRCLE_LAND_SUBCLASS_ID),
  );
  return state;
}

test("Circle land spell relationships use stable spell IDs and Natural Recovery excludes cantrips", () => {
  const arid3 = circleLandSpellEntries("arid",3);
  assert.deepEqual(arid3.map((entry) => [entry.id,entry.spellLevel]),[
    ["dnd.srd521.spell.blur",2],
    [BURNING_HANDS,1],
    [FIRE_BOLT,0],
  ]);
  const recovery6 = naturalRecoverySpellEntries("arid",6);
  assert.ok(recovery6.some((entry) => entry.id === BURNING_HANDS));
  assert.ok(recovery6.some((entry) => entry.id === "dnd.srd521.spell.fireball"));
  assert.ok(!recovery6.some((entry) => entry.id === FIRE_BOLT),"Natural Recovery free cast requires a level 1+ Circle Spell");
});

test("Natural Recovery casts an eligible Circle Spell without a spell slot and spends only its Long-Rest cast resource", () => {
  const state = addRecoveryResources();
  const request:SpellCastRequest = {
    id:"natural-recovery.cast",
    actorId:"hero",
    spellId:BURNING_HANDS,
    source:"prepared",
    expectedRevision:0,
    caster:{
      characterLevel:6,
      spellAttackModifier:6,
      spellSaveDc:14,
      spellcastingAbilityModifier:4,
      preparedSpellIds:[],
      alwaysPreparedSpellIds:[],
      cantripSpellIds:[],
      slotResourceIds:{ 1:"spell-slot-1" },
    },
    targets:[{
      id:"goblin",
      kind:"creature",
      relation:"enemy",
      distanceFeet:10,
      visible:true,
      cover:"none",
      ac:12,
      creatureKind:"monster",
      saveModifiers:{ dex:0 },
      targetCanSeeCaster:true,
    }],
    componentsSatisfied:true,
    useActionEconomy:true,
    dice:{
      saves:{ goblin:{ id:"burning-hands-save", purpose:"Dexterity save", sides:20, faces:[5] } },
      effectFaces:[3,4,5],
    },
  };
  const result = resolveNaturalRecoveryCircleSpell(
    TEST_PROFILE,
    SRD_521_SPELL_MECHANICS[BURNING_HANDS],
    state,
    request,
    { druidLevel:6, subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID, landType:"arid" },
  );
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,3,"Burning Hands deals 12 fire damage on the failed save");
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current,2,"free Circle Spell cast does not spend a spell slot");
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID)?.current,0);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID)?.current,1,"slot-recovery use remains independent");
  assert.equal(result.state.combatants.hero.economy.action,false);
});

test("Natural Recovery Short Rest restores multiple expended level 1-5 slots within the ceil(level/2) budget", () => {
  assert.equal(naturalRecoverySlotLevelBudget(6),3);
  assert.equal(naturalRecoverySlotLevelBudget(7),4);
  const state = addRecoveryResources();
  state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")!.current = 1;
  state.combatants.hero.resources.push({
    id:"spell-slot-2",
    label:"2레벨 주문 슬롯",
    current:0,
    maximum:1,
    recovery:{ longRest:"all" },
  });
  const result = resolveNaturalRecoverySlotRest(TEST_PROFILE,state,{
    id:"natural-recovery.slots",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    selections:[
      { slotLevel:2, resourceId:"spell-slot-2", amount:1 },
      { slotLevel:1, resourceId:"spell-slot-1", amount:1 },
    ],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2")?.current,1);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current,2);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID)?.current,0);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURAL_RECOVERY_CAST_RESOURCE_ID)?.current,1);
});

test("Natural Recovery rejects over-budget, level 6+, and non-expended slot selections before spending its use", () => {
  const state = addRecoveryResources();
  state.combatants.hero.resources.push(
    { id:"spell-slot-2", label:"2레벨 주문 슬롯", current:0, maximum:2, recovery:{ longRest:"all" } },
    { id:"spell-slot-6", label:"6레벨 주문 슬롯", current:0, maximum:1, recovery:{ longRest:"all" } },
  );
  const overBudget = resolveNaturalRecoverySlotRest(TEST_PROFILE,state,{
    id:"natural-recovery.over-budget",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    selections:[{ slotLevel:2, resourceId:"spell-slot-2", amount:2 }],
  });
  assert.equal(overBudget.status,"rejected");
  assert.match(overBudget.status === "rejected" ? overBudget.error : "",/exceed budget/);
  assert.equal(overBudget.state.combatants.hero.resources.find((pool) => pool.id === DRUID_NATURAL_RECOVERY_SLOTS_RESOURCE_ID)?.current,1);

  const levelSix = resolveNaturalRecoverySlotRest(TEST_PROFILE,state,{
    id:"natural-recovery.level-six",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:12,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    selections:[{ slotLevel:6, resourceId:"spell-slot-6", amount:1 }],
  });
  assert.equal(levelSix.status,"rejected");
  assert.match(levelSix.status === "rejected" ? levelSix.error : "",/level 1-5/);

  const fullSlot = resolveNaturalRecoverySlotRest(TEST_PROFILE,state,{
    id:"natural-recovery.full-slot",
    actorId:"hero",
    expectedRevision:0,
    druidLevel:6,
    subclassId:DRUID_CIRCLE_LAND_SUBCLASS_ID,
    selections:[{ slotLevel:1, resourceId:"spell-slot-1", amount:1 }],
  });
  assert.equal(fullSlot.status,"rejected");
  assert.match(fullSlot.status === "rejected" ? fullSlot.error : "",/exceeds expended capacity/);
});
