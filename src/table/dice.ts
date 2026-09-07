/** The table's only source of randomness. Handlers ask for faces up front; the domain kernel selects among them. */
export interface Dice {
  faces(sides:number,count:number,purpose:string):number[];
}

export function randomDice(random:()=>number=Math.random):Dice {
  return {faces:(sides,count)=>Array.from({length:count},()=>1+Math.floor(random()*sides))};
}

/**
 * Scripted faces for tests and DM-forced rolls: values are consumed in order for every roll of any size; when the
 * queue runs dry the fallback rolls. Out-of-range values are clamped to the die.
 */
export function queuedDice(queue:number[],fallback:Dice=randomDice()):Dice&{remaining():number;push(...values:number[]):void} {
  const pending=[...queue];
  return {
    faces(sides,count,purpose) {
      const out:number[]=[];
      for(let index=0;index<count;index+=1) {
        const value=pending.shift();
        out.push(value===undefined?fallback.faces(sides,1,purpose)[0]:Math.max(1,Math.min(sides,Math.floor(value))));
      }
      return out;
    },
    remaining:()=>pending.length,
    push:(...values)=>{pending.push(...values);},
  };
}

export function parseDiceNotation(text:string):{count:number;sides:number;flat:number}|null {
  const match=/^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(text);
  if(!match) return null;
  const flat=match[3]?Number(match[4])*(match[3]==="-"?-1:1):0;
  return {count:Number(match[1]),sides:Number(match[2]),flat};
}

export const diceAverage=(count:number,sides:number,flat:number)=>Math.floor(count*(sides+1)/2)+flat;
