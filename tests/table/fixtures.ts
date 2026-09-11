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
    abilities:{str:18,dex:14,con:16,int:10,wis:12,cha:8},saves:["근력 +7","건강 +6"],skills:["운동 +7"],features:["추가 공격"],equipment:[],items:[],
    resources:[{id:"resource.second-wind",label:"세컨드 윈드",current:1,max:1,source:"전사 1레벨"}],
    attacks:[{id:"action.longsword",name:"롱소드",bonus:7,damage:"1d8 + 4 참격"}],
  } as unknown as CharacterSheet;
}

export function table(queue:number[]) {
  const dice=queuedDice(queue);
  const runtime=new TableRuntime({sessionId:"table.test",dice,now:()=>"T"});
  return {runtime,dice};
}

export const hp=(runtime:TableRuntime,id:string)=>runtime.state.rules.combatants[id].life.hp.current;
