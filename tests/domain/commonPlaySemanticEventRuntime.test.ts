import assert from "node:assert/strict";
import test from "node:test";
import { appendCommonPlaySemanticOutcomeEvents } from "../../src/domain/commonPlaySemanticEventRuntime";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function pending(sourceId:string):PendingResolution {
  return {
    id:`semantic-${sourceId}`,
    actorId:"hero",
    sourceId,
    expectedRevision:0,
    operations:[
      {
        id:"attack-test",
        kind:"d20",
        targetId:"goblin",
        request:{
          family:"attack-roll",target:10,modifierContributions:[],targetSource:"external-ac",
          dice:{id:"attack-d20",purpose:"external attack",sides:20,faces:[15]},
        },
      },
      {
        id:"save-test",
        kind:"d20",
        actorId:"goblin",
        request:{
          family:"saving-throw",target:14,modifierContributions:[],targetSource:"external-dc",
          dice:{id:"save-d20",purpose:"external save",sides:20,faces:[4]},
        },
      },
    ],
  };
}

function execute(sourceId:string) {
  const request=pending(sourceId);
  const committed=resolvePendingResolution(TEST_PROFILE,runtimeState(),request);
  assert.equal(committed.status,"committed");
  return appendCommonPlaySemanticOutcomeEvents(request,committed);
}

test("Common Play derives authoritative attack and save outcome vocabulary from generic d20 results",()=>{
  const committed=execute("external.unknown.semantic-source");
  assert.equal(committed.status,"committed");
  if(committed.status!=="committed") return;
  const attack=committed.events.find((event)=>event.kind==="attack.hit");
  const save=committed.events.find((event)=>event.kind==="save.failure");
  assert.ok(attack);
  assert.equal(attack.actorId,"hero");
  assert.equal(attack.targetId,"goblin");
  assert.ok(save);
  assert.equal(save.actorId,"goblin","saving-throw semantic actor must be the actual roller, not the resolution source");
  assert.equal(save.targetId,undefined);
  assert.equal(committed.state.history.some((entry)=>entry.kind==="attack.hit"),true);
  assert.equal(committed.state.history.some((entry)=>entry.kind==="save.failure"),true);
  const replay=appendCommonPlaySemanticOutcomeEvents(pending("external.unknown.semantic-source"),committed);
  assert.equal(replay.status,"committed");
  if(replay.status!=="committed") return;
  assert.equal(replay.events.filter((event)=>event.kind==="attack.hit").length,1,"semantic enrichment must be idempotent");
});

test("semantic outcome vocabulary is invariant under external source identity",()=>{
  const summarize=(sourceId:string)=>{
    const committed=execute(sourceId);
    assert.equal(committed.status,"committed");
    if(committed.status!=="committed") return [];
    return committed.events.filter((event)=>event.kind.startsWith("attack.")||event.kind.startsWith("save.")).map((event)=>({
      kind:event.kind,actorId:event.actorId,targetId:event.targetId,
    }));
  };
  assert.deepEqual(summarize("external.first.identity"),summarize("renamed.completely.unseen.identity"));
});
