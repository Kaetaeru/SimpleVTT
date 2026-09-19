/**
 * Character model of the new client (CHARACTER_SYSTEM.md §4): the source (what the player chose), the derived
 * character (everything computed, never stored) and the runtime (usage). Only source and runtime are persisted.
 */
import type { AbilityKey } from "../catalog/types";
import type { ParsedDuration } from "../rules/activation";
import type { ContractRider } from "../rules/attackRiders";
import type { RollAdvantage } from "../rules/actions";
import type { CustomItem } from "./customItem";

export type AbilityScores = Record<AbilityKey, number>;

export type HitPointChoiceValue = { kind: "fixed" } | { kind: "roll"; value: number };

/** One level gained, in the order it was gained. Class level = how many earlier tracks share the class + 1. */
export interface TrackLevel { classId: string; hp: HitPointChoiceValue }

export interface CharacterSource {
  schema: 2;
  id: string;
  name: string;
  portrait?: string;
  alignment?: string;
  notes?: { appearance?: string; personality?: string; backstory?: string };
  rules: { profile: string; modules: string[] };
  origin: { speciesId: string; backgroundId: string };
  abilities: { method: "point-buy" | "standard-array" | "manual"; base: AbilityScores };
  tracks: TrackLevel[];
  /**
   * Every answer the player gave, keyed by the choice id the engine asks for (`origin.species.lineage`,
   * `class.2.asi`, `feat.origin.dnd.srd521.feat.skilled.proficiencies` …). Unused answers are ignored.
   */
  choices: Record<string, string[]>;
  equipment: { mode: "loadout" | "gold"; startingGold?: number };
  xp?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChoiceOption {
  id: string;
  name: string;
  nameEn?: string;
  summary?: string;
  description?: string;
  disabledReason?: string;
  /** Grouping hint for the UI (spell level, feat tier…). */
  group?: string;
}

export type ChoiceScope = "identity" | "abilities" | "origin" | "class" | "feat" | "equipment" | "languages";

export interface ChoiceRequest {
  id: string;
  scope: ChoiceScope;
  /** Where the choice comes from, for the wizard's grouping ("종족 · 엘프", "파이터 3레벨 · 서브클래스"). */
  sourceLabel: string;
  trackIndex?: number;
  label: string;
  description?: string;
  count: number;
  /** Minimum picks before the choice counts as answered; defaults to `count`. */
  minimum?: number;
  options: ChoiceOption[];
  selected: string[];
  satisfied: boolean;
  /** Optional choices (spell swaps) never block. */
  optional?: boolean;
}

export type FeatureSource = "class" | "subclass" | "species" | "background" | "feat" | "invocation" | "metamagic";

export interface DerivedFeature {
  id: string;
  name: string;
  nameEn?: string;
  source: FeatureSource;
  sourceLabel: string;
  level?: number;
  description?: string;
  descriptionSource?: "module" | "srd-summary";
  /** R33 (D168): what the engine does with this feature, written from its catalog config — empty means nothing automatic. */
  rules?: string[];
  /** R33 (D168): `descriptive` marks prose the table adjudicates; the sheet says so instead of letting it look applied. */
  execution?: "derived" | "pre-roll" | "selection" | "common-play" | "descriptive";
  /** H2 (D239): what an option was taken for — each pick of a repeatable one adds a target (고통스러운 폭발's cantrips). */
  targets?: string[];
}

/** One addend of a derived number, so the sheet can show where it came from ("민첩 +2", "숙련 보너스 +3"). */
export interface Term { label: string; value: number; /** Dice added instead of a number ("1d4" from Bless); value stays 0. */ dice?: string }

/** A feature or spell in effect (Rage, Bless): ended by its "종료" button, by the round counter, or by a rest. */
/** V4d (D266): hold at `hp` instead of dropping to 0 — after a save whose DC grows with each use, paying a pool, while an effect runs. */
export interface ZeroHold { label: string; hp: number; save?: { ability: string; dc: number; step: number; stepResourceId?: string }; resourceId?: string; requiresEffect?: string }

export interface ActiveEffect {
  /** `feature:<featureRuleKey>` or `spell:<spellId>`. */
  key: string;
  name: string;
  source: "feature" | "spell";
  duration: string;
  concentration: boolean;
  /** Round counter when the duration is short enough to track (10 rounds for one minute). */
  rounds?: number;
  elapsed: number;
  startedAt: string;
  /** R10: repeat this save at the end of each of the bearer's turns; on a success the effect and these conditions end. */
  endSave?: { ability: AbilityKey; dc: number; conditions: string[] };
  /** R39 (D179): paused by another effect (an antimagic field) — still on the sheet, contributing nothing, with the reason. */
  suppressed?: string;
  /** R77 (D212): the slot level a spell was cast at, so a repeat rolls the same dice. */
  level?: number;
  /** R85 (D220): the creature whose spell put this effect here, when that is not the bearer. */
  from?: string;
  /** R85 (D220): the effect lasts only while `from` keeps concentrating on the spell. */
  fromConcentration?: boolean;
  /** R85 (D220): the turn that counts its rounds — the caster ("until the end of your next turn") or the bearer. */
  anchor?: { who: "source" | "bearer"; boundary: "start" | "end" };
  /** V3e (D259): the effect ends when its bearer next attacks (안정된 조준). */
  consumeOn?: "attack" | "cast" | "attack-or-cast";
  /** R85 (D220): conditions the effect put on the bearer, which come off with it. */
  conditions?: string[];
  /** V4d (D266): a die the bearer may add to one failed d20 test, spending the effect (바드의 영감). */
  rescue?: { dice: string };
  /** V4f (D268): the variant of the spell this effect was cast with (에너지 보호's damage type). */
  variant?: string;
  /** V4k (D273): the creature whose stat block the bearer took on while this effect runs (야생 변신의 형태). */
  form?: string;
  /** R90 (D225): this creature is under the spell (a target), not only concentrating on it — its dice change. */
  bearer?: boolean;
  /** H2 (D239): the choice the feature behind a passive effect was made for (the cantrip 고통스러운 폭발 names). */
  target?: string;
}

/** What an active effect changed on the sheet, for the effects card. `applied` false: no rule yet, apply the text by hand. */
/**
 * R28 (D153): `narrative` marks an effect the engine cannot put a number on — the whole of its rule is the text in
 * `notes`, so the table adjudicates it. Two thirds of the effect rules are like this, and nothing used to say which
 * ones, so "the app tracks the rules" and "the app prints a sentence about the rules" looked identical on screen.
 */
export interface AppliedEffect { key: string; name: string; applied: boolean; notes: string[]; narrative?: boolean }

export interface DerivedSkill { id: string; name: string; ability: AbilityKey; proficient: boolean; expertise: boolean; bonus: number; terms: Term[] }

export interface DerivedAttack {
  id: string;
  name: string;
  itemId?: string;
  ability: AbilityKey;
  attackBonus: number;
  attackTerms: Term[];
  damage: string;
  damageBonus: number;
  damageTerms: Term[];
  damageType: string;
  properties: string[];
  mastery?: string;
  /** R32 (D165): 대형 무기 전투 — this weapon's damage dice never roll below 3. */
  dieMinimum?: number;
  /** The mastery property's rule key (graze, topple, vex, sap, slow, push, nick, cleave) for the table. */
  masteryKey?: string;
  masteryActive: boolean;
  range?: string;
}

export interface DerivedSpellcasting {
  /** `class:<classId>`, `species`, `feat:<instance>:<featId>`. */
  key: string;
  source: "class" | "species" | "feat";
  classId: string;
  className: string;
  ability: AbilityKey;
  saveDc: number;
  saveDcTerms: Term[];
  attackBonus: number;
  attackTerms: Term[];
  cantrips: string[];
  prepared: string[];
  alwaysPrepared: string[];
  spellbook?: string[];
  /** V3g (D261): ritual spells in the spellbook are cast as rituals without being prepared (의식 숙련). */
  ritualFromSpellbook?: boolean;
  preparedMax: number;
  cantripsMax: number;
}

export interface DerivedResource {
  id: string;
  label: string;
  max: number;
  /** Human recovery text ("짧은 휴식"). */
  recovery: string;
  /** Machine recovery: what a short rest gives back (`all`, a number of uses, or nothing); a long rest always restores all. */
  restore: { short: "all" | number | 0 };
  source: string;
  /** Spell this pool casts for free (Paladin's Smite, Find Steed, Mystic Arcanum, species/feat spells): the spell row offers it. */
  freeCastSpellId?: string;
  /** V3g (D261): the free cast is never used up (주문 숙련). */
  atWill?: boolean;
  /** V4n (D276): the pool casts any prepared spell up to this level for free (주문 회상의 은총). */
  freeCastMaxLevel?: number;
  /** V4q (D279): the pool casts any one of these spells for free (자연 회복의 회합 주문). */
  freeCastSpellIds?: string[];
}

export interface DerivedItem { instanceId: string; itemId: string; name: string; kind: string; quantity: number; equipped?: boolean; wieldSlot?: "main-hand" | "off-hand" | "two-hand"; source: string; custom?: boolean; /** R75 (D210): a pasted magic item's own definition, and whether it is attuned. */ magic?: CustomItem; attuned?: boolean }

/** Runtime-side changes to the bag: items removed, quantities changed, items added during play. */
export interface InventoryPatch {
  removed: string[];
  quantities: Record<string, number>;
  extra: Array<{ instanceId: string; itemId?: string; name: string; quantity: number; /** R75 (D210) */ custom?: CustomItem; attuned?: boolean }>;
}

/** R33 (D168): feat numbers that only matter once a swing is being rolled. */
export interface DerivedFeatEffects {
  /** 야만적 공격자: the feat that lets this character reroll a weapon's damage dice once a turn and keep either set. */
  rerollWeaponDamage?: string;
  /** 쌍수 전투: the feat that keeps the ability modifier on the Light weapon's extra attack. */
  lightOffHandAbilityModifier?: string;
}

export interface DerivedCharacter {
  id: string;
  name: string;
  portrait?: string;
  level: number;
  proficiencyBonus: number;
  species: { id: string; name: string } | null;
  background: { id: string; name: string } | null;
  classes: Array<{ classId: string; name: string; level: number; subclassId?: string; subclassName?: string; hitDie: number }>;
  abilities: Record<AbilityKey, { score: number; modifier: number; base: number; bonuses: Array<{ source: string; value: number }> }>;
  hp: { max: number; breakdown: string[]; terms: Term[] };
  ac: { value: number; source: string; breakdown: string[]; terms: Term[] };
  speed: { walk: number; climb?: number; swim?: number; fly?: number; terms: Term[] };
  senses: { darkvision?: number; blindsight?: number; truesight?: number };
  size: string;
  initiative: number;
  initiativeTerms: Term[];
  passivePerception: number;
  passivePerceptionTerms: Term[];
  saves: Record<AbilityKey, { proficient: boolean; bonus: number; terms: Term[] }>;
  skills: DerivedSkill[];
  proficiencies: { armor: string[]; weapons: string[]; tools: string[]; languages: string[] };
  features: DerivedFeature[];
  feats: Array<{ id: string; name: string; tier: string; source: string }>;
  spellcasting: DerivedSpellcasting[];
  spellSlots: Record<number, number>;
  pactMagic?: { count: number; level: number };
  resources: DerivedResource[];
  attacks: DerivedAttack[];
  defenses: { resistances: string[]; immunities: string[]; vulnerabilities: string[]; conditionImmunities: string[] };
  inventory: DerivedItem[];
  /** Effects in force when deriving (from the runtime) and what each one changed. */
  activeEffects: AppliedEffect[];
  /** Dice or numbers every ability check gets from effects (Guidance). Skills already carry them in their terms. */
  checkTerms: Term[];
  gold: number;
  weaponMasteries: string[];
  /**
   * R33 (D168): the feat rules the table reads at roll time rather than the sheet at derivation time. Named after
   * the catalog key that produced them, holding the feat's name so the card can say what paid for the reroll.
   */
  featEffects: DerivedFeatEffects;
  /** R43 (D183): the lowest d20 that is a critical hit for this character (19 with 향상된 치명타). */
  critRange?: number;
  /** R95 (D230): 회피술. */
  evasion?: boolean;
  /** R96 (D231): see EffectApplication. */
  cantripModifierClasses?: string[];
  healingSlotBonus?: boolean;
  healingMaximized?: boolean;
  /** V3g (D261): damage dice of spells up to this level count as their maximum (과부하, while its effect runs). */
  spellDamageMaximizedUpTo?: number;
  elusive?: boolean;
  /** H2 (D239): see EffectApplication. */
  markedSpellDice?: Record<string, number>;
  markedSpellAdvantage?: string[];
  concentrationDamageImmune?: string[];
  potentCantrip?: boolean;
  studiedAttacks?: boolean;
  /** H3 (D240): abilities whose saves total at least the ability score (불굴의 힘). */
  minimumScoreRolls?: AbilityKey[];
  /** V5i (D297): the class whose spellcasting ability an element's damage bonus uses (원소 친화). */
  damageTypeModifierClass?: string;
  /** V5i (D297): the class whose spells the maximizing covers (과부하: 위저드). */
  spellDamageMaximizedClass?: string;
  /** V5h (D296): how many metamagics one cast may carry (마법 화신). */
  metamagicLimit?: number;
  /** V5h (D296): one metamagic costs nothing, once a turn (비전의 신격). */
  metamagicFree?: boolean;
  /** V4o (D277): abilities whose *checks* total at least the ability score (불굴의 힘). */
  minimumScoreChecks?: AbilityKey[];
  /** V3c (D257): the lowest d20 an ability check the character is proficient in counts (믿음직한 재능). */
  checkMinimumD20?: number;
  /** V3f (D260): reasons opportunity attacks against the character are at disadvantage. */
  opportunityDisadvantage?: string[];
  /** V3h (D262): who hits this character attacks it at disadvantage for the rest of that turn, and the rule's name. */
  hitDefense?: string;
  /** V3h (D262): turns this character takes again in its first round of combat, at an initiative offset. */
  extraTurns?: Array<{ offset: number; label: string }>;
  /** V3h (D262): magic items attuned at once beyond the three the rules allow. */
  attunementBonus?: number;
  /** V4a (D263): a slot spell that heals someone else also heals this character for this much plus the slot level. */
  slotHealSelf?: number;
  /** V4c (D265): effect keys whose each-turn upkeep a rule waives (지속되는 격노). */
  upkeepWaived?: string[];
  /** V4d (D266): what keeps this character on its feet when it would drop to 0 hit points. */
  zeroHolds?: ZeroHold[];
  /** V4e (D267): the auras this character carries, and what a creature marked inside one gets. */
  auras?: Array<{ name: string; saveBonus: number; conditionImmunities: string[] }>;
  /** V4h (D270): a death save of at least this counts as a 20. */
  deathSaveCritRange?: number;
  /** V4h (D270): how many riders may give up another rider's dice on one attack (교활한 일격). */
  forgoLimit?: number;
  /** V4a (D263): spells whose casting shows the caster the target's defenses. */
  revealDefenses?: string[];
  /** H3d (D242): damage types whose spells add the spellcasting modifier to one damage roll (원소의 친화력). */
  damageTypeModifier?: string[];
  schoolDamageModifier?: Array<{ school: string; classSlug: string }>;
  /** R72 (D207): attacks per Attack action, from whatever contract says so (1 when none does). */
  attackActionAttacks?: number;
  /**
   * R51 (D186): what is worn, so a contract can ask. 평갑 달인 and 중갑 달인 are both written as "while wearing
   * <training> armour"; without this the expression grammar had no way to see the armour at all.
   */
  armor?: { name: string; training: string; /** The armour's Dexterity cap is actually costing this character AC. */ dexCapped: boolean; shield: boolean };
  /** R51 (D186): damage this character simply does not take, per type (중갑 달인). Reaches the resolver as `Combatant.reduction`. */
  damageReduction?: Array<{ types: string[]; amount: number; source: string }>;
  /** R51 (D186): damage types whose resistance this character's own damage ignores (원소 숙련자, 독 제조자). */
  ignoresResistance?: string[];
  /** H2 (D239): spells whose damage adds the spellcasting modifier (a feature that names them, 고통스러운 폭발). */
  spellDamageModifier?: string[];
  /** R55 (D190): reasons this character's attacks are advantaged, each with the weapon filter it applies to. */
  advantageOn?: Array<{ reason: string; scope?: string }>;
  /** R55 (D190): reasons attacks against this character are advantaged (무모한 공격's other half). */
  grantsAdvantage?: string[];
  /** R55 (D190): this character's attacks ignore half and three-quarters cover (명사수, 주문 저격수). */
  ignoresCover?: boolean;
  /** R61 (D196): reasons this character's ability checks and saving throws are advantaged. */
  rollAdvantage?: RollAdvantage[];
  /**
   * R59 (D194): official actions a contract said this character may take as a bonus action instead (예리한 정신's
   * 빠른 연구, 관찰력's 빠른 수색). The turn panel offers them in the 추가 행동 menu as well as the action one.
   */
  bonusActions?: Array<{ kind: string; source: string; /** R61 (D196): for `attack`, the weapon filter the extra swing is limited to (`any`, `light`, `heavy` …). */ attackScope?: string; /** V4p (D278): the swing costs no part of the turn (무리 파괴자). */ free?: boolean; /** V4x (D286): how many swings it is worth (질풍 연타). */ count?: number }>;
  /**
   * R52 (D187): the riders this character's contracts let them declare before an attack roll. Carried on the sheet
   * for the same reason `featureContracts` is: a caller that forgets to ask the catalog would silently lose the rule.
   */
  attackRiders?: ContractRider[];
  /**
   * R49 (D184): what each of this character's features' contracts says about using it, worked out at derivation and
   * carried as plain data. Without this every caller of `featureActivation` would have to remember to hand it the
   * catalog, and the one that forgot would silently lose the feature's rule.
   */
  /** V4m (D275): what a long rest hands this character by contract (인간의 수완: 영웅적 영감). */
  longRestGains?: { heroicInspiration?: boolean };
  featureContracts?: Record<string, { duration?: ParsedDuration; use?: { resourceId?: string; cost?: number; heal?: string; tempHp?: string; roll?: { label: string; formula: string }; note?: string; hitDie?: boolean; points?: boolean; economy?: string; spellSlot?: boolean; pactSlot?: boolean; slotLevel?: number; slotGain?: number; lockout?: { resourceId: string; dice: string } }; acts?: boolean; trigger?: string }>;
  hitDice: Record<string, number>;
  choices: ChoiceRequest[];
  validation: { blocking: string[]; warnings: string[] };
}
