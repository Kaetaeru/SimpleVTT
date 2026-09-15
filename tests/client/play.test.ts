/**
 * Offline-session operations on the runtime: damage through temp HP, healing, hit dice and rests, slots and pools,
 * gold and the bag (added items become attacks, equipping changes AC), conditions and death saves. Every operation
 * leaves a log line.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCharacter } from "../../client/character/derive";
import {
  addItem, adjustGold, applyDamage, applyHealing, grantTempHp, hitDiceAvailable, longRest, recordDeathSave, removeItem, restoreSpellSlot, setItemQuantity, shortRest, spendHitDie,
  toggleCondition, toggleEquip, usePactSlot, useResource, useSpellSlot,
} from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { build, catalog, ids } from "./support";

test("damage goes through temporary HP first, healing caps at the maximum, zero HP starts death saves", () => {
  const { derived } = build({ species: "dwarf", classes: "fighter", level: 3 });
  let runtime = initialRuntime(derived);
  runtime = grantTempHp(runtime, 5);
  runtime = grantTempHp(runtime, 3);
  assert.equal(runtime.hp.temp, 5, "temp HP does not stack");
  runtime = applyDamage(runtime, derived, 8);
  assert.equal(runtime.hp.temp, 0);
  assert.equal(runtime.hp.current, derived.hp.max - 3);
  runtime = applyHealing(runtime, derived, 100);
  assert.equal(runtime.hp.current, derived.hp.max);
  runtime = applyDamage(runtime, derived, 999);
  assert.equal(runtime.hp.current, 0);
  assert.ok(runtime.log.at(-1)?.text.includes("죽음 내성"));
  runtime = recordDeathSave(runtime, false);
  runtime = recordDeathSave(runtime, true);
  assert.deepEqual(runtime.deathSaves, { success: 1, failure: 1 });
  runtime = applyHealing(runtime, derived, 1);
  assert.deepEqual(runtime.deathSaves, { success: 0, failure: 0 }, "healing from 0 resets death saves");
  assert.ok(runtime.log.length >= 6);
});

test("hit dice heal roll + CON, a short rest restores short-rest pools and pact slots, a long rest restores everything and half the dice", () => {
  const { derived } = build({ classes: "fighter", level: 4, abilities: { con: 14 } }, { "origin.background.abilityPlus2": ["con"] });
  let runtime = initialRuntime(derived);
  runtime = applyDamage(runtime, derived, 20);
  runtime = useResource(runtime, derived, "resource.fighter.second-wind");
  runtime = useResource(runtime, derived, "resource.fighter.action-surge");
  const before = runtime.hp.current;
  runtime = spendHitDie(runtime, derived, "d10", 6);
  assert.equal(runtime.hp.current, before + 6 + derived.abilities.con.modifier);
  assert.deepEqual(hitDiceAvailable(runtime, derived), { d10: 3 });
  runtime = shortRest(runtime, derived, [{ die: "d10", roll: 1 }]);
  assert.deepEqual(hitDiceAvailable(runtime, derived), { d10: 2 });
  assert.equal(runtime.resourcesUsed["resource.fighter.second-wind"], 0, "second wind: one use back per short rest");
  assert.equal(runtime.resourcesUsed["resource.fighter.action-surge"], undefined, "action surge: all back on a short rest");
  runtime = longRest(runtime, derived);
  assert.equal(runtime.hp.current, derived.hp.max);
  assert.deepEqual(hitDiceAvailable(runtime, derived), { d10: 4 }, "2 spent, half of 4 = 2 restored");
  const warlock = build({ classes: "warlock", level: 3 }).derived;
  let pact = initialRuntime(warlock);
  pact = usePactSlot(pact, warlock);
  pact = usePactSlot(pact, warlock);
  pact = usePactSlot(pact, warlock);
  assert.equal(pact.pactSlotsUsed, 2, "cannot use more than the count");
  pact = shortRest(pact, warlock);
  assert.equal(pact.pactSlotsUsed, 0);
});

test("spell slots and resources are bounded; restoring past zero is a no-op", () => {
  const { derived } = build({ classes: "wizard", level: 3 });
  let runtime = initialRuntime(derived);
  for (let index = 0; index < 6; index += 1) runtime = useSpellSlot(runtime, derived, 1);
  assert.equal(runtime.slotsUsed[1], derived.spellSlots[1]);
  runtime = restoreSpellSlot(runtime, 1);
  assert.equal(runtime.slotsUsed[1], derived.spellSlots[1] - 1);
  const untouched = restoreSpellSlot(runtime, 3);
  assert.equal(untouched, runtime, "nothing to restore");
  const notAResource = useResource(runtime, derived, "resource.nope");
  assert.equal(notAResource, runtime);
});

test("bag: added catalog items become attacks and armor, custom items stay text, equipping changes AC, quantities and removal persist", () => {
  const { source, derived } = build({ classes: "wizard", level: 1, abilities: { dex: 14, str: 10 } }, { "equipment.class": ["A"] });
  let runtime = initialRuntime(derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.longsword", name: "장검" });
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.armor.leather", name: "가죽 갑옷" });
  runtime = addItem(runtime, { name: "고대의 열쇠", quantity: 2 });
  runtime = adjustGold(runtime, -15, "장검 구입");
  let live = deriveCharacter(source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory });
  assert.ok(live.attacks.some((attack) => attack.name === "장검" && attack.properties.includes("숙련 없음")), "wizard is not proficient with a longsword");
  const key = live.inventory.find((item) => item.name === "고대의 열쇠")!;
  assert.equal(key.quantity, 2);
  assert.equal(key.custom, true);
  assert.equal(runtime.gold, derived.gold - 15);
  const leather = live.inventory.find((item) => item.itemId === "dnd.srd521.item.armor.leather")!;
  assert.equal(live.ac.value, 10 + 2, "unarmored before equipping");
  runtime = toggleEquip(runtime, live, leather.instanceId);
  live = deriveCharacter(source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory });
  assert.equal(live.ac.value, 11 + 2);
  assert.ok(live.ac.terms.some((term) => term.label === "가죽 갑옷" && term.value === 11), "AC provenance names the armor");
  assert.ok(live.validation.warnings.some((line) => line.includes("훈련되지 않은")), "wizard wearing armor is warned");
  runtime = setItemQuantity(runtime, live, key.instanceId, 5);
  runtime = removeItem(runtime, live, live.inventory.find((item) => item.name === "장검")!.instanceId);
  live = deriveCharacter(source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory });
  assert.equal(live.inventory.find((item) => item.name === "고대의 열쇠")?.quantity, 5);
  assert.ok(!live.attacks.some((attack) => attack.name === "장검"));
  runtime = toggleCondition(runtime, "중독");
  assert.deepEqual(runtime.conditions, ["중독"]);
  assert.ok(runtime.log.some((entry) => entry.text.includes("장검 구입")));
});

test("every derived number carries provenance terms that add up to it", () => {
  const { derived } = build({ species: "elf", background: "criminal", classes: "rogue", level: 5, abilities: { dex: 16 } }, { "origin.background.abilityPlus2": ["dex"], "class.0.skills": ["stealth", "acrobatics", "perception", "insight"], "class.0.expertise": ["stealth", "perception"], "origin.species.keenSenses": ["perception"] });
  const sum = (terms: Array<{ value: number }>) => terms.reduce((total, term) => total + term.value, 0);
  assert.equal(sum(derived.hp.terms), derived.hp.max);
  assert.equal(sum(derived.ac.terms), derived.ac.value);
  assert.equal(sum(derived.speed.terms), derived.speed.walk);
  assert.equal(sum(derived.initiativeTerms), derived.initiative);
  assert.equal(sum(derived.passivePerceptionTerms), derived.passivePerception);
  for (const key of ["str", "dex", "con", "int", "wis", "cha"] as const) assert.equal(sum(derived.saves[key].terms), derived.saves[key].bonus, key);
  for (const skill of derived.skills) assert.equal(sum(skill.terms), skill.bonus, skill.id);
  const stealth = derived.skills.find((skill) => skill.id === "stealth")!;
  assert.ok(stealth.terms.some((term) => term.label.startsWith("전문화")), stealth.terms.map((term) => term.label).join(","));
  for (const attack of derived.attacks) { assert.equal(sum(attack.attackTerms), attack.attackBonus, attack.name); assert.equal(sum(attack.damageTerms), attack.damageBonus, attack.name); }
  for (const entry of derived.spellcasting) { assert.equal(sum(entry.saveDcTerms), entry.saveDc); assert.equal(sum(entry.attackTerms), entry.attackBonus); }
  const dwarf = build({ species: "dwarf", classes: "fighter", level: 3 }).derived;
  assert.ok(dwarf.hp.terms.some((term) => term.label.includes("드워프의 강인함") && term.value === 3));
  void ids;
});

test("the HP box understands set, damage, heal and temporary HP", async () => {
  const { applyHpCommand } = await import("../../client/character/play");
  const { derived } = build({ classes: "fighter", level: 2 });
  let runtime = initialRuntime(derived);
  runtime = applyHpCommand(runtime, derived, "-4")!;
  assert.equal(runtime.hp.current, derived.hp.max - 4);
  runtime = applyHpCommand(runtime, derived, "+2")!;
  assert.equal(runtime.hp.current, derived.hp.max - 2);
  runtime = applyHpCommand(runtime, derived, "++5")!;
  assert.equal(runtime.hp.temp, 5);
  runtime = applyHpCommand(runtime, derived, "7")!;
  assert.equal(runtime.hp.current, 7);
  assert.equal(applyHpCommand(runtime, derived, "abc"), null);
  assert.equal(applyHpCommand(runtime, derived, ""), null);
});

test("feature use: Rage spends a use and runs ten rounds; Second Wind heals; Lay on Hands spends points", async () => {
  const { advanceRound, endEffect, useFeature } = await import("../../client/character/play");
  const { featureActivation, parseDuration } = await import("../../client/rules/activation");
  const { derived } = build({ classes: "barbarian", level: 3 });
  const rage = derived.features.find((feature) => feature.id.endsWith("barbarian.rage"))!;
  const activation = featureActivation(rage, derived)!;
  assert.equal(activation.resourceId, "resource.barbarian.rage");
  let runtime = initialRuntime(derived);
  runtime = useFeature(runtime, derived, rage, activation)!;
  assert.equal(runtime.resourcesUsed["resource.barbarian.rage"], 1);
  assert.equal(runtime.effects.length, 1);
  assert.equal(runtime.effects[0].rounds, 100, "Rage lasts 10 minutes in the 2024 rules");
  for (let round = 0; round < 99; round += 1) runtime = advanceRound(runtime);
  assert.equal(runtime.effects[0].elapsed, 99, "still raging after 99 rounds");
  runtime = advanceRound(runtime);
  assert.equal(runtime.effects.length, 0, "rage ends at the hundredth round");
  assert.ok(runtime.log.some((entry) => entry.text.includes("종료: 격노")));
  runtime = useFeature(runtime, derived, rage, activation)!;
  runtime = endEffect(runtime, "feature:barbarian.rage");
  assert.equal(runtime.effects.length, 0);
  assert.equal(runtime.resourcesUsed["resource.barbarian.rage"], 2);

  const fighter = build({ classes: "fighter", level: 4 }).derived;
  const secondWind = fighter.features.find((feature) => feature.id.endsWith("fighter.second-wind"))!;
  const swActivation = featureActivation(secondWind, fighter)!;
  assert.equal(swActivation.heal?.(fighter), "1d10+4");
  let hurt = initialRuntime(fighter);
  hurt = applyDamage(hurt, fighter, 12);
  hurt = useFeature(hurt, fighter, secondWind, swActivation, { healRoll: 9 })!;
  assert.equal(hurt.hp.current, fighter.hp.max - 3);
  assert.equal(hurt.resourcesUsed["resource.fighter.second-wind"], 1);
  const secondWindMax = fighter.resources.find((resource) => resource.id === "resource.fighter.second-wind")!.max;
  for (let index = 1; index < secondWindMax; index += 1) hurt = useFeature(hurt, fighter, secondWind, swActivation, { healRoll: 1 })!;
  assert.equal(useFeature(hurt, fighter, secondWind, swActivation, { healRoll: 1 }), null, "no uses left");

  const paladin = build({ classes: "paladin", level: 2 }).derived;
  const layOnHands = paladin.features.find((feature) => feature.id.endsWith("paladin.lay-on-hands"))!;
  const lohActivation = featureActivation(layOnHands, paladin)!;
  assert.equal(lohActivation.points, true);
  let pal = initialRuntime(paladin);
  pal = useFeature(pal, paladin, layOnHands, lohActivation, { points: 7 })!;
  assert.equal(pal.resourcesUsed["resource.paladin.lay-on-hands"], 7);
  assert.equal(useFeature(pal, paladin, layOnHands, lohActivation, { points: 4 }), null, "10 points at level 2: 7 spent, 4 more is too many");

  assert.deepEqual(parseDuration("집중, 최대 1분"), { text: "집중, 최대 1분", instantaneous: false, concentration: true, rounds: 10 });
  assert.deepEqual(parseDuration("즉시"), { text: "즉시", instantaneous: true, concentration: false });
  assert.equal(parseDuration("8시간").rounds, undefined, "hours are not counted in rounds");
  assert.equal(parseDuration("1라운드").rounds, 1);
});

test("casting: slots are spent by level, rituals and cantrips are free, concentration replaces concentration, rests end effects", async () => {
  const { castSpell } = await import("../../client/character/play");
  const { source, derived } = build({ classes: "cleric", level: 3 });
  const cat = catalog();
  const bless = cat.spellByName("Bless")!;
  const detectMagic = cat.spellByName("Detect Magic")!;
  const cureWounds = cat.spellByName("Cure Wounds")!;
  const guidance = cat.spellByName("Guidance")!;
  let runtime = initialRuntime(derived);
  runtime = castSpell(runtime, derived, bless, { kind: "slot", level: 2 })!;
  assert.equal(runtime.slotsUsed[2], 1, "cast with a higher slot");
  assert.equal(runtime.effects[0]?.name, bless.name);
  assert.equal(runtime.effects[0]?.concentration, true);
  runtime = castSpell(runtime, derived, detectMagic, { kind: "ritual" })!;
  assert.equal(runtime.slotsUsed[1] ?? 0, 0, "a ritual costs no slot");
  assert.equal(runtime.effects.length, 1, "concentration on Detect Magic ended Bless");
  assert.equal(runtime.effects[0]?.name, detectMagic.name);
  assert.ok(runtime.log.some((entry) => entry.text.includes("집중 종료")));
  runtime = castSpell(runtime, derived, cureWounds, { kind: "slot", level: 1 })!;
  assert.equal(runtime.slotsUsed[1], 1);
  assert.equal(runtime.effects.length, 1, "an instantaneous spell adds no effect");
  runtime = castSpell(runtime, derived, guidance, { kind: "cantrip" })!;
  assert.equal(runtime.effects.length, 1, "Guidance (concentration) replaced Detect Magic");
  assert.equal(castSpell(runtime, derived, bless, { kind: "slot", level: 0 }), null, "a slot below the spell level is refused");
  assert.equal(castSpell(runtime, derived, cureWounds, { kind: "ritual" }), null, "not a ritual");
  for (let index = 0; index < 4; index += 1) runtime = castSpell(runtime, derived, cureWounds, { kind: "slot", level: 1 }) ?? runtime;
  assert.equal(runtime.slotsUsed[1], derived.spellSlots[1], "no more level 1 slots");
  runtime = shortRest(runtime, derived);
  assert.equal(runtime.effects.length, 0, "a short rest ends concentration and counted effects");
  runtime = castSpell(runtime, derived, bless, { kind: "slot", level: 2 })!;
  runtime = longRest(runtime, derived);
  assert.equal(runtime.effects.length, 0);
  assert.deepEqual(runtime.slotsUsed, {});
  void source;
});
