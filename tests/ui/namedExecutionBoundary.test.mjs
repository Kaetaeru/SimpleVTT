import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import {
  checkNamedExecutionBoundary,
  scanNamedExecutionSource,
} from "../../scripts/check-named-execution-boundary.mjs";

test("named execution scanner detects class-specific runtime identity",()=>{
  const rules=scanNamedExecutionSource(`
    import { FIGHTER_ID } from "../domain/fighterActionSurge";
    const actionId = "action.fighter.action-surge";
  `,"src/app/fighterExampleRuntimeAdapter.ts");
  assert.ok(rules.includes("named-runtime-filename"));
  assert.ok(rules.includes("known-content-domain-import"));
  assert.ok(rules.includes("known-content-action-id"));
});

test("named execution scanner ignores generic mechanic infrastructure",()=>{
  const rules=scanNamedExecutionSource(`
    import { executeOperation } from "../domain/resolution";
    const actionId = "action.standard.ready.trigger";
  `,"src/app/commonPlayRuntimeAdapter.ts");
  assert.deepEqual(rules,[]);
});

test("current app tree has no unclassified named-execution candidate",()=>{
  const result=checkNamedExecutionBoundary(resolve(process.cwd()));
  assert.equal(result.ok,true,result.errors.join("\n"));
});
