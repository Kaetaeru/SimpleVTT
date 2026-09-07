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
  ResolutionHiddenFact,
  ResolutionVisibilityVm,
  PartyStashTransferCommand,
  SessionCharacterInventoryVm,
  SessionMode,
} from "./contracts";
import type { ManualMovementReactionCommand } from "./manualMovementReactionContracts";
import type { ReadyActionConfiguration } from "./standardActionReadyState";
import type { PactTomeRestSpellCommand, WizardLongRestSpellCommand } from "./restSpellManagementContracts";
import type { CircleLandType } from "../domain/druidCircleLandRecovery";
import type { CampaignCalendarDateTime, CampaignCalendarState, CampaignDmLibraryEntry, CampaignMealCommand, CampaignRosterMember, CampaignSessionSummary, CampaignSessionSystemsProjection } from "./campaignPersistenceContracts";
import { campaignDateTimeToAbsoluteMinute, projectCampaignCalendar } from "./campaignCalendar";
import { campaignXpThresholdForLevel } from "./campaignApplicationService";
import "./restSpellManagementRuntimeAdapter";
import "./phase09ConcentrationSaveAdapter";
import "./productionCombatantPreparationAdapter";
import "./campaignRuntimeAdapter";
import { mockAdapter, type MockAdapter } from "./mockAdapter";
import { subscribeExternalAdapterSnapshot } from "./adapterSnapshotEvents";
import { commandWasNoOp, makeRefusal, refusalMessageFor } from "./sessionRefusal";
import { setSessionDebugPreviewRole } from "./sessionDebugPreviewRole";
import { deleteCharacterDurably } from "./characterLibraryRuntimeAdapter";

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
  duplicateCharacterDraft(characterId:string):Promise<void>;
  deleteCharacter(characterId:string):Promise<void>;
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
  configureReadyAction(command:ReadyActionConfiguration):Promise<void>;
  resolveAction(actionId: string, targetIds: string[]): Promise<void>;
  advanceResolution(): Promise<void>;
  submitConcentrationSaveD20(face:number):Promise<void>;
  respondToInterrupt(accept: boolean): Promise<void>;
  dismissResolution(): Promise<void>;
  applyDmAdjudication(command: DmAdjudicationCommand): Promise<void>;
  undoLastResolution(): Promise<void>;
  setNextResolutionVisibility(visibility: ResolutionVisibilityVm | null): Promise<void>;
  discloseResolution(resolutionId: string, facts: ResolutionHiddenFact[]): Promise<void>;
  previewContentImport(payload: string): Promise<void>;
  activateContentImport(): Promise<void>;
  clearContentImport(): Promise<void>;
  uninstallContentSource(sourceId: string): Promise<void>;
  previewCombatantImport(payload: string): Promise<void>;
  activateCombatantImport(): Promise<void>;
  clearCombatantImport(): Promise<void>;
  instantiateCombatant(definitionId: string): Promise<void>;
  removeCombatant(combatantId: string): Promise<void>;
  adjustDmInventory(command:DmInventoryAdjustmentCommand):Promise<void>;
  undoLastDmInventoryAdjustment():Promise<void>;
  transferPartyStash(command:PartyStashTransferCommand):Promise<void>;
  upsertCampaignDmLibraryEntry(campaignId:string,entry:CampaignDmLibraryEntry):Promise<void>;
  removeCampaignDmLibraryEntry(campaignId:string,entryId:string):Promise<void>;
  grantCampaignDmLibraryItem(campaignId:string,entryId:string,target:{kind:"character";actorId:string}|{kind:"stash"},quantity:number):Promise<void>;
  revealCampaignDmLibraryImage(campaignId:string,entryId:string):Promise<void>;
  instantiateCampaignDmLibraryNpc(campaignId:string,entryId:string):Promise<void>;
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
  serveCampaignMeals(campaignId:string,input:CampaignMealCommand):Promise<void>;
  setCampaignMemberMeals(campaignId:string,input:{rosterMemberId:string;mealCount:number}):Promise<void>;
  undoCampaignMeal(campaignId:string):Promise<void>;
  advanceCampaignDay(campaignId:string,input:{consumeRations:boolean;requiredUnits?:number;note?:string}):Promise<void>;
  appendCampaignSessionSummary(campaignId:string,summary:CampaignSessionSummary):Promise<void>;
  grantCampaignAdvancement(campaignId:string,input:{rosterMemberIds:string[];kind:"xp"|"level-up-credit";amount:number;levels?:Record<string,number>}):Promise<void>;
  consumeCampaignLevelUpCredit(campaignId:string,rosterMemberId:string,level?:number):Promise<void>;
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

export function AppProvider({ children, adapter = mockAdapter }: { children: ReactNode; adapter?: MockAdapter }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiDebug, setUiDebugState] = useState<UiDebugState>({ selectedActionId: null, eligibleTargetIds: [], selectedTargetIds: [], hoverTargetId: null });
  const operationSequenceRef = useRef(0);
  const latestSnapshotRef = useRef<AppSnapshot | null>(null);

  const publishIfLatest = useCallback((sequence: number, next: AppSnapshot) => {
    if (sequence !== operationSequenceRef.current) return;
    latestSnapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const apply = useCallback(async (operation: () => Promise<AppSnapshot>) => {
    const sequence = ++operationSequenceRef.current;
    const next = await operation();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);

  const refresh = useCallback(async () => {
    const sequence = ++operationSequenceRef.current;
    const next = await adapter.getSnapshot();
    publishIfLatest(sequence, next);
  }, [publishIfLatest]);
  const updateCharacterDraft = useCallback(async (command: CharacterDraftCommand) => {
    if (!isOptimisticTextCommand(command)) {
      await apply(() => adapter.updateCharacterDraft(command));
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
    const next = await adapter.updateCharacterDraft(command);
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
    createCharacterDraft: async (mode) => apply(() => adapter.createCharacterDraft(mode)),
    duplicateCharacterDraft: async (characterId) => apply(async () => {
      await adapter.selectProductionCharacter(characterId);
      return adapter.createCharacterDraft("duplicate");
    }),
    deleteCharacter: async (characterId) => apply(() => deleteCharacterDurably(adapter,characterId)),
    editCharacterDraft: async (characterId) => apply(() => adapter.editCharacterDraft(characterId)),
    updateCharacterDraft,
    finalizeCharacterDraft: async () => apply(() => adapter.finalizeCharacterDraft()),
    toggleItemEquipped: async (itemId) => apply(() => adapter.toggleItemEquipped(itemId)),
    toggleItemAttunement: async (itemId) => apply(() => adapter.toggleItemAttunement(itemId)),
    useItem: async (itemId) => apply(() => adapter.useItem(itemId)),
    startLevelUp: async (characterId) => apply(() => adapter.startLevelUp(characterId)),
    updateLevelUp: async (command) => apply(() => adapter.updateLevelUp(command)),
    commitLevelUp: async () => apply(() => adapter.commitLevelUp()),
    configureWizardLongRest: async (command) => apply(() => adapter.configureWizardLongRest(command)),
    configurePactTomeRest: async (command) => apply(() => adapter.configurePactTomeRest(command)),
    configureCircleLandRest: async (landType) => apply(() => adapter.configureCircleLandRest(landType)),
    selectDmActor: async (actorId) => apply(() => adapter.selectDmActor(actorId)),
    startInitiative: async () => apply(() => adapter.startInitiative()),
    endInitiative: async () => apply(() => adapter.endInitiative()),
    endTurn: async () => apply(() => adapter.endTurn()),
    declareManualMovementReaction: async (command) => apply(() => adapter.declareManualMovementReaction(command)),
    configureReadyAction: async (command) => apply(() => adapter.configureReadyAction(command)),
    resolveAction: async (actionId, targetIds) => {
      const before = latestSnapshotRef.current;
      await apply(() => adapter.resolveAction(actionId, targetIds));
      // V1.6 S1-01 catch-all: a command that left nothing behind is a refusal the table must see. A connected client's
      // request is answered by the Host later, so it is exempt here.
      const after = latestSnapshotRef.current;
      if (before && after && after.session.role !== "client" && commandWasNoOp(before, after)) {
        const sequence = ++operationSequenceRef.current;
        publishIfLatest(sequence, { ...after, refusal: makeRefusal("no-op", refusalMessageFor("no-op"), { actionId }) });
      }
    },
    advanceResolution: async () => apply(() => adapter.advanceResolution()),
    submitConcentrationSaveD20: async (face) => apply(() => adapter.submitConcentrationSaveD20(face)),
    respondToInterrupt: async (accept) => apply(() => adapter.respondToInterrupt(accept)),
    dismissResolution: async () => apply(() => adapter.dismissResolution()),
    applyDmAdjudication: async (command) => apply(() => adapter.applyDmAdjudication(command)),
    undoLastResolution: async () => apply(() => adapter.undoLastResolution()),
    setNextResolutionVisibility: async (visibility) => apply(() => adapter.setNextResolutionVisibility(visibility)),
    discloseResolution: async (resolutionId, facts) => apply(() => adapter.discloseResolution(resolutionId, facts)),
    previewContentImport: async (payload) => apply(() => adapter.previewContentImport(payload)),
    activateContentImport: async () => apply(() => adapter.activateContentImport()),
    clearContentImport: async () => apply(() => adapter.clearContentImport()),
    uninstallContentSource: async (sourceId) => apply(() => adapter.uninstallContentSource(sourceId)),
    previewCombatantImport: async (payload) => apply(() => adapter.previewCombatantImport(payload)),
    activateCombatantImport: async () => apply(() => adapter.activateCombatantImport()),
    clearCombatantImport: async () => apply(() => adapter.clearCombatantImport()),
    instantiateCombatant: async (definitionId) => apply(() => adapter.instantiateCombatant(definitionId)),
    removeCombatant: async (combatantId) => apply(() => adapter.removeCombatant(combatantId)),
    adjustDmInventory: async (command) => apply(() => adapter.adjustDmInventory(command)),
    undoLastDmInventoryAdjustment: async () => apply(() => adapter.undoLastDmInventoryAdjustment()),
    transferPartyStash: async (command) => apply(() => adapter.transferPartyStash(command)),
    upsertCampaignDmLibraryEntry: async (campaignId,entry) => apply(() => adapter.upsertCampaignDmLibraryEntry(campaignId,entry)),
    removeCampaignDmLibraryEntry: async (campaignId,entryId) => apply(() => adapter.removeCampaignDmLibraryEntry(campaignId,entryId)),
    grantCampaignDmLibraryItem: async (campaignId,entryId,target,quantity) => apply(() => adapter.grantCampaignDmLibraryItem(campaignId,entryId,target,quantity)),
    revealCampaignDmLibraryImage: async (campaignId,entryId) => apply(() => adapter.revealCampaignDmLibraryImage(campaignId,entryId)),
    instantiateCampaignDmLibraryNpc: async (campaignId,entryId) => apply(() => adapter.instantiateCampaignDmLibraryNpc(campaignId,entryId)),
    createCampaign: async (input) => apply(() => adapter.createCampaign(input)),
    openCampaign: async (campaignId) => apply(() => adapter.openCampaign(campaignId)),
    updateCampaign: async (campaignId,payload) => apply(() => adapter.updateCampaign(campaignId,payload)),
    archiveCampaign: async (campaignId) => apply(() => adapter.archiveCampaign(campaignId)),
    restoreCampaign: async (campaignId) => apply(() => adapter.restoreCampaign(campaignId)),
    configureCampaignSessionDefaults: async (campaignId,input) => apply(() => adapter.configureCampaignSessionDefaults(campaignId,input)),
    prepareCampaignSessionSnapshot: async (campaignId,input) => apply(() => adapter.prepareCampaignSessionSnapshot(campaignId,input)),
    upsertCampaignRosterMember: async (campaignId,member) => apply(() => adapter.upsertCampaignRosterMember(campaignId,member)),
    removeCampaignRosterMember: async (campaignId,rosterMemberId) => apply(() => adapter.removeCampaignRosterMember(campaignId,rosterMemberId)),
    configureCampaignCalendar: async (campaignId,input) => apply(() => adapter.configureCampaignCalendar(campaignId,input)),
    advanceCampaignCalendar: async (campaignId,input) => apply(() => adapter.advanceCampaignCalendar(campaignId,input)),
    correctCampaignCalendar: async (campaignId,input) => apply(() => adapter.correctCampaignCalendar(campaignId,input)),
    correctCampaignCalendarDateTime: async (campaignId,input) => apply(() => adapter.correctCampaignCalendarDateTime(campaignId,input)),
    setCampaignCalendarNote: async (campaignId,note) => apply(() => adapter.setCampaignCalendarNote(campaignId,note)),
    undoCampaignCalendar: async (campaignId) => apply(() => adapter.undoCampaignCalendar(campaignId)),
    configureCampaignRations: async (campaignId,input) => apply(() => adapter.configureCampaignRations(campaignId,input)),
    adjustCampaignRations: async (campaignId,input) => apply(() => adapter.adjustCampaignRations(campaignId,input)),
    consumeCampaignDailyRations: async (campaignId,input) => apply(() => adapter.consumeCampaignDailyRations(campaignId,input)),
    undoCampaignRationConsumption: async (campaignId) => apply(() => adapter.undoCampaignRationConsumption(campaignId)),
    serveCampaignMeals: async (campaignId,input) => apply(() => adapter.serveCampaignMeals(campaignId,input)),
    setCampaignMemberMeals: async (campaignId,input) => apply(() => adapter.setCampaignMemberMeals(campaignId,input)),
    undoCampaignMeal: async (campaignId) => apply(() => adapter.undoCampaignMeal(campaignId)),
    advanceCampaignDay: async (campaignId,input) => apply(() => adapter.advanceCampaignDay(campaignId,input)),
    appendCampaignSessionSummary: async (campaignId,summary) => apply(() => adapter.appendCampaignSessionSummary(campaignId,summary)),
    grantCampaignAdvancement: async (campaignId,input) => apply(() => adapter.grantCampaignAdvancement(campaignId,input)),
    consumeCampaignLevelUpCredit: async (campaignId,rosterMemberId,level) => apply(() => adapter.consumeCampaignLevelUpCredit(campaignId,rosterMemberId,level)),
    hostSession: async () => apply(() => adapter.hostSession()),
    joinSession: async (address) => apply(() => adapter.joinSession(address)),
    stopSession: async () => {
      await apply(() => adapter.stopSession());
      await refresh();
    },
    setSessionReady: async (ready) => apply(() => adapter.setSessionReady(ready)),
    startPreparedSession: async (mode) => apply(() => adapter.startPreparedSession(mode)),
    debug: {
      setRole: async (role) => apply(() => adapter.setReferenceRole(role)),
      setMode: async (mode) => apply(() => adapter.setSessionMode(mode)),
      setCurrentActor: async (actorId) => apply(() => adapter.setCurrentActor(actorId)),
      setQueuedD20: async (value) => apply(() => adapter.setQueuedD20(value)),
      setConnectionState: async (state) => apply(() => adapter.setConnectionState(state)),
      setEdgeState: async (state) => apply(() => adapter.setEdgeState(state)),
      loadScenario: async (id) => apply(() => adapter.loadReferenceScenario(id)),
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
  useEffect(()=>{
    setSessionDebugPreviewRole(mockAdapter,role);
    return ()=>setSessionDebugPreviewRole(mockAdapter,null);
  },[role]);
  const [previewCalendarOverride,setPreviewCalendarOverride]=useState<{campaignId:string;absoluteMinute:number;displayAnchor:CampaignCalendarState["displayAnchor"]}|null>(null);
  const [previewRationOverride,setPreviewRationOverride]=useState<{campaignId:string;rations:CampaignSessionSystemsProjection["rations"]}|null>(null);
  const [previewAdvancementOverride,setPreviewAdvancementOverride]=useState<Record<string,{xp:number;levelUpCredits:number}>>({});
  const [previewStashOverride,setPreviewStashOverride]=useState<{campaignId:string;stash:CampaignSessionSystemsProjection["partyStash"]}|null>(null);
  const [previewInventoryOverrides,setPreviewInventoryOverrides]=useState<Record<string,SessionCharacterInventoryVm>>({});
  const previewSnapshot = useMemo<AppSnapshot | null>(() => {
    if (!parent.snapshot) return null;
    const activeCharacter = parent.snapshot.activeCharacter;
    const hasCurrentActor=parent.snapshot.scene.entities.some((entity)=>entity.id===parent.snapshot!.scene.currentActorId);
    const previewCurrentActorId=mode==="initiative"&&!hasCurrentActor
      ? [...parent.snapshot.scene.entities].sort((left,right)=>right.initiative-left.initiative)[0]?.id??parent.snapshot.scene.currentActorId
      : parent.snapshot.scene.currentActorId;
    const sourceCampaign=parent.snapshot.campaignSessionSystems??{
      campaignId:"campaign.browser-preview",
      campaignName:"브라우저 미리보기 캠페인",
      campaignRevision:1,
      roster:[],
      calendar:{enabled:true,providerId:"builtin.gregorian",absoluteMinute:600,displayAnchor:{era:"왕국력",year:312,monthId:"4",monthLabel:"4월",day:7,hour:10,minute:0},currentNote:"Player 합류 직후"},
      rations:{enabled:true,visibleToPlayers:true,balance:8,dailyRequired:0,shortage:0},
      partyStash:{revision:1,policy:"dm-approval" as const,wallet:{gp:120,sp:0,cp:0},itemReferences:[]},
    };
    const calendarCampaign=previewCalendarOverride?.campaignId===sourceCampaign.campaignId?{
      ...sourceCampaign,
      calendar:{...sourceCampaign.calendar,absoluteMinute:previewCalendarOverride.absoluteMinute,displayAnchor:previewCalendarOverride.displayAnchor},
    }:sourceCampaign;
    const stashCampaign=previewStashOverride?.campaignId===sourceCampaign.campaignId?{...calendarCampaign,partyStash:previewStashOverride.stash}:calendarCampaign;
    const baseCampaign=previewRationOverride?.campaignId===sourceCampaign.campaignId?{...stashCampaign,rations:previewRationOverride.rations}:stashCampaign;
    const previewRosterMemberId=`connected:${activeCharacter.id}`;
    const hasPreviewMember=baseCampaign.roster.some((member)=>member.rosterMemberId===previewRosterMemberId);
    const roster=(hasPreviewMember?baseCampaign.roster.map((member)=>member.rosterMemberId===previewRosterMemberId?{...member,presentInSession:true,connectionState:"connected" as const}:member):[
      ...baseCampaign.roster,
      {rosterMemberId:previewRosterMemberId,label:activeCharacter.name,kind:"player-character-ref" as const,characterId:activeCharacter.id,active:true,presentInSession:true,countsForRations:true,rationUnitsPerDay:1,stashPermission:"request" as const,connectionState:"connected" as const,level:activeCharacter.level,advancement:{xp:campaignXpThresholdForLevel(activeCharacter.level),levelUpCredits:0}},
    ]);
    const advancementRoster=roster.map((member)=>({...member,level:member.level??(member.rosterMemberId===previewRosterMemberId?activeCharacter.level:1),advancement:previewAdvancementOverride[member.rosterMemberId]??member.advancement??{xp:0,levelUpCredits:0}}));
    const presentRationMembers=advancementRoster.filter((member)=>member.active&&member.countsForRations&&member.presentInSession!==false);
    const dailyRequired=presentRationMembers.reduce((sum,member)=>sum+(member.rationUnitsPerDay??1),0);
    const balance=baseCampaign.rations.balance??0;
    const mealsRequired=presentRationMembers.length*2;
    const mealsSatisfied=presentRationMembers.reduce((sum,member)=>sum+Math.min(2,baseCampaign.rations.mealsByRosterMember?.[member.rosterMemberId]??0),0);
    const previewRations={...baseCampaign.rations,dailyRequired,shortage:Math.max(0,dailyRequired-balance),mealsRequired,mealsSatisfied,mealsShortage:Math.max(0,mealsRequired-mealsSatisfied)};
    const campaignSessionSystems={
      ...baseCampaign,
      roster:role==="player"&&!previewRations.visibleToPlayers
        ? advancementRoster.map(({countsForRations:_,rationUnitsPerDay:__,...member})=>member)
        : advancementRoster,
      rations:role==="player"&&!previewRations.visibleToPlayers
        ? {enabled:previewRations.enabled,visibleToPlayers:false as const}
        : previewRations,
    };
    const sessionCharacterInventories={...parent.snapshot.sessionCharacterInventories,...previewInventoryOverrides};
    const activeInventory=sessionCharacterInventories[activeCharacter.id];
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
      activeCharacter:activeInventory?{...activeCharacter,goldGp:activeInventory.goldGp,items:activeInventory.items}:activeCharacter,
      scene: previewCurrentActorId===parent.snapshot.scene.currentActorId?parent.snapshot.scene:{...parent.snapshot.scene,currentActorId:previewCurrentActorId},
      sessionCharacterInventories,
      campaignSessionSystems,
    };
  }, [mode, parent.snapshot, previewAdvancementOverride, previewCalendarOverride, previewInventoryOverrides, previewRationOverride, previewStashOverride, role]);

  const value = useMemo<AppContextValue>(() => ({
    ...parent,
    snapshot: previewSnapshot,
    loading: false,
    hostSession: async () => undefined,
    joinSession: async () => undefined,
    stopSession: async () => onExit(),
    declareManualMovementReaction: async(command)=>{
      await parent.debug.setCurrentActor(command.provokerId);
      await parent.declareManualMovementReaction(command);
    },
    setSessionReady: async () => undefined,
    startPreparedSession: async () => undefined,
    correctCampaignCalendarDateTime: async(campaignId,input)=>{
      const calendar=previewSnapshot?.campaignSessionSystems?.calendar;
      if(!calendar||previewSnapshot?.campaignSessionSystems?.campaignId!==campaignId)return;
      const absoluteMinute=campaignDateTimeToAbsoluteMinute(calendar.providerId,input.dateTime);
      setPreviewCalendarOverride({campaignId,absoluteMinute,displayAnchor:projectCampaignCalendar(calendar.providerId,absoluteMinute,input.dateTime.era)});
    },
    advanceCampaignCalendar: async(campaignId,input)=>{
      const calendar=previewSnapshot?.campaignSessionSystems?.calendar;
      if(!calendar||previewSnapshot?.campaignSessionSystems?.campaignId!==campaignId)return;
      const absoluteMinute=calendar.absoluteMinute+input.deltaMinutes;
      setPreviewCalendarOverride({campaignId,absoluteMinute,displayAnchor:projectCampaignCalendar(calendar.providerId,absoluteMinute,calendar.displayAnchor.era)});
    },
    advanceCampaignDay: async(campaignId)=>{
      const campaign=previewSnapshot?.campaignSessionSystems;
      if(!campaign||campaign.campaignId!==campaignId)return;
      const absoluteMinute=campaign.calendar.absoluteMinute+1440;
      setPreviewCalendarOverride({campaignId,absoluteMinute,displayAnchor:projectCampaignCalendar(campaign.calendar.providerId,absoluteMinute,campaign.calendar.displayAnchor.era)});
      setPreviewRationOverride({campaignId,rations:{...campaign.rations,mealsSatisfied:0,mealsShortage:campaign.rations.mealsRequired??campaign.roster.filter((member)=>member.active&&member.countsForRations).length*2,mealsByRosterMember:{}}});
    },
    serveCampaignMeals: async(campaignId,input)=>{
      const campaign=previewSnapshot?.campaignSessionSystems;
      if(!campaign||campaign.campaignId!==campaignId)return;
      const current={...(campaign.rations.mealsByRosterMember??{})};
      const served=input.rosterMemberIds.filter((id)=>(current[id]??0)<2);
      const rationCost=input.source==="ration"?served.length:0;
      if((campaign.rations.balance??0)<rationCost)throw new Error("일일 식량이 부족합니다.");
      for(const id of served)current[id]=Math.min(2,(current[id]??0)+input.mealUnits);
      const mealsSatisfied=campaign.roster.filter((member)=>member.active&&member.countsForRations).reduce((sum,member)=>sum+(current[member.rosterMemberId]??0),0);
      const transaction={transactionId:`preview.meal.${Date.now()}`,kind:"meal" as const,amount:-rationCost,balanceAfter:(campaign.rations.balance??0)-rationCost,committedAt:new Date().toISOString(),rosterMemberIds:served,mealUnits:input.mealUnits,mealUnitsByRosterMember:Object.fromEntries(served.map((id)=>[id,Math.min(input.mealUnits,2-(campaign.rations.mealsByRosterMember?.[id]??0))])),mealSource:input.source,costSp:input.source==="tavern"?(input.costSpPerPerson??0)*served.length:0,campaignAbsoluteMinute:campaign.calendar.absoluteMinute,provenance:["preview"]};
      setPreviewRationOverride({campaignId,rations:{...campaign.rations,balance:transaction.balanceAfter,mealsByRosterMember:current,mealsSatisfied,mealsShortage:Math.max(0,(campaign.rations.mealsRequired??campaign.roster.length*2)-mealsSatisfied),recentTransactions:[...(campaign.rations.recentTransactions??[]),transaction]}});
    },
    setCampaignMemberMeals: async(campaignId,input)=>{
      const campaign=previewSnapshot?.campaignSessionSystems;if(!campaign||campaign.campaignId!==campaignId)return;
      const current={...(campaign.rations.mealsByRosterMember??{})};const before=current[input.rosterMemberId]??0;if(before===input.mealCount)return;current[input.rosterMemberId]=input.mealCount;
      const mealsSatisfied=campaign.roster.filter((member)=>member.active&&member.countsForRations).reduce((sum,member)=>sum+(current[member.rosterMemberId]??0),0);
      const transaction={transactionId:`preview.meal.manual.${Date.now()}`,kind:"meal" as const,amount:0,balanceAfter:campaign.rations.balance??0,committedAt:new Date().toISOString(),rosterMemberIds:[input.rosterMemberId],mealUnits:input.mealCount-before,mealUnitsByRosterMember:{[input.rosterMemberId]:input.mealCount-before},mealSource:"manual" as const,campaignAbsoluteMinute:campaign.calendar.absoluteMinute,provenance:["preview"]};
      setPreviewRationOverride({campaignId,rations:{...campaign.rations,mealsByRosterMember:current,mealsSatisfied,mealsShortage:Math.max(0,(campaign.rations.mealsRequired??campaign.roster.length*2)-mealsSatisfied),recentTransactions:[...(campaign.rations.recentTransactions??[]),transaction]}});
    },
    undoCampaignMeal: async(campaignId)=>{
      const campaign=previewSnapshot?.campaignSessionSystems;const history=campaign?.rations.recentTransactions??[];const source=[...history].reverse().find((entry)=>entry.kind==="meal");
      if(!campaign||campaign.campaignId!==campaignId||!source)throw new Error("되돌릴 식사 기록이 없습니다.");
      const current={...(campaign.rations.mealsByRosterMember??{})};for(const [id,units] of Object.entries(source.mealUnitsByRosterMember??{}))current[id]=Math.max(0,(current[id]??0)-units);
      const mealsSatisfied=Object.values(current).reduce((sum,value)=>sum+value,0);
      setPreviewRationOverride({campaignId,rations:{...campaign.rations,balance:(campaign.rations.balance??0)+Math.abs(source.amount),mealsByRosterMember:current,mealsSatisfied,mealsShortage:Math.max(0,(campaign.rations.mealsRequired??0)-mealsSatisfied),recentTransactions:history.filter((entry)=>entry.transactionId!==source.transactionId)}});
    },
    grantCampaignAdvancement: async(campaignId,input)=>{
      if(previewSnapshot?.campaignSessionSystems?.campaignId!==campaignId)return;
      setPreviewAdvancementOverride((current)=>{
        const next={...current};
        for(const rosterMemberId of input.rosterMemberIds){
          const projected=previewSnapshot.campaignSessionSystems?.roster.find((member)=>member.rosterMemberId===rosterMemberId)?.advancement??{xp:0,levelUpCredits:0};
          const value=next[rosterMemberId]??projected;
          next[rosterMemberId]=input.kind==="xp"?{...value,xp:value.xp+input.amount}:{...value,levelUpCredits:value.levelUpCredits+input.amount};
        }
        return next;
      });
    },
    consumeCampaignLevelUpCredit: async(campaignId,rosterMemberId)=>{
      if(previewSnapshot?.campaignSessionSystems?.campaignId!==campaignId)return;
      setPreviewAdvancementOverride((current)=>{
        const projected=previewSnapshot.campaignSessionSystems?.roster.find((member)=>member.rosterMemberId===rosterMemberId)?.advancement??{xp:0,levelUpCredits:0};
        const value=current[rosterMemberId]??projected;
        return {...current,[rosterMemberId]:{...value,levelUpCredits:Math.max(0,value.levelUpCredits-1)}};
      });
    },
    transferPartyStash: async(command)=>{
      const campaign=previewSnapshot?.campaignSessionSystems;
      const sourceInventory=previewSnapshot?.sessionCharacterInventories?.[command.actorId];
      if(!campaign||campaign.campaignId!==command.campaignId||!sourceInventory)return;
      const inventory:SessionCharacterInventoryVm={...sourceInventory,items:sourceInventory.items.map((item)=>({...item,passiveEffects:[...item.passiveEffects],grantedActionIds:[...item.grantedActionIds],provenance:[...item.provenance]}))};
      const stash:CampaignSessionSystemsProjection["partyStash"]={...campaign.partyStash,wallet:{...campaign.partyStash.wallet},itemReferences:campaign.partyStash.itemReferences.map((item)=>({...item}))};
      if(command.asset==="currency"){
        if(command.direction==="character-to-stash"){
          if(inventory.goldGp<command.amount)throw new Error("캐릭터가 보유한 GP가 부족합니다.");
          inventory.goldGp-=command.amount;stash.wallet.gp+=command.amount;
        }else{
          if(stash.wallet.gp<command.amount)throw new Error("파티 보관함의 GP가 부족합니다.");
          stash.wallet.gp-=command.amount;inventory.goldGp+=command.amount;
        }
      }else if(command.direction==="character-to-stash"){
        const item=inventory.items.find((candidate)=>candidate.id===command.itemId);
        if(!item||item.quantity<command.quantity)throw new Error("캐릭터가 보유한 아이템 수량이 부족합니다.");
        item.quantity-=command.quantity;
        if(item.quantity===0)inventory.items=inventory.items.filter((candidate)=>candidate.id!==item.id);
        const existing=stash.itemReferences.find((candidate)=>candidate.definitionId===command.definitionId);
        if(existing){existing.quantity+=command.quantity;if(command.itemTemplate&&!existing.itemTemplate)existing.itemTemplate=structuredClone(command.itemTemplate);}
        else stash.itemReferences.push({instanceId:"stash."+command.definitionId,definitionId:command.definitionId,quantity:command.quantity,...(command.itemTemplate?{itemTemplate:structuredClone(command.itemTemplate)}:{})});
      }else{
        const stored=stash.itemReferences.find((candidate)=>candidate.definitionId===command.definitionId);
        if(!stored||stored.quantity<command.quantity)throw new Error("파티 보관함의 아이템 수량이 부족합니다.");
        stored.quantity-=command.quantity;
        if(stored.quantity===0)stash.itemReferences=stash.itemReferences.filter((candidate)=>candidate.instanceId!==stored.instanceId);
        const entry=previewSnapshot.catalog.find((candidate)=>candidate.id===command.catalogEntryId&&candidate.category==="item");
        const template=command.itemTemplate??(entry?{definitionId:command.definitionId,name:entry.nameKo,nameEn:entry.nameEn,kind:/potion|물약|consumable/i.test(entry.nameKo+" "+entry.nameEn)?"consumable" as const:"equipment" as const,passiveEffects:[],grantedActionIds:[],provenance:[entry.source+" · v"+entry.version]}:null);
        if(!template)throw new Error("공유 보관함 아이템 원본 정보를 찾지 못했습니다.");
        const existing=inventory.items.find((candidate)=>candidate.definitionId===command.definitionId&&!candidate.charges&&!candidate.attunementRequired&&!template.charges&&!template.attunementRequired);
        if(existing)existing.quantity+=command.quantity;
        else inventory.items.push({id:"item.preview."+command.actorId+"."+Date.now(),...structuredClone(template),quantity:command.quantity,equipped:false,wielded:false,attuned:false});
      }
      inventory.revision+=1;stash.revision+=1;
      setPreviewInventoryOverrides((current)=>({...current,[inventory.characterId]:inventory}));
      setPreviewStashOverride({campaignId:command.campaignId,stash});
    },
  }), [onExit, parent, previewSnapshot]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export type { AdjudicationScope };
