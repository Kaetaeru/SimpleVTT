/**
 * R16 (ROLL20_TABLE_SPEC.md D112): the SRD 5.2.1 spells that actually put a creature on the board.
 *
 * Most 2024 "conjure" spells no longer summon anything — 동물 소환, 천상체 소환, 원소 소환, 요정 소환, 하급 원소 소환 and
 * 숲의 존재 소환 are auras and areas whose text the spell card already carries, so they are listed here with no
 * creature at all. What remains creates a real creature, and for each the SRD names exactly what it may be.
 */
import { MONSTERS, monsterById, type MonsterView } from "../compendium/monsters";

export interface SummonRule {
  spellId: string;
  /** Monster ids the caster may pick, in the SRD's own order. Empty means "any creature the DM names". */
  choices: string[];
  /** How many creatures one cast puts on the board. */
  count: number;
  /** Shown on the card next to the buttons. */
  note: string;
  /** True when the SRD's own stat block for this spell is not in the compendium, so the DM supplies one. */
  needsOwnBlock?: boolean;
}

const id = (slug: string) => `dnd.srd521.monster.${slug}`;
/** 패밀리어 찾기: "박쥐, 고양이, 개구리, 매, 도마뱀, 문어, 올빼미, 쥐, 까마귀, 거미, 족제비 또는 도전 등급 0인 다른 야수". */
export const familiarForms = (): MonsterView[] => MONSTERS.filter((monster) => monster.creatureType === "beast" && monster.crText === "0");
/** 탈것 찾기: "말, 낙타, 다이어 울프, 엘크 등 당신이 선택한 대형 탑승 동물". */
const STEEDS = ["warhorse", "pony", "camel", "elk", "dire-wolf", "mastiff"].map(id).filter((candidate) => monsterById(candidate));

export const SUMMON_RULES: SummonRule[] = [
  { spellId: "dnd.srd521.spell.find-familiar", choices: familiarForms().map((monster) => monster.id), count: 1, note: "도전 등급 0 야수의 수치를 쓰되 유형은 천상체·요정·악마 중 하나입니다." },
  { spellId: "dnd.srd521.spell.find-steed", choices: STEEDS, count: 1, note: "대형 탑승 동물의 모습이고, 유형은 천상체·요정·악마 중 하나입니다." },
  { spellId: "dnd.srd521.spell.animate-dead", choices: [id("skeleton"), id("zombie")], count: 1, note: "뼈 무더기는 스켈레톤, 시체는 좀비가 됩니다." },
  { spellId: "dnd.srd521.spell.create-undead", choices: [id("ghoul")], count: 3, note: "밤에만 시전할 수 있고, 시체 셋까지 구울이 됩니다." },
  { spellId: "dnd.srd521.spell.summon-dragon", choices: [], count: 1, note: "드라코닉 스피릿 스탯 블록은 컴펜디움에 없습니다 — DM이 쓸 괴물을 고릅니다.", needsOwnBlock: true },
];

/** The 2024 conjure spells that summon nothing, so the table does not offer a creature for them. */
export const CONJURES_NOTHING: Record<string, string> = {
  "dnd.srd521.spell.conjure-animals": "정령 무리는 시전자를 따라다니는 오라입니다 — 놓을 크리처가 없습니다.",
  "dnd.srd521.spell.conjure-celestial": "빛의 기둥이라 크리처가 아닙니다.",
  "dnd.srd521.spell.conjure-elemental": "원소 정령은 지속되는 효과이고 스탯 블록이 없습니다.",
  "dnd.srd521.spell.conjure-fey": "요정 정령은 지속되는 효과입니다.",
  "dnd.srd521.spell.conjure-minor-elementals": "시전자 주위 15피트 오라입니다.",
  "dnd.srd521.spell.conjure-woodland-beings": "시전자 주위 10피트 오라입니다.",
};

export const summonRule = (spellId: string) => SUMMON_RULES.find((rule) => rule.spellId === spellId);
export const summonsNothing = (spellId: string) => CONJURES_NOTHING[spellId];
