// Canonical offline production adapter composition.
// Import this module anywhere the complete local runtime must be installed.
// Keep order aligned with the dependency layering below: authoring/progression,
// Phase 09 rules/runtime/event adapters, then Phase 10 durable persistence/content.
import "./characterCreationV10Adapter";
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
import "./phase09SpellcastingRuntimeRouter";
import "./characterLibraryRuntimeAdapter";
import "./authoringDraftRuntimeAdapter";
import "./installedContentRuntimeAdapter";
