import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sessionRoot = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../src/CharacterSheetPlayScreen.tsx", import.meta.url), "utf8");
const legacy = readFileSync(new URL("../../src/LegacyCharacterSheetPlayScreen.tsx", import.meta.url), "utf8");
const official = readFileSync(new URL("../../src/OfficialCharacterSheetPlayScreen.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-full-sheet.css", import.meta.url), "utf8");

test("Session Full Sheet is a mounted workspace layer over the persistent Session root", () => {
  assert.match(sessionRoot, /type WorkspaceLayer = "full-sheet" \| null/);
  assert.match(sessionRoot, /<CharacterSheetWorkspace hostMode="session" onClose=\{closeFullSheet\}/);
  assert.match(sessionRoot, /hidden=\{workspaceLayer !== "full-sheet"\}/);
  assert.match(sessionRoot, /session-full-sheet-layer/);
  assert.match(sessionRoot, /setWorkspaceReturnUtility\(activeUtility\)/);
  assert.match(sessionRoot, /setActiveUtility\(workspaceReturnUtility\)/);
  assert.doesNotMatch(sessionRoot, /route\s*=|setRoute|플레이로 돌아가기/);
});

test("accepted Sheet chrome opens contextual Sheet and Quick Sheet expands to Full Sheet in one action", () => {
  assert.match(sessionRoot, />Sheet<\/button>/);
  assert.match(sessionRoot, /toggleUtility\(role === "player" \? "quick-sheet" : "actor"/);
  assert.match(sessionRoot, /QuickSheet onClose=\{closeUtility\} onOpenFull=\{openFullSheet\}/);
  assert.match(sessionRoot, />전체 시트<\/button>/);
});

test("Standalone and Session hosts share one persisted Sheet workspace and canonical Character", () => {
  assert.match(workspace, /export function CharacterSheetWorkspace/);
  assert.match(workspace, /hostMode: CharacterSheetHostMode/);
  assert.match(workspace, /readSheetLayoutPreference/);
  assert.match(workspace, /persistSheetLayoutPreference/);
  assert.match(workspace, /snapshot\.activeCharacter/);
  assert.match(workspace, /<SimpleVttCharacterSheetPlayScreen hostMode=\{hostMode\}/);
  assert.match(workspace, /<OfficialCharacterSheetPlayScreen hostMode=\{hostMode\}/);
  assert.match(workspace, /<CharacterSheetWorkspace hostMode="standalone"/);
  assert.doesNotMatch(workspace, /useState<[^>]*Character|new Map<[^>]*Character/i);
});

test("Session Sheet never presents local random rolls or an embedded dice tray as shared authority", () => {
  assert.match(legacy, /if\(hostMode==="session"\)\{ sessionReference\(label\); return; \}/);
  assert.match(official, /if \(hostMode === "session"\) \{ sessionReference\(label\); return; \}/);
  assert.match(legacy, /hostMode==="standalone"&&roll&&<section className="sheet-roll-result"/);
  assert.match(official, /hostMode === "standalone" && roll && <section className="sheet-roll-result"/);
  assert.match(legacy, /VisualDiceTray/);
  assert.match(official, /VisualDiceTray/);
  assert.match(legacy, /공유 판정은 Session Action 경로/);
  assert.match(official, /공유 판정은 Session Action 경로/);
});

test("Full Sheet uses overlay geometry without replacing the accepted Play scene", () => {
  assert.match(css, /\.session-full-sheet-layer \{/);
  assert.match(css, /position: absolute/);
  assert.match(css, /width: min\(94vw, 1560px\)/);
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(css, /\.session-full-sheet-layer\[hidden\]/);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*width: 100%[\s\S]*height: 100%/);
});
