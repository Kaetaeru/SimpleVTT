import assert from "node:assert/strict";
import test from "node:test";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";
import { resolveSpellCast, type SpellCasterContext, type SpellCastTarget } from "../../src/domain/spellcasting";
import { runtimeState, TEST_PROFILE } from "./rulesTestState";

const FIRE_BOLT = "dnd.srd521.spell.fire-bolt";
const SACRED_FLAME = "dnd.srd521.spell.sacred-flame";
const HEALING_WORD = "dnd.srd521.spell.healing-word";
const CURE_WOUNDS = "dnd.srd521.spell.cure-wounds";
const BURNING_HANDS = "dnd.srd521.spell.burning-hands";
const MAGIC_MISSILE = "dnd.srd521.spell.magic-missile";

function caster(overrides: Partial<SpellCasterContext> = {}): SpellCasterContext {
  return {
    characterLevel: 5,
    spellAttackModifier: 5,
    spellSaveDc: 14,
    spellcastingAbilityModifier: 3,
    preparedSpellIds: [HEALING_WORD, CURE_WOUNDS, BURNING_HANDS, MAGIC_MISSILE],
    alwaysPreparedSpellIds: [],
    cantripSpellIds: [FIRE_BOLT, SACRED_FLAME],
    slotResourceIds: { 1: "spell-slot-1", 2: "spell-slot-2" },
    ...overrides,
  };
}

function target(
  id: string,
  overrides: Partial<SpellCastTarget> = {},
): SpellCastTarget {
  return {
    id,
    kind: "creature",
    relation: "enemy",
    distanceFeet: 30,
    visible: true,
    cover: "none",
    ac: 12,
    creatureKind: "monster",
    saveModifiers: { str: 0, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
    targetCanSeeCaster: true,
    ...overrides,
  };
}

function addSecondLevelSlot(state: ReturnType<typeof runtimeState>, current = 1) {
  state.combatants.hero.resources.push({
    id: "spell-slot-2",
    label: "2레벨 주문 슬롯",
    current,
    maximum: 1,
    recovery: { longRest: "all" },
  });
}

test("Fire Bolt compiles a real ranged spell attack, cover-adjusted AC, cantrip scaling, and critical-capable damage", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current: 30, maximum: 30, temporary: 0 };
  const result = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[FIRE_BOLT], state, {
    id: "cast.fire-bolt",
    actorId: "hero",
    spellId: FIRE_BOLT,
    source: "prepared",
    expectedRevision: 0,
    caster: caster(),
    targets: [target("goblin", { cover: "half", ac: 12 })],
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "round-1:hero",
    dice: {
      attack: { id: "fire-bolt-attack", purpose: "spell attack", sides: 20, faces: [9] },
      effectFaces: [6, 7],
    },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const attack = result.results["cast.fire-bolt:attack:goblin"] as { total: number; target: number; outcome: string };
  assert.equal(attack.total, 14);
  assert.equal(attack.target, 14, "Half Cover must add +2 AC");
  assert.equal(attack.outcome, "success");
  assert.equal((result.results["cast.fire-bolt:damage-roll"] as { total: number }).total, 13, "level 5 Fire Bolt uses 2d10");
  assert.equal(result.state.combatants.goblin.life.hp.current, 17);
  assert.equal(result.state.combatants.hero.economy.action, false);
  assert.equal(result.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2, "cantrip spends no slot");
});

test("Sacred Flame ignores Half/Three-Quarters Cover on its Dexterity save and deals no damage on success", () => {
  const state = runtimeState();
  const result = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[SACRED_FLAME], state, {
    id: "cast.sacred-flame",
    actorId: "hero",
    spellId: SACRED_FLAME,
    source: "prepared",
    expectedRevision: 0,
    caster: caster({ characterLevel: 1 }),
    targets: [target("goblin", { cover: "half", saveModifiers: { dex: 1 } })],
    componentsSatisfied: true,
    useActionEconomy: false,
    dice: {
      saves: { goblin: { id: "sacred-save", purpose: "dex save", sides: 20, faces: [12] } },
      effectFaces: [8],
    },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  const save = result.results["cast.sacred-flame:save:goblin"] as { total: number; outcome: string };
  assert.equal(save.total, 13, "cover bonus must not be added to Sacred Flame's save");
  assert.equal(save.outcome, "failure");
  assert.equal(result.state.combatants.goblin.life.hp.current, 7);
});

test("Healing Word upcasts from a selected slot, spends Bonus Action and slot atomically, and enforces one slotted spell per turn", () => {
  const state = runtimeState();
  addSecondLevelSlot(state, 1);
  state.combatants.goblin.life.hp = { current: 2, maximum: 20, temporary: 0 };
  const first = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[HEALING_WORD], state, {
    id: "cast.healing-word",
    actorId: "hero",
    spellId: HEALING_WORD,
    source: "prepared",
    expectedRevision: 0,
    caster: caster(),
    targets: [target("goblin", { relation: "ally" })],
    slotLevel: 2,
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "round-1:hero",
    dice: { effectFaces: [1, 2, 3, 4] },
  });
  assert.equal(first.status, "committed");
  if (first.status !== "committed") return;
  assert.equal((first.results["cast.healing-word:healing-roll"] as { total: number }).total, 13, "2nd-level 2024 Healing Word is 4d4 + spellcasting modifier");
  assert.equal(first.state.combatants.goblin.life.hp.current, 15);
  assert.equal(first.state.combatants.hero.economy.bonusAction, false);
  assert.equal(first.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-2")?.current, 0);

  const second = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[CURE_WOUNDS], first.state, {
    id: "cast.cure-wounds.same-turn",
    actorId: "hero",
    spellId: CURE_WOUNDS,
    source: "prepared",
    expectedRevision: first.state.revision,
    caster: caster(),
    targets: [target("hero", { relation: "self", distanceFeet: 0, creatureKind: "character" })],
    slotLevel: 1,
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "round-1:hero",
    dice: { effectFaces: [5, 6] },
  });
  assert.equal(second.status, "rejected");
  assert.match(second.status === "rejected" ? second.error : "", /already expended a spell slot/);
  assert.equal(second.state, first.state, "one-slot-per-turn rejection must roll back the entire second cast");
  assert.equal(first.state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
});

test("a cantrip can still be cast after a slotted spell on the same turn when an Action remains", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current: 10, maximum: 20, temporary: 0 };
  const healing = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[HEALING_WORD], state, {
    id: "cast.slot-first",
    actorId: "hero",
    spellId: HEALING_WORD,
    source: "prepared",
    expectedRevision: 0,
    caster: caster(),
    targets: [target("goblin", { relation: "ally" })],
    slotLevel: 1,
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "turn-a",
    dice: { effectFaces: [2, 2] },
  });
  assert.equal(healing.status, "committed");
  if (healing.status !== "committed") return;

  const cantrip = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[SACRED_FLAME], healing.state, {
    id: "cast.cantrip-after-slot",
    actorId: "hero",
    spellId: SACRED_FLAME,
    source: "prepared",
    expectedRevision: healing.state.revision,
    caster: caster({ characterLevel: 1 }),
    targets: [target("goblin")],
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "turn-a",
    dice: {
      saves: { goblin: { id: "save", purpose: "save", sides: 20, faces: [3] } },
      effectFaces: [5],
    },
  });
  assert.equal(cantrip.status, "committed");
  if (cantrip.status !== "committed") return;
  assert.equal(cantrip.state.combatants.hero.economy.action, false);
});

test("Burning Hands uses one shared upcast damage roll and applies half damage to successful Dexterity saves", () => {
  const state = runtimeState();
  addSecondLevelSlot(state, 1);
  state.combatants.goblin.life.hp = { current: 30, maximum: 30, temporary: 0 };
  state.combatants.orc = structuredClone(state.combatants.goblin);
  state.combatants.orc.id = "orc";
  state.combatants.orc.life.hp = { current: 30, maximum: 30, temporary: 0 };

  const result = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[BURNING_HANDS], state, {
    id: "cast.burning-hands",
    actorId: "hero",
    spellId: BURNING_HANDS,
    source: "prepared",
    expectedRevision: 0,
    caster: caster(),
    targets: [
      target("goblin", { distanceFeet: 10, cover: "none" }),
      target("orc", { distanceFeet: 12, cover: "none" }),
    ],
    slotLevel: 2,
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "burning-turn",
    dice: {
      saves: {
        goblin: { id: "goblin-save", purpose: "dex save", sides: 20, faces: [5] },
        orc: { id: "orc-save", purpose: "dex save", sides: 20, faces: [18] },
      },
      effectFaces: [6, 5, 4, 3],
    },
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal((result.results["cast.burning-hands:damage-roll"] as { total: number }).total, 18);
  assert.equal(result.state.combatants.goblin.life.hp.current, 12, "failed save takes full 18");
  assert.equal(result.state.combatants.orc.life.hp.current, 21, "successful save takes floor(18/2) = 9");
});

test("Magic Missile allocates every dart explicitly and higher-slot projectile count is validated", () => {
  const state = runtimeState();
  state.combatants.goblin.life.hp = { current: 30, maximum: 30, temporary: 0 };
  state.combatants.orc = structuredClone(state.combatants.goblin);
  state.combatants.orc.id = "orc";
  const result = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[MAGIC_MISSILE], state, {
    id: "cast.magic-missile",
    actorId: "hero",
    spellId: MAGIC_MISSILE,
    source: "item",
    expectedRevision: 0,
    caster: caster(),
    targets: [target("goblin"), target("orc")],
    componentsSatisfied: true,
    useActionEconomy: false,
    dice: { projectileFaces: [1, 4, 2] },
    projectileAllocations: [
      { targetId: "goblin", count: 2 },
      { targetId: "orc", count: 1 },
    ],
  });
  assert.equal(result.status, "committed");
  if (result.status !== "committed") return;
  assert.equal(result.state.combatants.goblin.life.hp.current, 23, "two darts: (1+1)+(4+1) = 7");
  assert.equal(result.state.combatants.orc.life.hp.current, 27, "one dart: 2+1 = 3");
});

test("unprepared spells and unsatisfied components reject before economy, slot, HP, or history can mutate", () => {
  const state = runtimeState();
  const unprepared = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[HEALING_WORD], state, {
    id: "cast.unprepared",
    actorId: "hero",
    spellId: HEALING_WORD,
    source: "prepared",
    expectedRevision: 0,
    caster: caster({ preparedSpellIds: [] }),
    targets: [target("hero", { relation: "self", distanceFeet: 0, creatureKind: "character" })],
    slotLevel: 1,
    componentsSatisfied: true,
    useActionEconomy: true,
    turnId: "turn-x",
    dice: { effectFaces: [2, 3] },
  });
  assert.equal(unprepared.status, "rejected");
  assert.equal(unprepared.state, state);

  const noComponents = resolveSpellCast(TEST_PROFILE, SRD_521_SPELL_MECHANICS[HEALING_WORD], state, {
    id: "cast.no-components",
    actorId: "hero",
    spellId: HEALING_WORD,
    source: "prepared",
    expectedRevision: 0,
    caster: caster(),
    targets: [target("hero", { relation: "self", distanceFeet: 0, creatureKind: "character" })],
    slotLevel: 1,
    componentsSatisfied: false,
    useActionEconomy: true,
    turnId: "turn-x",
    dice: { effectFaces: [2, 3] },
  });
  assert.equal(noComponents.status, "rejected");
  assert.equal(noComponents.state, state);
  assert.equal(state.combatants.hero.economy.action, true);
  assert.equal(state.combatants.hero.resources.find((pool) => pool.id === "spell-slot-1")?.current, 2);
  assert.equal(state.history.length, 0);
});

test("an identity-agnostic active Effect blocks spellcasting before economy, slot, or history can mutate", () => {
  const state=runtimeState();
  state.effects.push({
    id:"unknown.restriction:hero",
    sourceId:"unknown.external.restriction",
    sourceActorId:"hero",
    targetId:"hero",
    kind:"marker",
    tags:["unknown-tag"],
    expiry:{kind:"permanent"},
    metadata:{spellcastingAllowed:false,publicLabel:"Unknown restriction"},
  });

  const result=resolveSpellCast(TEST_PROFILE,SRD_521_SPELL_MECHANICS[HEALING_WORD],state,{
    id:"cast.raging.healing-word",
    actorId:"hero",
    spellId:HEALING_WORD,
    source:"prepared",
    expectedRevision:0,
    caster:caster({preparedSpellIds:[HEALING_WORD]}),
    targets:[target("hero",{relation:"self",distanceFeet:0,creatureKind:"character"})],
    slotLevel:1,
    componentsSatisfied:true,
    useActionEconomy:true,
    turnId:"round-1:hero",
    dice:{effectFaces:[2,3]},
  });

  assert.equal(result.status,"rejected");
  assert.match(result.status==="rejected"?result.error:"",/Unknown restriction prevents casting spells/);
  assert.equal(result.state,state);
  assert.equal(state.combatants.hero.economy.bonusAction,true);
  assert.equal(state.combatants.hero.resources.find((pool)=>pool.id==="spell-slot-1")?.current,2);
  assert.equal(state.history.length,0);
});
