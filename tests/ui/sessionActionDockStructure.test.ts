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
  assert.match(dock, /action\.target === "none"[\s\S]*runImmediateAction\(action, \[\]\)/);
  assert.match(dock, /action\.target === "self"[\s\S]*runImmediateAction\(action, \[actorId\]\)/);
  assert.match(dock, /setPendingActionId\(action\.id\)/);
  assert.match(dock, /await resolveAction\(action\.id, targetIds\)/);
});

test("target-requiring actions stop at detail in this slice without inventing a target engine", () => {
  assert.match(dock, /setSelectedActionId\(action\.id\)/);
  assert.match(dock, /data-action-dock-state=\{selectedActionId \? "detail"/);
  assert.match(dock, /사용할 대상을 고르면 이 행동을 실행합니다/);
  assert.doesNotMatch(dock, /filter\([^\n]*distance|parseInt\([^\n]*distance|5 ft 내/);
});

test("Rules and Sheet overlays suspend Escape while the mounted action flow retains local presentation state", () => {
  assert.match(root, /suspended=\{Boolean\(activeUtility \|\| workspaceLayer \|\| snapshot\.resolution\)\}/);
  assert.match(dock, /event\.key !== "Escape" \|\| suspended/);
  assert.match(dock, /onOpenRules\(event\.currentTarget\)/);
  assert.match(dock, /useEffect\(\(\) => \{[\s\S]*resetFlow\(\);[\s\S]*\}, \[actorId\]\)/);
});

test("Action Dock expands upward from the fixed Session footer and remains responsive", () => {
  assert.match(css, /\.session-action-dock-panel\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*0;/);
  assert.match(css, /\.session-action-dock-panel\.expanded[\s\S]*max-height:\s*min\(36vh, 300px\)/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
