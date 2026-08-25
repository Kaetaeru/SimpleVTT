import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = readFileSync(new URL("../../src/SessionModeRoot.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../../src/SessionMainFocus.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../src/session-main-focus.css", import.meta.url), "utf8");
const referenceCss = readFileSync(new URL("../../src/session-integrated-reference-play.css", import.meta.url), "utf8");

test("Session root delegates the dominant mapless center to the accepted Main Focus projection", () => {
  assert.match(root, /<SessionMainFocus role=\{role\}/);
  assert.match(root, /session-reference-mapless-stage/);
  assert.match(root, /onDismissLastRoll=\{lastRollResolutionId\?\(\)=>dismissSessionLastRoll\(mockAdapter,lastRollResolutionId\):undefined\}/);
  assert.doesNotMatch(root, /SCENE ACTORS|HOTBAR_TABS|공통.*클래스.*주문.*아이템/s);
});

test("Freeform resting stage shows the last rolling Actor illustration", () => {
  assert.match(focus, /snapshot\.sessionMode === "initiative"/);
  assert.match(root, /snapshot\.resolution\?\.actorId/);
  assert.match(root, /lastRollActorId=\{lastRollActorId\}/);
  assert.match(focus, /session-last-roll-actor/);
  assert.match(focus, /LAST ROLL/);
  assert.match(focus, /role==="dm"&&Boolean\(actor\)/);
  assert.match(focus, /다음 굴림까지 모든 화면에서 숨기기/);
  assert.match(focus, /data-last-roll-hidden="true"/);
  assert.match(root, /dismissedResolutionId===lastRollResolutionId/);
  assert.match(focus, /첫 굴림을 기다리는 중/);
  assert.doesNotMatch(focus, /economyByActor|actionsByActor/);
});

test("Initiative centers the current Actor illustration while economy detail stays elsewhere", () => {
  assert.match(focus, /snapshot\.scene\.currentActorId/);
  assert.match(focus, /session-current-turn-actor/);
  assert.match(focus, /CURRENT TURN · ROUND/);
  assert.doesNotMatch(focus, /current\.hp|current\.maxHp|economyByActor|actionsByActor/);
});

test("Stage focus geometry centers a product-themed illustration", () => {
  assert.match(referenceCss, /\.session-reference-stage-focus[\s\S]*place-items:\s*center/);
  assert.match(referenceCss, /\.session-last-roll-actor[\s\S]*place-items:\s*center/);
  assert.match(referenceCss, /\.session-last-roll-art[\s\S]*border-radius:\s*24px/);
  assert.match(referenceCss, /var\(--shadow\)/);
});
