import assert from "node:assert/strict";
import test from "node:test";
import { FIGHTER_CHAMPION_SUBCLASS_ID } from "../../src/domain/fighterChampion";
import {
  championRemarkableAthleteAdvantage,
  resolveChampionDeathSave,
  resolveChampionInitiativeRoll,
  resolveChampionTurnStart,
} from "../../src/domain/fighterChampionRuntime";
import { HEROIC_INSPIRATION_RESOURCE_ID } from "../../src/domain/heroicInspiration";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const CHAMPION = FIGHTER_CHAMPION_SUBCLASS_ID;

test("Remarkable Athlete gives Initiative and Athletics advantage through generic roll-state contributions", () => {
  assert.deepEqual(championRemarkableAthleteAdvantage({ fighterLevel:3, subclassId:CHAMPION, test:"athletics" }),{
    source:"feature:fighter.champion.remarkable-athlete:athletics",
    state:"advantage",
  });
  const initiative = resolveChampionInitiativeRoll(TEST_PROFILE,{
    fighterLevel:3,
    subclassId:CHAMPION,
    id:"hero",
    controller:"player",
    dice:{ id:"champion-initiative", purpose:"Initiative", sides:20, faces:[5,17] },
    modifierContributions:[{ source:"dexterity", value:2 }],
  });
  assert.equal(initiative.rollState,"advantage");
  assert.equal(initiative.natural,17);
  assert.equal(initiative.entry.total,19);
});

test("Survivor death saves have advantage and treat natural 18-20 as natural 20", () => {
  const state = runtimeState();
  state.combatants.hero.life.hp.current = 0;
  state.combatants.hero.life.unconscious = true;
  const result = resolveChampionDeathSave(TEST_PROFILE,{
    fighterLevel:18,
    subclassId:CHAMPION,
    life:state.combatants.hero.life,
    dice:{ id:"champion-death-save", purpose:"Death save", sides:20, faces:[4,18] },
  });
  assert.equal(result.natural,18);
  assert.equal(result.treatedNatural,20);
  assert.equal(result.outcome,"revived");
  assert.equal(result.next.hp.current,1);
  assert.equal(result.next.unconscious,false);
  assert.deepEqual(result.next.deathSaves,{ successes:0, failures:0 });
  assert.ok(result.provenance.some((entry) => entry.source === "feature:fighter.champion.survivor.defy-death"));
});

test("Heroic Warrior can grant missing Heroic Inspiration at the start of a Champion turn", () => {
  const state = runtimeState();
  const result = resolveChampionTurnStart(TEST_PROFILE,state,{
    id:"champion.turn.heroic-warrior",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:10,
    subclassId:CHAMPION,
    round:2,
    constitutionModifier:3,
    claimHeroicInspiration:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  const inspiration = result.state.combatants.hero.resources.find((pool) => pool.id === HEROIC_INSPIRATION_RESOURCE_ID);
  assert.deepEqual({ current:inspiration?.current, maximum:inspiration?.maximum },{ current:1, maximum:1 });
  assert.equal(result.state.clock.activeActorId,"hero");
  assert.equal(result.state.clock.round,2);
});

test("Heroic Warrior does not overfill existing Heroic Inspiration", () => {
  const state = runtimeState();
  state.combatants.hero.resources.push({ id:HEROIC_INSPIRATION_RESOURCE_ID, label:"Heroic Inspiration", current:1, maximum:1 });
  const result = resolveChampionTurnStart(TEST_PROFILE,state,{
    id:"champion.turn.inspiration-full",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:10,
    subclassId:CHAMPION,
    round:2,
    constitutionModifier:3,
    claimHeroicInspiration:true,
  });
  assert.equal(result.status,"committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === HEROIC_INSPIRATION_RESOURCE_ID)?.current,1);
});

test("Heroic Rally heals 5 + Constitution modifier only while Bloodied and above 0 HP", () => {
  const bloodied = runtimeState();
  bloodied.combatants.hero.life.hp = { current:8, maximum:20, temporary:0 };
  const healed = resolveChampionTurnStart(TEST_PROFILE,bloodied,{
    id:"champion.turn.rally",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:18,
    subclassId:CHAMPION,
    round:2,
    constitutionModifier:3,
  });
  assert.equal(healed.status,"committed");
  if (healed.status !== "committed") return;
  assert.equal(healed.state.combatants.hero.life.hp.current,16);

  const healthy = runtimeState();
  healthy.combatants.hero.life.hp = { current:11, maximum:20, temporary:0 };
  const noHealthyHeal = resolveChampionTurnStart(TEST_PROFILE,healthy,{
    id:"champion.turn.healthy",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:18,
    subclassId:CHAMPION,
    round:2,
    constitutionModifier:3,
  });
  assert.equal(noHealthyHeal.status,"committed");
  if (noHealthyHeal.status === "committed") assert.equal(noHealthyHeal.state.combatants.hero.life.hp.current,11);

  const zero = runtimeState();
  zero.combatants.hero.life.hp = { current:0, maximum:20, temporary:0 };
  zero.combatants.hero.life.unconscious = true;
  const noZeroHeal = resolveChampionTurnStart(TEST_PROFILE,zero,{
    id:"champion.turn.zero",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:18,
    subclassId:CHAMPION,
    round:2,
    constitutionModifier:3,
  });
  assert.equal(noZeroHeal.status,"committed");
  if (noZeroHeal.status === "committed") assert.equal(noZeroHeal.state.combatants.hero.life.hp.current,0);
});

test("Champion lifecycle wrappers reject non-Champion or premature access", () => {
  assert.throws(() => championRemarkableAthleteAdvantage({ fighterLevel:3, subclassId:"other", test:"initiative" }),/requires the Champion subclass/);
  const state = runtimeState();
  const premature = resolveChampionTurnStart(TEST_PROFILE,state,{
    id:"champion.turn.premature",
    actorId:"hero",
    expectedRevision:0,
    fighterLevel:9,
    subclassId:CHAMPION,
    round:1,
    constitutionModifier:2,
  });
  assert.equal(premature.status,"rejected");
  assert.equal(premature.state,state);
});
