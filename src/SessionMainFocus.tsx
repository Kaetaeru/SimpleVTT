import { useSimpleVtt } from "./app/AppProvider";

export function SessionMainFocus({ role, onOpenActivity }: { role: "player" | "dm"; onOpenActivity(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;

  if (snapshot.sessionMode === "initiative") {
    const current = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.currentActorId);
    return <section className="session-main-focus-state session-initiative-focus-placeholder" aria-label="이니셔티브 진행">
      <div className="session-focus-heading">
        <span className="eyebrow accent">INITIATIVE</span>
        <h1>{snapshot.scene.name || snapshot.session.name || "D&D 세션"}</h1>
        <p>{snapshot.scene.round}라운드 · 현재 턴 {current?.name ?? "—"}</p>
      </div>
    </section>;
  }

  const recent = snapshot.activity[0] ?? null;
  const connectedPlayers = snapshot.session.participants.filter((participant) => participant.state === "connected").length;
  const combatantCount = snapshot.scene.entities.filter((entity) => entity.kind === "combatant").length;

  return <section className="session-main-focus-state session-freeform-focus" aria-label="자유 진행">
    <div className="session-focus-heading">
      <span className="eyebrow accent">FREEFORM</span>
      <h1>{snapshot.scene.name || snapshot.session.name || "D&D 세션"}</h1>
      <p>대화와 탐험을 이어가고, 필요한 순간에만 시트·규칙·행동을 엽니다.</p>
    </div>

    {recent && <article className="session-freeform-recent" aria-label="최근 의미 있는 결과">
      <div>
        <span>최근 결과</span>
        <strong>{recent.title}</strong>
        <p>{recent.summary}</p>
      </div>
      <button type="button" onClick={(event) => onOpenActivity(event.currentTarget)}>기록 보기</button>
    </article>}

    {role === "dm" && (connectedPlayers === 0 || combatantCount === 0) && <div className="session-freeform-dm-notes" aria-label="DM 세션 상태">
      {connectedPlayers === 0 && <span>플레이어 없이도 세션을 계속 준비하고 진행할 수 있습니다.</span>}
      {combatantCount === 0 && <span>Encounter가 비어 있어도 자유 진행은 정상 상태입니다.</span>}
    </div>}
  </section>;
}
