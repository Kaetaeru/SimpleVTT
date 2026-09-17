/**
 * deriveCharacter(source, catalog) → DerivedCharacter (CHARACTER_SYSTEM.md §4.3).
 *
 * One forward pass builds the grant ledger (identity → abilities → languages → species → background → tracks →
 * equipment); the numbers (HP, AC, saves, skills, attacks, slots) are then computed from the finished ledger, so
 * every value on the sheet has one formula and one breakdown.
 */
import type { ContentCatalog, ItemView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { abilityModifier, fixedHitPoints, SIZE_KO } from "../rules/tables";
import { COLUMN, numericColumn } from "../rules/classes";
import { MASTERY_KO, SKILL_ABILITY, weaponIsProficient } from "./choices";
import { applyEquipment } from "./equipment";
import { Ledger } from "./ledger";
import { applyPassiveContracts, applyActiveEffects } from "../rules/effects";
import { featureRuleKey } from "../rules/activation";
import { characterScope } from "../rules/contract";
import { contractDurations, contractSummary, featureContract } from "../rules/contractActivation";
import { characterRiders } from "../rules/attackRiders";
import { contractBonusActions } from "../rules/contractActivation";
import { applyBackground, applyLanguages, applySpecies, damageTypeKo } from "./origin";
import { dieMinimumCovers } from "./featRules";
import { validateAbilities } from "./source";
import { deriveSpellSlots } from "./spells";
import { applyTracks } from "./tracks";
import { customAttackId, customItemActive, customItemApplication } from "./customItem";
import type { ActiveEffect, CharacterSource, DerivedAttack, DerivedCharacter, DerivedItem, DerivedSkill, DerivedSpellcasting, InventoryPatch, Term } from "./types";

const ARMOR_KO: Record<string, string> = { light: "경장 방어구", medium: "평장 방어구", heavy: "중장 방어구", shield: "방패" };
const WEAPON_KO: Record<string, string> = { simple: "단순 무기", martial: "군용 무기", "martial-light": "경량 속성 군용 무기", "martial-finesse-or-light": "교묘·경량 속성 군용 무기" };
const CONDITION_KO: Record<string, string> = { poisoned: "중독", charmed: "매혹", frightened: "공포" };

export interface DeriveOptions {
  /** Instance ids of the items worn or held (from the runtime); defaults to the loadout's default equip state. */
  equipped?: { armor?: string; shield?: string; mainHand?: string; offHand?: string };
  /** Bag changes made during play (removed, quantity, added items). */
  inventory?: InventoryPatch;
  /** Effects in force (Rage, Bless, Shield…): their numbers land on the sheet with provenance. */
  effects?: ActiveEffect[];
}

export function deriveCharacter(source: CharacterSource, catalog: ContentCatalog, options: DeriveOptions = {}): DerivedCharacter {
  const ledger = new Ledger(source, catalog);
  if (!source.name.trim()) ledger.blocking.push("이름을 정하세요.");
  const abilityCheck = validateAbilities(source.abilities);
  ledger.blocking.push(...abilityCheck.blocking);
  ledger.warnings.push(...abilityCheck.warnings);
  applyLanguages(ledger);
  applySpecies(ledger);
  applyBackground(ledger);
  applyTracks(ledger);
  applyEquipment(ledger);
  if (options.inventory) applyInventoryPatch(ledger, options.inventory);
  if (options.equipped) applyEquipState(ledger, options.equipped);
  const derived = finalize(ledger);
  // R49 (D184): every feature's contract, worked out once and carried with the sheet.
  const durations = contractDurations(catalog, characterScope(derived));
  const featureContracts: NonNullable<DerivedCharacter["featureContracts"]> = {};
  for (const feature of derived.features) {
    const key = featureRuleKey(feature.id);
    const found = durations(key, feature.name);
    if (found) featureContracts[key] = found;
    // R50 (D185): the sheet's line for this feature, written from its contract — the same thing R33 did for feats.
    const contract = featureContract(catalog, key);
    // R51 (D186): a feat already carries the lines its own config produced (R33); the contract's join them rather
    // than replacing them, so a feat that is half config and half contract says both halves.
    if (contract) { const summary = contractSummary(contract, characterScope(derived)); feature.rules = [...(feature.rules ?? []), ...summary.rules]; feature.execution = summary.execution; }
  }
  derived.featureContracts = featureContracts;
  // R52 (D187): what this sheet may declare in the attack dialog, worked out once and carried with it.
  derived.attackRiders = characterRiders(derived, catalog);
  // R59 (D194): official actions a contract said may be taken as a bonus action instead.
  derived.bonusActions = contractBonusActions(derived, catalog);
  // R43 (D183): passives first (they are always on), then whatever is running right now.
  const passive = applyPassiveContracts(derived, catalog);
  // R75 (D210): pasted magic items, as always-on effects while attuned (and worn, for armour).
  const magic = passive.inventory.filter(customItemActive);
  const equipped = magic.length ? applyActiveEffects(passive, magic.map((item) => ({ key: `item:${item.instanceId}`, name: item.name, source: "feature" as const, duration: "상시", concentration: false, elapsed: 0, startedAt: "" })), catalog, { list: false, inline: Object.fromEntries(magic.map((item) => [`item:${item.instanceId}`, customItemApplication(item)])) }) : passive;
  return options.effects?.length ? applyActiveEffects(equipped, options.effects, catalog) : equipped;
}

function applyInventoryPatch(ledger: Ledger, patch: InventoryPatch) {
  const removed = new Set(patch.removed);
  for (let index = ledger.inventory.length - 1; index >= 0; index -= 1) if (removed.has(ledger.inventory[index].instanceId)) ledger.inventory.splice(index, 1);
  for (const item of ledger.inventory) { const quantity = patch.quantities[item.instanceId]; if (quantity !== undefined) item.quantity = Math.max(0, quantity); }
  for (const extra of patch.extra) {
    if (removed.has(extra.instanceId)) continue;
    const itemId = extra.custom ? extra.custom.base : extra.itemId;
    const view = itemId ? ledger.catalog.itemById(itemId) : undefined;
    const quantity = patch.quantities[extra.instanceId] ?? extra.quantity;
    const item: DerivedItem = { instanceId: extra.instanceId, itemId: itemId ?? `custom:${extra.instanceId}`, name: extra.custom?.name ?? view?.name ?? extra.name, kind: view?.kind ?? "custom", quantity, source: "세션 중 획득", custom: !view && !extra.custom, ...(extra.custom ? { magic: extra.custom, attuned: extra.attuned === true } : {}) };
    ledger.inventory.push(item);
  }
}

function applyEquipState(ledger: Ledger, equipped: NonNullable<DeriveOptions["equipped"]>) {
  const wanted = new Set([equipped.armor, equipped.shield, equipped.mainHand, equipped.offHand].filter(Boolean));
  for (const item of ledger.inventory) {
    item.equipped = wanted.has(item.instanceId);
    item.wieldSlot = item.instanceId === equipped.mainHand ? "main-hand" : item.instanceId === equipped.offHand ? "off-hand" : undefined;
  }
}

function finalize(ledger: Ledger): DerivedCharacter {
  const { catalog, source } = ledger;
  const level = source.tracks.length;
  const pb = ledger.proficiencyBonus;

  // Abilities with breakdown.
  const abilities = {} as DerivedCharacter["abilities"];
  for (const key of ABILITY_KEYS) {
    const base = source.abilities.base[key] ?? 10;
    const score = ledger.abilityScore(key);
    abilities[key] = { score, modifier: abilityModifier(score), base, bonuses: ledger.abilityBonuses[key].map((bonus) => ({ source: bonus.source, value: bonus.value })) };
  }
  const mod = (key: AbilityKey) => abilities[key].modifier;

  // Hit points: level 1 = die + CON, later levels = fixed or rolled + CON, at least 1 per level, plus per-level bonuses.
  let hpMax = 0;
  const hpBreakdown: string[] = [];
  const hpTerms: Term[] = [];
  let hpFloorFix = 0;
  const conMod = mod("con");
  source.tracks.forEach((track, index) => {
    const cls = catalog.classById(track.classId);
    const die = cls?.hitDie ?? 8;
    let gain: number;
    let label: string;
    if (index === 0) { gain = die; label = `1레벨 ${cls?.name ?? ""} d${die} 최대값 ${die}`; }
    else if (track.hp.kind === "roll") { gain = Math.max(1, Math.min(die, Math.floor(track.hp.value))); label = `${index + 1}레벨 ${cls?.name ?? ""} 굴림 ${gain}`; }
    else { gain = fixedHitPoints(die); label = `${index + 1}레벨 ${cls?.name ?? ""} 고정 ${gain}`; }
    const total = Math.max(1, gain + conMod);
    hpFloorFix += total - (gain + conMod);
    hpMax += total;
    hpBreakdown.push(`${label} ${conMod >= 0 ? "+" : "−"} 건강 ${Math.abs(conMod)} = ${total}`);
    hpTerms.push({ label, value: gain });
  });
  if (level > 0 && conMod !== 0) hpTerms.push({ label: `건강 수정치 ${conMod > 0 ? "+" : ""}${conMod} × ${level}레벨`, value: conMod * level });
  if (hpFloorFix) hpTerms.push({ label: "레벨당 최소 1 보정", value: hpFloorFix });
  if (ledger.hpPerLevelBonus) { hpMax += ledger.hpPerLevelBonus * level; hpBreakdown.push(`레벨당 +${ledger.hpPerLevelBonus} × ${level} = ${ledger.hpPerLevelBonus * level}`); hpTerms.push({ label: `${ledger.hpPerLevelSource ?? "특성"} +${ledger.hpPerLevelBonus} × ${level}레벨`, value: ledger.hpPerLevelBonus * level }); }
  if (ledger.hpFlatBonus) { hpMax += ledger.hpFlatBonus; hpBreakdown.push(`추가 +${ledger.hpFlatBonus}`); hpTerms.push({ label: "추가", value: ledger.hpFlatBonus }); }
  const draconic = [...ledger.classes.values()].find((state) => state.slug === "sorcerer" && state.level >= 3 && state.subclassId?.endsWith("draconic"));
  if (draconic) { hpMax += draconic.level; hpBreakdown.push(`용의 회복력 +${draconic.level}`); hpTerms.push({ label: "용의 회복력 (소서러 레벨)", value: draconic.level }); }

  // Worn armor and shield.
  const itemOf = (itemId: string) => catalog.itemById(itemId);
  const wornArmor = ledger.inventory.find((item) => item.equipped && itemOf(item.itemId)?.kind === "armor");
  const wornShield = ledger.inventory.find((item) => item.equipped && itemOf(item.itemId)?.kind === "shield");
  const armorView = wornArmor ? itemOf(wornArmor.itemId) : undefined;
  const shieldView = wornShield ? itemOf(wornShield.itemId) : undefined;
  const heavyArmorWorn = armorView?.armor?.training === "heavy";
  const strengthShort = armorView?.armor?.strengthRequirement !== undefined && abilities.str.score < armorView.armor.strengthRequirement;
  if (armorView?.armor && !ledger.armor.has(armorView.armor.training)) ledger.warnings.push(`${armorView.name}은(는) 훈련되지 않은 방어구입니다 (불리, 주문 시전 불가).`);
  if (strengthShort) ledger.warnings.push(`${armorView?.name}의 근력 요구치(${armorView?.armor?.strengthRequirement})에 못 미쳐 이동 속도가 10피트 줄어듭니다.`);
  if (shieldView && !ledger.armor.has("shield")) ledger.warnings.push("방패 훈련이 없습니다.");

  // Armor class: the best applicable formula.
  const acCandidates: Array<{ value: number; source: string; breakdown: string[]; terms: Term[] }> = [];
  const dex = mod("dex");
  const shieldBonus = shieldView?.shieldBonus ?? 0;
  // R33 (D168): 방어 전투 방식 and anything else the catalog gives an `armorAcBonus` — the number and the label
  // both come from the feat, so a second such feat adds instead of being ignored.
  const armorFeats = ledger.featEffects.armorAcBonus;
  const defenseStyle = armorFeats.reduce((sum, bonus) => sum + bonus.value, 0);
  if (armorView?.armor) {
    const armor = armorView.armor;
    const dexPart = armor.dexFull ? dex : armor.dexMax !== undefined ? Math.min(dex, armor.dexMax) : 0;
    const value = armor.base + dexPart + shieldBonus + defenseStyle;
    const lines = [`${armorView.name} ${armor.base}`, armor.dexFull ? `민첩 ${dex}` : armor.dexMax !== undefined ? `민첩 ${dexPart} (최대 ${armor.dexMax})` : "민첩 없음"];
    const terms: Term[] = [{ label: armorView.name, value: armor.base }, { label: armor.dexFull ? "민첩 수정치" : armor.dexMax !== undefined ? `민첩 수정치 (최대 ${armor.dexMax})` : "민첩 수정치 (중장, 적용 안 함)", value: dexPart }];
    if (shieldBonus) { lines.push(`방패 +${shieldBonus}`); terms.push({ label: shieldView?.name ?? "방패", value: shieldBonus }); }
    for (const bonus of armorFeats) { lines.push(`${bonus.source} ${bonus.value > 0 ? "+" : ""}${bonus.value}`); terms.push({ label: bonus.source, value: bonus.value }); }
    acCandidates.push({ value, source: armorView.name, breakdown: lines, terms });
  } else {
    const shieldTerm: Term[] = shieldBonus ? [{ label: shieldView?.name ?? "방패", value: shieldBonus }] : [];
    acCandidates.push({ value: 10 + dex + shieldBonus, source: "방어구 없음", breakdown: [`기본 10`, `민첩 ${dex}`, ...(shieldBonus ? [`방패 +${shieldBonus}`] : [])], terms: [{ label: "기본", value: 10 }, { label: "민첩 수정치", value: dex }, ...shieldTerm] });
    if (ledger.flags.has("unarmored-defense:barbarian")) acCandidates.push({ value: 10 + dex + mod("con") + shieldBonus, source: "비무장 방어 (바바리안)", breakdown: ["기본 10", `민첩 ${dex}`, `건강 ${mod("con")}`, ...(shieldBonus ? [`방패 +${shieldBonus}`] : [])], terms: [{ label: "기본", value: 10 }, { label: "민첩 수정치", value: dex }, { label: "건강 수정치 (비무장 방어)", value: mod("con") }, ...shieldTerm] });
    if (ledger.flags.has("unarmored-defense:monk") && !shieldView) acCandidates.push({ value: 10 + dex + mod("wis"), source: "비무장 방어 (몽크)", breakdown: ["기본 10", `민첩 ${dex}`, `지혜 ${mod("wis")}`], terms: [{ label: "기본", value: 10 }, { label: "민첩 수정치", value: dex }, { label: "지혜 수정치 (비무장 방어)", value: mod("wis") }] });
    if (ledger.features.some((feature) => feature.id.endsWith("draconic-sorcery.draconic-resilience"))) acCandidates.push({ value: 10 + dex + mod("cha") + shieldBonus, source: "용의 회복력", breakdown: ["기본 10", `민첩 ${dex}`, `매력 ${mod("cha")}`, ...(shieldBonus ? [`방패 +${shieldBonus}`] : [])], terms: [{ label: "기본", value: 10 }, { label: "민첩 수정치", value: dex }, { label: "매력 수정치 (용의 회복력)", value: mod("cha") }, ...shieldTerm] });
  }
  const ac = acCandidates.reduce((best, candidate) => (candidate.value > best.value ? candidate : best));

  // Speed and senses.
  const speedTerms: Term[] = [{ label: `종족 기본 (${catalog.speciesById(source.origin.speciesId)?.name ?? "종족"})`, value: ledger.speedBase }];
  if (ledger.speedBonus) speedTerms.push({ label: "추가 속도", value: ledger.speedBonus });
  let walk = ledger.speedBase + ledger.speedBonus;
  if (ledger.flags.has("fast-movement") && !heavyArmorWorn) { walk += 10; speedTerms.push({ label: "빠른 이동 (바바리안)", value: 10 }); }
  if (ledger.flags.has("unarmored-movement") && !armorView && !shieldView) {
    const monk = ledger.classBySlug("monk");
    const cls = monk ? catalog.classById(monk.classId) : undefined;
    const row = cls && monk ? cls.progression[monk.level - 1] : undefined;
    const bonus = numericColumn(row?.columns[COLUMN.unarmoredMovement]);
    if (bonus) { walk += bonus; speedTerms.push({ label: "비무장 이동 (몽크)", value: bonus }); }
  }
  if (strengthShort) { walk -= 10; speedTerms.push({ label: `${armorView?.name} 근력 요구치 미달`, value: -10 }); }
  const roving = [...ledger.classes.values()].some((state) => state.slug === "ranger" && state.level >= 6) && !heavyArmorWorn;
  if (roving) { walk += 10; speedTerms.push({ label: "로빙 (레인저)", value: 10 }); }
  const speed: DerivedCharacter["speed"] = { walk, terms: speedTerms };
  if (roving) { speed.climb = walk; speed.swim = walk; }
  if (ledger.extraSpeeds.swim !== undefined) speed.swim = ledger.extraSpeeds.swim < 0 ? walk : ledger.extraSpeeds.swim;
  if (ledger.extraSpeeds.climb !== undefined) speed.climb = ledger.extraSpeeds.climb < 0 ? walk : ledger.extraSpeeds.climb;
  if (ledger.extraSpeeds.fly !== undefined) speed.fly = ledger.extraSpeeds.fly < 0 ? walk : ledger.extraSpeeds.fly;

  // Saves and skills.
  const saves = {} as DerivedCharacter["saves"];
  const auraOfProtection = [...ledger.classes.values()].some((state) => state.slug === "paladin" && state.level >= 6) ? Math.max(1, mod("cha")) : 0;
  for (const key of ABILITY_KEYS) {
    const proficient = ledger.saves.has(key) || ledger.flags.has("all-saves");
    const terms: Term[] = [{ label: `${ABILITY_KO[key]} 수정치`, value: mod(key) }];
    if (proficient) terms.push({ label: `숙련 보너스 (${ledger.saves.get(key) ?? "단련된 생존자"})`, value: pb });
    if (auraOfProtection) terms.push({ label: "보호의 오라 (매력)", value: auraOfProtection });
    saves[key] = { proficient, bonus: terms.reduce((total, term) => total + term.value, 0), terms };
  }
  const jack = ledger.flags.has("jack-of-all-trades") ? Math.floor(pb / 2) : 0;
  const skills: DerivedSkill[] = Object.entries(catalog.skills).map(([id, name]) => {
    const ability = SKILL_ABILITY[id] ?? "int";
    const proficient = ledger.hasSkill(id);
    const expertise = proficient && ledger.hasExpertise(id);
    // R97 (D232): 기적술사·마법사 add Wisdom (minimum +1) to these knowledge checks.
    const wisBonus = ledger.flags.has(`wis-skill-bonus:${id}`) ? Math.max(1, mod("wis")) : 0;
    const bonus = mod(ability) + (expertise ? pb * 2 : proficient ? pb : jack) + wisBonus;
    const record = ledger.skills.get(id);
    const terms: Term[] = [{ label: `${ABILITY_KO[ability]} 수정치`, value: mod(ability) }];
    if (expertise) terms.push({ label: `전문화 ×2 (${record?.expertise[0] ?? ""})`, value: pb * 2 });
    else if (proficient) terms.push({ label: `숙련 보너스 (${record?.proficient[0] ?? ""})`, value: pb });
    else if (jack) terms.push({ label: "만능재주 (숙련 보너스 절반)", value: jack });
    if (wisBonus) terms.push({ label: "지혜 수정치 (신성·원초 질서)", value: wisBonus });
    return { id, name, ability, proficient, expertise, bonus, terms };
  }).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const perception = skills.find((skill) => skill.id === "perception");
  const passivePerception = 10 + (perception?.bonus ?? mod("wis"));
  const passivePerceptionTerms: Term[] = [{ label: "기본", value: 10 }, ...(perception?.terms ?? [{ label: "지혜 수정치", value: mod("wis") }]).map((term) => ({ label: `지각: ${term.label}`, value: term.value }))];
  const initiative = mod("dex") + (ledger.flags.has("initiative-proficiency") ? pb : 0) + ledger.initiativeBonus;
  const initiativeTerms: Term[] = [{ label: "민첩 수정치", value: mod("dex") }];
  if (ledger.flags.has("initiative-proficiency")) initiativeTerms.push({ label: "숙련 보너스 (경계 재주)", value: pb });
  if (ledger.initiativeBonus) initiativeTerms.push({ label: "추가", value: ledger.initiativeBonus });

  // Spellcasting entries.
  const spellcasting: DerivedSpellcasting[] = [];
  for (const entry of ledger.spellcasting.values()) {
    const abilityMod = mod(entry.ability);
    const cantrips = [...entry.cantrips, ...entry.extraCantrips].filter((id, index, list) => list.indexOf(id) === index);
    if (cantrips.length === 0 && entry.prepared.size === 0 && entry.alwaysPrepared.size === 0 && !entry.spellbook && entry.preparedMax === 0 && entry.cantripsMax === 0) continue;
    spellcasting.push({
      key: entry.key, source: entry.key.startsWith("class:") ? "class" : entry.key === "species" ? "species" : "feat",
      classId: entry.classId, className: entry.className, ability: entry.ability, saveDc: 8 + pb + abilityMod, attackBonus: pb + abilityMod,
      saveDcTerms: [{ label: "기본", value: 8 }, { label: "숙련 보너스", value: pb }, { label: `${ABILITY_KO[entry.ability]} 수정치`, value: abilityMod }],
      attackTerms: [{ label: "숙련 보너스", value: pb }, { label: `${ABILITY_KO[entry.ability]} 수정치`, value: abilityMod }],
      cantrips, prepared: [...entry.prepared], alwaysPrepared: [...entry.alwaysPrepared], spellbook: entry.spellbook ? [...entry.spellbook] : undefined,
      preparedMax: entry.preparedMax, cantripsMax: entry.cantripsMax,
    });
  }
  const { slots, pact } = deriveSpellSlots(ledger);

  // Attacks: every weapon carried, plus the unarmed strike.
  const attacks: DerivedAttack[] = [];
  const seenWeapons = new Set<string>();
  for (const item of ledger.inventory) {
    const view = itemOf(item.itemId);
    if (!view?.weapon) continue;
    // R75 (D210): a magic weapon is its own row, named for itself, so its bonus does not land on the plain one.
    if (item.magic) { attacks.push({ ...weaponAttack(ledger, view, abilities, pb), id: customAttackId(item), name: item.name }); continue; }
    if (seenWeapons.has(view.id)) continue;
    seenWeapons.add(view.id);
    attacks.push(weaponAttack(ledger, view, abilities, pb));
  }
  attacks.push(unarmedStrike(ledger, abilities, pb));

  // Proficiency lists.
  const armorList = (["light", "medium", "heavy", "shield"] as const).filter((training) => ledger.armor.has(training)).map((training) => ARMOR_KO[training]);
  const weaponList = (["simple", "martial", "martial-light", "martial-finesse-or-light"] as const).filter((training) => ledger.weapons.has(training) && !(training !== "martial" && training.startsWith("martial") && ledger.weapons.has("martial"))).map((training) => WEAPON_KO[training]);

  // Classes summary and hit dice.
  const classes = [...ledger.classes.values()].sort((a, b) => a.firstTrack - b.firstTrack).map((state) => {
    const subclass = state.subclassId ? catalog.subclassById(state.subclassId) : undefined;
    return { classId: state.classId, name: state.name, level: state.level, subclassId: state.subclassId, subclassName: subclass?.name, hitDie: state.hitDie };
  });
  const hitDice: Record<string, number> = {};
  for (const state of ledger.classes.values()) hitDice[`d${state.hitDie}`] = (hitDice[`d${state.hitDie}`] ?? 0) + state.level;

  // Validation from unanswered choices.
  const blocking = [...ledger.blocking];
  for (const choice of ledger.choices) if (!choice.satisfied) blocking.push(`${choice.sourceLabel}: ${choice.label} — ${choice.selected.length}/${choice.minimum ?? choice.count} 선택`);

  const species = catalog.speciesById(source.origin.speciesId);
  const background = catalog.backgroundById(source.origin.backgroundId);
  return {
    id: source.id,
    name: source.name,
    portrait: source.portrait,
    level,
    proficiencyBonus: pb,
    species: species ? { id: species.id, name: species.name } : null,
    background: background ? { id: background.id, name: background.name } : null,
    classes,
    abilities,
    hp: { max: hpMax, breakdown: hpBreakdown, terms: hpTerms },
    ac,
    speed,
    senses: { ...ledger.senses },
    size: SIZE_KO[ledger.size] ?? ledger.size,
    initiative,
    initiativeTerms,
    passivePerception,
    passivePerceptionTerms,
    saves,
    skills,
    proficiencies: { armor: armorList, weapons: weaponList, tools: [...ledger.tools.values()], languages: [...ledger.languages.values()] },
    features: ledger.features,
    feats: ledger.feats.map(({ id, name, tier, source: featSource }) => ({ id, name, tier, source: featSource })),
    spellcasting,
    spellSlots: slots,
    pactMagic: pact,
    resources: ledger.resources,
    attacks,
    defenses: {
      resistances: [...ledger.resistances].map(damageTypeKo),
      immunities: [...ledger.immunities].map(damageTypeKo),
      vulnerabilities: [],
      conditionImmunities: [...ledger.conditionImmunities].map((condition) => CONDITION_KO[condition] ?? condition),
    },
    inventory: ledger.inventory,
    // R51 (D186): what is worn, so a contract may say "while wearing medium armour" without the engine hardcoding it.
    ...(armorView?.armor
      ? { armor: { name: armorView.name, training: armorView.armor.training, dexCapped: armorView.armor.dexMax !== undefined && dex > armorView.armor.dexMax, shield: Boolean(shieldView) } }
      : { armor: { name: "방어구 없음", training: "none", dexCapped: false, shield: Boolean(shieldView) } }),
    // R62 (D197): 원소 숙련자's element. The resolver has read this since R51; nothing could fill it until a feat asked.
    ...(ledger.ignoresResistance.size ? { ignoresResistance: [...ledger.ignoresResistance] } : {}),
    ...([...ledger.flags].some((flag) => flag.startsWith("invocation:agonizing-blast:")) ? { cantripDamageModifier: [...ledger.flags].filter((flag) => flag.startsWith("invocation:agonizing-blast:")).map((flag) => flag.slice("invocation:agonizing-blast:".length)) } : {}),
    gold: ledger.gold,
    weaponMasteries: [...ledger.weaponMasteries].map((id) => catalog.itemById(id)?.name ?? id),
    // R33 (D168): the two feat rules that only bite once a swing is being rolled travel with the sheet to the table.
    featEffects: {
      ...(ledger.featEffects.rerollWeaponDamage[0] ? { rerollWeaponDamage: ledger.featEffects.rerollWeaponDamage[0] } : {}),
      ...(ledger.featEffects.lightOffHandAbilityModifier[0] ? { lightOffHandAbilityModifier: ledger.featEffects.lightOffHandAbilityModifier[0] } : {}),
    },
    hitDice,
    choices: ledger.choices,
    validation: { blocking, warnings: ledger.warnings },
    activeEffects: [],
    checkTerms: [],
  };
}

function weaponAttack(ledger: Ledger, view: ItemView, abilities: DerivedCharacter["abilities"], pb: number): DerivedAttack {
  const weapon = view.weapon!;
  const properties = weapon.properties;
  const finesse = properties.includes("finesse");
  const light = properties.includes("light");
  const monkWeapon = ledger.flags.has("martial-arts") && weapon.mode === "melee" && (weapon.training === "simple" || light) && !properties.includes("two-handed") && !properties.includes("heavy");
  let ability: AbilityKey = weapon.mode === "ranged" ? "dex" : "str";
  if (finesse || monkWeapon) ability = abilities.dex.modifier >= abilities.str.modifier ? "dex" : "str";
  const proficient = weaponIsProficient(view, ledger.weapons);
  // R33 (D168): 궁술 and its kin come from the catalog's `rangedWeaponAttackBonus`, not a constant.
  const rangedFeats = weapon.mode === "ranged" ? ledger.featEffects.rangedWeaponAttackBonus : [];
  const archery = rangedFeats.reduce((sum, bonus) => sum + bonus.value, 0);
  const attackBonus = abilities[ability].modifier + (proficient ? pb : 0) + archery;
  const attackTerms: Term[] = [{ label: `${ABILITY_KO[ability]} 수정치${finesse ? " (교묘)" : monkWeapon ? " (무예)" : ""}`, value: abilities[ability].modifier }];
  if (proficient) attackTerms.push({ label: `숙련 보너스 (${weapon.training === "simple" ? "단순" : "군용"} 무기)`, value: pb });
  for (const bonus of rangedFeats) attackTerms.push({ label: bonus.source, value: bonus.value });
  const damageTerms: Term[] = [{ label: `${ABILITY_KO[ability]} 수정치`, value: abilities[ability].modifier }];
  const versatile = properties.find((property) => property.startsWith("versatile:"))?.split(":")[1];
  const thrown = properties.find((property) => property.startsWith("thrown:"))?.split(":")[1];
  const ammunition = properties.find((property) => property.startsWith("ammunition:"))?.split(":")[1];
  const mastery = weapon.mastery ? (MASTERY_KO[weapon.mastery] ?? weapon.mastery) : undefined;
  const readable = properties.map((property) => property.split(":")[0]);
  const dieMinimum = ledger.featEffects.damageDieMinimum.filter((rule) => dieMinimumCovers(rule, readable)).reduce((best, rule) => Math.max(best, rule.minimum), 0);
  return {
    id: `attack.${view.id}`, name: view.name, itemId: view.id, ability, attackBonus, attackTerms,
    damage: versatile ? `${weapon.damage} (양손 ${versatile})` : weapon.damage, damageBonus: abilities[ability].modifier, damageTerms, damageType: damageTypeKo(weapon.damageType),
    properties: readable, mastery, masteryKey: weapon.mastery, masteryActive: ledger.weaponMasteries.has(view.id), range: ammunition ?? thrown,
    // R33 (D168): 대형 무기 전투 — the minimum and the properties it covers are the catalog's (`damageDieMinimum`,
    // `weaponPropertiesAny`); R32 had both as constants here. The highest matching minimum wins.
    ...(dieMinimum ? { dieMinimum } : {}),
    ...(proficient ? {} : { properties: [...readable, "숙련 없음"] }),
  };
}

function unarmedStrike(ledger: Ledger, abilities: DerivedCharacter["abilities"], pb: number): DerivedAttack {
  const monk = ledger.classBySlug("monk");
  let ability: AbilityKey = "str";
  let damage = "1";
  if (monk && ledger.flags.has("martial-arts")) {
    const cls = ledger.catalog.classById(monk.classId);
    const row = cls?.progression[monk.level - 1];
    damage = row?.columns[COLUMN.martialArtsDie] ?? "1d6";
    if (abilities.dex.modifier >= abilities.str.modifier) ability = "dex";
  }
  const modifier = abilities[ability].modifier;
  return {
    id: "attack.unarmed-strike", name: "비무장 공격", ability, attackBonus: modifier + pb, damage, damageBonus: modifier, damageType: "타격", properties: monk ? ["무예"] : [], masteryActive: false,
    attackTerms: [{ label: `${ABILITY_KO[ability]} 수정치${monk ? " (무예)" : ""}`, value: modifier }, { label: "숙련 보너스 (비무장 공격)", value: pb }],
    damageTerms: [{ label: `${ABILITY_KO[ability]} 수정치`, value: modifier }],
  };
}

export const abilityName = (key: AbilityKey) => ABILITY_KO[key];
