import { useSimpleVtt } from "./app/AppProvider";
import "./session-main-focus.css";

export function SessionMainFocus({ role, onOpenActivity: _onOpenActivity }: { role: "player" | "dm"; onOpenActivity(button: HTMLButtonElement): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;

  if (snapshot.sessionMode === "initiative") {
    return <section className="session-main-focus-state session-initiative-focus" aria-label="Initiative mapless play context">
      <div className="session-focus-heading">
        <span className="eyebrow accent">INITIATIVE</span>
        <h1>Actor and action context, not a battlemap</h1>
        <p>The compact tracker and authoritative turn economy are active. Actor identity and targets remain in the boards above and below.</p>
      </div>
    </section>;
  }

  return <section className="session-main-focus-state session-freeform-focus" aria-label="Freeform mapless play context">
    <div className="session-focus-heading">
      <span className="eyebrow accent">FREEFORM</span>
      <h1>Mapless shared play context</h1>
      <p>Current interaction, notices, dice, result and Handout presentation use this space. Actors are never placed here as tactical tokens.</p>
    </div>

    <div className="session-reference-stage-chips" aria-label="Mapless context roles">
      <span>Actor context <strong>Boards</strong></span>
      <span>Dice / Result <strong>Center Stage</strong></span>
      <span>Spatial facts <strong>{role === "dm" ? "DM pane only" : "DM controlled"}</strong></span>
    </div>
  </section>;
}
