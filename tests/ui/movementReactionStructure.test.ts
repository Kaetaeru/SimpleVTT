import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge=readFileSync(new URL("../../src/MovementReactionBridge.tsx",import.meta.url),"utf-8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const policy=readFileSync(new URL("../../docs/design/movement-modules.md",import.meta.url),"utf-8");

test("scene UI exposes a current-turn manual movement reaction input without adding movement controls", () => {
  assert.match(bridge,/이동 반응 입력/);
  assert.match(bridge,/현재 턴 조종자 입력/);
  assert.match(bridge,/distanceFeet/);
  assert.match(bridge,/visibleAtTrigger/);
  assert.match(bridge,/coverAtTrigger/);
  assert.match(bridge,/targetCanSeeReactorAtTrigger/);
  assert.match(main,/MovementReactionBridge/);
  assert.doesNotMatch(bridge,/moveActor\(/);
});

test("movement-triggered reaction UI is explicitly manual and mapless", () => {
  assert.match(bridge,/Core는 이동이나 기회공격 트리거를 자동 감지하지 않습니다/);
  assert.match(policy,/current-turn controller/i);
  assert.match(policy,/opportunity attack/i);
});
