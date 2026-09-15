/**
 * What pressing "사용" on a feature or "시전" on a spell does at the table: which pool it spends, whether it starts a
 * timed effect (Rage: 1 minute, ten rounds), whether it heals or grants temporary HP, and how a duration string from
 * the spell catalog ("집중, 최대 1분", "즉시", "8시간") maps to concentration and a round counter.
 */
import type { DerivedCharacter, DerivedFeature } from "../character/types";

export interface ParsedDuration {
  text: string;
  instantaneous: boolean;
  concentration: boolean;
  /** Rounds to count down when the duration is short enough to track turn by turn (≤ 100 rounds). */
  rounds?: number;
}

const ROUNDS_PER: Array<[RegExp, number]> = [[/(\d+)\s*라운드/, 1], [/(\d+)\s*분/, 10], [/(\d+)\s*시간/, 600], [/(\d+)\s*일/, 14400]];

export function parseDuration(text: string | undefined): ParsedDuration {
  const value = (text ?? "").trim();
  if (!value || value === "즉시" || value === "순간") return { text: value || "즉시", instantaneous: true, concentration: false };
  const concentration = /집중/.test(value);
  let rounds: number | undefined;
  for (const [pattern, perUnit] of ROUNDS_PER) {
    const match = pattern.exec(value);
    if (match) { rounds = Number(match[1]) * perUnit; break; }
  }
  return { text: value, instantaneous: false, concentration, rounds: rounds !== undefined && rounds <= 100 ? rounds : undefined };
}

export interface FeatureActivation {
  /** Pool spent per use (`derived.resources` id). Missing: the use is only logged. */
  resourceId?: string;
  /** Spend a chosen number of points from the pool (Lay on Hands) instead of one use. */
  points?: boolean;
  /** Timed effect started by the use; the sheet shows it with a "종료" button and counts rounds when given. */
  duration?: (derived: DerivedCharacter) => ParsedDuration;
  /** Dice formula healed on use (Second Wind) or granted as temporary HP (Tireless). */
  heal?: (derived: DerivedCharacter) => string;
  tempHp?: (derived: DerivedCharacter) => string;
  /** Short reminder shown next to the button ("추가 행동"). */
  note?: string;
}

const classLevel = (derived: DerivedCharacter, slug: string) => derived.classes.find((cls) => cls.classId.endsWith(`.${slug}`) || cls.classId === slug)?.level ?? 0;
const timed = (text: string, rounds?: number, concentration = false): ParsedDuration => ({ text, instantaneous: false, concentration, rounds });

const FEATURE_ACTIVATIONS: Record<string, FeatureActivation> = {
  "barbarian.rage": { resourceId: "resource.barbarian.rage", duration: () => timed("1분 (10라운드)", 10), note: "추가 행동. 턴이 끝날 때 공격도 피해도 없었으면 종료" },
  "fighter.second-wind": { resourceId: "resource.fighter.second-wind", heal: (derived) => `1d10+${classLevel(derived, "fighter")}`, note: "추가 행동 · 1d10 + 파이터 레벨 회복" },
  "fighter.action-surge": { resourceId: "resource.fighter.action-surge", note: "이번 턴에 행동 하나 추가" },
  "fighter.indomitable": { resourceId: "resource.fighter.indomitable", note: "실패한 내성 굴림 재굴림 (+파이터 레벨)" },
  "bard.bardic-inspiration": { resourceId: "resource.bard.bardic-inspiration", note: "추가 행동 · 아군에게 영감 주사위" },
  "cleric.channel-divinity": { resourceId: "resource.cleric.channel-divinity" },
  "cleric.divine-intervention": { resourceId: "resource.cleric.divine-intervention", note: "행동 · 5레벨 이하 클레릭 주문 무료 시전" },
  "druid.wild-shape": { resourceId: "resource.druid.wild-shape", duration: (derived) => timed(`${Math.max(1, Math.floor(classLevel(derived, "druid") / 2))}시간`), note: "추가 행동 · 야수 형태" },
  "druid.wild-resurgence": { resourceId: "resource.druid.wild-resurgence" },
  "monk.focus": { resourceId: "resource.monk.focus", note: "기 점수 1 소비 (질풍 연타 · 인내의 방어 · 바람의 걸음)" },
  "monk.stunning-strike": { resourceId: "resource.monk.focus", note: "기 점수 1 소비 · 건강 내성 아니면 충격" },
  "monk.uncanny-metabolism": { resourceId: "resource.monk.uncanny-metabolism", note: "이니셔티브 굴릴 때 · 기 점수 전부 회복" },
  "paladin.lay-on-hands": { resourceId: "resource.paladin.lay-on-hands", points: true, note: "행동 · 점수만큼 HP 회복 (5점 = 중독 해제)" },
  "paladin.channel-divinity": { resourceId: "resource.paladin.channel-divinity" },
  "paladin.smite": { resourceId: "resource.paladin.smite", note: "긴 휴식마다 한 번 슬롯 없이 신성한 강타" },
  "paladin.faithful-steed": { resourceId: "resource.paladin.faithful-steed" },
  "ranger.favored-enemy": { resourceId: "resource.ranger.favored-enemy", duration: () => timed("집중, 최대 1시간", undefined, true), note: "사냥꾼의 표식 무료 시전" },
  "ranger.tireless": { resourceId: "resource.ranger.tireless", tempHp: (derived) => `1d8+${Math.max(0, derived.abilities.wis.modifier)}`, note: "행동 · 임시 HP 1d8 + 지혜" },
  "ranger.natures-veil": { resourceId: "resource.ranger.natures-veil", duration: () => timed("다음 턴 시작까지", 1), note: "추가 행동 · 투명" },
  "rogue.stroke-of-luck": { resourceId: "resource.rogue.stroke-of-luck" },
  "sorcerer.innate-sorcery": { resourceId: "resource.sorcerer.innate-sorcery", duration: () => timed("1분 (10라운드)", 10), note: "추가 행동 · 주문 DC +1, 주문 명중 유리" },
  "sorcerer.font-of-magic": { resourceId: "resource.sorcerer.sorcery-points", note: "마법 점수 1 소비" },
  "warlock.magical-cunning": { resourceId: "resource.warlock.magical-cunning", note: "1분 · 계약 슬롯 절반 회복" },
  "warlock.contact-patron": { resourceId: "resource.warlock.contact-patron" },
  "wizard.arcane-recovery": { resourceId: "resource.wizard.arcane-recovery", note: "짧은 휴식 중 · 슬롯 회복" },
};

/** Class features are granted as `<slug>.<level>.<slug>.<feature>`; the rule key is the trailing `<slug>.<feature>`. */
export const featureRuleKey = (featureId: string) => /^[a-z-]+\.\d+\.(.+)$/.exec(featureId)?.[1] ?? featureId;

const ACTIVE_WORDING = /(추가 행동|반응 ?행동|행동)(으로|을 사용|을 써|을 소비)/;

/** The activation for a feature: from the table, else a pool named after the feature, else a log-only use for features worded as an action. */
export function featureActivation(feature: DerivedFeature, derived: DerivedCharacter): FeatureActivation | undefined {
  const key = featureRuleKey(feature.id);
  const table = FEATURE_ACTIVATIONS[key];
  if (table) return derived.resources.some((resource) => resource.id === table.resourceId) || !table.resourceId ? table : undefined;
  const traitKey = feature.id.split(".trait.").pop() ?? feature.id;
  const pool = derived.resources.find((resource) => resource.id === `resource.${key}` || resource.id === `resource.species.${traitKey}`);
  if (pool) return { resourceId: pool.id };
  if (feature.description && ACTIVE_WORDING.test(feature.description)) return {};
  return undefined;
}

export const effectKeyForFeature = (featureId: string) => `feature:${featureRuleKey(featureId)}`;
export const effectKeyForSpell = (spellId: string) => `spell:${spellId}`;
