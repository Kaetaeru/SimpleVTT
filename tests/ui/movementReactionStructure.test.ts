import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const board=readFileSync(new URL("../../src/SessionActorBoards.tsx",import.meta.url),"utf-8");
const root=readFileSync(new URL("../../src/SessionModeRoot.tsx",import.meta.url),"utf-8");
const dock=readFileSync(new URL("../../src/SessionActionDock.tsx",import.meta.url),"utf-8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const adapter=readFileSync(new URL("../../src/app/movementDeclarationRuntimeAdapter.ts",import.meta.url),"utf-8");
const policy=readFileSync(new URL("../../docs/design/theater-of-mind-play.md",import.meta.url),"utf-8");

test("T1-05: opportunity attacks are prompted by 물러남, not by a per-card button", () => {
  assert.doesNotMatch(board,/기회공격 유발/);
  assert.doesNotMatch(board,/opportunityAttackCommand/);
  assert.match(root,/SessionWithdrawPrompt/);
  assert.match(dock,/물러남/);
  assert.match(dock,/접근/);
  assert.match(dock,/그대로/);
  assert.match(adapter,/answerWithdrawalPrompt/);
  assert.match(adapter,/opportunityAttackCommand/);
  assert.doesNotMatch(main,/MovementReactionBridge/);
  assert.doesNotMatch(board,/moveActor\(/);
});

test("T1-05: the design binds the prompt to 물러남 and Disengage suppresses it", () => {
  assert.match(adapter,/hasDisengaged/);
  assert.match(policy,/물러남/);
  assert.match(policy,/opportunity attacks/i);
});
