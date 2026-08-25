import assert from "node:assert/strict";
import test from "node:test";
import { BARBARIAN_RAGE_RESOURCE_ID } from "../../src/domain/barbarianBerserker";
import { resolveBarbarianRageStart } from "../../src/domain/barbarianRage";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("starting Rage ends the Barbarian's existing Concentration", () => {
  const state=runtimeState();
  state.combatants.hero.resources.push({
    id:BARBARIAN_RAGE_RESOURCE_ID,label:"격노",current:2,maximum:2,recovery:{shortRest:1,longRest:"all"},
  });
  const concentrating=resolvePendingResolution(TEST_PROFILE,state,{
    id:"rage.concentration.setup",actorId:"hero",sourceId:"spell:test",expectedRevision:0,
    operations:[{id:"rage.concentration.setup:start",kind:"start-concentration",actorId:"hero",groupId:"spell:test",sourceId:"spell:test"}],
  });
  assert.equal(concentrating.status,"committed");
  if(concentrating.status!=="committed")return;
  assert.ok(concentrating.state.concentration.hero);

  const raged=resolveBarbarianRageStart(TEST_PROFILE,concentrating.state,{
    id:"rage.concentration.start",actorId:"hero",expectedRevision:concentrating.state.revision,
    barbarianLevel:5,wearingHeavyArmor:false,useBonusActionEconomy:false,
  });
  assert.equal(raged.status,"committed");
  if(raged.status!=="committed")return;
  assert.equal(raged.state.concentration.hero,undefined);
});
