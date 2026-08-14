import catalogJson from "../generated/spellPresentationCatalog.generated.json";
import type { CharacterCreationOptionVm } from "./contracts";

export type SpellPresentation = {
  id: string;
  name: string;
  nameEn: string;
  level: number;
  school: string;
  ritual: boolean;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  summary: string;
  description: string;
};

type SpellPresentationCatalog = {
  formatVersion: string;
  rulesProfileId: string;
  locale: string;
  count: number;
  source: {
    document: string;
    version: string;
    license: string;
    repository: string;
    revision: string;
    bundlePaths: string[];
  };
  spells: SpellPresentation[];
};

const CATALOG = catalogJson as SpellPresentationCatalog;
const BY_ID = new Map(CATALOG.spells.map((spell) => [spell.id, spell]));
const BY_EN = new Map(CATALOG.spells.map((spell) => [spell.nameEn.toLocaleLowerCase("en-US"), spell]));

const SCHOOL_LABELS: Record<string, string> = {
  abjuration: "방호술",
  conjuration: "창조술",
  divination: "예지술",
  enchantment: "환혹술",
  evocation: "방출술",
  illusion: "환영술",
  necromancy: "사령술",
  transmutation: "변환술",
};

export const SPELL_PRESENTATION_COUNT = CATALOG.count;
export const SPELL_PRESENTATION_SOURCE = CATALOG.source;
export const SPELL_PRESENTATIONS: readonly SpellPresentation[] = CATALOG.spells;

export function spellPresentationById(id: string) {
  return BY_ID.get(id);
}

export function spellPresentationByEnglish(nameEn: string) {
  return BY_EN.get(nameEn.toLocaleLowerCase("en-US"));
}

export function spellNameKo(id: string, fallback?: string) {
  return spellPresentationById(id)?.name ?? fallback ?? id;
}

export function hasLocalizedSpellName(id: string) {
  return BY_ID.has(id);
}

export function isGenericSpellSummary(summary?: string) {
  return summary === "SRD 소마법" || summary === "SRD 1레벨 주문";
}

export const SPELL_DESCRIPTION_PENDING = "상세 SRD 주문 설명은 아직 presentation catalog에 연결되지 않았습니다.";

export function spellLevelLabel(spell: SpellPresentation) {
  return spell.level === 0 ? "소마법" : `${spell.level}레벨 주문`;
}

export function spellSchoolLabel(spell: SpellPresentation) {
  return SCHOOL_LABELS[spell.school] ?? spell.school;
}

export function spellDetailLines(spell: SpellPresentation) {
  return [
    `${spellLevelLabel(spell)} · ${spellSchoolLabel(spell)}${spell.ritual ? " · 의식" : ""}`,
    `시전 시간 · ${spell.castingTime}`,
    `사거리 · ${spell.range}`,
    `구성요소 · ${spell.components}`,
    `지속시간 · ${spell.duration}`,
  ];
}

export function decorateSpellOption(option: CharacterCreationOptionVm): CharacterCreationOptionVm {
  const spell = spellPresentationById(option.id);
  if (!spell) return option;
  return {
    ...option,
    name: spell.name,
    nameEn: spell.nameEn,
    summary: spell.summary,
    description: spell.description,
    detailLines: spellDetailLines(spell),
    source: `SRD 5.2.1 · ${CATALOG.source.revision.slice(0, 8)}`,
  };
}
