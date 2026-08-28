# Legacy Named-Execution Inventory

Status: **Phase 2 M0 inventory / frozen-debt source of truth**

Working branch: `agent/m0-named-execution-inventory`  
Parent Rerun branch: `agent/resolver-foundation-convergence`  
Runtime source baseline: `d6ab7ecc9cbfd4ec18cef74be92473877cc5598f`  
Initial boundary-green candidate: `8d0cf36d0bc7d4311111734a1c92eef8769fe365`

This inventory supports `docs/rules/resolver-execution-checklist.md` Phase 2. It does **not** authorize a big-bang rewrite and it does not activate Gate F-M.

## Inventory method

The runtime source baseline was inspected from the canonical local composition in `src/app/offlineRuntimeAdapters.ts`, the `src/app` execution surface, current domain/runtime tests, and the named-execution boundary scanner.

The machine-readable candidate/classification snapshot is `.agents/NAMED_EXECUTION_BASELINE.json`. `scripts/check-named-execution-boundary.mjs` scans `src/app` for execution-like named content signals:

- class/feature-specific runtime filenames;
- non-type imports from class/content-specific domain modules;
- known class action IDs;
- known class IDs;
- known feature-source literals.

Type-only imports are intentionally ignored. The scanner is a narrow architecture guard, not a repository-wide ban on content IDs. Deleting an inventoried legacy file is allowed. A new semantic candidate must be classified instead of silently increasing named execution debt.

At the M0 snapshot the scanner/baseline contains **59 classified candidates**:

- **35 `LEGACY_EXECUTION`** — play/runtime or runtime-state behavior that selects semantics from known content identity and must converge/delete;
- **9 `CONTENT/PRESENTATION`** — named catalog, contract, reference-fixture, or presentation data that may remain named;
- **15 `UNCLEAR`** — character-authoring/progression paths that use known class identity but are outside the current play-runtime strangler boundary; review before editing;
- no scanner finding is currently classified `GENERIC_ENGINE`; generic engine anchors are recorded separately below because they intentionally contain no named-content signal.

## `LEGACY_EXECUTION` findings

`Current oracle` identifies existing behavior coverage to preserve before deletion. A migration slice must freeze a deterministic golden case before replacing any path.

| File | Recognized identity / execution symbol | Mechanism family | Current oracle | Authority / lifetime dependency | Likely Common Play composition |
| --- | --- | --- | --- | --- | --- |
| `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` | Berserker / Intimidating Presence; named action + resolver via `MockAdapter.prototype` | action, save, persistent effect | `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts`; `tests/domain/barbarianBerserker.test.ts` | active actor, target facts, effect lifetime | entry point + semantic facts + save + `effect.apply`/condition |
| `src/app/barbarianRageRuntimeAdapter.ts` | Barbarian Rage action/resource/effect | action, resource, persistent effect | `tests/ui/barbarianRageActionRuntime.test.ts`; `tests/ui/barbarianRageAttackDamage.test.ts` | turn runtime resource; rage effect lifetime | resource payment + effect artifact/state + generic damage modifier/interceptor |
| `src/app/bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` | College of Lore / Cutting Words | cross-owner reaction, roll modification | `tests/domain/bardCollegeLore.test.ts`; `tests/ui/bardCollegeLoreCuttingWordsRuntime.test.ts` | remote owner authority, reaction economy, retry/reconnect, pending roll | Gate A interaction/interceptor + resource/reaction payment + `roll.modify`/recalculation |
| `src/app/bardCollegeLorePeerlessSkillFollowUpRuntimeAdapter.ts` | College of Lore / Peerless Skill | self follow-up, roll modification | `tests/domain/bardCollegeLore.test.ts`; `tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts` | owner authority, resource payment, pending check | generic interaction + resource payment + `roll.modify` |
| `src/app/bardicInspirationActionRuntimeAdapter.ts` | Bardic Inspiration grant action | action, resource, target-bound effect | `tests/domain/bardicInspiration.test.ts`; `tests/ui/bardicInspirationActionRuntime.test.ts` | actor resource, target lifetime, action economy | resource payment + target selector + effect/artifact grant |
| `src/app/bardicInspirationFollowUpRuntimeAdapter.ts` | Bardic Inspiration consumption | follow-up/interceptor, roll modification | `tests/domain/bardicInspiration.test.ts`; `tests/ui/bardicInspirationFollowUpRuntime.test.ts` | effect owner, pending failed d20, one-use consumption | interaction + effect consumption + `roll.modify` |
| `src/app/bardicInspirationRuntimeAdapter.ts` | Bard class ID / Bardic Inspiration resource definition | runtime resource materialization | `tests/domain/bardicInspiration.test.ts`; `tests/ui/bardicInspirationRuntimeAdapter.test.ts` | Character durable resource and recovery | portable resource definition + generic resource projection |
| `src/app/characterSessionProjectionReconstruction.ts` | hard-coded class/action/item identities including Rogue/Fighter/Barbarian/Monk | session projection and action reconstruction | `tests/ui/characterSessionProjectionReconstruction.test.ts` | Host canonical projection, reconnect/reconstruction | portable content identity + generic action/resource/item projection; no class-ID action synthesis |
| `src/app/classFeatureSpellRuntimeAdapter.ts` | Barbarian/Paladin/Warlock/Monk named runtime resource definitions | runtime resource materialization | `tests/domain/classFeatureSpellResources.test.ts`; `tests/ui/classFeatureSpellRuntimeAdapter.test.ts` | Character durable resources and recovery | content-declared resources + generic resource projection |
| `src/app/clericDivineSparkActionRuntimeAdapter.ts` | Cleric Divine Spark / Channel Divinity | action, resource, heal/damage | `tests/domain/clericDivineSpark.test.ts`; production UI action coverage | actor resource/economy, target authority | resource payment + selector + healing/damage operation |
| `src/app/clericTurnUndeadActionRuntimeAdapter.ts` | Cleric Turn Undead / Channel Divinity | multi-target save, condition/effect | `tests/domain/clericTurnUndead.test.ts`; production UI action coverage | target selection, saves, effect lifetime | Gate B save set + condition/effect application |
| `src/app/druidCircleLandSpellRuntimeAdapter.ts` | Circle of the Land spell/rest identity | rest configuration, spell grants | `tests/domain/druidCircleLandSpells.test.ts`; rest-spell management UI coverage | long-rest mutation, Character prepared-spell state | portable content grants + generic rest/character state change; review against authoring boundary |
| `src/app/druidWildShapeRuntimeAdapter.ts` | Druid/Wild Shape resource, form IDs and form limits | form overlay, resource, persistent lifetime | `tests/domain/druidWildShape.test.ts`; `tests/domain/druidWildShapeSpellcasting.test.ts`; `tests/ui/druidWildShapeActionRuntime.test.ts` | form lifetime, temp HP choice, actor authority | try existing effect/artifact composition first; if form overlay cannot compose, capture deterministic failure before Gate J consideration |
| `src/app/fighterActionSurgeRuntimeAdapter.ts` | Fighter Action Surge action and resources | action/resource/economy | `tests/domain/fighterActionSurge.test.ts`; production play action coverage | active turn, per-rest and per-turn resource | resource payment + `economy.modify`/extra-action state |
| `src/app/fighterIndomitableFollowUpRuntimeAdapter.ts` | Fighter Indomitable | save reroll/follow-up | `tests/domain/fighterIndomitable.test.ts`; saving-throw runtime coverage | owner authority, resource, pending save | interaction + resource payment + generic reroll/roll replacement |
| `src/app/fighterTacticalMindFollowUpRuntimeAdapter.ts` | Fighter Tactical Mind | failed check follow-up | `tests/domain/fighterTacticalMind.test.ts`; runtime follow-up coverage | owner authority, Second Wind resource, pending check | interaction + resource payment + `roll.modify` |
| `src/app/monkFocusRuntimeAdapter.ts` | Monk Focus resource/actions | resource/economy/action | `tests/ui/monkFocusActionRuntime.test.ts`; Monk domain coverage | actor resource, turn economy | resource payment + generic action operations |
| `src/app/monkOpenHandFleetStepRuntimeAdapter.ts` | Open Hand Fleet Step | bonus-action/economy modification | `tests/ui/monkOpenHandFleetStepRuntime.test.ts` | turn economy/resource | resource/economy operations |
| `src/app/monkOpenHandQuiveringPalmRuntimeAdapter.ts` | Open Hand Quivering Palm | stored/delayed target state and later resolution | `tests/ui/monkOpenHandQuiveringPalmRuntime.test.ts` | target-bound stored state, later invocation, cleanup | first attempt effect/artifact + interaction; only activate stored-invocation capability if a concrete migration failure proves it necessary |
| `src/app/monkOpenHandWholenessRuntimeAdapter.ts` | Open Hand Wholeness of Body | self healing/resource | `tests/ui/monkOpenHandWholenessRuntime.test.ts` | actor resource/recovery | resource payment + `healing.apply` |
| `src/app/pactTomeRuntimeAdapter.ts` | Pact of the Tome / Book of Shadows | rest spell configuration / grants | `tests/domain/warlockPactTome.test.ts`; `tests/ui/warlockPactTomeRuntimeAdapter.test.ts` | Character durable spell state; rest boundary | portable content grants + generic rest/character state change |
| `src/app/paladinAbjureFoesActionRuntimeAdapter.ts` | Paladin Abjure Foes / Channel Divinity | multi-target save/effect | `tests/domain/paladinAbjureFoes.test.ts`; production UI action coverage | target set, save results, effect lifetime | Gate B selector/save + effect/condition operation |
| `src/app/paladinDevotionHolyNimbusRuntimeAdapter.ts` | Devotion Holy Nimbus | persistent aura/effect/event | `tests/ui/paladinDevotionHolyNimbusRuntime.test.ts`; Paladin aura domain coverage | persistent effect, turn/event lifetime, spatial membership if applicable | Gate C effect trigger + Gate D/E semantic zone/facts where needed |
| `src/app/paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` | Devotion Smite of Protection | attack-linked protection/effect | `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts` | attack resolution, effect lifetime | generic interceptor/effect operations; no subclass branch |
| `src/app/paladinDivineSenseActionRuntimeAdapter.ts` | Paladin Divine Sense | action/resource/semantic sensing | `tests/domain/paladinDivineSense.test.ts`; production UI action coverage | actor resource, semantic fact authority | resource payment + adjudication/fact request + effect/result projection |
| `src/app/paladinLayOnHandsActionRuntimeAdapter.ts` | Paladin Lay on Hands | targeted healing/resource | `tests/domain/paladinLayOnHands.test.ts`; production UI action coverage | target authority, healing pool | resource payment + selector + `healing.apply` |
| `src/app/phase09RealAtomicSavingThrowAdapter.ts` | Fighter Indomitable modifier inserted into otherwise generic save transaction | hidden named branch in generic-looking adapter | Phase 09 atomic saving-throw UI regressions; `tests/domain/fighterIndomitable.test.ts` | pending save, owner resource, atomic resolution | remove named modifier lookup; generic interaction/interceptor must contribute to the pending save |
| `src/app/productionPlayRuntimeAdapter.ts` | hard-coded Fighter/Bard/Cleric/Paladin/Rogue and feature identities, attack-count and action projection | broad action/resource projection | production play/session UI suites, fresh-character action/spell/inventory coverage | Host/session projection, Character state, action availability | portable content/RuleModule action projection + generic resources/selectors; this is a major strangler boundary, not a new engine |
| `src/app/realAttackTransactionService.ts` | `BARBARIAN_RAGE_TAG` adds Rage damage inside generic-looking attack service | hidden attack interceptor/damage rider | `tests/ui/barbarianRageAttackDamage.test.ts`; Phase 09 attack transaction regressions | authoritative attack state and active effect lifetime | generic effect/interceptor contribution to attack damage; delete Rage tag branch |
| `src/app/restSpellManagementRuntimeAdapter.ts` | Wizard preparation, Pact Tome and Circle Land named rest paths | rest/character mutation | Wizard long-rest, Pact Tome, Circle Land domain tests and rest-spell UI coverage | long/short rest authority, durable Character spells | portable content grants/replacements + generic rest transaction; no feature-name router |
| `src/app/rogueCoreRuntimeAdapter.ts` | Rogue class/core actions | action/economy/attack rider | `tests/ui/rogueCoreActionRuntime.test.ts`; Rogue domain coverage | turn economy, attack/check state | generic actions, economy and attack interceptor composition |
| `src/app/rogueCunningHideEventRuntimeAdapter.ts` | Rogue Cunning Action Hide | post-check effect/event composition | production Rogue/ability-check event coverage | check ResolutionEvent, turn/effect lifetime | generic entry-point/interceptor triggered by committed check event + effect apply |
| `src/app/sorceryRuntimeAdapter.ts` | Sorcerer ID / Sorcerous Restoration resource | runtime resource materialization | `tests/domain/sorcery.test.ts`; Sorcerer progression runtime coverage | Character resource/recovery | portable resource definition + generic resource projection |
| `src/app/subclassRuntimeAdapter.ts` | Circle of the Land subclass ID / Natural Recovery pools | hidden named subclass resource branch | `tests/ui/subclassRuntimeAdapter.test.ts`; Circle Land recovery domain coverage | Character subclass identity, durable resource/recovery | content-declared resources/grants + generic projection; delete Druid subclass branch |
| `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts` | Fiend / Dark One's Own Luck | failed roll follow-up | `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`; Warlock domain coverage | owner authority, resource, pending d20 | interaction + resource payment + `roll.modify` |

## `CONTENT/PRESENTATION` findings

These files contain known IDs or named contract/reference data but the M0 inspection did not identify them as current play-runtime algorithm selectors. They may remain named. If later edits move execution authority into them, the classification must change.

| File | Why named data is allowed |
| --- | --- |
| `src/app/characterCreationV09Meta.ts` | creation metadata/catalog mapping |
| `src/app/characterCreationV09Plan.ts` | creation plan/presentation data |
| `src/app/characterCreationV10Choices.ts` | authoring choice data |
| `src/app/characterCreationV10Data.ts` | canonical creation/catalog bridge data |
| `src/app/characterCreationV10Plan.ts` | authoring plan/projection |
| `src/app/characterSheetV10Projection.ts` | Character sheet projection/presentation |
| `src/app/mockAdapter.ts` | reference/demo fixture data; not an allowed template for new product execution hardcoding |
| `src/app/paladinLayOnHandsRuntimeContracts.ts` | named contract/action identity consumed by legacy runtime; data/contract itself may remain named |
| `src/app/srdCatalogBridge.ts` | SRD catalog/content identity bridge |

## `UNCLEAR` findings — do not edit without architecture review

These paths use known class identity while owning character creation or progression mutation. They are deliberately isolated from the current play-runtime strangler so M0 does not silently broaden Phase 2 into a second migration program. Before changing one, decide whether its behavior is portable content authoring, generic progression policy, or legacy execution that belongs in the convergence program.

- `src/app/characterCreationV09Adapter.ts`
- `src/app/characterCreationV10Adapter.ts`
- `src/app/progressionPhase08BarbarianPrimalKnowledgeAdapter.ts`
- `src/app/progressionPhase08BardLoreAdapter.ts`
- `src/app/progressionPhase08EpicBoonAdapter.ts`
- `src/app/progressionPhase08FighterStyleAdapter.ts`
- `src/app/progressionPhase08MonkOpenHandAdapter.ts`
- `src/app/progressionPhase08RogueThiefAdapter.ts`
- `src/app/progressionPhase08SorcererAdapter.ts`
- `src/app/progressionPhase08SorcererDraconicAdapter.ts`
- `src/app/progressionPhase08SubclassAdapter.ts`
- `src/app/progressionPhase08WarlockAdapter.ts`
- `src/app/progressionPhase08WeaponMasteryAdapter.ts`
- `src/app/progressionPhase08WizardEvocationAdapter.ts`
- `src/app/progressionRuntimeAdapter.ts`

## `GENERIC_ENGINE` anchors

These are not scanner findings because they intentionally do not recognize named class/feature identities. They are the target execution language/boundary and should stay generic:

- `src/domain/resolution.ts` — authoritative operation execution/stage/commit;
- `src/domain/commonPlayRuntime.ts` — generic Common Play interaction/reaction runtime;
- `src/domain/commonPlayEntryPointRuntime.ts` — generic entry-point lowering;
- `src/domain/commonPlayEffectRuntime.ts` — generic persistent effect lowering;
- `src/domain/commonPlayZoneRuntime.ts` — generic zone artifact/event/frequency runtime;
- `src/domain/commonPlaySpatialFactRuntime.ts` / movement/fact support added by Gate E;
- `src/app/connectedSessionRuntimeAdapter.ts` — transport/session authority infrastructure when it remains content-agnostic;
- `src/app/standardActionReactionAdapter.ts` — standard Ready/reaction infrastructure, not a named Class/Subclass/Feat/Spell/Item executor.

## Migration order implications

M0 does not choose migration by class name. The findings above should be consumed by **mechanism family**:

1. simple action/resource/economy probe;
2. reaction/cross-owner interceptor probe, with Cutting Words as a behavior oracle;
3. persistent effect/event probe;
4. spatial probe where an existing supported rule actually exercises Gate D/E;
5. then coherent family waves.

`productionPlayRuntimeAdapter.ts`, `characterSessionProjectionReconstruction.ts`, `realAttackTransactionService.ts`, and `phase09RealAtomicSavingThrowAdapter.ts` are high-value strangler boundaries because they hide named semantics behind generic-looking infrastructure. They must not become permanent compatibility engines.

## Boundary guard

Files:

- `.agents/NAMED_EXECUTION_BASELINE.json`
- `scripts/check-named-execution-boundary.mjs`
- `tests/ui/namedExecutionBoundary.test.mjs`
- `.github/workflows/named-execution-boundary.yml`

Policy:

- legacy entries are frozen debt, not an allowlist for copying patterns;
- deleting a migrated legacy entry/file is allowed;
- type-only content imports do not count as execution ownership;
- a new `src/app` semantic candidate is CI-red until explicitly classified;
- a new `LEGACY_EXECUTION` path is forbidden by the product plan even if someone attempts to update the baseline;
- content/presentation and fixtures can remain named when they do not select runtime execution semantics;
- this guard is intentionally heuristic and narrow; architecture review remains required for semantic changes that evade lexical detection.

## M0 exit

M0 is complete when this inventory, machine baseline, scanner regression, and CI guard are merged into the Rerun working branch. No legacy behavior is deleted during M0. M1 then establishes the generic migration harness before the first strangler replacement.
