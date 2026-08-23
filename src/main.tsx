import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/campaignHydrationIssueAdapter";
import { ProductRoot } from "./ProductRoot";
import { AppProvider } from "./app/AppProvider";
import { initializeAppearancePreference } from "./app/appearancePreferences";
import { initializeMotionPreference } from "./app/motionPreferences";
import "./app/offlineRuntimeAdapters";
import "./app/connectedSessionRuntimeAdapter";
import "./app/connectedLongRestSessionAdapter";
import "./app/directNetworkSessionRuntimeAdapter";
import "./app/connectedParticipantIdempotencyAdapter";
import "./app/connectedProjectionLifecycleAdapter";
import "./app/connectedRoleRoutingAdapter";
import "./app/connectedActionRoutingAdapter";
import "./app/connectedTurnRoutingAdapter";
import "./app/connectedCorrectionRoutingAdapter";
import "./app/productionSessionLifecycleAdapter";
import "./app/productionSessionEmptyEncounterAdapter";
import "./app/productionSessionUiStateAdapter";
import "./app/sessionImageHandoutRuntimeAdapter";
import "./app/sessionContentParityRuntimeAdapter";
import "./app/campaignSessionHistoryRuntimeAdapter";
import "./app/connectedPartyStashHostPolicyAdapter";
import "./app/connectedCampaignSystemsRuntimeAdapter";
import "./app/connectedPartyStashClientPolicyAdapter";
import "./app/connectedPartyStashApprovalRuntimeAdapter";
import "./app/campaignDmLibraryMaterializationAdapter";
import "./app/connectedOwnerInventoryJournalAdapter";
import "./app/connectedOwnerInventoryExactCompensationAdapter";
import "./app/connectedDmLibraryGrantCommitAdapter";
import { CombatSpellHudBridge } from "./CombatSpellHud";
import { LevelUpV10Bridge } from "./LevelUpV10";
import { VisualDiceBridge } from "./VisualDiceBridge";
import { CombatVfxBridge } from "./CombatVfxBridge";
import { AppearanceSettingsBridge } from "./AppearanceSettingsBridge";
import { FirstRunTutorialBridge } from "./FirstRunTutorialBridge";
import { ConcentrationSaveBridge } from "./ConcentrationSaveBridge";
import { MovementReactionBridge } from "./MovementReactionBridge";
import { ProductionSessionWorkspaceBridge } from "./ProductionSessionWorkspaceBridge";
import { ProductionSessionDirectNetworkBridge } from "./ProductionSessionDirectNetworkBridge";
import { CharacterPortraitBridge } from "./CharacterPortraitBridge";
import { CharacterLibraryUxBridge } from "./CharacterLibraryUxBridge";
import { CampaignStartupRecoveryBridge } from "./CampaignStartupRecoveryBridge";
import { PartyStashApprovalOutcomeBridge } from "./PartyStashApprovalOutcomeBridge";
import "./styles.css";
import "./responsive.css";
import "./completion.css";
import "./visual-dice.css";
import "./physics-dice.css";
import "./combat-vfx.css";
import "./player-experience-redesign.css";
import "./player-experience-accessibility.css";
import "./v09-production-play.css";
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
import "./v1-product-shell.css";
import "./v1-product-shell-tokens.css";
import "./first-run-tutorial.css";
import "./appearance-settings.css";
import "./character-portrait.css";
import "./campaign-screen.css";
import "./session-image-handout.css";

void CombatSpellHudBridge;

initializeAppearancePreference();
initializeMotionPreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <ProductRoot />
      <LevelUpV10Bridge />
      <VisualDiceBridge />
      <CombatVfxBridge />
      <AppearanceSettingsBridge />
      <FirstRunTutorialBridge />
      <ConcentrationSaveBridge />
      <MovementReactionBridge />
      <ProductionSessionWorkspaceBridge />
      <ProductionSessionDirectNetworkBridge />
      <CharacterPortraitBridge />
      <CharacterLibraryUxBridge />
      <CampaignStartupRecoveryBridge />
      <PartyStashApprovalOutcomeBridge />
    </AppProvider>
  </StrictMode>,
);
