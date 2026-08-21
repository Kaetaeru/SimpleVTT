import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm, ResolutionView } from "../../src/app/contracts";
import { buildCombatVfxProfile } from "../../src/app/combatVisuals";

function action(overrides:Partial<ActionVm>):ActionVm {
  return {
    id:"action.vfx",
    actorId:"char.mira",
    name:"VFX Test",
    category:"weapon",
    target:"enemy",
    economy:"행동",
    resolutionKind:"attack",
    summary:"",
    available:true,
    eligibleTargetIds:["combatant.target"],
    details:[],
    ...overrides,
  };
}

function resolution(overrides:Partial<ResolutionView>={}):ResolutionView {
  return {
    id:"resolution.vfx",
    actorId:"char.mira",
    targetIds:["combatant.target"],
    actionId:"action.vfx",
    actionName:"VFX Test",
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

test("physical damage type selects motion without inventing an element",()=>{
  assert.deepEqual(buildCombatVfxProfile(resolution(),action({damage:[{type:"참격",dice:"1d8",flat:3,average:8}]})),{
    delivery:"slashing",physical:"slashing",element:null,phase:"delivery",label:"slashing",
  });
  assert.equal(buildCombatVfxProfile(resolution(),action({damage:[{type:"관통",dice:"1d8",flat:3,average:8}]}))?.delivery,"piercing");
  assert.equal(buildCombatVfxProfile(resolution(),action({damage:[{type:"타격",dice:"1d8",flat:3,average:8}]}))?.delivery,"bludgeoning");
});

test("elemental magic derives color semantics from damage metadata rather than spell names",()=>{
  const fire=buildCombatVfxProfile(resolution(),action({category:"magic",damage:[{type:"화염",dice:"2d10",flat:0,average:11}]}));
  assert.equal(fire?.delivery,"projectile");
  assert.equal(fire?.element,"fire");

  const lightning=buildCombatVfxProfile(resolution(),action({category:"magic",damage:[{type:"번개",dice:"1d12",flat:0,average:7}]}));
  assert.equal(lightning?.delivery,"beam");
  assert.equal(lightning?.element,"lightning");

  const poison=buildCombatVfxProfile(resolution(),action({category:"magic",target:"multi-enemy",damage:[{type:"독",dice:"2d8",flat:0,average:9}]}));
  assert.equal(poison?.delivery,"wave");
  assert.equal(poison?.element,"poison");
});

test("physical delivery and elemental layer compose for multi-component attacks",()=>{
  const flamingBlade=buildCombatVfxProfile(resolution(),action({damage:[
    {type:"참격",dice:"1d8",flat:3,average:8},
    {type:"화염",dice:"1d6",flat:0,average:4},
  ]}));
  assert.deepEqual(flamingBlade,{
    delivery:"slashing",physical:"slashing",element:"fire",phase:"delivery",label:"fire",
  });
});

test("damage animation switches to impact while preserving physical and elemental semantics",()=>{
  const impact=buildCombatVfxProfile(resolution({stage:"damage-animation",rollKind:"damage"}),action({damage:[
    {type:"관통",dice:"1d6",flat:2,average:6},
    {type:"독",dice:"1d4",flat:0,average:3},
  ]}));
  assert.deepEqual(impact,{delivery:"impact",physical:"piercing",element:"poison",phase:"impact",label:"poison"});
});

test("effect-preview remains a delivery phase for no-roll magic instead of skipping to impact",()=>{
  const noRoll=buildCombatVfxProfile(resolution({stage:"effect-preview",rollKind:"effect",authoritativeDice:[]}),action({category:"magic",resolutionKind:"no-roll-damage",damage:[{type:"역장",dice:"1d4",flat:1,average:4}]}));
  assert.deepEqual(noRoll,{delivery:"projectile",physical:null,element:"force",phase:"delivery",label:"force"});
});

test("actions without public damage metadata do not fabricate combat effects",()=>{
  assert.equal(buildCombatVfxProfile(resolution(),undefined),null);
  assert.equal(buildCombatVfxProfile(resolution(),action({damage:undefined,resolutionKind:"ability-check"})),null);
});
