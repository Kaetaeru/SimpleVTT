import type { SpellMechanicDefinition } from "../domain/spellcasting";
import { spellMultiAttackCount } from "../domain/spellcasting";
import type { MockAdapter } from "./mockAdapter";

type DiceAdapter={d20(actionId:string,index?:number):number};

function d20(adapter:MockAdapter,actionId:string,index:number) {
  return (adapter as unknown as DiceAdapter).d20(actionId,index);
}

function boundedFace(adapter:MockAdapter,actionId:string,index:number,sides:number) {
  return ((d20(adapter,actionId,index)-1)%sides)+1;
}

function formulaCount(definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number) {
  if (definition.primary.kind!=="attack-damage"&&definition.primary.kind!=="save-damage"&&definition.primary.kind!=="healing"&&definition.primary.kind!=="temporary-hp") return 0;
  const formula=definition.primary.dice;
  const cantripSteps=formula.cantripScaling?[5,11,17].filter((level)=>characterLevel>=level).length:0;
  return formula.count+cantripSteps+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(formula.dicePerSlotAboveBase??0);
}

export function spellRuntimeDice(adapter:MockAdapter,actionId:string,definition:SpellMechanicDefinition,slotLevel:number|undefined,characterLevel:number,targetIds:string[]) {
  const primary=definition.primary;
  if (primary.kind==="tracked-effect"||primary.kind==="full-healing") return {authoritative:[],request:{}};
  if (primary.kind==="power-word-kill") {
    const effectFaces=Array.from({length:primary.fallbackDamage.count},(_,index)=>boundedFace(adapter,actionId,index,primary.fallbackDamage.sides));
    return {authoritative:effectFaces,request:{effectFaces}};
  }
  if (primary.kind==="attack-damage") {
    const attackFace=d20(adapter,actionId,0);
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index+1,primary.dice.sides));
    return {authoritative:[attackFace,...effectFaces],request:{attack:{id:`${definition.spellId}:attack`,purpose:`${definition.spellId} spell attack`,sides:20 as const,faces:[attackFace]},effectFaces}};
  }
  if (primary.kind==="multi-attack-damage") {
    const attackCount=spellMultiAttackCount(definition,characterLevel,slotLevel);
    const facesPerAttack=primary.dicePerAttack.count;
    const attackInstances=Array.from({length:attackCount},(_,index)=>{
      const targetId=targetIds[index%targetIds.length];
      const offset=index*(facesPerAttack+1);
      const attackFace=d20(adapter,actionId,offset);
      const effectFaces=Array.from({length:facesPerAttack},(_,faceIndex)=>boundedFace(adapter,actionId,offset+faceIndex+1,primary.dicePerAttack.sides));
      return {targetId,attack:{id:`${definition.spellId}:attack:${index}`,purpose:`${definition.spellId} spell attack ${index+1}`,sides:20 as const,faces:[attackFace]},effectFaces};
    });
    return {authoritative:attackInstances.flatMap((entry)=>[entry.attack.faces[0],...entry.effectFaces]),request:{attackInstances}};
  }
  if (primary.kind==="save-damage") {
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.dice.sides));
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,count+index)]}]));
    return {authoritative:[...effectFaces,...Object.values(saves).flatMap((save)=>save.faces)],request:{effectFaces,saves}};
  }
  if (primary.kind==="save-compound-damage") {
    let offset=0;
    const componentFaces=primary.components.map((component)=>{
      const count=component.dice.count+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(component.dice.dicePerSlotAboveBase??0);
      const faces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,offset+index,component.dice.sides));
      offset+=count;
      return faces;
    });
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,offset+index)]}]));
    return {authoritative:[...componentFaces.flat(),...Object.values(saves).flatMap((save)=>save.faces)],request:{componentFaces,saves}};
  }
  if (primary.kind==="healing"||primary.kind==="temporary-hp") {
    const count=formulaCount(definition,slotLevel,characterLevel);
    const effectFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.dice.sides));
    return {authoritative:[...effectFaces],request:{effectFaces}};
  }
  if (primary.kind==="save-effect") {
    const saves=Object.fromEntries(targetIds.map((targetId,index)=>[targetId,{id:`${definition.spellId}:save:${targetId}`,purpose:`${definition.spellId} saving throw`,sides:20 as const,faces:[d20(adapter,actionId,index)]}]));
    return {authoritative:Object.values(saves).flatMap((save)=>save.faces),request:{saves}};
  }
  const count=primary.baseProjectiles+Math.max(0,(slotLevel??definition.baseLevel)-definition.baseLevel)*(primary.projectilesPerSlotAboveBase??0);
  const projectileFaces=Array.from({length:count},(_,index)=>boundedFace(adapter,actionId,index,primary.projectileDice.sides));
  return {authoritative:[...projectileFaces],request:{projectileFaces}};
}
