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

/**
 * R30 (D156): what is left of a timed effect, in the unit a person would say it in — rounds while a fight is
 * running, minutes and hours once it is longer than that.
 */
export function remainingText(rounds: number | undefined, elapsed: number): string | null {
  if (rounds === undefined) return null;
  const left = Math.max(0, rounds - elapsed);
  if (left <= 10) return `${left}라운드 남음`;
  if (left < 600) return `${Math.ceil(left / 10)}분 남음`;
  const hours = Math.floor(left / 600);
  const minutes = Math.ceil((left % 600) / 10);
  return `${hours}시간${minutes ? ` ${minutes}분` : ""} 남음`;
}

/** The duration in rounds when the text names a length ("1분" → 10, "1시간" → 600, "1일" → 14400); undefined for "특수", "무효화될 때까지" and the like. */
export function durationInRounds(text: string | undefined): number | undefined {
  const value = (text ?? "").trim();
  for (const [pattern, perUnit] of ROUNDS_PER) {
    const match = pattern.exec(value);
    if (match) return Number(match[1]) * perUnit;
  }
  return undefined;
}

export function parseDuration(text: string | undefined): ParsedDuration {
  const value = (text ?? "").trim();
  if (!value || value === "즉시" || value === "순간") return { text: value || "즉시", instantaneous: true, concentration: false };
  const concentration = /집중/.test(value);
  // R30 (D156): a duration longer than a hundred rounds used to lose its counter entirely, so an eight-hour effect
  // sat on the sheet for ever and only a person could end it. Everything that names a length is counted now; the
  // display turns a big number back into hours and minutes (a round is six seconds, a minute is ten rounds).
  const rounds = durationInRounds(value);
  return { text: value, instantaneous: false, concentration, rounds };
}

export interface FeatureActivation {
  /** Pool spent per use (`derived.resources` id). Missing: the use is only logged. */
  resourceId?: string;
  /** Spend a chosen number of points from the pool (Lay on Hands) instead of one use. */
  points?: boolean;
  /** Fixed number of points spent per use (Quivering Palm 4 focus points, Quickened Spell 2 sorcery points). */
  cost?: number;
  /** Dice rolled and logged on use without changing HP (Breath Weapon damage, Deflect Attacks reduction). */
  roll?: (derived: DerivedCharacter) => { label: string; formula: string };
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
/** Monk Martial Arts die by monk level (d6, d8 at 5, d10 at 11, d12 at 17). */
export const martialArtsDie = (level: number) => (level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6);
/** Breath Weapon dice by character level (1d10, 2d10 at 5, 3d10 at 11, 4d10 at 17). */
const breathDice = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);
const METAMAGIC_COST: Record<string, number> = { "careful-spell": 1, "distant-spell": 1, "empowered-spell": 1, "extended-spell": 1, "heightened-spell": 2, "quickened-spell": 2, "seeking-spell": 1, "subtle-spell": 1, "transmuted-spell": 1, "twinned-spell": 1 };

const FEATURE_ACTIVATIONS: Record<string, FeatureActivation> = {
  "monk.deflect-attacks": { roll: (derived) => ({ label: "공격 빗나가게 하기 — 피해 감소", formula: `1d10+${derived.abilities.dex.modifier}+${classLevel(derived, "monk")}` }), note: "반응행동 · 타격/관통/참격 피해를 1d10 + 민첩 + 몽크 레벨 줄임" },
  "species.breath-weapon": { resourceId: "resource.species.breath-weapon", roll: (derived) => ({ label: "브레스 무기 피해", formula: `${breathDice(derived.level)}d10` }), note: "공격 행동의 공격 하나 대신 · 민첩 내성 아니면 피해" },
  "species.adrenaline-rush": { resourceId: "resource.species.adrenaline-rush", tempHp: (derived) => `${derived.proficiencyBonus}`, note: "추가 행동 · 질주 + 임시 HP (숙련 보너스)" },
  "paladin.lay-on-hands": { resourceId: "resource.paladin.lay-on-hands", points: true, note: "추가 행동 · 점수만큼 HP 회복 (5점 = 중독 해제)" },
};

/**
 * Rule key for a feature id: class `<slug>.<level>.<slug>.<feature>` → `<slug>.<feature>`; subclass
 * `dnd.srd521.feature.<class>.<subclass>.<key>` → `<class>.<subclass>.<key>`; species `<speciesId>.trait.<key>` → `species.<key>`.
 */
export function featureRuleKey(featureId: string) {
  const cls = /^[a-z-]+\.\d+\.(.+)$/.exec(featureId);
  if (cls) return cls[1];
  const sub = /^dnd\.[a-z0-9]+\.feature\.(.+)$/.exec(featureId);
  if (sub) return sub[1];
  const trait = /\.trait\.([^.]+)$/.exec(featureId);
  if (trait) return `species.${trait[1]}`;
  return featureId;
}

const ACTIVE_WORDING = /(추가 행동|반응 ?행동|반응|행동)(으로|을 사용|을 써|을 소비)/;
/** Worded like an action but always on (or handled elsewhere): no "사용" button. */
const NOT_ACTIVATABLE = new Set(["monk.martial-arts", "invocation.investment-of-the-chain-master", "rogue.sneak-attack", "rogue.cunning-strike", "fighter.extra-attack"]);

/** R39 (D179): looks a feature rule key up in the catalog's contracts and returns the duration it starts, if any. */
export type ContractDurationSource = (ruleKey: string) => { duration?: ParsedDuration; use?: { resourceId?: string; cost?: number; heal?: string; tempHp?: string; roll?: { label: string; formula: string }; note?: string }; /** R41: the contract does something on use even if it spends nothing and starts nothing. */ acts?: boolean } | undefined;

/** The activation for a feature: from the table, else a pool named after the feature, else a log-only use for features worded as an action. */
export function featureActivation(feature: DerivedFeature, derived: DerivedCharacter, contract?: ContractDurationSource): FeatureActivation | undefined {
  const key = featureRuleKey(feature.id);
  // R39 (D179): where the content ships an `effect.apply`, the duration it starts is the contract's, not this table's.
  // R40 (D180): and where it ships `resource.change`, `healing.apply`, `temp-hp.grant` or `damage.apply`, those are
  // the pool it spends and the dice it rolls. Whatever the contract does not say, the table still answers.
  // R49 (D184): the sheet carries its own features' contracts, so a caller that does not pass one still gets them.
  const fromContract = contract?.(key) ?? derived.featureContracts?.[key];
  if (fromContract?.duration || fromContract?.use || fromContract?.acts) {
    const table = FEATURE_ACTIVATIONS[key];
    const use = fromContract.use;
    return {
      ...(table ?? {}), ...(use?.resourceId ? { resourceId: use.resourceId } : {}), ...(use?.cost ? { cost: use.cost } : {}),
      ...(use?.heal ? { heal: () => use.heal! } : {}), ...(use?.tempHp ? { tempHp: () => use.tempHp! } : {}),
      ...(use?.roll ? { roll: () => use.roll! } : {}), ...(use?.note ? { note: use.note } : {}),
      ...(fromContract.duration ? { duration: () => fromContract.duration! } : {}),
    };
  }
  if (NOT_ACTIVATABLE.has(key)) return undefined;
  const table = FEATURE_ACTIVATIONS[key];
  if (table) return derived.resources.some((resource) => resource.id === table.resourceId) || !table.resourceId ? table : undefined;
  if (feature.source === "metamagic") {
    const option = key.split(".").pop() ?? key;
    const cost = METAMAGIC_COST[option];
    return derived.resources.some((resource) => resource.id === "resource.sorcerer.sorcery-points") && cost ? { resourceId: "resource.sorcerer.sorcery-points", cost, note: `마법 점수 ${cost}${option === "twinned-spell" ? " (주문 레벨만큼, 최소 1)" : ""}` } : undefined;
  }
  const pool = derived.resources.find((resource) => resource.id === `resource.${key}` || (key.startsWith("species.") && resource.id === `resource.${key}`));
  if (pool) return { resourceId: pool.id };
  if (feature.description && ACTIVE_WORDING.test(feature.description)) return {};
  return undefined;
}

export const effectKeyForFeature = (featureId: string) => `feature:${featureRuleKey(featureId)}`;
export const effectKeyForSpell = (spellId: string) => `spell:${spellId}`;
