import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/AppProvider";
import "./app/offlineRuntimeAdapters";
import "./app/connectedSessionRuntimeAdapter";
import "./app/connectedActionRoutingAdapter";
import "./app/connectedTurnRoutingAdapter";
import "./app/connectedCorrectionRoutingAdapter";
import { CombatSpellHudBridge } from "./CombatSpellHud";
import { LevelUpV10Bridge } from "./LevelUpV10";
import { VisualDiceBridge } from "./VisualDiceBridge";
import { ConcentrationSaveBridge } from "./ConcentrationSaveBridge";
import { MovementReactionBridge } from "./MovementReactionBridge";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./visual-dice.css";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
      <CombatSpellHudBridge />
      <LevelUpV10Bridge />
      <VisualDiceBridge />
      <ConcentrationSaveBridge />
      <MovementReactionBridge />
    </AppProvider>
  </StrictMode>,
);
