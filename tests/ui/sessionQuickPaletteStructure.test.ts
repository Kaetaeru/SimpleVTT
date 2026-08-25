import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const quick=readFileSync(new URL("../../src/SessionQuickPalette.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/session-quick-palette.css",import.meta.url),"utf8");

test("accepted Core Systems quick entry opens in the right utility pane with Ctrl+K and Escape focus recovery",()=>{
  assert.match(root,/SessionQuickPalette/);
  assert.match(root,/event\.ctrlKey\|\|event\.metaKey/);
  assert.match(root,/toLocaleLowerCase\(\)===\"k\"/);
  assert.match(root,/if \(quickOpen\)[\s\S]*closeQuick\(\)/);
  assert.match(root,/quickLauncher\.current\?\.focus\(\)/);
  assert.match(root,/aria-controls="session-quick-panel"/);
  assert.match(root,/activeUtility\|\|quickOpen/);
  assert.match(root,/quickOpen\?<SessionQuickPalette/);
  assert.match(quick,/role="complementary"/);
  assert.match(css,/\.session-quick-panel\{width:100%;height:100%/);
  assert.doesNotMatch(css,/backdrop-filter|session-quick-layer/);
});

test("quick palette routes to existing Session utilities including the authoritative DM library",()=>{
  for(const destination of ["library","actor","encounter","participants","handout","activity","rules","session"]) assert.match(quick,new RegExp(`destination:\"${destination}\"`));
  assert.match(quick,/세션 도구 찾기/);
  assert.match(quick,/role="complementary"/);
  assert.doesNotMatch(quick,/instantiateCombatant|resolveAction|revealSessionImageHandout|localStorage/);
});

test("Session chrome and Command Center remain mounted beside the quick pane",()=>{
  const chrome=root.indexOf('className="session-reference-play-chrome"');
  const command=root.indexOf('aria-label="Command Center"');
  const panel=root.indexOf('quickOpen?<SessionQuickPalette');
  assert.ok(chrome>=0&&panel>chrome&&command>panel);
  assert.match(root,/suspended=\{Boolean\(workspaceLayer \|\| snapshot\.resolution&&!passiveRemoteResolution\)\}/);
  assert.doesNotMatch(root,/suspended=\{Boolean\([^}]*playerHandoutOpen/);
  assert.doesNotMatch(root,/suspended=\{Boolean\([^}]*activeUtility/);
  assert.doesNotMatch(root,/suspended=\{Boolean\([^}]*quickOpen/);
  assert.match(root,/lastLauncher\.current=quickLauncher\.current/);
});
