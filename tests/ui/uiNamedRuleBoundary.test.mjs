import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import {
  checkUiRuleBoundary,
  scanUiSource,
} from "../../scripts/check-ui-rule-boundary.mjs";

test("UI rule scanner blocks direct domain value imports and representative named-rule arithmetic", () => {
  const findings=scanUiSource(`
    import { multiclassEligibility } from "../domain/progressionCatalog";
    const modifier = Math.floor((score - 10) / 2);
    const fixed = Math.floor(plan.hp.hitDie / 2) + 1;
    const eligible = multiclassEligibility(scores, tracks, classId);
  `,"fixture.tsx");
  const rules=new Set(findings.map((finding)=>finding.rule));
  assert.ok(rules.has("direct-domain-value-import"));
  assert.ok(rules.has("ability-modifier-arithmetic"));
  assert.ok(rules.has("levelup-fixed-hp-arithmetic"));
  assert.ok(rules.has("multiclass-eligibility-in-ui"));
});

test("UI rule scanner allows type-only domain imports and presentation-only layout/string/count logic", () => {
  const findings=scanUiSource(`
    import type { CircleLandType } from "../domain/druidCircleLandRecovery";
    import { useMemo } from "react";
    const visible = items.filter((item) => item.visible);
    const label = value >= 0 ? \`+\${value}\` : String(value);
    const width = Math.max(0, Math.min(100, percent));
    return <span>{visible.length} · {label} · {width}%</span>;
  `,"fixture.tsx");
  assert.deepEqual(findings,[]);
});

test("current production TSX tree matches the explicit named-rule baseline", () => {
  const result=checkUiRuleBoundary(resolve(process.cwd()));
  assert.equal(result.ok,true,result.errors.join("\n"));
});
