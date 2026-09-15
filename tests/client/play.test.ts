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
