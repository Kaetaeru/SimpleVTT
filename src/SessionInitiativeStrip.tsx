import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import "./session-initiative.css";

function economyState(available: boolean | undefined) {
  if (available === undefined) return "—";
  return available ? "가능" : "사용";
}

export function SessionInitiativeStrip({ role }: { role: "player" | "dm" }) {
  const { snapshot, endTurn, endInitiative } = useSimpleVtt();
  const [pending, setPending] = useState<"turn" | "initiative" | null>(null);
  if (!snapshot || snapshot.sessionMode !== "initiative") return null;

  const ordered = snapshot.scene.entities
    .map((entity, index) => ({ entity, index }))
    .sort((left, right) => right.entity.initiative - left.entity.initiative || left.index - right.index)
    .map(({ entity }) => entity);
  const current = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.currentActorId) ?? null;
  const economy = current ? snapshot.scene.economyByActor[current.id] : undefined;
  const connected = snapshot.connectionState === "connected";
  const playerOwnsTurn = role === "player" && current?.id === snapshot.activeCharacter.id;
  const canEndTurn = Boolean(current && connected && !snapshot.resolution && (role === "dm" || playerOwnsTurn));
  const canEndInitiative = role === "dm" && connected && !snapshot.resolution;

  const finishTurn = async () => {
    if (!canEndTurn || pending) return;
    setPending("turn");
    try {
      await endTurn();
    } finally {
      setPending(null);
    }
  };

  const finishInitiative = async () => {
    if (!canEndInitiative || pending) return;
    setPending("initiative");
    try {
      await endInitiative();
    } finally {
      setPending(null);
    }
  };

  return <section className="session-initiative-strip" aria-label="이니셔티브 진행">
    <div className="session-initiative-round" aria-label="현재 라운드와 턴">
      <span>ROUND</span>
      <strong>{snapshot.scene.round}</strong>
      <div><small>현재 턴</small><b>{current?.name ?? "—"}</b></div>
    </div>

    <div className="session-initiative-order" role="list" aria-label="이니셔티브 순서">
      {ordered.map((entity) => {
        const active = entity.id === snapshot.scene.currentActorId;
        return <div key={entity.id} role="listitem" className={active ? "current" : ""} aria-current={active ? "true" : undefined}>
          <span className="session-initiative-avatar">{entity.name.trim().slice(0, 1) || "?"}</span>
          <span className="session-initiative-actor"><strong>{entity.name}</strong><small>{entity.status.length ? entity.status.join(" · ") : entity.kind === "character" ? "Character" : "Combatant"}</small></span>
          <b className="session-initiative-score">{entity.initiative}</b>
        </div>;
      })}
    </div>

    <div className="session-initiative-economy" aria-label="현재 턴 행동 경제">
      <span><small>행동</small><strong>{economyState(economy?.action)}</strong></span>
      <span><small>보너스</small><strong>{economyState(economy?.bonusAction)}</strong></span>
      <span><small>반응</small><strong>{economyState(economy?.reaction)}</strong></span>
      <span><small>이동</small><strong>{economy ? `${economy.movement}/${economy.movementMax} ft` : "—"}</strong></span>
    </div>

    <div className="session-initiative-controls">
      <button type="button" className="primary" disabled={!canEndTurn || Boolean(pending)} onClick={() => void finishTurn()}>{pending === "turn" ? "진행 중…" : role === "dm" ? "다음 턴" : "턴 종료"}</button>
      {role === "dm" && <button type="button" disabled={!canEndInitiative || Boolean(pending)} onClick={() => void finishInitiative()}>{pending === "initiative" ? "종료 중…" : "이니셔티브 종료"}</button>}
    </div>
  </section>;
}
