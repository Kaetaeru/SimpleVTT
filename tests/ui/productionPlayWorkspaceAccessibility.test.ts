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
