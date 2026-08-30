import assert from "node:assert/strict";
import test from "node:test";

import {
  SRD_521_CONDITIONS,
  activeConditionIds,
  conditionActionAvailability,
  conditionD20Adjustments,
  conditionDamageDefenses,
  conditionImmunities,
  conditionSenses,
  conditionTargetingRestriction,
  effectiveSpeed,
  exhaustionIsFatal,
  exhaustionLevel,
  frightenedMovementRestriction,
  initiativeConditionContributions,
  proneStandingCost,
  type ConditionEffectRef,
  type ConditionId,
} from "../../src/domain/conditions";

const effect=(conditionId:ConditionId,id=conditionId,sourceActorId?:string):ConditionEffectRef=>({
  id:`external.${id}`,
  conditionId,
  ...(sourceActorId?{sourceActorId}:{}),
});

const actorContext=(actorConditions:ConditionEffectRef[])=>({
  actorId:"actor.external.hero",
  family:"attack-roll" as const,
  actorConditions,
});

test("Family M exposes every SRD condition through the generic condition profile without content identity dispatch",()=>{
  const required:ConditionId[]=[
    "blinded","charmed","deafened","exhaustion","frightened","grappled","incapacitated","invisible",
    "paralyzed","petrified","poisoned","prone","restrained","stunned","unconscious",
  ];
  assert.deepEqual(Object.keys(SRD_521_CONDITIONS).sort(),[...required].sort());

  const renamed=required.map((id,index)=>effect(id,`renamed-${index}`));
  const canonical=required.map((id)=>effect(id));
  assert.deepEqual(activeConditionIds(renamed).sort(),activeConditionIds(canonical).sort());
});

test("Family M condition implications, senses, action economy, speed, and exhaustion are structural",()=>{
  assert.deepEqual(activeConditionIds([effect("paralyzed")]).sort(),["incapacitated","paralyzed"]);
  assert.deepEqual(activeConditionIds([effect("unconscious")]).sort(),["incapacitated","prone","unconscious"]);
  assert.deepEqual(conditionSenses([effect("blinded"),effect("deafened")]),{
    canSee:false,
    canHear:false,
    canSpeak:true,
  });
  assert.deepEqual(conditionActionAvailability([effect("stunned")]),{
    action:false,
    bonusAction:false,
    reaction:false,
    canSpeak:false,
  });
  assert.equal(effectiveSpeed(30,[effect("grappled")]),0);
  assert.equal(effectiveSpeed(30,[effect("restrained")]),0);
  assert.equal(effectiveSpeed(30,[effect("exhaustion","exhaustion-1"),effect("exhaustion","exhaustion-2")]),20);
  assert.equal(proneStandingCost(30,[effect("prone")]),15);
  const exhaustion=Array.from({length:7},(_,index)=>effect("exhaustion",`exhaustion-${index}`));
  assert.equal(exhaustionLevel(exhaustion),6);
  assert.equal(exhaustionIsFatal(exhaustion),true);
});

test("Family M conditions contribute generic attack, check, save, critical, defense, immunity, and initiative mechanics",()=>{
  const blinded=conditionD20Adjustments({...actorContext([effect("blinded")]),requiresSight:true});
  assert.equal(blinded.autoFailure,false);
  assert.ok(blinded.rollStateContributions.some((entry)=>entry.source==="condition:blinded:actor"&&entry.state==="disadvantage"));
  const blindCheck=conditionD20Adjustments({
    actorId:"actor.external.hero",
    family:"ability-check",
    requiresSight:true,
    actorConditions:[effect("blinded")],
  });
  assert.equal(blindCheck.autoFailure,true);

  const deafCheck=conditionD20Adjustments({
    actorId:"actor.external.hero",
    family:"ability-check",
    requiresHearing:true,
    actorConditions:[effect("deafened")],
  });
  assert.equal(deafCheck.autoFailure,true);

  const poisoned=conditionD20Adjustments({
    actorId:"actor.external.hero",
    family:"ability-check",
    actorConditions:[effect("poisoned")],
  });
  assert.ok(poisoned.rollStateContributions.some((entry)=>entry.source==="condition:poisoned:actor"&&entry.state==="disadvantage"));

  const exhausted=conditionD20Adjustments({
    actorId:"actor.external.hero",
    family:"ability-check",
    actorConditions:[effect("exhaustion","one"),effect("exhaustion","two")],
  });
  assert.deepEqual(exhausted.modifierContributions,[{source:"condition:exhaustion",value:-4}]);

  const restrainedSave=conditionD20Adjustments({
    actorId:"actor.external.hero",
    family:"saving-throw",
    ability:"dex",
    actorConditions:[effect("restrained")],
  });
  assert.ok(restrainedSave.rollStateContributions.some((entry)=>entry.source==="condition:restrained:actor"&&entry.state==="disadvantage"));

  for(const conditionId of ["paralyzed","petrified","stunned","unconscious"] as const){
    const result=conditionD20Adjustments({
      actorId:"actor.external.hero",
      family:"saving-throw",
      ability:"str",
      actorConditions:[effect(conditionId)],
    });
    assert.equal(result.autoFailure,true,conditionId);
  }

  const closeParalyzed=conditionD20Adjustments({
    actorId:"actor.external.hero",
    targetId:"actor.external.target",
    family:"attack-roll",
    distanceToTargetFeet:5,
    actorConditions:[],
    targetConditions:[effect("paralyzed")],
  });
  assert.equal(closeParalyzed.criticalOnHit,true);
  assert.ok(closeParalyzed.rollStateContributions.some((entry)=>entry.source==="condition:paralyzed:target"&&entry.state==="advantage"));

  assert.deepEqual(conditionDamageDefenses([effect("petrified")]),[
    {source:"condition:petrified",kind:"resistance",damageType:"*"},
  ]);
  assert.deepEqual(conditionImmunities([effect("petrified")]),["poisoned"]);
  assert.deepEqual(initiativeConditionContributions([effect("invisible"),effect("incapacitated")]),[
    {source:"condition:incapacitated:initiative",state:"disadvantage"},
    {source:"condition:invisible:initiative",state:"advantage"},
  ]);
});

test("Family M source-bound Charmed, Frightened, Grappled, Invisible, and Prone rules remain identity invariant",()=>{
  assert.match(
    conditionTargetingRestriction([effect("charmed","renamed-charm","actor.external.charmer")],"actor.external.charmer",true) ?? "",
    /Charmed prevents/,
  );
  assert.equal(
    frightenedMovementRestriction(
      [effect("frightened","renamed-fear","actor.external.source")],
      true,
      ["actor.external.source"],
    ),
    "Frightened prevents willingly moving closer to actor.external.source",
  );

  const grappled=conditionD20Adjustments({
    actorId:"actor.external.hero",
    targetId:"actor.external.other-target",
    family:"attack-roll",
    actorConditions:[effect("grappled","renamed-grapple","actor.external.grappler")],
  });
  assert.ok(grappled.rollStateContributions.some((entry)=>entry.source==="condition:grappled:actor"&&entry.state==="disadvantage"));

  const invisible=conditionD20Adjustments({
    actorId:"actor.external.hero",
    targetId:"actor.external.target",
    family:"attack-roll",
    actorCanSeeTarget:false,
    targetCanSeeActor:false,
    actorConditions:[effect("invisible","renamed-invisible")],
    targetConditions:[effect("invisible","renamed-target-invisible")],
  });
  assert.ok(invisible.rollStateContributions.some((entry)=>entry.source==="condition:invisible:actor"&&entry.state==="advantage"));
  assert.ok(invisible.rollStateContributions.some((entry)=>entry.source==="condition:invisible:target"&&entry.state==="disadvantage"));

  const proneNear=conditionD20Adjustments({
    actorId:"actor.external.hero",
    targetId:"actor.external.target",
    family:"attack-roll",
    distanceToTargetFeet:5,
    actorConditions:[],
    targetConditions:[effect("prone","renamed-prone")],
  });
  const proneFar=conditionD20Adjustments({
    actorId:"actor.external.hero",
    targetId:"actor.external.target",
    family:"attack-roll",
    distanceToTargetFeet:30,
    actorConditions:[],
    targetConditions:[effect("prone","another-renamed-prone")],
  });
  assert.ok(proneNear.rollStateContributions.some((entry)=>entry.source==="condition:prone:target"&&entry.state==="advantage"));
  assert.ok(proneFar.rollStateContributions.some((entry)=>entry.source==="condition:prone:target"&&entry.state==="disadvantage"));
});
