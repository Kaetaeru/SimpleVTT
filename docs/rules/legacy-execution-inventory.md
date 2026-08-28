# Legacy Execution Inventory — M0

Status: **M0 inventory candidate**

Working branch: `agent/m0-legacy-execution-inventory`
Parent Rerun branch: `agent/resolver-foundation-convergence`
Product integration target: `work/v1-composite`

This document is the durable inventory for Phase 2 M0 of `docs/rules/resolver-execution-checklist.md`.
It records existing named execution debt; it does **not** authorize a big-bang rewrite and it does not activate Gates F-M.

## Inventory rule

A file is `LEGACY_EXECUTION` when known content identity selects execution semantics, eligibility, authority behavior, resource/economy behavior, lifetime behavior, or a feature-specific resolver/compiler path.
A named file is not automatically legacy execution: catalog, authoring, presentation, fixtures, and generic semantic mapping may remain named.

The automated guard is intentionally high-signal rather than repository-wide. It scans `src/app/**/*.ts` for:

- known SRD class/subclass/feature/feat/spell/item/invocation/boon ID literals;
- known `*_ID` imports from `src/domain`;
- direct `actionId ===/!== "action.*"` execution branches;
- imports of `legacySpellRuntimeHandler`.

Exact presentation/fixture/generic-mapping exceptions are allowlisted in `scripts/check-legacy-execution-boundary.mjs`.
The frozen baseline is `.agents/LEGACY_EXECUTION_BASELINE.json`.
Existing debt may decrease; a new file/rule pair or an increased occurrence count fails the boundary gate.

Validated boundary snapshot on candidate `771b8ab95bc0cb790b88e05bb78e06367ed53b70`:

- 49 scanned app files;
- 59 file/rule baseline groups;
- 193 high-signal occurrences;
- `Legacy Execution Boundary` run `33132938406`, job `98726344372`: scanner semantic tests **6/6 PASS** and frozen-debt check PASS.

The guard is a regression detector, not proof that every unflagged line is generic. Migration still requires behavior-golden review.

## Classification summary

| Classification | Result |
| --- | --- |
| `LEGACY_EXECUTION` | 48 scanned app files below, plus named execution symbols in mixed domain files |
| `UNCLEAR` | `src/app/connectedOwnerInventoryJournalAdapter.ts` compatibility aliases; review before migration |
| `CONTENT/PRESENTATION` | exact authoring/catalog/presentation/reference-fixture exceptions listed below |
| `GENERIC_ENGINE` | Common Play/Resolution kernel and generic semantic-provider exceptions listed below |

All scanner findings for a file inherit the file-level classification in the tables below unless explicitly noted otherwise.

# LEGACY_EXECUTION — app layer

## A. Action / resource / economy execution

These paths recognize class/feature/resource identity and choose named action, payment, resource, or direct feature execution.

| File | Recognized identity / execution symbol | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts` | Barbarian/Berserker/Intimidating Presence domain IDs; named adapter entrypoints | `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts` | local/session actor state; feature resource/effect lifetime | content rule + selector/fact + `resource.change` + effect/condition operations |
| `src/app/barbarianRageRuntimeAdapter.ts` | Barbarian/Rage IDs; named Rage compiler/resolver routing | `tests/ui/barbarianRageActionRuntime.test.ts`, `barbarianRageAttackDamage.test.ts` | actor resource, turn/event lifetime, damage/condition recalculation | entrypoint + `resource.change` + effects + event/interceptor rules |
| `src/app/bardicInspirationActionRuntimeAdapter.ts` | Bard/Bardic Inspiration IDs; action/resource grant | `tests/ui/bardicInspirationActionRuntime.test.ts` | source/target actor resource; turn/action economy | interaction/targeting + economy + resource/effect operations |
| `src/app/bardicInspirationRuntimeAdapter.ts` | Bard/Bardic Inspiration IDs; snapshot resource injection | `tests/ui/bardicInspirationRuntimeAdapter.test.ts`, `bardicInspirationFollowUpRuntime.test.ts` | projected character/session resource state | normalized resource/content projection + generic resource runtime |
| `src/app/clericDivineSparkActionRuntimeAdapter.ts` | Cleric/Divine Spark domain IDs | existing Cleric runtime/UI family tests | actor action/resource; immediate resolution | entrypoint + selector + damage/healing + resource/economy |
| `src/app/clericTurnUndeadActionRuntimeAdapter.ts` | Cleric/Turn Undead domain IDs | existing Cleric runtime/UI family tests | actor action/resource; target condition/effect lifetime | entrypoint + target save/facts + condition/effect operations |
| `src/app/fighterActionSurgeRuntimeAdapter.ts` | Fighter/Action Surge IDs | existing Fighter runtime/UI family tests | actor resource/economy; turn scoped | `resource.change` + economy/action capability modification |
| `src/app/monkFocusRuntimeAdapter.ts` | Monk Focus IDs and SRD feature literals | existing Monk Focus runtime/UI family tests | actor focus resource and action economy | generic resource + economy + content-defined entrypoints |
| `src/app/paladinAbjureFoesActionRuntimeAdapter.ts` | Paladin/Abjure Foes IDs | existing Paladin runtime/UI family tests | actor resource; multi-target condition/effect | entrypoint + selector/save + condition/effect + resource |
| `src/app/paladinDivineSenseActionRuntimeAdapter.ts` | Paladin/Divine Sense IDs | existing Paladin runtime/UI family tests | actor resource; bounded informational effect | resource/economy + typed semantic facts/adjudication |
| `src/app/paladinLayOnHandsActionRuntimeAdapter.ts` | Paladin/Lay on Hands IDs | existing Paladin runtime/UI family tests | persistent pool, target healing/cleanup | resource allocation + healing/effect removal; Gate G only if a concrete allocation failure proves necessary |

## B. Reactions / interceptors / follow-up resolution

| File | Recognized identity / execution symbol | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` | Lore/Cutting Words IDs; named follow-up resolver | `tests/ui/bardCollegeLoreCuttingWordsRuntime.test.ts`; remote-owner scenario remains a golden concept | responder ownership, reaction/resource economy, roll outcome; reconnect/idempotency relevant | Gate A interaction/interceptor + `resource.change` + economy + `roll.modify`/recalculation |
| `src/app/bardCollegeLorePeerlessSkillFollowUpRuntimeAdapter.ts` | Lore/Peerless Skill IDs; named follow-up resolver | `tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts` | actor-owned resource and roll follow-up | semantic event + interaction + resource/economy + `roll.modify` |
| `src/app/fighterIndomitableFollowUpRuntimeAdapter.ts` | Fighter/Indomitable IDs | existing Fighter follow-up runtime/UI tests | actor response ownership; save retry and resource | interaction + payment/resource + generic reroll/save resolution |
| `src/app/fighterIndomitableRuntimeState.ts` | Indomitable resource ID; pending runtime state | existing Fighter Indomitable tests | pending/consumed response state; retry/reconnect sensitive | generic pending interaction/state ownership rather than feature-specific state |
| `src/app/fighterTacticalMindFollowUpRuntimeAdapter.ts` | Fighter/Tactical Mind IDs | existing Fighter Tactical Mind tests | actor response, resource, check recalculation | interaction + resource + roll/check modifier |
| `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts` | Fiend/Dark One's Own Luck IDs | existing Warlock Fiend runtime/UI tests | actor response/resource; roll follow-up | interaction + resource/economy + roll modifier |

## C. Persistent feature state / event-driven execution

| File | Recognized identity / execution symbol | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/druidWildShapeRuntimeAdapter.ts` | Druid/Wild Shape IDs | existing Wild Shape runtime/UI tests | actor form/resource; persistent form lifetime | existing effects/resource/content overlay primitives first; Gate J only after concrete failure |
| `src/app/monkOpenHandFleetStepRuntimeAdapter.ts` | Open Hand/Fleet Step IDs | existing Monk Open Hand runtime/UI tests | actor effect/action state, turn lifetime | effect + economy/movement capability |
| `src/app/monkOpenHandQuiveringPalmRuntimeAdapter.ts` | Open Hand/Quivering Palm IDs | existing Monk Open Hand runtime/UI tests | source-target linked persistent mark then trigger | effect/artifact + semantic event + damage/save; new artifact gate only if existing composition fails |
| `src/app/monkOpenHandWholenessRuntimeAdapter.ts` | Open Hand/Wholeness IDs | existing Monk Open Hand runtime/UI tests | actor resource/healing; bounded use lifetime | resource + healing + effect cleanup |
| `src/app/paladinDevotionHolyNimbusRuntimeAdapter.ts` | Devotion/Holy Nimbus IDs | existing Paladin Devotion runtime/UI tests | persistent aura/effect and turn events | effect/Zone/artifact + event trigger using Gates C-D-E where applicable |
| `src/app/paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` | Devotion/Smite of Protection IDs | existing Paladin Devotion runtime/UI tests | persistent/triggered protection state | effect/interceptor + event trigger + generic state changes |
| `src/app/rogueCoreRuntimeAdapter.ts` | Rogue SRD feature literal | existing Rogue runtime/UI tests | actor feature/action state | content-defined entrypoints/effects/economy |
| `src/app/rogueCunningHideEventRuntimeAdapter.ts` | Rogue/Cunning Hide domain ID | existing Rogue runtime/UI tests | actor hidden/event state; event/turn lifetime | semantic event + condition/effect + economy |
| `src/app/sorceryRuntimeAdapter.ts` | Sorcerer/Sorcery IDs | existing Sorcery runtime/UI tests | actor resource and spell/action modifier lifetime | resource + interaction/entrypoint modifier; no Sorcery-specific engine |

## D. Spell execution / spell runtime routing

| File | Recognized identity / execution symbol | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/druidCircleLandSpellRuntimeAdapter.ts` | Circle of the Land spell/domain IDs | existing Druid spell/runtime tests | caster slot/resource, effect lifetime | RuleModule spell entrypoints + payments + selectors/facts + effects |
| `src/app/phase09AuthoritativeSpellcastingAdapter.ts` | known spell IDs | Phase 09 spellcasting/runtime tests | authoritative cast/payment/session state | generic Common Play cast process + resolver/session authority |
| `src/app/phase09SpellcastingRuntimeRouter.ts` | `legacySpellRuntimeHandler` import | Phase 09 spellcasting/runtime tests | dispatch path; authoritative cast execution | delete legacy fallback once supported spells enter Common Play generic runtime |
| `src/app/productionPlayRuntimeAdapter.ts` | known spell/content IDs and multiple domain IDs | production play/runtime regression suites | session-authoritative cross-mechanism execution | normalized content -> Common Play entrypoints/interactions/effects; split only by generic mechanism, not content name |
| `src/app/spellcastingRuntimeAdapter.ts` | known spell ID literals | spellcasting runtime/UI suites | cast action, slot/payment, target/effect lifetime | Common Play cast process + selector/facts + typed operations |

## E. Progression / content grant execution

Known class/subclass/feature IDs here decide grants, choices, derived state, or runtime installation. They remain behavior oracles until equivalent normalized content grants exist.

| File | Recognized identity | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/progressionPhase08BarbarianPrimalKnowledgeAdapter.ts` | Barbarian/Primal Knowledge IDs | Phase 08 progression tests | durable character progression | content grants + properties/proficiencies/resource definitions |
| `src/app/progressionPhase08BardLoreAdapter.ts` | Bard/Lore IDs and domain IDs | Phase 08 Bard/Lore progression tests | durable character progression | normalized subclass/content grants + resource/feature definitions |
| `src/app/progressionPhase08EpicBoonAdapter.ts` | Epic Boon IDs | Phase 08 progression tests | durable character grants | generic `content.grant`/property operations |
| `src/app/progressionPhase08FighterStyleAdapter.ts` | Fighter Style IDs | Phase 08 progression tests | durable choice/grant | normalized choice + content/property grants |
| `src/app/progressionPhase08MonkOpenHandAdapter.ts` | Monk/Open Hand IDs and domain IDs | Phase 08 Monk progression tests | durable subclass/feature grants | normalized subclass/content grants + resources/effects |
| `src/app/progressionPhase08RogueThiefAdapter.ts` | Rogue/Thief IDs and domain IDs | Phase 08 Rogue progression tests | durable subclass/feature grants | normalized subclass/content grants |
| `src/app/progressionPhase08SorcererAdapter.ts` | Sorcerer IDs | Phase 08 Sorcerer progression tests | durable class/resource grants | normalized class grants + resource definitions |
| `src/app/progressionPhase08SorcererDraconicAdapter.ts` | Draconic Sorcerer IDs and domain IDs | Phase 08 Sorcerer progression tests | durable subclass/property/effect grants | normalized subclass grants + property/effect operations |
| `src/app/progressionPhase08SubclassAdapter.ts` | known subclass IDs | Phase 08 subclass progression tests | durable subclass selection | generic content choice/grant |
| `src/app/progressionPhase08WarlockAdapter.ts` | Warlock IDs | Phase 08 Warlock progression tests | durable class/resource/content grants | normalized class grants + resources/content grants |
| `src/app/progressionPhase08WeaponMasteryAdapter.ts` | weapon/mastery IDs | Phase 08 progression tests | durable choices and item-linked grants | content choice/grant + generic item/property relation |
| `src/app/progressionPhase08WizardEvocationAdapter.ts` | Wizard/Evocation IDs and domain IDs | Phase 08 Wizard progression tests | durable subclass/property/feature grants | normalized subclass/content grants + property/resource definitions |
| `src/app/progressionRuntimeAdapter.ts` | known class/content IDs and domain IDs | progression runtime tests | durable character build/update | generic normalized progression dispatcher; content identity remains data |
| `src/app/subclassRuntimeAdapter.ts` | known subclass literal/domain IDs | subclass runtime tests | durable subclass/runtime feature installation | normalized subclass content + generic grants; no subclass-name runtime branch |

## F. Session / projection / inventory execution

| File | Recognized identity / execution symbol | Current behavior oracle | Authority / lifetime | Likely Common Play composition |
| --- | --- | --- | --- | --- |
| `src/app/characterSessionProjectionReconstruction.ts` | class IDs, Rage resource ID, known item ID; class-specific AC/actions | session projection/reconstruction suites | persisted character -> session snapshot; reconnect/rebuild sensitive | normalized portable content and generic property/action/resource projection; eliminate class/item branches |
| `src/app/connectedActionRoutingAdapter.ts` | direct named `action.standard.ready*` execution branches | connected action/session tests | Host authority, owner routing, pending Ready state, replay/reconnect/idempotency | preserve generic routing; move Ready semantics to content/Common Play entrypoint + interaction/event state |
| `src/app/sessionInventoryRuntimeAdapter.ts` | known item IDs | session inventory tests | session-authoritative inventory/equipment lifetime | generic item/content state + typed inventory operations; Gate L remains dormant until a concrete migration failure |

# UNCLEAR — review before migration

| File | Finding | Why unclear | Required review |
| --- | --- | --- | --- |
| `src/app/connectedOwnerInventoryJournalAdapter.ts` | hardcoded aliases `dagger`, `chain-mail`, `shield` -> SRD item IDs | the surrounding journal, owner routing, replay, revision and idempotency machinery is generic; the flagged literals are compatibility input normalization rather than clearly an execution algorithm | separate harmless input-alias compatibility from item lifecycle semantics before deleting or moving anything; do not use this finding alone to activate Gate L |

# Mixed named domain files — symbol-level migration

These files contain valid named content/data alongside named execution functions. Do not delete the whole file merely because it is named.

| File | `LEGACY_EXECUTION` symbols / responsibilities | Allowed named content/data | Likely Common Play replacement |
| --- | --- | --- | --- |
| `src/domain/barbarianRage.ts` | named Rage compile/resolve start/extend/end, damage/resistance/advantage/concentration behavior | Rage IDs/resource/effect presentation definitions may remain data until normalized source owns them | generic entrypoint + resource/effect/interceptor/event operations |
| `src/domain/barbarianBerserker.ts` | Mindless Rage, Retaliation, Intimidating Presence and recovery compilers/resolvers | class/subclass/feature IDs and declarative definitions | generic interactions, resources, effects, conditions and events |
| `src/domain/bardicInspiration.ts` | named grant/action/follow-up/roll consumption compilers/resolvers | Bard/resource/effect IDs and declarative content | interaction + resource/economy + effect + roll modifier |
| `src/domain/bardCollegeLore.ts` | `resolveLoreCuttingWords`, `resolveLorePeerlessSkill`, subclass/resource/reaction execution | Lore IDs and declarative content definitions | Gate A/Common Play interaction + payment + roll modification |

# CONTENT/PRESENTATION / fixture exceptions

The boundary guard intentionally excludes these exact files. The exception is path-specific; it does not authorize new named execution elsewhere.

- `src/app/characterCreationV09Adapter.ts`
- `src/app/characterCreationV09Meta.ts`
- `src/app/characterCreationV09Plan.ts`
- `src/app/characterCreationV10Adapter.ts`
- `src/app/characterCreationV10Choices.ts`
- `src/app/characterCreationV10Data.ts`
- `src/app/characterCreationV10Plan.ts`
- `src/app/characterResourcePresentation.ts`
- `src/app/characterSheetV10Projection.ts`
- `src/app/rulePresentation.ts`
- `src/app/srdCatalogBridge.ts`
- `src/app/productionSpellcasterProjectionAdapter.ts`
- `src/app/productionAcceptanceRuntimeAdapter.ts` — fixed production-acceptance reference fixture; its known item IDs do not choose a general execution algorithm.
- `src/app/mockAdapter.ts` — mock/test support; never authoritative product semantics.

# GENERIC_ENGINE

These paths are explicitly **not** migration targets merely because named content eventually flows through them:

- `src/domain/resolution.ts` — generic operation staging/commit and atomic state-change authority;
- `src/domain/commonPlayRuntime.ts` — generic Common Play runtime/interactions;
- `src/domain/commonPlayEntryPointRuntime.ts` — generic entrypoint lowering;
- `src/domain/commonPlayEffectRuntime.ts` — generic persistent effect lowering;
- `src/domain/commonPlayZoneRuntime.ts` — generic Zone artifact/event/frequency runtime;
- `src/app/realRuntimeAttackFactProvider.ts` — generic semantic fact/content mapping exception, not a named rule selector.

Keep reviewing any future generic engine addition for content identity branches. `GENERIC_ENGINE` is not a permanent exemption from the architecture rule.

# Behavior-oracle and authority policy

M0 does not delete these paths. Existing tests remain the behavior oracle until a migration slice proves parity and the corresponding named execution is deleted.

Direct verified examples include:

- `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts`;
- `tests/ui/barbarianRageActionRuntime.test.ts`;
- `tests/ui/barbarianRageAttackDamage.test.ts`;
- `tests/ui/bardCollegeLoreCuttingWordsRuntime.test.ts`;
- `tests/ui/bardCollegeLorePeerlessSkillRuntime.test.ts`;
- `tests/ui/bardicInspirationActionRuntime.test.ts`;
- `tests/ui/bardicInspirationFollowUpRuntime.test.ts`;
- `tests/ui/bardicInspirationRuntimeAdapter.test.ts`;
- existing class/subclass/spell/progression/inventory/connected runtime suites under `tests/ui` selected by repository package scripts.

A migration may not weaken Host/session ownership, owner-only visibility, retry/reconnect, idempotency, persistence/lifetime, or Undo semantics merely to remove a named adapter.

# Freeze guard

Files:

- `.agents/LEGACY_EXECUTION_BASELINE.json`
- `scripts/check-legacy-execution-boundary.mjs`
- `tests/ui/legacyExecutionBoundary.test.mjs`
- `.github/workflows/legacy-execution-boundary.yml`

Policy:

1. existing baseline counts may decrease;
2. new scanned file/rule pairs fail;
3. increased counts fail;
4. exact presentation/fixture/generic-mapping exceptions are allowlisted, not broad directories;
5. the scanner is high-signal and intentionally does not pretend to be a complete semantic parser;
6. newly discovered legacy execution that the scanner misses must still be added to this inventory and, where practical, to the guard.

# M0 conclusion

M0 found substantial existing named execution debt across action/resource, reactions, persistent state, spell routing, progression, and session/inventory layers. This is the behavior oracle for the strangler migration; it is **not** evidence that a new Common Play primitive is required.

No concrete M0 finding by itself proves Gates A-E insufficient. Therefore:

- Foundation remains frozen through Gate E;
- Gates F-M remain dormant;
- the next phase after M0 integration is M1 generic migration harness, followed by representative probes;
- any future Gate F-M activation still requires a deterministic migration failure against existing Common Play composition and explicit owner direction.
