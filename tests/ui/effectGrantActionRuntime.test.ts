import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealTurnRuntimeAdapter";
import "../../src/app/phase09RealRuntimeAttackAdapter";
import "../../src/app/effectGrantActionRuntimeAdapter";
import type { ActionVm, CharacterSheet, CombatantDefinitionVm, SceneVm } from "../../src/app/contracts";
import { MockAdapter } from "../../src/app/mockAdapter";
import { runtimeResolutionEventHistory } from "../../src/app/runtimeResolutionEventHistory";

test("unknown effect-grant action commits resource, economy, effect, and Undo",async()=>{
  const adapter=new MockAdapter();
  const internal=adapter as unknown as {activeCharacter:CharacterSheet;scene:SceneVm;combatantDefinitions:CombatantDefinitionVm[]};
  internal.activeCharacter.resources.push({id:"resource.external.grant",label:"외부 부여",current:2,max:2});
  internal.scene.entities.push({id:"combatant.external-ally",name:"외부 동료",side:"ally",kind:"combatant",hp:20,maxHp:20,tempHp:0,ac:14,initiative:10,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]});
  internal.scene.actionsByActor["combatant.external-ally"]=[];
  internal.scene.economyByActor["combatant.external-ally"]={action:true,bonusAction:true,reaction:true,movement:30,movementMax:30};
  internal.combatantDefinitions.push({id:"combatant.external-ally",name:"외부 동료",ac:14,maxHp:20,source:"test",version:"1",actions:[],statusImmunities:[],runtimeStats:{creatureType:"external-spirit",abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,savingThrowProficiencies:[],speed:30,resistances:[],immunities:[],vulnerabilities:[]}});
  await adapter.startInitiative();
  await adapter.setCurrentActor(internal.activeCharacter.id);
  const action:ActionVm={
    id:"external.unknown.effect-grant",actorId:internal.activeCharacter.id,name:"외부 효과 부여",category:"basic",target:"ally",economy:"추가 행동",resolutionKind:"no-roll",
    summary:"외부 효과를 부여합니다.",available:true,eligibleTargetIds:["combatant.external-ally"],details:[],
    resourceCost:{resourceId:"resource.external.grant",amount:1},
    runtimeEffectGrant:{excludeActor:true,exclusiveTag:"external-grant",tags:["external-grant"],duration:{kind:"minutes",amount:10},metadata:{publicLabel:"외부 효과"},awarenessQuery:{creatureTypes:["external-spirit"],radiusFeet:30}},
  };
  internal.scene.actionsByActor[internal.activeCharacter.id].push(action);

  await adapter.resolveAction(action.id,["combatant.external-ally"]);
  let snapshot=await adapter.getSnapshot();
  let events=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id==="resource.external.grant")?.current,1);
  assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.bonusAction,false);
  assert.ok(snapshot.scene.entities.find((entry)=>entry.id==="combatant.external-ally")?.status.includes("✦ 외부 효과"));
  assert.match(snapshot.resolution?.detail.join(" ")??"",/외부 동료 \(external-spirit\)/);
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="resource")));
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="economy")));
  assert.ok(events.some((event)=>event.stateChanges.some((change)=>change.kind==="effect"&&change.operation==="added")));

  await adapter.undoLastResolution();
  snapshot=await adapter.getSnapshot();
  events=runtimeResolutionEventHistory(adapter)?.events??[];
  assert.equal(snapshot.activeCharacter.resources.find((entry)=>entry.id==="resource.external.grant")?.current,2);
  assert.equal(snapshot.scene.economyByActor[internal.activeCharacter.id]?.bonusAction,true);
  assert.equal(snapshot.scene.entities.find((entry)=>entry.id==="combatant.external-ally")?.status.includes("✦ 외부 효과"),false);
  assert.equal(events.length,0);
});
