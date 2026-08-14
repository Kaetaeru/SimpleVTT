import assert from "node:assert/strict";
import test from "node:test";
import { createEffect } from "../../src/domain/effects";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function marker(args: {
  id:string;
  targetId:string;
  sourceActorId?:string;
  termination:{
    targetTakesDamage?:boolean;
    targetBecomesIncapacitated?:boolean;
    targetDies?:boolean;
    sourceBecomesIncapacitated?:boolean;
    sourceDies?:boolean;
  };
}) {
  return createEffect({
    id:args.id,
    sourceId:`test:${args.id}`,
    sourceActorId:args.sourceActorId,
    targetId:args.targetId,
    kind:"marker",
    tags:["termination-test"],
    duration:{ kind:"hours", amount:1 },
    termination:args.termination,
  }, { round:1, elapsedSeconds:0 });
}

test("positive damage ends only effects whose targetTakesDamage trigger matches the damaged creature", () => {
  const state = runtimeState();
  state.effects.push(
    marker({ id:"break-on-goblin-damage", targetId:"goblin", termination:{ targetTakesDamage:true } }),
    marker({ id:"unrelated-hero-damage", targetId:"hero", termination:{ targetTakesDamage:true } }),
    marker({ id:"persistent-goblin", targetId:"goblin", termination:{} }),
  );
  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"effect-termination.damage",
    actorId:"hero",
    sourceId:"test:damage",
    expectedRevision:0,
    operations:[{
      id:"damage",
      kind:"damage",
      targetId:"goblin",
      damageType:"force",
      amount:1,
      creatureKind:"monster",
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.effects.some((effect) => effect.id === "break-on-goblin-damage"), false);
  assert.equal(result.state.effects.some((effect) => effect.id === "unrelated-hero-damage"), true);
  assert.equal(result.state.effects.some((effect) => effect.id === "persistent-goblin"), true);
  assert.ok(result.events[0].stateChanges.some((change) => change.kind === "effect" && change.effectId === "break-on-goblin-damage" && change.action === "removed"));
});

test("applying Stunned ends effects sourced by that creature when sourceBecomesIncapacitated is declared", () => {
  const state = runtimeState();
  state.effects.push(marker({
    id:"source-incapacitated",
    targetId:"goblin",
    sourceActorId:"hero",
    termination:{ sourceBecomesIncapacitated:true },
  }));
  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"effect-termination.stunned",
    actorId:"goblin",
    sourceId:"test:stun",
    expectedRevision:0,
    operations:[{
      id:"stun-hero",
      kind:"apply-effect",
      effect:{
        id:"hero-stunned",
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
  assert.equal(result.state.effects.some((effect) => effect.id === "source-incapacitated"), false);
  assert.equal(result.state.effects.some((effect) => effect.id === "hero-stunned"), true);
});

test("damage that drops a character to 0 HP ends sourceBecomesIncapacitated effects even without an explicit condition effect", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp.current = 5;
  state.effects.push(marker({
    id:"source-unconscious",
    targetId:"goblin",
    sourceActorId:"hero",
    termination:{ sourceBecomesIncapacitated:true },
  }));
  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"effect-termination.zero-hp",
    actorId:"goblin",
    sourceId:"test:zero-hp",
    expectedRevision:0,
    operations:[{
      id:"damage-hero",
      kind:"damage",
      targetId:"hero",
      damageType:"force",
      amount:5,
      creatureKind:"character",
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.life.unconscious, true);
  assert.equal(result.state.effects.some((effect) => effect.id === "source-unconscious"), false);
});

test("death can independently terminate target and source relationships", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp.current = 3;
  state.effects.push(
    marker({ id:"target-dies", targetId:"goblin", termination:{ targetDies:true } }),
    marker({ id:"source-dies", targetId:"hero", sourceActorId:"goblin", termination:{ sourceDies:true } }),
  );
  const result = resolvePendingResolution(TEST_PROFILE, state, {
    id:"effect-termination.death",
    actorId:"hero",
    sourceId:"test:death",
    expectedRevision:0,
    operations:[{
      id:"kill-goblin",
      kind:"damage",
      targetId:"goblin",
      damageType:"force",
      amount:3,
      creatureKind:"monster",
    }],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.dead, true);
  assert.equal(result.state.effects.some((effect) => effect.id === "target-dies"), false);
  assert.equal(result.state.effects.some((effect) => effect.id === "source-dies"), false);
});
