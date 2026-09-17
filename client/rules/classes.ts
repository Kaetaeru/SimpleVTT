/**
 * The vocabulary of a class definition: training kinds, the progression table's column names, and the shape of the
 * rules a class module's `class-definition` config carries (H4, D243). Which class has which training, resources or
 * option pools is data in the class modules, not here.
 */
import type { AbilityKey } from "../catalog/types";
import type { Expr } from "./contract";

export type ArmorTraining = "light" | "medium" | "heavy" | "shield";
export type WeaponTraining = "simple" | "martial" | "martial-light" | "martial-finesse-or-light";

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

/** A class resource pool: its maximum is a progression column or an expression over `class.level` and `ability.<key>.modifier`. */
export interface ClassResourceRule {
  id: string;
  label: string;
  column?: string;
  max?: Expr;
  recovery: "short-rest" | "long-rest" | "short-rest:1" | "short-rest:half";
  /** Recovery that replaces `recovery` from a class level (Font of Inspiration: Bardic Inspiration on a short rest from 5). */
  recoveryFrom?: { level: number; recovery: "short-rest" | "long-rest" };
  minLevel: number;
  /** R34 (D172): a pool a subclass grants — only created when the character took that subclass. */
  subclassId?: string;
  /** English spell name this pool casts for free. */
  spell?: string;
}

/** A list of class options known in growing numbers by class level (메타매직: 2 at 2, 3 at 10, 4 at 17). */
export interface ClassOptionPool {
  id: string;
  list: string;
  label: string;
  source?: "metamagic";
  known: Record<string, number>;
}

/** H4 (D243): the rules a class definition carries beside its hit die and saves. */
export interface ClassRules {
  armorTraining: ArmorTraining[];
  weaponTraining: WeaponTraining[];
  toolProficiencies: string[];
  /** What a character gains when taking the class after the first, and the scores it needs (13 in all, or in any). */
  multiclass: { armor: ArmorTraining[]; weapons: WeaponTraining[]; skills?: number; tools?: string[]; instruments?: number; prerequisites?: { all?: AbilityKey[]; any?: AbilityKey[] } };
  spellcastingAbility?: AbilityKey;
  /** The feature the class's spellcasting (slots, cantrips, prepared spells) implements (`warlock.pact-magic`). */
  spellcastingFeature?: string;
  resources: ClassResourceRule[];
  optionPools: ClassOptionPool[];
}

