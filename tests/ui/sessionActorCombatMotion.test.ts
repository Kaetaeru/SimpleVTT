import assert from "node:assert/strict";
import test from "node:test";
import type { ResolutionView } from "../../src/app/contracts";
import { sessionActorCombatMotion } from "../../src/app/sessionActorCombatMotion";

function attack(stage:ResolutionView["stage"],outcome:NonNullable<ResolutionView["attackOutcome"]>="명중"):ResolutionView {
  return {id:"resolution.motion",actorId:"actor.attacker",targetIds:["actor.target"],actionId:"attack",actionName:"공격",rollKind:stage==="damage-animation"?"damage":"attack",stage,authoritativeDice:[17],attackOutcome:outcome,saveResults:[],damageComponents:[],compact:"",detail:[],provenance:[],calculatedOutcome:"",finalOutcome:"",stateChanges:[],adjudicated:false,canAdvance:false};
}

test("attack stages map attacker and target cards to distinct motion cues",()=>{
  assert.equal(sessionActorCombatMotion(attack("roll-animation"),"actor.attacker"),"attacking");
  assert.equal(sessionActorCombatMotion(attack("roll-animation"),"actor.target"),"targeted");
  assert.equal(sessionActorCombatMotion(attack("attack-result"),"actor.target"),"braced");
  assert.equal(sessionActorCombatMotion(attack("attack-result","빗나감"),"actor.target"),"dodged");
  assert.equal(sessionActorCombatMotion(attack("damage-animation"),"actor.target"),"hit");
  assert.equal(sessionActorCombatMotion(attack("complete"),"actor.target"),null);
  assert.equal(sessionActorCombatMotion(attack("roll-animation"),"actor.other"),null);
});
