import assert from "node:assert/strict";
import test from "node:test";
import { parseManualCommonPlayOperationDefinition, resolveCommonPlayEntryPointOperations } from "../../src/domain/commonPlayOperationRuntime";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";
test("portable actor-owner consent preserves revision-aware stale rejection and commits atomically",()=>{
  const definition=parseManualCommonPlayOperationDefinition({schemaVersion:"0.2-draft",id:"external.actor-owner-consent",payments:[{kind:"economy",bucket:"reaction",amount:{value:1},consumeAt:"commit",refundOnCancel:true}],entryPoints:[{id:"react",invocation:"manual",interaction:{id:"owner-consent",kind:"consent",responder:"actor-owner",mode:"blocking",input:{type:"boolean"},revalidate:"if-revision-changed",stalePolicy:"reject"},operations:[{kind:"healing.apply",amount:{value:5},target:"self"}]}]});
  assert.equal(definition.entryPoints[0].interaction?.responder,"actor-owner");
  assert.equal(definition.entryPoints[0].interaction?.revalidate,"if-revision-changed");
  assert.equal(definition.entryPoints[0].interaction?.stalePolicy,"reject");
  const state=runtimeState();state.combatants.hero.life.hp.current=10;
  const committed=resolveCommonPlayEntryPointOperations(TEST_PROFILE,state,definition,{resolutionId:"owner-consent-resolution",actorId:"hero",entryPointId:"react",targetId:"hero",interactionResponse:{interactionId:"owner-consent",accepted:true}});
  assert.equal(committed.status,"committed");if(committed.status!=="committed")return;
  assert.equal(committed.state.combatants.hero.life.hp.current,15);assert.equal(committed.state.combatants.hero.economy.reaction,false);
  assert.deepEqual(committed.events.map((event)=>event.kind),["use-economy","healing"]);
});
