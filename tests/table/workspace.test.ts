import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MockAdapter } from "../../src/app/mockAdapter";
import { createTableSessionFacade } from "../../src/table/facade";
import { MemoryTransportHub } from "../../src/table/transport";
import { WorkspaceView } from "../../src/table/ui/TableWorkspace";
import { durationFromPreset, filterActivity, nextSelection, rulingFrom, searchEverything, targetingPlan } from "../../src/table/ui/model";
import type { ActionVm, ActivityEntry } from "../../src/app/contracts";

/** DM_WORKSPACE.md §2–§7 on the V2 facade: the screens are thin over the snapshot, so they render without a browser. */
const noop=()=>{};

test("DM workspace: three areas, seven tabs, the selected token's hotbar and the discretion bar over a hosted table", async () => {
  const base=new MockAdapter();
  const facade=createTableSessionFacade(base);
  await facade.adapter.hostSession();
  await facade.adapter.instantiateCombatant("dnd.srd521.monster.goblin-warrior");
  const snapshot=await facade.adapter.getSnapshot();
  const goblin=snapshot.scene.entities.find((entity)=>/고블린/.test(entity.name))!;
  const html=renderToStaticMarkup(createElement(WorkspaceView,{snapshot,facade,onLeave:noop,onStop:noop,initialSelectedIds:[goblin.id]}));
  assert.match(html,/data-workspace-role="dm"/);
  for(const label of ["기록","전투","액터","아이템","자료","규칙","세션"]) assert.ok(html.includes(`>${label}<span class="k">`),`tab ${label}`);
  assert.match(html,new RegExp(`data-entity-id="${goblin.id.replace(/\./g,"\\.")}"`),"the goblin's token card");
  assert.match(html,/data-row="enemy"/); assert.match(html,/data-row="ally"/);
  assert.match(html,/시미터/,"the goblin's attack tile in the command center");
  assert.match(html,/DM 재량/,"the discretion bar");
  assert.match(html,/HP 10\+?\s*\/ 10|HP 10 \/ 10/,"the DM sees numbers");
  assert.match(html,/Ctrl\+K/);
  assert.match(html,/SRD 몬스터 329종 검색/,"the 액터 tab opens first for the DM");
  await facade.adapter.stopSession();
});

test("Player workspace: the same skeleton with the party tabs, the own character's hotbar and the free-action bar; creature HP as a stage", async () => {
  const hub=new MemoryTransportHub();
  const dm=createTableSessionFacade(new MockAdapter(),{transport:{hub}});
  await dm.adapter.hostSession();
  await dm.adapter.instantiateCombatant("dnd.srd521.monster.goblin-warrior");
  const player=createTableSessionFacade(new MockAdapter(),{transport:{hub,peerId:"peer.p1"}});
  await player.adapter.joinSession("memory://host");
  const snapshot=await player.adapter.getSnapshot();
  const html=renderToStaticMarkup(createElement(WorkspaceView,{snapshot,facade:player,onLeave:noop,onStop:noop}));
  assert.match(html,/data-workspace-role="player"/);
  assert.match(html,/사이드바/,"the player's sidebar starts collapsed (DM_WORKSPACE.md §7) with a button to open it");
  assert.doesNotMatch(html,/tw-discretion/,"no discretion bar for a player");
  assert.match(html,/엎드리기/,"the free-action bar");
  assert.match(html,/즉흥 행동 \(DM 판정\)/);
  assert.match(html,/멀쩡/,"D22: the goblin's HP is a stage for the player");
  assert.match(html,new RegExp(snapshot.activeCharacter.name),"the own character sits on the table");
  await player.adapter.stopSession(); await dm.adapter.stopSession();
});

test("model: targeting plans, selection, rulings, log filter, durations and the unified search", () => {
  const action=(patch:Partial<ActionVm>):ActionVm=>({id:"a",actorId:"x",name:"공격",category:"weapon",target:"enemy",economy:"행동",resolutionKind:"attack",summary:"",available:true,eligibleTargetIds:["g1","g2"],...patch} as ActionVm);
  assert.deepEqual(targetingPlan(action({target:"self"}),"x"),{kind:"immediate",targetIds:["x"]});
  assert.deepEqual(targetingPlan(action({target:"none"}),"x"),{kind:"immediate",targetIds:[]});
  assert.deepEqual(targetingPlan(action({eligibleTargetIds:["g1"]}),"x"),{kind:"immediate",targetIds:["g1"]});
  assert.deepEqual(targetingPlan(action({}),"x"),{kind:"pick",max:1,eligible:["g1","g2"]});
  assert.deepEqual(targetingPlan(action({target:"multi-enemy",maxTargets:3}),"x"),{kind:"pick",max:3,eligible:["g1","g2"]});
  assert.deepEqual(nextSelection(["a"],"b",false),["b"]);
  assert.deepEqual(nextSelection(["a"],"b",true),["a","b"]);
  assert.deepEqual(nextSelection(["a","b"],"a",true),["b"]);
  assert.deepEqual(rulingFrom({kind:"damage",amount:7.9,damageType:"fire"}),{kind:"damage",amount:7,damageType:"fire"});
  assert.deepEqual(rulingFrom({kind:"condition",conditionId:"poisoned",on:true,preset:"1min"}),{kind:"condition",conditionId:"poisoned",on:true,duration:{kind:"minutes",amount:1}});
  assert.deepEqual(rulingFrom({kind:"condition",conditionId:"poisoned",on:false}),{kind:"condition",conditionId:"poisoned",on:false});
  assert.deepEqual(rulingFrom({kind:"next-roll",state:"advantage"}),{kind:"next-roll",state:"advantage",family:"any"});
  assert.deepEqual(durationFromPreset("round"),{kind:"seconds",amount:6});
  assert.deepEqual(durationFromPreset("permanent"),{kind:"permanent"});
  const entries:ActivityEntry[]=[{id:"1",time:"",actor:"DM",title:"a",summary:"",detail:[],stateChanges:[],visibility:"dm"},{id:"2",time:"",actor:"DM",title:"b",summary:"",detail:[],stateChanges:[],visibility:"public"}];
  assert.deepEqual(filterActivity(entries,"public").map((entry)=>entry.id),["2"]);
  assert.deepEqual(filterActivity(entries,"dm").map((entry)=>entry.id),["1"]);
  const hits=searchEverything("고블린",{entities:[{id:"g1",name:"고블린 전사 1",side:"enemy",kind:"combatant",hp:10,maxHp:10,tempHp:0,ac:15,initiative:0,status:[],resistances:[],immunities:[],vulnerabilities:[],reactions:[]}],actions:{},selectedActorId:null,role:"dm"});
  assert.equal(hits[0]?.payload.kind,"entity");
  assert.ok(hits.some((hit)=>hit.payload.kind==="monster"&&hit.verb==="소환"),"SRD monsters are searchable for the DM");
  assert.ok(searchEverything("중독",{entities:[],actions:{},selectedActorId:null,role:"player"}).some((hit)=>hit.payload.kind==="condition"));
});
