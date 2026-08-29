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
- `UNCLEAR`: temporary architecture-review state only. **No current canonical offline composition entry remains `UNCLEAR` after M0 symbol-level review.**

## Scan boundary and freeze

`src/app/offlineRuntimeAdapters.ts` is the canonical offline production composition. `.agents/LEGACY_EXECUTION_BASELINE.json` classifies every side-effect import in that composition and explicitly records grandfathered class/subclass-named runtime adapters that are installed transitively. The checker `scripts/check-legacy-execution-boundary.mjs` and `tests/ui/legacyExecutionBoundary.test.mjs` enforce exact ledger discipline:

1. every current production import must already be classified;
2. an invalid, duplicate, or unresolved `UNCLEAR` classification fails;
3. deleting an import requires deleting its baseline entry in the same migration, so the removed legacy path cannot later be silently reintroduced;
4. adding any production runtime path fails until architecture review classifies it;
5. class/subclass-named `*RuntimeAdapter.ts` files under `src/app` must be either classified by the top-level composition ledger or explicitly listed as a transitive classification;
6. the baseline must never grow merely to admit a new named-content adapter.

The guard is deliberately not a repository-wide ID ban or an exhaustive semantic scanner. Tests, fixtures, catalogs, and presentation may legitimately contain known IDs. It combines the canonical import ledger with a narrow named-runtime-adapter file guard so a new transitive class/subclass adapter cannot bypass M0 merely by being imported through an already-classified module. Other helper/service code that directly recognizes known content identity remains an inventory obligation and is reviewed at symbol level.

## LEGACY_EXECUTION — central compatibility, progression, and dispatch

| File / symbol boundary | Recognized identity / selection | Mechanism | Current behavior oracle | Authority / lifetime | Convergence target |
| --- | --- | --- | --- | --- | --- |
| `src/app/spellcastingRuntimeAdapter.ts` — `SPELL_META`, `commitFreeformSpellSlot`, `spellMechanicById` | explicit action IDs map to `dnd.srd521.spell.*`; mechanic looked up by spell ID | legacy spell execution / slot economy | `tests/ui/spellcastingRuntimeAdapter.test.ts`, `test:spellcasting` | runtime state, slots, target facts, Undo | RuleModule spell definition -> Common Play/generic resolver; delete action-ID table |
| `src/app/productionSpellRuntimeAdapter.ts` — `spellMechanicById(metadata.spellId)`, `spellDice`, `resolveProductionSpell` | runtime spell ID selects `SpellMechanicDefinition` | production spell execution | `test:spellcasting`, production spell regressions | authoritative revision, dice, targeting, slots, ResolutionEvent/Undo | normalized Common Play spell IR; content ID only identifies data |
| `src/app/phase09SpellcastingRuntimeRouter.ts` + `legacySpellRuntimeHandler.ts` | runtime presence selects authoritative vs legacy spell engine | compatibility fallback / second engine | `phase09AuthoritativeSpellcastingAdapter.test.ts`, spellcasting regressions | per-adapter legacy Undo pending state | delete fallback when supported spells use one generic engine |
| `src/app/productionPlayRuntimeAdapter.ts` — `weaponAttacksPerAction`, feature/action projection | Fighter/Bard/Cleric/Paladin resource/class constants, class IDs/names and spell mechanics choose projected gameplay behavior | mixed production projection + named execution selection | production play/UI acceptance regressions | Character state, turn action projection, feature availability | preserve generic projection; migrate identity-dependent symbols to portable content/Common Play |
| `src/app/characterSessionProjectionReconstruction.ts` — class/action/resource reconstruction branches | Rogue/Fighter/Barbarian/Monk and other known identities synthesize action/resource/stat semantics during session reconstruction | hidden named session projection execution | `tests/ui/characterSessionProjectionReconstruction.test.ts` | Host/session projection, reconnect/reconstruction lifetime | reconstruct from portable content/runtime state and generic action/resource projections; remove class-ID synthesis |
| `src/app/progressionRuntimeAdapter.ts` — named resource/grant symbols | Sorcerer class/resource IDs and Wizard signature-spell resources trigger identity-specific state materialization | mixed generic progression + named resource execution | `tests/ui/progressionRuntimeAdapter.test.ts`, `test:progression`, `test:creation-structure` | Character level/revision; resource maximum/recovery | preserve generic progression planning/application; move named resources/grants to portable progression/content definitions |
| `src/app/restSpellManagementRuntimeAdapter.ts` — named rest configuration commands | Wizard, Pact Tome, and Circle Land commands route into feature-specific resolvers | named rest/spell-selection dispatch | `tests/ui/restSpellManagementRuntimeAdapter.test.ts`, Pact Tome/Circle/Wizard rest tests | Character revision and rest-time prepared/resource state | generic rest-time selection/invocation driven by portable content; remove named dispatch methods |
| `src/app/classFeatureSpellRuntimeAdapter.ts` — `ensureClassFeatureSpellResources`, `ensureCoreClassResources` | imports Barbarian/Paladin/Warlock/Monk named resource definitions | feature resource materialization | `classFeatureSpellRuntimeAdapter.test.ts`, `coreClassResourceRuntimeAdapter.test.ts`, domain resource tests | Character resource lifetime/recovery | portable resource definitions + generic materializer |
| `src/app/subclassRuntimeAdapter.ts` — Natural Recovery branch | Druid + Circle of the Land subclass ID | subclass resource materialization | `subclassRuntimeAdapter.test.ts`, Circle Land recovery tests | Character/subclass level, rest recovery | preserve generic subclass metadata; migrate named resource branch |
| `src/app/druidCircleLandSpellRuntimeAdapter.ts` — `configureCircleLandSpells`, `circleLandCharacterSpellView` | Druid/Circle Land IDs select rest configuration and spell projection algorithm | subclass spell configuration execution | Circle Land spell/rest domain/runtime tests | Character prepared/cantrip state across rest | portable subclass spell-grant/rest data + generic spell-selection materializer |
| `src/app/characterCreationV10Adapter.ts` — `originFeatName`, `sheet` resource materialization | Magic Initiate feat IDs and Fighter class ID choose labels/resource state; mixed with generic creation plumbing | creation-time named state materialization | `test:creation-structure`, character-creation UI/domain tests | draft/finalized Character state | preserve generic creation flow; move feat/resource grants to authored portable content |

## LEGACY_EXECUTION — named gameplay families

Fighter Action Surge is no longer part of this legacy ledger. PR #171 (`8c9978a8d3a30bf08ab492cc8d805c2d77d63094`, merged as `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f`) proved generic Common Play production parity, deleted `src/app/fighterActionSurgeRuntimeAdapter.ts`, and removed its baseline entry. The canonical migration evidence is recorded in `resolver-execution-checklist-v2.md`.

The atomic saving-throw adapter's Fighter Indomitable lookup is also removed on the C8 convergence branch. Atomic replay now consumes the authoritative save preview's generic `d20` and `total`, while projected Character resources synchronize by resource identity rather than feature identity. The named Indomitable prompt/orchestration adapter remains legacy until its interaction definition itself moves to Common Play.

The attack transaction's Rage tag lookup is removed too. Any active Effect can now contribute a source-bound flat attack-damage modifier through generic ability and attack-source predicates; a renamed unknown Effect proves the same transaction outcome. Rage remains a named activation/lifecycle adapter until that lifecycle is authored through Common Play.

Core d20/turn execution no longer imports Rage lifecycle identity: hostile attack/save extension and linked special-duration expiry are driven by generic extendable-Effect metadata. Spellcasting likewise reads the active Effect's generic `spellcastingAllowed` flag instead of Rage or Wild Shape tags. Named activation and explicit class UI remain legacy.

Atomic item damage no longer recognizes `action.wand`. Any no-roll damage action with an authored damage formula and item cost now uses the same atomic item transaction; an unknown renamed action proves the damage, charge payment, event projection, and Undo boundary. Named item projection in `productionPlayRuntimeAdapter.ts` remains legacy content materialization debt.

The Phase 09 healing path no longer recognizes Second Wind, Healing Word, or healing-potion action IDs to select formula facts. Any authored healing action now enters the same roll/HP/cost path, with unknown-ID adapter evidence. Named feature/item projection and activation remain legacy until portable content definitions author those actions.

The duplicate Phase 09 `action.shortbow` atomic branch and its reference attack/target lookup tables are deleted. Canonical runtime attacks now consume explicit structural `runtimeAttack` facts, and the same transaction succeeds after an arbitrary action-ID rename. Weapon/content projection still has to author those portable facts, but action identity no longer selects the atomic attack algorithm.

The Phase 09 entity-ID save-modifier table is deleted too. Saving throws in canonical composition now use the existing runtime Character/Combatant stat provider, which derives structured abilities/proficiencies or rejects missing authority instead of selecting a modifier by fixture identity.

| Files | Identity / mechanism family | Current tests | Authority / lifetime | Likely generic composition |
| --- | --- | --- | --- | --- |
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

| Files / boundary | Known selection | Behavior oracle | Authority / lifetime | Convergence target |
| --- | --- | --- | --- | --- |
| `progressionPhase08SorcererAdapter.ts`, `progressionPhase08WarlockAdapter.ts` | class-specific spell/resource progression | matching Phase08 Sorcerer/Warlock runtime tests + `test:progression` | Character revision / level-up | portable class progression definitions + generic application |
| `progressionPhase08EpicBoonAdapter.ts` | class IDs + feat/boon resolution | Epic Boon domain/runtime tests | Character revision / level-up | portable feat/boon eligibility and grant data |
| `progressionPhase08WeaponMasteryAdapter.ts` | named Phase08 resolver plus explicit Fighter/Druid/Cleric class option IDs | `tests/ui/progressionPhase08WeaponMasteryRuntime.test.ts`, Phase08 Weapon Mastery domain tests | Character revision / level-up / mastery selections | portable class mastery choices + generic progression resolver |
| `progressionPhase08FighterStyleAdapter.ts`, `progressionPhase08BarbarianPrimalKnowledgeAdapter.ts` | Fighter/Barbarian-specific progression | matching Phase08 runtime/domain tests | Character revision / level-up | portable class choice/grant definitions |
| `progressionPhase08SubclassAdapter.ts`, `progressionPhase08BardLoreAdapter.ts`, `progressionPhase08SorcererDraconicAdapter.ts`, `progressionPhase08WizardEvocationAdapter.ts`, `progressionPhase08MonkOpenHandAdapter.ts`, `progressionPhase08RogueThiefAdapter.ts` | known subclass/class IDs choose feature-specific progression | matching Phase08 subclass runtime/domain tests | Character revision / subclass level-up | portable subclass progression data + generic application |
| `pactTomeRuntimeAdapter.ts` | Pact of the Tome resolver/eligibility | Pact Tome domain/runtime/rest tests | Character rest revision and spell selections | portable invocation spell-grant/rest definition + generic materializer |

## GENERIC_ENGINE

Identity-agnostic execution infrastructure is not migration debt merely because it is an adapter:

- `src/domain/resolution.ts` and Common Play runtimes, including Gate-E fact/movement/authority paths;
- identity-agnostic Phase 09 atomic resolution/economy/targeting adapters and typed RulesProfile/core-rule services;
- `src/app/installedContentRuntimeAdapter.ts`: RuleModule validation/persistence/catalog identity, not known-feature mechanic selection;
- connected session/transport/reconnect infrastructure, persistence, campaign lifecycle, inventory persistence, dice provider, theater-of-mind semantic fact provider;
- `standardActionReactionAdapter.ts`, death-save/stabilize/unarmed and ability-check infrastructure when their behavior is a RulesProfile/core semantic rather than named content;
- `characterCreationWeaponAttackAdapter.ts`: derives attack materialization from generic `weapon-definition` metadata (`mode`, `finesse`, damage) rather than a known weapon/content identity;
- generic progression persistence such as `progressionPersistentFeatureRuntimeAdapter.ts`. Mixed `progressionRuntimeAdapter.ts` remains `LEGACY_EXECUTION` at module level until its identity-specific resource/grant symbols are strangled out.

## CONTENT/PRESENTATION

Allowed named data includes generated/builtin catalogs, spell presentation, creation options, labels/descriptions, stable relationship metadata, authoring drafts, and static reference fixture rows. A content ID used only to label, persist, select authored data, or display provenance is not an execution violation.

`mockAdapter.ts` is mixed: static Aelar/Mira/reference rows are fixture/content; identity-keyed resolution behavior remains a legacy oracle and must not become the target architecture.

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
- Hidden/transitive named branches: `characterSessionProjectionReconstruction.test.ts`.

A migration must reproduce its relevant golden behavior, then prove unknown-ID and ID/name-only rename invariance on the generic path before deleting the named branch.

## M0 exit / next action

M0 exits only when this composition ledger and checker are green on an exact SHA and the product checklist records the evidence. The next queue is **M1 — generic migration harness**. Gate F-M remain dormant until a concrete migration failure satisfies the activation rule in `resolver-execution-checklist.md`.
