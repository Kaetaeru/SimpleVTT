import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkV1MechanismCoverage,REQUIRED_FAMILIES } from "../../scripts/check-v1-mechanism-coverage.mjs";

const ledger=JSON.parse(readFileSync(new URL("../../docs/rules/v1-mechanism-coverage-ledger.json",import.meta.url),"utf8"));

test("V1 ledger contains every mandatory mechanism family exactly once",()=>{
  const result=checkV1MechanismCoverage(ledger);
  assert.equal(result.ok,true,result.errors.join("\n"));
  assert.equal(result.summary.total,REQUIRED_FAMILIES.length);
});

test("Gate N accepts the current final ledger and rejects incomplete evidence, unresolved seams, named fallbacks, and missing families",()=>{
  const complete=checkV1MechanismCoverage(ledger,{gateN:true});
  assert.equal(complete.ok,true,complete.errors.join("\n"));
  assert.equal(complete.summary.incomplete,0);

  const incomplete=structuredClone(ledger);
  incomplete.rows[0].disposition="INCOMPLETE";
  assert.ok(checkV1MechanismCoverage(incomplete,{gateN:true}).errors.some((error)=>error.includes("not Gate-N complete")));

  const missingEvidence=structuredClone(ledger);
  missingEvidence.rows[0].implementationEvidence=[];
  assert.ok(checkV1MechanismCoverage(missingEvidence,{gateN:true}).errors.some((error)=>error.includes("implementationEvidence")));

  const unresolvedSeam=structuredClone(ledger);
  unresolvedSeam.rows[0].remainingNamedSeams=["supported mechanic still has an unresolved production seam"];
  assert.ok(checkV1MechanismCoverage(unresolvedSeam,{gateN:true}).errors.some((error)=>error.includes("remainingNamedSeams")));

  const namedFallback=structuredClone(ledger);
  namedFallback.gateNBlockingNamedFallbacks=["unknown supported mechanic -> named adapter"];
  assert.ok(checkV1MechanismCoverage(namedFallback,{gateN:true}).errors.some((error)=>error.includes("gateNBlockingNamedFallbacks")));

  const missingFamily=structuredClone(ledger);
  missingFamily.rows.pop();
  assert.ok(checkV1MechanismCoverage(missingFamily,{gateN:true}).errors.some((error)=>error.includes("missing required family")));
});
