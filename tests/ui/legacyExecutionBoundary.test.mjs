import assert from "node:assert/strict";
import test from "node:test";
import {
  baselineProposal,
  compareLegacyExecutionBoundary,
  isLegacyExecutionGuardAllowlisted,
  scanLegacyExecutionSource,
} from "../../scripts/check-legacy-execution-boundary.mjs";

test("generic Common Play style code does not create a named-execution finding",()=>{
  const source=`import { executeOperation } from "../domain/resolution";\nexport const run=(operation)=>executeOperation(operation);`;
  assert.deepEqual(scanLegacyExecutionSource(source,"src/app/commonPlayFixture.ts"),[]);
});

test("known content ids, domain id imports, action branches, and legacy fallback are detected",()=>{
  const source=`
import { FIGHTER_ID, FIGHTER_ACTION_SURGE_RESOURCE_ID } from "../domain/coreClassResources";
import { legacySpellResolveAction } from "./legacySpellRuntimeHandler";
const CLASS_ID="dnd.srd521.class.fighter";
if (actionId === "action.fighter.action-surge") legacySpellResolveAction();
`;
  const findings=scanLegacyExecutionSource(source,"src/app/fixture.ts");
  assert.deepEqual(new Set(findings.map((entry)=>entry.rule)),new Set([
    "known-content-id-literal",
    "known-domain-id-import",
    "legacy-spell-handler-import",
    "action-id-execution-branch",
  ]));
});

test("exact presentation, fixture, and generic-mapping paths are allowlisted without weakening other app files",()=>{
  assert.equal(isLegacyExecutionGuardAllowlisted("src/app/rulePresentation.ts"),true);
  assert.equal(isLegacyExecutionGuardAllowlisted("src/app/mockAdapter.ts"),true);
  assert.equal(isLegacyExecutionGuardAllowlisted("src/app/productionAcceptanceRuntimeAdapter.ts"),true);
  assert.equal(isLegacyExecutionGuardAllowlisted("src/app/realRuntimeAttackFactProvider.ts"),true);
  assert.equal(isLegacyExecutionGuardAllowlisted("src/app/newNamedRuntimeAdapter.ts"),false);
});

test("baseline debt may shrink without failing",()=>{
  const findings=[{file:"src/app/legacy.ts",rule:"known-domain-id-import",line:1,match:"FEATURE_ID"}];
  const result=compareLegacyExecutionBoundary(findings,{entries:[{file:"src/app/legacy.ts",rule:"known-domain-id-import",maxCount:2}]});
  assert.equal(result.ok,true);
});

test("new or increased named-execution debt fails",()=>{
  const findings=[
    {file:"src/app/legacy.ts",rule:"known-domain-id-import",line:1,match:"FEATURE_ID"},
    {file:"src/app/legacy.ts",rule:"known-domain-id-import",line:2,match:"OTHER_FEATURE_ID"},
  ];
  const result=compareLegacyExecutionBoundary(findings,{entries:[{file:"src/app/legacy.ts",rule:"known-domain-id-import",maxCount:1}]});
  assert.equal(result.ok,false);
  assert.match(result.errors[0],/baseline max 1, current 2/);
});

test("baseline proposal freezes current counts but not match details",()=>{
  const proposal=baselineProposal([{file:"src/app/legacy.ts",rule:"known-domain-id-import",count:2,matches:[{line:1,match:"A_ID"}]}]);
  assert.deepEqual(proposal.entries,[{file:"src/app/legacy.ts",rule:"known-domain-id-import",maxCount:2}]);
});
