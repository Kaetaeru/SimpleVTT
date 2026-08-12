# Session Runtime, Authority, Resolution, and DM Adjudication

This document defines the canonical shared-session runtime model: state lifetimes, authority, Freeform/Initiative modes, targeting, EffectInstances, ResolutionEvents, write-back, reconnect, and fast DM rulings.

## 1. Permanent ownership vs runtime authority

Permanent ownership and connected-session authority are different concepts.

- The player owns the permanent Character and local library.
- The DM host owns the authoritative ordered shared-session state while connected.
- CombatantState, SessionMode, initiative/order, encounter state, session-only rules, and committed shared ResolutionEvents are host-authoritative.
- Confirmed Character-owned durable runtime changes are written back to the player locally.
- The DM does not silently become owner of the Character source file.

## 2. State lifetime taxonomy

Every important state field belongs to an explicit lifetime class.

### PortableDefinition

Versioned reusable content such as RulesProfile metadata, RuleModule, RuleSource definition, ItemDefinition, and CombatantDefinition.

### CharacterSource

Player-owned durable build/source data such as identity, progression, selected content, ChoiceDefinition selections, permanent ItemInstances, permanent source overrides, and module/source references.

### CharacterRuntimeDurable

Player-owned mutable state expected to survive application/session boundaries when rules say it persists: current HP, Resources, consumable quantity, item charges, and durable Character-bound EffectInstances.

### DerivedCache

Reproducible data such as AC, attack modifiers, Action availability, and provenance cache. It may be discarded/rebuilt.

### SessionProjection

Host-facing representation of a connected Character and its relevant revision/capabilities. It is not a second permanent Character file.

### SessionRuntime

Host-owned state such as participants, SessionMode, initiative/order, economy ledgers, session module mounts, session SituationalRules, and encounter state.

### EffectRuntime

Runtime EffectInstances with explicit source/target/start/duration/stack identity and lifetime.

### PendingResolution

Ephemeral calculation state. It is not committed game state.

### EventHistory

Committed ResolutionEvents/log history used for synchronization, diagnostics, correction, reconnect, and replay within supported retention bounds.

## 3. Authority matrix

At minimum, implementations must make authority explicit for:

| State family | Offline authority | Connected authority | Persistence |
|---|---|---|---|
| Character source/build | player | player, then projection validation | durable local |
| HP/resources/item charges | player | host event sequence | durable local write-back |
| derived stats | local resolver | resolver from authoritative snapshots | rebuildable |
| CombatantState | DM/local host | DM host | session/encounter |
| SessionMode/initiative/economy | none/offline local | DM host | session only |
| session modules/SituationalRules | DM/local host | DM host | session only unless explicitly adopted |
| PendingResolution | resolver | authority coordinating resolution | ephemeral |
| ResolutionEvent | local app offline | DM host session | history + write-back metadata |

The UI must not infer authority from who clicked a button.

## 4. SessionMode

The session uses structured mode context rather than `combat: true/false`.

Initial modes:

### Freeform / Exploration

- no initiative order;
- no round/current turn;
- normal Action/Activity usage remains available according to legality;
- HP/Resources/Effects/conditions remain real;
- resource costs are consumed;
- per-turn economy is interpreted by a RulesProfile-defined Freeform policy;
- session/world logical time may advance explicitly.

### Initiative / Structured

- explicit participants/order;
- current round/turn;
- RulesProfile-defined action economy enforced;
- reactions/interrupt windows use TimingPoints;
- turn/round resets and durations are active.

Both modes use the same rules/resolution/event engine.

An attack or spell in Freeform does not automatically force Initiative unless an explicit session/profile policy says so.

## 5. Freeform Activities

Rest, travel, downtime, searching, and time advance should initially be Activities inside Freeform rather than new top-level modes.

An Activity may:

- advance logical session time;
- trigger Resources/recovery;
- expire Effects;
- create ResolutionEvents;
- use profile-defined interruption/cancellation rules.

A full campaign calendar is not required for MVP.

## 6. Mode transitions

### Freeform -> Initiative

The DM explicitly starts Initiative.

The transition:

1. chooses/adds participants;
2. resolves/inputs order according to RulesProfile;
3. creates round/turn state;
4. initializes economy ledgers;
5. preserves HP/Resources/persistent Effects;
6. handles timing conversion/review explicitly;
7. commits one authoritative mode-transition ResolutionEvent.

### Initiative -> Freeform

Ending Initiative:

- ends turn/round ordering;
- clears/finalizes ephemeral turn economy according to RulesProfile;
- preserves durable HP/Resources/Effects;
- records the transition;
- returns Actions to Freeform legality/economy policy.

## 7. Targeting and multi-target resolution

The resolver must not be single-target-only.

Supported targeting concepts include:

- self;
- one target;
- choose exactly/range of N;
- multiple manual targets;
- profile-defined target filters;
- area-like actions represented by manual target selection without a tactical map.

A targeting plan specifies whether rolls are shared or per-target.

Example without a map:

```text
Area action
☑ Goblin A
☑ Goblin B
☑ Goblin C
☐ Ally A
[Resolve for 3 targets]
```

The resulting ResolutionEvent may contain mixed per-target outcomes and uses deterministic target ordering.

## 8. ActionRequest

An ActionRequest is intent and may be rejected, stale, or cancelled.

It should identify:

- request ID;
- actor;
- Action/Activity/source identity;
- requested targets;
- supplied parameters/choices;
- known Character/build/runtime revision;
- known session event cursor;
- relevant capabilities/module identities.

An ActionRequest never directly mutates HP, Resources, economy, or inventory.

## 9. PendingResolution

PendingResolution is an ephemeral deterministic work unit over fixed snapshots.

It may pause for:

- target selection;
- authoritative dice outcomes/presentation plan;
- optional resource spend;
- ChoiceDefinition;
- reaction/interrupt;
- DM adjudication;
- unsupported mechanic review;
- stale-state revalidation.

It must end by either:

- atomic commit;
- cancellation with zero StateChanges;
- explicit failure;
- invalidation/restart when authoritative state changed underneath it.

## 10. Resolution pipeline

The exact RulesProfile may refine ordering, but the architecture keeps explicit stages:

1. capture authoritative actor/target/session snapshots;
2. collect active RuleSources and ActivationState;
3. evaluate legality/Predicates;
4. resolve pre-action choices;
5. finalize targets;
6. build roll plan;
7. generate authoritative dice outcomes once;
8. evaluate initial outcome;
9. open legal reaction/interrupt TimingPoints;
10. apply accepted choices/adjudication and re-evaluate affected results;
11. calculate per-target damage/healing/effects;
12. apply target-side policies such as resistance/immunity/vulnerability;
13. construct typed StateChanges;
14. validate the entire transaction;
15. commit one ResolutionEvent;
16. publish activity-log/dice presentation and write-back classifications.

No state is incrementally committed before step 15.

## 11. StateChange

StateChanges are typed domain mutations rather than unrestricted JSON Patch.

Initial families include:

- HP/temp HP;
- Resource current/max;
- ItemInstance quantity/charges/configuration;
- ActivationState;
- EffectInstance create/update/remove;
- condition/state marker;
- economy ledger;
- SessionMode/initiative/order;
- session module mount/unmount where appropriate;
- explicit durable grant/source operation;
- correction/reversal.

Each StateChange contains enough information to validate and explain:

- target entity/path;
- before/after or operation semantics;
- source/provenance;
- lifetime;
- write-back class;
- inverse/reversal when supported.

All StateChanges generated by one Resolution commit together or not at all.

## 12. ResolutionEvent

`ResolutionEvent` is the canonical committed transaction, activity-log, and network synchronization unit.

It should preserve a stable envelope with typed payloads for:

- event ID/schema version;
- authoritative sequence/cursor;
- session ID when applicable;
- actor/initiator and authority/committer;
- request ID;
- causation/correlation IDs;
- Action/Activity/RuleSource identity;
- target identities/results;
- logical time and mode/turn context;
- Character/build/runtime revision references;
- dice records;
- choices/reactions;
- DM adjudication;
- provenance/calculation records;
- StateChanges;
- warnings/unsupported metadata;
- reversal/correction relationships.

Applying an already-applied event ID is a no-op.

## 13. Dice records

Dice results are generated once by the authoritative resolver and stored structurally enough to rebuild logs/visual presentation:

- die size/count;
- individual faces;
- selected/discarded dice;
- purpose/component;
- roll-plan/formula reference;
- final selected result.

Visual dice never generate an independent result.

## 14. EffectInstance lifecycle

A runtime EffectInstance is distinct from its definition.

It carries:

- instance ID;
- source definition/version;
- creator/caster/source entity;
- targets;
- start event/time;
- active mechanics;
- duration/expiry;
- activation state;
- stack/refresh/replace identity;
- parent/child relationship when needed;
- lifetime/write-back class.

Repeated effects use explicit RulesProfile/content semantics: stack, refresh, replace, conflict, or unsupported. Load order is never the rule.

Effects survive Freeform/Initiative transitions only when their lifetime/timing semantics say they do.

## 15. Fast DM adjudication

Automation must never become a rules prison.

DM intervention is a first-class provenance-aware operation.

### SituationalRule

A lightweight temporary RuleSource may be scoped to:

- this PendingResolution only;
- one actor/target;
- selected targets;
- current turn/round;
- current Initiative;
- session/scene until cleared;
- profile-defined duration.

It can express common table adjustments through existing mechanics:

- +/- modifier;
- dice modifier;
- advantage/disadvantage or profile equivalent;
- temporary stat/defense change;
- permission/restriction;
- damage/healing adjustment;
- resistance/immunity/vulnerability grant/suppression;
- economy/Resource adjustment;
- temporary condition/Effect;
- target/context override.

### Pending-resolution ruling UX

Common operations should be one-click or near-one-click:

```text
+1  +2  +3  custom
Advantage / Disadvantage
Force success / Force failure
Damage / Heal
Add condition/effect
Spend / Restore resource
Scope: this roll / this target / this turn / until cleared
```

The engine recalculates from explicit adjudication data; the UI does not edit displayed totals directly.

### Calculated vs adjudicated result

When a DM forces an outcome, preserve both:

```text
Attack: 14 vs AC 15
Calculated: Miss
DM ruling: Hit
Reason: situational adjudication
```

Downstream effects use the adjudicated outcome while the original calculation remains inspectable.

### Post-commit correction

Corrections create a new correction/reversal ResolutionEvent rather than invisibly rewriting old history.

Common corrections include HP, temp HP, damage/healing, Resources, item charges, conditions/Effects, economy, initiative/order, or safe full undo.

## 16. Undo and reversal

Undo is synchronized history, not deletion of an old event.

A clean reversal is allowed only when StateChanges are reversible and later dependent events do not make inversion unsafe.

When full reversal is unsafe, use an explicit correction event.

Relationships such as `reverses` and `corrects` are preserved.

## 17. Connected-session flow

Recommended semantics:

1. player creates ActionRequest from local Character/source data;
2. player may locally prevalidate;
3. request is sent with revisions/capabilities;
4. host resolves shared targets/state and DM rulings;
5. host commits authoritative ResolutionEvent;
6. clients apply it idempotently;
7. player persists Character-owned durable StateChanges locally;
8. session-only StateChanges remain host/session state.

The transport may be WebSocket, but these semantics are transport-independent.

## 18. Write-back

Normally written back when Character-owned and durable:

- current HP;
- persistent Resources;
- consumable quantity;
- item charges/configuration;
- durable Character-bound Effects/conditions;
- explicitly accepted permanent grants.

Normally not written into permanent Character source/runtime state:

- initiative/order;
- per-turn economy;
- expired encounter-only temp state;
- one-resolution SituationalRules;
- session module mounts;
- CombatantState;
- session-only items/Effects.

The classification comes from domain lifetime metadata, not UI special cases.

## 19. Disconnect/reconnect

On disconnect:

- confirmed events already applied locally remain;
- PendingResolution is not treated as committed;
- session-only state stays associated with the resumable session;
- local Character remains usable.

On reconnect:

1. exchange Character revisions/capabilities and event cursors;
2. recover missing snapshot/events;
3. detect incompatible local source/module changes;
4. apply missing events idempotently;
5. restore SessionMode/order/economy/Effects from host authority;
6. never double-apply an event.

If local persistence failed after a confirmed host event, shared session history remains correct and the player gets a recoverable `session changes not yet saved locally` state.

## 20. Session end

Before cleanup, classify state:

### Keep/write back

Character-owned durable source/runtime changes that were explicitly committed.

### Discard/unmount

Session modules, CombatantState, initiative/order/economy, session-only SituationalRules, and session-only/expired EffectInstances/items.

### Review

Any state whose lifetime cannot be classified by the current profile/capabilities is surfaced for explicit review rather than silently persisted or deleted.
