import "./creationContracts";
import type { AbilityKey, AbilityScores, CharacterCreateDraft } from "./contracts";
import {
  ALL_SKILLS,
  CREATION_SOURCE,
  FIGHTER,
  allToolProficiencyOptions,
  artisanToolOptions,
  abilityIncreaseOptions,
  backgroundAbilityBonuses,
  backgroundDefinition,
  backgroundIdFromName,
  backgroundLoadoutOptions,
  backgroundOriginFeat,
  backgroundSkills,
  backgroundTool,
  backgroundToolChoice,
  classIdFromName,
  classLoadoutOptions,
  classMeta,
  classSemantics,
  classSkillOptions,
  fightingStyleOptions,
  gamingSetOptions,
  generalLanguageOptions,
  humanOriginFeatOptions,
  instrumentOptions,
  loadoutNested,
  loadoutNestedOptions,
  monkToolOptions,
  opt,
  originFeatOptions,
  resolveLoadout,
  speciesDefinition,
  speciesSemantics,
  spellId,
  spellOptions,
  standardLanguageOptions,
  weaponMasteryOptions,
  type IndexedClassChoice,
  type Option,
} from "./characterCreationV10Data";

export type ChoiceOwner = "identity" | "species" | "background" | "class";
export type CreationChoiceSpec = {
  id: string;
  owner: ChoiceOwner;
  label: string;
  description: string;
  count: number;
  options: Option[];
  source: string;
  blocked?: boolean;
  automaticGrants?: string[];
};

const ABILITY_NAMES: Record<AbilityKey, string> = { str:"근력", dex:"민첩", con:"건강", int:"지능", wis:"지혜", cha:"매력" };
const fixedOption = (id: string, name: string, nameEn = id, summary = "SRD 선택지"): Option => opt(id, name, nameEn, summary, []);
const selected = (draft: CharacterCreateDraft, id: string) => draft.choiceSelections?.[id] ?? [];
export const choiceSelection = selected;

const speciesChoiceLabels: Record<string, string> = {
  draconicAncestry: "용족 혈통",
  keenSenses: "예리한 감각",
  lineage: "혈통",
  spellcastingAbility: "주문 시전 능력",
  giantAncestry: "거인 혈통",
  skillProficiency: "추가 기술 숙련",
  originFeat: "추가 기원 재주",
  legacy: "마족 유산",
};
const valueNames: Record<string, string> = {
  black:"흑룡", blue:"청룡", brass:"황동룡", bronze:"청동룡", copper:"구리룡", gold:"금룡", green:"녹룡", red:"적룡", silver:"은룡", white:"백룡",
  drow:"드로우", "high-elf":"하이 엘프", "wood-elf":"우드 엘프", "forest-gnome":"숲 노움", "rock-gnome":"바위 노움",
  cloud:"구름", fire:"불", frost:"서리", hill:"언덕", stone:"바위", storm:"폭풍",
  abyssal:"심연", chthonic:"저승", infernal:"지옥",
  small:"소형", medium:"중형",
};

function genericValueOptions(values: unknown): Option[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    const id = String(value);
    if (["str","dex","con","int","wis","cha"].includes(id)) return fixedOption(id, ABILITY_NAMES[id as AbilityKey], id.toUpperCase(), "주문 시전 능력");
    if (ALL_SKILLS.includes(String(value))) return fixedOption(`skill.${id}`, String(value), id, "기술 숙련");
    const skillName = classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name;
    if (skillName) return fixedOption(`skill.${id}`, skillName, id, "기술 숙련");
    return fixedOption(id, valueNames[id] ?? id, id, "SRD 종족 선택");
  });
}

function speciesSpecs(draft: CharacterCreateDraft): CreationChoiceSpec[] {
  if (!draft.species) return [];
  const def = speciesDefinition(draft.species);
  const out: CreationChoiceSpec[] = [];
  if ((def.size?.length ?? 0) > 1) out.push({ id:"species.size", owner:"species", label:"크기", description:"캐릭터의 크기를 선택합니다.", count:1, options:(def.size ?? []).map((value) => fixedOption(value, valueNames[value] ?? value, value, "종족 크기")), source:CREATION_SOURCE });
  for (const [key, values] of Object.entries(def.choices ?? {})) {
    let options: Option[] = [];
    if (key === "skillProficiency" && values === "any") {
      const used = new Set([...draft.selectedSkills, ...backgroundSkills(draft.background).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name ?? id)]);
      options = classSkillOptions("dnd.srd521.class.bard").filter((item) => !used.has(item.name));
    }
    else if (key === "originFeat" && values === "any-origin-feat") options = humanOriginFeatOptions(draft.background);
    else options = genericValueOptions(values);
    if (key === "keenSenses") {
      const used = new Set([
        ...draft.selectedSkills,
        ...backgroundSkills(draft.background).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name ?? id),
      ]);
      options = options.filter((item) => !used.has(item.name));
    }
    out.push({ id:`species.${key}`, owner:"species", label:speciesChoiceLabels[key] ?? key, description:`${draft.species}의 ${speciesChoiceLabels[key] ?? key} 선택입니다.`, count:1, options, source:CREATION_SOURCE });
  }
  for (const extra of speciesSemantics(draft.species).extraChoices ?? []) {
    out.push({ id:extra.id, owner:"species", label:extra.label, description:extra.description, count:extra.count, options:extra.options.map((item) => fixedOption(item.id, item.name, item.nameEn, item.summary)), source:CREATION_SOURCE });
  }
  const humanFeat = selected(draft, "species.originFeat")[0];
  if (humanFeat === "dnd.srd521.feat.magic-initiate") out.push(...magicInitiateSpecs(draft, "species.magic-initiate", "species", undefined));
  if (humanFeat === "dnd.srd521.feat.skilled") {
    const knownSkills = new Set([
      ...draft.selectedSkills,
      ...backgroundSkills(draft.background).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name ?? id),
      ...selected(draft, "species.skillProficiency").map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === id)?.name ?? id),
    ]);
    const skillOptions = classSkillOptions("dnd.srd521.class.bard").filter((item) => !knownSkills.has(item.name));
    const knownToolIds = new Set<string>();
    const fixedTool = backgroundTool(draft.background);
    if (fixedTool) knownToolIds.add(`dnd.srd521.item.tool.${fixedTool === "calligrapher-supplies" ? "calligraphers-supplies" : fixedTool}`);
    const toolOptions = allToolProficiencyOptions.filter((item) => !knownToolIds.has(item.id));
    out.push({ id:"species.skilled.proficiencies", owner:"species", label:"숙련됨 · 숙련 3개", description:"아직 숙련되지 않은 기술과 도구를 원하는 조합으로 세 개 선택합니다.", count:3, options:[...skillOptions, ...toolOptions], source:"SRD 5.2.1 · Skilled" });
  }
  return out;
}

function backgroundFixedMagicList(backgroundName: string): "cleric" | "wizard" | undefined {
  const id = backgroundOriginFeat(backgroundName);
  if (id === "dnd.srd521.feat.magic-initiate-cleric") return "cleric";
  if (id === "dnd.srd521.feat.magic-initiate-wizard") return "wizard";
  return undefined;
}
function classIdForSpellList(value: string) { return `dnd.srd521.class.${value}`; }
function magicInitiateSpecs(draft: CharacterCreateDraft, prefix: string, owner: ChoiceOwner, fixedList?: "cleric" | "druid" | "wizard"): CreationChoiceSpec[] {
  const out: CreationChoiceSpec[] = [];
  let list = fixedList;
  if (!fixedList) {
    const banned = backgroundFixedMagicList(draft.background);
    const options = ["cleric","druid","wizard"].filter((value) => value !== banned).map((value) => fixedOption(value, value === "cleric" ? "클레릭" : value === "druid" ? "드루이드" : "위저드", value, "마법 입문자 주문 목록"));
    out.push({ id:`${prefix}.spell-list`, owner, label:"마법 입문자 · 주문 목록", description:"이 재주에 사용할 주문 목록을 선택합니다. 같은 재주를 반복해서 얻었다면 이전 목록과 달라야 합니다.", count:1, options, source:"SRD 5.2.1 · Magic Initiate" });
    list = selected(draft, `${prefix}.spell-list`)[0] as typeof list;
  }
  if (!list) return out;
  const classId = classIdForSpellList(list);
  out.push({ id:`${prefix}.cantrips`, owner, label:"마법 입문자 · 소마법", description:"선택한 주문 목록에서 소마법 두 개를 고릅니다.", count:2, options:spellOptions(classId, 0), source:"SRD 5.2.1 · Magic Initiate" });
  out.push({ id:`${prefix}.level1`, owner, label:"마법 입문자 · 1레벨 주문", description:"선택한 주문 목록에서 1레벨 주문 하나를 고릅니다.", count:1, options:spellOptions(classId, 1), source:"SRD 5.2.1 · Magic Initiate" });
  out.push({ id:`${prefix}.ability`, owner, label:"마법 입문자 · 주문 능력", description:"지능, 지혜 또는 매력 중 주문 시전 능력을 선택합니다.", count:1, options:(["int","wis","cha"] as AbilityKey[]).map((key) => fixedOption(key, ABILITY_NAMES[key], key.toUpperCase(), "주문 시전 능력")), source:"SRD 5.2.1 · Magic Initiate" });
  return out;
}

function backgroundSpecs(draft: CharacterCreateDraft): CreationChoiceSpec[] {
  if (!draft.background) return [];
  const def = backgroundDefinition(draft.background);
  const out: CreationChoiceSpec[] = [];
  out.push({ id:"background.ability", owner:"background", label:"능력치 증가", description:"배경이 허용하는 세 능력치에 +2/+1 또는 +1/+1/+1을 배분합니다.", count:1, options:abilityIncreaseOptions(draft.background), source:CREATION_SOURCE });
  if (def.toolChoice === "gaming-set") out.push({ id:"background.gaming-set", owner:"background", label:"게임 도구", description:"군인 배경의 게임 도구 종류를 선택합니다.", count:1, options:gamingSetOptions, source:CREATION_SOURCE });
  const loadouts = backgroundLoadoutOptions(draft.background);
  if (loadouts.length) out.push({ id:"background.equipment", owner:"background", label:"배경 시작 장비", description:"배경 장비 세트 또는 시작 금화를 선택합니다.", count:1, options:loadouts, source:CREATION_SOURCE });
  const preset = selected(draft, "background.equipment")[0];
  if (preset) loadoutNested(preset).forEach((choice, index) => out.push({ id:`background.loadout.${index}`, owner:"background", label:`배경 장비 추가 선택 ${index + 1}`, description:"선택한 배경 장비 세트가 요구하는 추가 항목입니다.", count:choice.quantity ?? 1, options:loadoutNestedOptions(choice), source:CREATION_SOURCE }));
  const fixedList = backgroundFixedMagicList(draft.background);
  if (fixedList) out.push(...magicInitiateSpecs(draft, "background.magic-initiate", "background", fixedList));
  return out;
}

function classPrimitiveOptions(draft: CharacterCreateDraft, row: IndexedClassChoice): Option[] {
  if (row.kind === "fighting-style") return fightingStyleOptions;
  if (row.kind === "weapon-mastery") return weaponMasteryOptions(row.weaponFilter ?? "all-simple-or-martial");
  if (row.kind === "instrument-proficiency") return instrumentOptions;
  if (row.kind === "artisan-or-instrument") return monkToolOptions;
  if (row.kind === "selected-skill-expertise") return finalSkillNames(draft).map((name) => fixedOption(`expertise.${name}`, name, name, "전문화할 숙련 기술"));
  if (row.kind === "language") {
    const known = new Set(selected(draft, "identity.languages").map((id) => id.replace(/^language\./, "")));
    return generalLanguageOptions.filter((item) => !known.has(item.id.replace(/^language\./, "")));
  }
  if (row.kind === "fixed-options") return (row.options ?? []).map((item) => opt(item.id, item.name, item.nameEn, item.summary, []));
  return [];
}

function classSpecs(draft: CharacterCreateDraft): CreationChoiceSpec[] {
  if (!draft.className) return [];
  const classId = classIdFromName(draft.className);
  const semantic = classSemantics(classId);
  const out: CreationChoiceSpec[] = semantic.choices.map((row) => ({ id:row.id, owner:"class", label:row.label, description:row.description, count:row.count, options:classPrimitiveOptions(draft, row), source:CREATION_SOURCE, blocked:row.kind === "selected-skill-expertise" && draft.selectedSkills.length < row.count }));
  const classLoadouts = classLoadoutOptions(classId);
  if (draft.equipmentPreset && classLoadouts.some((item) => item.id === draft.equipmentPreset)) loadoutNested(draft.equipmentPreset).forEach((choice, index) => out.push({ id:`class.loadout.${index}`, owner:"class", label:`클래스 장비 추가 선택 ${index + 1}`, description:"선택한 클래스 장비 세트가 요구하는 추가 항목입니다.", count:choice.quantity ?? 1, options:loadoutNestedOptions(choice), source:CREATION_SOURCE }));
  const spells = semantic.spells;
  if (spells?.cantrips) {
    let count = spells.cantrips;
    const bonus = spells.bonusCantripChoice;
    if (bonus && selected(draft, bonus.choiceId).includes(bonus.value)) count += 1;
    out.push({ id:"class.spells.cantrips", owner:"class", label:"소마법", description:`${draft.className} 1레벨 소마법 ${count}개를 선택합니다.`, count, options:spellOptions(classId, 0), source:"SRD 5.2.1 · class spell list" });
  }
  if (spells?.spellbook) out.push({ id:"class.spells.spellbook", owner:"class", label:"주문서", description:`1레벨 위저드 주문 ${spells.spellbook}개를 주문서에 기록합니다.`, count:spells.spellbook, options:spellOptions(classId, 1), source:"SRD 5.2.1 · Wizard Spellbook" });
  if (spells?.preparedFromSpellbook) {
    const book = new Set(selected(draft, "class.spells.spellbook"));
    const options = spellOptions(classId, 1).filter((item) => book.has(item.id));
    out.push({ id:"class.spells.prepared", owner:"class", label:"준비 주문", description:`주문서에서 ${spells.preparedFromSpellbook}개를 준비합니다.`, count:spells.preparedFromSpellbook, options, source:"SRD 5.2.1 · Wizard prepared spells", blocked:book.size < (spells.spellbook ?? 0) });
  } else if (spells?.prepared) out.push({ id:"class.spells.prepared", owner:"class", label:"준비 주문", description:`${draft.className} 1레벨 주문 ${spells.prepared}개를 선택합니다.`, count:spells.prepared, options:spellOptions(classId, 1), source:"SRD 5.2.1 · class spell list", automaticGrants:spells.alwaysPrepared?.map((name) => `항상 준비 · ${name}`) });
  return out;
}

export function creationChoiceSpecs(draft: CharacterCreateDraft): CreationChoiceSpec[] {
  const identity: CreationChoiceSpec = { id:"identity.languages", owner:"identity", label:"언어", description:"공용어에 더해 표준 언어 두 개를 선택합니다.", count:2, options:standardLanguageOptions, source:"SRD 5.2.1 · Create Your Character" };
  return [identity, ...speciesSpecs(draft), ...backgroundSpecs(draft), ...classSpecs(draft)];
}

export function normalizeChoiceSelections(draft: CharacterCreateDraft) {
  draft.choiceSelections ??= {};
  let specs = creationChoiceSpecs(draft);
  const active = new Set(specs.map((spec) => spec.id));
  for (const key of Object.keys(draft.choiceSelections)) if (!active.has(key)) delete draft.choiceSelections[key];
  for (const spec of specs) {
    const allowed = new Set(spec.options.map((item) => item.id));
    draft.choiceSelections[spec.id] = (draft.choiceSelections[spec.id] ?? []).filter((id) => allowed.has(id)).slice(0, spec.count);
  }
  specs = creationChoiceSpecs(draft);
  const active2 = new Set(specs.map((spec) => spec.id));
  for (const key of Object.keys(draft.choiceSelections)) if (!active2.has(key)) delete draft.choiceSelections[key];
  for (const spec of specs) {
    const allowed = new Set(spec.options.map((item) => item.id));
    draft.choiceSelections[spec.id] = (draft.choiceSelections[spec.id] ?? []).filter((id) => allowed.has(id)).slice(0, spec.count);
  }
  return draft;
}

export function toggleChoiceSelection(draft: CharacterCreateDraft, choiceId: string, optionId: string) {
  normalizeChoiceSelections(draft);
  const spec = creationChoiceSpecs(draft).find((item) => item.id === choiceId);
  if (!spec || spec.blocked || !spec.options.some((item) => item.id === optionId)) return draft;
  const values = draft.choiceSelections?.[choiceId] ?? [];
  if (values.includes(optionId)) draft.choiceSelections![choiceId] = values.filter((id) => id !== optionId);
  else if (spec.count === 1) draft.choiceSelections![choiceId] = [optionId];
  else if (values.length < spec.count) draft.choiceSelections![choiceId] = [...values, optionId];
  normalizeChoiceSelections(draft);
  return draft;
}

export function finalAbilities(draft: CharacterCreateDraft): AbilityScores {
  const bonus = backgroundAbilityBonuses(selected(draft, "background.ability")[0]);
  return Object.fromEntries((Object.keys(draft.abilities) as AbilityKey[]).map((key) => [key, Math.min(20, draft.abilities[key] + (bonus[key] ?? 0))])) as AbilityScores;
}

export function finalLanguageNames(draft: CharacterCreateDraft) {
  const ids = [...selected(draft, "identity.languages"), ...selected(draft, "class.extra-language")];
  const options = [...standardLanguageOptions, ...generalLanguageOptions];
  return ["공용어", ...ids.map((id) => options.find((item) => item.id === id)?.name ?? id)].filter((value, index, all) => all.indexOf(value) === index);
}
export function finalToolProficiencies(draft: CharacterCreateDraft) {
  const result: string[] = [];
  const def = backgroundDefinition(draft.background);
  if (def.tool) { const normalized = def.tool === "calligrapher-supplies" ? "calligraphers-supplies" : def.tool; result.push(allToolProficiencyOptions.find((item) => item.id.endsWith(normalized))?.name ?? def.tool); }
  result.push(...selected(draft, "background.gaming-set").map((id) => gamingSetOptions.find((item) => item.id === id)?.name ?? id));
  result.push(...selected(draft, "class.instrument-proficiencies").map((id) => instrumentOptions.find((item) => item.id === id)?.name ?? id));
  result.push(...selected(draft, "class.monk-tool").map((id) => [...artisanToolOptions, ...instrumentOptions].find((item) => item.id === id)?.name ?? id));
  const skilled = selected(draft, "species.skilled.proficiencies").filter((id) => !id.startsWith("skill."));
  result.push(...skilled.map((id) => allToolProficiencyOptions.find((item) => item.id === id)?.name ?? id));
  return result.filter((value, index, all) => all.indexOf(value) === index);
}
export function nonClassSkillNames(draft: CharacterCreateDraft) {
  const fromBackground = backgroundSkills(draft.background).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name ?? id);
  const fromSpecies = selected(draft, "species.skillProficiency").map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === id)?.name ?? id);
  const fromSkilled = selected(draft, "species.skilled.proficiencies").filter((id) => id.startsWith("skill.")).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === id)?.name ?? id);
  return [...fromBackground, ...fromSpecies, ...fromSkilled].filter((value, index, all) => all.indexOf(value) === index);
}
export function finalSkillNames(draft: CharacterCreateDraft) {
  const fromBackground = backgroundSkills(draft.background).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === `skill.${id}`)?.name ?? id);
  const fromSpecies = selected(draft, "species.skillProficiency").map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === id)?.name ?? id);
  const fromSkilled = selected(draft, "species.skilled.proficiencies").filter((id) => id.startsWith("skill.")).map((id) => classSkillOptions("dnd.srd521.class.bard").find((item) => item.id === id)?.name ?? id);
  return [...draft.selectedSkills, ...fromBackground, ...fromSpecies, ...fromSkilled].filter((value, index, all) => all.indexOf(value) === index);
}
export function finalMasteryWeapons(draft: CharacterCreateDraft) {
  return selected(draft, "class.weapon-mastery").map((id) => weaponMasteryOptions("all-simple-or-martial").find((item) => item.id === id)?.name ?? id);
}
export function speciesAutomaticEffects(draft: CharacterCreateDraft) {
  const semantics = speciesSemantics(draft.species);
  const cantrips = [...(semantics.baseCantrips ?? [])];
  const prepared = [...(semantics.basePrepared ?? [])];
  const features = [...(semantics.baseFeatures ?? [])];
  let speed: number | undefined;
  for (const [choiceId, effects] of Object.entries(semantics.byChoice ?? {})) {
    for (const value of selected(draft, choiceId)) {
      const effect = effects[value];
      if (!effect) continue;
      cantrips.push(...(effect.cantrips ?? []));
      prepared.push(...(effect.prepared ?? []));
      features.push(...(effect.features ?? []));
      if (effect.speed !== undefined) speed = effect.speed;
    }
  }
  return { cantrips, prepared, features, speed };
}
export function finalCantrips(draft: CharacterCreateDraft) {
  const species = speciesAutomaticEffects(draft).cantrips.map(spellId);
  return [...selected(draft, "class.spells.cantrips"), ...selected(draft, "background.magic-initiate.cantrips"), ...selected(draft, "species.magic-initiate.cantrips"), ...species].filter((value,index,all) => all.indexOf(value) === index);
}
export function finalPreparedSpells(draft: CharacterCreateDraft) {
  const classId = classIdFromName(draft.className);
  const always = classMeta(classId).semantics.spells?.alwaysPrepared ?? [];
  const species = speciesAutomaticEffects(draft).prepared;
  return [...selected(draft, "class.spells.prepared"), ...always.map((name) => `always:${spellId(name)}`), ...species.map((name) => `always:${spellId(name)}`), ...selected(draft, "background.magic-initiate.level1"), ...selected(draft, "species.magic-initiate.level1")].filter((value,index,all) => all.indexOf(value) === index);
}
export function finalSpellbook(draft: CharacterCreateDraft) { return selected(draft, "class.spells.spellbook"); }

export function classAndBackgroundLoadout(draft: CharacterCreateDraft) {
  const selections = draft.choiceSelections ?? {};
  const classResult = resolveLoadout(draft.equipmentPreset, selections, "class.loadout");
  const backgroundPreset = selected(draft, "background.equipment")[0] ?? "";
  const backgroundResult = resolveLoadout(backgroundPreset, selections, "background.loadout");
  return { items:[...classResult.items, ...backgroundResult.items], gp:classResult.gp + backgroundResult.gp };
}

export function activeOriginFeats(draft: CharacterCreateDraft) {
  const fixed = backgroundOriginFeat(draft.background);
  const human = selected(draft, "species.originFeat")[0];
  return [fixed, human].filter((value): value is string => Boolean(value));
}

export function selectedChoiceLabels(draft: CharacterCreateDraft) {
  const specs = creationChoiceSpecs(draft);
  return Object.fromEntries(specs.map((spec) => [spec.id, (draft.choiceSelections?.[spec.id] ?? []).map((id) => spec.options.find((item) => item.id === id)?.name ?? id)]));
}
