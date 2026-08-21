import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const css = readFileSync("src/session-action-dock.css", "utf8");

test("Connected Play uses a persistent Command Center with direct Hotbar pages", () => {
  assert.match(root, /aria-label="Command Center"/);
  assert.match(root, /<SessionActionDock/);
  assert.match(dock, /type HotbarPage = "mixed" \| "action" \| "spell" \| "item"/);
  assert.match(dock, /HOTBAR_PAGES/);
  for (const label of ["혼합", "행동", "주문", "아이템"]) assert.match(dock, new RegExp(`label: "${label}"`));
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.doesNotMatch(dock, /OFFICIAL_PLAY_INTENTS|intentOptions|FREEFORM_RESTING|INITIATIVE_RESTING|모든 행동/);
});

test("Command Center projects the actual Actor summary resources and Initiative economy without inventing them", () => {
  assert.match(dock, /snapshot\.scene\.entities\.find\(\(entity\) => entity\.id === actorId\)/);
  assert.match(dock, /snapshot\.activeCharacter\.id === actorId/);
  assert.match(dock, /snapshot\.activeCharacter\.resources/);
  assert.match(dock, /snapshot\.sessionMode === "initiative" \? snapshot\.scene\.economyByActor\[actorId\]/);
  assert.match(dock, /session-command-resources/);
  assert.match(dock, /session-command-economy/);
});

test("Hotbar page filters are presentation over canonical ActionVm projections", () => {
  assert.match(dock, /function pageIncludes\(page: HotbarPage, action: ActionVm\)/);
  assert.match(dock, /page === "spell"[\s\S]*action\.category === "magic"/);
  assert.match(dock, /page === "item"[\s\S]*Boolean\(action\.itemCost\)/);
  assert.match(dock, /visibleActions = useMemo\(\(\) => actions\.filter/);
  assert.match(dock, /action\.available/);
  assert.match(dock, /action\.disabledReason/);
  assert.doesNotMatch(dock, /distanceFeet|parseInt\([^\n]*distance|lineOfSight|pathfinding/);
});

test("no-target and self actions use the existing resolveAction command with duplicate pending protection", () => {
  assert.match(dock, /const \{ snapshot, resolveAction \} = useSimpleVtt\(\)/);
  assert.match(dock, /if \(pendingActionId\) return/);
  assert.match(dock, /action\.target === "none"[\s\S]*runAction\(action, \[\]\)/);
  assert.match(dock, /action\.target === "self" && actorId[\s\S]*runAction\(action, \[actorId\]\)/);
  assert.match(dock, /await resolveAction\(action\.id, targetIds\)/);
});

test("manual target set consumes eligibleTargetIds directly and preserves immediate single-target execution", () => {
  assert.match(dock, /selectedAction\.eligibleTargetIds/);
  assert.match(dock, /selectedAction\.eligibleTargetIds\.includes\(targetId\)/);
  assert.match(dock, /if \(!multiTarget\)[\s\S]*runAction\(selectedAction, \[targetId\]\)/);
  assert.match(dock, /selectedAction\.maxTargets \?\? targetCandidates\.length/);
  assert.match(dock, /runAction\(selectedAction, selectedTargetIds\)/);
  assert.match(dock, />실행</);
});

test("target selections reconcile against new canonical eligibility while Session overlays preserve the mounted flow", () => {
  assert.match(dock, /current\.filter\(\(id\) => selectedAction\.eligibleTargetIds\.includes\(id\)\)\.slice\(0, maxTargets\)/);
  assert.match(root, /suspended=\{Boolean\(activeUtility \|\| workspaceLayer \|\| snapshot\.resolution \|\| playerHandoutOpen\)\}/);
  assert.match(root, /playerHandoutOpen/);
  assert.match(dock, /event\.key !== "Escape" \|\| suspended \|\| !selectedActionId/);
  assert.match(dock, /onOpenRules\(event\.currentTarget\)/);
});

test("Command Center stays fixed while targeting expands upward and narrow layouts remain usable", () => {
  assert.match(css, /\.session-command-center\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.session-hotbar-slots\s*\{[\s\S]*display:\s*flex;[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.session-action-target-overlay\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*100%/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
