import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const provider = readFileSync(new URL("../../src/app/AppProvider.tsx", import.meta.url), "utf8");
const root = readFileSync(new URL("../../src/ProductRoot.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../../src/SessionDebugPreview.tsx", import.meta.url), "utf8");

test("browser session preview is development-only and refreshable by URL", () => {
  assert.match(root, /if \(!import\.meta\.env\.DEV\) return null/);
  assert.match(root, /params\.get\("session-preview"\)/);
  assert.match(root, /url\.searchParams\.set\("session-preview", state\.role\)/);
  assert.match(root, /if \(debugPreview\) void debug\.setMode\(debugPreview\.mode\)/);
  assert.match(root, /onOpenSessionPreview=\{import\.meta\.env\.DEV/);
  assert.match(app, />DM 화면 미리보기</);
  assert.match(app, />Player 화면 미리보기</);
});

test("preview projects a live-looking snapshot without opening a transport", () => {
  assert.match(provider, /export function SessionDebugPreviewProvider/);
  assert.match(provider, /role: role === "dm" \? "host" : "client"/);
  assert.match(provider, /lifecycle: "live"/);
  assert.match(provider, /address: "debug:\/\/browser-preview"/);
  assert.match(provider, /실제 네트워크 연결과 권위 상태를 변경하지 않습니다/);
  assert.match(provider, /hostSession: async \(\) => undefined/);
  assert.match(provider, /joinSession: async \(\) => undefined/);
  assert.match(provider, /await parent\.debug\.setCurrentActor\(command\.provokerId\)/);
  assert.match(provider, /await parent\.declareManualMovementReaction\(command\)/);
  assert.doesNotMatch(preview, /tauriSessionTransport|hostSession\(|joinSession\(/);
});

test("preview exposes DM Player Freeform and Initiative controls over the real Session root", () => {
  assert.match(preview, /<SessionModeRoot onOpenProduct=\{onExit\}/);
  assert.match(preview, />DM<\/button>/);
  assert.match(preview, />Player<\/button>/);
  assert.match(preview, />자유 진행<\/button>/);
  assert.match(preview, />이니셔티브<\/button>/);
  assert.match(preview, /className="session-debug-dice-button"/);
  assert.match(preview, /"◆ d20 테스트"/);
  assert.match(preview, /candidate\.resolutionKind === "ability-check" && candidate\.target === "none" && candidate\.available/);
  assert.match(preview, /await resolveAction\(action\.id, \[\]\)/);
  assert.match(preview, /await debug\.setCurrentActor\(snapshot\.activeCharacter\.id\)/);
  assert.match(preview, />미리보기 종료<\/button>/);
});
