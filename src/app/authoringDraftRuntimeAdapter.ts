import "./characterLibraryRuntimeAdapter";
import "./authoringDraftContracts";
import "./persistenceRuntimeContracts";
import type {
  AppSnapshot,
  CharacterCreateDraft,
  CharacterSheet,
  CharacterSummary,
  LevelUpCommand,
  LevelUpDraft,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import {
  AuthoringDraftRepository,
  projectCreationDraftIntentV1,
  projectProgressionDraftIntentV1,
} from "./authoringDraftPersistence";
import type {
  AuthoringDraftStore,
  CreationDraftIntentV1,
  ProgressionDraftIntentV1,
} from "./authoringDraftContracts";
import { createPlatformAuthoringDraftStore } from "./tauriAuthoringDraftStore";
import type { Phase07AdapterCommands } from "./progressionRuntimeAdapter";
import type { ChoiceSelectionValue } from "../domain/choiceDefinition";

const cp = <T,>(value:T):T => structuredClone(value);

type AdapterState = {
  characters:CharacterSummary[];
  activeCharacter:CharacterSheet;
  createDraft:CharacterCreateDraft|null;
  levelUpDraft:LevelUpDraft|null;
};

type AuthoringPersistenceVm = {
  durability:"durable"|"volatile";
  status:"ready"|"recovered"|"error"|"stale";
  storageRevision:number;
  message?:string;
};

type Context = {
  repository:AuthoringDraftRepository;
  hydration:Promise<void>|null;
  hydrated:boolean;
  vm:AuthoringPersistenceVm;
  creationBaseCharacterIds:string[]|null;
  creationEditingBaseSourceRevision:number|undefined;
  progressionBaseSourceRevision:number|undefined;
};

const injectedStores = new WeakMap<MockAdapter,AuthoringDraftStore>();
const contexts = new WeakMap<MockAdapter,Context>();
const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

function stateOf(adapter:MockAdapter) {
  return adapter as unknown as AdapterState;
}

function sourceRevision(sheet:CharacterSheet) {
  return Number.isInteger(sheet.sourceRevision) && Number(sheet.sourceRevision) >= 1
    ? Number(sheet.sourceRevision)
    : 1;
}

function characterIds(state:AdapterState) {
  return [...new Set(state.characters.map((character) => character.id).concat(state.activeCharacter.id))].sort();
}

function sameStrings(a:string[],b:string[]) {
  return a.length === b.length && a.every((value,index) => value === b[index]);
}

function contextFor(adapter:MockAdapter):Context {
  const existing = contexts.get(adapter);
  if (existing) return existing;
  const store = injectedStores.get(adapter) ?? createPlatformAuthoringDraftStore();
  const context:Context = {
    repository:new AuthoringDraftRepository(store),
    hydration:null,
    hydrated:false,
    vm:{durability:store.durability,status:"ready",storageRevision:0},
    creationBaseCharacterIds:null,
    creationEditingBaseSourceRevision:undefined,
    progressionBaseSourceRevision:undefined,
  };
  contexts.set(adapter,context);
  return context;
}

function materializeCreation(intent:CreationDraftIntentV1):CharacterCreateDraft {
  return cp({
    id:intent.draftId,
    editingCharacterId:intent.editingCharacterId,
    step:intent.step,
    activeSectionId:intent.activeSectionId,
    mode:intent.mode,
    rulesProfileId:intent.rulesProfileId,
    name:intent.name,
    className:intent.className,
    subclassName:intent.subclassName,
    species:intent.species,
    background:intent.background,
    level:intent.level,
    abilityMethod:intent.abilityMethod,
    abilities:intent.abilities,
    rolledPool:intent.rolledPool,
    rolledAssignments:intent.rolledAssignments,
    selectedSkills:intent.selectedSkills,
    selectedSpells:intent.selectedSpells,
    selectedClassChoices:intent.selectedClassChoices,
    equipmentPreset:intent.equipmentPreset,
    backgroundEquipmentPreset:intent.backgroundEquipmentPreset,
    notes:intent.notes,
    overrides:intent.overrides,
    choiceSelections:intent.choiceSelections,
    derived:{proficiencyBonus:0,ac:0,hp:0,speed:0},
    validation:[],
  });
}

function materializeProgression(intent:ProgressionDraftIntentV1,sheet:CharacterSheet):LevelUpDraft {
  const abilities = cp(sheet.abilities);
  return {
    characterId:intent.characterId,
    fromLevel:sheet.level,
    toLevel:sheet.level + 1,
    step:intent.step,
    hpMethod:intent.hpMethod,
    hpRoll:intent.hpRoll,
    hpGain:0,
    asiMode:"plus-two",
    asiPrimary:"str",
    asiSecondary:"dex",
    targetClassId:intent.targetClassId,
    progressionSelections:cp(intent.progressionSelections),
    preview:{
      maxHpBefore:sheet.maxHp,
      maxHpAfter:sheet.maxHp,
      abilityBefore:abilities,
      abilityAfter:cp(abilities),
      proficiencyBefore:sheet.proficiencyBonus,
      proficiencyAfter:sheet.proficiencyBonus,
      hitDiceBefore:"—",
      hitDiceAfter:"—",
      grantedFeatures:[],
      resourceChanges:[],
      actionChanges:[],
      spellChanges:[],
      diffs:[],
    },
    validation:[],
  };
}

function creationStaleReason(state:AdapterState,intent:CreationDraftIntentV1) {
  if (!sameStrings(characterIds(state),[...intent.baseCharacterIds].sort())) {
    return "저장된 캐릭터 생성/편집 draft의 기준 Character library가 변경되었습니다.";
  }
  if (!intent.editingCharacterId) return null;
  if (state.activeCharacter.id !== intent.editingCharacterId) {
    return `편집 draft 대상 ${intent.editingCharacterId}가 현재 활성 Character와 일치하지 않습니다.`;
  }
  if (sourceRevision(state.activeCharacter) !== intent.editingBaseSourceRevision) {
    return `편집 draft의 기준 source revision ${intent.editingBaseSourceRevision ?? "—"}이 현재 ${sourceRevision(state.activeCharacter)}와 일치하지 않습니다.`;
  }
  return null;
}

function progressionStaleReason(state:AdapterState,intent:ProgressionDraftIntentV1) {
  if (state.activeCharacter.id !== intent.characterId) {
    return `레벨업 draft 대상 ${intent.characterId}가 현재 활성 Character와 일치하지 않습니다.`;
  }
  if (sourceRevision(state.activeCharacter) !== intent.baseSourceRevision) {
    return `레벨업 draft의 기준 source revision ${intent.baseSourceRevision}이 현재 ${sourceRevision(state.activeCharacter)}와 일치하지 않습니다.`;
  }
  return null;
}

function applyRecoveredDrafts(state:AdapterState,context:Context,creation:CreationDraftIntentV1|null,progression:ProgressionDraftIntentV1|null) {
  const stale:string[] = [];
  if (creation) {
    const reason = creationStaleReason(state,creation);
    if (reason) stale.push(reason);
    else {
      state.createDraft = materializeCreation(creation);
      context.creationBaseCharacterIds = [...creation.baseCharacterIds].sort();
      context.creationEditingBaseSourceRevision = creation.editingBaseSourceRevision;
    }
  }
  if (progression) {
    const reason = progressionStaleReason(state,progression);
    if (reason) stale.push(reason);
    else {
      state.levelUpDraft = materializeProgression(progression,state.activeCharacter);
      context.progressionBaseSourceRevision = progression.baseSourceRevision;
    }
  }
  return stale;
}

async function ensureHydrated(adapter:MockAdapter) {
  const context = contextFor(adapter);
  if (context.hydrated) return;
  if (context.hydration) return context.hydration;
  context.hydration = (async () => {
    // Character library hydration and all previously installed normalization run first.
    await oldGetSnapshot.call(adapter);
    const state = stateOf(adapter);
    try {
      const hydration = await context.repository.hydrate();
      const stale = applyRecoveredDrafts(state,context,hydration.document.creation,hydration.document.progression);
      context.vm = {
        durability:context.repository.durability,
        status:stale.length ? "stale" : hydration.recoveredFromOlderGeneration ? "recovered" : "ready",
        storageRevision:hydration.document.storageRevision,
        message:stale.length
          ? stale.join(" ")
          : hydration.recoveredFromOlderGeneration
            ? `최신 authoring draft generation을 읽지 못해 generation ${hydration.loadedGeneration ?? "—"}에서 복구했습니다.`
            : undefined,
      };
      context.hydrated = true;
    } catch (error) {
      context.vm = {
        durability:context.repository.durability,
        status:"error",
        storageRevision:context.repository.snapshot()?.storageRevision ?? 0,
        message:error instanceof Error ? error.message : String(error),
      };
      throw error;
    }
  })().finally(() => { context.hydration = null; });
  return context.hydration;
}

function ensureCreationBaseline(state:AdapterState,context:Context) {
  context.creationBaseCharacterIds ??= characterIds(state);
  if (state.createDraft?.editingCharacterId && context.creationEditingBaseSourceRevision === undefined) {
    context.creationEditingBaseSourceRevision = sourceRevision(state.activeCharacter);
  }
}

function ensureProgressionBaseline(state:AdapterState,context:Context) {
  if (context.progressionBaseSourceRevision === undefined) {
    context.progressionBaseSourceRevision = sourceRevision(state.activeCharacter);
  }
}

async function commitDraftUpdate(
  adapter:MockAdapter,
  update:{creation?:CreationDraftIntentV1|null;progression?:ProgressionDraftIntentV1|null},
) {
  const context = contextFor(adapter);
  try {
    const hydration = await context.repository.commit(update);
    context.vm = {
      durability:context.repository.durability,
      status:"ready",
      storageRevision:hydration.document.storageRevision,
    };
    return true;
  } catch (error) {
    context.vm = {
      durability:context.repository.durability,
      status:"error",
      storageRevision:context.repository.snapshot()?.storageRevision ?? 0,
      message:error instanceof Error ? error.message : String(error),
    };
    return false;
  }
}

async function saveCreationDraft(adapter:MockAdapter) {
  const state = stateOf(adapter);
  const context = contextFor(adapter);
  if (!state.createDraft) return;
  ensureCreationBaseline(state,context);
  await commitDraftUpdate(adapter,{
    creation:projectCreationDraftIntentV1(state.createDraft,{
      editingBaseSourceRevision:context.creationEditingBaseSourceRevision,
      baseCharacterIds:context.creationBaseCharacterIds ?? characterIds(state),
    }),
  });
}

async function saveProgressionDraft(adapter:MockAdapter) {
  const state = stateOf(adapter);
  const context = contextFor(adapter);
  if (!state.levelUpDraft) return;
  ensureProgressionBaseline(state,context);
  await commitDraftUpdate(adapter,{
    progression:projectProgressionDraftIntentV1(
      state.levelUpDraft,
      context.progressionBaseSourceRevision ?? sourceRevision(state.activeCharacter),
    ),
  });
}

MockAdapter.prototype.getSnapshot = async function getSnapshotWithAuthoringDrafts() {
  await ensureHydrated(this);
  const snapshot = await oldGetSnapshot.call(this);
  if (snapshot.persistence) snapshot.persistence.authoringDrafts = cp(contextFor(this).vm);
  return snapshot;
};

const oldCreateCharacterDraft = MockAdapter.prototype.createCharacterDraft;
MockAdapter.prototype.createCharacterDraft = async function createCharacterDraftWithAutosave(mode) {
  await ensureHydrated(this);
  const state = stateOf(this);
  const context = contextFor(this);
  context.creationBaseCharacterIds = characterIds(state);
  context.creationEditingBaseSourceRevision = undefined;
  await oldCreateCharacterDraft.call(this,mode);
  await saveCreationDraft(this);
  return this.getSnapshot();
};

const oldEditCharacterDraft = MockAdapter.prototype.editCharacterDraft;
MockAdapter.prototype.editCharacterDraft = async function editCharacterDraftWithAutosave(characterId) {
  await ensureHydrated(this);
  const state = stateOf(this);
  const context = contextFor(this);
  context.creationBaseCharacterIds = characterIds(state);
  context.creationEditingBaseSourceRevision = state.activeCharacter.id === characterId
    ? sourceRevision(state.activeCharacter)
    : undefined;
  await oldEditCharacterDraft.call(this,characterId);
  await saveCreationDraft(this);
  return this.getSnapshot();
};

const oldUpdateCharacterDraft = MockAdapter.prototype.updateCharacterDraft;
MockAdapter.prototype.updateCharacterDraft = async function updateCharacterDraftWithAutosave(command) {
  await ensureHydrated(this);
  await oldUpdateCharacterDraft.call(this,command);
  await saveCreationDraft(this);
  return this.getSnapshot();
};

const oldStartLevelUp = MockAdapter.prototype.startLevelUp;
MockAdapter.prototype.startLevelUp = async function startLevelUpWithAutosave(characterId) {
  await ensureHydrated(this);
  const state = stateOf(this);
  const context = contextFor(this);
  context.progressionBaseSourceRevision = sourceRevision(state.activeCharacter);
  await oldStartLevelUp.call(this,characterId);
  await saveProgressionDraft(this);
  return this.getSnapshot();
};

const oldUpdateLevelUp = MockAdapter.prototype.updateLevelUp;
MockAdapter.prototype.updateLevelUp = async function updateLevelUpWithAutosave(command:LevelUpCommand) {
  await ensureHydrated(this);
  await oldUpdateLevelUp.call(this,command);
  await saveProgressionDraft(this);
  return this.getSnapshot();
};

const phase07 = MockAdapter.prototype as unknown as Phase07AdapterCommands;
const oldSetProgressionTargetClass = phase07.setProgressionTargetClass;
phase07.setProgressionTargetClass = async function setProgressionTargetClassWithAutosave(classId:string) {
  const adapter = this as unknown as MockAdapter;
  await ensureHydrated(adapter);
  await oldSetProgressionTargetClass.call(this,classId);
  await saveProgressionDraft(adapter);
  return adapter.getSnapshot();
};

const oldSetProgressionChoice = phase07.setProgressionChoice;
phase07.setProgressionChoice = async function setProgressionChoiceWithAutosave(choiceId:string,value:ChoiceSelectionValue) {
  const adapter = this as unknown as MockAdapter;
  await ensureHydrated(adapter);
  await oldSetProgressionChoice.call(this,choiceId,value);
  await saveProgressionDraft(adapter);
  return adapter.getSnapshot();
};

const oldSetProgressionHp = phase07.setProgressionHp;
phase07.setProgressionHp = async function setProgressionHpWithAutosave(method:"fixed"|"roll",roll?:number) {
  const adapter = this as unknown as MockAdapter;
  await ensureHydrated(adapter);
  await oldSetProgressionHp.call(this,method,roll);
  await saveProgressionDraft(adapter);
  return adapter.getSnapshot();
};

const oldFinalizeCharacterDraft = MockAdapter.prototype.finalizeCharacterDraft;
MockAdapter.prototype.finalizeCharacterDraft = async function finalizeCharacterDraftWithDraftClear() {
  await ensureHydrated(this);
  await oldFinalizeCharacterDraft.call(this);
  const state = stateOf(this);
  const context = contextFor(this);
  if (!state.createDraft) {
    await commitDraftUpdate(this,{creation:null});
    context.creationBaseCharacterIds = null;
    context.creationEditingBaseSourceRevision = undefined;
  }
  return this.getSnapshot();
};

const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;
MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithDraftClear() {
  await ensureHydrated(this);
  await oldCommitLevelUp.call(this);
  const state = stateOf(this);
  const context = contextFor(this);
  if (!state.levelUpDraft) {
    await commitDraftUpdate(this,{progression:null});
    context.progressionBaseSourceRevision = undefined;
  }
  return this.getSnapshot();
};

export function setAuthoringDraftStoreForTests(adapter:MockAdapter,store:AuthoringDraftStore) {
  injectedStores.set(adapter,store);
  contexts.delete(adapter);
}

export function getAuthoringDraftPersistenceStateForTests(adapter:MockAdapter) {
  const context = contexts.get(adapter);
  return context ? { ...cp(context.vm),document:context.repository.snapshot() } : null;
}
