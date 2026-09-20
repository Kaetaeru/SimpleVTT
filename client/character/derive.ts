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
import { featureRuleKey, qualifyRuleKey } from "../rules/activation";
import { characterScope, entryOpen } from "../rules/contract";
import { contractDurations, contractSummary, featureContract, longRestGains } from "../rules/contractActivation";
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
  // V3d (D258): a feature whose contract names several uses (몽크의 기: 질풍 연타, 인내의 방어, 바람의 걸음) gets a line per use.
  for (let index = derived.features.length - 1; index >= 0; index -= 1) {
    const feature = derived.features[index];
    const key = featureRuleKey(feature.id);
    const all = catalog.contractUses(qualifyRuleKey(key)).length ? catalog.contractUses(qualifyRuleKey(key)) : catalog.contractUses(key);
    if (!all.length) continue;
    // D308: a use gated on something this character is not (another ancestry's breath) is not theirs.
    const uses = all.filter((use) => entryOpen(use, characterScope(derived)));
    derived.features.splice(index + 1, 0, ...uses.map((use) => ({ ...feature, id: `${feature.id}#${use.id}`, name: use.label, nameEn: `${feature.nameEn} (${use.id})`, rules: undefined, execution: undefined })));
  }
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
    // H4 (D243): the feature a class definition names as its spellcasting is the sheet's spell section, worked out.
    else if (derived.classes.some((state) => catalog.classById(state.classId)?.rules.spellcastingFeature === key)) { feature.rules = [...(feature.rules ?? []), "주문 시전: 슬롯·소마법·준비 주문을 주문 칸에서 자동 계산"]; feature.execution = "derived"; }
  }
  derived.featureContracts = featureContracts;
  // V4m (D275): a contract that names the end of a long rest — the rest applies it, nothing is pressed.
  derived.longRestGains = longRestGains(derived, catalog, characterScope(derived));
  // R52 (D187): what this sheet may declare in the attack dialog, worked out once and carried with it.
  derived.attackRiders = characterRiders(derived, catalog);
  // R59 (D194): official actions a contract said may be taken as a bonus action instead.
  derived.bonusActions = contractBonusActions({ features: [...derived.features, ...(options.effects ?? []).map((effect) => ({ id: effect.key, name: effect.name }))] }, catalog, characterScope(derived));
  // R43 (D183): passives first (they are always on), then whatever is running right now.
  const passive = applyPassiveContracts(derived, catalog, (options.effects ?? []).map((effect) => effect.name));
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
  // H3c (D241): hit points per level of a class, from the feature that grants them (용의 회복력).
  for (const grant of ledger.hpPerClassLevel) {
    const owner = [...ledger.classes.values()].find((state) => state.classId === grant.classId);
    const extra = (owner?.level ?? 0) * grant.amount;
    if (extra) { hpMax += extra; hpBreakdown.push(`${grant.label} +${extra}`); hpTerms.push({ label: grant.label, value: extra }); }
  }

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
    // H3c (D241): the unarmoured AC formulas features granted.
    for (const formula of ledger.acFormulas) {
      if (!formula.shield && shieldView) continue;
      const terms: Term[] = [{ label: "기본", value: 10 }, ...formula.abilities.map((key) => ({ label: `${ABILITY_KO[key]} 수정치 (${formula.label})`, value: mod(key) })), ...(formula.shield && shieldBonus ? [{ label: shieldView?.name ?? "방패", value: shieldBonus }] : [])];
      acCandidates.push({ value: terms.reduce((total, term) => total + term.value, 0), source: formula.label, breakdown: terms.map((term) => `${term.label} ${term.value}`), terms });
    }
  }
  const ac = acCandidates.reduce((best, candidate) => (candidate.value > best.value ? candidate : best));

  // Speed and senses.
  const speedTerms: Term[] = [{ label: `종족 기본 (${catalog.speciesById(source.origin.speciesId)?.name ?? "종족"})`, value: ledger.speedBase }];
  if (ledger.speedBonus) speedTerms.push({ label: "추가 속도", value: ledger.speedBonus });
  let walk = ledger.speedBase + ledger.speedBonus;
  // H3c (D241): speed the features grant (빠른 이동, 비무장 이동, 방랑자), and the movement modes that follow walking.
  const speedModes: string[] = [];
  for (const grant of ledger.speedGrants) {
    if (grant.unless === "heavy-armor" && heavyArmorWorn) continue;
    if (grant.unless === "armor-or-shield" && (armorView || shieldView)) continue;
    const owner = [...ledger.classes.values()].find((state) => state.classId === grant.classId);
    const row = owner && grant.column ? catalog.classById(owner.classId)?.progression[owner.level - 1] : undefined;
    const bonus = grant.column ? numericColumn(row?.columns[grant.column]) : grant.amount;
    if (!bonus) continue;
    walk += bonus;
    speedTerms.push({ label: grant.label, value: bonus });
    speedModes.push(...grant.modes);
  }
  if (strengthShort) { walk -= 10; speedTerms.push({ label: `${armorView?.name} 근력 요구치 미달`, value: -10 }); }
  const speed: DerivedCharacter["speed"] = { walk, terms: speedTerms };
  for (const mode of speedModes) if (mode === "climb" || mode === "swim" || mode === "fly") speed[mode] = walk;
  if (ledger.extraSpeeds.swim !== undefined) speed.swim = ledger.extraSpeeds.swim < 0 ? walk : ledger.extraSpeeds.swim;
  if (ledger.extraSpeeds.climb !== undefined) speed.climb = ledger.extraSpeeds.climb < 0 ? walk : ledger.extraSpeeds.climb;
  if (ledger.extraSpeeds.fly !== undefined) speed.fly = ledger.extraSpeeds.fly < 0 ? walk : ledger.extraSpeeds.fly;

  // Saves and skills.
  const saves = {} as DerivedCharacter["saves"];
  for (const key of ABILITY_KEYS) {
    const proficient = ledger.saves.has(key);
    const terms: Term[] = [{ label: `${ABILITY_KO[key]} 수정치`, value: mod(key) }];
    if (proficient) terms.push({ label: `숙련 보너스 (${ledger.saves.get(key)})`, value: pb });
    saves[key] = { proficient, bonus: terms.reduce((total, term) => total + term.value, 0), terms };
  }
  const jack = ledger.halfProficiency ? Math.floor(pb / 2) : 0;
  const skills: DerivedSkill[] = Object.entries(catalog.skills).map(([id, name]) => {
    const ability = SKILL_ABILITY[id] ?? "int";
    const proficient = ledger.hasSkill(id);
    const expertise = proficient && ledger.hasExpertise(id);
    // R97 (D232): 기적술사·마법사 add Wisdom (minimum +1) to these knowledge checks.
    const abilityBonuses = ledger.skillAbilityBonuses.filter((item) => item.skill === id).map((item) => ({ label: item.label, value: Math.max(item.min, mod(item.ability)) }));
    const wisBonus = abilityBonuses.reduce((total, item) => total + item.value, 0);
    const bonus = mod(ability) + (expertise ? pb * 2 : proficient ? pb : jack) + wisBonus;
    const record = ledger.skills.get(id);
    const terms: Term[] = [{ label: `${ABILITY_KO[ability]} 수정치`, value: mod(ability) }];
    if (expertise) terms.push({ label: `전문화 ×2 (${record?.expertise[0] ?? ""})`, value: pb * 2 });
    else if (proficient) terms.push({ label: `숙련 보너스 (${record?.proficient[0] ?? ""})`, value: pb });
    else if (jack) terms.push({ label: `${ledger.halfProficiency} (숙련 보너스 절반)`, value: jack });
    for (const item of abilityBonuses) terms.push({ label: `${item.label} (능력 수정치)`, value: item.value });
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
      cantrips, prepared: [...entry.prepared], alwaysPrepared: [...entry.alwaysPrepared], spellbook: entry.spellbook ? [...entry.spellbook] : undefined, ...(entry.ritualFromSpellbook ? { ritualFromSpellbook: true } : {}),
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
  const monkWeapon = Boolean(ledger.martialArts) && weapon.mode === "melee" && (weapon.training === "simple" || light) && !properties.includes("two-handed") && !properties.includes("heavy");
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
  const arts = ledger.martialArts;
  const monk = arts ? [...ledger.classes.values()].find((state) => state.classId === arts.classId) : undefined;
  let ability: AbilityKey = "str";
  let damage = "1";
  if (monk && arts) {
    const row = ledger.catalog.classById(monk.classId)?.progression[monk.level - 1];
    damage = row?.columns[arts.column] ?? "1d6";
    if (abilities[arts.ability].modifier >= abilities.str.modifier) ability = arts.ability;
  }
  const modifier = abilities[ability].modifier;
  return {
    id: "attack.unarmed-strike", name: "비무장 공격", ability, attackBonus: modifier + pb, damage, damageBonus: modifier, damageType: "타격", properties: monk ? ["무예"] : [], masteryActive: false,
    attackTerms: [{ label: `${ABILITY_KO[ability]} 수정치${monk ? " (무예)" : ""}`, value: modifier }, { label: "숙련 보너스 (비무장 공격)", value: pb }],
    damageTerms: [{ label: `${ABILITY_KO[ability]} 수정치`, value: modifier }],
  };
}

export const abilityName = (key: AbilityKey) => ABILITY_KO[key];
