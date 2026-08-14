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

export type SpellPropertyKey = "fire" | "cold" | "lightning" | "acid" | "poison" | "psychic" | "radiant" | "necrotic" | "force" | "thunder" | "healing";
export type SpellVisualKey = SpellPropertyKey | `school:${string}`;
export type SpellVisual = { key: SpellVisualKey; label: string; source: "property" | "school" };
export type SpellUiFilter = "all" | "concentration" | "ritual" | "action" | "bonus" | "reaction";

const PROPERTY_PATTERNS: Array<{ key: SpellPropertyKey; label: string; patterns: RegExp[] }> = [
  { key:"fire", label:"화염", patterns:[/화염 피해/g] },
  { key:"cold", label:"냉기", patterns:[/냉기 피해/g] },
  { key:"lightning", label:"번개", patterns:[/번개 피해/g] },
  { key:"acid", label:"산성", patterns:[/산성 피해/g, /산 피해/g] },
  { key:"poison", label:"독", patterns:[/독성 피해/g, /독 피해/g] },
  { key:"psychic", label:"정신", patterns:[/정신 피해/g] },
  { key:"radiant", label:"광휘", patterns:[/광휘 피해/g] },
  { key:"necrotic", label:"괴저", patterns:[/괴저 피해/g] },
  { key:"force", label:"역장", patterns:[/역장 피해/g] },
  { key:"thunder", label:"천둥", patterns:[/천둥 피해/g] },
  { key:"healing", label:"회복", patterns:[/히트 포인트[^.\n]{0,60}회복/g, /회복[^.\n]{0,60}히트 포인트/g] },
];

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

export function isConcentrationSpell(spell: SpellPresentation) {
  return /집중/.test(spell.duration);
}

export function spellVisual(spell: SpellPresentation): SpellVisual {
  const text = `${spell.summary}\n${spell.description}`;
  let best: { index:number; key:SpellPropertyKey; label:string } | undefined;
  for (const candidate of PROPERTY_PATTERNS) {
    for (const pattern of candidate.patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match && (!best || match.index < best.index)) best = { index:match.index, key:candidate.key, label:candidate.label };
    }
  }
  if (best) return { key:best.key, label:best.label, source:"property" };
  return { key:`school:${spell.school}`, label:spellSchoolLabel(spell), source:"school" };
}

export function spellMatchesFilter(spell: SpellPresentation, filter: SpellUiFilter) {
  if (filter === "all") return true;
  if (filter === "concentration") return isConcentrationSpell(spell);
  if (filter === "ritual") return spell.ritual;
  if (filter === "bonus") return /보너스 행동|추가 행동/.test(spell.castingTime);
  if (filter === "reaction") return /반응/.test(spell.castingTime);
  if (filter === "action") return /행동/.test(spell.castingTime) && !/보너스 행동|추가 행동/.test(spell.castingTime);
  return true;
}

export function spellSearchText(spell: SpellPresentation) {
  return `${spell.name} ${spell.nameEn} ${spellSchoolLabel(spell)} ${spellVisual(spell).label}`.toLocaleLowerCase("ko-KR");
}

export function spellDetailLines(spell: SpellPresentation) {
  return [
    `${spellLevelLabel(spell)} · ${spellSchoolLabel(spell)}${spell.ritual ? " · 의식" : ""}${isConcentrationSpell(spell) ? " · 집중" : ""}`,
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
