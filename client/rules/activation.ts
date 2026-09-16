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
  "barbarian.reckless-attack": { duration: () => timed("이 턴 (다음 턴 시작까지)", 1), note: "첫 공격 때 결정 · 근력 근접 공격 유리, 받는 공격도 유리" },
  // R28 (D151): the host now watches this — a rage that saw no attack, no forced save and no damage since the
  // barbarian's last turn ends when their turn does, and re-pressing 격노 (a bonus action) is the extension.
  "barbarian.rage": { resourceId: "resource.barbarian.rage", duration: () => timed("10분 (100라운드)", 100), note: "추가 행동 · 턴이 끝날 때 그 사이 공격도, 내성을 강요한 것도, 받은 피해도 없었으면 종료 (다시 눌러 연장) · 행동 불가가 되면 즉시 종료" },
  "barbarian.berserker.intimidating-presence": { duration: () => timed("1분 (10라운드)", 10), note: "추가 행동 · 30피트 안의 적, 지혜 내성 아니면 공포" },
  "fighter.tactical-mind": { resourceId: "resource.fighter.second-wind", roll: () => ({ label: "전술적 사고", formula: "1d10" }), note: "실패한 능력 판정에 재기의 바람 1회 소비, +1d10" },
  "monk.deflect-attacks": { roll: (derived) => ({ label: "공격 빗나가게 하기 — 피해 감소", formula: `1d10+${derived.abilities.dex.modifier}+${classLevel(derived, "monk")}` }), note: "반응행동 · 타격/관통/참격 피해를 1d10 + 민첩 + 몽크 레벨 줄임" },
  "monk.open-hand.quivering-palm": { resourceId: "resource.monk.focus", cost: 4, note: "기 점수 4 · 건강 내성 아니면 10d12" },
  "monk.superior-defense": { resourceId: "resource.monk.focus", cost: 3, duration: () => timed("1분 (10라운드)", 10), note: "기 점수 3 · 역장 외 모든 피해 저항" },
  "monk.open-hand.wholeness-of-body": { roll: (derived) => ({ label: "온전한 신체 — 회복", formula: `1d${martialArtsDie(classLevel(derived, "monk"))}+${Math.max(0, derived.abilities.wis.modifier)}` }), note: "추가 행동 · 지혜 수정치 횟수/긴 휴식 · 굴린 만큼 HP 입력에 +N" },
  "druid.wild-companion": { resourceId: "resource.druid.wild-shape", note: "야생 변신 1회로 사역마 찾기 시전" },
  "druid.circle-of-the-land.lands-aid": { resourceId: "resource.druid.wild-shape", note: "야생 변신 1회 · 2d6 괴저 / 2d6 회복" },
  "druid.circle-of-the-land.natures-sanctuary": { resourceId: "resource.druid.wild-shape", duration: () => timed("1분 (10라운드)", 10), note: "야생 변신 1회 · 나무 벽" },
  "cleric.life-domain.preserve-life": { resourceId: "resource.cleric.channel-divinity", roll: (derived) => ({ label: "생명 보존 — 회복 총량", formula: `${5 * classLevel(derived, "cleric")}` }), note: "신성 변환 1회 · 클레릭 레벨 ×5 HP를 나눠 회복" },
  "paladin.abjure-foes": { resourceId: "resource.paladin.channel-divinity", note: "신성 변환 1회 · 지혜 내성 아니면 공포" },
  "paladin.oath-of-devotion.sacred-weapon": { resourceId: "resource.paladin.channel-divinity", duration: () => timed("10분 (100라운드)", 100), note: "신성 변환 1회 · 무기 명중에 매력 수정치" },
  "paladin.oath-of-devotion.holy-nimbus": { duration: () => timed("10분 (100라운드)", 100), note: "추가 행동 · 긴 휴식마다 1회 (또는 5레벨 슬롯)" },
  "sorcerer.draconic.dragon-wings": { duration: () => timed("1시간"), note: "추가 행동 · 긴 휴식마다 1회 (또는 3레벨 슬롯) · 비행 60" },
  "warlock.mystic-arcanum-6": { resourceId: "resource.warlock.arcanum.6" },
  "warlock.mystic-arcanum-7": { resourceId: "resource.warlock.arcanum.7" },
  "warlock.mystic-arcanum-8": { resourceId: "resource.warlock.arcanum.8" },
  "warlock.mystic-arcanum-9": { resourceId: "resource.warlock.arcanum.9" },
  "species.breath-weapon": { resourceId: "resource.species.breath-weapon", roll: (derived) => ({ label: "브레스 무기 피해", formula: `${breathDice(derived.level)}d10` }), note: "공격 행동의 공격 하나 대신 · 민첩 내성 아니면 피해" },
  "species.draconic-flight": { resourceId: "resource.species.draconic-flight", duration: () => timed("10분 (100라운드)", 100), note: "추가 행동 · 비행 속도 = 이동 속도" },
  "species.large-form": { resourceId: "resource.species.large-form", duration: () => timed("10분 (100라운드)", 100), note: "추가 행동 · 크기 대형, 속도 +10, 근력 판정·내성 유리" },
  "species.stonecunning": { resourceId: "resource.species.stonecunning", duration: () => timed("10분 (100라운드)", 100), note: "추가 행동 · 돌 표면 진동 감각 60피트" },
  "species.adrenaline-rush": { resourceId: "resource.species.adrenaline-rush", tempHp: (derived) => `${derived.proficiencyBonus}`, note: "추가 행동 · 질주 + 임시 HP (숙련 보너스)" },
  "fighter.second-wind": { resourceId: "resource.fighter.second-wind", heal: (derived) => `1d10+${classLevel(derived, "fighter")}`, note: "추가 행동 · 1d10 + 파이터 레벨 회복" },
  "fighter.action-surge": { resourceId: "resource.fighter.action-surge", note: "이번 턴에 행동 하나 추가" },
  "fighter.indomitable": { resourceId: "resource.fighter.indomitable", note: "실패한 내성 굴림 재굴림 (+파이터 레벨)" },
  "bard.bardic-inspiration": { resourceId: "resource.bard.bardic-inspiration", note: "추가 행동 · 아군에게 영감 주사위" },
  "cleric.channel-divinity": { resourceId: "resource.cleric.channel-divinity" },
  "cleric.divine-intervention": { resourceId: "resource.cleric.divine-intervention", note: "행동 · 5레벨 이하 클레릭 주문 무료 시전" },
  "druid.wild-shape": { resourceId: "resource.druid.wild-shape", duration: (derived) => timed(`${Math.max(1, Math.floor(classLevel(derived, "druid") / 2))}시간`), tempHp: (derived) => `${classLevel(derived, "druid")}`, note: "추가 행동 · 야수 형태 · 임시 HP = 드루이드 레벨" },
  "druid.wild-resurgence": { resourceId: "resource.druid.wild-resurgence" },
  "monk.focus": { resourceId: "resource.monk.focus", note: "기 점수 1 소비 (질풍 연타 · 인내의 방어 · 바람의 걸음)" },
  "monk.stunning-strike": { resourceId: "resource.monk.focus", note: "기 점수 1 소비 · 건강 내성 아니면 충격" },
  "monk.uncanny-metabolism": { resourceId: "resource.monk.uncanny-metabolism", heal: (derived) => `1d${martialArtsDie(classLevel(derived, "monk"))}+${classLevel(derived, "monk")}`, note: "이니셔티브 굴릴 때 · 기 점수 전부 회복 (기 점수는 자원에서 직접 회복) + 무예 주사위 + 몽크 레벨 회복" },
  "paladin.lay-on-hands": { resourceId: "resource.paladin.lay-on-hands", points: true, note: "추가 행동 · 점수만큼 HP 회복 (5점 = 중독 해제)" },
  "paladin.channel-divinity": { resourceId: "resource.paladin.channel-divinity" },
  "paladin.smite": { resourceId: "resource.paladin.smite", note: "긴 휴식마다 한 번 슬롯 없이 신성한 강타" },
  "paladin.faithful-steed": { resourceId: "resource.paladin.faithful-steed" },
  "ranger.favored-enemy": { resourceId: "resource.ranger.favored-enemy", duration: () => timed("집중, 최대 1시간", undefined, true), note: "사냥꾼의 표식 무료 시전" },
  "ranger.tireless": { resourceId: "resource.ranger.tireless", tempHp: (derived) => `1d8+${Math.max(0, derived.abilities.wis.modifier)}`, note: "행동 · 임시 HP 1d8 + 지혜" },
  "ranger.natures-veil": { resourceId: "resource.ranger.natures-veil", duration: () => timed("다음 턴 끝까지", 1), note: "추가 행동 · 투명" },
  "rogue.stroke-of-luck": { resourceId: "resource.rogue.stroke-of-luck" },
  "sorcerer.innate-sorcery": { resourceId: "resource.sorcerer.innate-sorcery", duration: () => timed("1분 (10라운드)", 10), note: "추가 행동 · 주문 DC +1, 주문 명중 유리" },
  "sorcerer.font-of-magic": { resourceId: "resource.sorcerer.sorcery-points", note: "마법 점수 1 소비" },
  "warlock.magical-cunning": { resourceId: "resource.warlock.magical-cunning", note: "1분 · 계약 슬롯 절반 회복" },
  "warlock.contact-patron": { resourceId: "resource.warlock.contact-patron" },
  "wizard.arcane-recovery": { resourceId: "resource.wizard.arcane-recovery", note: "짧은 휴식 중 · 슬롯 회복" },
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
export type ContractDurationSource = (ruleKey: string) => ParsedDuration | undefined;

/** The activation for a feature: from the table, else a pool named after the feature, else a log-only use for features worded as an action. */
export function featureActivation(feature: DerivedFeature, derived: DerivedCharacter, contract?: ContractDurationSource): FeatureActivation | undefined {
  const key = featureRuleKey(feature.id);
  // R39 (D179): where the content ships an `effect.apply`, the duration it starts is the contract's, not this table's.
  const fromContract = contract?.(key);
  if (fromContract) {
    const table = FEATURE_ACTIVATIONS[key];
    return { ...(table ?? {}), duration: () => fromContract };
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
