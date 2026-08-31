import assert from "node:assert/strict";
import test from "node:test";
import { FIGHTER_INDOMITABLE_RESOURCE_ID } from "../../src/domain/coreClassResources";
import type { D20TestResult } from "../../src/domain/d20";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("SRD Indomitable reroll adds Fighter level, requires the new result, and spends one use",()=>{
  const state=runtimeState();
  state.combatants.hero.resources.push({id:FIGHTER_INDOMITABLE_RESOURCE_ID,label:"Indomitable",current:1,maximum:1});
  const result=resolvePendingResolution(TEST_PROFILE,state,{
    id:"srd.indomitable",
    actorId:"hero",
    sourceId:"srd.fighter.indomitable",
    expectedRevision:0,
    operations:[
      {id:"spend",kind:"spend-resource",actorId:"hero",resourceId:FIGHTER_INDOMITABLE_RESOURCE_ID,amount:1},
      {id:"save",kind:"d20",actorId:"hero",request:{family:"saving-throw",target:20,modifierContributions:[{source:"wisdom-save",value:2}],rollModifications:[{source:"srd.fighter.indomitable",mode:"reroll",dice:{id:"new-roll",purpose:"Indomitable saving throw",sides:20,faces:[1]}},{source:"srd.fighter.indomitable",mode:"add-flat",value:9}],dice:{id:"failed-roll",purpose:"failed saving throw",sides:20,faces:[18]}}},
    ],
  });
  assert.equal(result.status,"committed");
  if(result.status!=="committed")return;
  const save=result.results.save as D20TestResult;
  assert.equal(save.natural,1);
  assert.equal(save.total,12);
  assert.equal(save.outcome,"failure");
  assert.equal(result.state.combatants.hero.resources.find((entry)=>entry.id===FIGHTER_INDOMITABLE_RESOURCE_ID)?.current,0);
});
