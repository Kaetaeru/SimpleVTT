import { useMemo, useState } from "react";
import type { SessionMode } from "./app/contracts";
import { SessionDebugPreviewProvider, type SessionDebugPreviewRole, useSimpleVtt } from "./app/AppProvider";
import { SessionModeRoot } from "./SessionModeRoot";
import "./session-debug-preview.css";

export interface SessionDebugPreviewState {
  role: SessionDebugPreviewRole;
  mode: SessionMode;
}

export function SessionDebugPreview({ state, onChange, onExit }: {
  state: SessionDebugPreviewState;
  onChange(next: SessionDebugPreviewState): void;
  onExit(): void;
}) {
  return <SessionDebugPreviewProvider role={state.role} mode={state.mode} onExit={onExit}>
    <div className="session-debug-preview-shell" data-testid="browser-session-debug-preview">
      <header className="session-debug-preview-toolbar" aria-label="브라우저 세션 미리보기 제어">
        <div className="session-debug-preview-title"><strong>세션 UI 미리보기</strong><span>네트워크·저장 권위와 분리됨</span></div>
        <div className="session-debug-preview-options" role="group" aria-label="미리보기 역할">
          <button type="button" className={state.role === "dm" ? "active" : ""} onClick={() => onChange({ ...state, role: "dm" })}>DM</button>
          <button type="button" className={state.role === "player" ? "active" : ""} onClick={() => onChange({ ...state, role: "player" })}>Player</button>
        </div>
        <div className="session-debug-preview-options" role="group" aria-label="미리보기 진행 방식">
          <button type="button" className={state.mode === "freeform" ? "active" : ""} onClick={() => onChange({ ...state, mode: "freeform" })}>자유 진행</button>
          <button type="button" className={state.mode === "initiative" ? "active" : ""} onClick={() => onChange({ ...state, mode: "initiative" })}>이니셔티브</button>
        </div>
        <SessionDebugDiceControl />
        <button type="button" className="session-debug-preview-exit" onClick={onExit}>미리보기 종료</button>
      </header>
      <div className="session-debug-preview-viewport">
        <SessionModeRoot onOpenProduct={onExit} />
      </div>
    </div>
  </SessionDebugPreviewProvider>;
}

function SessionDebugDiceControl() {
  const { snapshot, resolveAction, debug } = useSimpleVtt();
  const [busy, setBusy] = useState(false);
  const action = useMemo(() => {
    if (!snapshot) return null;
    return (snapshot.scene.actionsByActor[snapshot.activeCharacter.id] ?? []).find((candidate) =>
      candidate.resolutionKind === "ability-check" && candidate.target === "none" && candidate.available,
    ) ?? null;
  }, [snapshot]);
  const blocked = busy || Boolean(snapshot?.resolution) || !action;

  const roll = async () => {
    if (!snapshot || !action || blocked) return;
    setBusy(true);
    try {
      if (snapshot.sessionMode === "initiative" && snapshot.scene.currentActorId !== snapshot.activeCharacter.id) {
        await debug.setCurrentActor(snapshot.activeCharacter.id);
      }
      await resolveAction(action.id, []);
    } finally {
      setBusy(false);
    }
  };

  return <button
    type="button"
    className="session-debug-dice-button"
    disabled={blocked}
    title={snapshot?.resolution ? "현재 판정을 닫은 뒤 다시 굴릴 수 있습니다." : "기존 능력 판정 권위 경로로 d20을 굴립니다."}
    onClick={() => void roll()}
  >{busy ? "굴리는 중…" : snapshot?.resolution ? "결과 확인 중" : "◆ d20 테스트"}</button>;
}
