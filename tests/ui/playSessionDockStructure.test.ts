import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("PlaySessionDock keeps hook order stable across null-to-hydrated snapshot transition", () => {
  const dock = source("src/PlaySessionDock.tsx");
  const componentStart = dock.indexOf("export function PlaySessionDock()");
  const guard = dock.indexOf("if (!snapshot", componentStart);
  const componentEnd = dock.indexOf("function ActionSurface", guard);

  assert.ok(componentStart >= 0, "PlaySessionDock component must exist");
  assert.ok(guard > componentStart, "snapshot/role guard must exist inside PlaySessionDock");
  assert.ok(componentEnd > guard, "PlaySessionDock component boundary must be discoverable");

  const beforeGuard = dock.slice(componentStart, guard);
  const afterGuard = dock.slice(guard, componentEnd);
  const stateHooks = beforeGuard.match(/\buseState(?:<[^>]+>)?\s*\(/g) ?? [];

  assert.equal(stateHooks.length, 3, "PlaySessionDock should establish all local state hooks before the hydration/role guard");
  assert.doesNotMatch(
    afterGuard,
    /\buse(?:State|Memo|Effect|LayoutEffect|Reducer|Ref|Callback|Context|ImperativeHandle|Transition|DeferredValue|Id|SyncExternalStore)\s*(?:<[^>]+>)?\s*\(/,
    "no React hook may be conditionally reached only after snapshot hydration or role gating",
  );
});

test("PlaySessionDock tab switching preserves pending action and target context", () => {
  const dock = source("src/PlaySessionDock.tsx");
  const componentStart = dock.indexOf("export function PlaySessionDock()");
  const componentEnd = dock.indexOf("function ActionSurface", componentStart);
  const component = dock.slice(componentStart, componentEnd);

  assert.match(component, /onClick=\{\(\)=>setTab\(id\)\}/);
  assert.doesNotMatch(component, /setTab\(id\);\s*setPendingActionId\(null\)/);
  assert.match(component, /pending&&<div className="play-target-picker"/);
  assert.match(component, /pendingId=\{pendingActionId\}/);
});
