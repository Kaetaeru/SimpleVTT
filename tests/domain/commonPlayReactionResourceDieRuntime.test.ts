import assert from "node:assert/strict";
import test from "node:test";
import type { CommonPlayDefinitionIR } from "../../src/domain/commonPlayDefinitionRuntime";
import { lowerCommonPlayReactionDefinition } from "../../src/domain/commonPlayReactionDefinitionRuntime";
import { bardicInspirationResourceDefinition } from "../../src/domain/bardicInspiration";

function resourceBackedReaction(resourceId:string):CommonPlayDefinitionIR {
  return {
    schemaVersion:"0.2-draft",
    id:"external.resource-backed-reaction",
    payments:[],
    interceptors:[{
      id:"reduce-roll",timing:"d20.outcome-determined",operation:"recalculate",slot:"d20.roll",
      interaction:{id:"choose-reduction",kind:"choice",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},
      operations:[{kind:"roll.modify",mode:"subtract-die",diceResource:resourceId}],
    }],
  };
}

test("resource-backed reaction dice lower through arbitrary resource identity",()=>{
  const resourceId="resource.homebrew.scaling-reaction-die";
  const lowered=lowerCommonPlayReactionDefinition(resourceBackedReaction(resourceId),{
    resolveResourceDie:(candidate)=>candidate===resourceId?10:undefined,
  });
  assert.equal(lowered?.interceptors[0]?.operations[0]?.kind,"roll.modify");
  assert.equal(lowered?.interceptors[0]?.operations[0]?.dice,"1d10");
  assert.throws(()=>lowerCommonPlayReactionDefinition(resourceBackedReaction("resource.unknown")),/no authoritative die size/);
});

test("Bardic Inspiration publishes its scaling die as resource metadata",()=>{
  assert.equal(bardicInspirationResourceDefinition(4,3).dieSides,6);
  assert.equal(bardicInspirationResourceDefinition(5,3).dieSides,8);
  assert.equal(bardicInspirationResourceDefinition(10,3).dieSides,10);
  assert.equal(bardicInspirationResourceDefinition(15,3).dieSides,12);
});
