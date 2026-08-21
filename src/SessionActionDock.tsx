import { useEffect, useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { ActionVm, SceneEntity } from "./app/contracts";
import "./session-action-dock.css";

type HotbarPage = "mixed" | "action" | "spell" | "item";

const HOTBAR_PAGES: Array<{ id: HotbarPage; label: string }> = [
  { id: "mixed", label: "Mixed" },
  { id: "action", label: "Action" },
  { id: "spell", label: "Spell" },
  { id: "item", label: "Item" },
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
  if (action.category === "magic") return "✦";
  if (action.category === "weapon") return "⚔";
  return "◆";
}

export function SessionActionDock({ actorId, suspended, onOpenRules: _onOpenRules }: { actorId: string | null; suspended: boolean; onOpenRules(button: HTMLButtonElement): void }) {
  const { snapshot, resolveAction, endTurn } = useSimpleVtt();
  const [page, setPage] = useState<HotbarPage>("mixed");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingTurn, setPendingTurn] = useState(false);
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
  const actorLine = ownsCharacter && snapshot
    ? `${snapshot.activeCharacter.className} ${snapshot.activeCharacter.level}`
    : actorEntity?.kind === "combatant" ? "Combatant · Controlled Actor" : "Controlled Actor";
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
  const currentActor = snapshot?.scene.entities.find((entity) => entity.id === snapshot.scene.currentActorId) ?? null;
  const role = snapshot?.session.role === "host" ? "dm" : "player";
  const playerOwnsTurn = Boolean(snapshot && role === "player" && currentActor?.id === snapshot.activeCharacter.id);
  const canEndTurn = Boolean(snapshot && snapshot.sessionMode === "initiative" && currentActor && snapshot.connectionState === "connected" && !snapshot.resolution && (role === "dm" || playerOwnsTurn));

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

  const finishTurn = async () => {
    if (!canEndTurn || pendingTurn) return;
    setPendingTurn(true);
    try {
      await endTurn();
    } finally {
      setPendingTurn(false);
    }
  };

  return <section className="session-command-center session-reference-command-center" data-action-dock-state={selectedAction ? "target" : "hotbar"}>
    <div className="session-command-top">
      <div className="session-command-economy" aria-label="Action economy">
        {snapshot.sessionMode === "initiative" && economy ? <>
          <span data-available={economy.action}><i />Action</span>
          <span data-available={economy.bonusAction}><i />Bonus</span>
          <span data-available={economy.reaction}><i />Reaction</span>
          <span><i />Movement {economy.movement}/{economy.movementMax}</span>
        </> : <span className="freeform">FREEFORM · no turn economy</span>}
      </div>
      <div className="session-command-resources" aria-label="Resource Rail">
        {resources.length
          ? resources.map((resource) => <span key={resource.id}><b>{resource.label}</b><strong>{resource.current}/{resource.max}</strong></span>)
          : <span className="empty"><b>Resource</b><strong>projection unavailable</strong></span>}
      </div>
    </div>

    <div className="session-command-body">
      <div className="session-controlled-actor" aria-label="Controlled Actor">
        <span className="session-controlled-portrait">{actorName.trim().slice(0, 2) || "A"}</span>
        <div className="session-controlled-info">
          <strong title={actorName}>{actorName}</strong>
          <p>{actorLine}</p>
          {actorHp !== null && actorMaxHp !== null && <><span className="session-controlled-hp"><i style={{ width: `${Math.max(0, Math.min(100, actorMaxHp > 0 ? actorHp / actorMaxHp * 100 : 0))}%` }} /></span><p>HP {actorHp}/{actorMaxHp}{actorTempHp > 0 ? ` +${actorTempHp} Temp` : ""}{actorStatus.length ? ` · ${actorStatus.join(", ")}` : ""}</p></>}
        </div>
      </div>

      <div className="session-hotbar">
        <div className="session-hotbar-tabs" role="tablist" aria-label="Hotbar pages">
          {HOTBAR_PAGES.map((entry) => <button type="button" role="tab" key={entry.id} aria-selected={page === entry.id} className={page === entry.id ? "active" : ""} onClick={() => { setPage(entry.id); closeTargeting(); }}>{entry.label}</button>)}
        </div>
        <div className="session-hotbar-slots" role="list" aria-label={`${HOTBAR_PAGES.find((entry) => entry.id === page)?.label ?? "Hotbar"} capabilities`}>
          {visibleActions.map((action) => {
            const unavailable = !action.available;
            const selected = action.id === selectedActionId;
            const cost = action.itemCost ? "Item" : action.resourceCost ? `-${action.resourceCost.amount}` : action.economy;
            return <button type="button" role="listitem" key={action.id} className={`session-hotbar-slot ${selected ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} aria-pressed={selected} aria-disabled={unavailable || Boolean(pendingActionId)} title={unavailable ? action.disabledReason || "현재 사용할 수 없습니다." : `${action.name} · ${action.summary}`} onClick={() => chooseAction(action)}>
              <span className="session-hotbar-cost">{cost}</span>
              <span className="session-hotbar-glyph">{slotGlyph(action)}</span>
              <strong>{action.name}</strong>
            </button>;
          })}
          {visibleActions.length === 0 && <div className="session-hotbar-empty" role="listitem">표시할 capability 없음</div>}
        </div>
      </div>

      <div className="session-command-context">
        {selectedAction && <button type="button" onClick={closeTargeting}>Cancel</button>}
        {selectedAction && multiTarget && <button type="button" className="primary" disabled={selectedTargetIds.length === 0 || Boolean(pendingActionId)} onClick={() => void runAction(selectedAction, selectedTargetIds)}>Execute · {selectedTargetIds.length}</button>}
        {!selectedAction && snapshot.sessionMode === "initiative" && <button type="button" className="primary" disabled={!canEndTurn || pendingTurn} onClick={() => void finishTurn()}>{pendingTurn ? "…" : role === "dm" ? "Next Turn" : "End Turn"}</button>}
        {!selectedAction && snapshot.sessionMode === "freeform" && <span className="session-command-context-label">Context</span>}
      </div>
    </div>

    {selectedAction && <section className="session-action-target-overlay" aria-label={`${selectedAction.name} 대상 선택`}>
      <header><button type="button" className="session-action-back" onClick={closeTargeting}>←</button><div><small>TARGETING</small><strong>{selectedAction.name}</strong><span>{targetCopy(selectedAction.target)} · {actionEffect(selectedAction)}</span></div></header>
      <div className="session-action-target-layout">
        <section className="session-action-detail-summary"><div><span>효과</span><strong>{actionEffect(selectedAction)}</strong><p>{selectedAction.summary}</p></div></section>
        <section className="session-action-target-picker"><div className="session-action-target-heading"><div><span>가능한 대상</span><strong>{multiTarget ? `${selectedTargetIds.length} / ${maxTargets}` : "1명 선택"}</strong></div></div><div className="session-action-target-list">{targetCandidates.map((entity) => { const selected = selectedTargetIds.includes(entity.id); return <button type="button" key={entity.id} className={selected ? "selected" : ""} aria-pressed={multiTarget ? selected : undefined} disabled={Boolean(pendingActionId)} onClick={() => chooseTarget(entity.id)}><span className="session-action-target-avatar">{entity.name.slice(0, 1)}</span><span><strong>{entity.name}</strong><small>{targetMeta(entity)}</small></span></button>; })}{targetCandidates.length === 0 && <p className="session-action-empty">현재 authoritative projection에 사용할 수 있는 대상이 없습니다.</p>}</div></section>
      </div>
      {feedback && <p className="session-action-feedback" role="status">{feedback}</p>}
    </section>}
    {feedback && !selectedAction && <p className="session-action-feedback session-command-feedback" role="status">{feedback}</p>}
  </section>;
}
