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
  /** R59 (D194): the use spends one of this character's hit dice and heals by what it rolls (튼튼함's 신속한 회복). */
  hitDie?: boolean;
}


/**
 * Rule key for a feature id: class `<slug>.<level>.<slug>.<feature>` → `<slug>.<feature>`; subclass
 * `dnd.srd521.feature.<class>.<subclass>.<key>` → `<class>.<subclass>.<key>`; species `<speciesId>.trait.<key>` → `species.<key>`.
 */
export function featureRuleKey(featureId: string) {
  // R51 (D186): a feat's feature id carries the slot it was chosen in — `feat.background.dnd.srd521.feat.alert`,
  // `feat.class.3.asi.<id>`. The rule belongs to the feat, not the slot, so the slot comes off and the key names its
  // own namespace (`feat:alert`). Until this, a feat could never meet a contract: the slot prefix made every key
  // unique to the character that happened to pick it up there.
  const feat = /\.feat\.(.+)$/.exec(featureId);
  if (feat) return `feat:${feat[1]}`;
  const cls = /^[a-z-]+\.\d+\.(.+)$/.exec(featureId);
  if (cls) return cls[1];
  const sub = /^dnd\.[a-z0-9]+\.feature\.(.+)$/.exec(featureId);
  if (sub) return sub[1];
  const trait = /\.trait\.([^.]+)$/.exec(featureId);
  if (trait) return `species.${trait[1]}`;
  return featureId;
}


/** R39 (D179): looks a feature rule key up in the catalog's contracts and returns the duration it starts, if any. */
export type ContractDurationSource = (ruleKey: string) => { duration?: ParsedDuration; use?: { resourceId?: string; cost?: number; heal?: string; tempHp?: string; roll?: { label: string; formula: string }; note?: string; hitDie?: boolean; points?: boolean }; /** R41: the contract does something on use even if it spends nothing and starts nothing. */ acts?: boolean; /** R78 (D213), R81 (D215): used when a short rest ends or initiative is rolled, not pressed. */ trigger?: string } | undefined;

/**
 * The activation for a feature: from its contract, else a pool named after the feature (`resource.<rule key>`).
 * H5c (D246): the hand-written table, the metamagic costs and the guess from action wording in the description are gone —
 * a feature with a button says so in its contract, SRD or module alike.
 */
export function featureActivation(feature: DerivedFeature, derived: DerivedCharacter, contract?: ContractDurationSource): FeatureActivation | undefined {
  const key = featureRuleKey(feature.id);
  // R39 (D179): where the content ships an `effect.apply`, the duration it starts is the contract's, not this table's.
  // R40 (D180): and where it ships `resource.change`, `healing.apply`, `temp-hp.grant` or `damage.apply`, those are
  // the pool it spends and the dice it rolls. Whatever the contract does not say, the table still answers.
  // R49 (D184): the sheet carries its own features' contracts, so a caller that does not pass one still gets them.
  const fromContract = contract?.(key) ?? derived.featureContracts?.[key];
  // R78 (D213): a feature the content says is used at the end of a short rest has no button — the rest window offers it.
  if (fromContract?.trigger) return undefined;
  if (fromContract?.duration || fromContract?.use || fromContract?.acts) {
    const use = fromContract.use;
    return {
      ...(use?.points ? { points: true } : {}), ...(use?.resourceId ? { resourceId: use.resourceId } : {}), ...(use?.cost ? { cost: use.cost } : {}),
      ...(use?.heal ? { heal: () => use.heal! } : {}), ...(use?.tempHp ? { tempHp: () => use.tempHp! } : {}),
      ...(use?.roll ? { roll: () => use.roll! } : {}), ...(use?.note ? { note: use.note } : {}),
      // R59 (D194): a use that spends a hit die rolls it and heals by the result.
      ...(use?.hitDie ? { hitDie: true } : {}),
      ...(fromContract.duration ? { duration: () => fromContract.duration! } : {}),
    };
  }
  const pool = derived.resources.find((resource) => resource.id === `resource.${key}`);
  return pool ? { resourceId: pool.id } : undefined;
}

/**
 * R51 (D186): a rule key that already names its namespace (`feat:great-weapon-master`) keeps it; everything else is a
 * class, subclass or species feature and gets `feature:`. Every caller that turns a rule key into a contract or an
 * effect key goes through here, so the two spellings cannot drift apart.
 */
export const qualifyRuleKey = (ruleKey: string) => (ruleKey.includes(":") ? ruleKey : `feature:${ruleKey}`);
export const effectKeyForFeature = (featureId: string) => qualifyRuleKey(featureRuleKey(featureId));
export const effectKeyForSpell = (spellId: string) => `spell:${spellId}`;
