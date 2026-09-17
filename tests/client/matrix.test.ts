/**
 * The creation matrix (CHARACTER_SYSTEM.md §9.1): every SRD species × class × background at levels 1 and 5, and
 * every class through all 20 levels, auto-answered and checked against independent formulas (proficiency bonus,
 * hit points, ASI schedule, spell slots, class features, species traits, saves, attacks) with no blocking message.
 */
import assert from "node:assert/strict";
import test from "node:test";
// The SRD schedules, kept here as the independent check on what the progression tables drive (H4, D243).
const ASI_LEVELS: Record<string, number[]> = { default: [4, 8, 12, 16], fighter: [4, 6, 8, 12, 14, 16], rogue: [4, 8, 10, 12, 16] };
const EPIC_BOON_LEVEL = 19;
const SUBCLASS_LEVEL = 3;
import { fixedHitPoints, fullCasterSlots, pactMagicSlots, proficiencyBonusForLevel } from "../../client/rules/tables";
import { build, catalog, choice, ids } from "./support";

const SPECIES = ["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"];
const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
const BACKGROUNDS = ["acolyte", "criminal", "sage", "soldier"];
const GENERIC = new Set(["Ability Score Improvement", "Epic Boon", "Subclass Feature"]);

/** Abilities that let every class multiclass-free and pass every general-feat prerequisite: 15/14/13/12/10/8 rotated. */
const abilitiesFor = (slug: string) => {
  const primary = catalog().classBySlug(slug)!.primaryAbilities[0] ?? "str";
  const base = { str: 13, dex: 13, con: 13, int: 12, wis: 12, cha: 12, [primary]: 15 } as Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
  return base;
};

function check(species: string, cls: string, background: string, level: number) {
  const label = `${species}/${cls}/${background} L${level}`;
  const { derived, rounds } = build({ species, background, classes: cls, level, abilities: abilitiesFor(cls) });
  assert.ok(rounds < 40, `${label}: autofill did not converge`);
  assert.deepEqual(derived.validation.blocking, [], `${label}: ${derived.validation.blocking.join(" | ")}`);
  assert.equal(derived.level, level, label);
  assert.equal(derived.proficiencyBonus, proficiencyBonusForLevel(level), label);

  const view = catalog().classBySlug(cls)!;
  const con = derived.abilities.con.modifier;
  const dwarf = species === "dwarf" ? level : 0;
  // H3c (D241): the only SRD sorcerer subclass is draconic, and 용의 회복력 adds a hit point per sorcerer level from 3 (it never applied before).
  const draconic = cls === "sorcerer" && level >= 3 ? level : 0;
  const expectedHp = Math.max(1, view.hitDie + con) + (level - 1) * Math.max(1, fixedHitPoints(view.hitDie) + con) + dwarf + draconic;
  assert.equal(derived.hp.max, expectedHp, `${label}: hp`);
  assert.deepEqual(derived.hitDice, { [`d${view.hitDie}`]: level }, label);
  assert.ok(derived.ac.value >= 10, label);
  assert.ok(derived.speed.walk >= 25, label);

  // Saves from the class, skills from class + background (+ human/elf choices).
  for (const key of view.savingThrows) assert.ok(derived.saves[key].proficient, `${label}: save ${key}`);
  const proficientSkills = derived.skills.filter((skill) => skill.proficient).length;
  assert.ok(proficientSkills >= view.skillChoice.count + 2, `${label}: skills ${proficientSkills}`);

  // Species traits with a level gate, every one described.
  const speciesView = catalog().speciesById(ids.species(species))!;
  const expectedTraits = speciesView.traits.filter((trait) => !trait.minLevel || trait.minLevel <= level).map((trait) => trait.name);
  const traits = derived.features.filter((feature) => feature.source === "species" && speciesView.traits.some((trait) => trait.id === feature.id)).map((feature) => feature.name);
  assert.deepEqual(traits, expectedTraits, `${label}: species traits`);
  assert.ok(derived.features.every((feature) => feature.description), `${label}: undescribed features: ${derived.features.filter((feature) => !feature.description).map((feature) => feature.name).join(", ")}`);

  // Background: name, two skills, an origin feat.
  assert.equal(derived.background?.id, ids.background(background), label);
  assert.ok(derived.feats.some((feat) => feat.tier === "origin" && feat.source.startsWith("배경")), `${label}: origin feat`);

  // Class features of every row up to the level, except the generic rows.
  for (const row of view.progression.slice(0, level)) {
    for (const feature of row.featureRecords) {
      if (GENERIC.has(feature.nameEn) || /Subclass$/.test(feature.nameEn)) continue;
      assert.ok(derived.features.some((item) => item.name === feature.name && item.source === "class"), `${label}: missing ${row.level} ${feature.name}`);
    }
  }
  // ASI schedule: one choice per ASI level, never an origin feat among the candidates; epic boon at 19; subclass at 3.
  const asiLevels = (ASI_LEVELS[cls] ?? ASI_LEVELS.default).filter((asiLevel) => asiLevel <= level);
  const asiChoices = derived.choices.filter((item) => /^class\.\d+\.asi$/.test(item.id));
  assert.equal(asiChoices.length, asiLevels.length, `${label}: asi choices`);
  for (const asi of asiChoices) {
    assert.ok(asi.options.every((option) => catalog().featById(option.id)?.tier !== "origin"), `${label}: origin feat in ASI list`);
    assert.ok(asi.selected.length === 1, `${label}: asi answered`);
  }
  assert.equal(Boolean(choice(derived, `class.${EPIC_BOON_LEVEL - 1}.epic-boon`)), level >= EPIC_BOON_LEVEL, `${label}: epic boon`);
  if (level >= SUBCLASS_LEVEL) {
    assert.ok(derived.classes[0].subclassId, `${label}: subclass`);
    const subclass = catalog().subclassById(derived.classes[0].subclassId!)!;
    for (const feature of subclass.features) if (feature.level <= level) assert.ok(derived.features.some((item) => item.id === feature.id), `${label}: subclass feature ${feature.name}`);
  } else assert.ok(!derived.classes[0].subclassId, label);

  // Spell slots and counts.
  if (view.casterKind === "full") assert.deepEqual(derived.spellSlots, fullCasterSlots(level), `${label}: slots`);
  if (view.casterKind === "half") assert.deepEqual(derived.spellSlots, fullCasterSlots(Math.ceil(level / 2)), `${label}: half slots`);
  if (view.casterKind === "pact") assert.deepEqual(derived.pactMagic, pactMagicSlots(level), `${label}: pact`);
  if (view.casterKind === "none") assert.deepEqual(derived.spellSlots, {}, label);
  const casting = derived.spellcasting.find((entry) => entry.source === "class" && entry.classId === view.id);
  if (view.casterKind !== "none") {
    assert.ok(casting, `${label}: class spellcasting`);
    const row = view.progression[level - 1];
    const cantripColumn = Number(row.columns["소마법"] ?? 0);
    const bonus = derived.features.some((feature) => feature.name.endsWith("기적술사") || feature.name.endsWith("마법사")) ? 1 : 0;
    assert.equal(casting!.cantripsMax, cantripColumn + bonus, `${label}: cantrips max`);
    assert.equal(casting!.cantrips.length, cantripColumn + bonus + (cls === "warlock" && casting!.cantrips.length > cantripColumn ? 3 : 0), `${label}: cantrips known`);
    assert.equal(casting!.preparedMax, Number(row.columns["준비 주문"] ?? 0), `${label}: prepared max`);
    assert.equal(casting!.prepared.length, casting!.preparedMax, `${label}: prepared`);
    assert.equal(casting!.saveDc, 8 + derived.proficiencyBonus + derived.abilities[casting!.ability].modifier, label);
    if (cls === "wizard") assert.equal(casting!.spellbook?.length, 6 + 2 * (level - 1) + (derived.choices.find((item) => item.id.endsWith(".evocation-savant"))?.count ?? 0), `${label}: spellbook`);
  }

  // Attacks: one per carried weapon kind plus the unarmed strike, with proficiency applied.
  const weapons = new Set(derived.inventory.filter((item) => item.kind === "weapon").map((item) => item.itemId));
  assert.equal(derived.attacks.length, weapons.size + 1, `${label}: attacks`);
  for (const attack of derived.attacks) {
    const modifier = derived.abilities[attack.ability].modifier;
    const proficient = !attack.properties.includes("숙련 없음");
    const archery = attack.range && attack.properties.includes("ammunition") && derived.feats.some((feat) => feat.id === ids.feat("fighting-style.archery")) ? 2 : 0;
    assert.equal(attack.attackBonus, modifier + (proficient ? derived.proficiencyBonus : 0) + archery, `${label}: ${attack.name} attack bonus`);
  }
  assert.ok(derived.gold >= 0, label);
  return derived;
}

test("every species × class × background builds a complete level-1 and level-5 character", () => {
  let count = 0;
  for (const species of SPECIES) for (const cls of CLASSES) for (const background of BACKGROUNDS) for (const level of [1, 5]) { check(species, cls, background, level); count += 1; }
  assert.equal(count, SPECIES.length * CLASSES.length * BACKGROUNDS.length * 2);
});

test("every class builds at every level from 1 to 20 (species and background rotate)", () => {
  CLASSES.forEach((cls, classIndex) => {
    for (let level = 1; level <= 20; level += 1) {
      const species = SPECIES[(classIndex + level) % SPECIES.length];
      const background = BACKGROUNDS[(classIndex + level) % BACKGROUNDS.length];
      check(species, cls, background, level);
    }
  });
});

test("level 20 sheets carry the capstone: 6 proficiency bonus, 4 ASI + epic boon answered, full slots", () => {
  const wizard = check("elf", "wizard", "sage", 20);
  assert.equal(wizard.proficiencyBonus, 6);
  assert.equal(wizard.feats.filter((feat) => feat.tier !== "origin").length, 5);
  const fighter = check("orc", "fighter", "soldier", 20);
  assert.equal(fighter.feats.filter((feat) => feat.tier === "general" || feat.tier === "epic-boon").length, 7);
  assert.equal(fighter.resources.find((resource) => resource.id === "resource.fighter.indomitable")?.max, 3);
  assert.equal(fighter.weaponMasteries.length, 6);
});
