import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayZoneActivation,
  resolveCommonPlayZoneActivation,
  resolveCommonPlayZoneEvent,
  type CommonPlayZoneDefinition,
} from "../../src/domain/commonPlayZoneRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { ResolutionCommit } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const DEFINITION=JSON.parse(readFileSync(
  new URL("../fixtures/play-contract/persistent-zone-trigger.json",import.meta.url),
  "utf8",
)) as CommonPlayZoneDefinition;

function committed(value:ResolutionCommit,label:string) {
  assert.equal(value.status,"committed",label);
  if (value.status!=="committed") throw new Error(`${label}: ${value.error}`);
  return value;
}

function activate(definition=DEFINITION) {
  return committed(resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"external-zone-activation",
    actorId:"hero",
    entryPointId:"create-zone",
    placementRef:"spatial-adapter:zone-slot-17",
  }),"zone activation should commit");
}

function beginTurn(state:ReturnType<typeof runtimeState>,actorId:string,round:number) {
  return committed(resolvePendingResolution(TEST_PROFILE,state,{
    id:`begin-${actorId}-${round}-${state.revision}`,
    actorId,
    sourceId:"turn-engine",
    expectedRevision:state.revision,
    operations:[{id:"begin-turn",kind:"begin-turn",actorId,round}],
  }),"begin turn should commit");
}

function zoneArtifactId(state:ReturnType<typeof runtimeState>) {
  const artifact=state.artifacts?.[0];
  assert.ok(artifact,"zone artifact should exist");
  return artifact.id;
}

test("Common Play spawns an unknown zone artifact with opaque placement and elapsed lifetime",()=>{
  const initial=runtimeState();
  const pending=compileCommonPlayZoneActivation(initial,DEFINITION,{
    resolutionId:"compile-zone",
    actorId:"hero",
    entryPointId:"create-zone",
    placementRef:"external-map:opaque-zone-1",
  });
  assert.equal(pending.sourceId,"external.unknown.persistent-zone");
  assert.equal(pending.operations.length,1);
  assert.equal(pending.operations[0].kind,"spawn-artifact");

  const activated=committed(resolveCommonPlayZoneActivation(TEST_PROFILE,initial,DEFINITION,{
    resolutionId:"activate-zone",
    actorId:"hero",
    entryPointId:"create-zone",
    placementRef:"external-map:opaque-zone-1",
  }),"zone activation should commit");
  assert.equal(activated.state.revision,1);
  assert.equal(activated.state.artifacts?.length,1);
  const artifact=activated.state.artifacts![0];
  assert.equal(artifact.sourceId,DEFINITION.id);
  assert.equal(artifact.templateId,"hazard-zone");
  assert.equal(artifact.artifactKind,"zone");
  assert.equal(artifact.placementRef,"external-map:opaque-zone-1");
  assert.deepEqual(artifact.expiry,{kind:"time",elapsedSeconds:60});
  assert.equal(activated.events[0].stateChanges[0]?.kind,"artifact");
});

test("Common Play zone rules keep independent once-per-turn frequency and allow a later turn",()=>{
  const activated=activate();
  const turn1=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn1.state);

  const entered=resolveCommonPlayZoneEvent(TEST_PROFILE,turn1.state,DEFINITION,{
    id:"zone-entered-1",
    kind:"zone.entered",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(entered.status,"committed");
  if (entered.status!=="committed") return;
  assert.equal(entered.state.combatants.goblin.life.hp.current,13);
  assert.equal(entered.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered"],"1:goblin");

  const enteredReplay=resolveCommonPlayZoneEvent(TEST_PROFILE,entered.state,DEFINITION,{
    id:"zone-entered-1-replay",
    kind:"zone.entered",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(enteredReplay.status,"no-match");
  if (enteredReplay.status!=="no-match") return;
  assert.equal(enteredReplay.state.combatants.goblin.life.hp.current,13);

  const turnStart=resolveCommonPlayZoneEvent(TEST_PROFILE,entered.state,DEFINITION,{
    id:"zone-turn-start-1",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(turnStart.status,"committed");
  if (turnStart.status!=="committed") return;
  assert.equal(turnStart.state.combatants.goblin.life.hp.current,10);
  assert.equal(turnStart.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:turn-start"],"1:goblin");

  const turnStartReplay=resolveCommonPlayZoneEvent(TEST_PROFILE,turnStart.state,DEFINITION,{
    id:"zone-turn-start-1-replay",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(turnStartReplay.status,"no-match");
  if (turnStartReplay.status!=="no-match") return;

  const turn2=beginTurn(turnStart.state,"goblin",2);
  const enteredAgain=resolveCommonPlayZoneEvent(TEST_PROFILE,turn2.state,DEFINITION,{
    id:"zone-entered-2",
    kind:"zone.entered",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(enteredAgain.status,"committed");
  if (enteredAgain.status!=="committed") return;
  assert.equal(enteredAgain.state.combatants.goblin.life.hp.current,8);
  assert.equal(enteredAgain.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered"],"2:goblin");
});

test("Common Play zone damage and frequency marker roll back together when the trigger fails",()=>{
  const activated=activate();
  const turn=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn.state);

  const failed=resolveCommonPlayZoneEvent(TEST_PROFILE,turn.state,DEFINITION,{
    id:"zone-entered-missing-subject",
    kind:"zone.entered",
    artifactId,
    subjectId:"missing-subject",
    subjectCreatureKind:"monster",
  });
  assert.equal(failed.status,"rejected");
  if (failed.status!=="rejected") return;
  assert.equal(failed.failedOperationId,"common-play-zone-rule-1-damage-1");
  assert.equal(failed.state,turn.state);
  assert.equal(failed.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered"],undefined);

  const retry=resolveCommonPlayZoneEvent(TEST_PROFILE,turn.state,DEFINITION,{
    id:"zone-entered-valid-retry",
    kind:"zone.entered",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(retry.status,"committed");
  if (retry.status!=="committed") return;
  assert.equal(retry.state.combatants.goblin.life.hp.current,13);
  assert.equal(retry.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered"],"1:goblin");
});

test("Common Play zone expires through authoritative elapsed time and cannot fire afterward",()=>{
  const activated=activate();
  const artifactId=zoneArtifactId(activated.state);
  const advanced=committed(resolvePendingResolution(TEST_PROFILE,activated.state,{
    id:"advance-zone-time",
    actorId:"hero",
    sourceId:"clock",
    expectedRevision:activated.state.revision,
    operations:[{id:"advance-time",kind:"advance-time",elapsedSeconds:60}],
  }),"time advance should commit");
  assert.deepEqual(advanced.state.artifacts,[]);
  const advanceResult=advanced.results["advance-time"] as {expiredArtifactIds:string[]};
  assert.deepEqual(advanceResult.expiredArtifactIds,[artifactId]);
  assert.ok(advanced.events[0].stateChanges.some((change)=>change.kind==="artifact"&&change.operation==="removed"));

  const turn=beginTurn(advanced.state,"goblin",1);
  const afterExpiry=resolveCommonPlayZoneEvent(TEST_PROFILE,turn.state,DEFINITION,{
    id:"zone-entered-after-expiry",
    kind:"zone.entered",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(afterExpiry.status,"no-match");
  if (afterExpiry.status!=="no-match") return;
  assert.equal(afterExpiry.state.combatants.goblin.life.hp.current,15);
});

test("Common Play zone behavior is independent of the external content id",()=>{
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.zone-module";
  const activated=activate(renamed);
  assert.equal(activated.state.artifacts?.[0].sourceId,renamed.id);
  const turn=beginTurn(activated.state,"goblin",1);
  const result=resolveCommonPlayZoneEvent(TEST_PROFILE,turn.state,renamed,{
    id:"renamed-zone-entered",
    kind:"zone.entered",
    artifactId:zoneArtifactId(turn.state),
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,13);
});

test("Common Play zone runtime rejects unsupported semantic shapes explicitly",()=>{
  const invalidTarget=structuredClone(DEFINITION);
  (invalidTarget.artifactTemplates[0].rules[0].operations[0] as {target:string}).target="event.actor";
  const targetResult=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),invalidTarget,{
    resolutionId:"invalid-zone-target",
    actorId:"hero",
    entryPointId:"create-zone",
    placementRef:"spatial:1",
  });
  assert.equal(targetResult.status,"rejected");
  if (targetResult.status!=="rejected") return;
  assert.match(targetResult.error,/target must be event\.subject/);

  const invalidFrequency=structuredClone(DEFINITION);
  (invalidFrequency.artifactTemplates[0].rules[0] as {frequency:string}).frequency="once-per-round";
  const frequencyResult=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),invalidFrequency,{
    resolutionId:"invalid-zone-frequency",
    actorId:"hero",
    entryPointId:"create-zone",
    placementRef:"spatial:2",
  });
  assert.equal(frequencyResult.status,"rejected");
  if (frequencyResult.status!=="rejected") return;
  assert.match(frequencyResult.error,/only once-per-turn frequency/);

  const activated=activate();
  const artifactId=zoneArtifactId(activated.state);
  const falseTurnStart=resolveCommonPlayZoneEvent(TEST_PROFILE,activated.state,DEFINITION,{
    id:"false-turn-start",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(falseTurnStart.status,"rejected");
  if (falseTurnStart.status!=="rejected") return;
  assert.match(falseTurnStart.error,/authoritative active actor at turn start/);
});
