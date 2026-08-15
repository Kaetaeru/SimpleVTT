import assert from "node:assert/strict";
import test from "node:test";
import "../../src/app/phase09RealResolutionAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";
import type { ActionVm } from "../../src/app/contracts";
import { resolveAttackRollResolution, resolveOpenAbilityCheckResolution } from "../../src/app/realResolutionService";

const CHECK_ACTION:ActionVm = {
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

const ATTACK_ACTION:ActionVm = {
  id:"action.test.attack",
  actorId:"hero",
  name:"테스트 공격",
  category:"weapon",
  target:"enemy",
  economy:"행동",
  resolutionKind:"attack",
  summary:"+7",
  available:true,
  eligibleTargetIds:["target"],
  attackBonus:7,
  details:[],
};

test("Phase 09 application service projects domain open-check results into the existing ResolutionView contract", () => {
  const resolution = resolveOpenAbilityCheckResolution({
    resolutionId:"phase09.service",
    action:CHECK_ACTION,
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

test("Phase 09 attack projection uses domain natural-1 and natural-20 semantics instead of Mock arithmetic", () => {
  const naturalOne = resolveAttackRollResolution({
    resolutionId:"phase09.attack.one",
    action:ATTACK_ACTION,
    target:{ id:"target", name:"Target", ac:5 },
    diceFaces:[1],
    modifierContributions:[{ source:"test:attack-bonus", value:7 }],
  });
  assert.equal(naturalOne.attackTotal,8);
  assert.equal(naturalOne.attackOutcome,"빗나감","natural 1 must miss even when total beats AC");
  assert.equal(naturalOne.critical,false);
  assert.ok(naturalOne.provenance.some((entry) => entry.includes("attack-natural-1")));

  const naturalTwenty = resolveAttackRollResolution({
    resolutionId:"phase09.attack.twenty",
    action:ATTACK_ACTION,
    target:{ id:"target", name:"Target", ac:99 },
    diceFaces:[20],
    modifierContributions:[{ source:"test:attack-bonus", value:7 }],
  });
  assert.equal(naturalTwenty.attackTotal,27);
  assert.equal(naturalTwenty.attackOutcome,"명중","natural 20 must hit even when total is below AC");
  assert.equal(naturalTwenty.critical,true);
  assert.ok(naturalTwenty.provenance.some((entry) => entry.includes("attack-natural-20")));
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

test("MockAdapter weapon attack preview delegates hit and critical semantics to the Phase 09 real resolution service", async () => {
  const adapter = new MockAdapter();
  await adapter.loadReferenceScenario("critical");
  await adapter.resolveAction("action.longsword",["combatant.goblin-a"]);

  let snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.rollKind,"attack");
  assert.equal(snapshot.resolution?.stage,"roll-animation");
  assert.equal(snapshot.resolution?.rollTotal,27);
  assert.equal(snapshot.resolution?.attackTotal,27);
  assert.equal(snapshot.resolution?.targetAc,15);
  assert.equal(snapshot.resolution?.attackOutcome,"명중");
  assert.equal(snapshot.resolution?.critical,true);
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("attack-natural-20")));
  assert.ok(snapshot.resolution?.provenance.some((entry) => entry.includes("target:combatant.goblin-a:ac")));

  await adapter.advanceResolution();
  snapshot = await adapter.getSnapshot();
  assert.equal(snapshot.resolution?.stage,"attack-result");
  assert.equal(snapshot.resolution?.nextLabel,"피해 굴림");
});
