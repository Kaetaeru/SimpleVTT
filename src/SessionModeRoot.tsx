import { useEffect, useRef, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import { projectOfficialSheet, signed } from "./app/characterSheetV10Projection";
import { sheetAbilityModifier } from "./app/sheetRollValues";
import { CharacterSheetWorkspace } from "./CharacterSheetPlayScreen";
import "./session-mode.css";

type SessionUtility = "quick-sheet" | "actor" | null;
type WorkspaceLayer = "full-sheet" | null;

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

export function SessionModeRoot() {
  const { snapshot, stopSession } = useSimpleVtt();
  const [activeUtility, setActiveUtility] = useState<SessionUtility>(null);
  const [workspaceLayer, setWorkspaceLayer] = useState<WorkspaceLayer>(null);
  const [workspaceReturnUtility, setWorkspaceReturnUtility] = useState<SessionUtility>(null);
  const lastLauncher = useRef<HTMLButtonElement | null>(null);
  const fullSheetLauncher = useRef<HTMLButtonElement | null>(null);

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
  }, [activeUtility, workspaceLayer, workspaceReturnUtility]);

  if (!snapshot) return null;

  const role: "player" | "dm" = snapshot.session.role === "host" ? "dm" : "player";
  const sessionName = snapshot.session.name || snapshot.scene.name || "D&D 세션";
  const dmActor = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.selectedActorId)
    ?? snapshot.scene.entities[0]
    ?? null;
  const recentActivity = snapshot.activity[0];
  const connectedPlayers = snapshot.session.participants.filter((participant) => participant.state === "connected").length;
  const combatants = snapshot.scene.entities.filter((entity) => entity.kind === "combatant");
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
          ? <PlayerIdentityControls onOpenQuick={(button) => toggleUtility("quick-sheet", button)} onOpenFull={openFullSheet} />
          : <DmActorIdentityButton actor={dmActor} onOpen={(button) => toggleUtility("actor", button)} />}
        <button type="button" className="session-mode-exit" onClick={() => void stopSession()}>{role === "dm" ? "세션 종료" : "세션 나가기"}</button>
      </div>
    </header>

    <div className="session-mode-body">
      <main className="session-mode-main" aria-label="현재 세션">
        <div className="session-mode-main-copy">
          <span className="eyebrow accent">{role === "dm" ? "DM SESSION" : "ACTIVE SESSION"}</span>
          <h1>{snapshot.scene.name || sessionName}</h1>
          {recentActivity
            ? <section className="session-mode-recent" aria-label="최근 결과"><span>최근 결과</span><strong>{recentActivity.title}</strong><p>{recentActivity.summary}</p></section>
            : <p className="session-mode-quiet-copy">세션의 대화와 탐험을 방해하지 않도록 필요한 정보만 표시합니다.</p>}
        </div>

        {role === "dm" && <div className="session-mode-dm-context">
          {connectedPlayers === 0 && <span>연결된 플레이어 없음</span>}
          {combatants.length === 0 && <span>현재 Encounter가 비어 있습니다.</span>}
        </div>}
      </main>

      <aside className="session-mode-rail" aria-label="세션 도구">
        {role === "player"
          ? <button type="button" className={activeUtility === "quick-sheet" ? "active" : ""} aria-pressed={activeUtility === "quick-sheet"} aria-label="빠른 캐릭터 시트 열기" onClick={(event) => toggleUtility("quick-sheet", event.currentTarget)}><span>시트</span></button>
          : <button type="button" className={activeUtility === "actor" ? "active" : ""} aria-pressed={activeUtility === "actor"} aria-label="현재 Actor 빠른 보기" onClick={(event) => toggleUtility("actor", event.currentTarget)}><span>Actor</span></button>}
      </aside>
    </div>

    <footer className="session-mode-action-dock" aria-label="행동 도구">
      <span>{snapshot.sessionMode === "initiative" ? "현재 턴" : "자유 진행"}</span>
      <strong>{role === "dm" ? (dmActor?.name ?? "DM") : snapshot.activeCharacter.name}</strong>
    </footer>

    <div className="session-mode-layer-host" aria-live="polite">
      {activeUtility === "quick-sheet" && role === "player" && <QuickSheet onClose={closeUtility} onOpenFull={openFullSheet} />}
      {activeUtility === "actor" && role === "dm" && <ActorQuickView actor={dmActor} onClose={closeUtility} />}
      {role === "player" && <div className="session-full-sheet-layer" hidden={workspaceLayer !== "full-sheet"} aria-hidden={workspaceLayer !== "full-sheet"}>
        <CharacterSheetWorkspace hostMode="session" onClose={closeFullSheet} />
      </div>}
      {snapshot.resolution && <SessionResolutionFallback />}
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

function ActorQuickView({ actor, onClose }: { actor: SceneEntity | null; onClose(): void }) {
  return <aside className="session-quick-sheet session-actor-quick-view" aria-label="현재 Actor 빠른 보기">
    <header className="session-quick-sheet-head"><div><span className="eyebrow accent">ACTOR</span><strong>{actor?.name ?? "선택된 Actor 없음"}</strong></div><button type="button" autoFocus aria-label="Actor 보기 닫기" onClick={onClose}>×</button></header>
    {actor ? <>
      <section className="session-quick-sheet-vitals"><div><span>HP</span><strong>{actor.hp}/{actor.maxHp}</strong>{actor.tempHp > 0 && <small>+{actor.tempHp} 임시</small>}</div><div><span>AC</span><strong>{actor.ac}</strong></div></section>
      {actor.status.length ? <section className="session-quick-sheet-section"><h2>상태</h2><div className="session-quick-sheet-chips">{actor.status.map((status) => <span key={status}>{status}</span>)}</div></section> : <p className="session-quick-sheet-empty">현재 상태 효과가 없습니다.</p>}
    </> : <p className="session-quick-sheet-empty">Encounter에 Actor를 추가하면 여기에서 빠르게 확인할 수 있습니다.</p>}
  </aside>;
}

function SessionResolutionFallback() {
  const { snapshot, advanceResolution, respondToInterrupt, dismissResolution, undoLastResolution } = useSimpleVtt();
  const resolution = snapshot?.resolution;
  const animated = resolution ? ["roll-animation", "save-animation", "damage-animation"].includes(resolution.stage) : false;

  useEffect(() => {
    if (!resolution || !animated || !resolution.canAdvance) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    const timer = window.setTimeout(() => void advanceResolution(), reduced ? 80 : 850);
    return () => window.clearTimeout(timer);
  }, [resolution?.id, resolution?.stage, resolution?.canAdvance, animated, advanceResolution]);

  if (!snapshot || !resolution) return null;

  return <section className="session-resolution-fallback" aria-label="판정 결과">
    <div><span className="eyebrow accent">판정</span><strong>{resolution.actionName}</strong><p>{resolution.compact || resolution.calculatedOutcome}</p></div>
    {resolution.interrupt && <div className="session-resolution-actions"><button className="primary" type="button" onClick={() => void respondToInterrupt(true)}>사용</button><button type="button" onClick={() => void respondToInterrupt(false)}>넘기기</button></div>}
    {!resolution.interrupt && resolution.canAdvance && !animated && <button className="primary" type="button" onClick={() => void advanceResolution()}>{resolution.nextLabel ?? "계속"}</button>}
    {resolution.stage === "complete" && <div className="session-resolution-actions"><button className="primary" type="button" onClick={() => void dismissResolution()}>결과 닫기</button>{snapshot.session.role === "host" && <button type="button" onClick={() => void undoLastResolution()}>되돌리기</button>}</div>}
  </section>;
}
