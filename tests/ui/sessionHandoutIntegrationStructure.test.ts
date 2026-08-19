import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const handout = readFileSync(new URL("../../src/SessionImageHandoutBridge.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../src/app/sessionImageHandoutRuntimeAdapter.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../../src/main.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-image-handout.css", import.meta.url), "utf8");

test("DM Handout is an on-demand Session utility instead of a body-level launcher", () => {
  assert.match(root, /"handout"/);
  assert.match(root, /toggleUtility\("handout", event\.currentTarget\)/);
  assert.match(root, /<SessionDmHandoutPane onClose=\{closeUtility\} \/>/);
  assert.match(handout, /이미지 보여주기/);
  assert.match(handout, /플레이어에게 공개/);
  assert.match(handout, /공유 철회/);
  assert.doesNotMatch(handout, /createPortal|handout-host-launcher|document\.body/);
  assert.doesNotMatch(main, /<SessionImageHandoutBridge \/>/);
});

test("Session Handout presentation reuses the existing handout runtime and does not own transport or mechanics", () => {
  for (const pattern of [
    /revealSessionImageHandout\(mockAdapter, draft\)/,
    /withdrawSessionImageHandout\(mockAdapter\)/,
    /dismissSessionImageHandout\(mockAdapter\)/,
    /reopenSessionImageHandout\(mockAdapter\)/,
    /subscribeSessionImageHandout\(mockAdapter, setHandout\)/,
  ]) assert.match(handout, pattern);
  assert.match(runtime, /presentation-handout/);
  assert.match(runtime, /sendToWithHandoutRestore/);
  assert.doesNotMatch(handout, /tauriSessionTransport|ResolutionEvent|undoLastResolution|localStorage|sessionStorage/);
  const handoutImport = main.indexOf("sessionImageHandoutRuntimeAdapter");
  const parityImport = main.indexOf("sessionContentParityRuntimeAdapter");
  assert.ok(handoutImport >= 0 && parityImport > handoutImport, "handout transport decorator must remain installed before content parity");
});

test("Player active handout is a transient Session layer with dismiss and contextual reopen", () => {
  assert.match(root, /<SessionPlayerHandoutRailButton \/>/);
  assert.match(root, /<SessionPlayerHandoutViewer \/>/);
  assert.match(root, /<SessionPlayerHandoutError \/>/);
  assert.match(handout, /aria-label=\{handout\.dismissed \? "이미지 다시 열기" : "DM 공유 이미지 열림"\}/);
  assert.match(handout, /role="dialog" aria-modal="true" aria-label="DM 공유 이미지"/);
  assert.match(root, /playerHandoutOpen/);
  assert.match(root, /snapshot\.resolution \|\| playerHandoutOpen/);
  assert.match(root, /dismissCurrentSessionImageHandout\(\)/);
});

test("Handout file validation and reconnect-restored state remain the existing bounded presentation path", () => {
  assert.match(handout, /accept=\{LOCAL_IMAGE_ACCEPT\}/);
  assert.match(handout, /readLocalImageFile\(file, HANDOUT_IMAGE_MAX_BYTES\)/);
  assert.match(runtime, /HANDOUT_IMAGE_MAX_BYTES/);
  assert.match(runtime, /compatibleHelloAck/);
  assert.match(runtime, /applyRemoteSessionImageHandout/);
  assert.doesNotMatch(`${runtime}\n${handout}`, /tactical grid|fog of war|public URL|cloud hosting/i);
});

test("Handout control and viewer use the Session drawer and layer geometry", () => {
  assert.match(css, /\.session-handout-pane\s*\{[\s\S]*position: absolute;[\s\S]*right: 0;[\s\S]*height: 100%/);
  assert.match(css, /\.session-handout-viewer\s*\{[\s\S]*position: absolute;[\s\S]*z-index: 96/);
  assert.match(css, /@media \(max-width: 899px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(css, /handout-host-launcher|handout-client-overlay|handout-reopen/);
});
