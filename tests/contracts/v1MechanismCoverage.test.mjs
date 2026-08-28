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

test("Gate N rejects incomplete rows, missing evidence, remaining named seams, and missing families",()=>{
  const incomplete=checkV1MechanismCoverage(ledger,{gateN:true});
  assert.equal(incomplete.ok,false);
  assert.ok(incomplete.errors.some((error)=>error.includes("not Gate-N complete")));

  const candidate=structuredClone(ledger);
  for(const row of candidate.rows){
    row.disposition="IMPLEMENTED";
    row.implementationEvidence=["test:implementation"];
    row.productionEvidence=["test:production"];
    row.identityInvarianceEvidence=["test:rename"];
    row.connectedEvidenceIfRelevant=row.connectedRelevant?["test:connected"]:[];
    row.persistenceEvidenceIfRelevant=row.persistenceRelevant?["test:persistence"]:[];
    row.remainingNamedSeams=[];
  }
  assert.equal(checkV1MechanismCoverage(candidate,{gateN:true}).ok,true);
  candidate.rows.pop();
  assert.ok(checkV1MechanismCoverage(candidate,{gateN:true}).errors.some((error)=>error.includes("missing required family")));
});
