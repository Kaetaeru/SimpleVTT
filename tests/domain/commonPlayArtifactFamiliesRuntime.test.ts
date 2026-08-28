import assert from "node:assert/strict";
import test from "node:test";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { RuntimeArtifactSpawnRequest } from "../../src/domain/runtimeArtifact";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function spawn(artifact:RuntimeArtifactSpawnRequest) {
  const state=runtimeState();
  return resolvePendingResolution(TEST_PROFILE,state,{
    id:`spawn:${artifact.id}`,actorId:"hero",sourceId:artifact.sourceId,expectedRevision:0,
    operations:[{id:"spawn",kind:"spawn-artifact",artifact}],
  });
}

function objectArtifact(id="external-object"):RuntimeArtifactSpawnRequest {
  return {
    id,sourceId:"external.unknown.object",sourceActorId:"hero",templateId:"object-template",artifactKind:"object",placementRef:"manual:point-a",expiry:{kind:"permanent"},
    object:{size:"large",armorClass:15,hp:{current:20,maximum:20},damageThreshold:5,damageDefenses:[{source:"stone",kind:"resistance",damageType:"slashing"}],repairable:true},
  };
}

test("object artifacts own AC, HP, threshold, defenses, repair, relocation, destruction, and Undo evidence",()=>{
  const created=spawn(objectArtifact());
  assert.equal(created.status,"committed");
  if(created.status!=="committed") return;
  const below=resolvePendingResolution(TEST_PROFILE,created.state,{
    id:"below-threshold",actorId:"hero",sourceId:"external.hit",expectedRevision:1,
    operations:[{id:"damage",kind:"damage-artifact",artifactId:"external-object",damageType:"slashing",amount:8}],
  });
  assert.equal(below.status,"committed");
  if(below.status!=="committed") return;
  assert.equal(below.state.artifacts?.[0].object?.hp.current,20,"8 resisted to 4 then blocked by threshold 5");

  const damaged=resolvePendingResolution(TEST_PROFILE,below.state,{
    id:"damage",actorId:"hero",sourceId:"external.hit",expectedRevision:2,
    operations:[
      {id:"damage",kind:"damage-artifact",artifactId:"external-object",damageType:"force",amount:7},
      {id:"move",kind:"relocate-artifact",artifactId:"external-object",placementRef:"manual:point-b"},
    ],
  });
  assert.equal(damaged.status,"committed");
  if(damaged.status!=="committed") return;
  assert.equal(damaged.state.artifacts?.[0].object?.hp.current,13);
  assert.equal(damaged.state.artifacts?.[0].placementRef,"manual:point-b");

  const repaired=resolvePendingResolution(TEST_PROFILE,damaged.state,{
    id:"repair",actorId:"hero",sourceId:"external.repair",expectedRevision:3,
    operations:[{id:"repair",kind:"repair-artifact",artifactId:"external-object",amount:3}],
  });
  assert.equal(repaired.status,"committed");
  if(repaired.status!=="committed") return;
  assert.equal(repaired.state.artifacts?.[0].object?.hp.current,16);

  const destroyed=resolvePendingResolution(TEST_PROFILE,repaired.state,{
    id:"destroy",actorId:"hero",sourceId:"external.hit",expectedRevision:4,
    operations:[{id:"damage",kind:"damage-artifact",artifactId:"external-object",damageType:"force",amount:20}],
  });
  assert.equal(destroyed.status,"committed");
  if(destroyed.status!=="committed") return;
  assert.equal(destroyed.state.artifacts?.length,0);
  assert.equal(destroyed.events[0].stateChanges[0]?.kind,"artifact");
  assert.equal(destroyed.events[0].stateChanges[0]&&"operation" in destroyed.events[0].stateChanges[0]?destroyed.events[0].stateChanges[0].operation:undefined,"removed");
});

test("actor, form, and link artifacts retain explicit owner/controller/property/relation semantics",()=>{
  const state=runtimeState();
  const created=resolvePendingResolution(TEST_PROFILE,state,{
    id:"artifact-families",actorId:"hero",sourceId:"external.unknown.artifacts",expectedRevision:0,
    operations:[
      {id:"actor",kind:"spawn-artifact",artifact:{id:"summon",sourceId:"external.unknown.summon",sourceActorId:"hero",templateId:"summon-template",artifactKind:"actor",placementRef:"manual:summon",expiry:{kind:"time",elapsedSeconds:600},actor:{combatantId:"summoned-one",statDefinitionId:"external.stat.unknown",ownerId:"hero",controllerId:"player-one",initiative:"shared",properties:{"defense.ac":13,"life.hp.maximum":10},actionDefinitionIds:["attack.bite"],resources:[{id:"charge",current:1,maximum:1}]}}},
      {id:"form",kind:"spawn-artifact",artifact:{id:"form",sourceId:"external.unknown.form",sourceActorId:"hero",templateId:"form-template",artifactKind:"form",expiry:{kind:"time",elapsedSeconds:600},form:{targetActorId:"hero",propertyOverlay:{"defense.ac":16,"movement.fly":30},retainedProperties:["abilities.int"],replacementProperties:["defense.ac","movement.fly"],hpPolicy:"temporary-hp",actionPolicy:"replace",spellcasting:"restricted",actionDefinitionIds:["attack.claw"],resources:[{id:"form-use",current:1,maximum:1}]}}},
      {id:"link",kind:"spawn-artifact",artifact:{id:"tether",sourceId:"external.unknown.link",sourceActorId:"hero",templateId:"link-template",artifactKind:"link",expiry:{kind:"permanent"},link:{endpointIds:["hero","summon"],relation:"tether",maximumLengthFeet:30}}},
    ],
  });
  assert.equal(created.status,"committed");
  if(created.status!=="committed") return;
  assert.deepEqual(created.state.artifacts?.map((artifact)=>artifact.artifactKind),["actor","form","link"]);

  const controlled=resolvePendingResolution(TEST_PROFILE,created.state,{
    id:"controller",actorId:"hero",sourceId:"external.control",expectedRevision:1,
    operations:[
      {id:"actor-control",kind:"set-artifact-controller",artifactId:"summon",controllerId:"dm"},
      {id:"form-control",kind:"set-artifact-controller",artifactId:"form",controllerId:"player-two"},
    ],
  });
  assert.equal(controlled.status,"committed");
  if(controlled.status==="committed") {
    assert.equal(controlled.state.artifacts?.find((artifact)=>artifact.id==="summon")?.actor?.controllerId,"dm");
    assert.equal(controlled.state.artifacts?.find((artifact)=>artifact.id==="form")?.form?.controllerId,"player-two");
  }
});

test("artifact family mechanics are content-identity invariant and reject dangling links",()=>{
  const first=spawn(objectArtifact("object.a"));
  const second=spawn({...objectArtifact("object.b"),sourceId:"renamed.unknown.object",templateId:"renamed-template"});
  assert.equal(first.status,"committed");assert.equal(second.status,"committed");
  if(first.status==="committed"&&second.status==="committed") assert.deepEqual(first.state.artifacts?.[0].object,second.state.artifacts?.[0].object);
  const invalid=spawn({id:"bad-link",sourceId:"x",templateId:"x",artifactKind:"link",expiry:{kind:"permanent"},link:{endpointIds:["hero","missing"],relation:"portal"}});
  assert.equal(invalid.status,"rejected");
});
