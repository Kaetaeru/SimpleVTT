import assert from "node:assert/strict";
import test from "node:test";
import {
  FIGHTER_ACTION_SURGE_RESOURCE_ID,
  FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID,
  FIGHTER_ID,
  coreClassResourceDefinitions,
  fighterActionSurgeMaximum,
} from "../../src/domain/coreClassResources";
import { resolveFighterActionSurge } from "../../src/domain/fighterActionSurge";
import { resolvePendingResolution } from "../../src/domain/resolution";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

function fighterState(level: number) {
  const state = runtimeState();
  state.clock.activeActorId = "hero";
  state.clock.phase = "action";
  state.combatants.hero.resources.push(...coreClassResourceDefinitions([
    { classId:FIGHTER_ID, className:"파이터", level },
  ]).map((definition) => ({
    id:definition.resourceId,
    label:definition.label,
    current:definition.maximum,
    maximum:definition.maximum,
    recovery:definition.recovery,
  })));
  return state;
}

function useAction(state: ReturnType<typeof runtimeState>, id: string, sourceId: string, actionKind?: "magic" | "other") {
  return resolvePendingResolution(TEST_PROFILE, state, {
    id,
    actorId:"hero",
    sourceId,
    expectedRevision:state.revision,
    operations:[{
      id:`${id}:action`,
      kind:"use-economy",
      actorId:"hero",
      slot:"action",
      actionKind,
    }],
  });
}

test("Action Surge uses follow the exact Fighter table and project a same-turn gate", () => {
  for (const [level, expected] of [[0,0],[1,0],[2,1],[16,1],[17,2],[20,2]] as const) {
    assert.equal(fighterActionSurgeMaximum(level), expected, `Fighter ${level}`);
  }
  const definitions = coreClassResourceDefinitions([
    { classId:FIGHTER_ID, className:"파이터", level:17 },
  ]);
  const surge = definitions.find((entry) => entry.resourceId === FIGHTER_ACTION_SURGE_RESOURCE_ID);
  const gate = definitions.find((entry) => entry.resourceId === FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID);
  assert.deepEqual({ maximum:surge?.maximum, recovery:surge?.recovery }, {
    maximum:2,
    recovery:{ shortRest:"all", longRest:"all" },
  });
  assert.deepEqual({ maximum:gate?.maximum, recovery:gate?.recovery }, {
    maximum:1,
    recovery:{ turnStart:"all" },
  });
});

test("Action Surge grants one non-Magic extra Action and level 17 cannot surge twice on the same turn", () => {
  const state = fighterState(17);
  const first = resolveFighterActionSurge(TEST_PROFILE, state, {
    id:"fighter.action-surge.first",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:17,
  });
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  assert.equal(first.state.combatants.hero.resources.find((entry) => entry.id === FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current, 1);
  assert.equal(first.state.combatants.hero.resources.find((entry) => entry.id === FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current, 0);
  assert.equal(first.state.combatants.hero.economy.action, true, "Action Surge must not spend the normal Action");
  assert.equal(first.state.combatants.hero.economy.extraActions?.length, 1);
  assert.equal(first.state.combatants.hero.economy.extraActions?.[0]?.allowsMagicAction, false);

  const second = resolveFighterActionSurge(TEST_PROFILE, first.state, {
    id:"fighter.action-surge.second",
    actorId:"hero",
    expectedRevision:first.state.revision,
    fighterLevel:17,
  });
  assert.equal(second.status, "rejected");
  assert.equal(second.state, first.state, "same-turn gate failure must roll back the attempted second resource spend");
  assert.equal(first.state.combatants.hero.resources.find((entry) => entry.id === FIGHTER_ACTION_SURGE_RESOURCE_ID)?.current, 1);
});

test("a non-Magic action consumes the restricted extra credit first, preserving the normal Action for a later spell", () => {
  const state = fighterState(5);
  const surged = resolveFighterActionSurge(TEST_PROFILE, state, {
    id:"fighter.action-surge.sequence",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
  });
  assert.equal(surged.status, "committed");
  if (surged.status !== "committed") return;

  const attack = useAction(surged.state, "fighter.attack", "action:fighter.attack", "other");
  assert.equal(attack.status, "committed");
  if (attack.status !== "committed") return;
  assert.equal(attack.state.combatants.hero.economy.action, true, "restricted extra Action should be spent before the versatile normal Action");
  assert.equal(attack.state.combatants.hero.economy.extraActions?.length, 0);
  assert.match(String((attack.results["fighter.attack:action"] as { spentFrom?:string }).spentFrom), /action-surge/);

  const spell = useAction(attack.state, "fighter.magic", "dnd.srd521.spell.fire-bolt");
  assert.equal(spell.status, "committed");
  if (spell.status !== "committed") return;
  assert.equal(spell.state.combatants.hero.economy.action, false);
  assert.equal((spell.results["fighter.magic:action"] as { actionKind?:string }).actionKind, "magic", "spell source IDs must classify their Action as Magic");
});

test("Action Surge cannot supply the Action for a Magic Action after the normal Action is already spent", () => {
  const state = fighterState(5);
  state.combatants.hero.economy.action = false;
  const surged = resolveFighterActionSurge(TEST_PROFILE, state, {
    id:"fighter.action-surge.after-action",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:5,
  });
  assert.equal(surged.status, "committed");
  if (surged.status !== "committed") return;

  const spell = useAction(surged.state, "fighter.illegal-magic", "dnd.srd521.spell.fire-bolt");
  assert.equal(spell.status, "rejected");
  assert.match(spell.status === "rejected" ? spell.error : "", /Magic Action/);
  assert.equal(spell.state, surged.state, "rejected Magic Action must leave the restricted extra credit intact");
  assert.equal(surged.state.combatants.hero.economy.extraActions?.length, 1);

  const attack = useAction(surged.state, "fighter.legal-attack", "action:fighter.attack", "other");
  assert.equal(attack.status, "committed");
  if (attack.status !== "committed") return;
  assert.equal(attack.state.combatants.hero.economy.extraActions?.length, 0);
});

test("Action Surge is rejected outside the Fighter's turn and a new turn clears stale extra credits while recovering the turn gate", () => {
  const state = fighterState(17);
  state.clock.activeActorId = "goblin";
  const outOfTurn = resolveFighterActionSurge(TEST_PROFILE, state, {
    id:"fighter.action-surge.out-of-turn",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:17,
  });
  assert.equal(outOfTurn.status, "rejected");
  assert.equal(outOfTurn.state, state);

  state.clock.activeActorId = "hero";
  const surged = resolveFighterActionSurge(TEST_PROFILE, state, {
    id:"fighter.action-surge.before-next-turn",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:17,
  });
  assert.equal(surged.status, "committed");
  if (surged.status !== "committed") return;
  const nextTurn = resolvePendingResolution(TEST_PROFILE, surged.state, {
    id:"fighter.next-turn",
    actorId:"hero",
    sourceId:"turn:start",
    expectedRevision:surged.state.revision,
    operations:[{
      id:"fighter.next-turn:begin",
      kind:"begin-turn",
      actorId:"hero",
      round:2,
    }],
  });
  assert.equal(nextTurn.status, "committed");
  if (nextTurn.status !== "committed") return;
  assert.equal(nextTurn.state.combatants.hero.economy.extraActions?.length, 0);
  assert.equal(nextTurn.state.combatants.hero.resources.find((entry) => entry.id === FIGHTER_ACTION_SURGE_TURN_RESOURCE_ID)?.current, 1);
});
