/**
 * R33 (D168): what a feat's config means to this engine.
 *
 * The feat catalog carries the numbers (`armorAcBonus`, `rangedWeaponAttackBonus`, `damageDieMinimum` +
 * `weaponPropertiesAny`, `oncePerTurn`, `lightExtraAttackAbilityModifier`, `freeCastReset`) and the derivation reads
 * them here instead of hardcoding them next to a `fighting-style:` flag. Both the engine effects and the one-line
 * notes the sheet shows come from the same keys, so a supplement feat that ships `armorAcBonus: 2` gets the AC and
 * the sheet line without a code change, and nothing can drift between what the app does and what it claims.
 */
import { damageTypeKo } from "./origin";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";

/** How this feat reaches the table. `descriptive` is prose the table adjudicates — the sheet says so out loud. */
export type FeatExecutionStatus = "derived" | "pre-roll" | "selection" | "common-play" | "descriptive";

/** A flat bonus a feat contributes, carrying the feat's name so the sheet's breakdown can name it. */
export interface FeatBonus { source: string; value: number }
/** 대형 무기 전투 and its kin: no damage die on a matching weapon rolls below `minimum`. */
export interface FeatDieMinimum { source: string; minimum: number; properties: string[] }

/** Weapon property ids in the sheet's words (UI vocabulary, shared by the rules text and the printed sheet). */
export const PROPERTY_KO: Record<string, string> = { light: "경량", heavy: "중량", finesse: "교묘", thrown: "투척", versatile: "다재", "two-handed": "양손", reach: "간격", ammunition: "탄약", loading: "장전", special: "특수", nick: "닉" };
const RESET_KO: Record<string, string> = { "long-rest": "긴 휴식", "short-rest": "짧은 휴식", "short-or-long-rest": "짧은 휴식 또는 긴 휴식", turn: "턴", round: "라운드" };
export const resetKo = (reset: string) => RESET_KO[reset] ?? reset;

const num = (config: Record<string, unknown>, key: string) => (typeof config[key] === "number" ? (config[key] as number) : undefined);
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export const featExecutionStatus = (config: Record<string, unknown>): FeatExecutionStatus => {
  const status = (config.execution as { status?: string } | undefined)?.status;
  if (status === "derived" || status === "pre-roll" || status === "selection" || status === "common-play" || status === "descriptive") return status;
  // A feat from an installed module need not declare one: if its config carries a key this engine reads, it runs.
  return featNotes(config).length ? "derived" : "descriptive";
};

/** The weapon-damage minimum a feat asks for, or nothing when the feat does not carry one. */
export function featDieMinimum(config: Record<string, unknown>, source: string): FeatDieMinimum | undefined {
  const minimum = num(config, "damageDieMinimum");
  if (minimum === undefined) return undefined;
  return { source, minimum, properties: strings(config.weaponPropertiesAny) };
}

/** Does this die-minimum rule cover a weapon with these properties? No property list means every weapon. */
export const dieMinimumCovers = (rule: FeatDieMinimum, properties: string[]) => rule.properties.length === 0 || rule.properties.some((property) => properties.includes(property));

/**
 * The sheet's line for a feat: what the engine will actually do with it, written from the same config keys the
 * engine reads. An empty list means the feat changes no number the app tracks.
 */
export function featNotes(config: Record<string, unknown>): string[] {
  const notes: string[] = [];
  const ac = num(config, "armorAcBonus");
  if (ac !== undefined) notes.push(`갑옷을 입은 동안 AC ${ac > 0 ? "+" : ""}${ac} (시트가 이미 더합니다)`);
  const ranged = num(config, "rangedWeaponAttackBonus");
  if (ranged !== undefined) notes.push(`원거리 무기 명중 굴림 ${ranged > 0 ? "+" : ""}${ranged} (시트가 이미 더합니다)`);
  const minimum = featDieMinimum(config, "");
  if (minimum) {
    const where = minimum.properties.length ? `${minimum.properties.map((property) => PROPERTY_KO[property] ?? property).join("·")} 무기` : "무기";
    notes.push(`${where}의 피해 주사위가 ${minimum.minimum} 미만으로 나오면 ${minimum.minimum}으로 칩니다`);
  }
  if (config.oncePerTurn === "reroll-weapon-damage-use-either") notes.push("판정 전 창에서 켜면 무기 피해 주사위를 두 번 굴려 좋은 쪽을 씁니다 (턴당 한 번)");
  if (typeof config.lightExtraAttackAbilityModifier === "string") notes.push("판정 전 창에서 “보조 손”을 켜면 경량 무기의 추가 공격 피해에도 능력 수정치가 붙습니다");
  if (strings(config.grants).includes("initiative-proficiency")) notes.push("우선권에 숙련 보너스를 더합니다");
  const truesight = num(config, "truesight");
  if (truesight !== undefined) notes.push(`진시야 ${truesight}피트`);
  const darkvision = num(config, "darkvision");
  if (darkvision !== undefined) notes.push(`암시야 ${darkvision}피트`);
  const speed = num(config, "speedBonus");
  if (speed !== undefined) notes.push(`이동 속도 +${speed}피트`);
  const hp = num(config, "hitPointsPerLevel");
  if (hp !== undefined) notes.push(`레벨당 최대 HP +${hp}`);
  const saves = ABILITY_KEYS.filter((key) => config[`${key}SaveProficiency`] === true);
  if (saves.length) notes.push(`${saves.map((key) => ABILITY_KO[key]).join("·")} 내성 굴림 숙련`);
  const resistances = strings(config.resistances);
  if (resistances.length) notes.push(`${resistances.map(damageTypeKo).join("·")} 피해 저항`);
  if (typeof config.freeCastReset === "string") notes.push(`고른 주문을 ${resetKo(config.freeCastReset)}마다 한 번 슬롯 없이 시전합니다`);
  // R62 (D197): the choice keys a patch module may add. Each one is a question the wizard asks, so the sheet says so.
  if (config.allSkillProficiencies === true) notes.push("모든 기술에 숙련");
  const expertise = config.expertiseChoice as { count?: number } | undefined;
  if (expertise) notes.push(`숙련된 기술 ${expertise.count ?? 1}개에 전문화`);
  const saveChoice = config.saveProficiencyChoice as { follows?: string } | undefined;
  if (saveChoice) notes.push(saveChoice.follows === "ability-increase" ? "올린 능력치의 내성 굴림에 숙련" : "고른 능력치의 내성 굴림에 숙련");
  const resistanceChoice = config.resistanceChoice as { count?: number } | undefined;
  if (resistanceChoice) notes.push(`고른 피해 유형 ${resistanceChoice.count ?? 1}가지에 저항`);
  const ignoreChoice = config.ignoreResistanceChoice as { count?: number } | undefined;
  if (ignoreChoice) notes.push("자신의 피해가 고른 유형의 저항을 무시합니다");
  const masteryChoice = config.weaponMasteryChoice as { count?: number } | undefined;
  if (masteryChoice) notes.push(`무기 ${masteryChoice.count ?? 1}종의 통달 속성을 씁니다`);
  const granted = [...strings(config.grantCantrips), ...strings(config.grantSpells)];
  if (granted.length) notes.push("고른 주문을 항상 준비합니다");
  if (config.grantSpellChoice) notes.push("만들기·레벨업에서 고른 주문을 항상 준비합니다");
  if (config.abilityIncrease || config.proficiencyChoice || config.choices) notes.push("만들기·레벨업에서 고른 값이 시트에 반영됩니다");
  return notes;
}
