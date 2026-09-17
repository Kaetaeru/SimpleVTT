/**
 * V0.9 guard (CLAUDE.md §2): content names, ids and feature keys do not belong in client code. This counts the
 * shapes that betray them and fails when any count grows. Moving one to JSON lowers its ceiling here; the ceilings
 * only ever go down, and V0.9 ends with them at the exceptions HARDCODE_AUDIT.md §4 records.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const CEILINGS = {
  /** A content id literal. */
  contentIds: 2,
  /** A branch on a feature, option or event key. */
  keyBranches: 30,
  /** A branch on a class slug or a picked option id. */
  slugBranches: 0,
  /** A regex run over a name or a description. */
  nameRegex: 2,
};

const PATTERNS: Record<keyof typeof CEILINGS, RegExp> = {
  contentIds: /"dnd\.srd521\./,
  keyBranches: /key === "/,
  slugBranches: /(slug|picked) === "/,
  nameRegex: /\.test\([^)]*(nameEn|\.name\b|\.text\b)/,
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "data" ? [] : files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("V0.9: hardcoded content in client code never grows (CLAUDE.md §2)", () => {
  const lines = files("client").flatMap((path) => readFileSync(path, "utf8").split("\n").map((line, index) => ({ at: `${path}:${index + 1}`, line })));
  for (const [kind, pattern] of Object.entries(PATTERNS) as Array<[keyof typeof CEILINGS, RegExp]>) {
    const hits = lines.filter((item) => pattern.test(item.line));
    assert.ok(hits.length <= CEILINGS[kind], `${kind}: ${hits.length} > ${CEILINGS[kind]} — move the new one to JSON (CLAUDE.md §2)\n${hits.map((item) => item.at).join("\n")}`);
    if (hits.length < CEILINGS[kind]) console.log(`hardcode ${kind}: ${hits.length} — lower the ceiling from ${CEILINGS[kind]}`);
  }
});

test("H2: the combat grammar takes its content as data — a module spell id works like the SRD one (D239)", async () => {
  const { parseContract } = await import("../../client/rules/contract");
  const { contractEffect } = await import("../../client/rules/contractEffects");
  const contract = parseContract({ id: "feature:module.stalker", entryPoints: [{ id: "rule", invocation: "manual", operations: [
    { kind: "property.modify", property: "marked-spell.die", operation: "set", value: { value: 12 }, spell: "module.spell.hunters-brand" },
    { kind: "property.modify", property: "marked-spell.advantage", operation: "set", value: { value: 1 }, spell: "module.spell.hunters-brand" },
    { kind: "property.modify", property: "spell.damage.ability-modifier", operation: "add", value: { ref: "effect.target" } },
    { kind: "property.modify", property: "spell.school-damage.ability-modifier", operation: "set", value: { value: "sorcerer" }, school: "necromancy" },
  ] }] } as never, "module.stalker");
  const { application } = contractEffect(contract, (ref) => (ref === "effect.target" ? "module.spell.void-bolt" : undefined));
  assert.deepEqual(application.markedSpellDice, { "module.spell.hunters-brand": 12 });
  assert.deepEqual(application.markedSpellAdvantage, ["module.spell.hunters-brand"]);
  assert.deepEqual(application.spellDamageModifier, ["module.spell.void-bolt"]);
  assert.deepEqual(application.schoolDamageModifier, [{ school: "necromancy", classSlug: "sorcerer" }]);
});

test("H3: a gain entry point is creation grammar, not a standing property, and the SRD features read it (D240)", async () => {
  const { parseContract } = await import("../../client/rules/contract");
  const { contractEffect } = await import("../../client/rules/contractEffects");
  const { pcStats } = await import("../../client/rules/actions");
  const { build } = await import("./support");
  const contract = parseContract({ id: "feature:module.sage", entryPoints: [{ id: "gain", invocation: "gain", operations: [
    { kind: "property.modify", property: "choice.skills", operation: "set", value: { value: 2 }, params: { id: "sage-skills", mode: "expertise", from: ["arcana", "history"] } },
    { kind: "property.modify", property: "grant.ability", operation: "set", value: { value: 2 }, params: { abilities: ["int"], cap: 22 } },
  ] }] } as never, "module.sage");
  assert.deepEqual(contract.unsupported, []);
  assert.equal(contract.entryPoints[0].operations[0].kind === "property.modify" && contract.entryPoints[0].operations[0].params?.id, "sage-skills");
  assert.equal(contractEffect(contract, () => undefined).hasProperties, false, "gained once, not a sheet property");
  // The SRD features that used to be branches in tracks.ts now come from their gain contracts.
  const monk = build({ name: "몽크", classes: "monk", level: 14 }).derived;
  assert.ok(["str", "dex", "con", "int", "wis", "cha"].every((key) => monk.saves[key as "str"].terms.some((term) => term.label.includes("단련된 생존자"))), "단련된 생존자: every save");
  const barbarian = build({ name: "바바리안", classes: "barbarian", level: 18 }).derived;
  assert.equal(pcStats(barbarian).minimumScore?.str, barbarian.abilities.str.score, "불굴의 힘: a Strength save totals at least the score");
  const rogue = build({ name: "로그", classes: "rogue", level: 1 });
  assert.equal(rogue.source.choices["class.0.expertise"]?.length, 2, "rogue expertise asked from its contract");
  assert.ok(rogue.derived.proficiencies.languages.includes("도둑 은어"));
});

test("H3c: armour, speed and saves come from gain contracts — and 보호의 오라 is counted once (D241)", async () => {
  const { build } = await import("./support");
  const paladin = build({ name: "팔라딘", classes: "paladin", level: 6, abilities: { cha: 16 } }).derived;
  assert.equal(paladin.saves.str.terms.filter((term) => term.label.includes("보호의 오라")).length, 1, JSON.stringify(paladin.saves.str.terms));
  const monk = build({ name: "몽크", classes: "monk", level: 6, abilities: { dex: 16, wis: 14 } }).derived;
  assert.equal(monk.ac.value, 10 + monk.abilities.dex.modifier + monk.abilities.wis.modifier, monk.ac.source);
  assert.ok(monk.speed.terms.some((term) => term.label.includes("비무장 이동") && term.value > 0), JSON.stringify(monk.speed.terms));
  const ranger = build({ name: "레인저", classes: "ranger", level: 6 }).derived;
  assert.equal(ranger.speed.climb, ranger.speed.walk, "방랑자 gives climb and swim at walking speed");
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 5 }).derived;
  assert.ok(sorcerer.hp.terms.some((term) => term.label.includes("용의 회복력") && term.value === 5), JSON.stringify(sorcerer.hp.terms));
});

test("H3d: option choices grant through contracts at their own level — 대지 유형 at 10, 원소의 친화력 at 6 (D242)", async () => {
  const { build } = await import("./support");
  const land9 = build({ name: "드루이드", classes: "druid", level: 9 }, { "class.0.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"], "class.2.subclass.land-type": ["polar"] }).derived;
  const land10 = build({ name: "드루이드", classes: "druid", level: 10 }, { "class.0.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"], "class.2.subclass.land-type": ["polar"] }).derived;
  assert.ok(!JSON.stringify(land9.defenses.resistances).includes("냉기") && !land9.defenses.resistances.includes("cold"), JSON.stringify(land9.defenses));
  assert.ok(JSON.stringify(land10.defenses.resistances).includes("냉기") || land10.defenses.resistances.includes("cold"), JSON.stringify(land10.defenses));
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 6 }, { "class.5.subclass.elemental-affinity": ["fire"] }).derived;
  assert.ok(sorcerer.damageTypeModifier?.includes("fire"), JSON.stringify(sorcerer.damageTypeModifier));
  const warden = build({ name: "드루이드", classes: "druid", level: 1 }, { "class.0.primal-order": ["warden"] }).derived;
  assert.ok(warden.proficiencies.armor.some((item) => item.includes("평장")), JSON.stringify(warden.proficiencies.armor));
});

test("H5a: an on-hit contract narrows itself by weapon and scales with its class level — a module rogue's own strike (D244)", async () => {
  const { parseContract, characterScope } = await import("../../client/rules/contract");
  const { contractRiders, riderFitsAttack } = await import("../../client/rules/attackRiders");
  const { build } = await import("./support");
  const contract = parseContract({ id: "feature:module.shadow-strike", entryPoints: [{ id: "on-hit", invocation: "on-hit", attack: { oncePerTurn: true, requiresEffects: [], scope: "finesse-or-ranged" }, operations: [
    { kind: "damage.apply", dice: "1d4", diceCount: { op: "ceil-div", left: { ref: "actor.class-level:dnd.srd521.class.fighter" }, right: { value: 2 } }, damageType: "weapon", target: "attack-target" },
  ] }] } as never, "module.shadow-strike");
  const fighter = build({ name: "투사", classes: "fighter", level: 5 }).derived;
  const [rider] = contractRiders(contract, "module.shadow-strike", "그림자 일격", characterScope(fighter));
  assert.equal(rider.damage[0].formula, "3d4");
  assert.equal(rider.moment, "on-hit");
  assert.ok(riderFitsAttack(rider, { properties: ["finesse", "light"], ability: "dex" } as never), "a rapier-like blade");
  assert.ok(riderFitsAttack(rider, { properties: ["ammunition"], ability: "dex", range: "80/320" } as never), "a bow");
  assert.ok(!riderFitsAttack(rider, { properties: ["heavy", "two-handed"], ability: "str" } as never), "not a greataxe");
});

test("H5c: a use is its contract — a chosen number of points, dice by level, the note — for a module feature too (D246)", async () => {
  const { parseContract, characterScope } = await import("../../client/rules/contract");
  const { contractUse } = await import("../../client/rules/contractActivation");
  const { build } = await import("./support");
  const contract = parseContract({ id: "feature:module.mending-touch", entryPoints: [{ id: "use", invocation: "manual", operations: [
    { kind: "resource.change", resource: "resource:module.mending-touch", amount: { ref: "use.points" }, target: "self" },
    { kind: "damage.apply", dice: "1d6", diceCount: { op: "if", args: [{ op: "gte", left: { ref: "actor.level" }, right: { value: 5 } }, { value: 3 }, { value: 1 }] }, damageType: "radiant", target: "area" },
    { kind: "adjudication.request", question: "추가 행동 · 고른 점수만큼 회복" },
  ] }] } as never, "module.mending-touch");
  assert.deepEqual(contract.unsupported, []);
  const use = contractUse(contract, characterScope(build({ name: "x", classes: "fighter", level: 6 }).derived), "치유의 손길")!;
  assert.equal(use.points, true);
  assert.equal(use.resourceId, "resource.module.mending-touch");
  assert.equal(use.roll?.formula, "3d6");
  assert.ok(use.note?.includes("추가 행동"));
  // And nothing guesses a button from a description any more.
  const { featureActivation } = await import("../../client/rules/activation");
  const derived = build({ name: "x", classes: "fighter", level: 1 }).derived;
  assert.equal(featureActivation({ id: "module.nothing", name: "무언가", source: "class", sourceLabel: "", description: "추가 행동으로 무언가를 합니다." } as never, derived), undefined);
});

test("H6a: which creatures a spell places is data — a module spell names its own (D248)", async () => {
  const { createCatalog } = await import("../../client/catalog");
  const { summonRule, summonsNothing } = await import("../../client/rules/summons");
  const spell = (slug: string, creatures: unknown) => ({ id: `module.spell.${slug}`, category: "spell", presentation: { originalName: slug, defaultLocale: "ko-KR", locales: { "ko-KR": { name: slug } } },
    mechanics: [{ kind: "spell-definition", config: { level: 2, castingTimeText: "행동", rangeText: "30피트", durationText: "1시간", classes: ["wizard"] } }, { kind: "spell-mechanic", config: { creatures } }] });
  createCatalog([{ moduleId: "module.bones", moduleVersion: "1", content: [spell("raise-bones", { choices: ["dnd.srd521.monster.skeleton", "module.monster.missing"], count: 2, note: "뼈" }), spell("mist-shape", { none: "안개일 뿐입니다." }), spell("call-rats", { filter: { creatureType: "beast", cr: "0" } })] } as never]);
  assert.deepEqual(summonRule("module.spell.raise-bones"), { spellId: "module.spell.raise-bones", choices: ["dnd.srd521.monster.skeleton"], count: 2, note: "뼈" });
  assert.equal(summonsNothing("module.spell.mist-shape"), "안개일 뿐입니다.");
  assert.equal(summonRule("module.spell.mist-shape"), undefined);
  assert.ok(summonRule("module.spell.call-rats")!.choices.includes("dnd.srd521.monster.rat"));
  createCatalog();
});

test("H6b: which spells answer a hit or a cast is data — a module reaction spell joins the SRD ones (D249)", async () => {
  const { createCatalog } = await import("../../client/catalog");
  const { reactionSpellIds } = await import("../../client/compendium/spells");
  createCatalog([{ moduleId: "module.ward", moduleVersion: "1", content: [{ id: "module.spell.bone-ward", category: "spell", presentation: { originalName: "Bone Ward", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "뼈 방벽" } } },
    mechanics: [{ kind: "spell-definition", config: { level: 1, castingTimeText: "반응", rangeText: "자신", durationText: "1라운드", classes: ["wizard"] } }, { kind: "spell-mechanic", config: { reaction: { trigger: "attack.hit-self" } } }] }] } as never]);
  assert.deepEqual(reactionSpellIds("attack.hit-self"), ["dnd.srd521.spell.shield", "module.spell.bone-ward"]);
  assert.deepEqual(reactionSpellIds("spell.cast-seen"), ["dnd.srd521.spell.counterspell"]);
  createCatalog();
});

test("H6c: a turn-end repeat save is a field — a pasted NPC and a module spell say so; spell effects are keyed by spell id (D250)", async () => {
  const { parseCustomMonster } = await import("../../client/compendium/customMonster");
  const { newJournalNpc } = await import("../../client/campaign/journal");
  const { npcSaveExec } = await import("../../client/rules/attackSpec");
  const { repeatsSaveAtTurnEnd } = await import("../../client/rules/spellcast");
  const { createCatalog } = await import("../../client/catalog");
  const { spellExec } = await import("../../client/compendium/spells");
  const { effectRuleKey } = await import("../../client/rules/effects");
  const parsed = parseCustomMonster(JSON.stringify({ name: "거미 마녀", ac: 13, hp: 30, abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, actions: [{ name: "마비 독", save: { ability: "con", dc: 12, conditions: ["paralyzed"], repeatSave: "turn-end" } }, { name: "독 침", save: { ability: "con", dc: 12, conditions: ["poisoned"] } }] }));
  assert.ok("monster" in parsed, JSON.stringify(parsed));
  const npc = newJournalNpc("c", "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  assert.equal(repeatsSaveAtTurnEnd(npcSaveExec(npc, "마비 독")!.spec.exec), true);
  assert.equal(repeatsSaveAtTurnEnd(npcSaveExec(npc, "독 침")!.spec.exec), false);
  const cat = createCatalog([{ moduleId: "module.web", moduleVersion: "1", content: [{ id: "module.spell.silk-bind", category: "spell", presentation: { originalName: "Silk Bind", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "비단 속박" } } },
    mechanics: [{ kind: "spell-definition", config: { level: 2, castingTimeText: "행동", rangeText: "30피트", durationText: "집중, 최대 1분", classes: ["wizard"] } }, { kind: "spell-mechanic", config: { repeatSave: "turn-end" } }] }] } as never]);
  assert.equal(repeatsSaveAtTurnEnd(spellExec("module.spell.silk-bind")!), true);
  assert.equal(effectRuleKey({ key: "spell:module.spell.silk-bind", source: "spell" } as never, cat), "spell:module.spell.silk-bind");
  assert.equal(effectRuleKey({ key: "spell:bless", source: "spell" } as never, cat), "spell:dnd.srd521.spell.bless", "an effect saved with a bare key still finds its spell");
  createCatalog();
});

test("H7a: a species trait gains through its contract — a module's pool and hit points, no trait keys in code (D251)", async () => {
  const { createCatalog } = await import("../../client/catalog");
  const { autofill } = await import("../../client/character/autofill");
  const { sourceOf } = await import("./support");
  const contract = (key: string, operations: unknown[]) => ({ id: `effect.feature.species.${key}`, category: "option", mechanics: [{ kind: "common-play", config: { id: `feature:species.${key}`, entryPoints: [{ id: "gain", invocation: "gain", operations }] } }] });
  const catalog = createCatalog([{ moduleId: "module.deep-dwarf", moduleVersion: "1", content: [
    contract("stonecunning", [{ kind: "property.modify", property: "grant.resource", operation: "set", value: { op: "add", args: [{ ref: "proficiency.bonus" }, { value: 4 }] }, params: { id: "resource.module.deep-sense", label: "깊은 감각", recovery: "short-rest" } }]),
    contract("dwarven-toughness", [{ kind: "property.modify", property: "grant.hp-per-level", operation: "add", value: { value: 2 }, params: { per: "character" } }]),
  ] } as never]);
  const derived = autofill(sourceOf({ name: "드워프", classes: "fighter", level: 5, species: "dwarf" }), catalog).derived;
  assert.deepEqual(derived.resources.filter((item) => item.id === "resource.module.deep-sense").map((item) => [item.max, item.recovery]), [[3 + 4, "짧은 휴식"]]);
  assert.ok(!derived.resources.some((item) => item.id === "resource.species.stonecunning"), "the SRD pool was the SRD contract's");
  assert.ok(derived.hp.breakdown.some((line) => line.includes("레벨당 +2")), JSON.stringify(derived.hp.breakdown));
  createCatalog();
});

test("H7b: a module subclass adds its own choice and a module species its own option effects, like the SRD extras (D252)", async () => {
  const { createCatalog } = await import("../../client/catalog");
  const { autofill } = await import("../../client/character/autofill");
  const { sourceOf } = await import("./support");
  const catalog = createCatalog([{ moduleId: "module.stances", moduleVersion: "1", content: [
    { id: "module.subclass.fighter.stance-master", category: "subclass", presentation: { originalName: "Stance Master", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "자세의 달인" } } }, relationships: [{ kind: "parent", target: "dnd.srd521.class.fighter" }],
      mechanics: [{ kind: "subclass-definition", config: { choices: [{ id: "subclass.stance", level: 3, label: "자세", description: "하나를 고릅니다.", options: [{ id: "iron", name: "강철", nameEn: "Iron", summary: "버팁니다." }, { id: "wind", name: "바람", nameEn: "Wind", summary: "흐릅니다." }] }] } }] },
    { id: "dnd.srd521.species.dragonborn", category: "species", mechanics: [{ kind: "species-definition", config: { effects: { "species.draconicAncestry": { red: { resistances: ["psychic"] } } } } }] },
  ] } as never]);
  const made = autofill(sourceOf({ name: "투사", classes: "fighter", level: 3, species: "dragonborn", choices: { "class.2.subclass": ["module.subclass.fighter.stance-master"], "class.2.subclass.stance": ["wind"], "origin.species.draconicAncestry": ["red"] } }), catalog);
  assert.ok(made.derived.features.some((feature) => feature.name === "자세: 바람"), made.derived.features.map((feature) => feature.name).join(", "));
  assert.ok(made.derived.defenses.resistances.some((type) => type === "정신" || type === "psychic"), JSON.stringify(made.derived.defenses));
  createCatalog();
});

test("H4: a class module's definition carries its training, resources, option pools and multiclass rules (D243)", async () => {
  const { createCatalog } = await import("../../client/catalog");
  const { autofill } = await import("../../client/character/autofill");
  const { sourceOf } = await import("./support");
  // An installed patch rewrites the fighter's definition; nothing in client code names what it now holds.
  const patch = { moduleId: "module.grit", moduleVersion: "1", content: [{ id: "dnd.srd521.class.fighter", category: "class", mechanics: [{ kind: "class-definition", config: {
    armorTraining: ["light"], weaponTraining: ["simple"],
    multiclass: { armor: [], weapons: [], prerequisites: { all: ["con"] } },
    resources: [{ id: "resource.module.grit", label: "투지", max: { op: "add", args: [{ ref: "class.level" }, { ref: "ability.con.modifier" }] }, recovery: "long-rest", minLevel: 1 }],
    optionPools: [{ id: "tricks", list: "sorcerer.metamagic", label: "요령", known: { "3": 1 } }],
  } }] }] };
  const catalog = createCatalog([patch as never]);
  const made = autofill(sourceOf({ name: "투사", classes: "fighter", level: 3, abilities: { con: 14 } }), catalog);
  const grit = made.derived.resources.find((resource) => resource.id === "resource.module.grit");
  assert.equal(grit?.max, 3 + 2, JSON.stringify(made.derived.resources));
  assert.ok(!made.derived.resources.some((resource) => resource.id === "resource.fighter.second-wind"), "the SRD pools are the SRD module's data, not code");
  assert.ok(!made.derived.proficiencies.armor.some((item) => item.includes("중갑")), JSON.stringify(made.derived.proficiencies.armor));
  assert.equal(made.source.choices["class.0.tricks"]?.length, 1, JSON.stringify(made.derived.choices.map((item) => item.id)));
  const multi = autofill(sourceOf({ name: "투사", classes: ["wizard", "fighter"], abilities: { con: 10, int: 13 } }), catalog);
  assert.ok(multi.derived.validation.blocking.some((line) => line.includes("건강 13")), JSON.stringify(multi.derived.validation.blocking));
});
