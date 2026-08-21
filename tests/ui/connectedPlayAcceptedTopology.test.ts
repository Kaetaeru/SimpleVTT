import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync("src/SessionModeRoot.tsx", "utf8");
const boards = readFileSync("src/SessionActorBoards.tsx", "utf8");
const boardCss = readFileSync("src/session-actor-boards.css", "utf8");
const layoutCss = readFileSync("src/session-connected-layout.css", "utf8");
const dock = readFileSync("src/SessionActionDock.tsx", "utf8");
const dockCss = readFileSync("src/session-action-dock.css", "utf8");

test("Connected Play mounts accepted upper board Stage lower board Command Center order", () => {
  const upper = root.indexOf('<SessionActorBoard position="upper" role={role} />');
  const stage = root.indexOf('<section className="session-play-context"');
  const lower = root.indexOf('<SessionActorBoard position="lower" role={role} />');
  const command = root.indexOf('aria-label="Command Center"');
  assert.ok(upper >= 0 && stage > upper && lower > stage && command > lower);
  assert.match(root, /<SessionInitiativeStrip role=\{role\} \/>[\s\S]*<div className="session-mode-body">/);
});

test("Actor Boards project canonical Scene entities and never create tactical coordinates", () => {
  assert.match(boards, /snapshot\.scene\.entities\.filter\(\(entity\) => entity\.side === wantedSide\)/);
  assert.match(boards, /position === "upper" \? "enemy" : "ally"/);
  assert.match(boards, /snapshot\.scene\.currentActorId/);
  assert.match(boards, /snapshot\.scene\.selectedActorId/);
  assert.match(boards, /await selectDmActor\(entity\.id\)/);
  assert.doesNotMatch(boards, /\bx\s*:|\by\s*:|grid|pathfind|lineOfSight|fog|tokenPosition|distanceFeet/);
});

test("Actor Boards preserve useful card width and horizontal overflow including empty states", () => {
  assert.match(boardCss, /\.session-actor-board-scroll\s*\{[\s\S]*display: flex;[\s\S]*overflow-x: auto/);
  assert.match(boardCss, /\.session-actor-card\s*\{[\s\S]*min-width: 168px/);
  assert.match(boards, /session-actor-board-empty/);
  assert.match(boards, /빈 Actor Board도 정상적인 세션 상태입니다/);
});

test("Tabletop Stage remains broad mapless context and Initiative extends the same skeleton", () => {
  assert.match(layoutCss, /\.session-play-workspace\s*\{[\s\S]*grid-template-rows: minmax\(82px, auto\) minmax\(0, 1fr\) minmax\(82px, auto\)/);
  assert.match(layoutCss, /\.session-play-context\s*\{[\s\S]*min-height: 0;[\s\S]*overflow: hidden/);
  assert.match(layoutCss, /\.session-mode-root\[data-session-mode="initiative"\] \.session-play-context[\s\S]*grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(root, /battlemap|grid|Fog of War|LoS|map token/);
});

test("Persistent Command Center directly discovers canonical capabilities", () => {
  assert.match(dock, /snapshot\.scene\.actionsByActor\[actorId\]/);
  assert.match(dock, /HOTBAR_PAGES/);
  assert.match(dock, /"mixed" \| "action" \| "spell" \| "item"/);
  assert.match(dock, /action\.disabledReason/);
  assert.match(dock, /snapshot\.activeCharacter\.resources/);
  assert.match(dock, /snapshot\.scene\.economyByActor\[actorId\]/);
  assert.doesNotMatch(dock, /OFFICIAL_PLAY_INTENTS|intentOptions|intentId|모든 행동/);
  assert.match(dockCss, /\.session-command-center\s*\{/);
  assert.match(dockCss, /\.session-hotbar-slots\s*\{[\s\S]*overflow-x: auto/);
});

test("WO-UI-003 does not implement blocked Main Hand or spatial authority in presentation", () => {
  assert.doesNotMatch(boards, /resolveAction|Main Hand|mainHand/);
  assert.doesNotMatch(dock, /smart fallback|mainHand|default hostile/);
  assert.doesNotMatch(dock, /distanceFeet|lineOfSight|pathfinding|coverFromMap|actorCoordinate/);
});
