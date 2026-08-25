import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const board=readFileSync(new URL("../../src/SessionActorBoards.tsx",import.meta.url),"utf-8");
const main=readFileSync(new URL("../../src/main.tsx",import.meta.url),"utf-8");
const policy=readFileSync(new URL("../../docs/design/movement-modules.md",import.meta.url),"utf-8");

test("other Actor cards expose the mapless opportunity-attack trigger to the current-turn controller", () => {
  assert.match(board,/기회공격 유발/);
  assert.match(board,/controlsCurrentTurn/);
  assert.match(board,/isOpportunityAttackAction/);
  assert.match(board,/opportunityAttackCommand/);
  assert.doesNotMatch(main,/MovementReactionBridge/);
  assert.doesNotMatch(board,/moveActor\(/);
});

test("movement-triggered reaction UI is explicitly manual and mapless", () => {
  assert.match(board,/currentActor\.status\.includes\("이탈"\)/);
  assert.match(policy,/current-turn controller/i);
  assert.match(policy,/opportunity attack/i);
});
