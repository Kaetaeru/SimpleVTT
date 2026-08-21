import { useSimpleVtt } from "./app/AppProvider";
import "./session-initiative.css";

export function SessionInitiativeStrip({ role: _role }: { role: "player" | "dm" }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot || snapshot.sessionMode !== "initiative") return null;

  const ordered = snapshot.scene.entities
    .map((entity, index) => ({ entity, index }))
    .sort((left, right) => right.entity.initiative - left.entity.initiative || left.index - right.index)
    .map(({ entity }) => entity);

  return <section className="session-initiative-strip session-reference-initiative-strip" aria-label={`이니셔티브 · ${snapshot.scene.round}라운드`}>
    <div className="session-initiative-order" role="list" aria-label="이니셔티브 순서">
      {ordered.map((entity) => {
        const active = entity.id === snapshot.scene.currentActorId;
        return <div key={entity.id} role="listitem" className={active ? "current" : ""} aria-current={active ? "true" : undefined}>
          <b className="session-initiative-score">{entity.initiative}</b>
          <strong title={entity.name}>{entity.name}</strong>
        </div>;
      })}
    </div>
  </section>;
}
