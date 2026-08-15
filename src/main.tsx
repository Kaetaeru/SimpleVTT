import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./app/AppProvider";
import "./app/characterCreationV10Adapter";
import "./app/characterSheetV10Runtime";
import "./app/mockAdapterCompletion";
import "./app/spellcastingRuntimeAdapter";
import "./app/progressionRuntimeAdapter";
import "./app/sorceryRuntimeAdapter";
import "./app/progressionPhase08SorcererAdapter";
import "./app/progressionPhase08WarlockAdapter";
import "./app/progressionPersistentFeatureRuntimeAdapter";
import "./app/progressionPhase08EpicBoonAdapter";
import "./app/progressionPhase08WeaponMasteryAdapter";
import "./app/progressionPhase08FighterStyleAdapter";
import "./app/progressionPhase08BarbarianPrimalKnowledgeAdapter";
import "./app/progressionPhase08SubclassAdapter";
import "./app/progressionPhase08BardLoreAdapter";
import "./app/progressionPhase08SorcererDraconicAdapter";
import "./app/progressionPhase08WizardEvocationAdapter";
import "./app/progressionPhase08MonkOpenHandAdapter";
import "./app/progressionPhase08RogueThiefAdapter";
import "./app/phase09RealResolutionAdapter";
import "./app/phase09RealItemCostAdapter";
import "./app/phase09RealNoRollDamageAdapter";
import "./app/phase09RealTurnRuntimeAdapter";
import "./app/phase09RealRuntimeStatAdapter";
import "./app/phase09RealRuntimeAttackAdapter";
import "./app/phase09RealAtomicHealingAdapter";
import "./app/phase09RealAtomicItemAdapter";
import "./app/phase09RealAtomicSavingThrowAdapter";
import "./app/subclassRuntimeAdapter";
import "./app/pactTomeRuntimeAdapter";
import "./app/druidCircleLandSpellRuntimeAdapter";
import "./app/restSpellManagementRuntimeAdapter";
import "./app/classFeatureSpellRuntimeAdapter";
import { CombatSpellHudBridge } from "./CombatSpellHud";
import { LevelUpV10Bridge } from "./LevelUpV10";
import { VisualDiceBridge } from "./VisualDiceBridge";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./visual-dice.css";
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
    </AppProvider>
  </StrictMode>,
);
