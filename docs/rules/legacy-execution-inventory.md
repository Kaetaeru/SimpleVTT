# Legacy Execution Inventory

Status: **M0 inventory authority for Phase 2 Legacy Convergence**

Working branch: `agent/resolver-foundation-convergence`
Integration target: `work/v1-composite`
Initial scan base: `d6ab7ecc9cbfd4ec18cef74be92473877cc5598f`

This inventory separates named content/data from code that chooses execution semantics by known content identity. A named file is not legacy merely because it contains a class, subclass, feat, spell, or item name. The migration target is executable ownership that depends on that identity.

## Classification rules

- `CONTENT/PRESENTATION`: named catalog, progression, spell-selection, authoring, labels, and projections that do not choose the gameplay execution algorithm. These may remain named.
- `LEGACY_EXECUTION`: runtime/application/domain behavior that recognizes known content identity or imports known-content constants/resolvers to decide runtime effects, costs, eligibility, reactions, persistent state, or rule execution. These must migrate to JSON/Common Play and then be deleted or reduced to data/projection.
- `GENERIC_ENGINE`: identity-agnostic resolution, Common Play, session authority, persistence, RulesProfile/core-rule, and projection plumbing. These remain code.
- `UNCLEAR`: evidence is insufficient to edit safely. No current adapter-level finding remains `UNCLEAR`; new findings must be classified before migration.

## Scan boundary

M0 used `src/app/offlineRuntimeAdapters.ts` as the canonical offline production composition, then checked the class/subclass-named `src/app/*RuntimeAdapter.ts` surface. The freeze scanner is intentionally narrower than a repository-wide ID ban: content, tests, fixtures, and presentation legitimately contain known IDs.

The automated adapter scan currently detects **28** class/subclass-named runtime adapters. **27** are grandfathered `LEGACY_EXECUTION`; `druidCircleLandSpellRuntimeAdapter.ts` is the explicit `CONTENT/PRESENTATION` exception because it configures and projects Circle spell selections rather than choosing spell execution semantics.

## LEGACY_EXECUTION findings

| File / symbol boundary | Recognized identity / mechanism family | Current behavior oracle | Authority / lifetime dependency | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` module install | Berserker / Intimidating Presence; action + condition/effect | `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts`, `tests/domain/barbarianBerserker.test.ts` | actor action economy; target save/effect lifetime; ResolutionEvent/Undo | entry point + save + `condition.apply`/effect lifetime |
| `src/app/barbarianRageRuntimeAdapter.ts` module install | Barbarian Rage; resource + bonus action + damage/effect | `tests/ui/barbarianRageActionRuntime.test.ts`, `tests/ui/barbarianRageAttackDamage.test.ts` | actor resource/economy; persistent rage lifetime; attack events | resource/economy + persistent effect/interceptor |
| `src/app/bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` module install | College of Lore Cutting Words; cross-owner reaction / roll modification | `tests/domain/bardCollegeLore.test.ts`, `tests/ui/bardCollegeLoreCuttingWordsRuntime.test.ts` | responder ownership, reaction/resource payment, pending roll, stale/reconnect/Undo | Gate A Interaction/interceptor + payment + `roll.modify` |
| `src/app/bardCollegeLorePeerlessSkillFollowUpRuntimeAdapter.ts` module install | College of Lore Peerless Skill; self follow-up / roll modification | `tests/domain/bardCollegeLore.test.ts`, `tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts` | actor resource, pending check, retry/Undo | Gate A Interaction + resource + `roll.modify` |
| `src/app/bardicInspirationRuntimeAdapter.ts` `ensureBardicInspirationResource` / snapshot patch | Bard class + Bardic Inspiration resource | `tests/domain/bardicInspiration.test.ts`, `tests/ui/bardicInspirationRuntimeAdapter.test.ts` | character class level; resource maximum/recovery | content-defined resource grant/recovery projection |
| `src/app/bardicInspirationActionRuntimeAdapter.ts` module install | Bardic Inspiration grant action | `tests/domain/bardicInspiration.test.ts`, `tests/ui/bardicInspirationRuntimeAdapter.test.ts` | actor bonus action/resource; target-owned granted state | entry point + resource payment + source-bound effect/resource grant |
| `src/app/bardicInspirationFollowUpRuntimeAdapter.ts` module install | Bardic Inspiration consumption / roll modification | `tests/domain/bardicInspiration.test.ts`, `tests/ui/bardicInspirationRuntimeAdapter.test.ts` | target-owned inspiration, pending roll, consumption/Undo | Interaction + stored resource/effect + `roll.modify` |
| `src/app/clericDivineSparkActionRuntimeAdapter.ts` module install | Cleric Divine Spark; action/resource + damage/healing | `tests/domain/clericDivineSpark.test.ts` | Channel Divinity resource/economy; target resolution | entry point + resource + damage/healing operations |
| `src/app/clericTurnUndeadActionRuntimeAdapter.ts` module install | Cleric Turn Undead; action/resource + multi-target condition | `tests/domain/clericTurnUndead.test.ts` | Channel Divinity; save/condition lifetime across targets | resource + selector/save + condition/effect |
| `src/app/druidWildShapeRuntimeAdapter.ts` module install | Druid Wild Shape; resource + form state | `tests/domain/druidWildShape.test.ts`, `tests/ui/druidWildShapeActionRuntime.test.ts` | resource/economy; persistent form/temp-HP state; Undo | resource/economy + persistent state; migration must first prove whether existing primitives suffice before Gate J activation |
| `src/app/fighterActionSurgeRuntimeAdapter.ts` module install | Fighter Action Surge; resource + action economy | `tests/domain/fighterActionSurge.test.ts` | actor resource; turn economy; Undo | resource payment + economy modification |
| `src/app/fighterIndomitableFollowUpRuntimeAdapter.ts` module install | Fighter Indomitable; failed-save follow-up/reroll | `tests/domain/fighterIndomitable.test.ts` | actor resource; pending failed save; retry/Undo | Interaction + resource + typed reroll/recalculation path |
| `src/app/fighterTacticalMindFollowUpRuntimeAdapter.ts` module install | Fighter Tactical Mind; failed ability-check follow-up | `tests/domain/fighterTacticalMind.test.ts` | Second Wind resource; pending check; retry/Undo | Interaction + resource + `roll.modify`/recalculate |
| `src/app/monkFocusRuntimeAdapter.ts` module install | Monk Focus Points / focus actions | `tests/ui/monkFocusActionRuntime.test.ts` | class resource/recovery + turn economy | content-defined resource + generic action/economy operations |
| `src/app/monkOpenHandFleetStepRuntimeAdapter.ts` module install | Open Hand Fleet Step | `tests/ui/monkOpenHandFleetStepRuntime.test.ts` | focus/economy and turn movement state | resource/economy + generic movement capability |
| `src/app/monkOpenHandQuiveringPalmRuntimeAdapter.ts` module install | Open Hand Quivering Palm; delayed/persistent mark + later resolution | `tests/ui/monkOpenHandQuiveringPalmRuntime.test.ts` | focus/economy; source-bound persistent state; later trigger/Undo | Gate C effect/event composition; only activate another gate if a concrete parity failure proves it necessary |
| `src/app/monkOpenHandWholenessRuntimeAdapter.ts` module install | Open Hand Wholeness of Body; limited healing action | `tests/ui/monkOpenHandWholenessRuntime.test.ts` | usage resource/economy; healing commit | resource + healing operation |
| `src/app/paladinAbjureFoesActionRuntimeAdapter.ts` module install | Paladin Abjure Foes; Channel Divinity + saves/effects | `tests/domain/paladinAbjureFoes.test.ts` | resource/economy; multi-target save/effect lifetime | resource + selector/save + effect/condition |
| `src/app/paladinDevotionHolyNimbusRuntimeAdapter.ts` module install | Devotion Holy Nimbus; persistent aura/damage | `tests/ui/paladinDevotionHolyNimbusRuntime.test.ts` | persistent source lifetime; nearby membership/events | effect + Gate D/E zone/fact composition |
| `src/app/paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` module install | Devotion Smite of Protection; source-bound protection effect | `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts` | smite/event causation; protected-target lifetime | event interceptor + source-bound effect |
| `src/app/paladinDivineSenseActionRuntimeAdapter.ts` module install | Paladin Divine Sense; action + semantic detection | `tests/domain/paladinDivineSense.test.ts` | actor economy; semantic fact/provider/manual authority | entry point + Gate E semantic fact/adjudication |
| `src/app/paladinLayOnHandsActionRuntimeAdapter.ts` module install | Paladin Lay on Hands; healing pool allocation | `tests/domain/paladinLayOnHands.test.ts` | healing-pool resource; target healing/condition state | resource allocation + healing/condition removal; prove existing selector/allocation composition before Gate G |
| `src/app/rogueCoreRuntimeAdapter.ts` module install | Rogue core named actions/features | `tests/ui/rogueCoreActionRuntime.test.ts` | actor economy/resources/effects depending on action | split into generic entry points + resource/economy/effect operations by mechanism |
| `src/app/rogueCunningHideEventRuntimeAdapter.ts` module install | Rogue Cunning Action: Hide; ability check + event/effect | `tests/ui/rogueCoreActionRuntime.test.ts` | actor bonus action; canonical ability-check event; hidden state lifetime | economy + ability-check event + effect/state change |
| `src/app/sorceryRuntimeAdapter.ts` `ensureSorcerousRestorationUsage` / snapshot patch | Sorcerer class + Sorcerous Restoration usage resource | `tests/domain/sorcery.test.ts` and progression Sorcerer runtime coverage | class level; resource max/long-rest recovery | content-defined resource grant/recovery projection |
| `src/app/subclassRuntimeAdapter.ts` `ensureSubclassRuntimeMetadata` Natural Recovery branch | Druid + Circle of the Land + Natural Recovery resources | `tests/ui/subclassRuntimeAdapter.test.ts`, `tests/domain/druidCircleLandRecovery.test.ts` | subclass identity/level; rest-resource lifetime | keep generic subclass metadata, migrate only named Natural Recovery resource branch to portable content |
| `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts` module install | Fiend Dark One's Own Luck; roll follow-up | `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts` | owner resource; pending check/save timing; retry/Undo | Interaction + resource + roll modifier/recalculate |

## CONTENT/PRESENTATION findings

These named paths may remain named so long as they continue to produce data/projection rather than select gameplay execution algorithms:

- `src/app/druidCircleLandSpellRuntimeAdapter.ts` — Circle spell-rest configuration and prepared/cantrip projection. It is the explicit scanner exception.
- `src/app/pactTomeRuntimeAdapter.ts` — Book of Shadows spell selection/prepared-spell projection.
- `src/app/progressionPhase08*Adapter.ts`, `src/app/progressionRuntimeAdapter.ts`, and `src/app/progressionPersistentFeatureRuntimeAdapter.ts` — progression/choice persistence and portable character metadata.
- `src/app/restSpellManagementRuntimeAdapter.ts` and `src/app/classFeatureSpellRuntimeAdapter.ts` — spell-selection/rest/content projection boundaries; if future edits add feature-specific execution, they must be reclassified.
- Named domain catalog/progression/source constants and labels are data/provenance unless a runtime branch uses them to choose the execution algorithm.

## GENERIC_ENGINE findings

The following are identity-agnostic execution infrastructure and are not migration targets merely because they are runtime code:

- `src/domain/resolution.ts` and the Common Play runtimes (`commonPlayRuntime.ts`, `commonPlayEntryPointRuntime.ts`, `commonPlayEffectRuntime.ts`, `commonPlayZoneRuntime.ts`, Gate-E fact/movement runtimes);
- `src/app/phase09Real*`, `phase09SpellcastingRuntimeRouter.ts`, `productionSpellRuntimeAdapter.ts`, `productionWeaponRuntimeFactAdapter.ts`, `productionDiceRuntimeAdapter.ts`, and other generic production/persistence/session plumbing;
- `src/app/standardActionReactionAdapter.ts`, `deathSaveRuntimeAdapter.ts`, `stabilizeRuntimeAdapter.ts`, `unarmedControlRuntimeAdapter.ts`, and `abilityCheck*` adapters where behavior is a RulesProfile/core semantic rather than a known content identity;
- connected-session routing/ownership/reconnect infrastructure from Gate E, which transports generic typed requests/responses and does not select a class/spell/feat implementation.

## Mixed-file rule

Do not delete an entire named domain/application file when only one executable symbol is legacy. `subclassRuntimeAdapter.ts` is the concrete example: generic subclass metadata inference can remain while the Circle-of-the-Land Natural Recovery resource branch migrates. The same symbol-level rule applies to `barbarianRage.ts`, `barbarianBerserker.ts`, `bardCollegeLore.ts`, `bardicInspiration.ts`, and other named domain files that also own catalogs, constants, or pure calculations used as golden behavior or authoring data.

## Freeze guard

Source of truth:

- baseline: `.agents/LEGACY_EXECUTION_BASELINE.json`
- scanner: `scripts/check-legacy-execution-boundary.mjs`
- scanner regression: `tests/ui/legacyExecutionBoundary.test.mjs`
- CI: `.github/workflows/legacy-execution-boundary.yml`

Semantics:

1. grandfathered `LEGACY_EXECUTION` adapter paths may disappear as migration deletes them;
2. the legacy baseline must not grow to make a new named execution adapter pass;
3. explicit `CONTENT/PRESENTATION` exceptions are allowed only while they remain non-execution projections/configuration;
4. the scanner is deliberately scoped to class/subclass-named runtime adapters in `src/app`, not repository-wide IDs;
5. any new identity-dependent execution discovered outside the scanner's narrow surface must be added to this inventory and migrated, not hidden by broadening an allowlist.

## Phase-2 migration ordering signal

Use mechanism families, not class order:

1. simple resource/action/economy paths first (for example Action Surge, Wholeness of Body, resource projection debt);
2. reaction/follow-up roll modifiers (Tactical Mind, Indomitable, Dark One's Own Luck, Peerless Skill, Cutting Words);
3. persistent effects/events (Rage, Quivering Palm, Holy Nimbus, Smite of Protection, Cunning Hide);
4. spatial/semantic-fact paths (Divine Sense, aura/zone behaviors);
5. form/selector/allocation cases only after a deterministic migration attempt proves whether the existing A-E primitives are sufficient.

This ordering does not activate Gate F-M by itself.
