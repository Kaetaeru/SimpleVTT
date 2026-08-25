import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const boards = readFileSync("src/SessionActorBoards.tsx", "utf8");
const focus = readFileSync("src/SessionMainFocus.tsx", "utf8");
const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const initiative = readFileSync("src/SessionInitiativeStrip.tsx", "utf8");
const runtimeCss = readFileSync("src/session-integrated-reference-play.css", "utf8");
const chromeCss = readFileSync("src/session-integrated-reference-chrome.css", "utf8");
const prototypeJs = readFileSync("docs/design/ui-ux/prototype/app/integrated-reference.js", "utf8");
const prototypeCss = readFileSync("docs/design/ui-ux/prototype/app/integrated-reference.css", "utf8");
const coreSystems = readFileSync("docs/design/ui-ux/prototype/app/core-systems-reference.js", "utf8");

test("production Play DOM follows the accepted integrated-reference scene, not a structural approximation", () => {
  const chrome = root.indexOf('className="session-reference-play-chrome"');
  const main = root.indexOf('className={`session-reference-play-main');
  const core = root.indexOf('className={`session-reference-play-core');
  const upper = root.indexOf('<SessionActorBoard position="upper" role={role}');
  const stage = root.indexOf('className="session-play-context session-reference-mapless-stage"');
  const lower = root.indexOf('<SessionActorBoard position="lower" role={role}');
  const command = root.indexOf('aria-label="Command Center"');
  assert.ok(chrome >= 0 && main > chrome && core > main && upper > core && stage > upper && lower > stage && command > lower);
  assert.match(prototypeJs, /renderPlayChrome\(\)[\s\S]*renderActorBoard\('opposing'\)[\s\S]*renderMaplessStage\(\)[\s\S]*renderActorBoard\('allied'\)[\s\S]*renderCommandCenter\(\)/);
  assert.doesNotMatch(root, /session-mode-rail/);
});

test("production retains topology while WO-UI-006 uses tall boards and adaptive command height", () => {
  assert.match(prototypeCss, /--actor-board-h:86px;[\s\S]*--command-h:174px/);
  assert.match(prototypeCss, /\.play-root\{[^}]*grid-template-rows:41px 1fr var\(--command-h\)/);
  assert.match(runtimeCss, /--svtt-actor-board-h:\s*112px/);
  assert.match(runtimeCss, /--svtt-command-h:\s*max\(200px/);
  assert.match(runtimeCss, /grid-template-rows:\s*41px minmax\(0, 1fr\) var\(--svtt-command-h\)/);
  assert.match(runtimeCss, /grid-template-rows:\s*var\(--svtt-actor-board-h\) minmax\(0, 1fr\) var\(--svtt-actor-board-h\)/);
});

test("DM Play chrome keeps accepted geometry while the Core Systems pass lowers utility density", () => {
  for (const label of ["← 제품", "시트", "규칙", "Public", "DM Only", "기록", "인카운터", "＋ 빠른 메뉴", "세션"]) assert.match(root, new RegExp(`>${label}<`));
  assert.doesNotMatch(root, />Handout<\/button>/);
  const rules = root.indexOf('>규칙</button>');
  const visibility = root.indexOf('className="session-reference-visibility"');
  const activity = root.indexOf('>기록</button>');
  const encounter = root.indexOf('>인카운터</button>');
  const quick = root.indexOf('>＋ 빠른 메뉴</button>');
  const session = root.indexOf('>세션</button>');
  assert.ok(rules >= 0 && visibility > rules && activity > visibility && encounter > activity && quick > encounter && session > quick);
  assert.match(root, /GAP-DM-ONLY-DELIVERY-PROTOCOL/);
  assert.doesNotMatch(root, /session-reference-unavailable-control|Spatial Facts/);
  assert.match(coreSystems,/data-action="toggle-quick"/);
  assert.match(root,/SessionQuickPalette/);
  assert.match(runtimeCss, /\.session-reference-play-chrome\s*\{[\s\S]*display:\s*flex/);
  assert.match(runtimeCss, /\.session-reference-play-chrome > button,[\s\S]*height:\s*27px/);
  assert.match(chromeCss, /\.session-reference-visibility/);
  assert.match(chromeCss, /\.session-reference-unavailable-control/);
  assert.doesNotMatch(root, /session-mode-character-chip|session-mode-role-controls|session-mode-bar/);
});

test("Actor Boards project canonical Scene entities as portrait combat frames", () => {
  assert.match(boards, /snapshot\.scene\.entities\.filter\(\(entity\)=>entity\.side===wantedSide\)/);
  assert.match(boards, /await selectDmActor\(entity\.id\)/);
  assert.match(runtimeCss, /\.session-reference-play-root \.session-actor-board-label \{ display: none; \}/);
  assert.match(runtimeCss, /\.session-reference-play-root \.session-actor-card\s*\{[\s\S]*flex-basis:\s*70px;[\s\S]*max-width:\s*70px;[\s\S]*height:\s*98px/);
  assert.match(runtimeCss, /justify-content:\s*safe center/);
  assert.match(runtimeCss, /overflow-x:\s*auto/);
  assert.doesNotMatch(boards, /pathfind|lineOfSight|fog|tokenPosition|distanceFeet|actorCoordinate/);
});

test("Mapless Stage uses last-roll art in Freeform and current-turn art with compact Initiative strip", () => {
  assert.match(root, /테이블 플레이 공간/);
  assert.match(root, /지도 없이 현재 맥락과 결과만 표시/);
  assert.match(runtimeCss, /radial-gradient\(ellipse at 50% 45%/);
  assert.match(runtimeCss, /\.session-reference-stage-focus[\s\S]*place-items:\s*center/);
  assert.match(focus, /session-last-roll-actor/);
  assert.match(focus, /LAST ROLL/);
  assert.match(focus, /session-current-turn-actor/);
  assert.match(focus, /CURRENT TURN · ROUND/);
  assert.match(initiative, /session-reference-initiative-strip/);
  assert.doesNotMatch(initiative, /session-initiative-economy|session-initiative-controls|endInitiative|endTurn/);
  assert.match(runtimeCss, /\.session-reference-initiative-strip\s*\{[\s\S]*height:\s*40px/);
});

test("Command Center uses accepted rail body and six-page grouped Hotbar", () => {
  const top = dock.indexOf('className="session-command-top"');
  const body = dock.indexOf('className="session-command-body"');
  const controlled = dock.indexOf('className="session-controlled-actor"');
  const hotbar = dock.indexOf('className="session-hotbar"');
  const context = dock.indexOf('className="session-command-context"');
  assert.ok(top >= 0 && body > top && controlled > body && hotbar > controlled && context > hotbar);
  assert.match(dock, /자유 진행 · 턴 자원 없음/);
  for (const label of ["통합", "행동", "직업", "아이템", "특수", "커스텀"]) assert.match(dock, new RegExp(`label:\\s*"${label}"`));
  assert.match(dock,/session-hotbar-unified/);
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.match(dock, /action\.disabledReason/);
  assert.match(runtimeCss, /\.session-reference-command-center \.session-command-body \{ grid-template-columns:\s*178px minmax\(0,1fr\) 104px/);
  assert.match(runtimeCss, /\.session-reference-command-center \.session-hotbar-slot\s*\{[\s\S]*width:\s*42px;[\s\S]*height:\s*42px/);
  assert.doesNotMatch(dock, /OFFICIAL_PLAY_INTENTS|intentOptions|intentId|모든 행동/);
});

test("contextual utilities use the accepted right-side pane relationship", () => {
  assert.match(root, /session-reference-utility-host/);
  assert.match(runtimeCss, /\.session-reference-utility-host\s*\{[\s\S]*width:\s*338px;[\s\S]*min-width:\s*288px;[\s\S]*max-width:\s*455px/);
  assert.match(runtimeCss, /@media \(max-width: 1000px\)[\s\S]*\.session-reference-utility-host \{ position: absolute;/);
});

test("accepted scene still respects mapless and blocked-authority boundaries", () => {
  assert.doesNotMatch(boards, /resolveAction|Main Hand|mainHand/);
  assert.match(dock, /wieldSlot==="main-hand"/);
  assert.doesNotMatch(dock, /distanceFeet|lineOfSight|pathfinding|coverFromMap|actorCoordinate/);
});
