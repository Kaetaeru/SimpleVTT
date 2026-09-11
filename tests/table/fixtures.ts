import type { CharacterSheet } from "../../src/app/contracts";
import { queuedDice } from "../../src/table/dice";
import { TableRuntime } from "../../src/table/runtime";

export const GOBLIN="dnd.srd521.monster.goblin-warrior"; // HP 10 · AC 15 · 시미터 +1 1d6-1 참격 (근접) · 단궁 +3 1d6+1 관통 (원거리 80피트)
export const BUGBEAR_STALKER="dnd.srd521.monster.bugbear-stalker"; // 던지는 창 +5 3d6+3 관통 · 근접 10피트 또는 투척 30피트
export const P1={peerId:"peer.p1",role:"player" as const};

export function fighter():CharacterSheet {
  return {
    id:"char.kael",name:"카엘",className:"전사",subclassName:"챔피언",level:5,classLevels:[{classId:"dnd.srd521.class.fighter",className:"전사",level:5}],species:"인간",background:"군인",
    hp:31,maxHp:42,tempHp:0,ac:18,speed:30,proficiencyBonus:3,saveState:"saved",
    abilities:{str:18,dex:14,con:16,int:10,wis:12,cha:8},saves:["근력 +7","건강 +6"],skills:["운동 +7"],features:["추가 공격"],equipment:[],
    items:[
      {id:"item.longsword",definitionId:"dnd.srd521.item.weapon.longsword",name:"롱소드",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.longsword"],provenance:[]},
      {id:"item.dagger",definitionId:"dnd.srd521.item.weapon.dagger",name:"단검",kind:"equipment",quantity:2,equipped:true,wielded:false,passiveEffects:[],grantedActionIds:["action.dagger"],provenance:[]},
      {id:"item.potion",definitionId:"dnd.srd521.item.potion-of-healing",name:"치유 물약",kind:"consumable",quantity:2,equipped:false,passiveEffects:[],grantedActionIds:[],provenance:[]},
    ],
    resources:[{id:"resource.second-wind",label:"세컨드 윈드",current:1,max:1,source:"전사 1레벨"}],
    attacks:[{id:"action.longsword",name:"롱소드",bonus:7,damage:"1d8 + 4 참격"},{id:"action.dagger",name:"단검",bonus:7,damage:"1d4 + 4 관통"}],
  } as unknown as CharacterSheet;
}

/** 세라 — 3레벨 생명 영역 클레릭. 주문 DC 13 · 주문 공격 +5 · 슬롯 1레벨 4, 2레벨 2 · 성표(초점) · 메이스 · 방패(가방). */
export function cleric():CharacterSheet {
  return {
    id:"char.sera",name:"세라",className:"클레릭",subclassName:"생명 영역",level:3,classLevels:[{classId:"dnd.srd521.class.cleric",className:"클레릭",level:3}],species:"인간",background:"복사",
    hp:24,maxHp:24,tempHp:0,ac:18,speed:30,proficiencyBonus:2,saveState:"saved",
    abilities:{str:14,dex:10,con:14,int:10,wis:16,cha:12},saves:["지혜 +5","매력 +3"],skills:["의학 +5","통찰 +5"],features:[],equipment:[],
    items:[
      {id:"item.mace",definitionId:"dnd.srd521.item.weapon.mace",name:"메이스",kind:"equipment",quantity:1,equipped:true,wielded:true,wieldSlot:"main-hand",passiveEffects:[],grantedActionIds:["action.mace"],provenance:[]},
      {id:"item.shield",definitionId:"dnd.srd521.item.armor.shield",name:"방패",kind:"equipment",quantity:1,equipped:true,wielded:false,passiveEffects:[],grantedActionIds:[],provenance:[]},
      {id:"item.holy-symbol",definitionId:"dnd.srd521.item.gear.holy-symbol",name:"성표",kind:"equipment",quantity:1,equipped:true,spellcastingComponent:"focus",passiveEffects:[],grantedActionIds:[],provenance:[]},
      {id:"item.holy-water",definitionId:"dnd.srd521.spell.bless.material.1",name:"성수 (축복 재료, 5gp)",kind:"consumable",quantity:1,equipped:false,unitCostGp:5,passiveEffects:[],grantedActionIds:[],provenance:[]},
    ],
    resources:[],
    attacks:[{id:"action.mace",name:"메이스",bonus:4,damage:"1d6 + 2 타격"}],
    cantrips:["dnd.srd521.spell.sacred-flame"],
    preparedSpells:["dnd.srd521.spell.healing-word","dnd.srd521.spell.cure-wounds","dnd.srd521.spell.bless","dnd.srd521.spell.guiding-bolt"],
  } as unknown as CharacterSheet;
}

export function table(queue:number[]) {
  const dice=queuedDice(queue);
  const runtime=new TableRuntime({sessionId:"table.test",dice,now:()=>"T"});
  return {runtime,dice};
}

export const hp=(runtime:TableRuntime,id:string)=>runtime.state.rules.combatants[id].life.hp.current;
