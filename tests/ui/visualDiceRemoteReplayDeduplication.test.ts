import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bridge=readFileSync(new URL("../../src/VisualDiceBridge.tsx",import.meta.url),"utf8");
const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf8");
const dock=readFileSync(new URL("../../src/SessionActionDock.tsx",import.meta.url),"utf8");
const notice=readFileSync(new URL("../../src/app/remoteResolutionNotice.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../../src/session-mode.css",import.meta.url),"utf8");

test("an unchanged remote presentation snapshot cannot restart the same physical dice replay",()=>{
  assert.match(bridge,/lastStartedReplayKeyRef = useRef<string\|null>\(null\)/);
  assert.match(bridge,/resolutionPresentation\?\.resolutionId===resolution\.id/);
  assert.match(bridge,/resolutionPresentation\.presentationSequence/);
  assert.match(bridge,/if\(lastStartedReplayKeyRef\.current===key\)return/);
  const guard=bridge.indexOf("if(lastStartedReplayKeyRef.current===key)return");
  const start=bridge.indexOf("setReplay({ key, roll })");
  assert.ok(guard>=0&&start>guard,"deduplication must run before a new physics replay mounts");
});

test("all non-interactive remote results are non-blocking auto-dismiss notices",()=>{
  assert.match(notice,/snapshot\.session\.role==="client"/);
  assert.match(notice,/presentation\?\.resolutionId===resolution\.id/);
  assert.doesNotMatch(notice,/delivery/);
  assert.match(root,/snapshot\.resolution&&!passiveRemoteResolution/);
  assert.match(root,/!resolution\.canAdvance \|\| passiveRemote/);
  assert.match(root,/session-resolution-notice/);
  assert.match(css,/\.session-resolution-notice\s*\{[^}]*pointer-events:\s*none/);
  assert.match(dock,/connectionState==="connected"&&!suspended/);
  assert.match(bridge,/const \{ snapshot,dismissResolution \} = useSimpleVtt\(\)/);
  assert.match(bridge,/isNonBlockingRemoteResolution\(snapshot\)/);
  assert.match(bridge,/shouldDismissRemoteRef/);
  assert.doesNotMatch(bridge,/shouldAdvanceRemoteRef/);
});
