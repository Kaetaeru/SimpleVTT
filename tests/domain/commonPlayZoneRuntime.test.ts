import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  compileCommonPlayZoneActivation,
  resolveCommonPlayZoneActivation,
  resolveCommonPlayZoneMembershipChange,
  resolveCommonPlayZoneTurnEvent,
  type CommonPlayZoneDefinition,
} from "../../src/domain/commonPlayZoneRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { ResolutionCommit } from "../../src/domain/resolutionTypes";
import type { ZoneMembershipAuthority } from "../../src/domain/runtimeArtifact";
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

function activate(
  definition=DEFINITION,
  authority:ZoneMembershipAuthority="manual",
  placementRef?:string,
) {
  return committed(resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),definition,{
    resolutionId:"external-zone-activation",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:authority,
    ...(placementRef ? {placementRef} : {}),
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

function endTurn(state:ReturnType<typeof runtimeState>,actorId:string,round:number) {
  return committed(resolvePendingResolution(TEST_PROFILE,state,{
    id:`end-${actorId}-${round}-${state.revision}`,
    actorId,
    sourceId:"turn-engine",
    expectedRevision:state.revision,
    operations:[{id:"end-turn",kind:"end-turn",actorId,round}],
  }),"end turn should commit");
}

function zoneArtifactId(state:ReturnType<typeof runtimeState>) {
  const artifact=state.artifacts?.[0];
  assert.ok(artifact,"zone artifact should exist");
  return artifact.id;
}

function definitionWithLeaveAndTurnEndRules() {
  const definition=structuredClone(DEFINITION);
  definition.artifactTemplates[0].rules.push(
    {
      id:"left",
      event:"zone.left",
      frequency:"once-per-turn",
      operations:[{kind:"damage.apply",amount:{value:1},damageType:"force",target:"event.subject"}],
    },
    {
      id:"turn-end",
      event:"zone.turn-end",
      frequency:"once-per-turn",
      operations:[{kind:"damage.apply",amount:{value:1},damageType:"necrotic",target:"event.subject"}],
    },
  );
  return definition;
}

test("Common Play spawns a mapless zone and authoritative manual membership without placement",()=>{
  const initial=runtimeState();
  const pending=compileCommonPlayZoneActivation(initial,DEFINITION,{
    resolutionId:"compile-zone",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"manual",
  });
  assert.equal(pending.sourceId,"external.unknown.persistent-zone");
  assert.equal(pending.operations.length,1);
  assert.equal(pending.operations[0].kind,"spawn-artifact");
  if (pending.operations[0].kind!=="spawn-artifact") return;
  assert.equal(pending.operations[0].zoneMembershipAuthority,"manual");
  assert.equal(pending.operations[0].artifact.placementRef,undefined);

  const activated=committed(resolveCommonPlayZoneActivation(TEST_PROFILE,initial,DEFINITION,{
    resolutionId:"activate-zone",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"manual",
  }),"mapless zone activation should commit");
  assert.equal(activated.state.revision,1);
  assert.equal(activated.state.artifacts?.length,1);
  const artifact=activated.state.artifacts![0];
  assert.equal(artifact.sourceId,DEFINITION.id);
  assert.equal(artifact.templateId,"hazard-zone");
  assert.equal(artifact.artifactKind,"zone");
  assert.equal(artifact.placementRef,undefined);
  assert.deepEqual(artifact.expiry,{kind:"time",elapsedSeconds:60});
  assert.deepEqual(activated.state.zoneMemberships,[{artifactId:artifact.id,authority:"manual",memberIds:[]}]);
  assert.deepEqual(activated.events[0].stateChanges.map((change)=>change.kind),["artifact","zone-membership"]);
});

test("spatial activation keeps placement opaque but uses the same membership state contract",()=>{
  const activated=activate(DEFINITION,"spatial","spatial-adapter:zone-slot-17");
  assert.equal(activated.state.artifacts?.[0].placementRef,"spatial-adapter:zone-slot-17");
  assert.equal(activated.state.zoneMemberships?.[0].authority,"spatial");
  assert.deepEqual(activated.state.zoneMemberships?.[0].memberIds,[]);
});

test("manual membership persists and drives per-rule turn-start behavior without repeated entry",()=>{
  const activated=activate();
  const turn1=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn1.state);

  const entered=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn1.state,DEFINITION,{
    id:"manual-enter-1",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(entered.status,"committed");
  if (entered.status!=="committed") return;
  assert.equal(entered.state.combatants.goblin.life.hp.current,13);
  assert.deepEqual(entered.state.zoneMemberships?.[0].memberIds,["goblin"]);
  assert.equal(entered.state.artifacts?.[0].metadata?.["commonPlay.frequency:entered:goblin"],"turn:1:goblin");

  const duplicateEnter=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,entered.state,DEFINITION,{
    id:"manual-enter-duplicate",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(duplicateEnter.status,"no-match");
  if (duplicateEnter.status!=="no-match") return;
  assert.equal(duplicateEnter.state.combatants.goblin.life.hp.current,13);

  const turnStart=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,entered.state,DEFINITION,{
    id:"membership-turn-start-1",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(turnStart.status,"committed");
  if (turnStart.status!=="committed") return;
  assert.equal(turnStart.state.combatants.goblin.life.hp.current,10);
  assert.equal(turnStart.state.artifacts?.[0].metadata?.["commonPlay.frequency:turn-start:goblin"],"turn:1:goblin");

  const replay=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,turnStart.state,DEFINITION,{
    id:"membership-turn-start-replay",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(replay.status,"no-match");

  const turn2=beginTurn(turnStart.state,"goblin",2);
  const laterTurn=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,turn2.state,DEFINITION,{
    id:"membership-turn-start-2",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(laterTurn.status,"committed");
  if (laterTurn.status!=="committed") return;
  assert.equal(laterTurn.state.combatants.goblin.life.hp.current,7);
  assert.deepEqual(laterTurn.state.zoneMemberships?.[0].memberIds,["goblin"]);
});

test("membership enter and triggered damage roll back together when the subject is invalid",()=>{
  const activated=activate();
  const turn=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn.state);

  const failed=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn.state,DEFINITION,{
    id:"manual-enter-missing-subject",
    artifactId,
    subjectId:"missing-subject",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(failed.status,"rejected");
  if (failed.status!=="rejected") return;
  assert.equal(failed.failedOperationId,"common-play-zone-membership");
  assert.equal(failed.state,turn.state);
  assert.deepEqual(failed.state.zoneMemberships?.[0].memberIds,[]);
  assert.equal(failed.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered:missing-subject"],undefined);

  const retry=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn.state,DEFINITION,{
    id:"manual-enter-valid-retry",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(retry.status,"committed");
  if (retry.status!=="committed") return;
  assert.equal(retry.state.combatants.goblin.life.hp.current,13);
  assert.deepEqual(retry.state.zoneMemberships?.[0].memberIds,["goblin"]);
});

test("turn-end and leave use persistent membership and duplicate leave is a no-op",()=>{
  const definition=definitionWithLeaveAndTurnEndRules();
  const activated=activate(definition);
  const turn=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn.state);
  const entered=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn.state,definition,{
    id:"enter-before-turn-end",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(entered.status,"committed");
  if (entered.status!=="committed") return;

  const ended=endTurn(entered.state,"goblin",1);
  const turnEnd=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,ended.state,definition,{
    id:"membership-turn-end",
    kind:"zone.turn-end",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(turnEnd.status,"committed");
  if (turnEnd.status!=="committed") return;
  assert.equal(turnEnd.state.combatants.goblin.life.hp.current,12);

  const left=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turnEnd.state,definition,{
    id:"manual-leave",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:false,
  });
  assert.equal(left.status,"committed");
  if (left.status!=="committed") return;
  assert.equal(left.state.combatants.goblin.life.hp.current,11);
  assert.deepEqual(left.state.zoneMemberships?.[0].memberIds,[]);
  const membershipResult=left.results["common-play-zone-membership"] as {semanticEvent:string};
  assert.equal(membershipResult.semanticEvent,"zone.left");

  const duplicateLeave=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,left.state,definition,{
    id:"manual-leave-duplicate",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:false,
  });
  assert.equal(duplicateLeave.status,"no-match");
  if (duplicateLeave.status!=="no-match") return;
  assert.equal(duplicateLeave.state.combatants.goblin.life.hp.current,11);
});

test("manual and spatial providers converge on the same membership and rule path",()=>{
  const manualTurn=beginTurn(activate(DEFINITION,"manual").state,"goblin",1);
  const manual=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,manualTurn.state,DEFINITION,{
    id:"provider-manual-enter",
    artifactId:zoneArtifactId(manualTurn.state),
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(manual.status,"committed");
  if (manual.status!=="committed") return;

  const spatialTurn=beginTurn(activate(DEFINITION,"spatial","opaque:zone-1").state,"goblin",1);
  const spatial=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,spatialTurn.state,DEFINITION,{
    id:"provider-spatial-enter",
    artifactId:zoneArtifactId(spatialTurn.state),
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"spatial",
    present:true,
  });
  assert.equal(spatial.status,"committed");
  if (spatial.status!=="committed") return;
  assert.equal(manual.state.combatants.goblin.life.hp.current,spatial.state.combatants.goblin.life.hp.current);
  assert.equal(manual.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered:goblin"],spatial.state.artifacts?.[0].metadata?.["commonPlayRuleOncePerTurn:entered:goblin"]);

  const wrongAuthority=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,spatial.state,DEFINITION,{
    id:"provider-wrong-authority",
    artifactId:zoneArtifactId(spatial.state),
    subjectId:"hero",
    subjectCreatureKind:"character",
    authority:"manual",
    present:true,
  });
  assert.equal(wrongAuthority.status,"rejected");
  if (wrongAuthority.status!=="rejected") return;
  assert.match(wrongAuthority.error,/authority mismatch/);
});

test("zone expiry removes artifact and membership in one authoritative time commit",()=>{
  const activated=activate();
  const turn=beginTurn(activated.state,"goblin",1);
  const artifactId=zoneArtifactId(turn.state);
  const entered=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn.state,DEFINITION,{
    id:"enter-before-expiry",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(entered.status,"committed");
  if (entered.status!=="committed") return;

  const advanced=committed(resolvePendingResolution(TEST_PROFILE,entered.state,{
    id:"advance-zone-time",
    actorId:"hero",
    sourceId:"clock",
    expectedRevision:entered.state.revision,
    operations:[{id:"advance-time",kind:"advance-time",elapsedSeconds:60}],
  }),"time advance should commit");
  assert.deepEqual(advanced.state.artifacts,[]);
  assert.deepEqual(advanced.state.zoneMemberships,[]);
  const advanceResult=advanced.results["advance-time"] as {expiredArtifactIds:string[]};
  assert.deepEqual(advanceResult.expiredArtifactIds,[artifactId]);
  assert.ok(advanced.events[0].stateChanges.some((change)=>change.kind==="artifact"&&change.operation==="removed"));
  assert.ok(advanced.events[0].stateChanges.some((change)=>change.kind==="zone-membership"&&change.operation==="removed"));

  const afterExpiry=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,advanced.state,DEFINITION,{
    id:"enter-after-expiry",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(afterExpiry.status,"no-match");
});

test("Common Play mapless zone behavior is independent of the external content id",()=>{
  const renamed=structuredClone(DEFINITION);
  renamed.id="external.previously-unseen.zone-module";
  const activated=activate(renamed);
  assert.equal(activated.state.artifacts?.[0].sourceId,renamed.id);
  const turn=beginTurn(activated.state,"goblin",1);
  const result=resolveCommonPlayZoneMembershipChange(TEST_PROFILE,turn.state,renamed,{
    id:"renamed-zone-entered",
    artifactId:zoneArtifactId(turn.state),
    subjectId:"goblin",
    subjectCreatureKind:"monster",
    authority:"manual",
    present:true,
  });
  assert.equal(result.status,"committed");
  if (result.status!=="committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current,13);
  assert.deepEqual(result.state.zoneMemberships?.[0].memberIds,["goblin"]);
});

test("Common Play zone runtime rejects unsupported authority, target, frequency, and false turn authority explicitly",()=>{
  const invalidTarget=structuredClone(DEFINITION);
  (invalidTarget.artifactTemplates[0].rules[0].operations[0] as {target:string}).target="event.actor";
  const targetResult=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),invalidTarget,{
    resolutionId:"invalid-zone-target",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"manual",
  });
  assert.equal(targetResult.status,"rejected");
  if (targetResult.status!=="rejected") return;
  assert.match(targetResult.error,/target must be event\.subject/);

  const invalidFrequency=structuredClone(DEFINITION);
  (invalidFrequency.artifactTemplates[0].rules[0] as {frequency:string}).frequency="profile-policy";
  const frequencyResult=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),invalidFrequency,{
    resolutionId:"invalid-zone-frequency",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"manual",
  });
  assert.equal(frequencyResult.status,"rejected");
  if (frequencyResult.status!=="rejected") return;
  assert.match(frequencyResult.error,/frequency is unsupported/);

  const unsupportedAuthority=resolveCommonPlayZoneActivation(TEST_PROFILE,runtimeState(),DEFINITION,{
    resolutionId:"invalid-zone-authority",
    actorId:"hero",
    entryPointId:"create-zone",
    membershipAuthority:"invalid" as ZoneMembershipAuthority,
  });
  assert.equal(unsupportedAuthority.status,"rejected");
  if (unsupportedAuthority.status!=="rejected") return;
  assert.match(unsupportedAuthority.error,/unsupported zone membership authority/);

  const activated=activate();
  const artifactId=zoneArtifactId(activated.state);
  const falseTurnStart=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,activated.state,DEFINITION,{
    id:"false-turn-start",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(falseTurnStart.status,"rejected");
  if (falseTurnStart.status!=="rejected") return;
  assert.match(falseTurnStart.error,/authoritative active actor at turn start/);

  const turn=beginTurn(activated.state,"goblin",1);
  const notMember=resolveCommonPlayZoneTurnEvent(TEST_PROFILE,turn.state,DEFINITION,{
    id:"turn-start-not-member",
    kind:"zone.turn-start",
    artifactId,
    subjectId:"goblin",
    subjectCreatureKind:"monster",
  });
  assert.equal(notMember.status,"no-match");
});
