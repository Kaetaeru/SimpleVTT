import assert from "node:assert/strict";
import test from "node:test";
import type { AbilityKey, ActionVm, EconomyVm, SceneEntity } from "../../src/app/contracts";
import { resolveAtomicAttackTransaction } from "../../src/app/realAttackTransactionService";
import type { Phase09AttackFact } from "../../src/app/phase09ReferenceRulesFacts";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";
import { resolveBarbarianRageStart } from "../../src/domain/barbarianRage";
import { runtimeState, TEST_PROFILE } from "../domain/rulesTestState";

const economy:EconomyVm={ action:true,bonusAction:true,reaction:true,movement:30,movementMax:30 };
const actor:SceneEntity={
  id:"hero",name:"Hero",side:"ally",kind:"character",hp:20,maxHp:20,tempHp:0,ac:16,initiative:10,
  status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
};
const target:SceneEntity={
  id:"goblin",name:"Goblin",side:"enemy",kind:"combatant",hp:15,maxHp:15,tempHp:0,ac:10,initiative:5,
  status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[],
};

function activeRageState() {
  const state=runtimeState();
  state.combatants.hero.resources.push({
    id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:3,maximum:3,recovery:{shortRest:1,longRest:"all"},
  });
  const started=resolveBarbarianRageStart(TEST_PROFILE,state,{
    id:"rage.attack-damage.start",actorId:"hero",expectedRevision:0,barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(started.status,"committed");
  if (started.status!=="committed") throw new Error(started.error);
  return started.state;
}

function action(id:string,dice:string,flat:number):ActionVm {
  return {
    id,actorId:"hero",name:id,category:"weapon",target:"enemy",economy:"없음",resolutionKind:"attack",
    summary:id,available:true,eligibleTargetIds:["goblin"],attackBonus:5,
    damage:[{type:"bludgeoning",dice,flat,average:flat}],details:[],
  };
}

function attackFact(sourceKind:Phase09AttackFact["sourceKind"],ability:AbilityKey,diceCount:number,diceSides:number,flat:number):Phase09AttackFact {
  return {
    sourceKind,ability,rangeFeet:5,
    damageDice:[{source:`test:${sourceKind}:die`,sides:diceSides,count:diceCount,faces:Array.from({length:diceCount*2},()=>4)}],
    flatDamage:[{source:`test:${sourceKind}:flat`,value:flat}],
  };
}

function damageRaw(sourceKind:Phase09AttackFact["sourceKind"],ability:AbilityKey,diceCount:number,diceSides:number,flat:number) {
  const result=resolveAtomicAttackTransaction({
    resolutionId:`rage.attack-damage.${sourceKind}.${ability}`,
    action:action(`action.test.${sourceKind}.${ability}`,`${diceCount}d${diceSides}`,flat),
    actor,target,actorEconomy:economy,targetEconomy:economy,initiativeMode:false,
    attackD20Face:15,effectiveTargetAc:10,
    attackFact:attackFact(sourceKind,ability,diceCount,diceSides,flat),
    targetingFact:{distanceFeet:5,visible:true,cover:"none",targetCanSeeAttacker:true},
    runtimeState:activeRageState(),
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") throw new Error(result.error);
  return result.damage?.components[0]?.raw;
}

test("active Rage adds Rage Damage only to qualifying Strength weapon and Unarmed attacks", () => {
  assert.equal(damageRaw("weapon","str",1,6,3),9);
  assert.equal(damageRaw("unarmed","str",0,2,4),6);
  assert.equal(damageRaw("weapon","dex",1,6,3),7);
  assert.equal(damageRaw("wild-shape","str",1,6,3),7);
});

test("attack damage contribution is invariant under effect identity rename",()=>{
  const state=runtimeState();
  state.effects.push({
    id:"unknown.effect.renamed",sourceId:"unknown.source.renamed",sourceActorId:"hero",targetId:"hero",kind:"modifier",tags:["unknown-tag"],expiry:{kind:"permanent"},
    metadata:{attackDamageFlat:2,attackDamageAbility:"str",attackDamageSourceKinds:"weapon,unarmed"},
  });
  const result=resolveAtomicAttackTransaction({
    resolutionId:"unknown.effect.attack-damage",action:action("unknown.action", "1d6",3),actor,target,actorEconomy:economy,targetEconomy:economy,initiativeMode:false,
    attackD20Face:15,effectiveTargetAc:10,attackFact:attackFact("weapon","str",1,6,3),targetingFact:{distanceFeet:5,visible:true,cover:"none",targetCanSeeAttacker:true},runtimeState:state,
  });
  assert.equal(result.status,"committed");
  if(result.status!=="committed")throw new Error(result.error);
  assert.equal(result.damage?.components[0]?.raw,9);
  assert.ok(result.provenance.some((entry)=>entry.includes("effect:unknown.effect.renamed:attack-damage-flat")));
});
