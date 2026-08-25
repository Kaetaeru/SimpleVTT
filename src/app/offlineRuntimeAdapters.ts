// Canonical offline production adapter composition.
// Import this module anywhere the complete local runtime must be installed.
// Keep order aligned with the dependency layering below: authoring/progression,
// Phase 09 rules/runtime/event adapters, then Phase 10 durable persistence/content.
import "./characterCreationV10Adapter";
import "./characterCreationWeaponAttackAdapter";
import "./characterCreationSourceEditAdapter";
import "./characterSheetV10Runtime";
import "./mockAdapterCompletion";
import "./spellcastingRuntimeAdapter";
import "./progressionRuntimeAdapter";
import "./sorceryRuntimeAdapter";
import "./progressionPhase08SorcererAdapter";
import "./progressionPhase08WarlockAdapter";
import "./progressionPersistentFeatureRuntimeAdapter";
import "./progressionPhase08EpicBoonAdapter";
import "./progressionPhase08WeaponMasteryAdapter";
import "./progressionPhase08FighterStyleAdapter";
import "./progressionPhase08BarbarianPrimalKnowledgeAdapter";
import "./progressionPhase08SubclassAdapter";
import "./progressionPhase08BardLoreAdapter";
import "./progressionPhase08SorcererDraconicAdapter";
import "./progressionPhase08WizardEvocationAdapter";
import "./progressionPhase08MonkOpenHandAdapter";
import "./progressionPhase08RogueThiefAdapter";
import "./phase09RealResolutionAdapter";
import "./phase09RealItemCostAdapter";
import "./phase09RealNoRollDamageAdapter";
import "./phase09RealTurnRuntimeAdapter";
import "./phase09EffectAwareTurnAdapter";
import "./phase09RealRuntimeStatAdapter";
import "./phase09RealRuntimeAttackAdapter";
// Keep post-commit DM HP corrections inside the same canonical ResolutionEvent
// history so event-native Undo reverses correction then original resolution.
import "./dmAdjudicationResolutionEventAdapter";
import "./phase09ConcentrationSaveAdapter";
import "./phase09ManualMovementReactionAdapter";
import "./phase09RealAtomicHealingAdapter";
import "./phase09RealAtomicItemAdapter";
import "./phase09RealAtomicSavingThrowAdapter";
import "./subclassRuntimeAdapter";
import "./pactTomeRuntimeAdapter";
import "./druidCircleLandSpellRuntimeAdapter";
import "./restSpellManagementRuntimeAdapter";
import "./classFeatureSpellRuntimeAdapter";
// Project persisted arbitrary Character spell facts before the Phase 09 router captures
// its underlying snapshot function, so the existing authoritative HUD/slot bridge can
// seed TurnRuntime resources without any fixture-only caster registry.
import "./productionSpellcasterProjectionAdapter";
import "./phase09SpellcastingRuntimeRouter";
import "./characterLibraryRuntimeAdapter";
import "./characterSessionProjectionPersistenceGuard";
import "./authoringDraftRuntimeAdapter";
import "./installedContentRuntimeAdapter";
// Phase 14 outermost production composition: real Character -> live Scene/actions,
// authoritative spell execution, explicit DM-authored theater-of-mind spatial facts,
// canonical ItemInstance-backed weapon runtime facts, then production-only random d20 faces.
import "./productionPlayRuntimeAdapter";
import "./sessionInventoryRuntimeAdapter";
import "./theaterOfMindSpatialAdapter";
import "./productionSpellRuntimeAdapter";
import "./productionWeaponRuntimeFactAdapter";
import "./productionDiceRuntimeAdapter";
import "./standardActionReactionAdapter";
import "./fighterActionSurgeRuntimeAdapter";
import "./deathSaveRuntimeAdapter";
import "./stabilizeRuntimeAdapter";
import "./unarmedControlRuntimeAdapter";
import "./bardicInspirationActionRuntimeAdapter";
import "./bardicInspirationFollowUpRuntimeAdapter";
import "./fighterTacticalMindFollowUpRuntimeAdapter";
import "./fighterIndomitableFollowUpRuntimeAdapter";
import "./clericDivineSparkActionRuntimeAdapter";
import "./clericTurnUndeadActionRuntimeAdapter";
import "./paladinLayOnHandsActionRuntimeAdapter";
import "./paladinDivineSenseActionRuntimeAdapter";
import "./paladinAbjureFoesActionRuntimeAdapter";
// Record successful open ability checks as canonical ResolutionEvents after all
// production resolution wrappers have completed, without changing their UI/economy path.
import "./abilityCheckResolutionEventAdapter";
import "./abilityCheckDcRuntimeAdapter";
// Human-acceptance projection stays outermost: it materializes the remaining legacy
// reference Character summary, keeps the reference demo melee-playable, and projects
// runtime spatial legality into targetable attack options without changing mechanics authority.
import "./productionAcceptanceRuntimeAdapter";
import "./campaignRuntimeAdapter";
import "./campaignPartyStashCapabilityRuntimeAdapter";
import "./campaignRationConversionRuntimeAdapter";
