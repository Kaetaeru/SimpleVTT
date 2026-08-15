import assert from "node:assert/strict";
import test from "node:test";
import {
  DIVINE_SENSE_SOURCE_ID,
  DIVINE_SENSE_TAG,
  divineSenseAwareness,
  resolveDivineSenseActivation,
} from "../../src/domain/paladinDivineSense";
import { PALADIN_CHANNEL_DIVINITY_RESOURCE_ID } from "../../src/domain/coreClassResources";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function paladinState() {
  const state = runtimeState();
  state.combatants.hero.resources.push({
    id:PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
    label:"채널 디비니티",
    current:2,
    maximum:2,
    recovery:{ shortRest:1, longRest:"all" },
  });
  return state;
}

function activate() {
  const state = paladinState();
  const result = resolveDivineSenseActivation(TEST_PROFILE, state, {
    id:"divine-sense.activate",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") throw new Error(result.error);
  return result.state;
}

test("Divine Sense spends a Bonus Action and Channel Divinity and creates a 10-minute self marker", () => {
  const state = paladinState();
  const result = resolveDivineSenseActivation(TEST_PROFILE, state, {
    id:"divine-sense.activation",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.economy.action, true);
  assert.equal(result.state.combatants.hero.economy.bonusAction, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)?.current, 1);
  const marker = result.state.effects.find((effect) => effect.sourceId === DIVINE_SENSE_SOURCE_ID && effect.tags.includes(DIVINE_SENSE_TAG));
  assert.ok(marker);
  assert.deepEqual(marker?.expiry, { kind:"time", elapsedSeconds:600 });
  assert.deepEqual(marker?.termination, { targetBecomesIncapacitated:true, targetDies:true });
  assert.equal(marker?.targetId, "hero");
});

test("Divine Sense reports only Celestial, Fiend, and Undead creature locations within 60 feet plus sanctity presence", () => {
  const state = activate();
  const awareness = divineSenseAwareness(state, "hero", [
    { id:"angel", distanceFeet:60, creatureType:"Celestial", location:"square:10,10" },
    { id:"devil", distanceFeet:25, creatureType:"fiend", location:"square:4,2" },
    { id:"skeleton", distanceFeet:61, creatureType:"undead", location:"square:20,20" },
    { id:"wolf", distanceFeet:10, creatureType:"beast", location:"square:1,1" },
  ], [
    { id:"altar", distanceFeet:40, sanctity:"consecrated" },
    { id:"crypt", distanceFeet:60, sanctity:"desecrated" },
    { id:"far-shrine", distanceFeet:65, sanctity:"consecrated" },
  ]);
  assert.equal(awareness.active, true);
  assert.deepEqual(awareness.creatures, [
    { id:"angel", creatureType:"celestial", location:"square:10,10" },
    { id:"devil", creatureType:"fiend", location:"square:4,2" },
  ]);
  assert.equal(awareness.consecratedPresence, true);
  assert.equal(awareness.desecratedPresence, true);
});

test("Divine Sense ends immediately when the Paladin becomes Incapacitated through Stunned", () => {
  const active = activate();
  const result = resolvePendingResolution(TEST_PROFILE, active, {
    id:"divine-sense.stunned",
    actorId:"goblin",
    sourceId:"test:stun",
    expectedRevision:active.revision,
    operations:[{
      id:"stun-paladin",
      kind:"apply-effect",
      effect:{
        id:"paladin-stunned",
        sourceId:"test:stun",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"stunned",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === DIVINE_SENSE_SOURCE_ID), false);
  assert.equal(divineSenseAwareness(result.state, "hero", [], []).active, false);
});

test("Divine Sense expires after 10 minutes through the generic clock lifecycle", () => {
  const active = activate();
  const result = resolvePendingResolution(TEST_PROFILE, active, {
    id:"divine-sense.advance-time",
    actorId:"hero",
    sourceId:"test:clock",
    expectedRevision:active.revision,
    operations:[{
      id:"advance-ten-minutes",
      kind:"advance-time",
      elapsedSeconds:600,
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.sourceId === DIVINE_SENSE_SOURCE_ID), false);
  assert.equal(divineSenseAwareness(result.state, "hero", [], []).active, false);
});

test("Divine Sense rejects atomically when Channel Divinity is depleted or Paladin level is too low", () => {
  const depleted = paladinState();
  depleted.combatants.hero.resources.find((pool) => pool.id === PALADIN_CHANNEL_DIVINITY_RESOURCE_ID)!.current = 0;
  const noResource = resolveDivineSenseActivation(TEST_PROFILE, depleted, {
    id:"divine-sense.depleted",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:3,
  });
  assert.equal(noResource.status, "rejected");
  assert.equal(noResource.state, depleted);
  assert.equal(depleted.combatants.hero.economy.bonusAction, true);
  assert.equal(depleted.effects.length, 0);

  const tooLow = paladinState();
  const lowLevel = resolveDivineSenseActivation(TEST_PROFILE, tooLow, {
    id:"divine-sense.level-2",
    actorId:"hero",
    expectedRevision:0,
    paladinLevel:2,
  });
  assert.equal(lowLevel.status, "rejected");
  assert.equal(lowLevel.state, tooLow);
  assert.match(lowLevel.status === "rejected" ? lowLevel.error : "", /requires Paladin level 3-20/);
});
