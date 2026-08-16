import "./characterCreationV10Adapter";
import "./progressionRuntimeAdapter";
import "./restSpellManagementRuntimeAdapter";
import "./persistenceRuntimeContracts";
import type {
  ActivityEntry,
  AppSnapshot,
  CharacterCreateDraft,
  CharacterSheet,
  CharacterSummary,
  LevelUpDraft,
  SceneVm,
} from "./contracts";
import { MockAdapter } from "./mockAdapter";
import { CharacterLibraryRepository, projectCharacterRuntimeDurableV1, projectCharacterSourceV1 } from "./characterLibraryPersistence";
import type { CharacterLibraryStore } from "./persistenceContracts";
import { createPlatformCharacterLibraryStore } from "./tauriCharacterLibraryStore";
import type { PactTomeRestSpellCommand, WizardLongRestSpellCommand } from "./restSpellManagementContracts";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";

const cp = <T,>(value:T):T => structuredClone(value);

type AdapterState = {
  characters:CharacterSummary[];
  activeCharacter:CharacterSheet;
  createDraft:CharacterCreateDraft|null;
  levelUpDraft:LevelUpDraft|null;
  activity:ActivityEntry[];
  scene:SceneVm;
};

type PersistenceVm = NonNullable<AppSnapshot["persistence"]>;

type PersistenceContext = {
  repository:CharacterLibraryRepository;
  hydration:Promise<void>|null;
  hydrated:boolean;
  vm:PersistenceVm;
};

type CapturedState = {
  characters:CharacterSummary[];
  activeCharacter:CharacterSheet;
  createDraft:CharacterCreateDraft|null;
  levelUpDraft:LevelUpDraft|null;
  activity:ActivityEntry[];
  scene:SceneVm;
};

const injectedStores = new WeakMap<MockAdapter,CharacterLibraryStore>();
const contexts = new WeakMap<MockAdapter,PersistenceContext>();
const oldGetSnapshot = MockAdapter.prototype.getSnapshot;

function isCharacterSheet(value:CharacterSummary):value is CharacterSheet {
  const candidate = value as CharacterSummary & Partial<CharacterSheet>;
  return Boolean(
    candidate.abilities &&
    Array.isArray(candidate.items) &&
    Array.isArray(candidate.resources) &&
    Array.isArray(candidate.attacks) &&
    typeof candidate.proficiencyBonus === "number",
  );
}

function stateOf(adapter:MockAdapter) {
  return adapter as unknown as AdapterState;
}

function collectPersistableSheets(state:AdapterState):CharacterSheet[] {
  const byId = new Map<string,CharacterSheet>();
  for (const character of state.characters) {
    if (isCharacterSheet(character)) byId.set(character.id,character);
  }
  byId.set(state.activeCharacter.id,state.activeCharacter);
  return [...byId.values()].sort((a,b) => a.id.localeCompare(b.id));
}

function durableFingerprint(state:AdapterState) {
  return JSON.stringify({
    activeCharacterId:state.activeCharacter.id,
    characters:collectPersistableSheets(state).map((sheet) => ({
      id:sheet.id,
      source:projectCharacterSourceV1(sheet),
      runtime:projectCharacterRuntimeDurableV1(sheet),
    })),
  });
}

function contextFor(adapter:MockAdapter):PersistenceContext {
  const existing = contexts.get(adapter);
  if (existing) return existing;
  const store = injectedStores.get(adapter) ?? createPlatformCharacterLibraryStore();
  const context:PersistenceContext = {
    repository:new CharacterLibraryRepository(store),
    hydration:null,
    hydrated:false,
    vm:{ durability:store.durability,status:"ready",storageRevision:0 },
  };
  contexts.set(adapter,context);
  return context;
}

function projectActiveCharacterToScene(state:AdapterState) {
  const entity = state.scene.entities.find((entry) => entry.id === state.activeCharacter.id);
  if (!entity) return;
  entity.hp = state.activeCharacter.hp;
  entity.maxHp = state.activeCharacter.maxHp;
  entity.tempHp = state.activeCharacter.tempHp;
  entity.ac = state.activeCharacter.ac;
}

function applyHydration(state:AdapterState, sheets:CharacterSheet[], activeCharacterId:string|null) {
  const persistedIds = new Set(sheets.map((sheet) => sheet.id));
  state.characters = [
    ...state.characters.filter((character) => !persistedIds.has(character.id)),
    ...sheets.map(cp),
  ];
  const active = sheets.find((sheet) => sheet.id === activeCharacterId)
    ?? sheets.find((sheet) => sheet.id === state.activeCharacter.id);
  if (active) state.activeCharacter = cp(active);
  projectActiveCharacterToScene(state);
}

async function ensureHydrated(adapter:MockAdapter) {
  const context = contextFor(adapter);
  if (context.hydrated) return;
  if (context.hydration) return context.hydration;
  context.hydration = (async () => {
    const state = stateOf(adapter);
    // Let the already-installed application adapters normalize the built-in Character once.
    // Persisted state is applied only after that normalization, so no default projection can overwrite it.
    await oldGetSnapshot.call(adapter);
    try {
      const hydration = await context.repository.hydrate(collectPersistableSheets(state),state.activeCharacter.id);
      applyHydration(state,hydration.sheets,hydration.activeCharacterId);
      context.vm = {
        durability:context.repository.durability,
        status:hydration.recoveredFromOlderGeneration ? "recovered" : "ready",
        storageRevision:hydration.document.storageRevision,
        message:hydration.recoveredFromOlderGeneration
          ? `최신 Character library generation을 읽지 못해 generation ${hydration.loadedGeneration ?? "—"}에서 복구했습니다.`
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

function capture(state:AdapterState):CapturedState {
  return cp({
    characters:state.characters,
    activeCharacter:state.activeCharacter,
    createDraft:state.createDraft,
    levelUpDraft:state.levelUpDraft,
    activity:state.activity,
    scene:state.scene,
  });
}

function restore(state:AdapterState,before:CapturedState) {
  state.characters = cp(before.characters);
  state.activeCharacter = cp(before.activeCharacter);
  state.createDraft = cp(before.createDraft);
  state.levelUpDraft = cp(before.levelUpDraft);
  state.activity = cp(before.activity);
  state.scene = cp(before.scene);
}

function addSaveError(state:AdapterState,draft:"creation"|"progression"|undefined,message:string) {
  const validation = { severity:"blocking" as const, message:`Character library 저장 실패: ${message}` };
  if (draft === "creation" && state.createDraft) {
    if (!state.createDraft.validation.some((item) => item.message === validation.message)) {
      state.createDraft.validation = [...state.createDraft.validation,validation];
    }
  }
  if (draft === "progression" && state.levelUpDraft) {
    if (!state.levelUpDraft.validation.some((item) => item.message === validation.message)) {
      state.levelUpDraft.validation = [...state.levelUpDraft.validation,validation];
    }
  }
}

function preserveOperationProjection(snapshot:AppSnapshot,operationResult:AppSnapshot,persistenceFailed=false) {
  if (operationResult.restSpellManagement) {
    snapshot.restSpellManagement = persistenceFailed
      ? { ...operationResult.restSpellManagement,status:"rejected",message:"Character library 저장에 실패하여 변경을 롤백했습니다." }
      : cp(operationResult.restSpellManagement);
  }
  if (operationResult.circleLandRestConfiguration) {
    snapshot.circleLandRestConfiguration = cp(operationResult.circleLandRestConfiguration);
  }
  return snapshot;
}

async function durableMutation(
  adapter:MockAdapter,
  operation:()=>Promise<AppSnapshot>,
  draft?:"creation"|"progression",
) {
  await ensureHydrated(adapter);
  const state = stateOf(adapter);
  const context = contextFor(adapter);
  const before = capture(state);
  const fingerprintBefore = durableFingerprint(state);
  let operationResult:AppSnapshot;
  try {
    operationResult = await operation();
  } catch (error) {
    restore(state,before);
    throw error;
  }
  if (fingerprintBefore === durableFingerprint(state)) return operationResult;

  try {
    const hydration = await context.repository.commit(collectPersistableSheets(state),state.activeCharacter.id);
    applyHydration(state,hydration.sheets,hydration.activeCharacterId);
    context.vm = {
      durability:context.repository.durability,
      status:"ready",
      storageRevision:hydration.document.storageRevision,
    };
    const snapshot = await adapter.getSnapshot();
    return preserveOperationProjection(snapshot,operationResult,false);
  } catch (error) {
    restore(state,before);
    const message = error instanceof Error ? error.message : String(error);
    addSaveError(state,draft,message);
    context.vm = {
      durability:context.repository.durability,
      status:"error",
      storageRevision:context.repository.snapshot()?.storageRevision ?? 0,
      message,
    };
    const snapshot = await adapter.getSnapshot();
    return preserveOperationProjection(snapshot,operationResult,true);
  }
}

MockAdapter.prototype.getSnapshot = async function getSnapshotWithCharacterLibrary() {
  await ensureHydrated(this);
  const snapshot = await oldGetSnapshot.call(this);
  snapshot.persistence = cp(contextFor(this).vm);
  return snapshot;
};

const oldFinalizeCharacterDraft = MockAdapter.prototype.finalizeCharacterDraft;
MockAdapter.prototype.finalizeCharacterDraft = async function finalizeCharacterDraftWithPersistence() {
  return durableMutation(this,() => oldFinalizeCharacterDraft.call(this),"creation");
};

const oldCommitLevelUp = MockAdapter.prototype.commitLevelUp;
MockAdapter.prototype.commitLevelUp = async function commitLevelUpWithPersistence() {
  return durableMutation(this,() => oldCommitLevelUp.call(this),"progression");
};

const oldToggleItemEquipped = MockAdapter.prototype.toggleItemEquipped;
MockAdapter.prototype.toggleItemEquipped = async function toggleItemEquippedWithPersistence(id:string) {
  return durableMutation(this,() => oldToggleItemEquipped.call(this,id));
};

const oldToggleItemAttunement = MockAdapter.prototype.toggleItemAttunement;
MockAdapter.prototype.toggleItemAttunement = async function toggleItemAttunementWithPersistence(id:string) {
  return durableMutation(this,() => oldToggleItemAttunement.call(this,id));
};

const oldUseItem = MockAdapter.prototype.useItem;
MockAdapter.prototype.useItem = async function useItemWithPersistence(id:string) {
  return durableMutation(this,() => oldUseItem.call(this,id));
};

const oldConfigureWizardLongRest = MockAdapter.prototype.configureWizardLongRest;
MockAdapter.prototype.configureWizardLongRest = async function configureWizardLongRestWithPersistence(command:WizardLongRestSpellCommand) {
  return durableMutation(this,() => oldConfigureWizardLongRest.call(this,command));
};

const oldConfigurePactTomeRest = MockAdapter.prototype.configurePactTomeRest;
MockAdapter.prototype.configurePactTomeRest = async function configurePactTomeRestWithPersistence(command:PactTomeRestSpellCommand) {
  return durableMutation(this,() => oldConfigurePactTomeRest.call(this,command));
};

const oldConfigureCircleLandRest = MockAdapter.prototype.configureCircleLandRest;
MockAdapter.prototype.configureCircleLandRest = async function configureCircleLandRestWithPersistence(landType:CircleLandType) {
  return durableMutation(this,() => oldConfigureCircleLandRest.call(this,landType));
};

export function setCharacterLibraryStoreForTests(adapter:MockAdapter,store:CharacterLibraryStore) {
  injectedStores.set(adapter,store);
  contexts.delete(adapter);
}

export function getCharacterLibraryPersistenceStateForTests(adapter:MockAdapter) {
  const context = contexts.get(adapter);
  return context ? { ...cp(context.vm),document:context.repository.snapshot() } : null;
}
