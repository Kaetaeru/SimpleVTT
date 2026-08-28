# Legacy Execution Inventory

Status: **M0 inventory authority for Phase 2 Legacy Convergence**

Working branch: `agent/resolver-foundation-convergence`  
Integration target: `work/v1-composite`  
Initial scan base: `d6ab7ecc9cbfd4ec18cef74be92473877cc5598f`

This inventory separates named content/data from code that chooses execution semantics by known content identity. A named file is not legacy merely because it contains a class, subclass, feat, spell, or item name. The migration target is executable ownership that depends on identity, plus explicit compatibility routers that preserve a second named/legacy engine.

## Classification rules

- `CONTENT/PRESENTATION`: named catalog, labels, authoring data, reference fixtures, or projections that do not choose an execution algorithm.
- `LEGACY_EXECUTION`: runtime/application/domain behavior that recognizes known content identity, imports known-content resolvers/definitions to choose effects, or preserves a compatibility route into a named engine. Mixed modules are classified here when any installed symbol still owns identity-dependent execution; migration may preserve their generic symbols.
- `GENERIC_ENGINE`: identity-agnostic resolution, Common Play, session authority, persistence, RulesProfile/core-rule, and projection plumbing.
- `UNCLEAR`: evidence is insufficient to edit safely. The current composition has three explicitly `UNCLEAR` adapter imports; they require symbol-level review before any migration edit.

## Scan boundary and freeze

`src/app/offlineRuntimeAdapters.ts` is the canonical offline production composition. `.agents/LEGACY_EXECUTION_BASELINE.json` classifies every side-effect import in that composition. The checker `scripts/check-legacy-execution-boundary.mjs` and `tests/ui/legacyExecutionBoundary.test.mjs` enforce exact ledger discipline:

1. every current production import must already be classified;
2. an invalid or duplicate classification fails;
3. deleting an import requires deleting its baseline entry in the same migration, so the removed legacy path cannot later be silently reintroduced;
4. adding any production runtime path fails until architecture review classifies it;
5. the baseline must never grow merely to admit a new named-content adapter.

The guard is deliberately not a repository-wide ID ban. Tests, fixtures, catalogs, and presentation may legitimately contain known IDs. Transitive named code discovered during migration still belongs in this inventory even when the top-level composition entry is the module that installs it.

## LEGACY_EXECUTION — central compatibility, progression, and dispatch

| File / symbol boundary | Recognized identity / selection | Mechanism | Current behavior oracle | Authority / lifetime | Convergence target |
| --- | --- | --- | --- | --- | --- |
| `src/app/spellcastingRuntimeAdapter.ts` — `SPELL_META`, `commitFreeformSpellSlot`, `spellMechanicById` | explicit action IDs map to `dnd.srd521.spell.*`; mechanic looked up by spell ID | legacy spell execution / slot economy | `tests/ui/spellcastingRuntimeAdapter.test.ts`, `test:spellcasting` | runtime state, slots, target facts, Undo | RuleModule spell definition -> Common Play/generic resolver; delete action-ID table |
| `src/app/productionSpellRuntimeAdapter.ts` — `spellMechanicById(metadata.spellId)`, `spellDice`, `resolveProductionSpell` | runtime spell ID selects `SpellMechanicDefinition` | production spell execution | `test:spellcasting`, production spell regressions | authoritative revision, dice, targeting, slots, ResolutionEvent/Undo | normalized Common Play spell IR; content ID only identifies data |
| `src/app/phase09SpellcastingRuntimeRouter.ts` + `legacySpellRuntimeHandler.ts` | runtime presence selects authoritative vs legacy spell engine | compatibility fallback / second engine | `phase09AuthoritativeSpellcastingAdapter.test.ts`, spellcasting regressions | per-adapter legacy Undo pending state | delete fallback when supported spells use one generic engine |
| `src/app/productionPlayRuntimeAdapter.ts` — `weaponAttacksPerAction`, feature/action projection | Fighter/Bard/Cleric/Paladin resource/class constants, class IDs/names and spell mechanics choose projected gameplay behavior | mixed production projection + named execution selection | production play/UI acceptance regressions | Character state, turn action projection, feature availability | preserve generic projection; migrate identity-dependent symbols to portable content/Common Play |
| `src/app/progressionRuntimeAdapter.ts` — `ensureSorceryPointResource`, `ensureSignatureSpellResources` and progression materialization | Sorcerer class/resource IDs and Wizard signature-spell resources trigger identity-specific state materialization | mixed generic progression + named resource execution | `tests/ui/progressionRuntimeAdapter.test.ts`, `test:progression`, `test:creation-structure` | Character level/revision; resource maximum/recovery | preserve generic progression planning/application; move named resources/grants to portable progression/content definitions |
| `src/app/restSpellManagementRuntimeAdapter.ts` — `configureWizardLongRest`, `configurePactTomeRest`, `configureCircleLandRest` | named Wizard, Pact Tome, and Circle Land rest commands route into feature-specific resolvers | named rest/spell-selection dispatch | `tests/ui/restSpellManagementRuntimeAdapter.test.ts`, Pact Tome/Circle/Wizard rest tests | Character revision and rest-time prepared/resource state | generic rest-time selection/invocation driven by portable content; remove named dispatch methods |
| `src/app/classFeatureSpellRuntimeAdapter.ts` — `ensureClassFeatureSpellResources`, `ensureCoreClassResources` | imports Barbarian/Paladin/Warlock/Monk named resource definitions | feature resource materialization | `classFeatureSpellRuntimeAdapter.test.ts`, `coreClassResourceRuntimeAdapter.test.ts`, domain resource tests | Character resource lifetime/recovery | portable resource definitions + generic materializer |
| `src/app/subclassRuntimeAdapter.ts` — Natural Recovery branch | Druid + Circle of the Land subclass ID | subclass resource materialization | `subclassRuntimeAdapter.test.ts`, Circle Land recovery tests | Character/subclass level, rest recovery | preserve generic subclass metadata; migrate named resource branch |
| `src/app/druidCircleLandSpellRuntimeAdapter.ts` — `configureCircleLandSpells`, `circleLandCharacterSpellView` | Druid/Circle Land IDs select rest configuration and spell projection algorithm | subclass spell configuration execution | Circle Land spell/rest domain/runtime tests | Character prepared/cantrip state across rest | portable subclass spell-grant/rest data + generic spell-selection materializer |

## LEGACY_EXECUTION — named gameplay families

| Files | Identity / mechanism family | Current tests | Authority / lifetime | Likely generic composition |
| --- | --- | --- | --- | --- |
| `fighterActionSurgeRuntimeAdapter.ts` | Fighter Action Surge; resource + action economy | `fighterActionSurge` domain/build coverage | actor resource + turn economy | `resource.change` + `economy.modify` |
| `barbarianRageRuntimeAdapter.ts`, `barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` | Rage/Berserker; activation, persistent effect, rider, save/condition | Rage action/damage tests; `barbarianBerserkerIntimidatingPresenceRuntime.test.ts` | resource/economy, effect lifetime, target save | resource/economy + effect/condition + interceptor; Gate E facts when needed |
| `druidWildShapeRuntimeAdapter.ts` | Wild Shape; resource + form state | `test:druid-wild-shape` | resource/economy, form/temp-HP lifetime | first attempt existing operations; activate form gate only on deterministic failure |
| `monkFocusRuntimeAdapter.ts`, `monkOpenHandWholenessRuntimeAdapter.ts`, `monkOpenHandFleetStepRuntimeAdapter.ts`, `monkOpenHandQuiveringPalmRuntimeAdapter.ts` | Focus/Open Hand; resource, healing, movement, delayed mark | named Monk/Open Hand scripts in `package.json` | turn economy/resources; persistent target state | resource/economy/healing/movement/effect; later gate only from concrete failure |
| `rogueCoreRuntimeAdapter.ts`, `rogueCunningHideEventRuntimeAdapter.ts` | Rogue core/Cunning Hide; economy/check/event/effect | `test:rogue-core` + ability-check regressions | turn economy and canonical check event | generic entry point + economy + check/event + effect |
| `bardicInspirationRuntimeAdapter.ts` (transitively installed), `bardicInspirationActionRuntimeAdapter.ts`, `bardicInspirationFollowUpRuntimeAdapter.ts` | Bardic Inspiration resource/grant/follow-up | Bardic Inspiration domain/UI tests | source/owner resource, target-held die, pending roll | generic resource/content grant + Interaction + `roll.modify` |
| `bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts`, `bardCollegeLorePeerlessSkillFollowUpRuntimeAdapter.ts` | Lore roll interceptors | Lore domain + Cutting Words/Peerless Skill UI tests | connected responder/owner, reaction/resource, pending roll, retry/Undo | Gate A Interaction + payment + roll modification/recalculation |
| `fighterTacticalMindFollowUpRuntimeAdapter.ts`, `fighterIndomitableFollowUpRuntimeAdapter.ts`, `warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts` | named post-roll modifier/reroll | corresponding domain/UI tests | owner resource + pending roll lifetime | Interaction + resource + typed modifier/reroll policy |
| `clericDivineSparkActionRuntimeAdapter.ts`, `clericTurnUndeadActionRuntimeAdapter.ts` | Channel Divinity heal/damage/save/condition | named Cleric domain tests | resource/economy + target save/effect | resource + save + damage/healing + condition/effect |
| `paladinLayOnHandsActionRuntimeAdapter.ts`, `paladinDivineSenseActionRuntimeAdapter.ts`, `paladinAbjureFoesActionRuntimeAdapter.ts` | healing allocation, semantic detection, save/effect | named Paladin domain tests | resource/economy + selection/facts | resource/healing + Gate E fact/selection + save/effect; Gate G only if allocation actually fails existing composition |
| `paladinDevotionHolyNimbusRuntimeAdapter.ts`, `paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` | persistent aura/protection | named Devotion UI tests | source-bound/persistent lifetime | effect/artifact + trigger/interceptor + Gate D/E when spatial |
| `sorceryRuntimeAdapter.ts` | Sorcerer resource/rest behavior | Sorcery domain/progression tests | class level + resource recovery | portable resource grant/recovery + generic materializer |

## LEGACY_EXECUTION — progression / portable character materialization

These are migration debt when known class/subclass/feat identities select feature-specific state mutation. They should converge on portable progression/content data and a generic progression resolver; they do **not** need to be forced through combat Common Play IR when progression is the correct authority.

- `progressionPhase08SorcererAdapter.ts`
- `progressionPhase08WarlockAdapter.ts`
- `progressionPhase08EpicBoonAdapter.ts`
- `progressionPhase08FighterStyleAdapter.ts`
- `progressionPhase08BarbarianPrimalKnowledgeAdapter.ts`
- `progressionPhase08SubclassAdapter.ts`
- `progressionPhase08BardLoreAdapter.ts`
- `progressionPhase08SorcererDraconicAdapter.ts`
- `progressionPhase08WizardEvocationAdapter.ts`
- `progressionPhase08MonkOpenHandAdapter.ts`
- `progressionPhase08RogueThiefAdapter.ts`
- `pactTomeRuntimeAdapter.ts`

Behavior oracles are the matching `progressionPhase08*` domain/UI tests, `test:progression`, `test:creation-structure`, and named resource/spell-selection tests. Authority is Character revision/level-up or rest-time character materialization. Target composition is declarative progression/choice/resource/spell-grant data with generic application.

## GENERIC_ENGINE

Identity-agnostic execution infrastructure is not migration debt merely because it is an adapter:

- `src/domain/resolution.ts` and Common Play runtimes, including Gate-E fact/movement/authority paths;
- `src/app/phase09Real*`, atomic resolution/economy/targeting adapters, and typed RulesProfile/core-rule services;
- `src/app/installedContentRuntimeAdapter.ts`: RuleModule validation/persistence/catalog identity, not known-feature mechanic selection;
- connected session/transport/reconnect infrastructure, persistence, campaign lifecycle, inventory persistence, dice provider, theater-of-mind semantic fact provider;
- `standardActionReactionAdapter.ts`, death-save/stabilize/unarmed and ability-check infrastructure when their behavior is a RulesProfile/core semantic rather than named content;
- generic progression persistence such as `progressionPersistentFeatureRuntimeAdapter.ts`. Mixed `progressionRuntimeAdapter.ts` remains `LEGACY_EXECUTION` at module level until its identity-specific resource/grant symbols are strangled out.

## CONTENT/PRESENTATION

Allowed named data includes generated/builtin catalogs, spell presentation, creation options, labels/descriptions, stable relationship metadata, authoring drafts, and static reference fixture rows. A content ID used only to label, persist, select authored data, or display provenance is not an execution violation.

`mockAdapter.ts` is mixed: static Aelar/Mira/reference rows are fixture/content; identity-keyed resolution behavior remains a legacy oracle and must not become the target architecture.

## UNCLEAR — review before editing

The composition ledger intentionally retains three `UNCLEAR` imports rather than guessing:

- `characterCreationV10Adapter.ts`;
- `characterCreationWeaponAttackAdapter.ts`;
- `progressionPhase08WeaponMasteryAdapter.ts`.

Before modifying one of these in Phase 2, inspect symbol-level identity selection and move its classification to `CONTENT/PRESENTATION`, `LEGACY_EXECUTION`, or `GENERIC_ENGINE`. `UNCLEAR` is not permission to add new behavior.

## Golden behavior map

M0 preserves current tests as migration oracles and does not rerun unrelated Gate E validation:

- Rage: `barbarianRageActionRuntime.test.ts`, `barbarianRageAttackDamage.test.ts`.
- Berserker: `barbarianBerserkerIntimidatingPresenceRuntime.test.ts`.
- Bardic Inspiration: `bardicInspirationRuntimeAdapter.test.ts` + domain tests.
- Cutting Words / Peerless Skill: corresponding Lore UI tests + `bardCollegeLore` domain tests.
- Wild Shape / Monk / Rogue / Devotion / Fiend: their named package scripts and domain tests.
- Named progression/resource materialization: `test:progression`, `test:creation-structure`, `test:rules-domain` and matching named tests.
- Spell execution/fallback: `test:spellcasting`, `phase09AuthoritativeSpellcastingAdapter.test.ts`, production spell regressions.
- Rest-time named dispatch: `restSpellManagementRuntimeAdapter.test.ts` plus Pact Tome, Circle Land, and Wizard long-rest tests.

A migration must reproduce its relevant golden behavior, then prove unknown-ID and ID/name-only rename invariance on the generic path before deleting the named branch.

## M0 exit / next action

M0 exits only when this composition ledger and checker are green on an exact SHA and the product checklist records the evidence. The next queue is **M1 — generic migration harness**. Gate F-M remain dormant until a concrete migration failure satisfies the activation rule in `resolver-execution-checklist.md`.
