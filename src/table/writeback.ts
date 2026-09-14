import type { CharacterSheet } from "../app/contracts";
import type { TableState } from "./state";

/** The durable subset of a combatant on its sheet: HP, temp HP, resource counts (RULES_RUNTIME_SPECS.md §4). */
export function durableSheetFor(state:TableState,actorId:string):CharacterSheet|null {
  const actor=state.actors[actorId];
  const combatant=state.rules.combatants[actorId];
  if(!actor||actor.source.kind!=="character"||!combatant) return null;
  const sheet=structuredClone(actor.source.sheet);
  sheet.hp=combatant.life.hp.current;
  sheet.tempHp=combatant.life.hp.temporary;
  sheet.resources=sheet.resources.map((resource)=>{ const pool=combatant.resources.find((entry)=>entry.id===resource.id); return pool?{...resource,current:pool.current}:resource; });
  for(const pool of combatant.resources) if(!sheet.resources.some((resource)=>resource.id===pool.id)&&!pool.id.startsWith("spell-slot-")) sheet.resources.push({id:pool.id,label:pool.label,current:pool.current,max:pool.maximum,source:"table"});
  return sheet;
}

/** What the write-back compares, so only real changes are written. */
export const durableKey=(sheet:CharacterSheet)=>JSON.stringify([sheet.hp,sheet.tempHp,sheet.resources.map((resource)=>resource.current)]);
