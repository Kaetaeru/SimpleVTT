import type { ActionVm, ActivityEntry, SceneEntity } from "../../app/contracts";
import type { DurationSpec } from "../../domain/effects";
import { conditionLabelKo, searchSrdMonsters, type SrdMonster } from "../../app/srdMonsterCatalog";
import { CONDITION_IDS } from "../actors";
import type { Ruling } from "../commands";

/**
 * The workspace's pure model (DM_WORKSPACE.md §2–§5): grouping, selection, targeting, the discretion palette and the
 * unified search are functions of the snapshot, so the screens stay thin and the tests do not need a browser.
 */
export type WorkspaceRole="dm"|"player";
export type SidebarTab="log"|"combat"|"actors"|"items"|"materials"|"rules"|"session";
export const DM_TABS:Array<{id:SidebarTab;label:string;key:string}>=[
  {id:"log",label:"기록",key:"1"},{id:"combat",label:"전투",key:"2"},{id:"actors",label:"액터",key:"3"},{id:"items",label:"아이템",key:"4"},{id:"materials",label:"자료",key:"5"},{id:"rules",label:"규칙",key:"6"},{id:"session",label:"세션",key:"7"},
];
export const PLAYER_TABS:Array<{id:SidebarTab;label:string;key:string}>=[
  {id:"log",label:"기록",key:"1"},{id:"combat",label:"전투",key:"2"},{id:"actors",label:"파티",key:"3"},{id:"materials",label:"자료",key:"4"},{id:"rules",label:"규칙",key:"5"},{id:"session",label:"세션",key:"6"},
];

/** The preview provider may pin `sessionMode`; the table's own order is the truth. */
export function isInitiative(snapshot:{sessionMode:string;scene:{order?:string[];currentActorId:string}}):boolean {
  return snapshot.sessionMode==="initiative"||Boolean(snapshot.scene.order&&snapshot.scene.order.length)||Boolean(snapshot.scene.currentActorId);
}

export interface EntityGroups { enemies:SceneEntity[]; allies:SceneEntity[]; neutrals:SceneEntity[] }
export function groupEntities(entities:SceneEntity[]):EntityGroups {
  return {enemies:entities.filter((entity)=>entity.side==="enemy"),allies:entities.filter((entity)=>entity.side==="ally"),neutrals:entities.filter((entity)=>entity.side==="neutral")};
}

/** HP as a fraction for the bar; a player's stage (0–3) maps to quarters. */
export function hpFraction(entity:SceneEntity):number {
  if(!entity.maxHp) return 0;
  return Math.max(0,Math.min(1,entity.hp/entity.maxHp));
}
export function hpTone(entity:SceneEntity):"good"|"warn"|"bad"|"down" {
  const fraction=hpFraction(entity);
  if(entity.hp<=0) return "down";
  if(fraction>0.5) return "good";
  if(fraction>0.25) return "warn";
  return "bad";
}
export function hpLabel(entity:SceneEntity):string {
  if(entity.hpStage) return entity.hpStage;
  return `${entity.hp}${entity.tempHp?`+${entity.tempHp}`:""} / ${entity.maxHp}`;
}

/** Shift-click grows the selection; a plain click replaces it. */
export function nextSelection(current:string[],id:string,extend:boolean):string[] {
  if(!extend) return [id];
  return current.includes(id)?current.filter((entry)=>entry!==id):[...current,id];
}

/** How an action tile is executed: at once, or after picking targets on the table. */
export type TargetingPlan=
  |{kind:"immediate";targetIds:string[]}
  |{kind:"pick";max:number;eligible:string[]};
export function targetingPlan(action:ActionVm,actorId:string):TargetingPlan {
  if(action.target==="none") return {kind:"immediate",targetIds:[]};
  if(action.target==="self") return {kind:"immediate",targetIds:[actorId]};
  const max=action.maxTargets??(action.target==="multi-enemy"?Math.max(1,action.eligibleTargetIds.length):1);
  if(action.eligibleTargetIds.length===1&&max===1) return {kind:"immediate",targetIds:[action.eligibleTargetIds[0]]};
  return {kind:"pick",max,eligible:action.eligibleTargetIds};
}

/** The 14 conditions of 2024 plus the table's own labels, for the palette and the HUD grid. */
export const CONDITION_PALETTE=CONDITION_IDS.map((id)=>({id,label:conditionLabelKo(id)}));
export const QUICK_CONDITIONS=["prone","poisoned","frightened","grappled","restrained","stunned"] as const;

export type DurationPreset="round"|"1min"|"10min"|"1h"|"permanent";
export const DURATION_PRESETS:Array<{id:DurationPreset;label:string}>=[{id:"round",label:"1라운드"},{id:"1min",label:"1분"},{id:"10min",label:"10분"},{id:"1h",label:"1시간"},{id:"permanent",label:"해제할 때까지"}];
export function durationFromPreset(preset:DurationPreset):DurationSpec {
  switch(preset) {
    case "round": return {kind:"seconds",amount:6};
    case "1min": return {kind:"minutes",amount:1};
    case "10min": return {kind:"minutes",amount:10};
    case "1h": return {kind:"hours",amount:1};
    default: return {kind:"permanent"};
  }
}

/** Discretion bar and token HUD inputs become one ruling each (TABLE_RUNTIME.md `ruling`). */
export type DiscretionInput=
  |{kind:"damage";amount:number;damageType?:string}
  |{kind:"heal";amount:number}
  |{kind:"temp-hp";amount:number}
  |{kind:"max-hp";delta:number}
  |{kind:"condition";conditionId:string;on:boolean;preset?:DurationPreset}
  |{kind:"next-roll";state:"advantage"|"disadvantage"}
  |{kind:"inspiration";on:boolean}
  |{kind:"life";state:"down"|"stable"|"dead"|"revive"}
  |{kind:"badge";badge:"hidden"|"cover-half"|"cover-three-quarters";on:boolean};
export function rulingFrom(input:DiscretionInput):Ruling {
  switch(input.kind) {
    case "damage": return {kind:"damage",amount:Math.max(0,Math.floor(input.amount)),...(input.damageType?{damageType:input.damageType}:{})};
    case "heal": return {kind:"heal",amount:Math.max(0,Math.floor(input.amount))};
    case "temp-hp": return {kind:"temp-hp",amount:Math.max(0,Math.floor(input.amount))};
    case "max-hp": return {kind:"max-hp",delta:Math.floor(input.delta)};
    case "condition": return {kind:"condition",conditionId:input.conditionId as Ruling extends {kind:"condition";conditionId:infer C}?C:never,on:input.on,...(input.on?{duration:durationFromPreset(input.preset??"permanent")}:{})};
    case "next-roll": return {kind:"next-roll",state:input.state,family:"any"};
    case "inspiration": return {kind:"inspiration",on:input.on};
    case "life": return {kind:"life",state:input.state};
    case "badge": return {kind:"badge",badge:input.badge,on:input.on};
  }
}

/** The log filter of the 기록 tab: everything, public only, or DM only. */
export type LogFilter="all"|"public"|"dm";
export function filterActivity(entries:ActivityEntry[],filter:LogFilter):ActivityEntry[] {
  if(filter==="all") return entries;
  return entries.filter((entry)=>filter==="public"?(entry.visibility??"public")==="public":(entry.visibility??"public")!=="public");
}

export function formatClock(seconds:number):string {
  const total=Math.max(0,Math.floor(seconds));
  const hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),rest=total%60;
  if(hours) return `${hours}시간 ${minutes}분`;
  if(minutes) return `${minutes}분${rest?` ${rest}초`:""}`;
  return `${rest}초`;
}

/** Ctrl+K: one search over the tabs, each hit carrying its default verb (DM_WORKSPACE.md §2). */
export interface SearchHit { id:string; tab:SidebarTab; label:string; detail:string; verb:string; payload:{kind:"entity";entityId:string}|{kind:"monster";monsterId:string}|{kind:"condition";conditionId:string}|{kind:"action";actorId:string;actionId:string}|{kind:"tab";tab:SidebarTab} }
export function searchEverything(query:string,input:{entities:SceneEntity[];actions:Record<string,ActionVm[]>;selectedActorId:string|null;role:WorkspaceRole;monsters?:(query:string)=>SrdMonster[]}):SearchHit[] {
  const q=query.trim().toLowerCase();
  if(!q) return [];
  const hits:SearchHit[]=[];
  for(const entity of input.entities) if(entity.name.toLowerCase().includes(q)) hits.push({id:`entity:${entity.id}`,tab:"combat",label:entity.name,detail:`${entity.side==="enemy"?"상대":entity.side==="ally"?"아군":"중립"} · HP ${hpLabel(entity)}`,verb:"선택",payload:{kind:"entity",entityId:entity.id}});
  if(input.selectedActorId) for(const action of input.actions[input.selectedActorId]??[]) if(action.name.toLowerCase().includes(q)) hits.push({id:`action:${action.id}`,tab:"combat",label:action.name,detail:`${action.economy} · ${action.summary}`,verb:action.available?"실행":"불가",payload:{kind:"action",actorId:input.selectedActorId,actionId:action.id}});
  for(const condition of CONDITION_PALETTE) if(condition.label.toLowerCase().includes(q)||condition.id.includes(q)) hits.push({id:`condition:${condition.id}`,tab:"rules",label:condition.label,detail:"상태 (2024)",verb:input.role==="dm"?"적용":"열기",payload:{kind:"condition",conditionId:condition.id}});
  if(input.role==="dm") for(const monster of (input.monsters??searchSrdMonsters)(q).slice(0,8)) hits.push({id:`monster:${monster.id}`,tab:"actors",label:monster.name,detail:`CR ${monster.crText} · HP ${monster.hp} · AC ${monster.ac}`,verb:"소환",payload:{kind:"monster",monsterId:monster.id}});
  for(const tab of DM_TABS) if(tab.label.includes(query.trim())) hits.push({id:`tab:${tab.id}`,tab:tab.id,label:`${tab.label} 탭`,detail:`단축키 ${tab.key}`,verb:"열기",payload:{kind:"tab",tab:tab.id}});
  return hits.slice(0,24);
}

/** A monster tile in the 액터 tab. */
export interface MonsterListing { id:string; name:string; nameEn:string; cr:string; hp:number; ac:number; size:string; type:string }
export function monsterListings(query:string,limit=40):MonsterListing[] {
  return searchSrdMonsters(query).slice(0,limit).map((monster)=>({id:monster.id,name:monster.name,nameEn:monster.nameEn,cr:monster.crText,hp:monster.hp,ac:monster.ac,size:monster.size,type:monster.creatureType}));
}
