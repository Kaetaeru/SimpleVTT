import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const css = readFileSync("src/session-integrated-reference-play.css", "utf8");

test("Connected Play uses the accepted persistent Command Center with direct Hotbar pages", () => {
  assert.match(root, /aria-label="Command Center"/);
  assert.match(root, /<SessionActionDock/);
  assert.match(dock, /type HotbarPage = "mixed" \| "action" \| "spell" \| "item"/);
  for (const label of ["Mixed", "Action", "Spell", "Item"]) assert.match(dock, new RegExp(`label: "${label}"`));
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.doesNotMatch(dock, /OFFICIAL_PLAY_INTENTS|intentOptions|FREEFORM_RESTING|INITIATIVE_RESTING|모든 행동/);
});

test("Command Center anatomy matches accepted top rail plus controlled Actor Hotbar context body", () => {
  const top = dock.indexOf('className="session-command-top"');
  const body = dock.indexOf('className="session-command-body"');
  const actor = dock.indexOf('className="session-controlled-actor"');
  const hotbar = dock.indexOf('className="session-hotbar"');
  const context = dock.indexOf('className="session-command-context"');
  assert.ok(top >= 0 && body > top && actor > body && hotbar > actor && context > hotbar);
  assert.match(css, /\.session-reference-command-center[\s\S]*grid-template-rows:\s*37px minmax\(0, 1fr\)/);
  assert.match(css, /\.session-command-body[\s\S]*grid-template-columns:\s*240px minmax\(0, 1fr\) 104px/);
});

test("Command Center projects actual Actor resources and Initiative economy without inventing them", () => {
  assert.match(dock, /snapshot\.scene\.entities\.find\(\(entity\) => entity\.id === actorId\)/);
  assert.match(dock, /snapshot\.activeCharacter\.id === actorId/);
  assert.match(dock, /snapshot\.activeCharacter\.resources/);
  assert.match(dock, /snapshot\.sessionMode === "initiative" \? snapshot\.scene\.economyByActor\[actorId\]/);
  assert.match(dock, /FREEFORM · no turn economy/);
  assert.match(dock, /session-command-resources/);
  assert.match(dock, /session-command-economy/);
});

test("Hotbar page filters remain presentation over canonical ActionVm projections", () => {
  assert.match(dock, /function pageIncludes\(page: HotbarPage, action: ActionVm\)/);
  assert.match(dock, /page === "spell"[\s\S]*action\.category === "magic"/);
  assert.match(dock, /page === "item"[\s\S]*Boolean\(action\.itemCost\)/);
  assert.match(dock, /visibleActions = useMemo\(\(\) => actions\.filter/);
  assert.match(dock, /action\.available/);
  assert.match(dock, /action\.disabledReason/);
  assert.doesNotMatch(dock, /distanceFeet|parseInt\([^\n]*distance|lineOfSight|pathfinding/);
  assert.match(css, /\.session-hotbar-slot[\s\S]*flex:\s*0 0 70px/);
});

test("no-target and self actions use existing resolveAction with duplicate pending protection", () => {
  assert.match(dock, /const \{ snapshot, resolveAction, endTurn \} = useSimpleVtt\(\)/);
  assert.match(dock, /if \(pendingActionId\) return/);
  assert.match(dock, /action\.target === "none"[\s\S]*runAction\(action, \[\]\)/);
  assert.match(dock, /action\.target === "self" && actorId[\s\S]*runAction\(action, \[actorId\]\)/);
  assert.match(dock, /await resolveAction\(action\.id, targetIds\)/);
});

test("manual target set still consumes eligibleTargetIds directly", () => {
  assert.match(dock, /selectedAction\.eligibleTargetIds/);
  assert.match(dock, /selectedAction\.eligibleTargetIds\.includes\(targetId\)/);
  assert.match(dock, /if \(!multiTarget\)[\s\S]*runAction\(selectedAction, \[targetId\]\)/);
  assert.match(dock, /selectedAction\.maxTargets \?\? targetCandidates\.length/);
  assert.match(dock, /runAction\(selectedAction, selectedTargetIds\)/);
  assert.match(dock, /Execute · \{selectedTargetIds\.length\}/);
});

test("target selections reconcile against canonical eligibility while overlays preserve mounted Play", () => {
  assert.match(dock, /current\.filter\(\(id\) => selectedAction\.eligibleTargetIds\.includes\(id\)\)\.slice\(0, maxTargets\)/);
  assert.match(root, /suspended=\{Boolean\(activeUtility \|\| workspaceLayer \|\| snapshot\.resolution \|\| playerHandoutOpen\)\}/);
  assert.match(root, /playerHandoutOpen/);
  assert.match(dock, /event\.key !== "Escape" \|\| suspended \|\| !selectedActionId/);
});

test("Command Center remains 174px wide-desktop and Hotbar overflows horizontally", () => {
  assert.match(css, /--svtt-command-h:\s*174px/);
  assert.match(css, /\.session-hotbar-slots[\s\S]*display:\s*flex;[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 1000px\)[\s\S]*--svtt-command-h:\s*164px/);
});
