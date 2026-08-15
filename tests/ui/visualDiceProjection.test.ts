import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm, ResolutionView } from "../../src/app/contracts";
import { buildVisualDiceRoll } from "../../src/app/diceVisuals";

function resolution(overrides:Partial<ResolutionView>):ResolutionView {
  return {
    id:"resolution.visual-test",
    actorId:"char.aelar",
    targetIds:["combatant.goblin-a"],
    actionId:"action.test",
    actionName:"테스트",
    rollKind:"attack",
    stage:"roll-animation",
    authoritativeDice:[12],
    saveResults:[],
    damageComponents:[],
    compact:"",
    detail:[],
    provenance:[],
    calculatedOutcome:"",
    finalOutcome:"",
    stateChanges:[],
    adjudicated:false,
    canAdvance:true,
    ...overrides,
  };
}

function action(overrides:Partial<ActionVm>):ActionVm {
  return {
    id:"action.test",
    actorId:"char.aelar",
    name:"테스트",
    category:"basic",
    target:"enemy",
    economy:"행동",
    resolutionKind:"attack",
    summary:"",
    available:true,
    eligibleTargetIds:["combatant.goblin-a"],
    details:[],
    ...overrides,
  };
}

test("visual dice projection maps authoritative attack/check/save faces to d20", () => {
  const attack = buildVisualDiceRoll(resolution({ authoritativeDice:[20], rollKind:"attack" }),action({}));
  assert.deepEqual(attack.dice,[{ value:20, sides:20, authoritative:true }]);
  assert.equal(attack.legacyAggregate,false);

  const saves = buildVisualDiceRoll(resolution({ stage:"save-animation", rollKind:"save", authoritativeDice:[7,18,10] }),action({ resolutionKind:"saving-throw" }));
  assert.deepEqual(saves.dice.map((die) => die.sides),[20,20,20]);
  assert.deepEqual(saves.dice.map((die) => die.value),[7,18,10]);
});

test("visual dice projection preserves structured healing and damage die shapes", () => {
  const healingAction = action({ resolutionKind:"healing", healing:{ dice:"2d4", flat:2, average:7 } });
  const healing = buildVisualDiceRoll(resolution({ rollKind:"healing", authoritativeDice:[3,4] }),healingAction);
  assert.deepEqual(healing.dice.map((die) => [die.sides,die.value]),[[4,3],[4,4]]);
  assert.equal(healing.label,"회복 2d4");

  const damageAction = action({ resolutionKind:"attack", damage:[{ type:"관통", dice:"1d6", flat:2, average:6 }] });
  const damage = buildVisualDiceRoll(resolution({ stage:"damage-animation", rollKind:"damage", authoritativeDice:[4] }),damageAction);
  assert.deepEqual(damage.dice,[{ value:4, sides:6, authoritative:true }]);
  assert.equal(damage.label,"피해 1d6");
});

test("visual dice projection never disguises legacy aggregate values as physical dice", () => {
  const thunderwave = action({ resolutionKind:"saving-throw", damage:[{ type:"천둥", dice:"2d8", flat:0, average:9 }] });
  const legacy = buildVisualDiceRoll(resolution({ stage:"damage-animation", rollKind:"damage", authoritativeDice:[9] }),thunderwave);
  assert.equal(legacy.legacyAggregate,true);
  assert.deepEqual(legacy.dice,[{ value:9, sides:null, authoritative:true }]);

  const invalidD4 = action({ resolutionKind:"healing", healing:{ dice:"1d4", flat:4, average:7 } });
  const invalid = buildVisualDiceRoll(resolution({ rollKind:"healing", authoritativeDice:[5] }),invalidD4);
  assert.equal(invalid.legacyAggregate,true);
  assert.equal(invalid.dice[0]?.sides,null);
});
