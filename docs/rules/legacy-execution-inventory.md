# Legacy Execution Inventory — Phase 2 M0

Status: **M0 inventory / freeze candidate**

Working scope: `agent/resolver-foundation-convergence` → integration target `work/v1-composite`.

This document inventories the current canonical offline execution composition before strangler migration. It does **not** authorize a big-bang rewrite and it does not make named files illegal. The architectural violation is using known content identity to choose execution semantics after content has entered the runtime.

The machine-readable exhaustive classification of the canonical offline composition is:

`.agents/EXECUTION_COMPOSITION_BASELINE.json`

The guarded composition root is:

`src/app/offlineRuntimeAdapters.ts`

Every side-effect import in that root must have one of the four M0 classifications before CI accepts the composition. The baseline is allowed to shrink as legacy execution is deleted. Adding a new generic module is allowed, but only after it is explicitly classified; adding an unclassified adapter fails the guard.

## Classification rules

- `CONTENT/PRESENTATION` — named authoring, fixture, label, projection, or presentation code that does not own authoritative execution semantics.
- `LEGACY_EXECUTION` — code that recognizes known class/subclass/feature/resource identity or calls a known-content resolver to select runtime behavior. It must migrate or be deleted when its Common Play replacement becomes authoritative.
- `GENERIC_ENGINE` — shared operation/capability/session/resolver infrastructure whose algorithm is selected by semantic operation/capability rather than content identity.
- `UNCLEAR` — current composition code whose ownership boundary needs architecture review before it is edited or used as a migration base.

A named domain file can contain both allowed data and legacy execution. M0 therefore records migration at adapter/resolver-symbol granularity rather than declaring entire named files disposable.

## Canonical generic execution spine

The following are representative `GENERIC_ENGINE` boundaries and are **not** migration targets merely because they are runtime files:

- `src/domain/resolution.ts` — typed operation execution, PendingResolution and authoritative StateChange commit;
- `src/domain/commonPlayRuntime.ts` and the Common Play entry-point/effect/zone/spatial runtimes — generic Common Play execution surfaces;
- `src/app/phase09RealResolutionAdapter.ts`, atomic damage/healing/item/save adapters, turn runtime, movement/reaction and adjudication adapters — generic resolution/session bridge;
- `src/app/phase09SpellcastingRuntimeRouter.ts` and `src/app/productionSpellRuntimeAdapter.ts` — dispatch by generic spell mechanic kind rather than a spell ID/name;
- `src/app/deathSaveRuntimeAdapter.ts`, `stabilizeRuntimeAdapter.ts`, `unarmedControlRuntimeAdapter.ts` — RulesProfile/core action semantics, not imported content identity;
- connected-session transport, ownership and projection adapters imported by `src/main.tsx` — generic session authority infrastructure. Feature-specific owner/reaction behavior that currently reaches them through a legacy adapter remains part of that legacy adapter's migration record.

## `LEGACY_EXECUTION` findings

The rows below group closely related files, but every canonical app module is explicitly classified in `.agents/EXECUTION_COMPOSITION_BASELINE.json`.

| Mechanism family | Files / execution symbols | Recognized identity | Current behavior oracle | Authority / lifetime dependency | Likely Common Play composition |
| --- | --- | --- | --- | --- | --- |
| Sorcerer / Warlock progression and Sorcery | `src/app/sorceryRuntimeAdapter.ts`; `progressionPhase08SorcererAdapter.ts`; `progressionPhase08WarlockAdapter.ts` | known Sorcerer/Warlock class resources, Sorcery Points and Pact progression | `tests/domain/sorcery.test.ts`; `tests/ui/progressionPhase08SorcererRuntime.test.ts`; `tests/ui/progressionPhase08WarlockRuntime.test.ts` | durable Character progression/resources; rest recovery where applicable | portable grants/resources + `resource.change`/recovery policy; RulesProfile owns edition arithmetic |
| Named progression choices | `progressionPhase08EpicBoonAdapter.ts`; `progressionPhase08FighterStyleAdapter.ts`; `progressionPhase08BarbarianPrimalKnowledgeAdapter.ts`; `progressionPhase08SubclassAdapter.ts` | known feat/class/subclass choice identity | `progressionPhase08EpicBoonRuntime.test.ts`; `progressionPhase08FighterStyleRuntime.test.ts`; `progressionPhase08BarbarianPrimalKnowledgeRuntime.test.ts`; `progressionPhase08SubclassRuntime.test.ts` | durable Character grants/choices | portable content grants, selectors and resources; no class-name branch in runtime |
| Named subclass progression | `progressionPhase08BardLoreAdapter.ts`; `progressionPhase08SorcererDraconicAdapter.ts`; `progressionPhase08WizardEvocationAdapter.ts`; `progressionPhase08MonkOpenHandAdapter.ts`; `progressionPhase08RogueThiefAdapter.ts` | College of Lore, Draconic Sorcery, Evoker, Open Hand, Thief identities | `progressionPhase08BardLoreRuntime.test.ts`; `progressionPhase08SorcererDraconicRuntime.test.ts`; `progressionPhase08WizardEvocationRuntime.test.ts`; shared Phase-08 progression coverage for Open Hand/Thief | durable Character subclass grants and resources | portable grants/resource definitions; runtime entry points remain generic |
| Subclass/resource materialization | `subclassRuntimeAdapter.ts`; `classFeatureSpellRuntimeAdapter.ts` | Druid Circle of the Land and known class/subclass resource-definition modules | `subclassRuntimeAdapter.test.ts`; `classFeatureSpellRuntimeAdapter.test.ts`; `coreClassResourceRuntimeAdapter.test.ts` | durable Character metadata/resources | portable resource/grant definitions produced by imported content; no named subclass resource materializer |
| Pact / Land spell features | `pactTomeRuntimeAdapter.ts`; `druidCircleLandSpellRuntimeAdapter.ts` | Pact of the Tome and Circle of the Land identities | `warlockPactTomeRuntimeAdapter.test.ts`; `druidCircleLandSpellRuntimeAdapter.test.ts` | durable known/prepared spells and feature resources | portable spell grants/preparation capabilities + generic spell runtime |
| Fighter action/resource and follow-up rules | `fighterActionSurgeRuntimeAdapter.ts`; `fighterTacticalMindFollowUpRuntimeAdapter.ts`; `fighterIndomitableFollowUpRuntimeAdapter.ts` | Fighter Action Surge, Tactical Mind, Indomitable IDs/resources | `fighterActionSurgeRuntimeAdapter.test.ts`; `fighterTacticalMindFollowUpRuntime.test.ts`; `fighterIndomitableFollowUpRuntime.test.ts` | action/turn economy, resource payment; follow-up retry state | entry-point + payment/resource + generic interaction/retry + roll replacement/modification |
| Barbarian / Berserker runtime | `barbarianRageRuntimeAdapter.ts`; `barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` | Barbarian/Rage/Berserker/action IDs and named resolvers | `barbarianRageActionRuntime.test.ts`; `barbarianRageAttackDamage.test.ts`; `barbarianBerserkerIntimidatingPresenceRuntime.test.ts`; connected Rage/Berserker projection tests | turn/action economy, durable resource, persistent effect/event lifetime, connected actor ownership | entry-point + payment/resource + effect/event interceptor; Intimidating Presence via generic save/effect composition |
| Druid form runtime | `druidWildShapeRuntimeAdapter.ts` | Wild Shape/resource/form identity | `druidWildShapeActionRuntime.test.ts`; connected Wild Shape projection test | action/resource payment, form lifetime, Character/session projection | existing operations first; if faithful form overlay cannot compose, capture the concrete failure before considering Gate J |
| Monk / Open Hand runtime | `monkFocusRuntimeAdapter.ts`; `monkOpenHandWholenessRuntimeAdapter.ts`; `monkOpenHandFleetStepRuntimeAdapter.ts`; `monkOpenHandQuiveringPalmRuntimeAdapter.ts` | Focus Points and named Open Hand features | `monkFocusActionRuntime.test.ts`; `monkOpenHandWholenessRuntime.test.ts`; `monkOpenHandFleetStepRuntime.test.ts`; `monkOpenHandQuiveringPalmRuntime.test.ts`; corresponding connected projection tests | action/bonus-action/resource economy, persistent marks/effects, connected owner projection | resource/payment + movement/effect/interaction/trigger composition; new primitive only after deterministic failure |
| Rogue runtime | `rogueCoreRuntimeAdapter.ts`; `rogueCunningHideEventRuntimeAdapter.ts` | Cunning Action / Uncanny Dodge / Cunning Hide feature identity | `rogueCoreActionRuntime.test.ts`; connected Cunning Dash/Disengage/Hide and Uncanny Dodge projection tests | action/reaction economy, owner authority, event history and Undo | generic economy + reaction/interaction + ability-check event/effect composition |
| Bard / College of Lore runtime | `bardicInspirationActionRuntimeAdapter.ts`; `bardicInspirationFollowUpRuntimeAdapter.ts`; `bardCollegeLorePeerlessSkillFollowUpRuntimeAdapter.ts`; `bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` | Bardic Inspiration, Peerless Skill and Cutting Words IDs/resources | `bardicInspirationActionRuntime.test.ts`; `bardicInspirationFollowUpRuntime.test.ts`; `bardicInspirationRuntimeAdapter.test.ts`; `bardCollegeLorePeerlessSkillRuntime.test.ts`; `bardCollegeLoreCuttingWordsRuntime.test.ts`; connected Peerless Skill/private-interrupt coverage | resource/reaction payment, owner-only responder, pending interaction, roll recalculation, retry/reconnect/idempotency | Gate A generic interaction + resource/economy + `roll.modify`/recalculation; Cutting Words remains the primary cross-owner M2 probe |
| Warlock Fiend follow-up | `warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts` | Dark One's Own Luck ID/resource | `warlockFiendDarkOnesOwnLuckRuntime.test.ts`; connected Dark One's Own Luck projection test | owner interaction, resource payment, roll modification | generic interaction/payment + roll modification |
| Cleric Channel Divinity actions | `clericDivineSparkActionRuntimeAdapter.ts`; `clericTurnUndeadActionRuntimeAdapter.ts` | Divine Spark / Turn Undead IDs and Channel Divinity resource | `clericDivineSparkActionRuntime.test.ts`; `clericTurnUndeadActionRuntime.test.ts` | action/resource payment, multi-target save/damage/effect lifetime | payment + Gate B target/save/damage + condition/effect operations |
| Paladin actions / Devotion runtime | `paladinLayOnHandsActionRuntimeAdapter.ts`; `paladinDivineSenseActionRuntimeAdapter.ts`; `paladinAbjureFoesActionRuntimeAdapter.ts`; `paladinDevotionHolyNimbusRuntimeAdapter.ts`; `paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` | Lay on Hands, Divine Sense, Abjure Foes, Holy Nimbus, Smite of Protection IDs/resources | `paladinLayOnHandsActionRuntime.test.ts`; `paladinDivineSenseActionRuntime.test.ts`; `paladinAbjureFoesActionRuntime.test.ts`; `paladinDevotionHolyNimbusRuntime.test.ts`; `paladinDevotionSmiteOfProtectionRuntime.test.ts`; connected Holy Nimbus/Smite projection tests | action/resource economy, persistent aura/effect lifetime, connected projection/Undo | resource/payment + healing/fact/effect/zone/interceptor composition using Gates A-E |

### Named domain resolver ownership

The adapters above call or materialize named domain symbols in files such as Barbarian/Berserker, Bard College of Lore, class/subclass resource, Fighter, Druid, Monk, Rogue, Cleric, Paladin and Warlock domain modules. M0 does **not** label those whole files for deletion. During migration, only resolver/compiler/resource-materialization symbols that select behavior from known content identity are removed. Pure catalog data, labels, progression data and presentation/provenance may remain named.

## `UNCLEAR` findings

These canonical composition entries are frozen but require architecture review before editing. They are not permission to extend content-specific logic.

| File | Why unclear | Current tests / evidence | M1 handling |
| --- | --- | --- | --- |
| `characterCreationV10Adapter.ts` | authoring surface mixes rules-derived choices with Character construction | character creation catalog/complete-gate and creation structure tests | keep outside resolver migration unless a named execution dependency is demonstrated |
| `characterCreationWeaponAttackAdapter.ts` | creates weapon-derived attack state during authoring; may be generic item composition or legacy rule materialization | character creation + production weapon coverage | inspect only if a migration touches weapon authoring |
| `progressionPhase08WeaponMasteryAdapter.ts` | Weapon Mastery is a reusable rules mechanism but current Phase-08 implementation may recognize named mastery/content choices | `progressionPhase08WeaponMasteryRuntime.test.ts` and domain counterpart | decide generic mechanism vs legacy content selection before editing; do not activate a new gate from inventory alone |

## `CONTENT/PRESENTATION` findings

The frozen composition currently classifies source-edit/character-sheet/reference-acceptance style adapters as presentation/authoring boundaries. They may keep named labels, provenance and reference fixtures as long as they do not become an authoritative named execution engine. The exact entries live in `.agents/EXECUTION_COMPOSITION_BASELINE.json`.

## Guard contract

`scripts/check-execution-composition-boundary.mjs` compares every side-effect import in `src/app/offlineRuntimeAdapters.ts` with `.agents/EXECUTION_COMPOSITION_BASELINE.json`.

It fails when:

1. a composition import is added without an explicit M0 classification;
2. a baseline entry remains after its composition import has been removed;
3. an entry has an invalid classification;
4. a composition/baseline module is duplicated.

This guard intentionally does **not** ban content IDs repository-wide and does not prevent deleting legacy imports. It is an ingress freeze, not a permanent architecture checker. M1/M2 still require unknown-ID/rename invariance and deletion of each absorbed named branch; those executable invariants are stronger than lexical ID scanning.

## M0 handoff

When the guard is green on the exact candidate SHA, M0 is complete if the canonical checklist records the same state. M1 should then establish one migration harness and use representative behavior oracles rather than extending any adapter listed `LEGACY_EXECUTION` above.

The first preferred migration probe remains a small action/resource/economy path that should compose from existing Gates A-E. Cutting Words remains the reaction/cross-owner probe after the harness is established. Gate F-M stay dormant unless a bounded migration failure proves an existing primitive is insufficient.
