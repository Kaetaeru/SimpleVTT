# Session Modes: Freeform Exploration and Initiative

Status: Draft for Issue #14

## Product intent

SimpleVTT must be useful when nobody is in initiative.

Players should be able to make checks, cast spells, use items, heal, apply effects, consume resources, make attacks, and otherwise resolve rule-supported actions without first entering a turn tracker.

The application therefore distinguishes the session's **time/order mode** from whether a scene is narratively combat.

Initial shared modes are:

- **Freeform / Exploration** — no initiative, no current turn, no round structure.
- **Initiative / Structured** — explicit order, current actor, turns, rounds, and profile-defined action economy.

Both modes use the same RuleSource, Predicate, Timing, Action, Resource, Effect, Resolution, provenance, synchronization, and validation systems.

## Why this is not a `combat: boolean`

Initiative may be used for situations other than combat, and combat-like actions may happen before initiative begins.

A boolean such as:

```text
combat = true | false
```

is too weak to explain:

- whether turns exist;
- whether rounds exist;
- who the current actor is;
- whether per-turn economy is persistent;
- which Timing points can fire;
- how turn-relative durations expire;
- whether reactions are currently available/reset.

The generic engine should instead consume a structured SessionMode/ordering context.

## SessionMode contract

Conceptually:

```ts
interface SessionModeState {
  modeId: string
  modeKind: 'freeform' | 'initiative'
  startedAtEventId?: string
  timeContext: SessionTimeState
  initiative?: InitiativeState
}
```

The final serialized shape is deferred until the common Rule Definition Specification and networking contracts are finalized.

The important semantic boundary is that mode state belongs to the shared DM-hosted session, not to the permanent player Character.

## Freeform / Exploration mode

Freeform is the default state for ordinary play outside initiative.

Properties:

```text
initiative order: none
current actor: none
round: none
turn: none
turn-economy ledger: not persistently spent across unrelated activities
resource state: persistent
HP/temp HP: persistent
effects/conditions: persistent
session time: available
activity/resolution log: active
```

The DM and players can continue using the rules engine normally.

## What remains enforced in Freeform

Freeform does **not** mean rules are disabled.

Action legality still checks, where applicable:

- active RuleSource;
- prerequisites;
- permissions/restrictions;
- actor state;
- target requirements;
- range/context predicates when available;
- resource availability;
- conditions;
- module/RulesProfile compatibility;
- mode-specific restrictions.

Resource costs still matter.

Examples:

```text
spell slot -1
item charge -1
limited feature use -1
HP cost
consumable item removed
```

These are committed exactly as they would be in structured play.

## Freeform action economy

A normal per-turn action cost cannot remain spent forever when no turn exists.

The RulesProfile therefore defines a **freeform economy policy** for each relevant economy bucket or action-cost class.

Possible semantics include:

```text
not tracked persistently in freeform
requires a minimum time/activity interval
unavailable outside initiative
uses a separate freeform resource/cooldown
other explicit profile-defined behavior
```

The core engine must never solve this by silently pretending every freeform activity starts a hidden combat turn.

For the common case, an Action that costs one ordinary turn action can be resolved repeatedly in Freeform as separate activities, while real consumable resources continue to be spent.

## Same Action definition in both modes

Module authors should not need to duplicate an Action solely because it works both in and out of initiative.

Conceptually:

```text
Action: Example Spell

Economy cost:
  primary-action: 1

Resource cost:
  spell-resource: 1
```

In Initiative:

```text
primary-action is checked and spent for the actor's current turn
spell-resource is spent
```

In Freeform:

```text
primary-action follows the RulesProfile freeform policy
spell-resource is still spent
```

All other mechanics remain the same.

## Freeform checks and rolls

The user must never need to create an initiative encounter merely to make a roll.

Examples:

```text
Perception check
Stealth check
saving throw requested by DM
ability check
healing roll
item roll
custom RuleSource Action
```

These produce normal resolver/provenance output and appear in the shared activity/roll log when connected to a session.

## Freeform attacks

An attack may be resolved in Freeform if the current RulesProfile and session policy allow it.

Using an attack does not automatically switch the entire session to Initiative.

The DM may explicitly start Initiative before or after such an action.

This avoids putting narrative encounter-flow policy inside the arithmetic engine.

## Mode-aware Predicate

Predicate context should expose stable mode information.

Conceptually:

```text
session.mode.kind == freeform
session.mode.kind == initiative
initiative.isActive
initiative.currentActorId
```

Rules may use mode predicates when the distinction is mechanically real.

Examples:

- usable only while initiative is active;
- usable only outside initiative;
- gains a benefit on the actor's turn;
- available when no structured turn exists.

Do not encourage module authors to mode-check every ordinary rule unnecessarily.

## Timing without initiative

The Timing specification must distinguish events that exist independently of turn order from events that require initiative structure.

### Mode-independent resolution timing

Examples:

```text
ActionDeclared
TargetsSelected
BeforeRoll
RollResolved
AfterRoll
BeforeHitDetermination
HitDetermined
BeforeDamage
DamageApplied
AfterDamage
BeforeHealing
HealingApplied
EffectCreated
EffectRemoved
ActionResolved
```

These can occur in Freeform and Initiative.

### Initiative lifecycle timing

Examples:

```text
InitiativeStarted
RoundStarted
TurnStarted
TurnEnding
TurnEnded
RoundEnded
InitiativeEnded
```

These only exist while Initiative mode is active.

## Turn-relative rules in Freeform

A rule such as `until the start of your next turn` cannot be interpreted literally when no turn exists.

The engine must not fabricate one.

The RulesProfile/content must provide one of the following:

1. **Freeform equivalent** — an explicit alternative duration/timing rule.
2. **Time-based duration** — the rule can be tracked through session time.
3. **Initiative-only legality** — the rule/action cannot be used in Freeform.
4. **Unsupported in current context** — show an actionable warning/error.

This decision must be inspectable in provenance/validation.

## Duration representation across modes

Effects should preserve their original duration semantics rather than converting everything to rounds.

Conceptual categories include:

```text
instant
session-time duration
until explicit event
until source/target condition
until concentration/maintained state ends
initiative-turn-relative
initiative-round-relative
manual/indefinite
```

The common duration contract determines whether an effect can survive a mode transition without conversion.

## Minimal session/world time

Freeform needs enough time state to support durations and activities measured in ordinary game time.

MVP does not need a calendar.

A minimal abstraction can track a monotonic session/world-time value, for example conceptually:

```text
worldTime = 18 minutes since session epoch
```

The value is not wall-clock time.

The DM/session authority may advance it through explicit actions such as:

```text
advance 1 minute
advance 10 minutes
short activity duration
travel segment
rest resolution
```

Rules may reference the logical time representation without depending on the user's computer clock.

## Rest, travel, downtime, and exploration activities

For MVP, these should normally remain **activities inside Freeform mode**, not separate SessionModes.

Examples:

```text
Rest Activity
Travel Activity
Search Activity
Craft Activity
Downtime Activity
```

An Activity may:

- advance logical session time;
- consume/recover resources according to RulesProfile;
- trigger Timing events;
- request rolls/choices;
- create/remove effects;
- create a transaction/event record.

Only create a new top-level SessionMode later if a genuinely different ordering/time model is required.

## Initiative / Structured mode

Initiative establishes explicit ordering state.

Conceptual state:

```ts
interface InitiativeState {
  encounterId: string
  round: number
  order: InitiativeEntry[]
  activeEntryIndex: number
  currentActorId: string
  phase?: string
}
```

Exact schema remains RulesProfile-aware.

The mode provides the lifecycle required by action economy, reactions, and turn-relative rules.

## Starting Initiative

Starting Initiative is an explicit session-authority operation.

Recommended flow:

```text
[Start Initiative]
      ↓
select/confirm participants
      ↓
resolve or enter initiative/order
      ↓
review order
      ↓
commit mode transition
```

The transition itself is one authoritative session event/transaction.

## Freeform -> Initiative transition

The transition must preserve persistent game state.

Preserve:

- Character/Combatant projections;
- HP and temp HP;
- persistent resources;
- conditions;
- ongoing RuleSource/effect instances;
- source/module provenance;
- logical session time;
- activity history.

Initialize:

- participant initiative/order state;
- round/turn state;
- profile-defined action-economy ledgers;
- initiative-specific timing context;
- reaction/reset state according to RulesProfile.

Review/validate:

- effects with initiative-relative timing requirements;
- mode-specific permissions/restrictions;
- missing participant data;
- incompatible session module sources.

## Initiative ordering

The generic system should support a RulesProfile-supplied method rather than embedding one universal initiative formula.

Order entries need stable participant identity and enough metadata for tie/ordering policies.

The UI may allow DM correction/manual ordering when profile/session policy permits it.

## Turn lifecycle

A turn transition should be deterministic and event-driven.

Conceptual sequence:

```text
previous TurnEnding triggers
previous TurnEnded
profile reset/expiry processing
next TurnStarted
profile reset/refresh processing
current actor/economy availability published
```

The exact ordering between reset, expiry, trigger, and choice windows is part of the future Timing/RulesProfile specification and must not be hidden in React UI callbacks.

## Action economy in Initiative

The actor's economy ledger is authoritative rules state while Initiative is active.

The UI should show current availability and provenance, for example:

```text
Primary     Ready
Secondary   Spent — Feature X
Reaction    Ready
Movement    15 / 30
```

Using an Action commits economy/resource changes in the same resolution transaction as its effects.

## Reactions and interrupts

Initiative mode enables structured interrupt windows when defined by Timing/RuleSources.

A reaction opportunity should know:

- triggering event;
- eligible actor/owner;
- current mode;
- current initiative/turn context;
- source RuleSource;
- resource/economy cost;
- legality result;
- point at which the pending resolution resumes.

Freeform may also support trigger/choice mechanics, but a reaction that specifically depends on initiative economy must follow the profile's Freeform policy or be unavailable.

## Ending Initiative

Ending Initiative is explicit and authoritative.

Recommended flow:

```text
[End Initiative]
      ↓
resolve/close any pending choice or transaction
      ↓
run InitiativeEnded lifecycle
      ↓
preserve persistent state
      ↓
clear structured turn/round state
      ↓
return to Freeform
```

## Initiative -> Freeform transition

Preserve:

- HP/temp HP;
- resources;
- persistent conditions/effects;
- logical time;
- source provenance;
- activity/resolution history.

Remove/finalize:

- current turn pointer;
- initiative order as active state;
- ephemeral turn economy spending;
- initiative-only pending opportunities;
- other RulesProfile-defined encounter-only transient state.

The session may keep the finished initiative order in historical event data for logs/debugging.

## Event model generalization

The introduction of Freeform makes `CombatEvent` too narrow as the top-level name for all transactions.

Recommended direction:

```text
ResolutionEvent / GameEvent
├─ action resolution
├─ roll/check
├─ effect/resource change
├─ mode transition
├─ time advancement/activity
└─ initiative lifecycle
```

A structured attack can still expose combat-specific metadata, but shared synchronization, undo, deduplication, logging, and provenance should use the broader event family.

This avoids creating one event pipeline for combat and another for exploration.

The exact rename should be finalized when the common event contract is implemented; existing design references to `CombatEvent` should be treated as candidates for generalization rather than permanent API names.

## Activity / roll log UX

The existing Roll20/FVTT-inspired log becomes a general shared activity log.

Freeform examples:

```text
Aelar — Perception
14 + 5 = 19

Mira — Healing Spell → Thorin
Resource: Slot 2  2 -> 1
Healing: 8

DM — Time advanced
+10 minutes
```

Initiative examples add structured context:

```text
Round 3 — Aelar
Longsword → Goblin A
Hit 23 vs AC 15
Damage 9
Primary action spent
```

Both expand into the same provenance/transaction details.

## Undo considerations

Freeform actions should be undoable through the same transaction rules when safe.

Examples:

- restore a spent item charge;
- restore HP before/after healing;
- remove an effect created by the action;
- reverse logical-time advancement only when no later event depends on it.

Mode transitions require stronger dependency checks before undo because later events may assume a particular mode/order.

The event system should reject unsafe historical rewinds rather than corrupting current state.

## Authority

When connected to a session:

- DM host owns SessionMode and InitiativeState;
- players may request/perform Actions according to session permissions;
- only authorized session operations can start/end initiative or change order;
- mode transition events have stable IDs and are broadcast to participants;
- reconnect restores the authoritative mode, logical time, initiative state, effects, resources, and relevant economy state.

Offline Character management has no shared SessionMode requirement.

## Character ownership

Nothing about Initiative changes the permanent Character ownership model.

```text
Player PC
  permanent Character
        ↓ session projection
DM session
  mode + encounter state
```

When Initiative ends, the player's locally saved Character remains the permanent source while shared session-state changes are synchronized according to the existing local-first/session-projection contract.

## UX: Freeform

Recommended compact header:

```text
Exploration
Freeform
```

Do not show empty turn trackers or action-economy warnings continuously.

Primary surfaces:

- Character action shortcuts;
- skill/check shortcuts;
- resources;
- active effects;
- targets when relevant;
- shared roll/activity log.

The user should feel that the sheet is fully functional outside combat.

## UX: Initiative

Recommended header:

```text
Initiative
Round 3
Aelar's Turn
```

Add:

- initiative/order panel;
- current actor emphasis;
- economy strip;
- End Turn control for the appropriate authority;
- pending reaction/choice prompts;
- turn-relative duration indicators.

The main Action cards remain the same components where possible; they receive a different legality/economy context.

## Mode indicator on actions

Do not clutter every Action with a mode badge by default.

Only surface mode information when it changes legality/behavior.

Example:

```text
Example Reaction
Unavailable outside Initiative
[Why?]
```

or:

```text
Example Ritual
Freeform only
```

## Session module integration

Session modules may provide:

- mode-aware RuleSources;
- exploration Activities;
- initiative-specific encounter rules;
- logical-time triggers;
- custom freeform restrictions;
- additional mode-transition validation.

They use the same Predicate/Timing contracts as local/default content and do not execute arbitrary code.

## Acceptance scenarios

The implementation should eventually demonstrate:

1. A player makes a skill check in Freeform with full source/provenance breakdown and no initiative state.
2. A player uses a resource-consuming spell in Freeform; the resource persists as spent but an ordinary per-turn action bucket does not remain spent indefinitely.
3. A persistent effect created in Freeform remains when Initiative begins.
4. The DM explicitly starts Initiative and one authoritative transition initializes order, turn state, and economy.
5. Normal Initiative actions consume economy/resources through the shared resolver.
6. Reactions are offered at valid interrupt Timing points.
7. The DM ends Initiative and persistent HP/resources/effects remain while ephemeral turn state is removed.
8. A turn-relative rule used in Freeform either has an explicit mapping, is illegal, or produces a clear unsupported-context result.
9. The same Action definition works in both modes without duplicated mechanics.
10. The shared activity/event log represents both Freeform and Initiative resolutions.
11. Rest/travel/time-advance can operate as Freeform activities without adding new top-level modes.
12. Reconnect restores the current authoritative mode and associated structured state.

## Relationship to other design contracts

This design depends on and extends:

- RuleSource/provenance/action economy;
- RuleModules/ContentCatalog;
- Predicate and Timing;
- Resolution/Event transactions;
- future RulesProfile lifecycle definitions;
- LAN/session synchronization.

It should drive the later generalization of `CombatEvent` and ensure exploration and initiative never become separate rules engines.
