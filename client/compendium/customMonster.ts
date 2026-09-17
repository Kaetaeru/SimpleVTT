/**
 * R74 (ROLL20_TABLE_SPEC.md D209): a custom NPC from JSON a person — or a coding agent — wrote.
 *
 * The compendium's stat blocks are generated from the SRD with every field filled in. A homebrew creature should not
 * need that: this reads a short authoring shape (name, AC, HP, abilities, and actions whose damage is a formula like
 * "2d6+3") and fills in the rest the way the generated blocks carry it, so the NPC sheet, the turn panel and the host's
 * attack and save resolution treat it like an SRD monster. The guide is docs/guides/CUSTOM_NPC_JSON.md.
 */
import type { AbilityKey } from "../catalog/types";
import type { MonsterAction, MonsterDamage, MonsterView } from "./monsters";
import { CONDITION_KO } from "./spells";
import { readTraitRules } from "./monsterTraits";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const CONDITIONS = [...Object.keys(CONDITION_KO), "exhaustion"];
const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const modifier = (score: number) => Math.floor((score - 10) / 2);
const proficiencyFor = (cr: number) => (cr >= 29 ? 9 : cr >= 25 ? 8 : cr >= 21 ? 7 : cr >= 17 ? 6 : cr >= 13 ? 5 : cr >= 9 ? 4 : cr >= 5 ? 3 : 2);
const crText = (cr: number) => (cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const num = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const numbers = (value: unknown) => (isObject(value) ? Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry === "number")) as Record<string, number> : {});

/** "2d6+3", "1d8 - 1", "7" → the damage record the resolver reads. */
export function damageFromFormula(formula: string, type: string): MonsterDamage | null {
  const clean = formula.replace(/\s+/g, "");
  const dice = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(clean);
  if (dice) {
    const count = Number(dice[1] || 1);
    const sides = Number(dice[2]);
    const flat = Number(dice[3] ?? 0);
    return { dice: `${count}d${sides}`, count, sides, flat, average: Math.floor((count * (sides + 1)) / 2) + flat, type };
  }
  if (/^\d+$/.test(clean)) return { dice: "", count: 0, sides: 0, flat: Number(clean), average: Number(clean), type };
  return null;
}

function readDamage(raw: unknown, where: string, warnings: string[]): MonsterDamage[] {
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const out: MonsterDamage[] = [];
  list.forEach((item, index) => {
    if (!isObject(item)) { warnings.push(`${where}.damage[${index}]: 객체가 아닙니다`); return; }
    const type = text(item.type, "bludgeoning");
    if (!DAMAGE_TYPES.includes(type)) warnings.push(`${where}.damage[${index}].type: "${type}"는 저항·면역 계산에 쓰이지 않습니다 (${DAMAGE_TYPES.join("/")})`);
    const damage = damageFromFormula(text(item.formula), type);
    if (damage) out.push(damage);
    else warnings.push(`${where}.damage[${index}]: "${text(item.formula)}"는 읽을 수 없는 공식입니다 (예: "2d6+3")`);
  });
  return out;
}

function readConditions(raw: unknown, where: string, warnings: string[]) {
  const list = strings(raw);
  for (const id of list) if (!CONDITIONS.includes(id)) warnings.push(`${where}: "${id}"는 알 수 없는 상태입니다 (${CONDITIONS.join("/")})`);
  return list.filter((id) => CONDITIONS.includes(id));
}

const signed = (value: number) => (value ? (value > 0 ? `+${value}` : String(value)) : "");

function readAction(raw: unknown, where: string, warnings: string[]): MonsterAction | null {
  if (!isObject(raw)) { warnings.push(`${where}: 객체가 아닙니다`); return null; }
  const name = text(raw.name).trim();
  if (!name) { warnings.push(`${where}: name이 없습니다`); return null; }
  const action: MonsterAction = { name, text: text(raw.text), kind: "text" };
  if (isObject(raw.attack)) {
    const attack = raw.attack;
    const damage = readDamage(attack.damage, `${where}.attack`, warnings);
    action.kind = "attack";
    action.attack = {
      mode: text(attack.mode) === "ranged" ? "ranged" : "melee",
      bonus: num(attack.bonus, 0),
      ...(typeof attack.rangeFeet === "number" ? { rangeFeet: attack.rangeFeet } : {}),
      ...(typeof attack.longRangeFeet === "number" ? { longRangeFeet: attack.longRangeFeet } : {}),
      damage,
      ...(Array.isArray(attack.conditions) ? { riderConditions: readConditions(attack.conditions, `${where}.attack.conditions`, warnings) } : {}),
    };
    if (!action.text) action.text = `${action.attack.mode === "ranged" ? "원거리" : "근접"} 무기 공격: 명중 ${signed(action.attack.bonus) || "+0"}. 명중 시 ${damage.map((part) => `${part.average}(${part.dice}${signed(part.flat)}) ${part.type}`).join(" + ")} 피해.`;
  } else if (isObject(raw.save)) {
    const save = raw.save;
    const ability = text(save.ability, "dex") as AbilityKey;
    if (!ABILITIES.includes(ability)) warnings.push(`${where}.save.ability: "${ability}"는 str/dex/con/int/wis/cha 중 하나여야 합니다`);
    action.kind = "save";
    action.save = {
      ability: ABILITIES.includes(ability) ? ability : "dex",
      dc: num(save.dc, 10),
      ...(save.damage !== undefined ? { failDamage: readDamage(save.damage, `${where}.save`, warnings) } : {}),
      successDamage: text(save.onSuccess) === "none" ? "none" : "half",
      ...(Array.isArray(save.conditions) ? { failConditions: readConditions(save.conditions, `${where}.save.conditions`, warnings) } : {}),
      ...(typeof save.areaFeet === "number" ? { areaFeet: save.areaFeet } : {}),
    };
  } else if (isObject(raw.multiattack)) {
    const routine = (Array.isArray(raw.multiattack.routine) ? raw.multiattack.routine : []).filter(isObject).map((step) => ({ name: text(step.name), count: num(step.count, 1) }));
    action.kind = "multiattack";
    action.multiattack = { count: routine.reduce((sum, step) => sum + step.count, 0), text: action.text, parsed: routine.length > 0, routine };
  }
  if (isObject(raw.recharge)) action.timing = { recharge: { min: num(raw.recharge.min, 6), sides: 6 } };
  if (typeof raw.legendaryCost === "number") action.legendaryCost = raw.legendaryCost;
  // H1 (D238): a trait's rules, the same patterns the SRD index uses.
  const rules = readTraitRules(raw.rules, `${where}.rules`, warnings);
  if (rules.length) action.rules = rules;
  return action;
}

/** Parse authoring JSON into a stat block, or say what is wrong. Unknown fields are ignored; soft problems are warnings. */
export function parseCustomMonster(input: string, random: () => number = Math.random): { monster: MonsterView; warnings: string[] } | { error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch (error) { return { error: `JSON이 아닙니다: ${error instanceof Error ? error.message : String(error)}` }; }
  if (!isObject(parsed)) return { error: "맨 바깥은 { } 객체여야 합니다" };
  const raw = parsed;
  const name = text(raw.name).trim();
  if (!name) return { error: "name(이름)이 필요합니다" };
  if (typeof raw.ac !== "number") return { error: "ac(방어도, 숫자)가 필요합니다" };
  if (typeof raw.hp !== "number" || raw.hp < 1) return { error: "hp(히트 포인트, 1 이상의 숫자)가 필요합니다" };
  const given = isObject(raw.abilities) ? raw.abilities : {};
  const missing = ABILITIES.filter((key) => typeof given[key] !== "number");
  if (missing.length) return { error: `abilities에 ${missing.join("·")} 숫자가 필요합니다 (str·dex·con·int·wis·cha 여섯 개 모두)` };
  const warnings: string[] = [];
  if (raw.size !== undefined && !SIZES.includes(text(raw.size))) warnings.push(`size: "${text(raw.size)}" 대신 medium을 씁니다 (${SIZES.join("/")})`);
  const abilities = Object.fromEntries(ABILITIES.map((key) => [key, given[key] as number])) as Record<AbilityKey, number>;
  const cr = num(raw.cr, 0);
  const pb = proficiencyFor(cr);
  const proficient = strings(raw.saveProficiencies);
  const saves = Object.fromEntries(ABILITIES.map((key) => [key, modifier(abilities[key]) + (proficient.includes(key) ? pb : 0)])) as Record<AbilityKey, number>;
  const speed = num(raw.speed, 30);
  const list = (field: string) => (Array.isArray(raw[field]) ? (raw[field] as unknown[]) : []).map((item, index) => readAction(item, `${field}[${index}]`, warnings)).filter((item): item is MonsterAction => Boolean(item));
  const slug = (text(raw.nameEn) || name).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "npc";
  const monster: MonsterView = {
    id: `custom.monster.${slug}.${random().toString(36).slice(2, 8)}`, slug, name, nameEn: text(raw.nameEn, name),
    size: SIZES.includes(text(raw.size)) ? text(raw.size) : "medium", creatureType: text(raw.creatureType, "humanoid"), typeText: text(raw.type, "인간형"), alignment: text(raw.alignment),
    ac: raw.ac, acText: text(raw.acText), initiativeBonus: num(raw.initiativeBonus, modifier(abilities.dex)),
    hp: raw.hp, hitDice: text(raw.hitDice), speedText: text(raw.speedText, `${speed}ft`), speed, speeds: { walk: speed, ...numbers(raw.speeds) },
    abilities, saves, skills: numbers(raw.skills),
    damageImmunities: strings(raw.damageImmunities), damageResistances: strings(raw.damageResistances),
    damageVulnerabilities: strings(raw.damageVulnerabilities), conditionImmunities: strings(raw.conditionImmunities),
    sensesText: text(raw.senses), senses: {}, passivePerception: num(raw.passivePerception, 10 + modifier(abilities.wis)),
    languagesText: text(raw.languages), cr, crText: crText(cr), xp: num(raw.xp, 0), proficiencyBonus: pb,
    traits: list("traits"), actions: list("actions"), bonusActions: list("bonusActions"), reactions: list("reactions"), legendaryActions: list("legendaryActions"),
    legendaryActionsPerRound: num(raw.legendaryActionsPerRound, 0), legendaryResistance: num(raw.legendaryResistance, 0),
  };
  if (!monster.actions.length) warnings.push("actions가 비어 있습니다 — 턴 패널에 공격 버튼이 없습니다");
  return { monster, warnings };
}

/** The example the paste dialog offers and the guide shows. */
export const CUSTOM_MONSTER_EXAMPLE = {
  name: "늪지 도적 두목",
  nameEn: "Bog Bandit Captain",
  size: "medium",
  type: "인간형",
  creatureType: "humanoid",
  alignment: "혼돈 악",
  ac: 15,
  acText: "스터디드 레더",
  hp: 52,
  hitDice: "8d8+16",
  speed: 30,
  abilities: { str: 14, dex: 16, con: 14, int: 11, wis: 12, cha: 14 },
  saveProficiencies: ["dex", "wis"],
  skills: { stealth: 5, perception: 3 },
  damageResistances: ["poison"],
  senses: "암시야 60ft",
  languages: "공용어, 도적 은어",
  cr: 3,
  xp: 700,
  traits: [{ name: "늪지 은신", text: "늪이나 습지에서 민첩(은신) 판정에 유리합니다." }],
  actions: [
    { name: "다중공격", text: "시미터로 두 번 공격합니다.", multiattack: { routine: [{ name: "시미터", count: 2 }] } },
    { name: "시미터", attack: { mode: "melee", bonus: 5, damage: [{ formula: "1d6+3", type: "slashing" }] } },
    { name: "중형 쇠뇌", attack: { mode: "ranged", bonus: 5, rangeFeet: 80, longRangeFeet: 320, damage: [{ formula: "1d8+3", type: "piercing" }] } },
    { name: "독 안개 병", text: "10피트 반경에 독 안개를 던집니다.", recharge: { min: 5 }, save: { ability: "con", dc: 13, damage: [{ formula: "3d6", type: "poison" }], onSuccess: "half", conditions: ["poisoned"], areaFeet: 10 } },
  ],
  bonusActions: [{ name: "물러서기", text: "추가 행동으로 이탈 행동을 합니다." }],
  reactions: [{ name: "받아넘기기", text: "보이는 공격자의 근접 공격이 명중하기 전에 AC +2." }],
};
