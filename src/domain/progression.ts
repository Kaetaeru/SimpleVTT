import {
  type AbilityChoiceKey,
  type ChoiceDefinition,
  type ChoiceSelectionMap,
  validateChoiceDefinitions,
} from "./choiceDefinition";
import {
  CLERIC_ID,
  clericFeatureChoiceDefinitions,
  isClericPersistentFeatureChoice,
} from "./clericProgressionChoices";
import {
  DRUID_ID,
  druidFeatureChoiceDefinitions,
  isDruidElementalFuryFeature,
  isDruidPersistentFeatureChoice,
} from "./druidProgressionChoices";
import { expertiseChoiceRelationship, seasonedExplorerRelationship } from "./progressionChoiceCatalog";
import {
  PROGRESSION_CATALOG,
  classById,
  fixedHpGain,
  multiclassEligibility,
  multiclassSpellSlots,
  numericProgressionColumn,
  proficiencyBonusForTotalLevel,
  progressionRow,
  type AbilityKey,
} from "./progressionCatalog";
import { automaticPreparedSpellsForLevel, classCantripListEntries, classSpellListEntries } from "./spellListCatalog";

export interface ProgressionClassTrack {
  classId: string;
  className: string;
  level: number;
  subclassName?: string;
}

export interface ProgressionCharacterState {
  revision: number;
  id: string;
  name: string;
  totalLevel: number;
  abilities: Record<AbilityKey, number>;
  hpCurrent: number;
  hpMaximum: number;
  proficiencyBonus: number;
  classTracks: ProgressionClassTrack[];
  hitDiceByDie: Record<string, number>;
  features: string[];
  proficientSkills?: string[];
  expertiseSkills?: string[];
  expertiseSources?: Record<string, string>;
  languages?: string[];
  languageSources?: Record<string, string>;
  cantripIds?: string[];
  cantripSources?: Record<string, string>;
  preparedSpellIds?: string[];
  preparedSpellSources?: Record<string, string>;
  spellSlotMaximums?: Record<number, number>;
}

export interface ProgressionRequest {
  expectedRevision: number;
  targetClassId: string;
  hpMethod: "fixed" | "roll";
  hpRoll?: number;
  selections: ChoiceSelectionMap;
  featOptions?: Array<{ id: string; label: string; description?: string }>;
  fightingStyleOptions?: Array<{ id: string; label: string; description?: string }>;
  druidCantripOptions?: Array<{ id: string; label: string; description?: string }>;
  clericCantripOptions?: Array<{ id: string; label: string; description?: string }>;
  languageOptions?: Array<{ id: string; label: string; description?: string }>;
  spellOptions?: Array<{ id: string; label: string; description?: string; level: number }>;
}

export interface ProgressionDiff {
  label: string;
  before: string;
  after: string;
  source: string;
}

export interface ProgressionPlan {
  targetClassId: string;
  targetClassName: string;
  targetClassLevel: number;
  fromTotalLevel: number;
  toTotalLevel: number;
  isMulticlass: boolean;
  eligible: boolean;
  eligibilityReason?: string;
  automaticGrants: string[];
  multiclassGrants: string[];
  choices: ChoiceDefinition[];
  blocking: string[];
  warnings: string[];
  hp: { hitDie: number; method: "fixed" | "roll"; baseGain: number; constitutionModifier: number; gainBeforeConRetroactive: number; retroactiveConstitutionGain: number; totalGain: number };
  proficiencyBefore: number;
  proficiencyAfter: number;
  classTracksBefore: ProgressionClassTrack[];
  classTracksAfter: ProgressionClassTrack[];
  hitDiceBefore: Record<string, number>;
  hitDiceAfter: Record<string, number>;
  spellcastingBefore: { casterLevel: number; slots: Record<number, number> };
  spellcastingAfter: { casterLevel: number; slots: Record<number, number> };
  diffs: ProgressionDiff[];
}

export type ProgressionResolution =
  | { status: "committed"; state: ProgressionCharacterState; plan: ProgressionPlan }
  | { status: "rejected"; state: ProgressionCharacterState; plan: ProgressionPlan; error: string };

const ABILITY_LABELS: Record<AbilityChoiceKey, string> = { str:"근력", dex:"민첩", con:"건강", int:"지능", wis:"지혜", cha:"매력" };
const CHOICE_FEATURE_NAMES = new Set([
  "전문화", "전투 방식", "신성한 역할", "원초적 역할", "원초적 지식", "노련한 탐험가",
  "메타매직", "섬뜩한 기원술", "마법의 비밀", "학자", "주문 숙련", "대표 주문",
]);
const RANGER_ID = "dnd.srd521.class.ranger";
const PALADIN_ID = "dnd.srd521.class.paladin";
const RANGER_DRUIDIC_WARRIOR = "feature:ranger.druidic-warrior";
const PALADIN_BLESSED_WARRIOR = "feature:paladin.blessed-warrior";

function modifier(score: number) { return Math.floor((score - 10) / 2); }
function clone<T>(value: T): T { return structuredClone(value); }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }
function normalizedSpellId(id: string) { return id.replace(/^always:/, ""); }
function isCantripChoiceId(id: string) { return id.endsWith(".column.소마법") || id.endsWith(".cantrip") || id.endsWith(".cantrips"); }

function expertiseChoice(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  count: number,
  idSuffix = "expertise",
  label = "전문화",
): ChoiceDefinition {
  const definition = classById(targetClassId)!;
  const alreadyExpert = new Set(state.expertiseSkills ?? []);
  const proficientSkills = unique(state.proficientSkills ?? []);
  return {
    id:`progression.${targetClassId}.${targetLevel}.${idSuffix}`,
    label,
    description:`이미 숙련된 기술 중 전문화가 없는 기술 ${count}개를 선택합니다.`,
    kind:"expertise",
    count,
    required:true,
    status:"ready",
    source:`${definition.nameKo} ${targetLevel}레벨 · SRD 5.2.1`,
    options:proficientSkills.map((skill) => ({
      id:`skill:${skill}`,
      label:skill,
      description:alreadyExpert.has(skill) ? "이미 전문화를 보유한 기술" : "숙련된 기술",
      disabledReason:alreadyExpert.has(skill) ? "이미 전문화를 보유하고 있습니다." : undefined,
    })),
  };
}

function expertiseChoiceDefinition(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
): ChoiceDefinition | undefined {
  const relationship = expertiseChoiceRelationship(targetClassId, targetLevel);
  if (!relationship) return undefined;
  return expertiseChoice(state, targetClassId, targetLevel, relationship.count);
}

function languageChoice(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  count: number,
  languageOptions: ProgressionRequest["languageOptions"],
): ChoiceDefinition {
  const definition = classById(targetClassId)!;
  const known = new Set(state.languages ?? []);
  return {
    id:`progression.${targetClassId}.${targetLevel}.seasoned-explorer.languages`,
    label:"노련한 탐험가 · 언어",
    description:`아직 알지 못하는 언어 ${count}개를 선택합니다.`,
    kind:"language",
    count,
    required:true,
    status:"ready",
    source:`${definition.nameKo} ${targetLevel}레벨 · SRD 5.2.1`,
    options:(languageOptions ?? []).map((option) => ({
      ...option,
      disabledReason:known.has(option.label) ? "이미 알고 있는 언어입니다." : undefined,
    })),
  };
}

type FightingStyleAlternative = {
  optionId: string;
  label: string;
  description: string;
  childSuffix: string;
  childLabel: string;
  childDescription: string;
  cantripOptions: ProgressionRequest["druidCantripOptions"];
};

function fightingStyleAlternative(targetClassId: string, request: ProgressionRequest): FightingStyleAlternative | undefined {
  if (targetClassId === RANGER_ID && request.druidCantripOptions?.length) {
    return {
      optionId:RANGER_DRUIDIC_WARRIOR,
      label:"드루이드 전사",
      description:"드루이드 주문 목록에서 소마법 두 개를 배웁니다. 이 주문은 레인저 주문으로 취급합니다.",
      childSuffix:"druidic-warrior.cantrips",
      childLabel:"드루이드 전사 · 소마법",
      childDescription:"드루이드 주문 목록에서 아직 알지 못하는 소마법 두 개를 선택합니다.",
      cantripOptions:request.druidCantripOptions,
    };
  }
  if (targetClassId === PALADIN_ID && request.clericCantripOptions?.length) {
    return {
      optionId:PALADIN_BLESSED_WARRIOR,
      label:"축복받은 전사",
      description:"클레릭 주문 목록에서 소마법 두 개를 배웁니다. 이 주문은 팔라딘 주문으로 취급합니다.",
      childSuffix:"blessed-warrior.cantrips",
      childLabel:"축복받은 전사 · 소마법",
      childDescription:"클레릭 주문 목록에서 아직 알지 못하는 소마법 두 개를 선택합니다.",
      cantripOptions:request.clericCantripOptions,
    };
  }
  return undefined;
}

function classFightingStyleChoices(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  request: ProgressionRequest,
): ChoiceDefinition[] | undefined {
  if (targetLevel !== 2 || !request.fightingStyleOptions?.length) return undefined;
  const alternative = fightingStyleAlternative(targetClassId, request);
  if (!alternative) return undefined;
  const definition = classById(targetClassId)!;
  const source = `${definition.nameKo} ${targetLevel}레벨 · SRD 5.2.1`;
  const knownCantrips = new Set(state.cantripIds ?? []);
  const availableAlternativeCantrips = alternative.cantripOptions?.filter((option) => !knownCantrips.has(option.id)).length ?? 0;
  const parentId = `progression.${targetClassId}.${targetLevel}.fighting-style`;
  const parent: ChoiceDefinition = {
    id:parentId,
    label:"전투 방식",
    description:`전투 방식 재주 하나 또는 ${alternative.label}를 선택합니다.`,
    kind:"feature-option",
    count:1,
    required:true,
    status:"ready",
    source,
    options:[
      ...request.fightingStyleOptions.map((option) => ({
        ...option,
        disabledReason:state.features.includes(option.id) || state.features.includes(option.label) ? "이미 보유한 전투 방식 재주입니다." : undefined,
      })),
      {
        id:alternative.optionId,
        label:alternative.label,
        description:alternative.description,
        disabledReason:availableAlternativeCantrips < 2 ? `새로 배울 수 있는 소마법이 두 개 미만이라 ${alternative.label}를 선택할 수 없습니다.` : undefined,
      },
    ],
  };
  const result = [parent];
  const parentSelection = request.selections[parentId];
  if (parentSelection?.kind === "options" && parentSelection.optionIds[0] === alternative.optionId) {
    result.push({
      id:`${parentId}.${alternative.childSuffix}`,
      label:alternative.childLabel,
      description:alternative.childDescription,
      kind:"spell",
      count:2,
      required:true,
      status:"ready",
      source,
      options:(alternative.cantripOptions ?? []).map((option) => ({
        ...option,
        disabledReason:knownCantrips.has(option.id) ? "이미 알고 있는 소마법입니다." : undefined,
      })),
    });
  }
  return result;
}

function highestClassSpellSlotLevel(classId: string, classLevel: number) {
  let highest = 0;
  for (let spellLevel = 1; spellLevel <= 9; spellLevel += 1) {
    if (numericProgressionColumn(classId, classLevel, String(spellLevel)) > 0) highest = spellLevel;
  }
  return highest;
}

function cantripChoice(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  count: number,
  spellOptions: ProgressionRequest["spellOptions"],
): ChoiceDefinition | undefined {
  const canonical = classCantripListEntries(targetClassId);
  if (!canonical.length) return undefined;
  const definition = classById(targetClassId)!;
  const presentation = new Map((spellOptions ?? []).map((option) => [option.id, option]));
  const known = new Set(state.cantripIds ?? []);
  return {
    id:`progression.${targetClassId}.${targetLevel}.column.소마법`,
    label:`소마법 +${count}`,
    description:`${definition.nameKo} 주문 목록에서 아직 알지 못하는 소마법 ${count}개를 추가로 배웁니다.`,
    kind:"spell",
    count,
    required:true,
    status:"ready",
    source:`${definition.nameKo} ${targetLevel}레벨 표 · SRD 5.2.1`,
    options:canonical.map((entry) => {
      const display = presentation.get(entry.id);
      return {
        id:entry.id,
        label:display?.label ?? entry.nameEn,
        description:display?.description ?? `${definition.nameKo} 소마법`,
        disabledReason:known.has(entry.id) ? "이미 알고 있는 소마법입니다." : undefined,
      };
    }),
  };
}

function preparedSpellChoice(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  count: number,
  spellOptions: ProgressionRequest["spellOptions"],
): ChoiceDefinition | undefined {
  const maxSpellLevel = highestClassSpellSlotLevel(targetClassId, targetLevel);
  if (maxSpellLevel <= 0) return undefined;
  const canonical = classSpellListEntries(targetClassId, maxSpellLevel);
  if (!canonical.length) return undefined;
  const definition = classById(targetClassId)!;
  const presentation = new Map((spellOptions ?? []).map((option) => [option.id, option]));
  const automaticAtTargetLevel = automaticPreparedSpellsForLevel(targetClassId, targetLevel).map((entry) => entry.spellId);
  const alreadyPrepared = new Set([...(state.preparedSpellIds ?? []).map(normalizedSpellId), ...automaticAtTargetLevel]);
  return {
    id:`progression.${targetClassId}.${targetLevel}.column.준비 주문`,
    label:`준비 주문 +${count}`,
    description:`${definition.nameKo} 주문 목록에서 현재 사용할 수 있는 ${maxSpellLevel}레벨 이하 주문 ${count}개를 추가로 준비합니다.`,
    kind:"spell",
    count,
    required:true,
    status:"ready",
    source:`${definition.nameKo} ${targetLevel}레벨 표 · SRD 5.2.1`,
    options:canonical.map((entry) => {
      const display = presentation.get(entry.id);
      return {
        id:entry.id,
        label:display?.label ?? entry.nameEn,
        description:display?.description ?? `${entry.level}레벨 ${definition.nameKo} 주문`,
        disabledReason:alreadyPrepared.has(entry.id) ? "이미 준비했거나 항상 준비된 주문입니다." : undefined,
      };
    }),
  };
}

function featureChoiceDefinitions(
  state: ProgressionCharacterState,
  targetClassId: string,
  targetLevel: number,
  features: string[],
  request: ProgressionRequest,
): ChoiceDefinition[] {
  const definition = classById(targetClassId)!;
  const result: ChoiceDefinition[] = [];
  for (const feature of features) {
    if (feature === "능력치 향상") {
      result.push({
        id:`progression.${targetClassId}.${targetLevel}.asi`, label:"능력치 향상 또는 재주", description:"능력치 +2, 서로 다른 능력치 +1/+1, 또는 적격 재주 하나를 선택합니다.", kind:"asi-or-feat", count:1, required:true, status:"ready", source:`${definition.nameKo} ${targetLevel}레벨`,
        options:[
          ...Object.entries(ABILITY_LABELS).map(([id, label]) => ({ id:`ability:${id}`, label })),
          ...(request.featOptions ?? []).map((feat) => ({ id:`feat:${feat.id}`, label:feat.label, description:feat.description })),
        ],
      });
      continue;
    }
    if (feature.includes("서브클래스") && !feature.includes("특성")) {
      result.push({ id:`progression.${targetClassId}.${targetLevel}.subclass`, label:"서브클래스", description:"이 클래스의 SRD 서브클래스를 선택합니다.", kind:"subclass", count:1, required:true, status:"ready", source:`${definition.nameKo} ${targetLevel}레벨`, options:[{ id:`subclass:${definition.srdSubclassName}`, label:definition.srdSubclassName }] });
      continue;
    }
    if (feature === "에픽 은총") {
      result.push({ id:`progression.${targetClassId}.${targetLevel}.epic-boon`, label:"에픽 은총", description:"선행 조건을 만족하는 에픽 은총 재주를 선택합니다.", kind:"epic-boon", count:1, required:true, status:"catalog-pending", source:`${definition.nameKo} ${targetLevel}레벨`, options:[], pendingReason:"에픽 은총 재주 catalog relationship은 Phase 08에서 materialize됩니다." });
      continue;
    }
    if (feature.includes("서브클래스") && feature.includes("특성")) {
      result.push({ id:`progression.${targetClassId}.${targetLevel}.subclass-feature`, label:"서브클래스 특성", description:"선택한 서브클래스의 해당 레벨 특성을 적용합니다.", kind:"feature-option", count:1, required:true, status:"catalog-pending", source:`${definition.nameKo} ${targetLevel}레벨`, options:[], pendingReason:"서브클래스별 고레벨 mechanics relationship은 Phase 08에서 materialize됩니다." });
      continue;
    }
    if (feature === "노련한 탐험가") {
      const relationship = seasonedExplorerRelationship(targetClassId, targetLevel);
      if (relationship) {
        result.push(
          expertiseChoice(state, targetClassId, targetLevel, relationship.expertiseCount, "seasoned-explorer.expertise", "노련한 탐험가 · 전문화"),
          languageChoice(state, targetClassId, targetLevel, relationship.languageCount, request.languageOptions),
        );
        continue;
      }
    }
    if (feature === "전투 방식" && (targetClassId === RANGER_ID || targetClassId === PALADIN_ID)) {
      const choices = classFightingStyleChoices(state, targetClassId, targetLevel, request);
      if (choices) {
        result.push(...choices);
        continue;
      }
    }
    if (targetClassId === CLERIC_ID && (feature === "신성한 역할" || feature === "축복받은 일격")) {
      const clericChoices = clericFeatureChoiceDefinitions({
        feature,
        targetLevel,
        knownCantripIds:state.cantripIds ?? [],
        selections:request.selections,
        spellOptions:request.spellOptions,
      });
      if (clericChoices) {
        result.push(...clericChoices);
        continue;
      }
    }
    if (targetClassId === DRUID_ID && (feature === "원초적 역할" || isDruidElementalFuryFeature(feature))) {
      const druidChoices = druidFeatureChoiceDefinitions({
        feature,
        targetLevel,
        knownCantripIds:state.cantripIds ?? [],
        selections:request.selections,
        spellOptions:request.spellOptions,
      });
      if (druidChoices) {
        result.push(...druidChoices);
        continue;
      }
    }
    if (feature === "전문화") {
      const expertise = expertiseChoiceDefinition(state, targetClassId, targetLevel);
      if (expertise) {
        result.push(expertise);
        continue;
      }
    }
    if (CHOICE_FEATURE_NAMES.has(feature) || /선택/.test(feature) || feature.startsWith("신비한 비전")) {
      const kind = feature === "전문화" ? "expertise" : (feature.startsWith("신비한 비전") || ["마법의 비밀","주문 숙련","대표 주문"].includes(feature)) ? "spell" : "feature-option";
      result.push({ id:`progression.${targetClassId}.${targetLevel}.${feature}`, label:feature, description:`${feature}의 실제 선택지를 고릅니다.`, kind, count:1, required:true, status:"catalog-pending", source:`${definition.nameKo} ${targetLevel}레벨`, options:[], pendingReason:`${feature} 선택 관계는 Phase 08 catalog mechanics materialization이 필요합니다.` });
    }
  }
  return result;
}

function columnChoiceDefinitions(
  state: ProgressionCharacterState,
  targetClassId: string,
  fromLevel: number,
  toLevel: number,
  request: ProgressionRequest,
) {
  const definition = classById(targetClassId)!;
  const result: ChoiceDefinition[] = [];
  const watched: Array<{ key:string; kind:ChoiceDefinition["kind"]; label:string }> = [
    { key:"소마법", kind:"spell", label:"소마법" },
    { key:"준비 주문", kind:"spell", label:"준비 주문" },
    { key:"무기 통달", kind:"weapon-mastery", label:"무기 통달" },
    { key:"기원술", kind:"feature-option", label:"기원술" },
  ];
  for (const watchedColumn of watched) {
    const before = fromLevel <= 0 ? 0 : numericProgressionColumn(targetClassId, fromLevel, watchedColumn.key);
    const after = numericProgressionColumn(targetClassId, toLevel, watchedColumn.key);
    if (after <= before) continue;
    const count = after - before;
    if (watchedColumn.key === "소마법") {
      const ready = cantripChoice(state, targetClassId, toLevel, count, request.spellOptions);
      if (ready) {
        result.push(ready);
        continue;
      }
    }
    if (watchedColumn.key === "준비 주문") {
      const ready = preparedSpellChoice(state, targetClassId, toLevel, count, request.spellOptions);
      if (ready) {
        result.push(ready);
        continue;
      }
    }
    result.push({
      id:`progression.${targetClassId}.${toLevel}.column.${watchedColumn.key}`,
      label:`${watchedColumn.label} +${count}`,
      description:`${definition.nameKo} 표의 ${watchedColumn.key} 수가 ${before} → ${after}로 증가합니다.`,
      kind:watchedColumn.kind,
      count,
      required:true,
      status:"catalog-pending",
      source:`${definition.nameKo} ${toLevel}레벨 표`,
      options:[],
      pendingReason:`${watchedColumn.label}의 해당 레벨 선택 목록은 Phase 08 catalog relationship materialization이 필요합니다.`,
    });
  }
  return result;
}

function applyAsi(abilities: Record<AbilityKey, number>, selection: ChoiceSelectionMap[string] | undefined) {
  const next = clone(abilities);
  if (!selection || selection.kind !== "asi") return { abilities: next, featId: undefined as string | undefined };
  if (selection.mode === "plus-two" && selection.primary) next[selection.primary] = Math.min(20, next[selection.primary] + 2);
  if (selection.mode === "split" && selection.primary && selection.secondary && selection.primary !== selection.secondary) {
    next[selection.primary] = Math.min(20, next[selection.primary] + 1);
    next[selection.secondary] = Math.min(20, next[selection.secondary] + 1);
  }
  return { abilities: next, featId: selection.mode === "feat" ? selection.featId : undefined };
}

function selectedOptionIds(choice: ChoiceDefinition, selections: ChoiceSelectionMap) {
  const selection = selections[choice.id];
  return selection?.kind === "options" ? selection.optionIds : [];
}

function selectedOptionLabels(choice: ChoiceDefinition, selections: ChoiceSelectionMap) {
  const byId = new Map(choice.options.map((option) => [option.id, option.label]));
  return selectedOptionIds(choice, selections).map((id) => byId.get(id)).filter((label): label is string => Boolean(label));
}

function displayTracks(tracks: ProgressionClassTrack[]) { return tracks.map((track) => `${track.className} ${track.level}`).join(" / "); }
function displayHitDice(hitDice: Record<string, number>) { return Object.entries(hitDice).filter(([,count]) => count > 0).sort().map(([die,count]) => `${count}${die}`).join(" + ") || "—"; }
function displaySlots(slots: Record<number, number>) { const text = Object.entries(slots).filter(([,count]) => count > 0).map(([level,count]) => `${level}레벨 ${count}`).join(" · "); return text || "없음"; }
function displayList(values: string[]) { return values.length ? values.join(", ") : "없음"; }

export function buildProgressionPlan(state: ProgressionCharacterState, request: ProgressionRequest): ProgressionPlan {
  const target = classById(request.targetClassId);
  if (!target) throw new Error(`unknown target class ${request.targetClassId}`);
  const existing = state.classTracks.find((track) => track.classId === target.id);
  const targetClassLevel = (existing?.level ?? 0) + 1;
  const toTotalLevel = state.totalLevel + 1;
  const isMulticlass = !existing && state.classTracks.length > 0;
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (request.expectedRevision !== state.revision) blocking.push(`progression revision mismatch: expected ${request.expectedRevision}, current ${state.revision}`);
  if (state.totalLevel >= 20) blocking.push("SRD 기본 레벨 상한 20에 도달했습니다.");
  if (targetClassLevel > 20) blocking.push(`${target.nameKo} 클래스 레벨은 20을 넘을 수 없습니다.`);
  let eligible = true;
  let eligibilityReason: string | undefined;
  if (isMulticlass) {
    const eligibility = multiclassEligibility(state.abilities, state.classTracks, target.id);
    eligible = eligibility.eligible;
    eligibilityReason = eligibility.reason || undefined;
    if (!eligible) blocking.push(`멀티클래스 선행 조건 미충족: ${eligibility.reason}`);
  }
  const row = progressionRow(target.id, targetClassLevel);
  if (!row) blocking.push(`${target.nameKo} ${targetClassLevel}레벨 progression row가 없습니다.`);
  const rowFeatures = row?.features ?? [];
  const choices = [
    ...featureChoiceDefinitions(state, target.id, targetClassLevel, rowFeatures, request),
    ...columnChoiceDefinitions(state, target.id, existing?.level ?? 0, targetClassLevel, request),
  ];
  for (const choice of choices) {
    if (!choice.required || choice.status !== "ready" || choice.kind === "asi-or-feat") continue;
    const available = choice.options.filter((option) => !option.disabledReason).length;
    if (available < choice.count) blocking.push(`${choice.label}에 선택 가능한 항목이 ${available}개뿐이며 ${choice.count}개가 필요합니다.`);
  }
  const choiceIssues = validateChoiceDefinitions(choices, request.selections);
  blocking.push(...choiceIssues.filter((issue) => issue.severity === "blocking").map((issue) => issue.message));
  warnings.push(...choiceIssues.filter((issue) => issue.severity === "warning").map((issue) => issue.message));
  const selectedCantripCounts = new Map<string, number>();
  for (const choice of choices.filter((entry) => isCantripChoiceId(entry.id))) {
    for (const id of selectedOptionIds(choice, request.selections)) selectedCantripCounts.set(id, (selectedCantripCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of selectedCantripCounts) if (count > 1) blocking.push(`소마법 선택은 같은 progression 트랜잭션 안에서 중복될 수 없습니다: ${id}`);
  const choiceFeatureSet = new Set(choices.map((choice) => choice.label.replace(/ \+\d+$/, "")));
  const automaticGrants = rowFeatures.filter((feature) => feature !== "능력치 향상" && feature !== "에픽 은총" && !feature.includes("서브클래스") && !choiceFeatureSet.has(feature) && !CHOICE_FEATURE_NAMES.has(feature) && !isDruidElementalFuryFeature(feature) && !feature.startsWith("신비한 비전") && !/선택/.test(feature));
  const classTracksBefore = clone(state.classTracks);
  const classTracksAfter = clone(state.classTracks);
  if (existing) classTracksAfter.find((track) => track.classId === target.id)!.level += 1;
  else classTracksAfter.push({ classId:target.id, className:target.nameKo, level:1 });
  const subclassChoice = choices.find((choice) => choice.kind === "subclass");
  if (subclassChoice) {
    const selected = request.selections[subclassChoice.id];
    if (selected?.kind === "options" && selected.optionIds[0]?.startsWith("subclass:")) {
      classTracksAfter.find((track) => track.classId === target.id)!.subclassName = selected.optionIds[0].slice("subclass:".length);
    }
  }
  const asiChoice = choices.find((choice) => choice.kind === "asi-or-feat");
  const asi = applyAsi(state.abilities, asiChoice ? request.selections[asiChoice.id] : undefined);
  const oldCon = modifier(state.abilities.con);
  const newCon = modifier(asi.abilities.con);
  const baseGain = request.hpMethod === "fixed" ? fixedHpGain(target.id) : (request.hpRoll ?? 0);
  if (request.hpMethod === "roll" && (!Number.isInteger(request.hpRoll) || (request.hpRoll ?? 0) < 1 || (request.hpRoll ?? 0) > target.hitDie)) blocking.push(`HP 굴림은 d${target.hitDie}의 1-${target.hitDie} 값이어야 합니다.`);
  const gainBeforeConRetroactive = Math.max(1, baseGain + oldCon);
  const retroactiveConstitutionGain = (newCon - oldCon) * toTotalLevel;
  const totalGain = gainBeforeConRetroactive + retroactiveConstitutionGain;
  const hitDiceBefore = clone(state.hitDiceByDie);
  const dieKey = `d${target.hitDie}`;
  const hitDiceAfter = { ...hitDiceBefore, [dieKey]:(hitDiceBefore[dieKey] ?? 0) + 1 };
  const proficiencyAfter = proficiencyBonusForTotalLevel(toTotalLevel);
  const spellcastingBefore = multiclassSpellSlots(classTracksBefore);
  const spellcastingAfter = multiclassSpellSlots(classTracksAfter);
  const multiclassGrants = isMulticlass ? target.multiclassGrants : [];
  const expertiseBefore = unique(state.expertiseSkills ?? []);
  const expertiseAdded = choices.filter((choice) => choice.kind === "expertise").flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const expertiseAfter = unique([...expertiseBefore, ...expertiseAdded]);
  const languagesBefore = unique(state.languages ?? []);
  const languagesAdded = choices.filter((choice) => choice.kind === "language").flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const languagesAfter = unique([...languagesBefore, ...languagesAdded]);
  const fightingStyleChoice = choices.find((choice) => choice.id.endsWith(".fighting-style"));
  const fightingStyleLabels = fightingStyleChoice ? selectedOptionLabels(fightingStyleChoice, request.selections) : [];
  const alternativeCantripLabels = choices
    .filter((choice) => choice.id.includes(".fighting-style.") && choice.id.endsWith(".cantrips"))
    .flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const classCantripLabels = choices
    .filter((choice) => choice.id.endsWith(".column.소마법"))
    .flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const clericFeatureLabels = choices
    .filter((choice) => isClericPersistentFeatureChoice(choice.id))
    .flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const druidFeatureLabels = choices
    .filter((choice) => isDruidPersistentFeatureChoice(choice.id))
    .flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const preparedSpellLabels = choices
    .filter((choice) => choice.kind === "spell" && choice.id.endsWith(".column.준비 주문"))
    .flatMap((choice) => selectedOptionLabels(choice, request.selections));
  const automaticPrepared = automaticPreparedSpellsForLevel(target.id, targetClassLevel);
  const diffs: ProgressionDiff[] = [
    { label:"총 레벨", before:String(state.totalLevel), after:String(toTotalLevel), source:"SRD Level Advancement" },
    { label:"클래스", before:displayTracks(classTracksBefore), after:displayTracks(classTracksAfter), source:isMulticlass ? "SRD Multiclassing" : `${target.nameKo} progression` },
    { label:"최대 HP", before:String(state.hpMaximum), after:String(state.hpMaximum + totalGain), source:`d${target.hitDie} / fixed ${fixedHpGain(target.id)} + 건강 수정치` },
    { label:"히트 다이스", before:displayHitDice(hitDiceBefore), after:displayHitDice(hitDiceAfter), source:`${target.nameKo} d${target.hitDie}` },
    { label:"숙련 보너스", before:`+${state.proficiencyBonus}`, after:`+${proficiencyAfter}`, source:"총 캐릭터 레벨" },
  ];
  if (spellcastingBefore.casterLevel !== spellcastingAfter.casterLevel || displaySlots(spellcastingBefore.slots) !== displaySlots(spellcastingAfter.slots)) diffs.push({ label:"멀티클래스 주문 슬롯", before:displaySlots(spellcastingBefore.slots), after:displaySlots(spellcastingAfter.slots), source:"SRD Multiclass Spellcaster Level" });
  if (expertiseAfter.length !== expertiseBefore.length) diffs.push({ label:"전문화", before:displayList(expertiseBefore), after:displayList(expertiseAfter), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (languagesAfter.length !== languagesBefore.length) diffs.push({ label:"언어", before:displayList(languagesBefore), after:displayList(languagesAfter), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (fightingStyleLabels.length) diffs.push({ label:"전투 방식", before:"—", after:fightingStyleLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (alternativeCantripLabels.length) diffs.push({ label:"전투 방식 소마법", before:"—", after:alternativeCantripLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (classCantripLabels.length) diffs.push({ label:"소마법 추가", before:"—", after:classCantripLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (clericFeatureLabels.length) diffs.push({ label:"클레릭 선택", before:"—", after:clericFeatureLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (druidFeatureLabels.length) diffs.push({ label:"드루이드 선택", before:"—", after:druidFeatureLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (automaticPrepared.length) diffs.push({ label:"항상 준비 주문", before:"—", after:automaticPrepared.map((entry) => entry.nameEn).join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (preparedSpellLabels.length) diffs.push({ label:"준비 주문 추가", before:"—", after:preparedSpellLabels.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  if (automaticGrants.length) diffs.push({ label:"자동 클래스 특성", before:"—", after:automaticGrants.join(", "), source:`${target.nameKo} ${targetClassLevel}레벨` });
  return {
    targetClassId:target.id, targetClassName:target.nameKo, targetClassLevel, fromTotalLevel:state.totalLevel, toTotalLevel,
    isMulticlass, eligible, eligibilityReason, automaticGrants, multiclassGrants, choices, blocking:[...new Set(blocking)], warnings:[...new Set(warnings)],
    hp:{ hitDie:target.hitDie, method:request.hpMethod, baseGain, constitutionModifier:oldCon, gainBeforeConRetroactive, retroactiveConstitutionGain, totalGain },
    proficiencyBefore:state.proficiencyBonus, proficiencyAfter, classTracksBefore, classTracksAfter, hitDiceBefore, hitDiceAfter, spellcastingBefore, spellcastingAfter, diffs,
  };
}

export function resolveProgression(state: ProgressionCharacterState, request: ProgressionRequest): ProgressionResolution {
  const plan = buildProgressionPlan(state, request);
  if (plan.blocking.length) return { status:"rejected", state, plan, error:plan.blocking.join(" | ") };
  const next = clone(state);
  const asiChoice = plan.choices.find((choice) => choice.kind === "asi-or-feat");
  const asi = applyAsi(next.abilities, asiChoice ? request.selections[asiChoice.id] : undefined);
  next.revision += 1;
  next.totalLevel = plan.toTotalLevel;
  next.classTracks = clone(plan.classTracksAfter);
  next.hitDiceByDie = clone(plan.hitDiceAfter);
  next.proficiencyBonus = plan.proficiencyAfter;
  next.hpMaximum = Math.max(1, next.hpMaximum + plan.hp.totalGain);
  next.hpCurrent = Math.min(next.hpCurrent, next.hpMaximum);
  next.abilities = asi.abilities;
  next.spellSlotMaximums = clone(plan.spellcastingAfter.slots);
  next.features.push(...plan.automaticGrants);
  const expertiseSkills = new Set(next.expertiseSkills ?? []);
  const expertiseSources = { ...(next.expertiseSources ?? {}) };
  for (const choice of plan.choices.filter((entry) => entry.kind === "expertise")) {
    for (const skill of selectedOptionLabels(choice, request.selections)) {
      expertiseSkills.add(skill);
      expertiseSources[skill] = choice.source;
    }
  }
  next.expertiseSkills = [...expertiseSkills];
  next.expertiseSources = expertiseSources;
  const languages = new Set(next.languages ?? []);
  const languageSources = { ...(next.languageSources ?? {}) };
  for (const choice of plan.choices.filter((entry) => entry.kind === "language")) {
    for (const language of selectedOptionLabels(choice, request.selections)) {
      languages.add(language);
      languageSources[language] = choice.source;
    }
  }
  next.languages = [...languages];
  next.languageSources = languageSources;
  const fightingStyleChoice = plan.choices.find((choice) => choice.id.endsWith(".fighting-style"));
  if (fightingStyleChoice) {
    const styleId = selectedOptionIds(fightingStyleChoice, request.selections)[0];
    if (styleId?.startsWith("dnd.srd521.feat.fighting-style.")) next.features.push(styleId);
    else if (styleId === RANGER_DRUIDIC_WARRIOR) next.features.push("드루이드 전사");
    else if (styleId === PALADIN_BLESSED_WARRIOR) next.features.push("축복받은 전사");
  }
  for (const choice of plan.choices.filter((entry) => isClericPersistentFeatureChoice(entry.id) || isDruidPersistentFeatureChoice(entry.id))) {
    next.features.push(...selectedOptionLabels(choice, request.selections));
  }
  const cantripIds = [...(next.cantripIds ?? [])];
  const cantripKeys = new Set(cantripIds);
  const cantripSources = { ...(next.cantripSources ?? {}) };
  for (const choice of plan.choices.filter((entry) => isCantripChoiceId(entry.id))) {
    for (const spellId of selectedOptionIds(choice, request.selections)) {
      if (!cantripKeys.has(spellId)) {
        cantripKeys.add(spellId);
        cantripIds.push(spellId);
      }
      cantripSources[spellId] = choice.source;
    }
  }
  next.cantripIds = cantripIds;
  next.cantripSources = cantripSources;
  const preparedSpellIds = [...(next.preparedSpellIds ?? [])];
  const preparedSpellKeys = new Set(preparedSpellIds.map(normalizedSpellId));
  const preparedSpellSources = { ...(next.preparedSpellSources ?? {}) };
  for (const choice of plan.choices.filter((entry) => entry.kind === "spell" && entry.id.endsWith(".column.준비 주문"))) {
    for (const spellId of selectedOptionIds(choice, request.selections)) {
      if (!preparedSpellKeys.has(spellId)) {
        preparedSpellKeys.add(spellId);
        preparedSpellIds.push(spellId);
      }
      preparedSpellSources[spellId] = choice.source;
    }
  }
  for (const relationship of automaticPreparedSpellsForLevel(plan.targetClassId, plan.targetClassLevel)) {
    const existingIndex = preparedSpellIds.findIndex((id) => normalizedSpellId(id) === relationship.spellId);
    const alwaysId = `always:${relationship.spellId}`;
    if (existingIndex >= 0) preparedSpellIds[existingIndex] = alwaysId;
    else preparedSpellIds.push(alwaysId);
    preparedSpellKeys.add(relationship.spellId);
    preparedSpellSources[relationship.spellId] = `${plan.targetClassName} ${plan.targetClassLevel}레벨 · ${relationship.sourceFeature} · SRD 5.2.1`;
  }
  next.preparedSpellIds = unique(preparedSpellIds);
  next.preparedSpellSources = preparedSpellSources;
  if (plan.isMulticlass) next.features.push(...plan.multiclassGrants.map((grant) => `${plan.targetClassName} 멀티클래스 · ${grant}`));
  const subclass = plan.classTracksAfter.find((track) => track.classId === plan.targetClassId)?.subclassName;
  if (subclass && !next.features.includes(subclass)) next.features.push(subclass);
  if (asi.featId) next.features.push(asi.featId);
  next.features = [...new Set(next.features)];
  return { status:"committed", state:next, plan };
}

export function progressionSourceRevision() { return PROGRESSION_CATALOG.source.revision; }
