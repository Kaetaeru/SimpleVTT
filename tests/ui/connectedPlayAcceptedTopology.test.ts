import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const boards = readFileSync("src/SessionActorBoards.tsx", "utf8");
const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const initiative = readFileSync("src/SessionInitiativeStrip.tsx", "utf8");
const runtimeCss = readFileSync("src/session-integrated-reference-play.css", "utf8");
const prototypeJs = readFileSync("docs/design/ui-ux/prototype/app/integrated-reference.js", "utf8");
const prototypeCss = readFileSync("docs/design/ui-ux/prototype/app/integrated-reference.css", "utf8");

test("production Play DOM follows the accepted integrated-reference scene, not a structural approximation", () => {
  const chrome = root.indexOf('className="session-reference-play-chrome"');
  const main = root.indexOf('className={`session-reference-play-main');
  const core = root.indexOf('className="session-reference-play-core"');
  const upper = root.indexOf('<SessionActorBoard position="upper" role={role} />');
  const stage = root.indexOf('className="session-play-context session-reference-mapless-stage"');
  const lower = root.indexOf('<SessionActorBoard position="lower" role={role} />');
  const command = root.indexOf('aria-label="Command Center"');
  assert.ok(chrome >= 0 && main > chrome && core > main && upper > core && stage > upper && lower > stage && command > lower);
  assert.match(prototypeJs, /renderPlayChrome\(\)[\s\S]*renderActorBoard\('opposing'\)[\s\S]*renderMaplessStage\(\)[\s\S]*renderActorBoard\('allied'\)[\s\S]*renderCommandCenter\(\)/);
  assert.doesNotMatch(root, /session-mode-rail/);
});

test("production geometry is pinned to the accepted 41 / 86 / flexible / 86 / 174 composition", () => {
  assert.match(prototypeCss, /--actor-board-h:86px;[\s\S]*--command-h:174px/);
  assert.match(prototypeCss, /\.play-root\{[^}]*grid-template-rows:41px 1fr var\(--command-h\)/);
  assert.match(runtimeCss, /--svtt-actor-board-h:\s*86px/);
  assert.match(runtimeCss, /--svtt-command-h:\s*174px/);
  assert.match(runtimeCss, /grid-template-rows:\s*41px minmax\(0, 1fr\) var\(--svtt-command-h\)/);
  assert.match(runtimeCss, /grid-template-rows:\s*var\(--svtt-actor-board-h\) minmax\(0, 1fr\) var\(--svtt-actor-board-h\)/);
});

test("Play chrome matches the accepted top utility model instead of a separate identity header plus vertical rail", () => {
  for (const label of ["← Product", "Sheet", "Rules", "Activity", "Encounter", "Participants", "Handout", "Session"]) assert.match(root, new RegExp(`>${label}<`));
  assert.match(runtimeCss, /\.session-reference-play-chrome\s*\{[\s\S]*display:\s*flex;[\s\S]*height:\s*27px|\.session-reference-play-chrome > button[\s\S]*height:\s*27px/);
  assert.doesNotMatch(root, /session-mode-character-chip|session-mode-role-controls|session-mode-bar/);
});

test("Actor Boards project canonical Scene entities but adopt the accepted card bands", () => {
  assert.match(boards, /snapshot\.scene\.entities\.filter\(\(entity\) => entity\.side === wantedSide\)/);
  assert.match(boards, /await selectDmActor\(entity\.id\)/);
  assert.match(runtimeCss, /\.session-reference-play-root \.session-actor-board-label \{ display: none; \}/);
  assert.match(runtimeCss, /\.session-reference-play-root \.session-actor-card\s*\{[\s\S]*flex:\s*1 0 164px;[\s\S]*max-width:\s*258px;[\s\S]*height:\s*73px/);
  assert.match(runtimeCss, /overflow-x:\s*auto/);
  assert.doesNotMatch(boards, /\bx\s*:|\by\s*:|grid|pathfind|lineOfSight|fog|tokenPosition|distanceFeet/);
});

test("Mapless Stage reproduces the accepted visual role and compact Initiative strip", () => {
  assert.match(root, /MAPLESS PLAY CONTEXT/);
  assert.match(root, /no grid · no map token · no Actor coordinates/);
  assert.match(runtimeCss, /radial-gradient\(ellipse at 50% 45%/);
  assert.match(runtimeCss, /\.session-reference-stage-focus[\s\S]*place-items:\s*center/);
  assert.match(initiative, /session-reference-initiative-strip/);
  assert.doesNotMatch(initiative, /session-initiative-economy|session-initiative-controls|endInitiative|endTurn/);
  assert.match(runtimeCss, /\.session-reference-initiative-strip\s*\{[\s\S]*height:\s*40px/);
});

test("Command Center uses the accepted upper economy/resource rail and 240 / hotbar / 104 lower body", () => {
  const top = dock.indexOf('className="session-command-top"');
  const body = dock.indexOf('className="session-command-body"');
  const controlled = dock.indexOf('className="session-controlled-actor"');
  const hotbar = dock.indexOf('className="session-hotbar"');
  const context = dock.indexOf('className="session-command-context"');
  assert.ok(top >= 0 && body > top && controlled > body && hotbar > controlled && context > hotbar);
  assert.match(dock, /FREEFORM · no turn economy/);
  assert.match(dock, /Mixed/);
  assert.match(dock, /Action/);
  assert.match(dock, /Spell/);
  assert.match(dock, /Item/);
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.match(dock, /action\.disabledReason/);
  assert.match(runtimeCss, /\.session-command-body\s*\{[\s\S]*grid-template-columns:\s*240px minmax\(0, 1fr\) 104px/);
  assert.match(runtimeCss, /\.session-hotbar-slot\s*\{[\s\S]*flex:\s*0 0 70px/);
  assert.doesNotMatch(dock, /OFFICIAL_PLAY_INTENTS|intentOptions|intentId|모든 행동/);
});

test("contextual utilities use the accepted right-side pane relationship", () => {
  assert.match(root, /session-reference-utility-host/);
  assert.match(runtimeCss, /\.session-reference-utility-host\s*\{[\s\S]*width:\s*338px;[\s\S]*min-width:\s*288px;[\s\S]*max-width:\s*455px/);
  assert.match(runtimeCss, /@media \(max-width: 1000px\)[\s\S]*\.session-reference-utility-host \{ position: absolute;/);
});

test("accepted scene still respects mapless and blocked-authority boundaries", () => {
  assert.doesNotMatch(boards, /resolveAction|Main Hand|mainHand/);
  assert.doesNotMatch(dock, /smart fallback|mainHand|default hostile/);
  assert.doesNotMatch(dock, /distanceFeet|lineOfSight|pathfinding|coverFromMap|actorCoordinate/);
});
