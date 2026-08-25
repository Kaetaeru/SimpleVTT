import assert from "node:assert/strict";
import test from "node:test";
import type { ActionVm } from "../../src/app/contracts";
import { actionIconDescriptor } from "../../src/app/actionIconProjection";

function action(overrides:Partial<ActionVm>):ActionVm {
  return {
    id:"action.test",actorId:"actor.test",name:"Test",category:"basic",target:"none",economy:"행동",
    resolutionKind:"no-roll",summary:"Test",available:true,eligibleTargetIds:[],details:[],...overrides,
  };
}

test("magic actions prefer explicit attack damage over spell school",()=>{
  const icon=actionIconDescriptor(action({category:"magic",damage:[{type:"화염",dice:"1d10",flat:0,average:5}],spellCast:{spellId:"dnd.srd521.spell.fire-bolt",runtimeSupport:"combat-executable",baseLevel:0,castSource:"prepared"}}));
  assert.deepEqual(icon,{key:"fire",label:"화염 속성",source:"damage"});
});

test("non-damaging spells fall back to their canonical school",()=>{
  const icon=actionIconDescriptor(action({category:"magic",spellCast:{spellId:"dnd.srd521.spell.detect-magic",runtimeSupport:"partial",baseLevel:1,castSource:"prepared"}}));
  assert.equal(icon.source,"school");
  assert.match(icon.key,/^school:/);
});

test("every non-spell action family receives a semantic icon",()=>{
  assert.equal(actionIconDescriptor(action({category:"weapon",resolutionKind:"attack",damage:[{type:"참격",dice:"1d8",flat:3,average:7}]})).key,"weapon-slashing");
  assert.equal(actionIconDescriptor(action({resolutionKind:"ability-check"})).key,"ability-check");
  assert.equal(actionIconDescriptor(action({resolutionKind:"saving-throw"})).key,"saving-throw");
  assert.equal(actionIconDescriptor(action({itemCost:{itemId:"potion",quantity:1},resolutionKind:"healing"})).key,"item");
  assert.equal(actionIconDescriptor(action({resolutionKind:"healing",healing:{dice:"1d4",flat:2,average:4}})).key,"healing");
  assert.equal(actionIconDescriptor(action({})).key,"action");
});

test("standard actions receive distinct shared icons",()=>{
  const expected:Record<string,string>={
    "action.dash":"movement","action.standard.disengage":"disengage","action.standard.dodge":"dodge","action.standard.help":"help",
    "action.standard.hide.stealth":"hide","action.standard.ready":"ready","action.standard.utilize":"utilize",
    "ui.action.standard.influence":"influence","ui.action.standard.search":"search","ui.action.standard.study":"study",
  };
  for(const [id,key] of Object.entries(expected)) assert.equal(actionIconDescriptor(action({id})).key,key,id);
});
