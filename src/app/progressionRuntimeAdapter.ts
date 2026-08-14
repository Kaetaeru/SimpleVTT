import "./progressionContracts";
import "./creationContracts";
import type { AppSnapshot, CharacterSheet, CharacterSummary, LevelUpCommand, LevelUpDraft } from "./contracts";
import { fightingStyleOptions, generalLanguageOptions, originFeatOptions, spellOptions } from "./characterCreationV10Data";
import { SPELL_PRESENTATIONS } from "./spellPresentation";
import { MockAdapter } from "./mockAdapter";
import type { ChoiceSelectionMap, ChoiceSelectionValue } from "../domain/choiceDefinition";
import { classById, classByName } from "../domain/progressionCatalog";
import { buildProgressionPlan, resolveProgression, type ProgressionCharacterState, type ProgressionPlan } from "../domain/progression";
import { SORCERER_ID } from "../domain/sorcererProgressionChoices";
import { SORCERY_POINT_RESOURCE_ID, sorceryPointMaximum } from "../domain/sorcery";
import { wizardSignatureSpellResourceId } from "../domain/wizardProgressionChoices";

const clone = <T,>(value: T): T => structuredClone(value);
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const normalizedSkillName = (value: string) => value.replace(/\s+[+-]\d+$/, "").trim();
const normalizedSpellId = (value: string) => value.replace(/^always:/, "");

type AdapterState = {
  activeCharacter: CharacterSheet;
  characters: CharacterSummary[];
  levelUpDraft: LevelUpDraft | null;
  catalog: AppSnapshot["catalog"];
  edgeState: AppSnapshot["edgeState"];
  activity: AppSnapshot["activity"];
  scene: AppSnapshot["scene"];
  syncChar(): void;
  getSnapshot(): Promise<AppSnapshot>;
};

export interface Phase07AdapterCommands {
  setProgressionTargetClass(classId: string): Promise<AppSnapshot>;
  setProgressionChoice(choiceId: string, value: ChoiceSelectionValue): Promise<AppSnapshot>;
  setProgressionHp(method: "fixed" | "roll", roll?: number): Promise<AppSnapshot>;
}

function primaryClass(sheet: CharacterSheet) {
  return classByName(sheet.className) ?? classByName(sheet.className.split("/")[0]?.trim() ?? sheet.className);
}

function creationExpertise(sheet: CharacterSheet) {
  const selected = (sheet.creationSelections?.["class.expertise"] ?? [])
    .map((value) => value.replace(/^expertise\./, ""))
    .map(normalizedSkillName);
  const fromFeatures = sheet.features.flatMap((feature) => {
    const match = feature.match(/^(?:expertise|전문화)\s*·\s*(.+)$/i);
    return match ? [normalizedSkillName(match[1])] : [];
  });
  return unique([...selected, ...fromFeatures]);
}

function ensureSignatureSpellResources(sheet: CharacterSheet) {
  const presentation = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  for (const spellId of sheet.signatureSpellIds ?? []) {
    const resourceId = wizardSignatureSpellResourceId(spellId);
    if (sheet.resources.some((resource) => resource.id === resourceId)) continue;
    sheet.resources.push({
      id:resourceId,
      label:`대표 주문 · ${presentation.get(spellId)?.name ?? spellId}`,
      current:1,
      max:1,
      source:sheet.signatureSpellSources?.[spellId] ?? "위저드 20레벨 · 대표 주문 · SRD 5.2.1",
      recovery:{ shortRest:"all", longRest:"all" },
    });
  }
}

function ensureSorceryPointResource(sheet: CharacterSheet) {
  const sorcererLevel = sheet.classLevels?.find((track) => track.classId === SORCERER_ID)?.level ?? 0;
  const maximum = sorceryPointMaximum(sorcererLevel);
  if (maximum <= 0) return;
  const existing = sheet.resources.find((resource) => resource.id === SORCERY_POINT_RESOURCE_ID);
  if (!existing) {
    sheet.resources.push({
      id:SORCERY_POINT_RESOURCE_ID,
      label:"소서리 포인트",
      current:maximum,
      max:maximum,
      source:`소서러 ${sorcererLevel}레벨 · Font of Magic · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
    return;
  }
  existing.max = maximum;
  existing.current = Math.min(existing.current, maximum);
  existing.source = `소서러 ${sorcererLevel}레벨 · Font of Magic · SRD 5.2.1`;
  existing.recovery = { ...(existing.recovery ?? {}), longRest:"all" };
}

export function ensureProgressionMetadata(sheet: CharacterSheet) {
  if (!sheet.classLevels?.length) {
    const definition = primaryClass(sheet);
    if (definition) sheet.classLevels = [{ classId:definition.id, className:definition.nameKo, level:sheet.level, subclassName:sheet.subclassName }];
  }
  if (!sheet.hitDiceByDie) {
    const dice: Record<string, number> = {};
    for (const track of sheet.classLevels ?? []) {
      const definition = classById(track.classId);
      if (!definition) continue;
      const key = `d${definition.hitDie}`;
      dice[key] = (dice[key] ?? 0) + track.level;
    }
    sheet.hitDiceByDie = dice;
  }
  ensureSorceryPointResource(sheet);
  const migratedExpertise = creationExpertise(sheet);
  sheet.expertiseSkills = unique([...(sheet.expertiseSkills ?? []), ...migratedExpertise]);
  sheet.expertiseSources ??= {};
  for (const skill of migratedExpertise) sheet.expertiseSources[skill] ??= "SRD 5.2.1 · Character Creation · 전문화";
  sheet.languages = unique(sheet.languages ?? []);
  sheet.languageSources ??= {};
  for (const language of sheet.languages) sheet.languageSources[language] ??= "Character Creation / existing character";
  sheet.cantrips = unique(sheet.cantrips ?? []);
  sheet.cantripSources ??= {};
  for (const cantrip of sheet.cantrips) sheet.cantripSources[cantrip] ??= "Character Creation / existing character";
  sheet.preparedSpells = unique(sheet.preparedSpells ?? []);
  sheet.preparedSpellSources ??= {};
  for (const spell of sheet.preparedSpells) {
    const id = normalizedSpellId(spell);
    sheet.preparedSpellSources[id] ??= spell.startsWith("always:") ? "Always prepared / existing character" : "Character Creation / existing character";
  }
  sheet.spellbookSpells = unique(sheet.spellbookSpells ?? []);
  sheet.spellbookSpellSources ??= {};
  for (const spell of sheet.spellbookSpells) sheet.spellbookSpellSources[spell] ??= "Character Creation / existing character";
  sheet.spellMasterySpellIds ??= {};
  sheet.spellMasterySources ??= {};
  sheet.signatureSpellIds = unique(sheet.signatureSpellIds ?? []);
  sheet.signatureSpellSources ??= {};
  ensureSignatureSpellResources(sheet);
  sheet.metamagicIds = unique(sheet.metamagicIds ?? []);
  sheet.metamagicSources ??= {};
  for (const metamagicId of sheet.metamagicIds) sheet.metamagicSources[metamagicId] ??= "Existing character / Sorcerer Metamagic";
  sheet.eldritchInvocationIds = unique(sheet.eldritchInvocationIds ?? []);
  sheet.eldritchInvocationSources ??= {};
  for (const invocationId of sheet.eldritchInvocationIds) sheet.eldritchInvocationSources[invocationId] ??= "Existing character / Eldritch Invocation";
  sheet.mysticArcanumSpellIds ??= {};
  sheet.mysticArcanumSources ??= {};
  sheet.pactMagicSlotLevel ??= 0;
  sheet.pactMagicSlotMaximum ??= 0;
  sheet.progressionRevision ??= 0;
  return sheet;
}

function characterState(sheet: CharacterSheet): ProgressionCharacterState {
  ensureProgressionMetadata(sheet);
  return {
    revision:sheet.progressionRevision ?? 0,
    id:sheet.id,
    name:sheet.name,
    totalLevel:sheet.level,
    abilities:clone(sheet.abilities),
    hpCurrent:sheet.hp,
    hpMaximum:sheet.maxHp,
    proficiencyBonus:sheet.proficiencyBonus,
    classTracks:clone(sheet.classLevels ?? []),
    hitDiceByDie:clone(sheet.hitDiceByDie ?? {}),
    features:clone(sheet.features),
    proficientSkills:unique(sheet.skills.map(normalizedSkillName)),
    expertiseSkills:clone(sheet.expertiseSkills ?? []),
    expertiseSources:clone(sheet.expertiseSources ?? {}),
    languages:clone(sheet.languages ?? []),
    languageSources:clone(sheet.languageSources ?? {}),
    cantripIds:clone(sheet.cantrips ?? []),
    cantripSources:clone(sheet.cantripSources ?? {}),
    preparedSpellIds:clone(sheet.preparedSpells ?? []),
    preparedSpellSources:clone(sheet.preparedSpellSources ?? {}),
    spellbookSpellIds:clone(sheet.spellbookSpells ?? []),
    spellbookSpellSources:clone(sheet.spellbookSpellSources ?? {}),
    spellMasterySpellIds:clone(sheet.spellMasterySpellIds ?? {}),
    spellMasterySources:clone(sheet.spellMasterySources ?? {}),
    signatureSpellIds:clone(sheet.signatureSpellIds ?? []),
    signatureSpellSources:clone(sheet.signatureSpellSources ?? {}),
    metamagicIds:clone(sheet.metamagicIds ?? []),
    metamagicSources:clone(sheet.metamagicSources ?? {}),
    eldritchInvocationIds:clone(sheet.eldritchInvocationIds ?? []),
    eldritchInvocationSources:clone(sheet.eldritchInvocationSources ?? {}),
    mysticArcanumSpellIds:clone(sheet.mysticArcanumSpellIds ?? {}),
    mysticArcanumSources:clone(sheet.mysticArcanumSources ?? {}),
    pactMagicSlotLevel:sheet.pactMagicSlotLevel ?? 0,
    pactMagicSlotMaximum:sheet.pactMagicSlotMaximum ?? 0,
    spellSlotMaximums:clone(sheet.spellSlotMaximums ?? {}),
  };
}

function featOptions(state: AdapterState) {
  return state.catalog.filter((entry) => entry.category === "feat").map((entry) => ({ id:entry.id, label:entry.nameKo, description:entry.description }));
}

function progressionOriginFeatOptions() {
  return originFeatOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary }));
}

function progressionFightingStyleOptions() {
  return fightingStyleOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary }));
}

function progressionClassCantripOptions(classId: string) {
  const presentations = new Map(SPELL_PRESENTATIONS.map((spell) => [spell.id, spell]));
  return spellOptions(classId, 0).map((option) => {
    const presentation = presentations.get(option.id);
    return {
      id:option.id,
      label:presentation?.name ?? option.name,
      description:presentation?.summary ?? option.summary,
    };
  });
}

function progressionLanguageOptions() {
  return generalLanguageOptions.map((option) => ({ id:option.id, label:option.name, description:option.summary }));
}

function progressionSpellOptions() {
  return SPELL_PRESENTATIONS.map((spell) => ({
    id:spell.id,
    label:spell.name,
    description:spell.summary,
    level:spell.level,
    castingTime:spell.castingTime,
    school:spell.school,
  }));
}

function targetClassId(sheet: CharacterSheet, draft: LevelUpDraft) {
  return draft.targetClassId ?? sheet.classLevels?.[0]?.classId ?? primaryClass(sheet)?.id ?? "dnd.srd521.class.fighter";
}

function requestFor(state: AdapterState) {
  const draft = state.levelUpDraft;
  if (!draft) throw new Error("level-up draft missing");
  const sheet = ensureProgressionMetadata(state.activeCharacter);
  return {
    expectedRevision:sheet.progressionRevision ?? 0,
    targetClassId:targetClassId(sheet, draft),
    hpMethod:draft.hpMethod,
    hpRoll:draft.hpRoll,
    selections:clone(draft.progressionSelections ?? {}),
    featOptions:featOptions(state),
    originFeatOptions:progressionOriginFeatOptions(),
    fightingStyleOptions:progressionFightingStyleOptions(),
    druidCantripOptions:progressionClassCantripOptions("dnd.srd521.class.druid"),
    clericCantripOptions:progressionClassCantripOptions("dnd.srd521.class.cleric"),
    languageOptions:progressionLanguageOptions(),
    spellOptions:progressionSpellOptions(),
  } as const;
}

function planFor(state: AdapterState): ProgressionPlan | null {
  if (!state.levelUpDraft) return null;
  return buildProgressionPlan(characterState(state.activeCharacter), requestFor(state));
}

function syncLegacyDraft(draft: LevelUpDraft, plan: ProgressionPlan) {
  draft.fromLevel = plan.fromTotalLevel;
  draft.toLevel = plan.toTotalLevel;
  draft.hpGain = plan.hp.totalGain;
  draft.preview = {
    ...draft.preview,
    maxHpBefore:Number(plan.diffs.find((diff) => diff.label === "최대 HP")?.before ?? draft.preview.maxHpBefore),
    maxHpAfter:Number(plan.diffs.find((diff) => diff.label === "최대 HP")?.after ?? draft.preview.maxHpAfter),
    proficiencyBefore:plan.proficiencyBefore,
    proficiencyAfter:plan.proficiencyAfter,
    hitDiceBefore:Object.entries(plan.hitDiceBefore).map(([die,count]) => `${count}${die}`).join(" + ") || "—",
    hitDiceAfter:Object.entries(plan.hitDiceAfter).map(([die,count]) => `${count}${die}`).join(" + ") || "—",
    grantedFeatures:[...plan.automaticGrants],
    resourceChanges:plan.multiclassGrants,
    actionChanges:[],
    spellChanges:plan.diffs.filter((diff) => diff.label.includes("주문") || diff.label.includes("소마법") || diff.label.includes("계약 마법") || diff.label.includes("신비한 비전")).map((diff) => `${diff.label}: ${diff.before} → ${diff.after}`),
    diffs:plan.diffs,
  };
  draft.validation = [
    ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
    ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
  ];
}

function summaryFromSheet(sheet: CharacterSheet): CharacterSummary {
  return {
    id:sheet.id, name:sheet.name, className:sheet.className, subclassName:sheet.subclassName, level:sheet.level,
    species:sheet.species, background:sheet.background, hp:sheet.hp, maxHp:sheet.maxHp, ac:sheet.ac, saveState:sheet.saveState,
  };
}

function applyCommittedSheet(sheet: CharacterSheet, result: Extract<ReturnType<typeof resolveProgression>, { status:"committed" }>, state: AdapterState) {
  const next = result.state;
  sheet.level = next.totalLevel;
  sheet.hp = next.hpCurrent;
  sheet.maxHp = next.hpMaximum;
  sheet.proficiencyBonus = next.proficiencyBonus;
  sheet.abilities = clone(next.abilities);
  sheet.classLevels = clone(next.classTracks);
  sheet.hitDiceByDie = clone(next.hitDiceByDie);
  sheet.progressionRevision = next.revision;
  sheet.expertiseSkills = clone(next.expertiseSkills ?? []);
  sheet.expertiseSources = clone(next.expertiseSources ?? {});
  sheet.languages = clone(next.languages ?? []);
  sheet.languageSources = clone(next.languageSources ?? {});
  sheet.cantrips = clone(next.cantripIds ?? []);
  sheet.cantripSources = clone(next.cantripSources ?? {});
  sheet.preparedSpells = clone(next.preparedSpellIds ?? []);
  sheet.preparedSpellSources = clone(next.preparedSpellSources ?? {});
  sheet.spellbookSpells = clone(next.spellbookSpellIds ?? []);
  sheet.spellbookSpellSources = clone(next.spellbookSpellSources ?? {});
  sheet.spellMasterySpellIds = clone(next.spellMasterySpellIds ?? {});
  sheet.spellMasterySources = clone(next.spellMasterySources ?? {});
  sheet.signatureSpellIds = clone(next.signatureSpellIds ?? []);
  sheet.signatureSpellSources = clone(next.signatureSpellSources ?? {});
  ensureSignatureSpellResources(sheet);
  sheet.metamagicIds = clone(next.metamagicIds ?? []);
  sheet.metamagicSources = clone(next.metamagicSources ?? {});
  sheet.eldritchInvocationIds = clone(next.eldritchInvocationIds ?? []);
  sheet.eldritchInvocationSources = clone(next.eldritchInvocationSources ?? {});
  sheet.mysticArcanumSpellIds = clone(next.mysticArcanumSpellIds ?? {});
  sheet.mysticArcanumSources = clone(next.mysticArcanumSources ?? {});
  sheet.pactMagicSlotLevel = next.pactMagicSlotLevel ?? 0;
  sheet.pactMagicSlotMaximum = next.pactMagicSlotMaximum ?? 0;
  sheet.spellSlotMaximums = clone(next.spellSlotMaximums ?? {});
  sheet.features = next.features.map((feature) => state.catalog.find((entry) => entry.id === feature)?.nameKo ?? feature);
  const primary = sheet.classLevels[0];
  if (primary?.subclassName) sheet.subclassName = primary.subclassName;
  ensureSorceryPointResource(sheet);
}

function syncCommittedSheetToScene(state: AdapterState) {
  const entity = state.scene.entities.find((entry) => entry.id === state.activeCharacter.id);
  if (!entity) return;
  entity.hp = state.activeCharacter.hp;
  entity.maxHp = state.activeCharacter.maxHp;
  entity.tempHp = state.activeCharacter.tempHp;
  entity.ac = state.activeCharacter.ac;
}

const oldGetSnapshot = MockAdapter.prototype.getSnapshot;
const oldStartLevelUp = MockAdapter.prototype.startLevelUp;
const oldUpdateLevelUp = MockAdapter.prototype.updateLevelUp;

MockAdapter.prototype.getSnapshot = async function getSnapshotWithProgression() {
  const internal = this as unknown as AdapterState;
  ensureProgressionMetadata(internal.activeCharacter);
  const snapshot = await oldGetSnapshot.call(this);
  ensureProgressionMetadata(snapshot.activeCharacter);
  if (snapshot.levelUpDraft && internal.levelUpDraft) {
    const plan = planFor(internal);
    if (plan) {
      syncLegacyDraft(internal.levelUpDraft, plan);
      snapshot.levelUpDraft = clone(internal.levelUpDraft);
      snapshot.progressionPlan = clone(plan);
    }
  } else snapshot.progressionPlan = null;
  return snapshot;
};

MockAdapter.prototype.startLevelUp = async function startLevelUpPhase07(characterId) {
  const internal = this as unknown as AdapterState;
  ensureProgressionMetadata(internal.activeCharacter);
  await oldStartLevelUp.call(this, characterId);
  if (internal.levelUpDraft) {
    internal.levelUpDraft.step = 4;
    internal.levelUpDraft.targetClassId = internal.activeCharacter.classLevels?.[0]?.classId ?? primaryClass(internal.activeCharacter)?.id;
    internal.levelUpDraft.progressionSelections = {};
    internal.levelUpDraft.hpMethod = "fixed";
    internal.levelUpDraft.hpRoll = undefined;
    const plan = planFor(internal);
    if (plan) syncLegacyDraft(internal.levelUpDraft, plan);
  }
  return internal.getSnapshot();
};

MockAdapter.prototype.updateLevelUp = async function updateLevelUpPhase07(command: LevelUpCommand) {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) await this.startLevelUp(internal.activeCharacter.id);
  const draft = internal.levelUpDraft;
  if (!draft) return internal.getSnapshot();
  if (command.type === "set-step") draft.step = Number(command.value);
  else if (command.type === "set-hp-method") draft.hpMethod = String(command.value) as "fixed" | "roll";
  else return oldUpdateLevelUp.call(this, command);
  const plan = planFor(internal);
  if (plan) syncLegacyDraft(draft, plan);
  return internal.getSnapshot();
};

(MockAdapter.prototype as unknown as Phase07AdapterCommands).setProgressionTargetClass = async function setProgressionTargetClass(classId: string) {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) await (this as unknown as MockAdapter).startLevelUp(internal.activeCharacter.id);
  if (!internal.levelUpDraft) return internal.getSnapshot();
  internal.levelUpDraft.targetClassId = classId;
  internal.levelUpDraft.progressionSelections = {};
  internal.levelUpDraft.hpRoll = undefined;
  const plan = planFor(internal);
  if (plan) syncLegacyDraft(internal.levelUpDraft, plan);
  return internal.getSnapshot();
};

(MockAdapter.prototype as unknown as Phase07AdapterCommands).setProgressionChoice = async function setProgressionChoice(choiceId: string, value: ChoiceSelectionValue) {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) await (this as unknown as MockAdapter).startLevelUp(internal.activeCharacter.id);
  if (!internal.levelUpDraft) return internal.getSnapshot();
  internal.levelUpDraft.progressionSelections ??= {} as ChoiceSelectionMap;
  internal.levelUpDraft.progressionSelections[choiceId] = clone(value);
  const plan = planFor(internal);
  if (plan) syncLegacyDraft(internal.levelUpDraft, plan);
  return internal.getSnapshot();
};

(MockAdapter.prototype as unknown as Phase07AdapterCommands).setProgressionHp = async function setProgressionHp(method: "fixed" | "roll", roll?: number) {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) await (this as unknown as MockAdapter).startLevelUp(internal.activeCharacter.id);
  if (!internal.levelUpDraft) return internal.getSnapshot();
  internal.levelUpDraft.hpMethod = method;
  internal.levelUpDraft.hpRoll = method === "roll" ? roll : undefined;
  const plan = planFor(internal);
  if (plan) syncLegacyDraft(internal.levelUpDraft, plan);
  return internal.getSnapshot();
};

MockAdapter.prototype.commitLevelUp = async function commitLevelUpPhase07() {
  const internal = this as unknown as AdapterState;
  if (!internal.levelUpDraft) return internal.getSnapshot();
  const before = clone(internal.activeCharacter);
  const stateBefore = characterState(internal.activeCharacter);
  const request = requestFor(internal);
  const result = resolveProgression(stateBefore, request);
  if (result.status === "rejected") {
    syncLegacyDraft(internal.levelUpDraft, result.plan);
    return internal.getSnapshot();
  }
  if (internal.edgeState === "save-error") {
    internal.levelUpDraft.validation = [...internal.levelUpDraft.validation, { severity:"blocking", message:"Character Revision 저장에 실패했습니다. 원본은 변경되지 않았습니다." }];
    return internal.getSnapshot();
  }
  applyCommittedSheet(internal.activeCharacter, result, internal);
  syncCommittedSheetToScene(internal);
  internal.syncChar();
  internal.characters = internal.characters.map((summary) => summary.id === internal.activeCharacter.id ? summaryFromSheet(internal.activeCharacter) : summary);
  internal.activity.unshift({
    id:`progression.${Date.now()}`,
    time:"지금",
    actor:internal.activeCharacter.name,
    title:`레벨 업 ${result.plan.fromTotalLevel} → ${result.plan.toTotalLevel}`,
    summary:`${result.plan.targetClassName} ${result.plan.targetClassLevel}레벨 · HP ${before.maxHp} → ${internal.activeCharacter.maxHp}`,
    detail:result.plan.diffs.map((diff) => `${diff.label}: ${diff.before} → ${diff.after} (${diff.source})`),
    stateChanges:["Phase 08 Progression transaction → Character Revision", `progressionRevision ${stateBefore.revision} → ${result.state.revision}`],
  });
  internal.levelUpDraft = null;
  return internal.getSnapshot();
};