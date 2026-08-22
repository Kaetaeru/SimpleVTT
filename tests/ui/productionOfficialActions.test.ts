import assert from "node:assert/strict";
import test from "node:test";
import { deriveProductionCharacterActions } from "../../src/app/productionPlayRuntimeAdapter";
import { MockAdapter } from "../../src/app/mockAdapter";

test("production characters expose every SRD 5.2.1 base action through executable action VMs",async()=>{
  const character=(await new MockAdapter().getSnapshot()).activeCharacter;
  const actions=deriveProductionCharacterActions(character);
  const ids=new Set(actions.map((action)=>action.id));
  assert.ok(actions.some((action)=>action.resolutionKind==="attack"),"Attack is backed by character attack actions");
  assert.ok(actions.some((action)=>action.category==="magic"),"Magic is backed by character spell or magic-item actions");
  for (const id of [
    "action.dash","action.standard.disengage","action.standard.dodge","action.standard.help",
    "action.standard.hide.stealth","action.standard.ready","action.standard.utilize",
  ]) assert.ok(ids.has(id),`missing ${id}`);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.influence.")).length,5);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.search.")).length,4);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.standard.study.")).length,5);
  assert.equal(actions.filter((action)=>action.id.startsWith("action.skill.")).length,18);
  assert.equal(actions.find((action)=>action.id==="action.standard.help")?.target,"ally");
  assert.equal(actions.find((action)=>action.id==="action.standard.dodge")?.economy,"행동");
});
