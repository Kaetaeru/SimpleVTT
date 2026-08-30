import assert from "node:assert/strict";
import test from "node:test";
import { compileCommonPlayMovement, type CommonPlayMovementDefinition } from "../../src/domain/commonPlayMovementRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const destinationFact={
  id:"movement-destination",
  fact:"spatial.legal-destination",
  subject:"hero",
  authority:"dm" as const,
  visibility:"authority-only" as const,
  unknownPolicy:"request-authority" as const,
};

const answer={
  queryId:destinationFact.id,
  fact:destinationFact.fact,
  subject:destinationFact.subject,
  value:"point:b4",
  resolutionId:"movement-matrix",
  provenance:{kind:"authority" as const,responderId:"dm"},
};

function compile(definition:CommonPlayMovementDefinition,id:string) {
  const compiled=compileCommonPlayMovement({id,definition,answer});
  assert.equal(compiled.status,"compiled");
  if(compiled.status!=="compiled") throw new Error(compiled.reason);
  return compiled.operation;
}

test("generic movement types spend multiplied movement cost through the Resolver",()=>{
  for(const movementType of ["walk","climb","swim","fly","crawl","jump"] as const) {
    const operation=compile({
      kind:"movement.relocate",
      mode:"move",
      movementType,
      target:"hero",
      distance:{value:5},
      costMultiplier:{value:2},
      doesNotProvokeOpportunityAttacks:true,
      destinationFact,
    },`move-${movementType}`);
    assert.equal(operation.kind,"move");
    if(operation.kind!=="move") continue;
    assert.equal(operation.movementMode,movementType);
    assert.equal(operation.distanceFeet,10);
    assert.equal(operation.distanceTraveledFeet,5);
    assert.equal(operation.doesNotProvokeOpportunityAttacks,true);

    const state=runtimeState();
    const before=state.combatants.hero.economy.movement;
    const committed=resolvePendingResolution(TEST_PROFILE,state,{
      id:`resolution-${movementType}`,
      actorId:"hero",
      sourceId:"external.unknown.movement-matrix",
      expectedRevision:0,
      operations:[operation],
    });
    assert.equal(committed.status,"committed");
    if(committed.status!=="committed") continue;
    assert.equal(committed.state.combatants.hero.economy.movement,before-10);
    assert.equal(committed.results[operation.id]&&typeof committed.results[operation.id]==="object"?(committed.results[operation.id] as {distanceFeet?:number}).distanceFeet:undefined,5);
  }
});

test("push, pull, and teleport preserve regular movement economy",()=>{
  for(const mode of ["push","pull","teleport"] as const) {
    const operation=compile({
      kind:"movement.relocate",
      mode,
      target:"hero",
      distance:{value:15},
      destinationFact,
    },`free-${mode}`);
    assert.equal(operation.kind,"free-move");
    if(operation.kind!=="free-move") continue;

    const state=runtimeState();
    const before=state.combatants.hero.economy.movement;
    const committed=resolvePendingResolution(TEST_PROFILE,state,{
      id:`resolution-${mode}`,
      actorId:"hero",
      sourceId:"external.unknown.movement-matrix",
      expectedRevision:0,
      operations:[operation],
    });
    assert.equal(committed.status,"committed");
    if(committed.status!=="committed") continue;
    assert.equal(committed.state.combatants.hero.economy.movement,before);
    assert.equal(committed.results[operation.id]&&typeof committed.results[operation.id]==="object"?(committed.results[operation.id] as {regularMovementSpent?:number}).regularMovementSpent:undefined,0);
  }
});
