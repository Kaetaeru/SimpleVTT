import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production composition mounts PlaySessionDock and bounds it to the viewport with internal scrolling",()=>{
  const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/play-session-dock.css",import.meta.url),"utf8");

  assert.match(main,/import \{ PlaySessionDock \} from "\.\/PlaySessionDock"/);
  assert.match(main,/import "\.\/play-session-dock\.css"/);
  assert.match(main,/<PlaySessionDock \/>/);

  assert.match(css,/\.play-dock\s*\{[^}]*position:\s*fixed/s);
  assert.match(css,/\.play-dock\s*\{[^}]*max-height:\s*calc\(100vh\s*-/s);
  assert.match(css,/\.play-dock\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css,/\.play-dock-body\s*\{[^}]*min-height:\s*0/s);
  assert.match(css,/\.play-dock-body\s*\{[^}]*overflow(?:-y)?:\s*auto/s);
});

test("play workspace entry never exposes reference Characters as production choices",()=>{
  const dock=readFileSync(new URL("../../src/PlaySessionDock.tsx",import.meta.url),"utf8");
  assert.match(dock,/productionJoinCharacters/);
  assert.match(dock,/productionCharacters\.map/);
  assert.match(dock,/activeProductionCharacter/);
  assert.match(dock,/disabled=\{!activeProductionCharacter\}/);
  assert.doesNotMatch(dock,/snapshot\.characters\.map/);
});

test("play workspace exposes keyboard focus plus selected and disabled visual states",()=>{
  const dock=readFileSync(new URL("../../src/PlaySessionDock.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../../src/play-session-dock.css",import.meta.url),"utf8");
  const completion=readFileSync(new URL("../../src/completion.css",import.meta.url),"utf8");

  assert.match(dock,/aria-label="플레이 도구 닫기"/);
  assert.match(dock,/aria-label="플레이 카테고리"/);
  assert.match(dock,/onFocus=\{\(\)=>setHovered\(action\.id\)\}/);
  assert.match(dock,/disabled=\{!action\.available\}/);
  assert.match(dock,/className=\{pendingId===action\.id\?"selected":""\}/);

  assert.match(css,/\.play-dock[^\n]*:focus-visible|\.play-dock button:focus-visible/);
  assert.match(css,/\.play-dock-tabs button\.active/);
  assert.match(css,/\.play-action-grid button\.selected/);
  assert.match(css,/\.play-dock button:disabled/);
  assert.match(completion,/@media \(prefers-reduced-motion: reduce\)/);
});

test("production role surfaces stay scoped and expose routine recovery guidance without Debug Dock",()=>{
  const dock=readFileSync(new URL("../../src/PlaySessionDock.tsx",import.meta.url),"utf8");
  const lobby=readFileSync(new URL("../../src/ProductionPlayerLobbyBridge.tsx",import.meta.url),"utf8");
  const host=readFileSync(new URL("../../src/ProductionSessionLifecycleBridge.tsx",import.meta.url),"utf8");
  const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
  const lobbyCss=readFileSync(new URL("../../src/production-player-lobby.css",import.meta.url),"utf8");

  assert.match(dock,/snapshot\.role\s*!==\s*"player"/);
  assert.match(dock,/snapshot\.session\.role\s*===\s*"host"/);
  assert.match(lobby,/snapshot\.role\s*!==\s*"player"/);
  assert.match(lobby,/snapshot\.session\.role\s*===\s*"host"/);
  assert.match(host,/snapshot\.session\.role\s*!==\s*"host"/);

  assert.match(lobby,/snapshot\.connectionState\s*===\s*"reconnecting"/);
  assert.match(lobby,/재연결 중/);
  assert.match(lobby,/snapshot\.connectionState\s*===\s*"disconnected"/);
  assert.match(lobby,/연결이 끊겼습니다/);

  assert.match(host,/hostStartFailed/);
  assert.match(host,/Host 시작에 실패했습니다/);
  assert.match(host,/세션 열기/);
  assert.match(app,/SimpleVTT 불러오는 중…/);
  assert.match(lobbyCss,/\.session-grid > article:nth-child\(2\)/);

  for (const source of [dock,lobby,host]) assert.doesNotMatch(source,/Ctrl\+Shift\+D/);
});
