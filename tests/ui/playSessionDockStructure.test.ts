import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root=process.cwd();
const source=(path:string)=>readFileSync(join(root,path),"utf8");

test("legacy PlaySessionDock stays available for reference but is no longer mounted in production composition",()=>{
  const main=source("src/main.tsx");
  const dock=source("src/PlaySessionDock.tsx");
  assert.match(dock,/export function PlaySessionDock/);
  assert.match(main,/PlaySessionDock/);
  assert.doesNotMatch(main,/<PlaySessionDock \/>/);
});

test("production Scene route is owned by one V0.9 scene-first hotbar surface",()=>{
  const app=source("src/App.tsx");
  const play=source("src/ProductionPlayScreen.tsx");
  assert.match(app,/route === "scene" && <ProductionPlayScreen role=\{productionRole\} \/>/);
  assert.match(play,/BASIC_INTENTS\.map\(renderIntentButton\)/);
  assert.match(play,/SITUATIONAL_INTENTS\.map\(renderIntentButton\)/);
  assert.match(play,/play-v09-hotbar/);
  assert.doesNotMatch(play,/ActionSurface|play-dock-tabs|pendingActionId|play-intent-grid/);
});

test("new production play surface establishes local state hooks before hydration guard",()=>{
  const play=source("src/ProductionPlayScreen.tsx");
  const start=play.indexOf("export function ProductionPlayScreen");
  const guard=play.indexOf("if (!snapshot) return null",start);
  assert.ok(start>=0&&guard>start);
  const before=play.slice(start,guard);
  const after=play.slice(guard);
  assert.equal((before.match(/\buseState(?:<[^>]+>)?\s*\(/g)??[]).length,4);
  assert.doesNotMatch(after,/\buse(?:State|Memo|Effect|LayoutEffect|Reducer|Ref|Callback|Context|ImperativeHandle|Transition|DeferredValue|Id|SyncExternalStore)\s*(?:<[^>]+>)?\s*\(/);
});
