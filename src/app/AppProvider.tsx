import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AdjudicationScope,
  AppRole,
  AppSnapshot,
  CharacterCreateDraft,
  CharacterDraftCommand,
  ConnectionState,
  DmAdjudicationCommand,
  EdgeState,
  LevelUpCommand,
  SessionMode,
} from "./contracts";
import type { ManualMovementReactionCommand } from "./manualMovementReactionContracts";
import type { PactTomeRestSpellCommand, WizardLongRestSpellCommand } from "./restSpellManagementContracts";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import "./restSpellManagementRuntimeAdapter";
import "./phase09ConcentrationSaveAdapter";
import { mockAdapter } from "./mockAdapter";
import { subscribeExternalAdapterSnapshot } from "./adapterSnapshotEvents";

export interface UiDebugState {
  selectedActionId: string | null;
  eligibleTargetIds: string[];
  selectedTargetIds: string[];
  hoverTargetId: string | null;
}

interface AppContextValue {
  snapshot: AppSnapshot | null;
  loading: boolean;
  uiDebug: UiDebugState;
  setUiDebug(patch: Partial<UiDebugState>): void;
  refresh(): Promise<void>;
  createCharacterDraft(mode?: CharacterCreateDraft["mode"]): Promise<void>;
  editCharacterDraft(characterId: string): Promise<void>;
  updateCharacterDraft(command: CharacterDraftCommand): Promise<void>;
  finalizeCharacterDraft(): Promise<void>;
  toggleItemEquipped(itemId: string): Promise<void>;
  toggleItemAttunement(itemId: string): Promise<void>;
  useItem(itemId: string): Promise<void>;
  startLevelUp(characterId: string): Promise<void>;
  updateLevelUp(command: LevelUpCommand): Promise<void>;
  commitLevelUp(): Promise<void>;
  configureWizardLongRest(command: WizardLongRestSpellCommand): Promise<void>;
  configurePactTomeRest(command: PactTomeRestSpellCommand): Promise<void>;
  configureCircleLandRest(landType: CircleLandType): Promise<void>;
  selectDmActor(actorId: string): Promise<void>;
  startInitiative(): Promise<void>;
  endInitiative(): Promise<void>;
  endTurn(): Promise<void>;
  declareManualMovementReaction(command:ManualMovementReactionCommand):Promise<void>;
  resolveAction(actionId: string, targetIds: string[]): Promise<void>;
  advanceResolution(): Promise<void>;
  submitConcentrationSaveD20(face:number):Promise<void>;
  respondToInterrupt(accept: boolean): Promise<void>;
  dismissResolution(): Promise<void>;
  applyDmAdjudication(command: DmAdjudicationCommand): Promise<void>;
  undoLastResolution(): Promise<void>;
  previewContentImport(payload: string): Promise<void>;
  activateContentImport(): Promise<void>;
  clearContentImport(): Promise<void>;
  previewCombatantImport(payload: string): Promise<void>;
  activateCombatantImport(): Promise<void>;
  clearCombatantImport(): Promise<void>;
  instantiateCombatant(definitionId: string): Promise<void>;
  hostSession(): Promise<void>;
  joinSession(address: string): Promise<void>;
  debug: {
    setRole(role: AppRole): Promise<void>;
    setMode(mode: SessionMode): Promise<void>;
    setCurrentActor(actorId: string): Promise<void>;
    setQueuedD20(value: number | null): Promise<void>;
    setConnectionState(state: ConnectionState): Promise<void>;
    setEdgeState(state: EdgeState): Promise<void>;
    loadScenario(id: "attack" | "critical" | "reaction" | "multi-save" | "typed-damage"): Promise<void>;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

function isOptimisticTextCommand(command: CharacterDraftCommand) {
  return command.type === "set-name" || command.type === "set-notes";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiDebug, setUiDebugState] = useState<UiDebugState>({ selectedActionId: null, eligibleTargetIds: [], selectedTargetIds: [], hoverTargetId: null });
  const operationSequenceRef = useRef(0);

  const publishIfLatest = useCallback((sequence: number, next: AppSnapshot) => {
    if (sequence !== operationSequenceRef.current) return;
    setSnapshot(next);
  }, []);

  const apply = useCallback(async (operation: () => Promise<AppSnapshot>) => {
    const sequence = ++operationSequenceRef.current;
    const next = await operation();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);

  const refresh = useCallback(async () => {
    const sequence = ++operationSequenceRef.current;
    const next = await mockAdapter.getSnapshot();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);

  const updateCharacterDraft = useCallback(async (command: CharacterDraftCommand) => {
    if (!isOptimisticTextCommand(command)) {
      await apply(() => mockAdapter.updateCharacterDraft(command));
      return;
    }
    const sequence = ++operationSequenceRef.current;
    const value = String(command.value ?? "");
    setSnapshot((current) => {
      if (!current?.createDraft) return current;
      return {
        ...current,
        createDraft: {
          ...current.createDraft,
          ...(command.type === "set-name" ? { name: value } : { notes: value }),
        },
      };
    });
    const next = await mockAdapter.updateCharacterDraft(command);
    publishIfLatest(sequence, next);
  }, [apply, publishIfLatest]);

  const setUiDebug = useCallback((patch: Partial<UiDebugState>) => {
    setUiDebugState((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    return subscribeExternalAdapterSnapshot((next) => {
      const sequence = ++operationSequenceRef.current;
      publishIfLatest(sequence, next);
    });
  }, [publishIfLatest]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<AppContextValue>(() => ({
    snapshot,
    loading,
    uiDebug,
    setUiDebug,
    refresh,
    createCharacterDraft: async (mode) => apply(() => mockAdapter.createCharacterDraft(mode)),
    editCharacterDraft: async (characterId) => apply(() => mockAdapter.editCharacterDraft(characterId)),
    updateCharacterDraft,
    finalizeCharacterDraft: async () => apply(() => mockAdapter.finalizeCharacterDraft()),
    toggleItemEquipped: async (itemId) => apply(() => mockAdapter.toggleItemEquipped(itemId)),
    toggleItemAttunement: async (itemId) => apply(() => mockAdapter.toggleItemAttunement(itemId)),
    useItem: async (itemId) => apply(() => mockAdapter.useItem(itemId)),
    startLevelUp: async (characterId) => apply(() => mockAdapter.startLevelUp(characterId)),
    updateLevelUp: async (command) => apply(() => mockAdapter.updateLevelUp(command)),
    commitLevelUp: async () => apply(() => mockAdapter.commitLevelUp()),
    configureWizardLongRest: async (command) => apply(() => mockAdapter.configureWizardLongRest(command)),
    configurePactTomeRest: async (command) => apply(() => mockAdapter.configurePactTomeRest(command)),
    configureCircleLandRest: async (landType) => apply(() => mockAdapter.configureCircleLandRest(landType)),
    selectDmActor: async (actorId) => apply(() => mockAdapter.selectDmActor(actorId)),
    startInitiative: async () => apply(() => mockAdapter.startInitiative()),
    endInitiative: async () => apply(() => mockAdapter.endInitiative()),
    endTurn: async () => apply(() => mockAdapter.endTurn()),
    declareManualMovementReaction: async (command) => apply(() => mockAdapter.declareManualMovementReaction(command)),
    resolveAction: async (actionId, targetIds) => apply(() => mockAdapter.resolveAction(actionId, targetIds)),
    advanceResolution: async () => apply(() => mockAdapter.advanceResolution()),
    submitConcentrationSaveD20: async (face) => apply(() => mockAdapter.submitConcentrationSaveD20(face)),
    respondToInterrupt: async (accept) => apply(() => mockAdapter.respondToInterrupt(accept)),
    dismissResolution: async () => apply(() => mockAdapter.dismissResolution()),
    applyDmAdjudication: async (command) => apply(() => mockAdapter.applyDmAdjudication(command)),
    undoLastResolution: async () => apply(() => mockAdapter.undoLastResolution()),
    previewContentImport: async (payload) => apply(() => mockAdapter.previewContentImport(payload)),
    activateContentImport: async () => apply(() => mockAdapter.activateContentImport()),
    clearContentImport: async () => apply(() => mockAdapter.clearContentImport()),
    previewCombatantImport: async (payload) => apply(() => mockAdapter.previewCombatantImport(payload)),
    activateCombatantImport: async () => apply(() => mockAdapter.activateCombatantImport()),
    clearCombatantImport: async () => apply(() => mockAdapter.clearCombatantImport()),
    instantiateCombatant: async (definitionId) => apply(() => mockAdapter.instantiateCombatant(definitionId)),
    hostSession: async () => apply(() => mockAdapter.hostSession()),
    joinSession: async (address) => apply(() => mockAdapter.joinSession(address)),
    debug: {
      setRole: async (role) => apply(() => mockAdapter.setReferenceRole(role)),
      setMode: async (mode) => apply(() => mockAdapter.setSessionMode(mode)),
      setCurrentActor: async (actorId) => apply(() => mockAdapter.setCurrentActor(actorId)),
      setQueuedD20: async (value) => apply(() => mockAdapter.setQueuedD20(value)),
      setConnectionState: async (state) => apply(() => mockAdapter.setConnectionState(state)),
      setEdgeState: async (state) => apply(() => mockAdapter.setEdgeState(state)),
      loadScenario: async (id) => apply(() => mockAdapter.loadReferenceScenario(id)),
    },
  }), [snapshot, loading, uiDebug, setUiDebug, refresh, apply, updateCharacterDraft]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useSimpleVtt() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useSimpleVtt must be used inside AppProvider");
  return value;
}

export type { AdjudicationScope };
