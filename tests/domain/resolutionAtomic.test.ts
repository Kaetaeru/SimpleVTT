import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import type { PendingResolution } from "../../src/domain/resolutionTypes";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

test("atomic resolution carries targeting -> Action -> attack -> critical damage into one commit", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current:30, maximum:30, temporary:0 };
  const pending:PendingResolution = {
    id:"weapon-attack-1",
    actorId:"hero",
    sourceId:"weapon:longsword",
    expectedRevision:0,
    operations:[
      {
        id:"targets",
        kind:"targeting",
        harmful:true,
        rule:{ kind:"creature", rangeFeet:30, minTargets:1, maxTargets:1, allowedRelations:["enemy"], requiresSight:true, directTarget:true },
        targets:[{ id:"goblin", kind:"creature", relation:"enemy", distanceFeet:5, visible:true, cover:"half" }],
      },
      { id:"action", kind:"use-economy", slot:"action" },
      {
        id:"attack",
        kind:"d20",
        targetId:"goblin",
        request:{
          family:"attack-roll",
          target:12,
          modifierContributions:[{ source:"attack-modifier", value:5 }],
          dice:{ id:"attack-d20", purpose:"attack", sides:20, faces:[20] },
        },
        cover:{ targetingOperationId:"targets", targetId:"goblin", appliesTo:"ac" },
        condition:{ distanceToTargetFeet:5, actorCanSeeTarget:true, targetCanSeeActor:true },
      },
      {
        id:"damage-roll",
        kind:"damage-roll",
        criticalFrom:"attack",
        request:{
          dice:[{ source:"longsword", sides:8, count:1, faces:[6,7] }],
          flat:[{ source:"strength", value:3 }],
        },
      },
      {
        id:"damage",
        kind:"damage",
        targetId:"goblin",
        damageType:"slashing",
        amount:{ operationId:"damage-roll", field:"total" },
        creatureKind:"monster",
        criticalFrom:"attack",
      },
    ],
  };

  const resolved = resolvePendingResolution(TEST_PROFILE, state, pending);
  assert.equal(resolved.status, "committed");
  if (resolved.status !== "committed") return;
  assert.equal(resolved.state.revision, 1);
  assert.equal(resolved.state.combatants.hero.economy.action, false);
  assert.equal(resolved.state.combatants.goblin.life.hp.current, 14);
  assert.equal((resolved.results.attack as { critical:boolean }).critical, true);
  assert.equal((resolved.results["damage-roll"] as { rolledCount?:number; dice:Array<{rolledCount:number}> }).dice[0].rolledCount, 2);
  assert.equal((resolved.results["damage-roll"] as { total:number }).total, 16);
  assert.equal(resolved.events.length, 5);
  assert.equal(resolved.state.history.length, 5);
});

test("a later failure rolls back every earlier state mutation and emits no partial events", () => {
  const state = runtimeState();
  const pending:PendingResolution = {
    id:"rollback",
    actorId:"hero",
    sourceId:"test",
    expectedRevision:0,
    operations:[
      { id:"action", kind:"use-economy", slot:"action" },
      { id:"overspend", kind:"spend-resource", resourceId:"spell-slot-1", amount:3 },
    ],
  };
  const resolved = resolvePendingResolution(TEST_PROFILE, state, pending);
  assert.equal(resolved.status, "rejected");
  assert.equal(resolved.failedOperationId, "overspend");
  assert.equal(resolved.state, state);
  assert.equal(state.revision, 0);
  assert.equal(state.combatants.hero.economy.action, true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
  assert.deepEqual(resolved.events, []);
});

test("effect ResolutionEvents retain before/after payloads for safe inverse", () => {
  const state = runtimeState();
  const pending:PendingResolution = {
    id:"effect-payloads",
    actorId:"hero",
    sourceId:"effect:test",
    expectedRevision:0,
    operations:[
      {
        id:"apply",
        kind:"apply-effect",
        effect:{
          id:"tracked-effect",
          sourceId:"effect:test",
          targetId:"hero",
          kind:"marker",
          duration:{ kind:"permanent" },
        },
      },
      {
        id:"update",
        kind:"update-effect",
        effectId:"tracked-effect",
        metadataPatch:{ phase:"updated" },
      },
      {
        id:"remove",
        kind:"remove-effect",
        effectId:"tracked-effect",
      },
    ],
  };

  const committed = resolvePendingResolution(TEST_PROFILE, state, pending);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  assert.equal(committed.state.effects.some((effect) => effect.id === "tracked-effect"), false);

  const added = committed.events[0].stateChanges.find((change) => change.kind === "effect");
  assert.ok(added && added.kind === "effect");
  assert.equal(added.operation, "added");
  assert.equal(added.before, undefined);
  assert.equal(added.after?.id, "tracked-effect");
  assert.equal(added.after?.metadata, undefined);

  const updated = committed.events[1].stateChanges.find((change) => change.kind === "effect");
  assert.ok(updated && updated.kind === "effect");
  assert.equal(updated.operation, "updated");
  assert.equal(updated.before?.id, "tracked-effect");
  assert.equal(updated.before?.metadata, undefined);
  assert.deepEqual(updated.after?.metadata, { phase:"updated" });

  const removed = committed.events[2].stateChanges.find((change) => change.kind === "effect");
  assert.ok(removed && removed.kind === "effect");
  assert.equal(removed.operation, "removed");
  assert.deepEqual(removed.before?.metadata, { phase:"updated" });
  assert.equal(removed.after, undefined);
});

test("damage to a concentrator requires fixed save input and failed save removes its whole effect group", () => {
  const state = runtimeState();
  state.effects.push(createEffect({
    id:"concentrated-effect",
    sourceId:"spell:concentration",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:"hero:conc",
  }, state.clock));
  state.concentration.hero = { actorId:"hero", groupId:"hero:conc", sourceId:"spell:concentration" };

  const missingCheck:PendingResolution = {
    id:"missing-con-check",
    actorId:"goblin",
    sourceId:"attack",
    expectedRevision:0,
    operations:[{
      id:"damage",
      kind:"damage",
      targetId:"hero",
      damageType:"slashing",
      amount:8,
      creatureKind:"character",
    }],
  };
  const rejected = resolvePendingResolution(TEST_PROFILE, state, missingCheck);
  assert.equal(rejected.status, "rejected");
  assert.equal(state.combatants.hero.life.hp.current, 20);
  assert.equal(state.concentration.hero?.groupId, "hero:conc");
  assert.equal(state.effects.length, 1);

  const withCheck:PendingResolution = {
    ...missingCheck,
    id:"failed-con-check",
    operations:[{
      ...missingCheck.operations[0],
      id:"damage",
      kind:"damage",
      concentrationCheck:{
        dice:{ id:"con-save", purpose:"concentration", sides:20, faces:[3] },
        modifierContributions:[{ source:"constitution", value:2 }],
      },
    }],
  };
  const committed = resolvePendingResolution(TEST_PROFILE, state, withCheck);
  assert.equal(committed.status, "committed");
  if (committed.status !== "committed") return;
  assert.equal(committed.state.combatants.hero.life.hp.current, 12);
  assert.equal(committed.state.concentration.hero, undefined);
  assert.equal(committed.state.effects.some((effect) => effect.concentrationGroupId === "hero:conc"), false);
});

test("Incapacitated breaks Concentration, and sixth Exhaustion level is fatal", () => {
  const state = runtimeState();
  state.effects.push(createEffect({
    id:"old-conc-effect",
    sourceId:"spell:old",
    sourceActorId:"hero",
    targetId:"goblin",
    kind:"marker",
    duration:{ kind:"concentration" },
    concentrationGroupId:"old-conc",
  }, state.clock));
  state.concentration.hero = { actorId:"hero", groupId:"old-conc", sourceId:"spell:old" };

  const incapacitate:PendingResolution = {
    id:"stun",
    actorId:"goblin",
    sourceId:"effect:stun",
    expectedRevision:0,
    operations:[{
      id:"stun-effect",
      kind:"apply-effect",
      effect:{
        id:"stunned",
        sourceId:"effect:stun",
        sourceActorId:"goblin",
        targetId:"hero",
        kind:"condition",
        conditionId:"stunned",
        duration:{ kind:"rounds", amount:1, anchorActorId:"hero", boundary:"end" },
      },
    }],
  };
  const stunned = resolvePendingResolution(TEST_PROFILE, state, incapacitate);
  assert.equal(stunned.status, "committed");
  if (stunned.status !== "committed") return;
  assert.equal(stunned.state.concentration.hero, undefined);
  assert.equal(stunned.state.effects.some((effect) => effect.id === "old-conc-effect"), false);
  assert.equal(stunned.state.effects.some((effect) => effect.id === "stunned"), true);

  const fresh = runtimeState();
  const exhaustion:PendingResolution = {
    id:"exhaustion-six",
    actorId:"hero",
    sourceId:"hazard",
    expectedRevision:0,
    operations:Array.from({ length:6 }, (_, index) => ({
      id:`exhaustion-${index + 1}`,
      kind:"apply-effect" as const,
      effect:{
        id:`exhaustion-${index + 1}`,
        sourceId:"hazard",
        targetId:"hero",
        kind:"condition" as const,
        conditionId:"exhaustion" as const,
        duration:{ kind:"permanent" as const },
      },
    })),
  };
  const dead = resolvePendingResolution(TEST_PROFILE, fresh, exhaustion);
  assert.equal(dead.status, "committed");
  if (dead.status !== "committed") return;
  assert.equal(dead.state.combatants.hero.life.dead, true);
  assert.equal(dead.state.effects.filter((effect) => effect.conditionId === "exhaustion").length, 6);
});

test("turn boundary expiry happens before economy refresh and Frightened movement can reject atomically", () => {
  const state = runtimeState();
  state.effects.push(createEffect({
    id:"until-turn-start",
    sourceId:"effect:stun",
    targetId:"hero",
    kind:"condition",
    conditionId:"stunned",
    duration:{ kind:"until-turn-boundary", actorId:"hero", round:2, boundary:"start" },
  }, state.clock));
  state.combatants.hero.economy = {
    action:false,
    bonusAction:false,
    reaction:false,
    movement:0,
    movementMaximum:30,
  };
  const begin:PendingResolution = {
    id:"turn-start",
    actorId:"hero",
    sourceId:"turn",
    expectedRevision:0,
    operations:[{ id:"begin", kind:"begin-turn", actorId:"hero", round:2 }],
  };
  const refreshed = resolvePendingResolution(TEST_PROFILE, state, begin);
  assert.equal(refreshed.status, "committed");
  if (refreshed.status !== "committed") return;
  assert.equal(refreshed.state.effects.some((effect) => effect.id === "until-turn-start"), false);
  assert.equal(refreshed.state.combatants.hero.economy.action, true);
  assert.equal(refreshed.state.combatants.hero.economy.reaction, true);
  assert.equal(refreshed.state.combatants.hero.resources.find((pool) => pool.id === "turn-resource")?.current, 1);
  const expired = refreshed.events[0].stateChanges.find((change) => change.kind === "effect");
  assert.ok(expired && expired.kind === "effect");
  assert.equal(expired.operation, "removed");
  assert.equal(expired.before?.id, "until-turn-start");
  assert.equal(expired.after, undefined);

  const feared = runtimeState();
  feared.effects.push(createEffect({
    id:"fear",
    sourceId:"dragon:fear",
    sourceActorId:"goblin",
    targetId:"hero",
    kind:"condition",
    conditionId:"frightened",
    duration:{ kind:"minutes", amount:1 },
  }, feared.clock));
  const move:PendingResolution = {
    id:"fear-move",
    actorId:"hero",
    sourceId:"move",
    expectedRevision:0,
    operations:[{
      id:"move",
      kind:"move",
      distanceFeet:5,
      destinationMovesCloserToVisibleFrighteningSource:true,
      visibleSourceIds:["goblin"],
    }],
  };
  const blocked = resolvePendingResolution(TEST_PROFILE, feared, move);
  assert.equal(blocked.status, "rejected");
  assert.match(blocked.error, /Frightened/);
  assert.equal(feared.combatants.hero.economy.movement, 30);
});
