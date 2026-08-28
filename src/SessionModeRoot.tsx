import { useEffect, useRef, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { projectOfficialSheet, signed } from "./app/characterSheetV10Projection";
import { VISUAL_DICE_REDUCED_REPLAY_MS, VISUAL_DICE_REPLAY_MS } from "./app/diceVisuals";
import { isReducedMotionPreferred } from "./app/motionPreferences";
import { sheetAbilityModifier } from "./app/sheetRollValues";
import { visibleCharacterResources } from "./app/characterResourcePresentation";
import { CharacterSheetWorkspace } from "./CharacterSheetPlayScreen";
import { SessionActionDock, type SessionActionTargeting } from "./SessionActionDock";
import { SessionActorBoard } from "./SessionActorBoards";
import { SessionTargetingCursor, type TargetingAnchor } from "./SessionTargetingCursor";
import { SessionDmActorPane, SessionDmEncounterPane, SessionParticipantsPane, SessionSharePane } from "./SessionDmTools";
import {
  dismissCurrentSessionImageHandout,
  SessionDmHandoutPreview,
  SessionDmHandoutPane,
  SessionPlayerHandoutError,
  SessionPlayerHandoutRailButton,
  SessionPlayerHandoutViewer,
  useSessionImageHandout,
} from "./SessionImageHandoutBridge";
import { SessionInitiativeStrip } from "./SessionInitiativeStrip";
import { SessionDmInventoryPane, SessionPlayerInventoryPane } from "./SessionInventoryPane";
import { SessionMainFocus } from "./SessionMainFocus";
import { SessionPlayerRecoveryStrip, SessionPlayerSessionPane } from "./SessionPlayerSession";
import { SessionQuickPalette, type SessionQuickDestination } from "./SessionQuickPalette";
import { SessionActivityPane, SessionRulesPane } from "./SessionUtilityPanes";
import { SessionCampaignPane } from "./SessionCampaignPane";
import { SessionDmLibraryPane, type SessionDmLibraryDropPayload } from "./SessionDmLibraryPane";
import { SessionDmTimeMealManager } from "./SessionDmTimeMealManager";
import { LevelUpScreen } from "./App";
import { campaignDayPeriod, formatCampaignCalendarDateTime } from "./app/campaignCalendar";
import { isNonBlockingRemoteResolution } from "./app/remoteResolutionNotice";
import { mockAdapter } from "./app/mockAdapter";
import { dismissSessionLastRoll, getSessionLastRollPresentationState, subscribeSessionLastRollPresentation } from "./app/sessionImageHandoutRuntimeAdapter";
import "./app/campaignDmLibraryOrganizationRuntimeAdapter";
import "./session-mode.css";
import "./session-connected-layout.css";
import "./session-integrated-reference-play.css";

type SessionUtility = "quick-sheet" | "actor" | "inventory" | "library" | "campaign" | "calendar" | "rations" | "rest" | "rules" | "encounter" | "participants" | "handout" | "activity" | "session" | "player-session" | null;
type WorkspaceLayer = "full-sheet" | "level-up" | "time-meals" | null;

const ANIMATED_RESOLUTION_STAGES = new Set(["roll-animation", "save-animation", "damage-animation"]);

function actionDamageSummary(action: ActionVm) {
  if (!action.damage?.length) return action.summary;
  return action.damage
    .map((part) => `${part.dice}${part.flat ? signed(part.flat) : ""} ${part.type}`)
    .join(" + ");
}

function resolutionStageCopy(stage: string) {
  if (stage === "attack-result") return "명중 결과";
  if (stage === "interrupt") return "반응 대기";
  if (stage === "save-result") return "내성 결과";
  if (stage === "effect-preview") return "효과 확인";
  if (stage === "complete") return "완료";
  return "판정 중";
}

function utilityClass(active: SessionUtility, utility: Exclude<SessionUtility, null>) {
  return active === utility ? "active" : "";
}

export function SessionModeRoot({ onOpenProduct }: { onOpenProduct(): void }) {
  const { snapshot, refresh, resolveAction, startLevelUp, consumeCampaignLevelUpCredit, grantCampaignDmLibraryItem, revealCampaignDmLibraryImage, instantiateCampaignDmLibraryNpc } = useSimpleVtt();
  const handout = useSessionImageHandout();
  const [activeUtility, setActiveUtility] = useState<SessionUtility>(null);
  const [quickOpen,setQuickOpen]=useState(false);
  const [workspaceLayer, setWorkspaceLayer] = useState<WorkspaceLayer>(null);
  const [workspaceReturnUtility, setWorkspaceReturnUtility] = useState<SessionUtility>(null);
  const [levelUpRosterMemberId,setLevelUpRosterMemberId]=useState<string|null>(null);
  const [targetingActionId,setTargetingActionId]=useState<string|null>(null);
  const [targetingExecutionActionId,setTargetingExecutionActionId]=useState<string|null>(null);
  const [targetingAnchor,setTargetingAnchor]=useState<TargetingAnchor|null>(null);
  const [selectedTargetIds,setSelectedTargetIds]=useState<string[]>([]);
  const [targetingPending,setTargetingPending]=useState(false);
  const [targetingFeedback,setTargetingFeedback]=useState<string|null>(null);
  const [lastRollActorId,setLastRollActorId]=useState<string|null>(null);
  const [lastRollResolutionId,setLastRollResolutionId]=useState<string|null>(null);
  const [lastRollPresentation,setLastRollPresentation]=useState(()=>getSessionLastRollPresentationState(mockAdapter));
  const [libraryDropActive,setLibraryDropActive]=useState(false);
  const [libraryDropPending,setLibraryDropPending]=useState(false);
  const [libraryDropFeedback,setLibraryDropFeedback]=useState<{kind:"success"|"error";message:string}|null>(null);
  const lastLauncher = useRef<HTMLButtonElement | null>(null);
  const fullSheetLauncher = useRef<HTMLButtonElement | null>(null);
  const quickLauncher = useRef<HTMLButtonElement | null>(null);
  const playCore=useRef<HTMLDivElement|null>(null);
  const playerHandoutOpen = snapshot?.session.role === "client" && Boolean(handout.asset && !handout.dismissed);

  useEffect(()=>subscribeSessionLastRollPresentation(mockAdapter,setLastRollPresentation),[]);

  useEffect(()=>{
    setTargetingActionId(null);
    setTargetingExecutionActionId(null);
    setTargetingAnchor(null);
    setSelectedTargetIds([]);
    setTargetingFeedback(null);
  },[snapshot?.session.role,snapshot?.scene.selectedActorId,snapshot?.activeCharacter.id]);

  useEffect(()=>{
    if (!snapshot) return;
    if (snapshot.resolution?.actorId) { setLastRollActorId(snapshot.resolution.actorId);setLastRollResolutionId(snapshot.resolution.id);return; }
    if(lastRollActorId&&snapshot.scene.entities.some((entity)=>entity.id===lastRollActorId))return;
    const activityActor=snapshot.activity.find((entry)=>snapshot.scene.entities.some((entity)=>entity.name===entry.actor))?.actor;
    setLastRollActorId(snapshot.scene.entities.find((entity)=>entity.name===activityActor)?.id??null);
    setLastRollResolutionId(null);
  },[lastRollActorId,snapshot?.resolution?.id,snapshot?.scene.id,snapshot?.activity]);

  const closeUtility = () => {
    setActiveUtility(null);
    window.requestAnimationFrame(() => lastLauncher.current?.focus());
  };

  const closeQuick=()=>{
    setQuickOpen(false);
    window.requestAnimationFrame(()=>quickLauncher.current?.focus());
  };

  const chooseQuick=(destination:SessionQuickDestination)=>{
    lastLauncher.current=quickLauncher.current;
    setQuickOpen(false);
    setActiveUtility(destination);
  };

  const toggleUtility = (utility: Exclude<SessionUtility, null>, launcher: HTMLButtonElement) => {
    lastLauncher.current = launcher;
    setQuickOpen(false);
    setActiveUtility((current) => current === utility ? null : utility);
  };

  const openFullSheet = (launcher: HTMLButtonElement) => {
    fullSheetLauncher.current = launcher;
    setWorkspaceReturnUtility(activeUtility);
    setActiveUtility(null);
    setWorkspaceLayer("full-sheet");
  };

  const openTimeMeals=(launcher:HTMLButtonElement)=>{
    fullSheetLauncher.current=launcher;
    setActiveUtility(null);
    setWorkspaceReturnUtility(null);
    setWorkspaceLayer("time-meals");
  };

  const closeFullSheet = () => {
    setWorkspaceLayer(null);
    if (workspaceReturnUtility) {
      setActiveUtility(workspaceReturnUtility);
      setWorkspaceReturnUtility(null);
      return;
    }
    setWorkspaceReturnUtility(null);
    window.requestAnimationFrame(() => fullSheetLauncher.current?.focus());
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey||event.metaKey)&&event.key.toLocaleLowerCase()==="k") {
        if (snapshot?.session.role!=="host") return;
        event.preventDefault();
        setActiveUtility(null);
        setQuickOpen((current)=>!current);
        return;
      }
      if (event.key !== "Escape") return;
      if (playerHandoutOpen) {
        event.preventDefault();
        dismissCurrentSessionImageHandout();
        return;
      }
      if (quickOpen) {
        event.preventDefault();
        closeQuick();
        return;
      }
      if (targetingActionId) {
        event.preventDefault();
        setTargetingActionId(null);
        setTargetingExecutionActionId(null);
        setTargetingAnchor(null);
        setSelectedTargetIds([]);
        setTargetingFeedback(null);
        return;
      }
      if (workspaceLayer && activeUtility === "rules") {
        event.preventDefault();
        closeUtility();
        return;
      }
      if (workspaceLayer) {
        event.preventDefault();
        closeFullSheet();
        return;
      }
      if (activeUtility) {
        event.preventDefault();
        closeUtility();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeUtility, playerHandoutOpen, quickOpen, snapshot?.session.role, targetingActionId, workspaceLayer, workspaceReturnUtility]);

  if (!snapshot) return null;

  const role: "player" | "dm" = snapshot.session.role === "host" ? "dm" : "player";
  const passiveRemoteResolution=isNonBlockingRemoteResolution(snapshot);
  const sessionName = snapshot.session.name || snapshot.scene.name || "D&D 세션";
  const dmActor = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.selectedActorId)
    ?? snapshot.scene.entities[0]
    ?? null;
  const actionActorId = role === "dm" ? dmActor?.id ?? null : snapshot.activeCharacter.id;
  const actionList=actionActorId?snapshot.scene.actionsByActor[actionActorId]??[]:[];
  const targetingAction=targetingActionId?actionList.find((action)=>action.id===targetingActionId)??null:null;
  const targeting:SessionActionTargeting|null=targetingAction?{action:targetingAction,selectedTargetIds,pending:targetingPending,feedback:targetingFeedback}:null;
  const cancelTargeting=()=>{setTargetingActionId(null);setTargetingExecutionActionId(null);setTargetingAnchor(null);setSelectedTargetIds([]);setTargetingFeedback(null);};
  const beginTargeting=(action:ActionVm,fallbackAnchor:TargetingAnchor,executionActionId=action.id)=>{
    const actorCard=[...document.querySelectorAll<HTMLElement>(".session-actor-card[data-actor-id]")].find((element)=>element.dataset.actorId===action.actorId);
    const rect=actorCard?.getBoundingClientRect();
    setTargetingActionId(action.id);
    setTargetingExecutionActionId(executionActionId);
    setTargetingAnchor(rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:fallbackAnchor);
    setSelectedTargetIds([]);setTargetingFeedback(null);
  };
  const runTargeting=async(targetIds:string[])=>{
    if (!targetingAction||targetingPending) return;
    setTargetingPending(true);setTargetingFeedback(null);
    try { await resolveAction(targetingExecutionActionId??targetingAction.id,targetIds); cancelTargeting(); }
    catch { setTargetingFeedback("행동을 완료하지 못했습니다. 현재 상태를 확인하고 다시 시도하세요."); }
    finally { setTargetingPending(false); }
  };
  const chooseActorTarget=(entityId:string)=>{
    if (!targetingAction||targetingPending||!targetingAction.eligibleTargetIds.includes(entityId)) return;
    if ((targetingAction.maxTargets??1)<=1) { void runTargeting([entityId]); return; }
    const max=Math.max(1,targetingAction.maxTargets??targetingAction.eligibleTargetIds.length);
    if(targetingAction.allocation) {
      setSelectedTargetIds((current)=>current.length>=targetingAction.allocation!.units
        ? (()=>{const index=current.lastIndexOf(entityId);return index<0?current:current.filter((_,entryIndex)=>entryIndex!==index);})()
        : [...current,entityId]);
      return;
    }
    setSelectedTargetIds((current)=>current.includes(entityId)?current.filter((id)=>id!==entityId):current.length>=max?current:[...current,entityId]);
  };
  const connectionLabel = snapshot.connectionState === "connected"
    ? "연결됨"
    : snapshot.connectionState === "reconnecting"
      ? "재연결 중"
      : "연결 끊김";
  const campaignCalendar=snapshot.campaignSessionSystems?.calendar;
  const campaignRations=snapshot.campaignSessionSystems?.rations;
  const campaignClockAnchor=campaignCalendar?.displayAnchor;
  const campaignClockPeriod=campaignCalendar?.enabled&&campaignClockAnchor?campaignDayPeriod(campaignClockAnchor.hour??0):null;
  const campaignClockTime=campaignClockAnchor?`${String(campaignClockAnchor.hour??0).padStart(2,"0")}:${String(campaignClockAnchor.minute??0).padStart(2,"0")}`:"--:--";
  const campaignClockFull=campaignCalendar&&campaignClockAnchor?formatCampaignCalendarDateTime(campaignCalendar.providerId,campaignClockAnchor):"연결된 Campaign 달력 없음";
  const applyLibraryDrop=async(payload:SessionDmLibraryDropPayload,target:Element)=>{
    if(role!=="dm"||libraryDropPending)return;
    setLibraryDropActive(false);
    const actorElement=target.closest<HTMLElement>("[data-actor-id]");
    const explicitActorId=actorElement?.dataset.actorId??null;
    setLibraryDropPending(true);setLibraryDropFeedback(null);
    try{
      const activeCampaignId=snapshot.campaignSessionSnapshot?.campaignId??snapshot.activeCampaignId??null;
      if(!activeCampaignId||payload.campaignId!==activeCampaignId)throw new Error("현재 세션 캠페인의 라이브러리 항목만 사용할 수 있습니다.");
      const campaign=snapshot.campaigns?.find((candidate)=>candidate.campaignId===payload.campaignId);
      const entry=campaign?.dmLibrary.entries.find((candidate)=>candidate.entryId===payload.entryId&&candidate.kind===payload.kind);
      if(!campaign||!entry)throw new Error("현재 캠페인에서 라이브러리 항목을 찾지 못했습니다.");
      if(payload.kind==="npc-definition")await instantiateCampaignDmLibraryNpc(payload.campaignId,payload.entryId);
      else if(payload.kind==="pc-preset"){
        await mockAdapter.instantiateCampaignDmLibraryPcPreset(payload.campaignId,payload.entryId);
        await refresh();
      }else if(payload.kind==="image")await revealCampaignDmLibraryImage(payload.campaignId,payload.entryId);
      else if(payload.kind==="custom-item"){
        const explicitEntity=explicitActorId?snapshot.scene.entities.find((entity)=>entity.id===explicitActorId)??null:null;
        if(explicitEntity?.kind==="combatant")throw new Error("아이템은 Character Actor 카드에 놓아야 합니다.");
        const selectedCharacter=snapshot.scene.entities.find((entity)=>entity.id===snapshot.scene.selectedActorId&&entity.kind==="character")
          ?? snapshot.scene.entities.find((entity)=>entity.id===snapshot.activeCharacter.id&&entity.kind==="character")
          ?? null;
        const actorId=explicitEntity?.kind==="character"?explicitEntity.id:selectedCharacter?.id;
        if(!actorId)throw new Error("아이템을 받을 Character를 먼저 선택하거나 해당 Actor 카드에 놓으세요.");
        await grantCampaignDmLibraryItem(payload.campaignId,payload.entryId,{kind:"character",actorId},1);
      }else throw new Error("DM 노트는 실행 항목이 아닙니다.");
      const action=payload.kind==="image"?"플레이어에게 공개했습니다.":payload.kind==="custom-item"?"Character에게 1개 지급했습니다.":"장면에 Actor를 소환했습니다.";
      setLibraryDropFeedback({kind:"success",message:`${entry.label}: ${action}`});
    }catch(reason){setLibraryDropFeedback({kind:"error",message:reason instanceof Error?reason.message:"라이브러리 동작을 완료하지 못했습니다."});}
    finally{setLibraryDropPending(false);}
  };
  const handleLibraryPointerDrop=(payload:SessionDmLibraryDropPayload,clientX:number,clientY:number)=>{
    setLibraryDropActive(false);
    const target=document.elementFromPoint(clientX,clientY);
    if(!target||!playCore.current?.contains(target)){setLibraryDropFeedback({kind:"error",message:"라이브러리 항목을 세션 플레이 공간에 놓으세요."});return;}
    void applyLibraryDrop(payload,target);
  };

  const openSessionLevelUp=async(rosterMemberId:string)=>{
    setWorkspaceReturnUtility(activeUtility);
    setActiveUtility(null);
    setLevelUpRosterMemberId(rosterMemberId);
    await startLevelUp(snapshot!.activeCharacter.id);
    setWorkspaceLayer("level-up");
  };

  const closeSessionLevelUp=()=>{
    setWorkspaceLayer(null);
    setLevelUpRosterMemberId(null);
    if(workspaceReturnUtility){setActiveUtility(workspaceReturnUtility);setWorkspaceReturnUtility(null);}
  };

  const finishSessionLevelUp=()=>{
    const projection=snapshot!.campaignSessionSystems;
    const rosterMemberId=levelUpRosterMemberId;
    const nextLevel=snapshot!.activeCharacter.level+1;
    setWorkspaceLayer(null);
    setLevelUpRosterMemberId(null);
    setWorkspaceReturnUtility(null);
    if(projection&&rosterMemberId) void consumeCampaignLevelUpCredit(projection.campaignId,rosterMemberId,nextLevel);
  };

  const utilityPane = <>
    {activeUtility === "quick-sheet" && role === "player" && <QuickSheet onClose={closeUtility} onOpenFull={openFullSheet} />}
    {activeUtility === "actor" && role === "dm" && <SessionDmActorPane onClose={closeUtility} />}
    {activeUtility === "inventory" && role === "dm" && <SessionDmInventoryPane onClose={closeUtility} />}
    {activeUtility === "inventory" && role === "player" && <SessionPlayerInventoryPane onClose={closeUtility} onOpenFull={openFullSheet} />}
    {activeUtility === "library" && role === "dm" && <SessionDmLibraryPane onClose={closeUtility} onDragStateChange={setLibraryDropActive} onDrop={handleLibraryPointerDrop} />}
    {activeUtility === "encounter" && role === "dm" && <SessionDmEncounterPane onClose={closeUtility} />}
    {activeUtility === "participants" && role === "dm" && <SessionParticipantsPane onClose={closeUtility} />}
    {activeUtility === "handout" && role === "dm" && <SessionDmHandoutPane onClose={closeUtility} />}
    {activeUtility === "session" && role === "dm" && <SessionSharePane onClose={closeUtility} onOpenHandout={() => setActiveUtility("handout")} />}
    {activeUtility === "player-session" && role === "player" && <SessionPlayerSessionPane onClose={closeUtility} />}
    {activeUtility === "rules" && <SessionRulesPane onClose={closeUtility} />}
    {activeUtility === "activity" && <SessionActivityPane onClose={closeUtility} />}
    {activeUtility === "campaign" && <SessionCampaignPane role={role} view="overview" onClose={closeUtility} onOpenLevelUp={(rosterMemberId)=>void openSessionLevelUp(rosterMemberId)} />}
    {activeUtility === "calendar" && <SessionCampaignPane role={role} view="calendar" onClose={closeUtility} />}
    {activeUtility === "rations" && <SessionCampaignPane role={role} view="rations" onClose={closeUtility} />}
    {activeUtility === "rest" && <SessionCampaignPane role={role} view="rest" onClose={closeUtility} />}
  </>;

  return <div className="session-mode-root session-reference-play-root" data-session-role={role} data-session-mode={snapshot.sessionMode} data-workspace-layer={workspaceLayer??undefined}>
    <header className="session-reference-play-chrome">
      <button type="button" className="session-reference-chrome-button product" onClick={onOpenProduct}>← 제품</button>
      <div className="session-reference-play-title"><strong>{sessionName}</strong><span>{role === "dm" ? "호스트 · DM" : "클라이언트 · 플레이어"}</span></div>
      <span className={`session-reference-connection ${snapshot.connectionState}`}>{connectionLabel}</span>
      <nav className="session-reference-system-tabs" aria-label="캠페인 시스템">
        <div className="session-reference-campaign-clock-wrap">
          <button type="button" className={`session-reference-campaign-clock ${campaignClockPeriod?.id??"disabled"} ${workspaceLayer==="time-meals"?"active":utilityClass(activeUtility,"calendar")}`} aria-label={`Campaign 시간 · ${campaignClockPeriod?.label??"추적 꺼짐"} · ${campaignClockFull}`} title={role==="dm"?`${campaignClockFull} · 시간·식사 관리 열기`:campaignClockFull} onClick={(event)=>role==="dm"?openTimeMeals(event.currentTarget):toggleUtility("calendar",event.currentTarget)}><i/><span>시간</span><strong>{campaignCalendar?.enabled?`${campaignClockPeriod?.label??""} ${campaignClockTime}`.trim():"OFF"}</strong></button>
        </div>
        <button type="button" className={`session-reference-system-tab ${workspaceLayer==="time-meals"?"active":utilityClass(activeUtility,"rations")}`} aria-label={`식량 · ${campaignRations?.enabled?`${campaignRations.balance??0}식`:"사용 안 함"}`} onClick={(event)=>role==="dm"?openTimeMeals(event.currentTarget):toggleUtility("rations",event.currentTarget)}><span>식량</span><strong>{campaignRations?.enabled?`${campaignRations.balance??0}`:"OFF"}</strong></button>
        <button type="button" className={`session-reference-system-tab rest ${utilityClass(activeUtility,"rest")}`} onClick={(event)=>toggleUtility("rest",event.currentTarget)}><span>휴식</span><strong>{role==="dm"?"관리":"확인"}</strong></button>
      </nav>
      <div className="session-reference-play-spacer" />
      <button type="button" className={utilityClass(activeUtility, role === "player" ? "quick-sheet" : "actor")} onClick={(event) => toggleUtility(role === "player" ? "quick-sheet" : "actor", event.currentTarget)}>시트</button>
      <button type="button" className={utilityClass(activeUtility, "inventory")} onClick={(event) => toggleUtility("inventory", event.currentTarget)}>{role === "dm" ? "아이템" : "인벤토리"}</button>
      {role === "dm" && <button type="button" className={utilityClass(activeUtility, "library")} onClick={(event) => toggleUtility("library", event.currentTarget)}>라이브러리</button>}
      <button type="button" className={utilityClass(activeUtility, "campaign")} onClick={(event) => toggleUtility("campaign", event.currentTarget)}>파티</button>
      <button type="button" className={utilityClass(activeUtility, "rules")} onClick={(event) => toggleUtility("rules", event.currentTarget)}>규칙</button>
      {role === "dm" && <div className="session-reference-visibility" aria-label="Public / DM Only 전달 프로토콜은 아직 production contract가 없어 Public 상태만 표시됩니다." title="DM Only 전달은 GAP-DM-ONLY-DELIVERY-PROTOCOL 해결 전까지 사용할 수 없습니다."><span className="active">Public</span><span>DM Only</span></div>}
      <button type="button" className={utilityClass(activeUtility, "activity")} onClick={(event) => toggleUtility("activity", event.currentTarget)}>기록</button>
      {role === "dm" && <button type="button" className={utilityClass(activeUtility, "encounter")} onClick={(event) => toggleUtility("encounter", event.currentTarget)}>인카운터</button>}
      {role === "dm" && <button ref={quickLauncher} type="button" className={quickOpen?"active session-reference-quick-button":"session-reference-quick-button"} aria-expanded={quickOpen} aria-controls="session-quick-panel" onClick={()=>{setActiveUtility(null);setQuickOpen((current)=>!current);}}>＋ 빠른 메뉴</button>}
      {role === "player" && <SessionPlayerHandoutRailButton />}
      <button type="button" className={utilityClass(activeUtility, role === "dm" ? "session" : "player-session")} onClick={(event) => toggleUtility(role === "dm" ? "session" : "player-session", event.currentTarget)}>세션</button>
    </header>

    <div className={`session-reference-play-main ${activeUtility||quickOpen ? "utility-open" : ""}`}>
      <div ref={playCore} className={`session-reference-play-core ${libraryDropActive?"dm-library-drag-active":""}`}>
        <SessionActorBoard position="upper" role={role} targetingAction={targetingAction} selectedTargetIds={selectedTargetIds} targetingPending={targetingPending} onTarget={chooseActorTarget} />

        <section className="session-play-context session-reference-mapless-stage" aria-label="Mapless Play Context">
          <div className="session-reference-stage-label" aria-hidden="true"><strong>테이블 플레이 공간</strong><span>지도 없이 현재 맥락과 결과만 표시</span></div>
          <SessionInitiativeStrip role={role} />
          <main className="session-reference-stage-focus" aria-label="현재 세션">
            {snapshot.sessionMode==="freeform"&&<SessionPlayerHandoutViewer />}
            {role==="dm"&&<SessionDmHandoutPreview />}
            <SessionMainFocus role={role} lastRollActorId={lastRollActorId} lastRollHidden={Boolean(lastRollResolutionId&&lastRollPresentation.dismissedResolutionId===lastRollResolutionId)} onDismissLastRoll={lastRollResolutionId?()=>dismissSessionLastRoll(mockAdapter,lastRollResolutionId):undefined} />
          </main>
        </section>

        <SessionActorBoard position="lower" role={role} targetingAction={targetingAction} selectedTargetIds={selectedTargetIds} targetingPending={targetingPending} onTarget={chooseActorTarget} />
        {libraryDropActive&&<div className="session-dm-library-drop-guide" aria-hidden="true"><div><strong>{libraryDropPending?"적용 중…":"라이브러리 항목 놓기"}</strong><span>Actor 소환 · 이미지 공개 · Character 아이템 지급</span></div></div>}
        {libraryDropFeedback&&<div className={`session-dm-library-drop-feedback ${libraryDropFeedback.kind}`} role="status">{libraryDropFeedback.message}</div>}
      </div>

      {(activeUtility||quickOpen) && <aside id="session-quick-panel" className="session-reference-utility-host" aria-label={quickOpen?"세션 빠른 메뉴 패널":"Contextual Session Utility"}>{quickOpen?<SessionQuickPalette role={role} onClose={closeQuick} onChoose={chooseQuick}/>:utilityPane}</aside>}
    </div>

    <footer className="session-mode-action-dock" aria-label="Command Center">
      <SessionActionDock
        actorId={actionActorId}
        suspended={Boolean(workspaceLayer || snapshot.resolution&&!passiveRemoteResolution)}
        targeting={targeting}
        onBeginTargeting={beginTargeting}
        onCancelTargeting={cancelTargeting}
        onExecuteTargeting={()=>void runTargeting(selectedTargetIds)}
      />
    </footer>

    <div className="session-mode-layer-host session-reference-layer-host" aria-live="polite">
      {role === "player" && <div className="session-full-sheet-layer" hidden={workspaceLayer !== "full-sheet"} aria-hidden={workspaceLayer !== "full-sheet"}>
        <CharacterSheetWorkspace hostMode="session" onClose={closeFullSheet} onOpenRules={(button) => toggleUtility("rules", button)} />
      </div>}
      {workspaceLayer==="level-up"&&<div className="session-levelup-layer content" aria-label="세션 내 레벨업"><LevelUpScreen onDone={finishSessionLevelUp} onCancel={closeSessionLevelUp}/></div>}
      {role==="dm"&&workspaceLayer==="time-meals"&&<SessionDmTimeMealManager onClose={closeFullSheet}/>}
      {snapshot.resolution && activeUtility !== "activity" && <SessionResolutionLayer onOpenActivity={(button) => toggleUtility("activity", button)} />}
      {role === "player" && activeUtility !== "player-session" && <SessionPlayerRecoveryStrip onOpen={(button) => toggleUtility("player-session", button)} />}
      {role === "player" && <SessionPlayerHandoutError />}
    </div>
    {targetingAction&&targetingAnchor&&<SessionTargetingCursor anchor={targetingAnchor} label={targetingAction.name} targetIds={selectedTargetIds}/>}
  </div>;
}

function QuickSheet({ onClose, onOpenFull }: { onClose(): void; onOpenFull(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  const character = snapshot.activeCharacter;
  const view = projectOfficialSheet(character);
  const sceneCharacter = snapshot.scene.entities.find((entity) => entity.id === character.id);
  const attacks = (snapshot.scene.actionsByActor[character.id] ?? [])
    .filter((action) => action.category === "weapon" || action.resolutionKind === "attack")
    .slice(0, 4);
  const portrait = sanitizeCharacterPortrait(character.portrait);
  const initials = character.name.trim().slice(0, 2) || "PC";

  return <aside className="session-quick-sheet" aria-label={`${character.name} 빠른 캐릭터 시트`}>
    <header className="session-quick-sheet-head">
      <div className="session-quick-sheet-person">
        <span className="session-quick-sheet-portrait">{portrait ? <img src={portrait.asset.dataUrl} alt={`${character.name} 초상화`} style={{ objectPosition: `${portrait.focalX * 100}% ${portrait.focalY * 100}%` }} /> : initials}</span>
        <div><strong>{character.name}</strong><small>{character.className} {character.level}{character.subclassName ? ` · ${character.subclassName}` : ""}</small></div>
      </div>
      <div className="session-quick-sheet-head-actions"><button type="button" className="session-quick-sheet-full" onClick={(event) => onOpenFull(event.currentTarget)}>전체 시트</button><button type="button" className="session-quick-sheet-close" autoFocus aria-label="빠른 시트 닫기" onClick={onClose}>×</button></div>
    </header>

    <section className="session-quick-sheet-vitals" aria-label="핵심 수치">
      <div><span>HP</span><strong>{character.hp}/{character.maxHp}</strong>{character.tempHp > 0 && <small>+{character.tempHp} 임시</small>}</div>
      <div><span>AC</span><strong>{character.ac}</strong></div>
    </section>

    <section className="session-quick-sheet-stats" aria-label="참조 수치">
      <div><span>이동</span><strong>{character.speed} ft</strong></div>
      <div><span>우선권</span><strong>{signed(sheetAbilityModifier(character, "dex"))}</strong></div>
      <div><span>숙련</span><strong>+{character.proficiencyBonus}</strong></div>
      <div><span>수동 지각</span><strong>{view.passivePerception}</strong></div>
    </section>

    {sceneCharacter?.status.length ? <section className="session-quick-sheet-section"><h2>상태</h2><div className="session-quick-sheet-chips">{sceneCharacter.status.map((status) => <span key={status}>{status}</span>)}</div></section> : null}

    {visibleCharacterResources(character.resources).length ? <section className="session-quick-sheet-section"><h2>주요 자원</h2><div className="session-quick-sheet-list">{visibleCharacterResources(character.resources).slice(0, 6).map((resource) => <div key={resource.id}><span>{resource.label}</span><strong>{resource.current}/{resource.max}</strong></div>)}</div></section> : null}

    <section className="session-quick-sheet-section"><h2>자주 쓰는 공격</h2>{attacks.length ? <div className="session-quick-sheet-attacks">{attacks.map((attack) => <div key={attack.id} className={!attack.available ? "disabled" : ""}><div><strong>{attack.name}</strong><small>{attack.attackBonus !== undefined ? `명중 ${signed(attack.attackBonus)}` : attack.summary}</small></div><span>{actionDamageSummary(attack)}</span>{!attack.available && <em>{attack.disabledReason || "현재 사용할 수 없습니다."}</em>}</div>)}</div> : <p className="session-quick-sheet-empty">현재 표시할 공격이 없습니다.</p>}</section>

    <section className="session-quick-sheet-section"><h2>능력치</h2><div className="session-quick-sheet-abilities">{(["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => <div key={ability}><span>{({ str: "근", dex: "민", con: "건", int: "지", wis: "혜", cha: "매" } as const)[ability]}</span><strong>{signed(sheetAbilityModifier(character, ability))}</strong></div>)}</div></section>
  </aside>;
}

function SessionResolutionLayer({ onOpenActivity }: { onOpenActivity(button: HTMLButtonElement): void }) {
  const { snapshot, advanceResolution, respondToInterrupt, dismissResolution, undoLastResolution, applyDmAdjudication } = useSimpleVtt();
  const [abilityCheckDc,setAbilityCheckDc]=useState(15);
  const resolution = snapshot?.resolution;
  const diceAnimated = Boolean(resolution && ANIMATED_RESOLUTION_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);
  const passiveRemote=Boolean(snapshot&&isNonBlockingRemoteResolution(snapshot));
  const awaitingAbilityCheckDc=Boolean(snapshot?.session.role==="host"&&resolution?.rollKind==="check"&&resolution.stage==="effect-preview"&&resolution.checkTarget===undefined);

  useEffect(()=>setAbilityCheckDc(15),[resolution?.id]);

  useEffect(() => {
    if (!resolution || !diceAnimated || !resolution.canAdvance || passiveRemote) return;
    const reduced = isReducedMotionPreferred();
    const timer = window.setTimeout(
      () => void advanceResolution(),
      reduced ? VISUAL_DICE_REDUCED_REPLAY_MS : VISUAL_DICE_REPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [resolution?.id, resolution?.stage, resolution?.canAdvance, diceAnimated, passiveRemote, advanceResolution]);

  if (!snapshot || !resolution || diceAnimated) return null;

  const actorName = snapshot.scene.entities.find((entity) => entity.id === resolution.actorId)?.name
    ?? (snapshot.activeCharacter.id === resolution.actorId ? snapshot.activeCharacter.name : "Actor");
  const mainOutcome = resolution.interrupt
    ? `${resolution.interrupt.responderName} · ${resolution.interrupt.optionName}`
    : resolution.stage === "attack-result" && resolution.attackOutcome
      ? `${resolution.attackOutcome}${resolution.attackTotal !== undefined ? ` ${resolution.attackTotal}` : ""}${resolution.targetAc !== undefined ? ` vs AC ${resolution.targetAc}` : ""}`
      : resolution.stage === "save-result" && resolution.saveResults.length > 0
        ? resolution.saveResults.map((save) => `${save.targetName} ${save.outcome} · ${save.total} vs DC ${save.dc}`).join(" · ")
        : resolution.stage === "complete"
          ? resolution.finalOutcome || resolution.compact || resolution.calculatedOutcome
          : resolution.compact || resolution.calculatedOutcome;
  const stateSummary = resolution.stage === "complete" ? resolution.stateChanges.slice(0, 2).join(" · ") : "";

  if(passiveRemote)return <section className="session-resolution-layer session-resolution-notice" role="status" aria-live="polite" aria-label="원격 판정 알림">
    <div className="session-resolution-copy"><span>{actorName} · {resolution.actionName}</span><strong>{mainOutcome}</strong>{stateSummary&&<p>{stateSummary}</p>}</div>
  </section>;

  return <section className={`session-resolution-layer ${resolution.stage === "complete" ? "complete" : "step"}`} role="status" aria-label="판정 결과" data-resolution-stage={resolution.stage}>
    <div className="session-resolution-copy">
      <span>{actorName} · {resolution.actionName}</span>
      <strong>{mainOutcome}</strong>
      {stateSummary && <p>{stateSummary}</p>}
    </div>
    <span className="session-resolution-stage">{resolutionStageCopy(resolution.stage)}</span>
    {resolution.interrupt && <div className="session-resolution-actions"><button className="primary" type="button" onClick={() => void respondToInterrupt(true)}>사용</button><button type="button" onClick={() => void respondToInterrupt(false)}>넘기기</button></div>}
    {awaitingAbilityCheckDc&&<form className="session-resolution-dc" aria-label="능력 판정 난이도 설정" onSubmit={(event)=>{event.preventDefault();void applyDmAdjudication({type:"ability-check-dc",value:abilityCheckDc,scope:"resolution"});}}>
      <label><span>공개 DC</span><input type="number" min={1} max={99} required value={abilityCheckDc} onChange={(event)=>setAbilityCheckDc(Number(event.target.value))}/></label>
      <div aria-label="표준 난이도">{[5,10,15,20,25,30].map((dc)=><button type="button" key={dc} onClick={()=>void applyDmAdjudication({type:"ability-check-dc",value:dc,scope:"resolution"})}>{dc}</button>)}</div>
      <button className="primary" type="submit">판정 확정</button>
    </form>}
    {!resolution.interrupt && resolution.canAdvance && <button className="primary session-resolution-next" type="button" onClick={() => void advanceResolution()}>{resolution.nextLabel ?? "계속"}</button>}
    {resolution.stage === "complete" && <div className="session-resolution-actions"><button type="button" onClick={(event) => onOpenActivity(event.currentTarget)}>상세</button>{snapshot.session.role === "host" && <button type="button" onClick={() => void undoLastResolution()}>되돌리기</button>}<button className="primary" type="button" onClick={() => void dismissResolution()}>닫기</button></div>}
  </section>;
}
