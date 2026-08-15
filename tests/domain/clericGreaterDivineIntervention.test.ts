import assert from "node:assert/strict";
import test from "node:test";
import { CLERIC_DIVINE_INTERVENTION_RESOURCE_ID } from "../../src/domain/coreClassResources";
import {
  greaterDivineInterventionLockoutLongRests,
  resolveGreaterDivineInterventionWishCopy,
  resolveGreaterDivineInterventionWishLockout,
} from "../../src/domain/clericGreaterDivineIntervention";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { spellMechanicById } from "../../src/domain/spellMechanics";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function stateAfterWish() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
    label:"Divine Intervention",
    current:0,
    maximum:1,
    recovery:{ longRest:"all" },
  });
  return state;
}

function stateBeforeWish() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
    label:"Divine Intervention",
    current:1,
    maximum:1,
    recovery:{ longRest:"all" },
  });
  return state;
}

function longRest(state:ReturnType<typeof runtimeState>,expectedRevision:number,index:number) {
  return resolvePendingResolution(TEST_PROFILE,state,{
    id:`greater-di.rest.${index}`,
    actorId:"hero",
    sourceId:"test:long-rest",
    expectedRevision,
    operations:[{ id:`greater-di.rest.${index}:rest`, kind:"long-rest", targetId:"hero" }],
  });
}

function caster() {
  return {
    characterLevel:20,
    spellAttackModifier:9,
    spellSaveDc:17,
    spellcastingAbilityModifier:5,
    preparedSpellIds:[],
    alwaysPreparedSpellIds:[],
    cantripSpellIds:[],
    slotResourceIds:{},
  };
}

function goblinTarget() {
  return {
    id:"goblin",
    kind:"creature" as const,
    relation:"enemy" as const,
    distanceFeet:10,
    visible:true,
    cover:"none" as const,
    creatureKind:"monster" as const,
    saveModifiers:{ dex:0 },
    targetCanSeeCaster:true,
  };
}

test("Greater Divine Intervention Wish lockout uses the authoritative 2d4 total", () => {
  assert.equal(greaterDivineInterventionLockoutLongRests([1,1]),2);
  assert.equal(greaterDivineInterventionLockoutLongRests([4,4]),8);
  assert.throws(() => greaterDivineInterventionLockoutLongRests([0,4]),/exactly two authoritative d4 faces/);
});

test("Greater Divine Intervention can use Wish's basic mode to replicate an executable level-8-or-lower spell in one atomic transaction", () => {
  const state = stateBeforeWish();
  const burningHands = spellMechanicById("dnd.srd521.spell.burning-hands");
  assert.ok(burningHands);
  const result = resolveGreaterDivineInterventionWishCopy(TEST_PROFILE,burningHands!,state,{
    id:"greater-di.wish-copy",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    copiedSpellId:burningHands!.spellId,
    caster:caster(),
    targets:[goblinTarget()],
    wishNonMaterialComponentsSatisfied:true,
    useActionEconomy:true,
    dice:{
      saves:{ goblin:{ id:"wish-copy-save", purpose:"Burning Hands via Wish", sides:20, faces:[3] } },
      effectFaces:[3,4,5],
    },
    d4Faces:[2,3],
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,3,"replicated Burning Hands deals its exact base 3d6 damage");
  assert.equal(result.state.combatants.hero.economy.action,false,"Greater Divine Intervention spends the Magic Action, not the copied spell's own economy");
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current,2,"Wish replication spends no spell slot");
  const divineIntervention = result.state.combatants.hero.resources.find((pool) => pool.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
  assert.equal(divineIntervention?.current,0);
  assert.deepEqual(divineIntervention?.recoveryLockouts,{ longRest:5 });
  assert.equal((result.results["greater-di.wish-copy:lockout-roll"] as { total:number }).total,5);
});

test("Wish replication rejects unsupported copied mechanics atomically instead of approximating them", () => {
  const state = stateBeforeWish();
  const thunderwave = spellMechanicById("dnd.srd521.spell.thunderwave");
  assert.ok(thunderwave);
  const result = resolveGreaterDivineInterventionWishCopy(TEST_PROFILE,thunderwave!,state,{
    id:"greater-di.wish-partial",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    copiedSpellId:thunderwave!.spellId,
    caster:caster(),
    targets:[goblinTarget()],
    wishNonMaterialComponentsSatisfied:true,
    useActionEconomy:true,
    dice:{ saves:{ goblin:{ id:"partial-save", purpose:"partial", sides:20, faces:[3] } }, effectFaces:[4,5] },
    d4Faces:[2,2],
  });
  assert.equal(result.status,"rejected");
  assert.equal(result.state,state);
  assert.equal(state.combatants.hero.economy.action,true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID)?.current,1);
  assert.match(result.status === "rejected" ? result.error : "",/fully executable/);
});

test("Wish replication requires level 20 and Wish's own non-material component before mutation", () => {
  const state = stateBeforeWish();
  const cureWounds = spellMechanicById("dnd.srd521.spell.cure-wounds");
  assert.ok(cureWounds);
  const common = {
    id:"greater-di.wish-validation",
    actorId:"hero",
    expectedRevision:0,
    copiedSpellId:cureWounds!.spellId,
    caster:caster(),
    targets:[{ ...goblinTarget(), relation:"ally" as const, distanceFeet:5 }],
    useActionEconomy:true,
    dice:{ effectFaces:[4,5] },
    d4Faces:[1,1] as [number,number],
  };
  const premature = resolveGreaterDivineInterventionWishCopy(TEST_PROFILE,cureWounds!,state,{
    ...common,
    clericLevel:19,
    wishNonMaterialComponentsSatisfied:true,
  });
  assert.equal(premature.status,"rejected");
  assert.equal(premature.state,state);

  const missingVerbal = resolveGreaterDivineInterventionWishCopy(TEST_PROFILE,cureWounds!,state,{
    ...common,
    clericLevel:20,
    wishNonMaterialComponentsSatisfied:false,
  });
  assert.equal(missingVerbal.status,"rejected");
  assert.equal(missingVerbal.state,state);
});

test("post-Wish Greater Divine Intervention lockout blocks recovery until all rolled Long Rests are finished", () => {
  const state = stateAfterWish();
  const locked = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,state,{
    id:"greater-di.wish-lockout",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    d4Faces:[2,3],
  });
  assert.equal(locked.status,"committed");
  if (locked.status !== "committed") return;
  assert.equal((locked.results["greater-di.wish-lockout:lockout-roll"] as { total:number }).total,5);
  let pool = locked.state.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
  assert.deepEqual(pool?.recoveryLockouts,{ longRest:5 });

  let current = locked.state;
  for (let index = 1; index <= 4; index += 1) {
    const rested = longRest(current,index,index);
    assert.equal(rested.status,"committed");
    if (rested.status !== "committed") return;
    current = rested.state;
    pool = current.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
    assert.equal(pool?.current,0,`Long Rest ${index} must not restore Divine Intervention yet`);
    assert.deepEqual(pool?.recoveryLockouts,{ longRest:5 - index });
  }

  const fifth = longRest(current,5,5);
  assert.equal(fifth.status,"committed");
  if (fifth.status !== "committed") return;
  pool = fifth.state.combatants.hero.resources.find((entry) => entry.id === CLERIC_DIVINE_INTERVENTION_RESOURCE_ID);
  assert.equal(pool?.current,1,"finishing the fifth rolled Long Rest ends the lockout and allows normal recovery");
  assert.equal(pool?.recoveryLockouts,undefined);
});

test("Greater Divine Intervention lockout rejects before level 20 or without the target resource", () => {
  const state = stateAfterWish();
  const premature = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,state,{
    id:"greater-di.premature",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:19,
    d4Faces:[2,2],
  });
  assert.equal(premature.status,"rejected");
  assert.equal(premature.state,state);

  const missing = runtimeState();
  const noResource = resolveGreaterDivineInterventionWishLockout(TEST_PROFILE,missing,{
    id:"greater-di.missing-resource",
    actorId:"hero",
    expectedRevision:0,
    clericLevel:20,
    d4Faces:[2,2],
  });
  assert.equal(noResource.status,"rejected");
  assert.equal(noResource.state,missing);
});
