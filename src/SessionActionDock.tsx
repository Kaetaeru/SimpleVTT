import { useEffect, useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import "./session-action-dock.css";

type HotbarPage = "mixed" | "action" | "spell" | "item";

const HOTBAR_PAGES: Array<{ id: HotbarPage; label: string }> = [
  { id: "mixed", label: "혼합" },
  { id: "action", label: "행동" },
  { id: "spell", label: "주문" },
  { id: "item", label: "아이템" },
];

function signed(value: number | undefined) {
  if (value === undefined) return "";
  return value >= 0 ? `+${value}` : String(value);
}

function actionEffect(action: ActionVm) {
  if (action.damage?.length) return action.damage.map((part) => `${part.dice}${part.flat ? signed(part.flat) : ""} ${part.type}`).join(" + ");
  if (action.healing) return `${action.healing.dice}${action.healing.flat ? signed(action.healing.flat) : ""} 회복`;
  if (action.checkBonus !== undefined) return `판정 ${signed(action.checkBonus)}`;
  return action.summary;
}

function targetCopy(target: ActionVm["target"]) {
  if (target === "none") return "대상 없음";
  if (target === "self") return "자신";
  if (target === "ally") return "아군";
  if (target === "enemy") return "상대";
  if (target === "multi-enemy") return "여러 상대";
  return "대상 선택";
}

function targetMeta(entity: SceneEntity) {
  const status = entity.status.length ? ` · ${entity.status.join(" · ")}` : "";
  return `HP ${entity.hp}/${entity.maxHp}${entity.tempHp ? ` +${entity.tempHp} 임시` : ""}${status}`;
}

function pageIncludes(page: HotbarPage, action: ActionVm) {
  if (page === "mixed") return true;
  if (page === "spell") return action.category === "magic";
  if (page === "item") return Boolean(action.itemCost);
  return action.category !== "magic" && !action.itemCost;
}

function slotGlyph(action: ActionVm) {
  if (action.itemCost) return "I";
  if (action.category === "magic") return "S";
  if (action.category === "weapon") return "W";
  return "A";
}

export function SessionActionDock({ actorId, suspended, onOpenRules }: { actorId: string | null; suspended: boolean; onOpenRules(button: HTMLButtonElement): void }) {
  const { snapshot, resolveAction } = useSimpleVtt();
  const [page, setPage] = useState<HotbarPage>("mixed");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const actions = snapshot && actorId ? snapshot.scene.actionsByActor[actorId] ?? [] : [];
  const selectedAction = selectedActionId ? actions.find((action) => action.id === selectedActionId) ?? null : null;
  const actorEntity = snapshot && actorId ? snapshot.scene.entities.find((entity) => entity.id === actorId) ?? null : null;
  const ownsCharacter = Boolean(snapshot && actorId && snapshot.activeCharacter.id === actorId);
  const actorName = actorEntity?.name ?? (ownsCharacter && snapshot ? snapshot.activeCharacter.name : "Actor");
  const actorHp = actorEntity?.hp ?? (ownsCharacter && snapshot ? snapshot.activeCharacter.hp : null);
  const actorMaxHp = actorEntity?.maxHp ?? (ownsCharacter && snapshot ? snapshot.activeCharacter.maxHp : null);
  const actorTempHp = actorEntity?.tempHp ?? (ownsCharacter && snapshot ? snapshot.activeCharacter.tempHp : 0);
  const actorStatus = actorEntity?.status ?? [];
  const resources = ownsCharacter && snapshot ? snapshot.activeCharacter.resources : [];
  const economy = snapshot && actorId && snapshot.sessionMode === "initiative" ? snapshot.scene.economyByActor[actorId] : undefined;
  const visibleActions = useMemo(() => actions.filter((action) => pageIncludes(page, action)), [actions, page]);
  const targetCandidates = snapshot && selectedAction
    ? selectedAction.eligibleTargetIds
      .map((id) => snapshot.scene.entities.find((entity) => entity.id === id) ?? null)
      .filter((entity): entity is SceneEntity => Boolean(entity))
    : [];
  const multiTarget = selectedAction?.target === "multi-enemy";
  const maxTargets = selectedAction ? Math.max(1, selectedAction.maxTargets ?? targetCandidates.length) : 1;

  const closeTargeting = () => {
    setSelectedActionId(null);
    setSelectedTargetIds([]);
    setFeedback(null);
  };

  useEffect(() => {
    closeTargeting();
    setPendingActionId(null);
    setPage("mixed");
  }, [actorId]);

  useEffect(() => {
    if (selectedActionId && !actions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(null);
      setSelectedTargetIds([]);
      setFeedback("상태가 변경되어 이전 행동 선택을 닫았습니다.");
    }
  }, [actions, selectedActionId]);

  useEffect(() => {
    if (!selectedAction) return;
    setSelectedTargetIds((current) => current.filter((id) => selectedAction.eligibleTargetIds.includes(id)).slice(0, maxTargets));
  }, [selectedAction?.id, selectedAction?.eligibleTargetIds.join("|"), maxTargets]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || suspended || !selectedActionId) return;
      event.preventDefault();
      closeTargeting();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedActionId, suspended]);

  if (!snapshot) return null;

  const runAction = async (action: ActionVm, targetIds: string[]) => {
    if (pendingActionId) return;
    setPendingActionId(action.id);
    setFeedback(null);
    try {
      await resolveAction(action.id, targetIds);
      closeTargeting();
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
      void runAction(action, []);
      return;
    }
    if (action.target === "self" && actorId) {
      void runAction(action, [actorId]);
      return;
    }
    setSelectedActionId(action.id);
    setSelectedTargetIds([]);
    setFeedback(null);
  };

  const chooseTarget = (targetId: string) => {
    if (!selectedAction || !selectedAction.eligibleTargetIds.includes(targetId) || pendingActionId) return;
    if (!multiTarget) {
      void runAction(selectedAction, [targetId]);
      return;
    }
    setSelectedTargetIds((current) => {
      if (current.includes(targetId)) return current.filter((id) => id !== targetId);
      if (current.length >= maxTargets) return current;
      return [...current, targetId];
    });
  };

  const pageCount = (targetPage: HotbarPage) => actions.filter((action) => pageIncludes(targetPage, action)).length;

  return <div className="session-command-center" data-action-dock-state={selectedAction ? "target" : "hotbar"}>
    <section className="session-command-actor" aria-label="조작 Actor 요약">
      <div className="session-command-actor-head">
        <span className="session-command-avatar">{actorName.trim().slice(0, 2) || "A"}</span>
        <div><small>{snapshot.session.role === "host" ? "DM CONTROL" : "PLAYER"}</small><strong title={actorName}>{actorName}</strong></div>
      </div>
      <div className="session-command-vitals">
        {actorHp !== null && actorMaxHp !== null ? <strong>HP {actorHp}/{actorMaxHp}{actorTempHp > 0 ? ` +${actorTempHp}` : ""}</strong> : <strong>HP —</strong>}
        {actorStatus.slice(0, 2).map((status) => <span key={status}>{status}</span>)}
      </div>
      {snapshot.sessionMode === "initiative" && economy && <div className="session-command-economy" aria-label="현재 턴 행동 경제">
        <span data-available={economy.action}>행동</span>
        <span data-available={economy.bonusAction}>추가</span>
        <span data-available={economy.reaction}>반응</span>
        <span>이동 {economy.movement}/{economy.movementMax}</span>
      </div>}
      <div className="session-command-resources" aria-label="주요 자원">
        {resources.length
          ? resources.slice(0, 5).map((resource) => <span key={resource.id}><b>{resource.label}</b><em>{resource.current}/{resource.max}</em></span>)
          : <span className="empty"><b>자원</b><em>투영 없음</em></span>}
      </div>
    </section>

    <section className="session-command-capabilities" aria-label="Hotbar">
      <div className="session-hotbar-tabs" role="tablist" aria-label="Hotbar 페이지">
        {HOTBAR_PAGES.map((entry) => <button
          type="button"
          role="tab"
          key={entry.id}
          aria-selected={page === entry.id}
          className={page === entry.id ? "active" : ""}
          onClick={() => { setPage(entry.id); closeTargeting(); }}
        >{entry.label}<small>{pageCount(entry.id)}</small></button>)}
        <button type="button" className="session-hotbar-rules" onClick={(event) => onOpenRules(event.currentTarget)}>규칙</button>
      </div>

      <div className="session-hotbar-slots" role="list" aria-label={`${HOTBAR_PAGES.find((entry) => entry.id === page)?.label ?? "Hotbar"} 행동`}>
        {visibleActions.map((action) => {
          const unavailable = !action.available;
          const selected = action.id === selectedActionId;
          return <button
            type="button"
            role="listitem"
            key={action.id}
            className={`session-hotbar-slot ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}`}
            aria-pressed={selected}
            aria-disabled={unavailable || Boolean(pendingActionId)}
            title={unavailable ? action.disabledReason || "현재 사용할 수 없습니다." : `${action.name} · ${action.summary}`}
            onClick={() => chooseAction(action)}
          >
            <span className="session-hotbar-glyph">{slotGlyph(action)}</span>
            <span className="session-hotbar-copy"><strong>{action.name}</strong><small>{action.economy} · {targetCopy(action.target)}</small><em>{actionEffect(action)}</em></span>
            {unavailable && <span className="session-hotbar-unavailable">{action.disabledReason || "사용 불가"}</span>}
            {pendingActionId === action.id && <span className="session-hotbar-pending">처리 중…</span>}
          </button>;
        })}
        {visibleActions.length === 0 && <div className="session-hotbar-empty" role="listitem"><strong>표시할 행동 없음</strong><span>현재 Actor의 authoritative projection에 이 페이지 행동이 없습니다.</span></div>}
      </div>
      {feedback && !selectedAction && <p className="session-action-feedback" role="status">{feedback}</p>}
    </section>

    {selectedAction && <section className="session-action-target-overlay" aria-label={`${selectedAction.name} 대상 선택`}>
      <header>
        <button type="button" className="session-action-back" onClick={closeTargeting}>←</button>
        <div><small>대상 선택</small><strong>{selectedAction.name}</strong><span>{selectedAction.economy} · {actionEffect(selectedAction)}</span></div>
        <button type="button" className="session-action-rules" onClick={(event) => onOpenRules(event.currentTarget)}>규칙</button>
      </header>
      <div className="session-action-target-layout">
        <section className="session-action-detail-summary" aria-label="행동 상세">
          <div><span>효과</span><strong>{actionEffect(selectedAction)}</strong><p>{selectedAction.summary}</p></div>
          {selectedAction.details.slice(0, 3).map((detail) => <div key={`${detail.label}:${detail.value}`}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}
        </section>
        <section className="session-action-target-picker">
          <div className="session-action-target-heading"><div><span>가능한 대상</span><strong>{multiTarget ? `${selectedTargetIds.length} / ${maxTargets}` : "1명 선택"}</strong></div>{multiTarget && <button type="button" className="primary" disabled={selectedTargetIds.length === 0 || Boolean(pendingActionId)} onClick={() => void runAction(selectedAction, selectedTargetIds)}>실행</button>}</div>
          <div className="session-action-target-list">
            {targetCandidates.map((entity) => {
              const selected = selectedTargetIds.includes(entity.id);
              return <button type="button" key={entity.id} className={selected ? "selected" : ""} aria-pressed={multiTarget ? selected : undefined} disabled={Boolean(pendingActionId)} onClick={() => chooseTarget(entity.id)}><span className="session-action-target-avatar">{entity.name.slice(0, 1)}</span><span><strong>{entity.name}</strong><small>{targetMeta(entity)}</small></span></button>;
            })}
            {targetCandidates.length === 0 && <p className="session-action-empty">현재 authoritative projection에 사용할 수 있는 대상이 없습니다.</p>}
          </div>
        </section>
      </div>
      {pendingActionId === selectedAction.id && <p className="session-action-pending" role="status">판정을 처리하고 있습니다…</p>}
      {feedback && <p className="session-action-feedback" role="status">{feedback}</p>}
    </section>}
  </div>;
}
