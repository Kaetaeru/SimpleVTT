import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import "./session-player-session.css";

function connectionLabel(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "연결됨";
  if (state === "reconnecting") return "자동 재연결 중";
  return "연결 끊김";
}

function connectionExplanation(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "세션 연결이 정상입니다.";
  if (state === "reconnecting") return "현재 세션을 유지한 채 마지막으로 확인한 이벤트 이후부터 자동으로 다시 동기화합니다.";
  return "자동 재연결을 계속할 수 없는 상태입니다. 같은 Host 주소로 새로 참여하거나 세션을 나갈 수 있습니다.";
}

export function SessionPlayerRecoveryStrip({ onOpen }: { onOpen(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot || snapshot.session.role !== "client" || snapshot.connectionState === "connected") return null;

  return <section className={`session-player-recovery ${snapshot.connectionState}`} role="status" aria-live="polite">
    <div>
      <strong>{connectionLabel(snapshot.connectionState)}</strong>
      <span>{snapshot.connectionState === "reconnecting" ? "세션 상태를 유지하고 있습니다." : "연결 선택이 필요합니다."}</span>
    </div>
    <button type="button" onClick={(event) => onOpen(event.currentTarget)}>연결 보기</button>
  </section>;
}

export function SessionPlayerSessionPane({ onClose }: { onClose(): void }) {
  const { snapshot, joinSession, stopSession } = useSimpleVtt();
  const [pending, setPending] = useState<"rejoin" | "leave" | null>(null);
  if (!snapshot) return null;

  const canRejoin = snapshot.connectionState === "disconnected" && Boolean(snapshot.session.address);

  const rejoin = async () => {
    if (snapshot.connectionState !== "disconnected" || !snapshot.session.address || pending) return;
    setPending("rejoin");
    try {
      await joinSession(snapshot.session.address);
    } finally {
      setPending(null);
    }
  };

  const leave = async () => {
    if (pending) return;
    setPending("leave");
    try {
      await stopSession();
    } finally {
      setPending(null);
    }
  };

  const localParticipant = snapshot.session.participants.find((participant) => participant.id === `client:${snapshot.activeCharacter.id}`);

  return <aside className="session-player-session-pane" aria-label="Player 세션 연결">
    <header className="session-player-session-head">
      <div><span>SESSION</span><strong>세션 연결</strong></div>
      <button type="button" autoFocus aria-label="세션 연결 닫기" onClick={onClose}>×</button>
    </header>

    <section className="session-player-session-card">
      <div><span>세션</span><strong>{snapshot.session.name || snapshot.scene.name}</strong></div>
      <div><span>Character</span><strong>{snapshot.activeCharacter.name}</strong></div>
      <div><span>Host</span><code>{snapshot.session.address || "주소 없음"}</code></div>
      <div><span>상태</span><strong className={snapshot.connectionState}>{connectionLabel(snapshot.connectionState)}</strong></div>
    </section>

    <section className="session-player-session-state" aria-live="polite">
      <strong>{connectionLabel(snapshot.connectionState)}</strong>
      <p>{connectionExplanation(snapshot.connectionState)}</p>
      {localParticipant?.state === "reconnecting" && <small>Player identity와 Character는 현재 Session Shell에 그대로 유지됩니다.</small>}
      {snapshot.session.compatibility !== "compatible" && snapshot.session.compatibilityMessage && <small>{snapshot.session.compatibilityMessage}</small>}
    </section>

    <section className="session-player-session-actions">
      {snapshot.connectionState === "reconnecting" && <p>재연결은 자동으로 진행됩니다. 이 상태에서는 새 Join을 시작하지 않아 event cursor와 현재 세션 문맥을 보존합니다.</p>}
      {canRejoin && <button type="button" className="primary" disabled={Boolean(pending)} onClick={() => void rejoin()}>{pending === "rejoin" ? "참여 중…" : "같은 Host에 다시 참여"}</button>}
      <button type="button" disabled={Boolean(pending)} onClick={() => void leave()}>{pending === "leave" ? "나가는 중…" : "세션 나가기"}</button>
    </section>
  </aside>;
}
