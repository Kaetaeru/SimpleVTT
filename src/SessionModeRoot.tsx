import { useEffect, useRef, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { projectOfficialSheet, signed } from "./app/characterSheetV10Projection";
import { VISUAL_DICE_REDUCED_REPLAY_MS, VISUAL_DICE_REPLAY_MS } from "./app/diceVisuals";
import { sheetAbilityModifier } from "./app/sheetRollValues";
import { CharacterSheetWorkspace } from "./CharacterSheetPlayScreen";
import { SessionActionDock } from "./SessionActionDock";
import { SessionActorBoard } from "./SessionActorBoards";
import { SessionDmActorPane, SessionDmEncounterPane, SessionParticipantsPane, SessionSharePane } from "./SessionDmTools";
import {
  dismissCurrentSessionImageHandout,
  SessionDmHandoutPane,
  SessionPlayerHandoutError,
  SessionPlayerHandoutRailButton,
  SessionPlayerHandoutViewer,
  useSessionImageHandout,
} from "./SessionImageHandoutBridge";
import { SessionInitiativeStrip } from "./SessionInitiativeStrip";
import { SessionMainFocus } from "./SessionMainFocus";
import { SessionPlayerRecoveryStrip, SessionPlayerSessionPane } from "./SessionPlayerSession";
import { SessionActivityPane, SessionRulesPane } from "./SessionUtilityPanes";
import "./session-mode.css";
import "./session-connected-layout.css";

type SessionUtility = "quick-sheet" | "actor" | "rules" | "encounter" | "participants" | "handout" | "activity" | "session" | "player-session" | null;
type WorkspaceLayer = "full-sheet" | null;

const ANIMATED_RESOLUTION_STAGES = new Set(["roll-animation", "save-animation", "damage-animation"]);

function actionDamageSummary(action: ActionVm) {
  if (!action.damage?.length) return action.summary;
  return action.damage
    .map((part) => `${part.dice}${part.flat ? signed(part.flat) : ""} ${part.type}`)
    .join(" + ");
}

function connectionCopy(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "reconnecting") return "다시 연결하는 중…";
  if (state === "disconnected") return "연결이 끊어졌습니다";
  return "";
}

function resolutionStageCopy(stage: string) {
  return ({
    "attack-result": "명중 결과",
    interrupt: "반응 대기",
    "save-result": "내성 결과",
    "effect-preview": "효과 확인",
    complete: "완료",
  } as Record<string, string>)[stage] ?? "판정 중";
}

export function SessionModeRoot() {
  const { snapshot, stopSession } = useSimpleVtt();
  const handout = useSessionImageHandout();
  const [activeUtility, setActiveUtility] = useState<SessionUtility>(null);
  const [workspaceLayer, setWorkspaceLayer] = useState<WorkspaceLayer>(null);
  const [workspaceReturnUtility, setWorkspaceReturnUtility] = useState<SessionUtility>(null);
  const lastLauncher = useRef<HTMLButtonElement | null>(null);
  const fullSheetLauncher = useRef<HTMLButtonElement | null>(null);
  const playerHandoutOpen = snapshot?.session.role === "client" && Boolean(handout.asset && !handout.dismissed);

  const closeUtility = () => {
    setActiveUtility(null);
    window.requestAnimationFrame(() => lastLauncher.current?.focus());
  };

  const toggleUtility = (utility: Exclude<SessionUtility, null>, launcher: HTMLButtonElement) => {
    lastLauncher.current = launcher;
    setActiveUtility((current) => current === utility ? null : utility);
  };

  const openFullSheet = (launcher: HTMLButtonElement) => {
    fullSheetLauncher.current = launcher;
    setWorkspaceReturnUtility(activeUtility);
    setActiveUtility(null);
    setWorkspaceLayer("full-sheet");
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
      if (event.key !== "Escape") return;
      if (playerHandoutOpen) {
        event.preventDefault();
        dismissCurrentSessionImageHandout();
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
  }, [activeUtility, playerHandoutOpen, workspaceLayer, workspaceReturnUtility]);

  if (!snapshot) return null;

  const role: "player" | "dm" = snapshot.session.role === "host" ? "dm" : "player";
  const sessionName = snapshot.session.name || snapshot.scene.name || "D&D 세션";
  const dmActor = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.selectedActorId)
    ?? snapshot.scene.entities[0]
    ?? null;
  const actionActorId = role === "dm" ? dmActor?.id ?? null : snapshot.activeCharacter.id;
  const connectionWarning = connectionCopy(snapshot.connectionState);

  return <div className="session-mode-root" data-session-role={role} data-session-mode={snapshot.sessionMode}>
    <header className="session-mode-bar">
      <div className="session-mode-identity">
        <strong>{sessionName}</strong>
        <span>{snapshot.sessionMode === "initiative" ? `이니셔티브 · ${snapshot.scene.round}라운드` : "자유 진행"}</span>
      </div>

      <div className="session-mode-status" aria-live="polite">
        {connectionWarning && <span className={`session-mode-connection ${snapshot.connectionState}`}>{connectionWarning}</span>}
        {snapshot.sessionMode === "initiative" && snapshot.scene.currentActorId && <span>현재 턴 · {snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.currentActorId)?.name ?? "—"}</span>}
      </div>

      <div className="session-mode-role-controls">
        {role === "player"
          ? <>
            <PlayerIdentityControls onOpenQuick={(button) => toggleUtility("quick-sheet", button)} onOpenFull={openFullSheet} />
            <button type="button" className="session-mode-exit" aria-label="Player 세션 연결 열기" onClick={(event) => toggleUtility("player-session", event.currentTarget)}>연결</button>
          </>
          : <>
            <DmActorIdentityButton actor={dmActor} onOpen={(button) => toggleUtility("actor", button)} />
            <button type="button" className="session-mode-exit" onClick={() => void stopSession()}>세션 종료</button>
          </>}
      </div>
    </header>

    <div className="session-play-workspace">
      <SessionActorBoard position="upper" role={role} />

      <section className="session-play-context" aria-label="Tabletop Stage">
        <SessionInitiativeStrip role={role} />
        <div className="session-mode-body">
          <main className="session-mode-main" aria-label="현재 세션">
            <SessionMainFocus role={role} onOpenActivity={(button) => toggleUtility("activity", button)} />
          </main>

          <aside className="session-mode-rail" aria-label="세션 도구">
            {role === "player"
              ? <button type="button" className={activeUtility === "quick-sheet" ? "active" : ""} aria-pressed={activeUtility === "quick-sheet"} aria-label="빠른 캐릭터 시트 열기" onClick={(event) => toggleUtility("quick-sheet", event.currentTarget)}><span>시트</span></button>
              : <button type="button" className={activeUtility === "actor" ? "active" : ""} aria-pressed={activeUtility === "actor"} aria-label="행동할 Actor 열기" onClick={(event) => toggleUtility("actor", event.currentTarget)}><span>Actor</span></button>}
            <button type="button" className={activeUtility === "rules" ? "active" : ""} aria-pressed={activeUtility === "rules"} aria-label="세션 규칙 찾아보기" onClick={(event) => toggleUtility("rules", event.currentTarget)}><span>규칙</span></button>
            {role === "dm" && <button type="button" className={activeUtility === "encounter" ? "active" : ""} aria-pressed={activeUtility === "encounter"} aria-label="Encounter 도구 열기" onClick={(event) => toggleUtility("encounter", event.currentTarget)}><span>Encounter</span></button>}
            {role === "dm" && <button type="button" className={activeUtility === "participants" ? "active" : ""} aria-pressed={activeUtility === "participants"} aria-label="참가자 보기" onClick={(event) => toggleUtility("participants", event.currentTarget)}><span>참가자</span></button>}
            {role === "dm" && <button type="button" className={activeUtility === "handout" ? "active" : ""} aria-pressed={activeUtility === "handout"} aria-label="Handout 도구 열기" onClick={(event) => toggleUtility("handout", event.currentTarget)}><span>자료</span></button>}
            <button type="button" className={activeUtility === "activity" ? "active" : ""} aria-pressed={activeUtility === "activity"} aria-label="최근 세션 결과 보기" onClick={(event) => toggleUtility("activity", event.currentTarget)}><span>기록</span></button>
            {role === "player" && <SessionPlayerHandoutRailButton />}
            {role === "player" && <button type="button" className={activeUtility === "player-session" ? "active" : ""} aria-pressed={activeUtility === "player-session"} aria-label="Player 세션 연결 열기" onClick={(event) => toggleUtility("player-session", event.currentTarget)}><span>세션</span></button>}
            {role === "dm" && <button type="button" className={activeUtility === "session" ? "active" : ""} aria-pressed={activeUtility === "session"} aria-label="세션 공유 정보 열기" onClick={(event) => toggleUtility("session", event.currentTarget)}><span>세션</span></button>}
          </aside>
        </div>
      </section>

      <SessionActorBoard position="lower" role={role} />
    </div>

    <footer className="session-mode-action-dock" aria-label="Command Center">
      <SessionActionDock
        actorId={actionActorId}
        suspended={Boolean(activeUtility || workspaceLayer || snapshot.resolution || playerHandoutOpen)}
        onOpenRules={(button) => toggleUtility("rules", button)}
      />
    </footer>

    <div className="session-mode-layer-host" aria-live="polite">
      {activeUtility === "quick-sheet" && role === "player" && <QuickSheet onClose={closeUtility} onOpenFull={openFullSheet} />}
      {activeUtility === "actor" && role === "dm" && <SessionDmActorPane onClose={closeUtility} />}
      {activeUtility === "encounter" && role === "dm" && <SessionDmEncounterPane onClose={closeUtility} />}
      {activeUtility === "participants" && role === "dm" && <SessionParticipantsPane onClose={closeUtility} />}
      {activeUtility === "handout" && role === "dm" && <SessionDmHandoutPane onClose={closeUtility} />}
      {activeUtility === "session" && role === "dm" && <SessionSharePane onClose={closeUtility} />}
      {activeUtility === "player-session" && role === "player" && <SessionPlayerSessionPane onClose={closeUtility} />}
      {role === "player" && <div className="session-full-sheet-layer" hidden={workspaceLayer !== "full-sheet"} aria-hidden={workspaceLayer !== "full-sheet"}>
        <CharacterSheetWorkspace hostMode="session" onClose={closeFullSheet} onOpenRules={(button) => toggleUtility("rules", button)} />
      </div>}
      {activeUtility === "rules" && <SessionRulesPane onClose={closeUtility} />}
      {activeUtility === "activity" && <SessionActivityPane onClose={closeUtility} />}
      {snapshot.resolution && activeUtility !== "activity" && <SessionResolutionLayer onOpenActivity={(button) => toggleUtility("activity", button)} />}
      {role === "player" && activeUtility !== "player-session" && <SessionPlayerRecoveryStrip onOpen={(button) => toggleUtility("player-session", button)} />}
      {role === "player" && <SessionPlayerHandoutError />}
      {role === "player" && <SessionPlayerHandoutViewer />}
    </div>
  </div>;
}

function PlayerIdentityControls({ onOpenQuick, onOpenFull }: { onOpenQuick(button: HTMLButtonElement): void; onOpenFull(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  const character = snapshot.activeCharacter;
  const portrait = sanitizeCharacterPortrait(character.portrait);
  const initials = character.name.trim().slice(0, 2) || "PC";

  return <div className="session-mode-player-sheet-controls">
    <button type="button" className="session-mode-character-chip" aria-label={`${character.name} 빠른 캐릭터 시트 열기`} onClick={(event) => onOpenQuick(event.currentTarget)}>
      <span className="session-mode-avatar">{portrait ? <img src={portrait.asset.dataUrl} alt="" style={{ objectPosition: `${portrait.focalX * 100}% ${portrait.focalY * 100}%` }} /> : initials}</span>
      <span className="session-mode-chip-copy"><strong>{character.name}</strong><small>HP {character.hp}/{character.maxHp}</small></span>
    </button>
    <button type="button" className="session-mode-full-sheet-launcher" aria-label={`${character.name} 전체 캐릭터 시트 열기`} onClick={(event) => onOpenFull(event.currentTarget)}>전체 시트</button>
  </div>;
}

function DmActorIdentityButton({ actor, onOpen }: { actor: SceneEntity | null; onOpen(button: HTMLButtonElement): void }) {
  return <button type="button" className="session-mode-character-chip" aria-label="현재 Actor 빠른 보기" onClick={(event) => onOpen(event.currentTarget)}>
    <span className="session-mode-avatar">{actor?.name.trim().slice(0, 2) || "DM"}</span>
    <span className="session-mode-chip-copy"><strong>{actor?.name ?? "DM"}</strong><small>{actor ? `HP ${actor.hp}/${actor.maxHp}` : "Actor 없음"}</small></span>
  </button>;
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

    {character.resources.length ? <section className="session-quick-sheet-section"><h2>주요 자원</h2><div className="session-quick-sheet-list">{character.resources.slice(0, 6).map((resource) => <div key={resource.id}><span>{resource.label}</span><strong>{resource.current}/{resource.max}</strong></div>)}</div></section> : null}

    <section className="session-quick-sheet-section"><h2>자주 쓰는 공격</h2>{attacks.length ? <div className="session-quick-sheet-attacks">{attacks.map((attack) => <div key={attack.id} className={!attack.available ? "disabled" : ""}><div><strong>{attack.name}</strong><small>{attack.attackBonus !== undefined ? `명중 ${signed(attack.attackBonus)}` : attack.summary}</small></div><span>{actionDamageSummary(attack)}</span>{!attack.available && <em>{attack.disabledReason || "현재 사용할 수 없습니다."}</em>}</div>)}</div> : <p className="session-quick-sheet-empty">현재 표시할 공격이 없습니다.</p>}</section>

    <section className="session-quick-sheet-section"><h2>능력치</h2><div className="session-quick-sheet-abilities">{(["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => <div key={ability}><span>{({ str: "근", dex: "민", con: "건", int: "지", wis: "혜", cha: "매" } as const)[ability]}</span><strong>{signed(sheetAbilityModifier(character, ability))}</strong></div>)}</div></section>
  </aside>;
}

function SessionResolutionLayer({ onOpenActivity }: { onOpenActivity(button: HTMLButtonElement): void }) {
  const { snapshot, advanceResolution, respondToInterrupt, dismissResolution, undoLastResolution } = useSimpleVtt();
  const resolution = snapshot?.resolution;
  const diceAnimated = Boolean(resolution && ANIMATED_RESOLUTION_STAGES.has(resolution.stage) && resolution.authoritativeDice.length > 0);

  useEffect(() => {
    if (!resolution || !diceAnimated || !resolution.canAdvance) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    const timer = window.setTimeout(
      () => void advanceResolution(),
      reduced ? VISUAL_DICE_REDUCED_REPLAY_MS : VISUAL_DICE_REPLAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [resolution?.id, resolution?.stage, resolution?.canAdvance, diceAnimated, advanceResolution]);

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

  return <section className={`session-resolution-layer ${resolution.stage === "complete" ? "complete" : "step"}`} role="status" aria-label="판정 결과" data-resolution-stage={resolution.stage}>
    <div className="session-resolution-copy">
      <span>{actorName} · {resolution.actionName}</span>
      <strong>{mainOutcome}</strong>
      {stateSummary && <p>{stateSummary}</p>}
    </div>
    <span className="session-resolution-stage">{resolutionStageCopy(resolution.stage)}</span>
    {resolution.interrupt && <div className="session-resolution-actions"><button className="primary" type="button" onClick={() => void respondToInterrupt(true)}>사용</button><button type="button" onClick={() => void respondToInterrupt(false)}>넘기기</button></div>}
    {!resolution.interrupt && resolution.canAdvance && <button className="primary session-resolution-next" type="button" onClick={() => void advanceResolution()}>{resolution.nextLabel ?? "계속"}</button>}
    {resolution.stage === "complete" && <div className="session-resolution-actions"><button type="button" onClick={(event) => onOpenActivity(event.currentTarget)}>상세</button>{snapshot.session.role === "host" && <button type="button" onClick={() => void undoLastResolution()}>되돌리기</button>}<button className="primary" type="button" onClick={() => void dismissResolution()}>닫기</button></div>}
  </section>;
}
