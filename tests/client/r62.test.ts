/**
 * R62 (ROLL20_TABLE_SPEC.md D197): a patch module fills in the machine half of somebody else's feats.
 *
 * The PHB 2024 supplement writes every feat as prose. R56 gave each one a contract, but the sentences that ask the
 * player a question — 회복력's saving throw, 기술 전문가's expertise, 원소 숙련자's element, 요정의 손길's spells —
 * stayed `adjudication.request`: printed on the sheet and read by nothing. `phb-2024.feat-config-patch` carries only
 * `feat-definition` config deltas, and the catalog merges them onto the supplement's entry rather than replacing it,
 * so the owner's own file is never edited and not one word of its text is restated.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCatalog } from "../../client/catalog";
import { deriveCharacter } from "../../client/character/derive";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { featureContract } from "../../client/rules/contractActivation";
import { ids } from "./support";

const PATCH = JSON.parse(readFileSync("content/supplements/phb-2024.feat-config-patch/module.json", "utf8")) as { content: Array<{ id: string; tags: string[]; mechanics: Array<{ kind: string; config: Record<string, unknown> }> }> };
const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8")) as unknown;

/** The prose the supplement ships, kept short here; the point is that the patch leaves it alone. */
const PROSE: Record<string, string> = {
  resilient: "위에서 올린 능력치의 내성 굴림에 숙련을 얻는다.",
  "skill-expert": "숙련되어 있지만 전문화가 없는 기술 하나를 선택해 전문화를 얻는다.",
  "keen-mind": "숙련이 없다면 숙련을, 이미 숙련되어 있다면 전문화를 얻는다.",
  "elemental-adept": "자신이 시전한 주문은 선택한 피해 유형에 대한 저항을 무시한다.",
  "fey-touched": "그 주문과 안개 걸음을 항상 준비한다.",
  telekinetic: "마법사의 손 주문을 배운다.",
  "weapon-master": "그 무기의 통달 속성을 사용할 수 있다.",
  "boon-of-energy-resistance": "두 피해 유형을 선택해 저항을 얻는다.",
  "ritual-caster": "의식 태그가 있는 1레벨 주문을 숙련 보너스와 같은 수만큼 선택한다.",
  "boon-of-skill": "모든 기술에 숙련을 얻는다.",
};

const NAMES: Record<string, string> = {
  resilient: "회복력", "skill-expert": "기술 전문가", "keen-mind": "예리한 정신", "elemental-adept": "원소 숙련자",
  "fey-touched": "요정의 손길", telekinetic: "염동력", "weapon-master": "무기 달인",
  "boon-of-energy-resistance": "에너지 저항의 은총", "ritual-caster": "의식 시전자", "boon-of-skill": "기술의 은총",
};

/** The supplement's own entry: a name, the prose, and `descriptive` — exactly what the owner's file ships. */
const featEntry = (slug: string, increase: Record<string, unknown>) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: slug, locales: { "ko-KR": { name: NAMES[slug], summary: "PHB 2024 재주", description: PROSE[slug] } } },
  tags: ["feat", "phb-2024"],
  mechanics: [{ kind: "feat-definition", config: { tier: slug.startsWith("boon-") ? "epic-boon" : "general", minimumLevel: slug.startsWith("boon-") ? 19 : 4, abilityIncrease: increase, execution: { status: "descriptive", reason: "supplement feat" } } }],
});

const INCREASE: Record<string, Record<string, unknown>> = {
  resilient: { amount: 1, maximum: 20 },
  "skill-expert": { amount: 1, maximum: 20 },
  "keen-mind": { any: ["int"], amount: 1, maximum: 20 },
  "elemental-adept": { any: ["int", "wis", "cha"], amount: 1, maximum: 20 },
  "fey-touched": { any: ["int", "wis", "cha"], amount: 1, maximum: 20 },
  telekinetic: { any: ["int", "wis", "cha"], amount: 1, maximum: 20 },
  "weapon-master": { any: ["str", "dex"], amount: 1, maximum: 20 },
  "boon-of-energy-resistance": { amount: 1, maximum: 30 },
  "ritual-caster": { any: ["int", "wis", "cha"], amount: 1, maximum: 20 },
  "boon-of-skill": { amount: 1, maximum: 30 },
};

const supplement = (slugs: string[]) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [],
  content: slugs.map((slug) => featEntry(slug, INCREASE[slug])),
});

/** The install order the patch is written for: the supplement, its contracts, then the patch on top. */
function withFeat(slug: string, level: number, prefer: Record<string, string[]> = {}, answers: Record<string, string[]> = {}) {
  const catalog = createCatalog([supplement([slug]), CONTRACTS, PATCH] as never);
  const base = emptySource({
    name: "실험체", origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 15, dex: 12, con: 14, int: 13, wis: 10, cha: 8 } },
    tracks: Array.from({ length: level }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const key = level >= 19 ? "class.18.epic-boon" : "class.3.asi";
  const made = autofill(base, catalog, { prefer: { [key]: [`phb2024.feat.${slug}`], ...prefer } });
  /**
   * Answers the player gives in order. `autofill` sweeps the whole sheet repeatedly, so a pick that only becomes
   * legal *because of an earlier pick in the same feat* (기술 전문가's expertise needs its own proficiency first)
   * is refused on the sweep that sees neither. Setting them on the source is the wizard's own order.
   */
  const source = Object.keys(answers).length ? { ...made.source, choices: { ...made.source.choices, ...answers } } : made.source;
  return { catalog, made, derived: deriveCharacter(source, catalog), prefix: `feat.${key}.phb2024.feat.${slug}` };
}

test("R62: the patch merges onto the supplement's entry instead of replacing it (D197)", () => {
  const slugs = Object.keys(NAMES);
  const catalog = createCatalog([supplement(slugs), CONTRACTS, PATCH] as never);
  for (const slug of slugs) {
    const feat = catalog.featById(`phb2024.feat.${slug}`)!;
    assert.ok(feat, slug);
    // The owner's words: untouched. The patch ships no presentation at all, which is what keeps them.
    assert.equal(feat.name, NAMES[slug], `${slug}: the supplement's name survives the patch`);
    assert.equal(feat.description, PROSE[slug], `${slug}: the supplement's prose survives the patch`);
    // The supplement's own config keys: kept. The patch's: added.
    assert.equal(feat.config.minimumLevel, slug.startsWith("boon-") ? 19 : 4, slug);
    assert.deepEqual(feat.abilityIncrease?.any ?? null, (INCREASE[slug].any as string[] | undefined) ?? null, slug);
    assert.ok(typeof feat.config.patchNote === "string", `${slug}: the patch's keys reached the merged entry`);
    assert.notEqual((feat.config.execution as { status?: string })?.status, "descriptive", `${slug}: no longer prose the app only prints`);
    const merged = catalog.entry(`phb2024.feat.${slug}`)!;
    assert.ok(merged.tags.includes("config-patch") && merged.tags.includes("phb-2024"), merged.tags.join("/"));
    assert.equal(merged.moduleId, "phb-2024-supplement", "the text is still the supplement's, so the entry still says so");
  }
  // R56's contract is registered from the merged entry, so patching a feat never costs it its contract.
  assert.ok(featureContract(catalog, "feat:elemental-adept"), "the common-play contract survives the merge");
  assert.ok(featureContract(catalog, "feat:keen-mind"));
});

test("R62: 회복력 takes the saving throw of the ability it raised, without asking twice (D197)", () => {
  const { derived, prefix } = withFeat("resilient", 4, { "feat.class.3.asi.phb2024.feat.resilient.ability": ["wis"] });
  assert.equal(derived.saves.wis.proficient, true, "the save follows the ability increase");
  assert.equal(derived.abilities.wis.score, 11, "and the increase itself still happened");
  assert.equal(derived.choices.some((item) => item.id === `${prefix}.save`), false, "no second question");
});

test("R62: 기술 전문가 grants a skill and expertise in a skill already proficient (D197)", () => {
  const { derived } = withFeat("skill-expert", 4, {}, {
    "feat.class.3.asi.phb2024.feat.skill-expert.proficiencies": ["nature"],
    "feat.class.3.asi.phb2024.feat.skill-expert.expertise": ["nature"],
  });
  const nature = derived.skills.find((skill) => skill.id === "nature")!;
  assert.equal(nature.proficient, true);
  assert.equal(nature.expertise, true);
  assert.equal(nature.bonus, derived.abilities.int.modifier + derived.proficiencyBonus * 2, "expertise doubles the bonus that exists");
});

test("R62: 예리한 정신 upgrades a skill it already has, and only offers its own five (D197)", () => {
  const plain = withFeat("keen-mind", 4, { "feat.class.3.asi.phb2024.feat.keen-mind.proficiencies": ["arcana"] });
  const offered = plain.derived.choices.find((item) => item.id.endsWith(".proficiencies"))!;
  assert.deepEqual(offered.options.map((option) => option.id), ["arcana", "history", "investigation", "nature", "religion"]);
  assert.equal(plain.derived.skills.find((skill) => skill.id === "arcana")!.proficient, true);
  assert.equal(plain.derived.skills.find((skill) => skill.id === "arcana")!.expertise, false);

  // 역사 is on both the fighter's skill list and 예리한 정신's five, so the same pick has to upgrade instead.
  const already = withFeat("keen-mind", 4, { "class.0.skills": ["history", "athletics"] }, { "feat.class.3.asi.phb2024.feat.keen-mind.proficiencies": ["history"] });
  const history = already.derived.skills.find((skill) => skill.id === "history")!;
  assert.equal(history.proficient, true, "the class already gave it");
  assert.equal(history.expertise, true, "so the feat's pick becomes expertise, not a second proficiency");
});

test("R62: 원소 숙련자's element reaches the sheet the resolver reads (D197)", () => {
  const { derived } = withFeat("elemental-adept", 4, { "feat.class.3.asi.phb2024.feat.elemental-adept.ignore-resistance": ["fire"] });
  assert.deepEqual(derived.ignoresResistance, ["fire"]);
  const offered = derived.choices.find((item) => item.id.endsWith(".ignore-resistance"))!;
  assert.deepEqual(offered.options.map((option) => option.id), ["acid", "cold", "fire", "lightning", "thunder"]);
});

test("R62: 에너지 저항의 은총 puts its two chosen types in the sheet's defenses (D197)", () => {
  const { derived } = withFeat("boon-of-energy-resistance", 19, { "feat.class.18.epic-boon.phb2024.feat.boon-of-energy-resistance.resistances": ["fire", "psychic"] });
  assert.deepEqual(derived.defenses.resistances.sort(), ["정신", "화염"].sort());
});

test("R62: 무기 달인 turns on the mastery of the weapon it picked (D197)", () => {
  const { derived } = withFeat("weapon-master", 4, { "feat.class.3.asi.phb2024.feat.weapon-master.weapon-mastery": ["dnd.srd521.item.weapon.greatsword"] });
  assert.ok(derived.weaponMasteries.includes("대검"), derived.weaponMasteries.join("/"));
});

test("R62: the spell feats hand over their spells, with the ability the feat raised (D197)", () => {
  const fey = withFeat("fey-touched", 4, { "feat.class.3.asi.phb2024.feat.fey-touched.ability": ["cha"] });
  const entry = fey.derived.spellcasting.find((item) => item.key.endsWith(":grant"))!;
  assert.ok(entry, JSON.stringify(fey.derived.spellcasting.map((item) => item.key)));
  assert.equal(entry.ability, "cha", "주문 시전 능력은 이 재주로 올린 능력치");
  assert.ok(entry.alwaysPrepared.includes("dnd.srd521.spell.misty-step"));
  const pool = fey.derived.resources.find((item) => item.freeCastSpellId === "dnd.srd521.spell.misty-step")!;
  assert.ok(pool, JSON.stringify(fey.derived.resources.map((item) => item.id)));
  assert.equal(pool.max, 1);

  const tele = withFeat("telekinetic", 4, { "feat.class.3.asi.phb2024.feat.telekinetic.ability": ["int"] });
  const cantrips = tele.derived.spellcasting.find((item) => item.key.endsWith(":grant"))!;
  assert.deepEqual(cantrips.cantrips, ["dnd.srd521.spell.mage-hand"], "a cantrip is learned, not given a free-cast pool");
  assert.equal(tele.derived.resources.some((item) => item.freeCastSpellId === "dnd.srd521.spell.mage-hand"), false);
});

test("R62: 의식 시전자 asks for proficiency-bonus many 1st-level rituals, and nothing else (D197)", () => {
  const { derived } = withFeat("ritual-caster", 4);
  const offered = derived.choices.find((item) => item.id.endsWith(".granted-spells"))!;
  assert.ok(offered, derived.choices.map((item) => item.id).join("\n"));
  assert.equal(offered.count, derived.proficiencyBonus, "숙련 보너스와 같은 수");
  assert.ok(offered.options.length > 0);
  assert.ok(offered.options.every((option) => option.group === "1레벨"), offered.options.map((option) => option.group).join("/"));
  assert.ok(derived.resources.some((item) => item.id === "resource.feat.ritual-caster"), "빠른 의식 is a per-long-rest pool");
});

test("R62: 기술의 은총 grants every skill and one expertise (D197)", () => {
  const { derived } = withFeat("boon-of-skill", 19, { "feat.class.18.epic-boon.phb2024.feat.boon-of-skill.expertise": ["stealth"] });
  assert.equal(derived.skills.every((skill) => skill.proficient), true, derived.skills.filter((skill) => !skill.proficient).map((skill) => skill.id).join("/"));
  assert.equal(derived.skills.find((skill) => skill.id === "stealth")!.expertise, true);
});
