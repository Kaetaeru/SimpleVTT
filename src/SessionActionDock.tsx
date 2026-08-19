import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm } from "./app/contracts";
import { OFFICIAL_PLAY_INTENTS, intentOptions, skillFactByActionId, type PlayIntentId } from "./playerExperienceModel";
import "./session-action-dock.css";

const FREEFORM_RESTING: PlayIntentId[] = ["attack", "magic", "search", "influence", "help"];
const INITIATIVE_RESTING: PlayIntentId[] = ["attack", "magic", "dash", "disengage", "dodge", "help"];

function signed(value: number | undefined) {
  if (value === undefined) return "";
  return value >= 0 ? `+${value}` : String(value);
}

function actionEffect(action: ActionVm) {
  if (action.damage?.length) {
    return action.damage.map((part) => `${part.dice}${part.flat ? signed(part.flat) : ""} ${part.type}`).join(" + ");
  }
  if (action.healing) return `${action.healing.dice}${action.healing.flat ? signed(action.healing.flat) : ""} 회복`;
  if (action.checkBonus !== undefined) return `${skillFactByActionId(action.id)?.name ?? "판정"} ${signed(action.checkBonus)}`;
  return action.summary;
}

function targetCopy(target: ActionVm["target"]) {
  if (target === "none") return "대상 없음";
  if (target === "self") return "자신";
  if (target === "ally") return "아군 대상";
  if (target === "enemy") return "적 대상";
  if (target === "multi-enemy") return "여러 적 대상";
  return "대상 선택";
}

export function SessionActionDock({
  actorId,
  suspended,
  onOpenRules,
}: {
  actorId: string | null;
  suspended: boolean;
  onOpenRules(button: HTMLButtonElement): void;
}) {
  const { snapshot, resolveAction } = useSimpleVtt();
  const [intentId, setIntentId] = useState<PlayIntentId | null>(null);
  const [intentReturnToAll, setIntentReturnToAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const actions = snapshot && actorId ? snapshot.scene.actionsByActor[actorId] ?? [] : [];
  const selectedIntent = intentId ? OFFICIAL_PLAY_INTENTS.find((intent) => intent.id === intentId) ?? null : null;
  const options = intentId ? intentOptions(intentId, actions) : [];
  const selectedAction = selectedActionId ? actions.find((action) => action.id === selectedActionId) ?? null : null;
  const resting = snapshot?.sessionMode === "initiative" ? INITIATIVE_RESTING : FREEFORM_RESTING;
  const actorName = snapshot && actorId
    ? snapshot.scene.entities.find((entity) => entity.id === actorId)?.name ?? (snapshot.activeCharacter.id === actorId ? snapshot.activeCharacter.name : "Actor")
    : "Actor";

  const resetFlow = () => {
    setIntentId(null);
    setIntentReturnToAll(false);
    setShowAll(false);
    setSelectedActionId(null);
    setFeedback(null);
  };

  useEffect(() => {
    resetFlow();
    setPendingActionId(null);
  }, [actorId]);

  useEffect(() => {
    if (selectedActionId && !actions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(null);
      setFeedback("상태가 변경되어 이전 행동 선택을 닫았습니다.");
    }
  }, [actions, selectedActionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || suspended) return;
      if (selectedActionId) {
        event.preventDefault();
        setSelectedActionId(null);
        setFeedback(null);
        return;
      }
      if (intentId) {
        event.preventDefault();
        setIntentId(null);
        setShowAll(intentReturnToAll);
        setIntentReturnToAll(false);
        setFeedback(null);
        return;
      }
      if (showAll) {
        event.preventDefault();
        setShowAll(false);
        setFeedback(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [intentId, intentReturnToAll, selectedActionId, showAll, suspended]);

  if (!snapshot) return null;

  const selectIntent = (next: PlayIntentId, fromAll = false) => {
    setIntentId(next);
    setIntentReturnToAll(fromAll);
    setShowAll(false);
    setSelectedActionId(null);
    setFeedback(null);
  };

  const runImmediateAction = async (action: ActionVm, targetIds: string[]) => {
    if (pendingActionId) return;
    setPendingActionId(action.id);
    setFeedback(null);
    try {
      await resolveAction(action.id, targetIds);
      resetFlow();
    } catch {
      setFeedback("행동을 완료하지 못했습니다. 현재 상태를 확인하고 다시 시도하세요.");
    } finally {
      setPendingActionId(null);
    }
  };

  const chooseAction = (action: ActionVm) => {
    if (!action.available) {
      setFeedback(action.disabledReason || "현재 사용할 수 없습니다.");
      return;
    }
    if (action.target === "none") {
      void runImmediateAction(action, []);
      return;
    }
    if (action.target === "self" && actorId) {
      void runImmediateAction(action, [actorId]);
      return;
    }
    setSelectedActionId(action.id);
    setFeedback(null);
  };

  const backFromIntent = () => {
    setIntentId(null);
    setShowAll(intentReturnToAll);
    setIntentReturnToAll(false);
    setFeedback(null);
  };

  const expanded = showAll || Boolean(intentId) || Boolean(selectedActionId);

  return <div className={`session-action-dock-panel ${expanded ? "expanded" : "resting"}`} data-action-dock-state={selectedActionId ? "detail" : intentId ? "intent" : showAll ? "all-intents" : "resting"}>
    {!expanded && <div className="session-action-resting">
      <div className="session-action-actor"><span>{snapshot.sessionMode === "initiative" ? "현재 행동" : "행동"}</span><strong>{actorName}</strong></div>
      <div className="session-action-resting-intents" aria-label="주요 행동 의도">
        {resting.map((id) => {
          const intent = OFFICIAL_PLAY_INTENTS.find((item) => item.id === id)!;
          const count = intentOptions(id, actions).length;
          return <button type="button" key={id} aria-label={`${intent.label} · 선택지 ${count}개`} onClick={() => selectIntent(id)}><strong>{intent.label}</strong></button>;
        })}
        <button type="button" className="session-action-all-launcher" onClick={() => { setShowAll(true); setFeedback(null); }}><strong>모든 행동</strong></button>
      </div>
    </div>}

    {showAll && <div className="session-action-expanded">
      <header><button type="button" className="session-action-back" onClick={() => { setShowAll(false); setFeedback(null); }}>←</button><div><strong>모든 행동</strong><small>필요한 의도를 고르세요.</small></div></header>
      <div className="session-action-intent-grid">
        {OFFICIAL_PLAY_INTENTS.map((intent) => {
          const count = intentOptions(intent.id, actions).length;
          return <button type="button" key={intent.id} onClick={() => selectIntent(intent.id, true)}><strong>{intent.label}</strong><span>{intent.summary}</span><small>{count ? `선택지 ${count}개` : "현재 선택지 없음"}</small></button>;
        })}
      </div>
    </div>}

    {intentId && !selectedAction && <div className="session-action-expanded">
      <header><button type="button" className="session-action-back" onClick={backFromIntent}>←</button><div><strong>{selectedIntent?.label ?? "행동"}</strong><small>{selectedIntent?.summary}</small></div></header>
      <div className="session-action-options" role="list">
        {options.map((action) => <button type="button" role="listitem" key={action.id} className={!action.available ? "unavailable" : ""} aria-disabled={!action.available || Boolean(pendingActionId)} onClick={() => chooseAction(action)}>
          <div><strong>{skillFactByActionId(action.id)?.name ?? action.name}</strong><small>{action.economy} · {targetCopy(action.target)}</small></div>
          <span>{actionEffect(action)}</span>
          {!action.available && <em>{action.disabledReason || "현재 사용할 수 없습니다."}</em>}
          {pendingActionId === action.id && <em>처리 중…</em>}
        </button>)}
        {options.length === 0 && <p className="session-action-empty">현재 Actor에는 이 의도에 연결된 행동이 없습니다.</p>}
      </div>
      {feedback && <p className="session-action-feedback" role="status">{feedback}</p>}
    </div>}

    {selectedAction && <div className="session-action-expanded session-action-detail">
      <header><button type="button" className="session-action-back" onClick={() => { setSelectedActionId(null); setFeedback(null); }}>←</button><div><strong>{selectedAction.name}</strong><small>{selectedAction.economy} · {targetCopy(selectedAction.target)}</small></div><button type="button" className="session-action-rules" onClick={(event) => onOpenRules(event.currentTarget)}>규칙</button></header>
      <div className="session-action-detail-body">
        <div><span>효과</span><strong>{actionEffect(selectedAction)}</strong><p>{selectedAction.summary}</p></div>
        {selectedAction.details.slice(0, 3).map((detail) => <div key={`${detail.label}:${detail.value}`}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}
        <div className="session-action-target-next"><span>대상</span><strong>{targetCopy(selectedAction.target)}</strong><p>사용할 대상을 고르면 이 행동을 실행합니다.</p></div>
      </div>
      {feedback && <p className="session-action-feedback" role="status">{feedback}</p>}
    </div>}
  </div>;
}
