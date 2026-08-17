import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/AppProvider";
import "./app/offlineRuntimeAdapters";
import "./app/connectedSessionRuntimeAdapter";
import "./app/connectedParticipantIdempotencyAdapter";
import "./app/connectedProjectionLifecycleAdapter";
import "./app/connectedRoleRoutingAdapter";
import "./app/connectedActionRoutingAdapter";
import "./app/connectedTurnRoutingAdapter";
import "./app/connectedCorrectionRoutingAdapter";
import "./app/productionSessionLifecycleAdapter";
import "./app/productionSessionEmptyEncounterAdapter";
import "./app/productionSessionUiStateAdapter";
import { PlaySessionDock } from "./PlaySessionDock";
import { CombatSpellHudBridge } from "./CombatSpellHud";
import { LevelUpV10Bridge } from "./LevelUpV10";
import { VisualDiceBridge } from "./VisualDiceBridge";
import { ConcentrationSaveBridge } from "./ConcentrationSaveBridge";
import { MovementReactionBridge } from "./MovementReactionBridge";
import { ProductionSessionWorkspaceBridge } from "./ProductionSessionWorkspaceBridge";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./play-session-dock.css";
import "./visual-dice.css";
import "./physics-dice.css";
import "./player-experience-redesign.css";
import "./movement-reaction.css";
import "./character-creation-v09.css";
import "./character-creation-v10.css";
import "./compact-options.css";
import "./character-sheet-v10.css";
import "./spell-ui.css";
import "./combat-spell-hud.css";
import "./level-up-v10.css";
import "./focused-layout-fix.css";
import "./character-sheet-v10-viewport.css";
import "./production-ux-redesign.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
      <PlaySessionDock />
      <CombatSpellHudBridge />
      <LevelUpV10Bridge />
      <VisualDiceBridge />
      <ConcentrationSaveBridge />
      <MovementReactionBridge />
      <ProductionSessionWorkspaceBridge />
    </AppProvider>
  </StrictMode>,
);
