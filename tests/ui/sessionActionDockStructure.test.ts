import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const css = readFileSync("src/session-action-dock.css", "utf8");
const model = readFileSync("src/playerExperienceModel.ts", "utf8");

test("Session Action Dock replaces the placeholder footer with a compact intent-first surface", () => {
  assert.match(root, /<SessionActionDock/);
  assert.match(root, /actorId=\{actionActorId\}/);
  assert.match(dock, /FREEFORM_RESTING[^\n]*\["attack", "magic", "search", "influence", "help"\]/);
  assert.match(dock, /INITIATIVE_RESTING[^\n]*\["attack", "magic", "dash", "disengage", "dodge", "help"\]/);
  assert.match(dock, />모든 행동</);
  assert.match(dock, /OFFICIAL_PLAY_INTENTS\.map/);
  assert.doesNotMatch(dock, /HOTBAR_TABS|"common"|"spells"|"items"|"passives"|"custom"/);
});

test("intent options and legality come from canonical ActionVm projections", () => {
  assert.match(dock, /OFFICIAL_PLAY_INTENTS, intentOptions/);
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.match(dock, /intentOptions\(intentId, actions\)/);
  assert.match(dock, /action\.available/);
  assert.match(dock, /action\.disabledReason/);
  assert.match(model, /export function intentOptions/);
  assert.doesNotMatch(dock, /economyByActor/);
});

test("no-target and self actions use the existing resolveAction command with duplicate pending protection", () => {
  assert.match(dock, /const \{ snapshot, resolveAction \} = useSimpleVtt\(\)/);
  assert.match(dock, /if \(pendingActionId\) return/);
  assert.match(dock, /action\.target === "none"[\s\S]*runAction\(action, \[\]\)/);
  assert.match(dock, /action\.target === "self"[\s\S]*runAction\(action, \[actorId\]\)/);
  assert.match(dock, /setPendingActionId\(action\.id\)/);
  assert.match(dock, /await resolveAction\(action\.id, targetIds\)/);
});

test("target picker consumes eligibleTargetIds directly and never invents distance legality", () => {
  assert.match(dock, /selectedAction\.eligibleTargetIds\.map/);
  assert.match(dock, /selectedAction\.eligibleTargetIds\.includes\(targetId\)/);
  assert.match(dock, /data-action-dock-state=\{selectedActionId \? "target"/);
  assert.doesNotMatch(dock, /filter\([^\n]*distance|parseInt\([^\n]*distance|distanceFeet|5 ft 내/);
});

test("single target executes immediately while multi-target selection honors canonical maxTargets", () => {
  assert.match(dock, /if \(!multiTarget\)[\s\S]*runAction\(selectedAction, \[targetId\]\)/);
  assert.match(dock, /selectedAction\.maxTargets \?\? targetCandidates\.length/);
  assert.match(dock, /current\.length >= maxTargets/);
  assert.match(dock, /runAction\(selectedAction, selectedTargetIds\)/);
  assert.match(dock, />실행</);
});

test("target selections reconcile against new canonical eligibility while Rules and Sheet overlays preserve the mounted flow", () => {
  assert.match(dock, /current\.filter\(\(id\) => selectedAction\.eligibleTargetIds\.includes\(id\)\)\.slice\(0, maxTargets\)/);
  assert.match(root, /suspended=\{Boolean\(activeUtility \|\| workspaceLayer \|\| snapshot\.resolution\)\}/);
  assert.match(dock, /event\.key !== "Escape" \|\| suspended/);
  assert.match(dock, /onOpenRules\(event\.currentTarget\)/);
  assert.match(dock, /useEffect\(\(\) => \{[\s\S]*resetFlow\(\);[\s\S]*\}, \[actorId\]\)/);
});

test("Action Dock expands upward from the fixed Session footer and target picker remains responsive", () => {
  assert.match(css, /\.session-action-dock-panel\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*0;/);
  assert.match(css, /\.session-action-dock-panel\.expanded[\s\S]*max-height:\s*min\(42vh, 360px\)/);
  assert.match(css, /\.session-action-target-layout/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
