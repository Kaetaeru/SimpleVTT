import assert from "node:assert/strict";
import test from "node:test";
import { deriveCharacter } from "../../client/character/derive";
import { build, catalog, choice, classCasting, derive, featureNames, ids, sourceOf, spellNames } from "./support";

const originTier = (id: string) => catalog().featById(id)?.tier === "origin";

test("level-1 dwarf fighter (soldier): HP, AC, saves, skills, masteries, species traits and the origin feat", () => {
  const { derived } = build({ species: "dwarf", background: "soldier", classes: "fighter", abilities: { str: 15, dex: 14, con: 14 } }, {
    "origin.background.abilityPlus2": ["str"], "origin.background.abilityPlus1": ["con"], "class.0.skills": ["athletics", "perception"],
    "class.0.fighting-style": [ids.feat("fighting-style.defense")], "equipment.class": ["A"],
  });
  assert.deepEqual(derived.validation.blocking, []);
  assert.equal(derived.level, 1);
  assert.equal(derived.proficiencyBonus, 2);
  assert.equal(derived.abilities.str.score, 17);
  assert.equal(derived.abilities.con.score, 15);
  // d10 + CON 2 + Dwarven Toughness 1
  assert.equal(derived.hp.max, 13);
  // Chain mail 16 + Defense 1
  assert.equal(derived.ac.value, 17);
  assert.equal(derived.ac.source, "사슬 갑옷");
  assert.equal(derived.saves.str.proficient && derived.saves.con.proficient, true);
  assert.equal(derived.saves.str.bonus, 3 + 2);
  assert.equal(derived.saves.wis.proficient, false);
  const athletics = derived.skills.find((skill) => skill.id === "athletics")!;
  assert.equal(athletics.proficient, true);
  assert.equal(athletics.bonus, 3 + 2);
  assert.ok(derived.skills.find((skill) => skill.id === "intimidation")?.proficient, "background skill");
  assert.deepEqual(derived.features.filter((feature) => feature.source === "species").map((feature) => feature.name), ["드워프의 회복력", "드워프의 강인함", "석재 감각"]);
  assert.ok(derived.features.filter((feature) => feature.source === "species").every((feature) => feature.description));
  assert.deepEqual(derived.defenses.resistances, ["독"]);
  assert.equal(derived.senses.darkvision, 120);
  assert.deepEqual(derived.feats.map((feat) => feat.id), [ids.feat("savage-attacker"), ids.feat("fighting-style.defense")]);
  assert.equal(derived.weaponMasteries.length, 3);
  const greatsword = derived.attacks.find((attack) => attack.name === "대검")!;
  assert.equal(greatsword.attackBonus, 3 + 2);
  assert.equal(greatsword.damageBonus, 3);
  assert.equal(greatsword.mastery, "스치기");
  assert.equal(derived.gold, 4 + 14);
  assert.ok(derived.inventory.some((item) => item.name === "주사위 세트"), "the soldier's gaming set takes the trained variant");
  assert.deepEqual(derived.hitDice, { d10: 1 });
  assert.equal(derived.resources.find((resource) => resource.id === "resource.fighter.second-wind")?.max, 2);
});

test("Dwarven Toughness adds 1 HP per level gained, at every level", () => {
  for (const level of [1, 2, 5, 10, 20]) {
    const dwarf = build({ species: "dwarf", classes: "rogue", level, abilities: { con: 10 } }).derived;
    const human = build({ species: "human", classes: "rogue", level, abilities: { con: 10 } }).derived;
    assert.equal(dwarf.hp.max - human.hp.max, level, `level ${level}`);
    const con = human.abilities.con.modifier;
    assert.equal(human.hp.max, Math.max(1, 8 + con) + (level - 1) * Math.max(1, 5 + con), `human rogue at level ${level}`);
  }
});

test("origin feats never appear among the ASI candidates; general feats need their prerequisites", () => {
  const { derived } = build({ classes: "fighter", level: 4, abilities: { str: 8, dex: 8 } });
  const asi = choice(derived, "class.3.asi")!;
  assert.ok(asi, "level 4 asks for the ASI feat or a general feat");
  assert.ok(asi.options.length > 0);
  assert.ok(asi.options.every((option) => !originTier(option.id)), asi.options.map((option) => option.id).join(", "));
  assert.equal(asi.options.find((option) => option.id === ids.feat("grappler"))?.disabledReason, "근력 또는 민첩 13 이상");
  assert.equal(asi.options[0].id, ids.feat("ability-score-improvement"));
  // Fighter 6 also gains an ASI; rogue 10 too; level 19 is the epic boon.
  const fighter6 = derive({ classes: "fighter", level: 6 });
  assert.ok(choice(fighter6, "class.5.asi"));
  const rogue10 = derive({ classes: "rogue", level: 10 });
  assert.ok(choice(rogue10, "class.9.asi"));
  assert.ok(!choice(rogue10, "class.8.asi"));
  const wizard19 = derive({ classes: "wizard", level: 19 });
  assert.ok(choice(wizard19, "class.18.epic-boon"));
  assert.ok(!choice(wizard19, "class.18.asi"));
  assert.ok(choice(wizard19, "class.18.epic-boon")!.options.some((option) => option.id === ids.feat("epic.spell-recall") && !option.disabledReason));
});

test("the ASI feat raises abilities (+2 or +1/+1) capped at 20, and a general feat's +1 applies", () => {
  const plus2 = build({ classes: "fighter", level: 4, abilities: { str: 15, dex: 19 } }, { "class.3.asi": [ids.feat("ability-score-improvement")], "feat.class.3.asi.dnd.srd521.feat.ability-score-improvement.mode": ["+2-one-ability"], "feat.class.3.asi.dnd.srd521.feat.ability-score-improvement.abilities": ["str"], "origin.background.abilityPlus2": ["con"], "origin.background.abilityPlus1": ["str"] }).derived;
  assert.equal(plus2.abilities.str.score, 18);
  const capped = choice(plus2, "feat.class.3.asi.dnd.srd521.feat.ability-score-improvement.abilities")!;
  assert.equal(capped.options.find((option) => option.id === "dex")?.disabledReason, "20을 넘길 수 없음");
  const grappler = build({ classes: "fighter", level: 4, abilities: { str: 15 } }, { "class.3.asi": [ids.feat("grappler")], "feat.class.3.asi.dnd.srd521.feat.grappler.ability": ["str"], "origin.background.abilityPlus2": ["str"] }).derived;
  assert.equal(grappler.abilities.str.score, 18);
  assert.ok(grappler.feats.some((feat) => feat.id === ids.feat("grappler")));
  assert.ok(grappler.features.some((feature) => feature.name === "붙잡기 전문가" && feature.description));
});

test("human: a skill and an origin feat of choice, sizes small or medium", () => {
  const derived = derive({ species: "human", classes: "barbarian" });
  const skill = choice(derived, "origin.species.skillProficiency")!;
  const feat = choice(derived, "origin.species.originFeat")!;
  assert.equal(skill.options.length, 18);
  assert.ok(feat.options.every((option) => originTier(option.id)));
  assert.ok(choice(derived, "origin.species.size"));
  const { derived: done } = build({ species: "human", classes: "barbarian" }, { "origin.species.originFeat": [ids.feat("skilled")] });
  assert.equal(done.feats.filter((feat) => feat.tier === "origin").length, 2, "background feat + versatile");
  assert.ok(choice(done, "feat.species.originFeat.dnd.srd521.feat.skilled.proficiencies"));
  assert.deepEqual(done.validation.blocking, []);
});

test("elf lineages: drow darkvision 120 and Dancing Lights, level-3 and level-5 spells always prepared, wood elf speed 35", () => {
  const drow1 = build({ species: "elf", classes: "rogue", level: 1 }, { "origin.species.lineage": ["drow"], "origin.species.spellcastingAbility": ["cha"] }).derived;
  assert.equal(drow1.senses.darkvision, 120);
  const species1 = drow1.spellcasting.find((entry) => entry.classId === "species")!;
  assert.deepEqual(spellNames(drow1, species1.cantrips), ["Dancing Lights"]);
  assert.deepEqual(species1.alwaysPrepared, []);
  assert.equal(species1.ability, "cha");
  const drow5 = build({ species: "elf", classes: "rogue", level: 5 }, { "origin.species.lineage": ["drow"] }).derived;
  const species5 = drow5.spellcasting.find((entry) => entry.classId === "species")!;
  assert.deepEqual(spellNames(drow5, species5.alwaysPrepared).sort(), ["Darkness", "Faerie Fire"]);
  assert.equal(drow5.resources.filter((resource) => resource.id.startsWith("resource.species.spell.")).length, 2);
  const wood = build({ species: "elf", classes: "rogue" }, { "origin.species.lineage": ["wood-elf"], "origin.species.keenSenses": ["perception"] }).derived;
  assert.equal(wood.speed.walk, 35);
  assert.ok(wood.skills.find((skill) => skill.id === "perception")?.proficient);
});

test("tiefling and dragonborn: legacy resistance and cantrips; draconic ancestry resistance and level-5 flight", () => {
  const tiefling = build({ species: "tiefling", classes: "sorcerer" }, { "origin.species.legacy": ["infernal"] }).derived;
  assert.deepEqual(tiefling.defenses.resistances, ["화염"]);
  const species = tiefling.spellcasting.find((entry) => entry.classId === "species")!;
  assert.deepEqual(spellNames(tiefling, species.cantrips).sort(), ["Fire Bolt", "Thaumaturgy"]);
  const dragonborn4 = build({ species: "dragonborn", classes: "paladin", level: 4 }, { "origin.species.draconicAncestry": ["silver"] }).derived;
  assert.deepEqual(dragonborn4.defenses.resistances, ["냉기"]);
  assert.ok(!featureNames(dragonborn4).includes("용의 비행"));
  assert.equal(dragonborn4.resources.find((resource) => resource.id === "resource.species.breath-weapon")?.max, 2);
  const dragonborn5 = build({ species: "dragonborn", classes: "paladin", level: 5 }).derived;
  assert.ok(featureNames(dragonborn5).includes("용의 비행"));
  assert.equal(dragonborn5.resources.find((resource) => resource.id === "resource.species.breath-weapon")?.max, 3);
});

test("background: acolyte presets Magic Initiate (Cleric) with two cantrips, one spell and a casting ability", () => {
  const derived = derive({ background: "acolyte", classes: "fighter" });
  assert.ok(!choice(derived, "feat.background.dnd.srd521.feat.magic-initiate.spellList"), "the list is preset");
  const cantrips = choice(derived, "feat.background.dnd.srd521.feat.magic-initiate.cantrips")!;
  assert.equal(cantrips.count, 2);
  assert.ok(cantrips.options.every((option) => catalog().spellById(option.id)?.classes.includes(ids.cls("cleric"))));
  const { derived: done } = build({ background: "acolyte", classes: "fighter" }, { "feat.background.dnd.srd521.feat.magic-initiate.ability": ["wis"] });
  const entry = done.spellcasting.find((item) => item.className.startsWith("마법 입문자"))!;
  assert.equal(entry.cantrips.length, 2);
  assert.equal(entry.alwaysPrepared.length, 1);
  assert.equal(entry.ability, "wis");
  assert.equal(entry.saveDc, 8 + 2 + done.abilities.wis.modifier);
  assert.ok(done.proficiencies.tools.includes("서예가 도구") || done.proficiencies.tools.some((tool) => tool.includes("서예")), done.proficiencies.tools.join(","));
});

test("rogue: expertise from proficient skills, sneak attack, thieves' cant, extra language, finesse attacks", () => {
  const { derived } = build({ species: "halfling", background: "criminal", classes: "rogue", abilities: { dex: 17, str: 8 } }, { "origin.background.abilityPlus2": ["con"], "origin.background.abilityPlus1": ["int"], "class.0.skills": ["acrobatics", "deception", "insight", "perception"], "class.0.expertise": ["stealth", "perception"] });
  assert.deepEqual(derived.validation.blocking, []);
  const expertise = choice(derived, "class.0.expertise")!;
  assert.equal(expertise.count, 2);
  assert.ok(expertise.options.every((option) => option.disabledReason !== undefined || derived.skills.find((skill) => skill.id === option.id)?.proficient));
  const stealth = derived.skills.find((skill) => skill.id === "stealth")!;
  assert.equal(stealth.expertise, true);
  assert.equal(stealth.bonus, 3 + 4);
  assert.ok(derived.proficiencies.languages.includes("도둑 은어"));
  assert.ok(choice(derived, "class.0.extra-language"));
  assert.ok(derived.proficiencies.languages.length >= 4);
  assert.ok(featureNames(derived).includes("암습"));
  const rapierLike = derived.attacks.find((attack) => attack.name === "단검")!;
  assert.equal(rapierLike.ability, "dex");
  assert.equal(rapierLike.attackBonus, 3 + 2);
  assert.ok(derived.proficiencies.tools.includes("도둑 도구"));
  assert.equal(derived.proficiencies.weapons.join(","), "단순 무기,교묘·경량 속성 군용 무기");
});

test("wizard: spellbook 6 (+2/level), prepared from the spellbook, cantrips 3, slots by level, Arcane Recovery", () => {
  const w1 = build({ species: "gnome", background: "sage", classes: "wizard", abilities: { int: 16 } }).derived;
  const wizard = classCasting(w1, "wizard")!;
  assert.equal(wizard.cantripsMax, 3);
  assert.equal(wizard.spellbook?.length, 6);
  assert.equal(wizard.preparedMax, 4);
  assert.equal(wizard.prepared.length, 4);
  assert.ok(wizard.prepared.every((id) => wizard.spellbook!.includes(id)));
  assert.equal(wizard.saveDc, 8 + 2 + 3);
  assert.deepEqual(w1.spellSlots, { 1: 2 });
  assert.ok(w1.resources.some((resource) => resource.id === "resource.wizard.arcane-recovery"));
  const w5 = build({ classes: "wizard", level: 5 }).derived;
  assert.equal(classCasting(w5, "wizard")!.spellbook?.length, 14 + 3, "V3g (D261): the default Evoker writes 3 evocation spells free at level 5");
  assert.deepEqual(w5.spellSlots, { 1: 4, 2: 3, 3: 2 });
  const spellbook = choice(w5, "class.0.spellbook")!;
  assert.ok(spellbook.options.every((option) => (catalog().spellById(option.id)?.level ?? 0) <= 3), "spellbook options stop at the highest slot level");
  const w20 = build({ classes: "wizard", level: 20 }).derived;
  assert.deepEqual(w20.spellSlots, { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 });
});

test("warlock: pact slots, invocations with prerequisites, Mystic Arcanum, Pact of the Tome cantrips", () => {
  const w1 = derive({ classes: "warlock" });
  const invocations = choice(w1, "class.0.invocations")!;
  assert.equal(invocations.count, 1);
  assert.deepEqual(invocations.options.filter((option) => !option.disabledReason).map((option) => option.id).sort(), ["invocation.armor-of-shadows", "invocation.eldritch-mind", "invocation.pact-of-the-blade", "invocation.pact-of-the-chain", "invocation.pact-of-the-tome"]);
  assert.deepEqual(w1.pactMagic, { count: 1, level: 1 });
  const w5 = build({ classes: "warlock", level: 5 }, { "class.0.invocations": ["invocation.pact-of-the-tome", "invocation.agonizing-blast", "invocation.thirsting-blade", "invocation.armor-of-shadows", "invocation.eldritch-mind", "invocation.devils-sight"] }).derived;
  assert.deepEqual(w5.pactMagic, { count: 2, level: 3 });
  const picked = choice(w5, "class.0.invocations")!;
  assert.equal(picked.count, 5, "warlock 5 knows five invocations (1 → 3 at level 2 → 5 at level 5)");
  assert.ok(picked.selected.includes("invocation.pact-of-the-tome"));
  assert.equal(picked.options.find((option) => option.id === "invocation.thirsting-blade")?.disabledReason, "칼날의 계약 필요");
  assert.ok(!picked.selected.includes("invocation.thirsting-blade"));
  const warlock = classCasting(w5, "warlock")!;
  assert.equal(warlock.cantrips.length, 3 + 3, "3 warlock cantrips + 3 from the Book of Shadows");
  assert.ok(w5.features.some((feature) => feature.source === "invocation" && feature.name === "고통스러운 폭발"));
  const prepared = choice(w5, "class.0.spells")!;
  assert.ok(prepared.options.every((option) => (catalog().spellById(option.id)?.level ?? 0) <= 3));
  const w11 = build({ classes: "warlock", level: 11 }).derived;
  const arcanum = choice(w11, "class.10.arcanum6")!;
  assert.ok(arcanum.options.every((option) => catalog().spellById(option.id)?.level === 6));
  assert.ok(w11.resources.some((resource) => resource.id === "resource.warlock.arcanum.6"));
  assert.deepEqual(w11.pactMagic, { count: 3, level: 5 });
});

test("cleric and druid orders, subclass spells, channel divinity; paladin blessed warrior cantrips", () => {
  const cleric = build({ background: "acolyte", classes: "cleric", level: 3, abilities: { wis: 16 } }, { "class.0.divine-order": ["thaumaturge"], "class.2.subclass": ["dnd.srd521.subclass.cleric.life-domain"] }).derived;
  const spells = classCasting(cleric, "cleric")!;
  assert.equal(spells.cantripsMax, 4, "3 + Thaumaturge");
  assert.equal(spells.cantrips.length, 4);
  assert.deepEqual(spellNames(cleric, spells.alwaysPrepared).sort(), ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"]);
  assert.equal(cleric.resources.find((resource) => resource.id === "resource.cleric.channel-divinity")?.max, 2);
  assert.ok(!cleric.proficiencies.armor.includes("중장 방어구"));
  const protector = build({ classes: "cleric" }, { "class.0.divine-order": ["protector"] }).derived;
  assert.ok(protector.proficiencies.armor.includes("중장 방어구") && protector.proficiencies.weapons.includes("군용 무기"));
  const druid = build({ classes: "druid", level: 3 }, { "class.0.primal-order": ["magician"], "class.2.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"], "class.2.subclass.land-type": ["arid"] }).derived;
  const druidSpells = classCasting(druid, "druid")!;
  assert.equal(druidSpells.cantripsMax, 3);
  assert.ok(spellNames(druid, druidSpells.alwaysPrepared).includes("Speak with Animals"));
  assert.ok(spellNames(druid, druidSpells.alwaysPrepared).includes("Burning Hands"), spellNames(druid, druidSpells.alwaysPrepared).join(","));
  assert.ok(druid.proficiencies.tools.some((tool) => tool.includes("약초")));
  const paladin = build({ classes: "paladin", level: 2 }, { "class.1.fighting-style": ["paladin.blessed-warrior"] }).derived;
  const paladinSpells = classCasting(paladin, "paladin")!;
  assert.equal(paladinSpells.cantrips.length, 2);
  assert.ok(paladinSpells.cantrips.every((id) => catalog().spellById(id)?.classes.includes(ids.cls("cleric"))));
  assert.deepEqual(paladin.spellSlots, { 1: 2 });
});

test("monk and barbarian: unarmored defense formulas, martial arts die, unarmored movement, rage", () => {
  const monk = build({ classes: "monk", level: 2, abilities: { dex: 16, wis: 14, str: 10 } }, { "origin.background.abilityPlus2": ["dex"], "origin.background.abilityPlus1": ["con"], "equipment.class": ["A"] }).derived;
  assert.equal(monk.ac.value, 10 + 4 + 2);
  assert.equal(monk.ac.source, "비무장 방어 (몽크)");
  assert.equal(monk.speed.walk, 40);
  const unarmed = monk.attacks.find((attack) => attack.id === "attack.unarmed-strike")!;
  assert.equal(unarmed.damage, "d6");
  assert.equal(unarmed.ability, "dex");
  assert.equal(monk.resources.find((resource) => resource.id === "resource.monk.focus")?.max, 2);
  const barbarian = build({ classes: "barbarian", abilities: { dex: 14, con: 16 } }, { "origin.background.abilityPlus2": ["str"], "origin.background.abilityPlus1": ["con"] }).derived;
  assert.equal(barbarian.ac.value, 10 + 2 + 3, "10 + DEX 2 + CON 3 (16 + 1 from the background)");
  assert.equal(barbarian.resources.find((resource) => resource.id === "resource.barbarian.rage")?.max, 2);
  const mastery = choice(barbarian, "class.0.weapon-mastery")!;
  assert.equal(mastery.count, 2);
  assert.ok(mastery.options.every((option) => catalog().itemById(option.id)?.weapon?.mode === "melee"));
  const barbarian5 = build({ classes: "barbarian", level: 5 }).derived;
  assert.equal(barbarian5.speed.walk, 40);
  const barbarian20 = build({ classes: "barbarian", level: 20, abilities: { str: 15, con: 15 } }).derived;
  assert.ok(barbarian20.abilities.str.score >= 21 && barbarian20.abilities.con.score >= 19, "Primal Champion +4 with cap 24");
});

test("multiclass: prerequisites block, grants apply, spell slots combine and each class prepares as single-classed", () => {
  const blocked = derive({ classes: ["fighter", "wizard"], abilities: { int: 8 } });
  assert.ok(blocked.validation.blocking.some((line) => line.includes("지능 13")), blocked.validation.blocking.join("\n"));
  const ok = build({ classes: ["paladin", "paladin", "wizard", "wizard", "wizard"], abilities: { str: 13, cha: 13, int: 13 } }).derived;
  assert.deepEqual(ok.validation.blocking, []);
  assert.deepEqual(ok.classes.map((cls) => [cls.name, cls.level]), [["팔라딘", 2], ["위저드", 3]]);
  // ceil(2/2) + 3 = 4 → 4/3
  assert.deepEqual(ok.spellSlots, { 1: 4, 2: 3 });
  const wizard = classCasting(ok, "wizard")!;
  assert.equal(wizard.spellbook?.length, 10 + 2, "V3g (D261): and 2 at wizard 3");
  assert.ok(choice(ok, "class.2.spellbook")!.options.every((option) => (catalog().spellById(option.id)?.level ?? 0) <= 2), "wizard 3 prepares up to level 2");
  assert.ok(!ok.proficiencies.armor.includes("중장 방어구") === false, "paladin first: heavy armor stays");
  assert.deepEqual(ok.hitDice, { d10: 2, d6: 3 });
  const bardMulti = build({ classes: ["fighter", "bard"], abilities: { cha: 13, str: 13 } }).derived;
  assert.equal(choice(bardMulti, "class.1.skills")?.count, 1);
  assert.equal(choice(bardMulti, "class.1.instruments")?.count, 1);
  assert.ok(!bardMulti.saves.cha.proficient, "saves come from the first class only");
  assert.ok(!choice(bardMulti, "class.1.instrument-proficiencies"));
});

test("equipment: gold mode, option B gold, holy symbol choice, unequipped armor changes AC", () => {
  const gold = derive({ classes: "fighter", equipment: { mode: "gold" } });
  assert.equal(gold.gold, 155 + 50);
  assert.equal(gold.inventory.length, 0);
  const optionB = build({ classes: "wizard" }, { "equipment.class": ["B"], "equipment.background": ["B"] }).derived;
  assert.equal(optionB.gold, 55 + 50);
  const cleric = build({ background: "acolyte", classes: "cleric" }, { "equipment.class": ["A"], "equipment.class.A.0": ["dnd.srd521.item.focus.holy-emblem"] }).derived;
  assert.ok(cleric.inventory.some((item) => item.itemId === "dnd.srd521.item.focus.holy-emblem"));
  assert.equal(cleric.ac.value, 13 + Math.min(2, cleric.abilities.dex.modifier) + 2);
  const naked = deriveCharacter(build({ background: "acolyte", classes: "cleric" }, { "equipment.class": ["A"] }).source, catalog(), { equipped: {} });
  assert.equal(naked.ac.value, 10 + naked.abilities.dex.modifier);
  const monkTool = build({ classes: "monk" }, { "equipment.class": ["A"] }).derived;
  assert.ok(choice(monkTool, "equipment.class.A.0")!.options.length > 20, "artisan tools + instruments");
});

test("validation: name, ability methods, unanswered choices, level cap", () => {
  const nameless = deriveCharacter({ ...sourceOf({ classes: "fighter" }), name: " " }, catalog());
  assert.ok(nameless.validation.blocking.includes("이름을 정하세요."));
  const pointBuy = derive({ classes: "fighter", method: "point-buy", abilities: { str: 15, dex: 15, con: 15, int: 9, wis: 8, cha: 8 } });
  const exact = derive({ classes: "fighter", method: "point-buy", abilities: { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 } });
  assert.ok(!exact.validation.blocking.some((line) => line.includes("27점")), "27 points exactly is fine");
  assert.ok(pointBuy.validation.blocking.some((line) => line.includes("27점")));
  const array = derive({ classes: "fighter", method: "standard-array", abilities: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 } });
  assert.ok(array.validation.blocking.some((line) => line.includes("표준 배열")));
  const fresh = derive({ classes: "fighter" });
  assert.ok(fresh.validation.blocking.some((line) => line.includes("기술 숙련")));
  assert.ok(fresh.choices.filter((item) => !item.satisfied).length >= 5);
  const tooHigh = derive({ classes: "fighter", level: 21 });
  assert.ok(tooHigh.validation.blocking.some((line) => line.includes("20")));
  const none = deriveCharacter(sourceOf({ classes: [] }), catalog());
  assert.ok(none.validation.blocking.some((line) => line.includes("직업")));
});

test("the source survives a JSON round trip and stale answers are ignored", () => {
  const { source, derived } = build({ species: "elf", background: "sage", classes: "wizard", level: 5 });
  const copy = JSON.parse(JSON.stringify(source));
  assert.deepEqual(deriveCharacter(copy, catalog()), derived);
  const stale = { ...source, choices: { ...source.choices, "class.9.asi": [ids.feat("grappler")], "origin.species.lineage": ["nonsense"] } };
  const again = deriveCharacter(stale, catalog());
  assert.ok(!again.feats.some((feat) => feat.id === ids.feat("grappler")));
  assert.equal(choice(again, "origin.species.lineage")?.satisfied, false);
});
