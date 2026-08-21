import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");
const bridge=read("src/CombatVfxBridge.tsx");
const projection=read("src/app/combatVisuals.ts");
const css=read("src/combat-vfx.css");
const main=read("src/main.tsx");

test("Combat VFX is a mounted presentation bridge and only replays in Initiative combat",()=>{
  assert.match(main,/import \{ CombatVfxBridge \} from "\.\/CombatVfxBridge"/);
  assert.match(main,/import "\.\/combat-vfx\.css"/);
  assert.match(main,/<CombatVfxBridge \/>/);
  assert.match(bridge,/createPortal/);
  assert.match(bridge,/document\.body/);
  assert.match(bridge,/snapshot\.sessionMode!=="initiative"/);
  assert.match(bridge,/buildCombatVfxProfile/);
  assert.match(bridge,/\.session-actor-card\[data-actor-id\]/);
  assert.match(bridge,/element\.dataset\.actorId===entityId/);
  assert.doesNotMatch(bridge,/\.play-v09-scene-row|\.play-v09-actor/);
});

test("VFX presentation reads public Action damage metadata but never target defenses or mechanics mutators",()=>{
  assert.match(projection,/action\.damage/);
  assert.doesNotMatch(projection,/resistance|resistances|immunity|immunities|vulnerab|targetAc|secret/i);
  for(const source of [projection,bridge]) assert.doesNotMatch(source,/resolveAction|advanceResolution|respondToInterrupt|endTurn|startInitiative|endInitiative/);
});

test("physical delivery and elemental visual vocabularies remain separate and composable",()=>{
  for(const motion of ["slashing","piercing","bludgeoning","projectile","beam","wave","impact"]) assert.match(projection,new RegExp(`"${motion}"`));
  for(const element of ["fire","lightning","poison","cold","force","acid","radiant","necrotic","thunder","psychic"]) assert.match(projection,new RegExp(`"${element}"`));
  assert.match(projection,/physical\?\?=/);
  assert.match(projection,/element\?\?=/);
  assert.match(css,/delivery-slashing/);
  assert.match(css,/delivery-piercing/);
  assert.match(css,/delivery-bludgeoning/);
  assert.match(css,/element-fire/);
  assert.match(css,/element-lightning/);
  assert.match(css,/element-poison/);
});

test("semantic effect colors are fixed feedback and do not depend on the user accent token",()=>{
  assert.match(css,/element-fire\{--vfx:#ff6336;--vfx-2:#ffc34d\}/);
  assert.match(css,/element-lightning\{--vfx:#61c8ff;--vfx-2:#f5fbff\}/);
  assert.match(css,/element-poison\{--vfx:#70c84a;--vfx-2:#c9ff72\}/);
  assert.match(css,/element-cold\{--vfx:#5ddcff;--vfx-2:#e2fcff\}/);
  assert.match(css,/element-force\{--vfx:#ad7cff;--vfx-2:#ead8ff\}/);
});

test("combat VFX is metadata driven instead of spell-name hardcoding",()=>{
  for(const name of ["Fire Bolt","Witch Bolt","Poison Spray","Ray of Frost","Magic Missile"]) assert.doesNotMatch(projection,new RegExp(name,"i"));
});
