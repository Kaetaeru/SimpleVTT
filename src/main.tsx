import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/AppProvider";
import "./app/characterCreationV10Adapter";
import "./app/characterSheetV10Runtime";
import "./app/mockAdapterCompletion";
import "./app/spellcastingRuntimeAdapter";
import { CombatSpellHudBridge } from "./CombatSpellHud";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./character-creation-v09.css";
import "./character-creation-v10.css";
import "./compact-options.css";
import "./character-sheet-v10.css";
import "./spell-ui.css";
import "./combat-spell-hud.css";
import "./focused-layout-fix.css";
import "./character-sheet-v10-viewport.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
      <CombatSpellHudBridge />
    </AppProvider>
  </StrictMode>,
);
