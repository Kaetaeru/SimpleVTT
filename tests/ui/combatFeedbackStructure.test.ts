import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("F1-01: the combat feedback layer is mounted once beside the VFX bridge and styled by its own sheet", () => {
  const main=read("../../src/main.tsx");
  assert.match(main,/import \{ SessionCombatFeedback \} from "\.\/SessionCombatFeedback"/);
  assert.match(main,/<SessionCombatFeedback \/>/);
  const component=read("../../src/SessionCombatFeedback.tsx");
  assert.match(component,/import "\.\/combat-feedback\.css"/);
  assert.match(component,/createPortal/);
  assert.match(component,/diffCombatFeedback/);
  assert.match(component,/resolutionFeedback/);
  assert.match(component,/combatBannerText/);
  assert.match(component,/\.session-actor-card\[data-actor-id\]/);
  assert.match(component,/isReducedMotionPreferred/);
});

test("F1-01: numbers, card impact and the banner are tokens-based, damage-type tinted, and respect reduced motion", () => {
  const css=read("../../src/combat-feedback.css");
  for(const cls of ["combat-feedback-float","kind-damage","tone-crit","kind-down","kind-condition","combat-feedback-banner","feedback-damage","feedback-critical","feedback-heal","feedback-miss","feedback-down"]) assert.match(css,new RegExp(cls),cls);
  for(const semantic of ["fire","cold","lightning","poison","acid","radiant","necrotic","thunder","psychic","force"]) assert.match(css,new RegExp(`semantic-${semantic}`),semantic);
  assert.match(css,/var\(--bad\)/);assert.match(css,/var\(--good\)/);assert.match(css,/var\(--accent\)/);assert.match(css,/var\(--condition\)/);
  assert.match(css,/:root\[data-motion="reduced"\] \.combat-feedback-float/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css,/linear-gradient|radial-gradient/);
});

test("F1-03: the VFX shots play in 자유 진행 as well as Initiative, and healing has its own delivery", () => {
  const bridge=read("../../src/CombatVfxBridge.tsx");
  assert.doesNotMatch(bridge,/snapshot\.sessionMode!=="initiative"/);
  const visuals=read("../../src/app/combatVisuals.ts");
  assert.match(visuals,/"heal"/);
  assert.match(visuals,/export function combatDamageSemantic/);
  const css=read("../../src/combat-vfx.css");
  assert.match(css,/delivery-heal/);
});
