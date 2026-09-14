import type { CharacterSheet } from "../app/contracts";
import type { TableState } from "./state";

/**
 * The durable subset of a combatant on its sheet (RULES_RUNTIME_SPECS.md §4): HP, temp HP, resource counts including
 * spell slots, life flags (death saves, stable, dead) and remaining hit dice. Everything else on the sheet is the owner's.
 */
export function durableSheetFor(state:TableState,actorId:string):CharacterSheet|null {
  const actor=state.actors[actorId];
  const combatant=state.rules.combatants[actorId];
  if(!actor||actor.source.kind!=="character"||!combatant) return null;
  const sheet=structuredClone(actor.source.sheet);
  sheet.hp=combatant.life.hp.current;
  sheet.tempHp=combatant.life.hp.temporary;
  sheet.resources=sheet.resources.map((resource)=>{ const pool=combatant.resources.find((entry)=>entry.id===resource.id); return pool?{...resource,current:pool.current,max:pool.maximum}:resource; });
  for(const pool of combatant.resources) {
    if(sheet.resources.some((resource)=>resource.id===pool.id)) continue;
    sheet.resources.push({id:pool.id,label:pool.label,current:pool.current,max:pool.maximum,source:pool.recovery?.shortRest?"table · 짧은 휴식":"table"});
  }
  sheet.durableLifeFlags={stable:combatant.life.stable,unconscious:combatant.life.unconscious,dead:combatant.life.dead,deathSaves:{...combatant.life.deathSaves}};
  if(combatant.hitDice.length) sheet.hitDiceByDie=Object.fromEntries(combatant.hitDice.map((die)=>[`d${die.sides}`,die.current]));
  return sheet;
}

/** What the write-back compares, so only real changes are written. */
export const durableKey=(sheet:CharacterSheet)=>JSON.stringify([sheet.hp,sheet.tempHp,sheet.resources.map((resource)=>[resource.id,resource.current]),sheet.durableLifeFlags,sheet.hitDiceByDie]);
