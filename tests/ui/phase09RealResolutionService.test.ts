import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { resolveOpenAbilityCheckResolution } from "../../src/app/realResolutionService";

const ACTION:ActionVm = {
  id:"action.test.athletics",
  actorId:"hero",
  name:"운동 판정",
  category:"basic",
  target:"none",
  economy:"없음",
  resolutionKind:"ability-check",
  summary:"근력(운동) +7",
  available:true,
  eligibleTargetIds:[],
  checkBonus:7,
  details:[{ label:"판정", value:"근력(운동)" }],
};

test("Phase 09 application service projects domain open-check results into the existing ResolutionView contract", () => {
  const resolution = resolveOpenAbilityCheckResolution({
    resolutionId:"phase09.service",
    action:ACTION,
    diceFaces:[5,18],
    modifierContributions:[{ source:"test:athletics-bonus", value:7 }],
    rollStateContributions:[{ source:"test:advantage", state:"advantage" }],
    checkLabel:"근력(운동)",
  });

  assert.equal(resolution.stage,"roll-animation");
  assert.equal(resolution.rollKind,"check");
  assert.equal(resolution.rollTotal,25);
  assert.deepEqual(resolution.authoritativeDice,[5,18]);
  assert.equal(resolution.compact,"d20 18 + 7 = 25");
  assert.equal(resolution.calculatedOutcome,"총합 25");
  assert.ok(resolution.provenance.some((entry) => entry.includes("test:advantage")));
  assert.ok(resolution.provenance.some((entry) => entry.includes("test:athletics-bonus")));
});

test("MockAdapter freeform Athletics now delegates its d20 arithmetic to the Phase 09 real resolution service", async () => {
  const adapter = new MockAdapter();
  await adapter.setSessionMode("freeform");
  await adapter.setQueuedD20(5);
  await adapter.resolveAction("action.athletics",[]);

  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.queuedD20,null);
  assert.equal(snapshot.resolution?.rollKind,"check");
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.rollTotal,12);
  assert.equal(snapshot.resolution?.compact,"d20 5 + 7 = 12");
  assert.equal(snapshot.resolution?.detail[0],"근력(운동) 12");
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("action:action.athletics:check-bonus")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("dice:resolution.phase09.")));

  const resolutionId = snapshot.resolution?.id;
  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"complete");
  assert.equal(snapshot.resolution?.canAdvance,false);
  assert.equal(snapshot.activity[0]?.id,resolutionId);
  assert.equal(snapshot.activity[0]?.summary,"d20 5 + 7 = 12");
});
