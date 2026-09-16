/**
 * R62 (ROLL20_TABLE_SPEC.md D197): the machine-readable half of thirteen PHB 2024 feats, as a *patch* module.
 *
 * The supplement ships every feat as `execution.status: "descriptive"` — an ability increase, a prerequisite and
 * prose — and `content/supplements/phb-2024.feat-common-play` (R56) gave each one a contract. What neither could do
 * is answer the questions a feat asks at creation: 회복력's saving throw, 기술 전문가's expertise, 원소 숙련자's
 * element, 요정의 손길's spells. Those were `adjudication.request` sentences the sheet printed and nothing read.
 *
 * This module carries nothing but `feat-definition` config deltas. The catalog merges an installed entry onto the
 * one already there (D197), matching mechanics by kind and merging their configs key by key, so installing this
 * next to the supplement adds the keys without restating one word of the supplement's own text.
 *
 * Run: node scripts/author-phb-feat-config-patch.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";

const SPELL = (slug) => `dnd.srd521.spell.${slug}`;
const ELEMENTS = ["acid", "cold", "fire", "lightning", "thunder"];
const ENERGIES = ["acid", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

/** One patched feat: the slug, why it is patched, and the config keys to merge in. */
const PATCHES = [
  ["resilient", "올린 능력치의 내성 굴림 숙련", {
    saveProficiencyChoice: { follows: "ability-increase" },
    execution: { status: "derived", reason: "R62 (D197): the save follows the ability this feat raised — no second question" },
  }],
  ["skill-expert", "기술 하나에 숙련, 숙련된 기술 하나에 전문화", {
    proficiencyChoice: { count: 1, kinds: ["skill"] },
    expertiseChoice: { count: 1 },
    execution: { status: "selection", reason: "R62 (D197): both picks are asked at creation and land on the sheet" },
  }],
  ["boon-of-skill", "모든 기술에 숙련, 전문화 하나", {
    allSkillProficiencies: true,
    expertiseChoice: { count: 1 },
    execution: { status: "selection", reason: "R62 (D197): every skill is granted; the expertise is asked at creation" },
  }],
  ["keen-mind", "학식 — 다섯 기술 중 하나에 숙련 또는 전문화", {
    proficiencyChoice: { count: 1, kinds: ["skill"], skills: ["arcana", "history", "investigation", "nature", "religion"], upgradeToExpertise: true },
    execution: { status: "selection", reason: "R62 (D197): the pick upgrades to expertise when the skill is already proficient" },
  }],
  ["observant", "예리한 관찰자 — 세 기술 중 하나에 숙련 또는 전문화", {
    proficiencyChoice: { count: 1, kinds: ["skill"], skills: ["insight", "investigation", "perception"], upgradeToExpertise: true },
    execution: { status: "selection", reason: "R62 (D197): the pick upgrades to expertise when the skill is already proficient" },
  }],
  ["weapon-master", "통달 속성 — 숙련된 단순·군용 무기 한 종류", {
    weaponMasteryChoice: { count: 1, filter: "all-simple-or-martial" },
    execution: { status: "selection", reason: "R62 (D197): the chosen weapon's mastery property becomes active on the sheet" },
  }],
  ["elemental-adept", "에너지 숙련 — 고른 유형의 저항을 무시", {
    ignoreResistanceChoice: { count: 1, any: ELEMENTS },
    execution: { status: "common-play", reason: "R62 (D197): the chosen type reaches the resolver as `ignoresResistance`; the die-minimum stays on the contract" },
  }],
  ["boon-of-energy-resistance", "에너지 저항 — 두 유형에 저항", {
    resistanceChoice: { count: 2, any: ENERGIES },
    execution: { status: "common-play", reason: "R62 (D197): the two types land in the sheet's defenses; 에너지 전환 stays the table's reaction" },
  }],
  ["fey-touched", "요정 마법 — 안개 걸음을 항상 준비", {
    grantSpells: [SPELL("misty-step")],
    freeCastReset: "long-rest",
    execution: { status: "selection", reason: "R62 (D197): 안개 걸음 is always prepared with one free casting; the school-restricted pick stays the table's" },
  }],
  ["shadow-touched", "그림자 마법 — 투명화를 항상 준비", {
    grantSpells: [SPELL("invisibility")],
    freeCastReset: "long-rest",
    execution: { status: "selection", reason: "R62 (D197): 투명화 is always prepared with one free casting; the school-restricted pick stays the table's" },
  }],
  ["telepathic", "생각 탐지를 항상 준비", {
    grantSpells: [SPELL("detect-thoughts")],
    freeCastReset: "long-rest",
    execution: { status: "selection", reason: "R62 (D197): 생각 탐지 is always prepared with one free casting per long rest" },
  }],
  ["telekinetic", "소규모 염동력 — 마법사의 손을 배움", {
    grantCantrips: [SPELL("mage-hand")],
    execution: { status: "selection", reason: "R62 (D197): the cantrip is learned; the range bonus and 염동 밀치기 stay on the contract" },
  }],
  ["ritual-caster", "의식 주문 — 숙련 보너스만큼 항상 준비", {
    grantSpellChoice: { count: "proficiency-bonus", spellList: ["cleric", "druid", "wizard"], levels: [1], ritual: true },
    resources: [{ id: "resource.feat.ritual-caster", label: "빠른 의식", max: 1, reset: "long-rest" }],
    execution: { status: "selection", reason: "R62 (D197): the ritual spells are asked at creation; 빠른 의식 becomes a per-long-rest pool" },
  }],
];

const module_ = {
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json",
  schemaVersion: "0.1-draft",
  moduleId: "phb-2024.feat-config-patch",
  moduleVersion: "0.1-draft",
  rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR",
  source: { document: "Player's Handbook", version: "2024", license: "not-srd", srdDerived: false },
  dependencies: [{ moduleId: "phb-2024-supplement", version: "1" }],
  conflicts: [],
  capabilities: [],
  extensionPoints: [],
  /**
   * No `presentation` on any entry: that is what tells the catalog to keep the supplement's own name and prose.
   * `tags` are merged, so `common-play` is not repeated here either.
   */
  content: PATCHES.map(([slug, note, config]) => ({
    id: `phb2024.feat.${slug}`,
    category: "feat",
    tags: ["feat", "phb-2024", "config-patch"],
    mechanics: [{ kind: "feat-definition", config: { ...config, patchNote: note } }],
  })),
};

mkdirSync("content/supplements/phb-2024.feat-config-patch", { recursive: true });
writeFileSync("content/supplements/phb-2024.feat-config-patch/module.json", `${JSON.stringify(module_, null, 1)}\n`);
console.log(`patched feats: ${module_.content.length}`);
