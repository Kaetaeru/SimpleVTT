import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AdjudicationScope,
  AppRole,
  AppSnapshot,
  CharacterCreateDraft,
  CharacterDraftCommand,
  ConnectionState,
  DmInventoryAdjustmentCommand,
  DmAdjudicationCommand,
  EdgeState,
  LevelUpCommand,
  SessionMode,
} from "./contracts";
import type { ManualMovementReactionCommand } from "./manualMovementReactionContracts";
import type { PactTomeRestSpellCommand, WizardLongRestSpellCommand } from "./restSpellManagementContracts";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import type { CampaignCalendarDateTime, CampaignRosterMember, CampaignSessionSummary } from "./campaignPersistenceContracts";
import "./restSpellManagementRuntimeAdapter";
import "./phase09ConcentrationSaveAdapter";
import "./productionCombatantPreparationAdapter";
import "./campaignRuntimeAdapter";
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
  removeCombatant(combatantId: string): Promise<void>;
  adjustDmInventory(command:DmInventoryAdjustmentCommand):Promise<void>;
  undoLastDmInventoryAdjustment():Promise<void>;
  createCampaign(input:{campaignId:string;name:string;description?:string}):Promise<void>;
  openCampaign(campaignId:string):Promise<void>;
  updateCampaign(campaignId:string,payload:{name?:string;description?:string}):Promise<void>;
  archiveCampaign(campaignId:string):Promise<void>;
  restoreCampaign(campaignId:string):Promise<void>;
  configureCampaignSessionDefaults(campaignId:string,input:{sessionNameTemplate:string;startingMode:SessionMode;calendarEnabled:boolean;rationsEnabled:boolean;rationsVisibleToPlayers?:boolean}):Promise<void>;
  prepareCampaignSessionSnapshot(campaignId:string,input?:{sessionName?:string;startingMode?:SessionMode}):Promise<void>;
  upsertCampaignRosterMember(campaignId:string,member:CampaignRosterMember):Promise<void>;
  removeCampaignRosterMember(campaignId:string,rosterMemberId:string):Promise<void>;
  configureCampaignCalendar(campaignId:string,input:{enabled:boolean;providerId:string}):Promise<void>;
  advanceCampaignCalendar(campaignId:string,input:{deltaMinutes:number;note?:string}):Promise<void>;
  correctCampaignCalendar(campaignId:string,input:{absoluteMinute:number;note:string}):Promise<void>;
  correctCampaignCalendarDateTime(campaignId:string,input:{dateTime:CampaignCalendarDateTime;note:string}):Promise<void>;
  setCampaignCalendarNote(campaignId:string,note:string):Promise<void>;
  undoCampaignCalendar(campaignId:string):Promise<void>;
  configureCampaignRations(campaignId:string,input:{enabled:boolean;providerId:string}):Promise<void>;
  adjustCampaignRations(campaignId:string,input:{amount:number;note?:string}):Promise<void>;
  consumeCampaignDailyRations(campaignId:string,input?:{requiredUnits?:number;note?:string}):Promise<void>;
  undoCampaignRationConsumption(campaignId:string):Promise<void>;
  advanceCampaignDay(campaignId:string,input:{consumeRations:boolean;requiredUnits?:number;note?:string}):Promise<void>;
  appendCampaignSessionSummary(campaignId:string,summary:CampaignSessionSummary):Promise<void>;
  hostSession(): Promise<void>;
  joinSession(address: string): Promise<void>;
  stopSession(): Promise<void>;
  setSessionReady(ready:boolean):Promise<void>;
  startPreparedSession(mode:SessionMode):Promise<void>;
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
    removeCombatant: async (combatantId) => apply(() => mockAdapter.removeCombatant(combatantId)),
    adjustDmInventory: async (command) => apply(() => mockAdapter.adjustDmInventory(command)),
    undoLastDmInventoryAdjustment: async () => apply(() => mockAdapter.undoLastDmInventoryAdjustment()),
    createCampaign: async (input) => apply(() => mockAdapter.createCampaign(input)),
    openCampaign: async (campaignId) => apply(() => mockAdapter.openCampaign(campaignId)),
    updateCampaign: async (campaignId,payload) => apply(() => mockAdapter.updateCampaign(campaignId,payload)),
    archiveCampaign: async (campaignId) => apply(() => mockAdapter.archiveCampaign(campaignId)),
    restoreCampaign: async (campaignId) => apply(() => mockAdapter.restoreCampaign(campaignId)),
    configureCampaignSessionDefaults: async (campaignId,input) => apply(() => mockAdapter.configureCampaignSessionDefaults(campaignId,input)),
    prepareCampaignSessionSnapshot: async (campaignId,input) => apply(() => mockAdapter.prepareCampaignSessionSnapshot(campaignId,input)),
    upsertCampaignRosterMember: async (campaignId,member) => apply(() => mockAdapter.upsertCampaignRosterMember(campaignId,member)),
    removeCampaignRosterMember: async (campaignId,rosterMemberId) => apply(() => mockAdapter.removeCampaignRosterMember(campaignId,rosterMemberId)),
    configureCampaignCalendar: async (campaignId,input) => apply(() => mockAdapter.configureCampaignCalendar(campaignId,input)),
    advanceCampaignCalendar: async (campaignId,input) => apply(() => mockAdapter.advanceCampaignCalendar(campaignId,input)),
    correctCampaignCalendar: async (campaignId,input) => apply(() => mockAdapter.correctCampaignCalendar(campaignId,input)),
    correctCampaignCalendarDateTime: async (campaignId,input) => apply(() => mockAdapter.correctCampaignCalendarDateTime(campaignId,input)),
    setCampaignCalendarNote: async (campaignId,note) => apply(() => mockAdapter.setCampaignCalendarNote(campaignId,note)),
    undoCampaignCalendar: async (campaignId) => apply(() => mockAdapter.undoCampaignCalendar(campaignId)),
    configureCampaignRations: async (campaignId,input) => apply(() => mockAdapter.configureCampaignRations(campaignId,input)),
    adjustCampaignRations: async (campaignId,input) => apply(() => mockAdapter.adjustCampaignRations(campaignId,input)),
    consumeCampaignDailyRations: async (campaignId,input) => apply(() => mockAdapter.consumeCampaignDailyRations(campaignId,input)),
    undoCampaignRationConsumption: async (campaignId) => apply(() => mockAdapter.undoCampaignRationConsumption(campaignId)),
    advanceCampaignDay: async (campaignId,input) => apply(() => mockAdapter.advanceCampaignDay(campaignId,input)),
    appendCampaignSessionSummary: async (campaignId,summary) => apply(() => mockAdapter.appendCampaignSessionSummary(campaignId,summary)),
    hostSession: async () => apply(() => mockAdapter.hostSession()),
    joinSession: async (address) => apply(() => mockAdapter.joinSession(address)),
    stopSession: async () => apply(() => mockAdapter.stopSession()),
    setSessionReady: async (ready) => apply(() => mockAdapter.setSessionReady(ready)),
    startPreparedSession: async (mode) => apply(() => mockAdapter.startPreparedSession(mode)),
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

export type SessionDebugPreviewRole = "dm" | "player";

export function SessionDebugPreviewProvider({ children, role, mode, onExit }: {
  children: ReactNode;
  role: SessionDebugPreviewRole;
  mode: SessionMode;
  onExit(): void;
}) {
  const parent = useSimpleVtt();
  const previewSnapshot = useMemo<AppSnapshot | null>(() => {
    if (!parent.snapshot) return null;
    const activeCharacter = parent.snapshot.activeCharacter;
    const hasCurrentActor=parent.snapshot.scene.entities.some((entity)=>entity.id===parent.snapshot!.scene.currentActorId);
    const previewCurrentActorId=mode==="initiative"&&!hasCurrentActor
      ? [...parent.snapshot.scene.entities].sort((left,right)=>right.initiative-left.initiative)[0]?.id??parent.snapshot.scene.currentActorId
      : parent.snapshot.scene.currentActorId;
    return {
      ...parent.snapshot,
      role: role === "dm" ? "dm" : "player",
      sessionMode: mode,
      connectionState: "connected",
      session: {
        ...parent.snapshot.session,
        role: role === "dm" ? "host" : "client",
        lifecycle: "live",
        name: "브라우저 세션 UI 미리보기",
        address: "debug://browser-preview",
        compatibility: "compatible",
        compatibilityMessage: "표시 확인 전용 · 실제 네트워크 연결과 권위 상태를 변경하지 않습니다.",
        participants: [
          { id: "host", name: "미리보기 DM", state: "connected", ready: true },
          { id: `client:${activeCharacter.id}`, name: "미리보기 Player", characterName: activeCharacter.name, state: "connected", ready: true },
        ],
      },
      scene: previewCurrentActorId===parent.snapshot.scene.currentActorId?parent.snapshot.scene:{...parent.snapshot.scene,currentActorId:previewCurrentActorId},
      campaignSessionSystems:parent.snapshot.campaignSessionSystems?{
        ...parent.snapshot.campaignSessionSystems,
        rations:role==="player"&&!parent.snapshot.campaignSessionSystems.rations.visibleToPlayers
          ? {enabled:parent.snapshot.campaignSessionSystems.rations.enabled,visibleToPlayers:false}
          : parent.snapshot.campaignSessionSystems.rations,
      }:null,
    };
  }, [mode, parent.snapshot, role]);

  const value = useMemo<AppContextValue>(() => ({
    ...parent,
    snapshot: previewSnapshot,
    loading: false,
    hostSession: async () => undefined,
    joinSession: async () => undefined,
    stopSession: async () => onExit(),
    setSessionReady: async () => undefined,
    startPreparedSession: async () => undefined,
  }), [onExit, parent, previewSnapshot]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export type { AdjudicationScope };
