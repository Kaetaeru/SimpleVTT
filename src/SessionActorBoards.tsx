import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { SceneEntity } from "./app/contracts";
import { sanitizeCharacterPortrait } from "./app/characterPortraitContracts";
import "./session-actor-boards.css";

type BoardPosition = "upper" | "lower";
type SessionRole = "dm" | "player";

function relationLabel(entity: SceneEntity) {
  return entity.side === "enemy" ? "상대" : "아군";
}

function hpPercent(entity: SceneEntity) {
  if (entity.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
}

export function SessionActorBoard({ position, role }: { position: BoardPosition; role: SessionRole }) {
  const { snapshot, selectDmActor } = useSimpleVtt();
  const [pendingActorId, setPendingActorId] = useState<string | null>(null);
  if (!snapshot) return null;

  const wantedSide = position === "upper" ? "enemy" : "ally";
  const actors = snapshot.scene.entities.filter((entity) => entity.side === wantedSide);
  const boardLabel = position === "upper" ? "상대 Actor Board" : "아군 Actor Board";

  const selectActor = async (entity: SceneEntity) => {
    if (role !== "dm" || pendingActorId || snapshot.resolution || entity.id === snapshot.scene.selectedActorId) return;
    setPendingActorId(entity.id);
    try {
      await selectDmActor(entity.id);
    } finally {
      setPendingActorId(null);
    }
  };

  return <section className={`session-actor-board session-actor-board-${position}`} aria-label={boardLabel} data-board-position={position}>
    <div className="session-actor-board-label" aria-hidden="true">
      <span>{position === "upper" ? "OPPOSING" : "ALLIED"}</span>
      <strong>{actors.length}</strong>
    </div>
    <div className="session-actor-board-scroll" role="list">
      {actors.length === 0
        ? <div className="session-actor-board-empty" role="listitem">
          <strong>{position === "upper" ? "상대 Actor 없음" : "아군 Actor 없음"}</strong>
          <span>빈 Actor Board도 정상적인 세션 상태입니다.</span>
        </div>
        : actors.map((entity) => <SessionActorCard
          key={entity.id}
          entity={entity}
          role={role}
          controlled={role === "dm" ? entity.id === snapshot.scene.selectedActorId : entity.id === snapshot.activeCharacter.id}
          currentTurn={snapshot.sessionMode === "initiative" && entity.id === snapshot.scene.currentActorId}
          pending={pendingActorId === entity.id}
          onSelect={() => void selectActor(entity)}
        />)}
    </div>
  </section>;
}

function SessionActorCard({
  entity,
  role,
  controlled,
  currentTurn,
  pending,
  onSelect,
}: {
  entity: SceneEntity;
  role: SessionRole;
  controlled: boolean;
  currentTurn: boolean;
  pending: boolean;
  onSelect(): void;
}) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  const activePortrait = entity.id === snapshot.activeCharacter.id ? sanitizeCharacterPortrait(snapshot.activeCharacter.portrait) : null;
  const initials = entity.name.trim().slice(0, 2) || "A";
  const interactionDisabled = role !== "dm" || Boolean(snapshot.resolution) || pending;
  const stateCopy = [controlled ? "조작" : null, currentTurn ? "현재 턴" : null].filter(Boolean).join(" · ");

  const body = <>
    <span className="session-actor-card-portrait">
      {activePortrait
        ? <img src={activePortrait.asset.dataUrl} alt="" style={{ objectPosition: `${activePortrait.focalX * 100}% ${activePortrait.focalY * 100}%` }} />
        : initials}
    </span>
    <span className="session-actor-card-copy">
      <span className="session-actor-card-heading"><strong title={entity.name}>{entity.name}</strong><small>{relationLabel(entity)}</small></span>
      <span className="session-actor-card-vitals"><b>HP {entity.hp}/{entity.maxHp}</b>{entity.tempHp > 0 && <em>+{entity.tempHp}</em>}<small>AC {entity.ac}</small></span>
      <span className="session-actor-card-hp" aria-hidden="true"><i style={{ width: `${hpPercent(entity)}%` }} /></span>
      <span className="session-actor-card-meta">
        {stateCopy && <b>{stateCopy}</b>}
        {entity.status.slice(0, 2).map((status) => <small key={status}>{status}</small>)}
        {entity.status.length > 2 && <small>+{entity.status.length - 2}</small>}
      </span>
    </span>
    {pending && <span className="session-actor-card-pending">전환 중…</span>}
  </>;

  const className = [
    "session-actor-card",
    entity.side === "enemy" ? "hostile" : "allied",
    controlled ? "controlled" : "",
    currentTurn ? "current-turn" : "",
  ].filter(Boolean).join(" ");

  if (role === "dm") {
    return <button
      type="button"
      role="listitem"
      className={className}
      aria-pressed={controlled}
      aria-label={`${entity.name} · ${relationLabel(entity)} · HP ${entity.hp}/${entity.maxHp}${stateCopy ? ` · ${stateCopy}` : ""}`}
      disabled={interactionDisabled}
      onClick={onSelect}
    >{body}</button>;
  }

  return <div role="listitem" className={className} aria-label={`${entity.name} · ${relationLabel(entity)} · HP ${entity.hp}/${entity.maxHp}${stateCopy ? ` · ${stateCopy}` : ""}`}>{body}</div>;
}
