import assert from "node:assert/strict";
import test from "node:test";
import { parseCommonPlayDefinition } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { resumeCommonPlayInteraction, startCommonPlayResolution } from "../../src/domain/commonPlayRuntime";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function definition(id:string) {
  const parsed=parseCommonPlayDefinition({
    schemaVersion:"0.2-draft",
    id,
    payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit"}],
    interceptors:[{
      id:"structural-damage-scale",
      timing:"damage.rolled",
      interaction:{id:"use-scale",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
      operation:"recalculate",
      slot:"primary.damage",
      operations:[{kind:"roll.modify",mode:"multiply",value:{value:0.5}}],
    }],
  },"C9 external damage multiplier");
  const lowered=lowerCommonPlayReactionDefinition(parsed);
  assert.ok(lowered);
  return lowered;
}

function pending():PendingResolution {
  return {
    id:"c9-family-p-damage-multiply",
    actorId:"goblin",
    sourceId:"external.unknown.damage",
    expectedRevision:0,
    operations:[{id:"damage-roll",kind:"damage-roll",request:{dice:[{source:"external.die",count:1,sides:6,faces:[6]}],flat:[{source:"external.flat",value:4}]}}],
  };
}

function run(id:string) {
  const state=runtimeState();
  const started=startCommonPlayResolution(TEST_PROFILE,state,pending(),definition(id),"hero");
  assert.equal(started.status,"awaiting-input");
  if(started.status!=="awaiting-input")throw new Error("expected interaction");
  return resumeCommonPlayInteraction(TEST_PROFILE,state,started,{interactionId:started.interaction.id,idempotencyKey:started.interaction.idempotencyKey,value:true});
}

test("unknown Common Play primary.damage multiplier is structural and identity invariant",()=>{
  const original=run("external.unknown.damage-halver");
  const renamed=run("external.renamed.damage-halver");
  for(const result of [original,renamed]){
    assert.equal(result.status,"committed");
    if(result.status!=="committed")continue;
    assert.equal((result.results["damage-roll"] as {total:number}).total,5);
    assert.equal(result.state.combatants.hero.economy.reaction,false);
  }
});
