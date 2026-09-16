/**
 * The 2024 action list (SRD 5.2 "Actions"; ROLL20_TABLE_SPEC.md §12.6b, D97): what each official action does at
 * the table when the app tracks the rules but positions are not tracked. Pure: the host feeds actor/target stats
 * and dice, gets back a card and the marks to apply (turn-scoped marks such as 회피 live on the token; real
 * conditions such as 붙잡힘 on the sheet).
 */
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KO } from "../catalog/types";
import type { DerivedCharacter } from "../character/types";
import type { MonsterView } from "../compendium/monsters";

export type ActionKind = "dash" | "disengage" | "dodge" | "help" | "hide" | "influence" | "search" | "study" | "utilize" | "ready" | "grapple" | "shove" | "escape" | /** R9: a legendary action card (not in ACTIONS). */ "legendary" | /** R10: an item used on someone (a potion). */ "item";

export interface ActionDef {
  kind: ActionKind;
  name: string;
  en: string;
  /** One line for the button's tooltip. */
  summary: string;
  /** Needs a target picked on the board. */
  target?: "enemy" | "ally" | "any";
  /** Skills the actor may use for the check (ids as in the catalog). */
  skills?: string[];
  /** Free text (a readied trigger, what is utilised). */
  text?: string;
  /** Second choice for 밀치기: prone or push. */
  choice?: Array<{ value: string; label: string }>;
}

export const SKILL_KO: Record<string, string> = {
  acrobatics: "곡예", "animal-handling": "동물 조련", arcana: "비전", athletics: "운동", deception: "기만", history: "역사", insight: "통찰", intimidation: "위협",
  investigation: "조사", medicine: "의술", nature: "자연", perception: "감지", performance: "공연", persuasion: "설득", religion: "종교", "sleight-of-hand": "손재주",
  stealth: "은신", survival: "생존",
};
export const SKILL_ABILITY_OF: Record<string, AbilityKey> = {
  acrobatics: "dex", "animal-handling": "wis", arcana: "int", athletics: "str", deception: "cha", history: "int", insight: "wis", intimidation: "cha",
  investigation: "int", medicine: "wis", nature: "int", perception: "wis", performance: "cha", persuasion: "cha", religion: "int", "sleight-of-hand": "dex",
  stealth: "dex", survival: "wis",
};

/** The official list in rulebook order; 공격 and 마법 are the sheet's own buttons and live outside this table. */
export const ACTIONS: ActionDef[] = [
  { kind: "grapple", name: "붙잡기", en: "Grapple (Unarmed Strike)", summary: "비무장 타격: 대상이 근력 또는 민첩 내성(DC 8 + 근력 수정치 + 숙련)에 실패하면 붙잡힘", target: "enemy" },
  { kind: "shove", name: "밀치기", en: "Shove (Unarmed Strike)", summary: "비무장 타격: 대상이 내성에 실패하면 넘어지거나 5 ft 밀려남", target: "enemy", choice: [{ value: "prone", label: "넘어뜨리기" }, { value: "push", label: "밀어내기 (5 ft)" }] },
  { kind: "escape", name: "벗어나기", en: "Escape a Grapple", summary: "붙잡힘에서 벗어나기: 운동 또는 곡예 판정 vs 붙잡은 쪽의 DC", target: "enemy" },
  { kind: "dash", name: "질주", en: "Dash", summary: "이번 턴 이동 거리가 두 배" },
  { kind: "disengage", name: "이탈", en: "Disengage", summary: "이번 턴 이동은 기회 공격을 유발하지 않음 (벗어남 프롬프트 생략)" },
  { kind: "dodge", name: "회피", en: "Dodge", summary: "다음 자기 턴 시작까지 자신을 노리는 공격 굴림에 불리, 민첩 내성에 유리" },
  { kind: "help", name: "원조", en: "Help", summary: "아군의 다음 공격 굴림(또는 능력 판정)에 유리 — 당신의 다음 턴 시작 전까지", target: "ally" },
  { kind: "hide", name: "은신", en: "Hide", summary: "민첩(은신) 판정 DC 15: 성공하면 은신 — 공격하거나 들키면 끝", skills: ["stealth"] },
  { kind: "influence", name: "영향", en: "Influence", summary: "매력(기만·위협·공연·설득) 또는 지혜(동물 조련) 판정 DC 15 — DM이 태도로 조정", skills: ["persuasion", "intimidation", "deception", "performance", "animal-handling"] },
  { kind: "search", name: "수색", en: "Search", summary: "지혜(통찰·의술·감지·생존) 판정", skills: ["perception", "insight", "medicine", "survival"] },
  { kind: "study", name: "연구", en: "Study", summary: "지능(비전·역사·조사·자연·종교) 판정", skills: ["arcana", "history", "investigation", "nature", "religion"] },
  { kind: "utilize", name: "활용", en: "Utilize", summary: "물건 하나를 사용 (내용을 적어 카드로 남김)", text: "무엇을 어떻게" },
  { kind: "ready", name: "준비", en: "Ready", summary: "조건과 행동을 정해 두고 반응으로 실행", text: "조건 → 행동" },
];
export const actionDef = (kind: ActionKind) => ACTIONS.find((item) => item.kind === kind)!;

/** Marks each action leaves: on the actor (or the target), removed at the noted time. */
export const TURN_MARKS = {
  /** Removed when the bearer's turn ends. */
  endOfTurn: ["이탈", "질주"],
  /** Removed when the bearer's next turn starts (도움 instead ends when the helper's next turn starts). */
  startOfTurn: ["회피", "준비"],
  /** Removed when the bearer attacks. */
  onAttack: ["도움", "은신"],
} as const;

/** What the resolver needs from a sheet or stat block. Ability values are modifiers. */
export interface ActorStats { abilities: Record<AbilityKey, number>; saves: Record<AbilityKey, number>; skills: Record<string, number>; proficiencyBonus: number }

export const pcStats = (derived: DerivedCharacter): ActorStats => ({
  abilities: Object.fromEntries(Object.entries(derived.abilities).map(([key, value]) => [key, value.modifier])) as Record<AbilityKey, number>,
  saves: Object.fromEntries(Object.entries(derived.saves).map(([key, value]) => [key, value.bonus])) as Record<AbilityKey, number>,
  skills: Object.fromEntries(derived.skills.map((skill) => [skill.id, skill.bonus])),
  proficiencyBonus: derived.proficiencyBonus,
});

export const npcStats = (block: MonsterView): ActorStats => ({
  abilities: Object.fromEntries(Object.entries(block.abilities).map(([key, score]) => [key, Math.floor((score - 10) / 2)])) as Record<AbilityKey, number>,
  saves: block.saves,
  skills: block.skills,
  proficiencyBonus: block.proficiencyBonus,
});

/** A skill bonus: the listed one, else the ability modifier (untrained). */
export const skillBonus = (stats: ActorStats, skill: string) => stats.skills[skill] ?? stats.abilities[SKILL_ABILITY_OF[skill] ?? "int"] ?? 0;
/** 2024 Unarmed Strike (Grapple/Shove) DC: 8 + STR modifier + proficiency bonus. */
export const unarmedDc = (stats: ActorStats) => 8 + stats.abilities.str + stats.proficiencyBonus;
/** The target chooses the save; the app takes the better bonus. */
export const bestOf = <K extends string>(pairs: Array<[K, number]>): [K, number] => pairs.reduce((best, pair) => (pair[1] > best[1] ? pair : best));

export interface ActCheck { label: string; d20: number; bonus: number; total: number; dc?: number; success?: boolean; /** R37 (D177): a contract was paid to redo this roll, and what paid for it. */ rescue?: string }
export interface ActResult {
  kind: ActionKind;
  name: string;
  actor: { name: string };
  target?: { name: string };
  /** What happened, in one line. */
  text: string;
  check?: ActCheck;
  /** Marks to put on the actor's token (turn-scoped states). */
  actorMarks: string[];
  /** Marks/conditions to put on the target. */
  targetMarks: string[];
  /** Marks to remove from the actor. */
  actorUnmarks: string[];
  /** The bonus action was used instead of the action. */
  bonus?: boolean;
}

export interface ActInput {
  kind: ActionKind;
  actor: { name: string; stats: ActorStats; conditions: string[] };
  target?: { name: string; stats: ActorStats; conditions: string[] };
  skill?: string;
  dc?: number;
  note?: string;
  choice?: string;
  bonus?: boolean;
  random: () => number;
  /**
   * R37 (D177): redo this action's d20 from a contract's `roll.modify` — `forceD20` replaces the die, `rollDelta`
   * is added to the total (extra dice, flat bonuses), and `rescue` names what paid so the card can say it.
   */
  forceD20?: number;
  rollDelta?: number;
  rescue?: string;
}

const d20 = (random: () => number) => 1 + Math.floor(random() * 20);

/** 2024 Unarmed Strike (Grapple/Shove) needs a free hand: nothing in the off hand and no two-handed weapon in use. */
export const hasFreeHand = (items: Array<{ equipped?: boolean; wieldSlot?: "main-hand" | "off-hand" | "two-hand" }>) => !items.some((item) => item.equipped && (item.wieldSlot === "off-hand" || item.wieldSlot === "two-hand"));

/** Conditions that take the action away altogether. */
// 2024: Paralyzed, Petrified, Stunned and Unconscious all include the Incapacitated condition.
export const CANNOT_ACT = ["행동불능", "무의식", "마비", "석화", "충격"];
export const cannotAct = (conditions: string[]) => CANNOT_ACT.find((name) => conditions.includes(name));

export function resolveAction(input: ActInput): ActResult {
  const def = actionDef(input.kind);
  const base: ActResult = { kind: input.kind, name: def.name, actor: { name: input.actor.name }, target: input.target ? { name: input.target.name } : undefined, text: "", actorMarks: [], targetMarks: [], actorUnmarks: [], bonus: input.bonus };
  const check = (label: string, bonus: number, dc?: number): ActCheck => { const die = input.forceD20 ?? d20(input.random); const total = die + bonus + (input.rollDelta ?? 0); return { label, d20: die, bonus, total, dc, success: dc === undefined ? undefined : total >= dc, ...(input.rescue ? { rescue: input.rescue } : {}) }; };
  const skillCheck = (skill: string, dc?: number) => check(`${input.actor.name} · ${ABILITY_KO[SKILL_ABILITY_OF[skill] ?? "int"]}(${SKILL_KO[skill] ?? skill})`, skillBonus(input.actor.stats, skill), dc);
  switch (input.kind) {
    case "dash": return { ...base, text: "이번 턴 이동 거리가 두 배가 됩니다.", actorMarks: ["질주"] };
    case "disengage": return { ...base, text: "이번 턴의 이동은 기회 공격을 유발하지 않습니다.", actorMarks: ["이탈"] };
    case "dodge": return { ...base, text: "다음 자기 턴 시작까지 자신을 노리는 공격 굴림에 불리, 민첩 내성에 유리.", actorMarks: ["회피"] };
    case "help": {
      if (!input.target) return { ...base, text: "도울 아군을 고르세요." };
      return { ...base, text: `${input.target.name}의 다음 공격 굴림(또는 능력 판정)에 유리 — ${input.actor.name}의 다음 턴 시작 전까지.`, targetMarks: ["도움"] };
    }
    case "hide": {
      const result = skillCheck("stealth", input.dc ?? 15);
      return { ...base, check: result, text: result.success ? "은신 성공: 공격하거나 들킬 때까지 숨어 있습니다 (공격 굴림에 유리)." : "은신 실패: 눈에 띕니다.", actorMarks: result.success ? ["은신"] : [] };
    }
    case "influence": case "search": case "study": {
      const skill = input.skill && def.skills?.includes(input.skill) ? input.skill : def.skills![0];
      const result = skillCheck(skill, input.dc ?? (input.kind === "influence" ? 15 : undefined));
      const verdict = result.success === undefined ? "DM이 결과를 정합니다." : result.success ? "성공." : "실패.";
      return { ...base, check: result, text: `${def.name} — ${verdict}${input.note ? ` (${input.note})` : ""}` };
    }
    case "utilize": return { ...base, text: `활용: ${input.note?.trim() || "물건 하나를 사용"}` };
    case "ready": return { ...base, text: `준비: ${input.note?.trim() || "조건이 오면 반응으로 실행"}`, actorMarks: ["준비"] };
    case "grapple": case "shove": {
      if (!input.target) return { ...base, text: "대상을 고르세요." };
      const dc = unarmedDc(input.actor.stats);
      const [ability, bonus] = bestOf<AbilityKey>([["str", input.target.stats.saves.str], ["dex", input.target.stats.saves.dex]]);
      const result = check(`${input.target.name} · ${ABILITY_KO[ability]} 내성`, bonus, dc);
      if (result.success) return { ...base, check: result, text: `${input.target.name}이(가) 내성에 성공해 ${def.name}를 버텨냅니다.` };
      if (input.kind === "grapple") return { ...base, check: result, text: `${input.target.name}이(가) 붙잡혔습니다 (이동 속도 0, 벗어나기 DC ${dc}).`, targetMarks: ["붙잡힘"] };
      return input.choice === "push" ? { ...base, check: result, text: `${input.target.name}이(가) 5 ft 밀려납니다.` } : { ...base, check: result, text: `${input.target.name}이(가) 넘어집니다.`, targetMarks: ["넘어짐"] };
    }
    case "escape": {
      const dc = input.dc ?? (input.target ? unarmedDc(input.target.stats) : 12);
      const [skill, bonus] = bestOf<string>([["athletics", skillBonus(input.actor.stats, "athletics")], ["acrobatics", skillBonus(input.actor.stats, "acrobatics")]]);
      const result = check(`${input.actor.name} · ${ABILITY_KO[SKILL_ABILITY_OF[skill]]}(${SKILL_KO[skill]})`, bonus, dc);
      return { ...base, check: result, text: result.success ? "붙잡힘에서 벗어났습니다." : "벗어나지 못했습니다.", actorUnmarks: result.success ? ["붙잡힘"] : [] };
    }
    default:
      return { ...base, text: input.note ?? "" };
  }
}

export function describeAct(result: ActResult) {
  const who = result.target ? `${result.actor.name} → ${result.target.name}` : result.actor.name;
  const check = result.check ? ` [${result.check.label}: d20 ${result.check.d20}${result.check.bonus >= 0 ? "+" : ""}${result.check.bonus} = ${result.check.total}${result.check.dc !== undefined ? ` vs DC ${result.check.dc}` : ""}]` : "";
  return `${who}: ${result.name}${result.bonus ? " (추가 행동)" : ""} — ${result.text}${check}`;
}
