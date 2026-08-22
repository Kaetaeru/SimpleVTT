import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeSessionHotbarCategoryOrder, normalizeSessionHotbarRows } from "../../src/app/sessionHotbarPreferences";

const dock=readFileSync("src/SessionActionDock.tsx","utf8");
const root=readFileSync("src/SessionModeRoot.tsx","utf8");
const boards=readFileSync("src/SessionActorBoards.tsx","utf8");
const cursor=readFileSync("src/SessionTargetingCursor.tsx","utf8");
const css=readFileSync("src/session-integrated-reference-play.css","utf8");

test("Connected Play keeps six canonical presentation pages",()=>{
  assert.match(root,/aria-label="Command Center"/);
  assert.match(dock,/type HotbarPage = "mixed" \| SessionHotbarCategory/);
  for (const label of ["통합","행동","직업","아이템","특수","커스텀"]) assert.match(dock,new RegExp(`label:\s*"${label}"`));
  assert.match(dock,/snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.doesNotMatch(dock,/OFFICIAL_PLAY_INTENTS|intentOptions|모든 행동/);
});

test("Mixed separates persistent player-adjustable category sections",()=>{
  assert.deepEqual(normalizeSessionHotbarCategoryOrder('["item","action"]'),["item","action","class","special","custom"]);
  assert.match(dock,/session-hotbar-unified/);
  assert.match(dock,/groupedActions\.map/);
  assert.match(dock,/writeSessionHotbarCategoryOrder/);
  assert.match(dock,/왼쪽으로 이동/);
  assert.match(dock,/오른쪽으로 이동/);
  assert.match(css,/\.session-hotbar-category-slots[\s\S]*grid-template-rows:repeat\(var\(--session-hotbar-rows\),42px\)/);
});

test("Hotbar is a locally persisted 2-4 row 1:1 icon matrix",()=>{
  assert.equal(normalizeSessionHotbarRows(2),2);
  assert.equal(normalizeSessionHotbarRows("3"),3);
  assert.equal(normalizeSessionHotbarRows(4),4);
  assert.equal(normalizeSessionHotbarRows(9),2);
  assert.match(dock,/readSessionHotbarRows/);
  assert.match(dock,/writeSessionHotbarRows/);
  assert.match(dock,/핫바 줄 줄이기/);
  assert.match(dock,/핫바 줄 늘리기/);
  assert.match(css,/grid-template-rows:\s*repeat\(var\(--session-hotbar-rows\), 42px\)/);
  assert.match(css,/grid-auto-flow:\s*column/);
  assert.match(css,/width:\s*42px;[\s\S]*height:\s*42px/);
});

test("icon-only slots expose detailed hover and focus information",()=>{
  assert.match(dock,/ActionIcon action=\{action\}/);
  assert.match(dock,/actionIconDescriptor\(tooltip\.action\)\.label/);
  assert.doesNotMatch(dock,/slotGlyph/);
  assert.match(dock,/onPointerEnter=/);
  assert.match(dock,/onFocus=/);
  assert.match(dock,/role="tooltip"/);
  assert.match(dock,/targetCopy\(tooltip\.action\.target\)/);
  assert.match(dock,/actionEffect\(tooltip\.action\)/);
  assert.match(css,/\.session-reference-command-center \.session-hotbar-slot > strong \{ display: none; \}/);
});

test("targeting is lifted to Actor Boards with a pointer tether and no picker overlay",()=>{
  assert.match(root,/targetingActionId/);
  assert.match(root,/targetingAction\.eligibleTargetIds\.includes\(entityId\)/);
  assert.match(root,/await resolveAction\(targetingAction\.id,targetIds\)/);
  assert.match(root,/targetingAction\.target!=="multi-enemy"/);
  assert.match(root,/SessionTargetingCursor/);
  assert.match(root,/\.session-actor-card\[data-actor-id\]/);
  assert.match(root,/element\.dataset\.actorId===action\.actorId/);
  assert.match(cursor,/pointermove/);
  assert.match(cursor,/markerEnd="url\(#session-target-arrow\)"/);
  assert.match(boards,/targetingAction\?\.eligibleTargetIds\.includes\(entity\.id\)/);
  assert.doesNotMatch(dock,/session-action-target-overlay|session-action-target-list/);
});

test("Actor Cards are portrait-only damage frames with hover AC detail",()=>{
  assert.match(boards,/session-actor-damage-fill/);
  assert.match(boards,/100-hpPercent\(entity\)/);
  assert.match(boards,/AC \$\{entity\.ac\}/);
  assert.match(boards,/role="tooltip"/);
  assert.match(boards,/session-actor-tooltip-hp/);
  assert.match(boards,/eligibleTargetReasons/);
  assert.doesNotMatch(boards,/session-actor-card-copy|session-actor-card-vitals|session-actor-card-hp/);
  assert.match(css,/height:\s*var\(--session-actor-damage\)/);
});

test("controlled portrait repeats the scene damage frame and exact HP",()=>{
  assert.match(dock,/session-controlled-damage-fill/);
  assert.match(dock,/session-controlled-damage-frame/);
  assert.match(dock,/sanitizeCharacterPortrait/);
  assert.match(dock,/HP \{actorHp\}\/\{actorMaxHp\}/);
  assert.match(css,/height:\s*var\(--session-controlled-damage\)/);
});

test("Main Hand is explicit and has no smart fallback",()=>{
  assert.match(dock,/item\.wieldSlot==="main-hand"/);
  assert.match(dock,/mainHandItem\.grantedActionIds\.includes\(action\.id\)/);
  assert.match(dock,/명시된 주무기 없음/);
  assert.doesNotMatch(dock,/sort\(|strongest|unarmed|cantrip/);
});

test("no-target and self actions still use the existing resolver",()=>{
  assert.match(dock,/if \(pendingActionId\) return/);
  assert.match(dock,/action\.target==="none"/);
  assert.match(dock,/runImmediate\(action,\[\]\)/);
  assert.match(dock,/action\.target==="self"&&actorId/);
  assert.match(dock,/await resolveAction\(action\.id,targetIds\)/);
});

test("ability checks use one catalog while official actions remain normal action-category slots",()=>{
  assert.match(dock,/ABILITY_CHECK_GROUPS/);
  assert.match(dock,/session-action-library ability/);
  assert.match(dock,/!action\.id\.startsWith\("action\.skill\."\)/);
  assert.match(dock,/action\.id==="action\.dash"\|\|action\.id\.startsWith\("action\.standard\."\)/);
  assert.match(dock,/const dockActions=useMemo\(\(\)=>actions\.filter\(\(action\)=>!action\.id\.startsWith\("action\.skill\."\)\)/);
  assert.match(css,/\.session-ability-check-groups/);
  assert.doesNotMatch(dock,/session-standard-action-strip|standardPicker|chooseStandard/);
});

test("174px is the two-row minimum and 3-4 rows expand the command center",()=>{
  assert.match(css,/--svtt-command-h:\s*max\(174px, calc\(77px \+ var\(--session-hotbar-rows-active, 2\) \* 46px\)\)/);
  assert.match(dock,/--session-hotbar-rows-active/);
  assert.match(css,/overflow-x:\s*auto/);
});
