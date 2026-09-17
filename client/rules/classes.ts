/**
 * SRD 5.2.1 class facts that the class modules do not carry as data: armor/weapon/tool training, multiclass grants,
 * spellcasting abilities and the schedules of level-up choices (expertise, fighting style, metamagic, arcanum…).
 */
import type { AbilityKey } from "../catalog/types";

export type ArmorTraining = "light" | "medium" | "heavy" | "shield";
export type WeaponTraining = "simple" | "martial" | "martial-light" | "martial-finesse-or-light";

export interface ClassTraining {
  armor: ArmorTraining[];
  weapons: WeaponTraining[];
  tools?: string[];
  /** What a character gains when taking the class after the first (SRD Multiclassing table). */
  multiclass: { armor: ArmorTraining[]; weapons: WeaponTraining[]; skills?: number; tools?: string[]; instruments?: number };
}

export const CLASS_TRAINING: Record<string, ClassTraining> = {
  barbarian: { armor: ["light", "medium", "shield"], weapons: ["simple", "martial"], multiclass: { armor: ["shield"], weapons: ["simple", "martial"] } },
  bard: { armor: ["light"], weapons: ["simple"], multiclass: { armor: ["light"], weapons: [], skills: 1, instruments: 1 } },
  cleric: { armor: ["light", "medium", "shield"], weapons: ["simple"], multiclass: { armor: ["light", "medium", "shield"], weapons: [] } },
  druid: { armor: ["light", "shield"], weapons: ["simple"], tools: ["herbalism-kit"], multiclass: { armor: ["light", "shield"], weapons: [] } },
  fighter: { armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"], multiclass: { armor: ["light", "medium", "shield"], weapons: ["simple", "martial"] } },
  monk: { armor: [], weapons: ["simple", "martial-light"], multiclass: { armor: [], weapons: ["simple", "martial-light"] } },
  paladin: { armor: ["light", "medium", "heavy", "shield"], weapons: ["simple", "martial"], multiclass: { armor: ["light", "medium", "shield"], weapons: ["simple", "martial"] } },
  ranger: { armor: ["light", "medium", "shield"], weapons: ["simple", "martial"], multiclass: { armor: ["light", "medium", "shield"], weapons: ["simple", "martial"], skills: 1 } },
  rogue: { armor: ["light"], weapons: ["simple", "martial-finesse-or-light"], tools: ["thieves-tools"], multiclass: { armor: ["light"], weapons: [], skills: 1, tools: ["thieves-tools"] } },
  sorcerer: { armor: [], weapons: ["simple"], multiclass: { armor: [], weapons: [] } },
  warlock: { armor: ["light"], weapons: ["simple"], multiclass: { armor: ["light"], weapons: ["simple"] } },
  wizard: { armor: [], weapons: ["simple"], multiclass: { armor: [], weapons: [] } },
};

export const SPELLCASTING_ABILITY: Record<string, AbilityKey> = {
  bard: "cha", cleric: "wis", druid: "wis", paladin: "cha", ranger: "wis", sorcerer: "cha", warlock: "cha", wizard: "int",
};

/** Levels at which a class gains "능력치 향상" (the progression table lists it; kept here for the tests' independent check). */
export const ASI_LEVELS: Record<string, number[]> = {
  default: [4, 8, 12, 16],
  fighter: [4, 6, 8, 12, 14, 16],
  rogue: [4, 8, 10, 12, 16],
};

/** Level at which every class gains "에픽 은총" (an Epic Boon feat, or any other feat the character qualifies for). */
export const EPIC_BOON_LEVEL = 19;

/** Ranger 2 (Deft Explorer): expertise in one skill and two languages. */
export const DEFT_EXPLORER_LANGUAGES = 2;

/** Expertise choices: class level → count. */
export const EXPERTISE_SCHEDULE: Record<string, Record<number, number>> = {
  bard: { 2: 2, 9: 2 },
  rogue: { 1: 2, 6: 2 },
  ranger: { 2: 1, 9: 2 },
};

/** Fighting style feat choice levels. */
export const FIGHTING_STYLE_LEVEL: Record<string, number> = { fighter: 1, paladin: 2, ranger: 2 };

/** Metamagic known: class level → total known. */
export const METAMAGIC_KNOWN: Record<number, number> = { 2: 2, 10: 3, 17: 4 };

/** Mystic Arcanum levels: warlock level → spell level. */
export const MYSTIC_ARCANUM: Record<number, number> = { 11: 6, 13: 7, 15: 8, 17: 9 };

export const SUBCLASS_LEVEL = 3;

/** Wizard spellbook: spells known at level 1 and gained per level. */
export const WIZARD_SPELLBOOK = { atLevel1: 6, perLevel: 2 };

/** Column names of the class progression tables (Korean, as generated). */
export const COLUMN = {
  cantrips: "소마법", prepared: "준비 주문", rage: "격노", rageDamage: "격노 피해", mastery: "무기 통달", secondWind: "재기의 바람", channelDivinity: "신성 변환",
  wildShape: "야생 변신", inspirationDie: "영감 주사위", martialArtsDie: "무예 주사위", focusPoints: "기 점수", unarmoredMovement: "비무장 이동", sneakAttack: "암습",
  invocations: "기원술", pactSlots: "계약 슬롯", pactSlotLevel: "슬롯 레벨", sorceryPoints: "마법 점수", favoredEnemy: "주적",
} as const;

export const numericColumn = (value: string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const match = /(\d+)/.exec(value);
  return match ? Number(match[1]) : 0;
};

/** Class resource pools read from the progression columns and level features (id, label, column or formula, recovery). */
export interface ClassResourceRule {
  id: string;
  label: string;
  classSlug: string;
  /** Column that holds the maximum, or a function of class level. */
  column?: string;
  maximum?: (level: number, abilityMod: (key: AbilityKey) => number) => number;
  recovery: "short-rest" | "long-rest" | "short-rest:1" | "short-rest:half";
  /** Recovery that replaces `recovery` from a class level (Font of Inspiration: Bardic Inspiration on a short rest from 5). */
  recoveryFrom?: { level: number; recovery: "short-rest" | "long-rest" };
  minLevel: number;
  /** R34 (D172): a pool a subclass grants — only created when the character took that subclass. */
  subclassId?: string;
  /** English spell name this pool casts for free. */
  spell?: string;
}

export const CLASS_RESOURCES: ClassResourceRule[] = [
  { id: "resource.barbarian.rage", label: "격노", classSlug: "barbarian", column: COLUMN.rage, recovery: "short-rest:1", minLevel: 1 },
  { id: "resource.bard.bardic-inspiration", label: "바드의 영감", classSlug: "bard", maximum: (_level, mod) => Math.max(1, mod("cha")), recovery: "long-rest", recoveryFrom: { level: 5, recovery: "short-rest" }, minLevel: 1 },
  { id: "resource.cleric.channel-divinity", label: "신성 변환", classSlug: "cleric", column: COLUMN.channelDivinity, recovery: "short-rest:1", minLevel: 2 },
  { id: "resource.cleric.divine-intervention", label: "신성 개입", classSlug: "cleric", maximum: () => 1, recovery: "long-rest", minLevel: 10 },
  { id: "resource.druid.wild-shape", label: "야생 변신", classSlug: "druid", column: COLUMN.wildShape, recovery: "short-rest:1", minLevel: 2 },
  { id: "resource.fighter.second-wind", label: "재기의 바람", classSlug: "fighter", column: COLUMN.secondWind, recovery: "short-rest:1", minLevel: 1 },
  { id: "resource.fighter.action-surge", label: "행동 폭증", classSlug: "fighter", maximum: (level) => (level >= 17 ? 2 : 1), recovery: "short-rest", minLevel: 2 },
  { id: "resource.fighter.indomitable", label: "불굴", classSlug: "fighter", maximum: (level) => (level >= 17 ? 3 : level >= 13 ? 2 : 1), recovery: "long-rest", minLevel: 9 },
  { id: "resource.monk.focus", label: "기 점수", classSlug: "monk", column: COLUMN.focusPoints, recovery: "short-rest", minLevel: 2 },
  { id: "resource.paladin.lay-on-hands", label: "안수", classSlug: "paladin", maximum: (level) => level * 5, recovery: "long-rest", minLevel: 1 },
  { id: "resource.paladin.channel-divinity", label: "신성 변환", classSlug: "paladin", column: COLUMN.channelDivinity, recovery: "short-rest:1", minLevel: 3 },
  { id: "resource.ranger.favored-enemy", label: "주적 (사냥꾼의 표식 무료 시전)", classSlug: "ranger", column: COLUMN.favoredEnemy, recovery: "long-rest", minLevel: 1, spell: "Hunter's Mark" },
  { id: "resource.sorcerer.sorcery-points", label: "마법 점수", classSlug: "sorcerer", column: COLUMN.sorceryPoints, recovery: "long-rest", minLevel: 2 },
  // R78 (D213): 마력 회복 is once per long rest, so it is a pool its short-rest use spends.
  { id: "resource.sorcerer.sorcerous-restoration", label: "마력 회복", classSlug: "sorcerer", maximum: () => 1, recovery: "long-rest", minLevel: 5 },
  { id: "resource.sorcerer.innate-sorcery", label: "선천 마법", classSlug: "sorcerer", maximum: () => 2, recovery: "long-rest", minLevel: 1 },
  { id: "resource.warlock.magical-cunning", label: "마법적 책략", classSlug: "warlock", maximum: () => 1, recovery: "long-rest", minLevel: 2 },
  { id: "resource.wizard.arcane-recovery", label: "비전 회복", classSlug: "wizard", maximum: () => 1, recovery: "long-rest", minLevel: 1 },
  { id: "resource.rogue.stroke-of-luck", label: "행운의 일격", classSlug: "rogue", maximum: () => 1, recovery: "short-rest", minLevel: 20 },
  { id: "resource.monk.uncanny-metabolism", label: "경이로운 신진대사", classSlug: "monk", maximum: () => 1, recovery: "long-rest", minLevel: 2 },
  { id: "resource.paladin.smite", label: "팔라딘의 강타 (신성한 강타 무료 시전)", classSlug: "paladin", maximum: () => 1, recovery: "long-rest", minLevel: 2, spell: "Divine Smite" },
  { id: "resource.paladin.faithful-steed", label: "충직한 군마 (군마 찾기 무료 시전)", classSlug: "paladin", maximum: () => 1, recovery: "long-rest", minLevel: 5, spell: "Find Steed" },
  { id: "resource.ranger.tireless", label: "지치지 않음", classSlug: "ranger", maximum: (_level, mod) => Math.max(1, mod("wis")), recovery: "long-rest", minLevel: 10 },
  { id: "resource.ranger.natures-veil", label: "자연의 장막", classSlug: "ranger", maximum: (_level, mod) => Math.max(1, mod("wis")), recovery: "long-rest", minLevel: 14 },
  { id: "resource.warlock.contact-patron", label: "후원자와 접촉 (이계 접촉 무료 시전)", classSlug: "warlock", maximum: () => 1, recovery: "long-rest", minLevel: 9, spell: "Contact Other Plane" },
  { id: "resource.druid.wild-resurgence", label: "야생의 부활 (슬롯 회복)", classSlug: "druid", maximum: () => 1, recovery: "long-rest", minLevel: 5 },
  { id: "resource.barbarian.relentless-rage", label: "불굴의 격노 DC", classSlug: "barbarian", maximum: () => 10, recovery: "short-rest", minLevel: 11 },
  // R34 (D172): the pool the fiend patron's contract pays from. It named `resource:warlock.fiend.dark-ones-own-luck`
  // and nothing in the client ever created it, so the feature could not be spent at all.
  { id: "resource.warlock.fiend.dark-ones-own-luck", label: "어둠의 존재의 행운", classSlug: "warlock", subclassId: "dnd.srd521.subclass.warlock.fiend-patron", maximum: (_level, mod) => Math.max(1, mod("cha")), recovery: "long-rest", minLevel: 6 },
];
