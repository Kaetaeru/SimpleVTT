# SimpleVTT Common Rule Definition Specification

Version: `0.1-draft`

Execution planning authority for Common Play / Resolver / legacy convergence work:

`docs/rules/resolver-execution-checklist.md`

This document defines the common declarative rules language used by SimpleVTT. A `RulesProfile` supplies edition/ruleset semantics on top of this language. Named feats, spells, items, classes, species, conditions, and monsters are content built from these primitives; they are not hard-coded resolver branches.

## 1. Design constraints

The common specification must be:

- declarative and safe to import;
- deterministic for the same inputs, dice, choices, and versions;
- provenance-first;
- usable by Characters and Combatants;
- independent from React and networking transport;
- extensible through versioned application-supported registries, not arbitrary executable plugins;
- explicit when a mechanic is unsupported.

The common specification does **not** define one D&D edition's exact numbers. Those belong to a RulesProfile and content modules.

## 2. Stable identity

Persisted/public definitions use stable IDs rather than display names.

Recommended identity components:

```text
rulesProfileId + rulesProfileVersion
moduleId + moduleVersion
sourceId
instanceId (runtime only)
```

Display labels may change without changing identity.

## 3. RuleSource

A `RuleSource` is the provenance root for mechanically meaningful content.

Examples:

- class/species/background feature;
- feat;
- spell;
- item passive/active feature;
- condition;
- environmental/session rule;
- temporary situational rule;
- explicit manual override.

A RuleSource may provide:

- property contributions;
- Actions/Activities/Reactions;
- Resources;
- permissions/restrictions;
- roll modifications;
- damage/healing components;
- EffectInstance creation/removal;
- triggers;
- activation requirements;
- ChoiceDefinitions;
- progression grants;
- economy modifications.

Descriptive prose may accompany a RuleSource, but runtime mechanics must not depend on parsing that prose.

## 4. Property system

Every calculation-relevant value that needs cross-rule composition should have a stable property path.

Examples:

```text
ability.str.score
ability.str.modifier
defense.ac
save.dex
skill.stealth
initiative
movement.walk
resource.example.max
```

Property paths are registered by trusted application/RulesProfile code. Imported JSON may reference supported paths but may not define executable behavior for new paths.

A resolved property contains:

- final value;
- base/source value when applicable;
- ordered contributions;
- applied/suppressed/superseded/failed status;
- source IDs;
- operation;
- predicate result;
- stacking/priority explanation.

## 5. Expression AST

Expressions use a restricted tree, never arbitrary code.

Minimum operators expected by the first profile:

- literal;
- property/context reference;
- add/subtract;
- multiply/divide;
- min/max;
- floor/ceil/round when explicitly defined by the RulesProfile;
- conditional expression where needed.

Example:

```json
{
  "op": "add",
  "args": [
    { "ref": "ability.dex.modifier" },
    { "value": 2 }
  ]
}
```

References must resolve against an explicit evaluation context such as actor, target, action, session, or source instance.

## 6. Predicate AST

Predicates answer whether a mechanic, Action, option, or trigger applies.

Minimum logical operators:

- all / any / not;
- equality/inequality;
- less/less-or-equal/greater/greater-or-equal;
- contains / tag membership;
- exists;
- state/activation checks;
- RulesProfile-supported relation checks.

Predicates are evaluated with inspectable results. Provenance/debugging must be able to say which clause passed or failed.

A failed Predicate is not silently discarded; its contribution may appear as `not applied` in detailed inspection.

## 7. Mechanic taxonomy

The executable core supports a finite registry of typed mechanic kinds. Initial families should cover:

### Property mechanics

- add/subtract numeric value;
- add dice contribution;
- set/replace value;
- minimum/maximum/cap/floor;
- multiply/divide where the RulesProfile permits it;
- formula candidate;
- proficiency/expertise-like contribution where represented by the profile.

### Roll mechanics

- advantage/disadvantage or profile-equivalent roll-state contribution;
- additional dice;
- reroll/selection primitives only when explicitly added and tested;
- critical/result modification through profile-supported policies.

### Action/content mechanics

- grant/remove Action or Reaction;
- permission/restriction;
- Action cost/resource cost modification;
- target/range/context constraint.

### Resource/economy mechanics

- define Resource;
- spend/restore/change Resource;
- change Resource maximum;
- define/modify economy capacity/cost/reset policy;
- movement/economy budget change.

### Damage/healing/state mechanics

- typed damage/healing component;
- resistance/immunity/vulnerability-like adjustment through RulesProfile policy;
- condition/state-marker add/remove;
- EffectInstance create/update/remove;
- HP/temp-HP/resource StateChange generation.

Unsupported requested mechanic kinds must fail semantic validation or load inspection-only; they are never ignored while claiming full support.

## 8. Timing and event points

Timing is explicit. Rules must not infer order from UI component order.

The common registry should be able to represent at least these classes of timing points:

```text
activity/action declared
targets selected
before roll
roll generated
after roll
before outcome determination
outcome determined
before damage/healing roll
damage/healing rolled
before state application
state applied
after state application
action resolved
freeform time/activity events
initiative start/end
round start/end
turn start/end
effect activation/expiry
resource/recovery lifecycle
```

Exact event names and legal interrupt windows are versioned registry entries.

A reaction/interrupt is a trigger at a defined TimingPoint that may pause a PendingResolution for a ChoiceDefinition or Action.

## 9. Duration and lifecycle

Duration is not just `rounds: N`.

The common contract should support profile-defined forms such as:

- instant;
- until explicit TimingPoint;
- N rounds/turns with a named decrement boundary;
- session/world-time duration;
- until rest/activity type;
- while predicate remains true;
- while maintained/concentrated through a profile rule;
- until dispelled/removed;
- manual/session scope.

A duration must identify whose turn/event controls it when turn-relative.

Freeform has no invented turn. A turn-relative duration used outside Initiative must have an explicit profile mapping, time-based alternative, context restriction, or unsupported result.

## 10. Activation state

A RuleSource may exist without applying.

The common engine uses generic activation descriptors/state rather than scattering unrelated UI booleans.

RulesProfile/content may use concepts such as:

- equipped;
- wielded;
- attuned-like;
- prepared/known/available;
- stance/mode selected;
- enabled/disabled;
- suppressed;
- loadout/configuration selection.

Activation requirements are Predicate-compatible and provenance-visible.

## 11. Action and Activity

An `Action`/`Activity` describes a resolvable operation.

It may include:

- stable ID/source;
- legality Predicate;
- targeting definition;
- economy/resource/item costs;
- roll plan;
- outcome mechanics;
- EffectInstance creation;
- ChoiceDefinitions;
- Timing/Trigger relationships;
- mode restrictions;
- provenance labels.

The same definition may be usable in Freeform and Initiative. Mode-specific economy interpretation belongs to the RulesProfile.

## 12. Targeting

Targeting must not assume one target or a tactical map.

Minimum strategies:

- self;
- single target;
- choose exactly/range of N targets;
- multiple manual targets;
- profile-defined target filters/tags;
- area-like action represented by a manually selected target set when no map exists.

A Resolution specifies whether rolls are shared or generated per target and how per-target outcomes are grouped.

Target result ordering is deterministic.

## 13. ChoiceDefinition

A ChoiceDefinition represents a real human decision, not deterministic math.

Used by:

- character creation;
- level-up/progression;
- item configuration;
- Action parameters;
- optional resource spending;
- reactions/interrupts;
- damage/type selection;
- DM adjudication where a supported alternative is explicitly exposed.

Minimum fields:

- stable choice ID;
- prompt/label;
- minimum/maximum selections;
- options or option provider;
- option predicates/prerequisites;
- grants/effects resulting from selection;
- authority/eligible responder;
- timing when runtime;
- persistence/reselection policy.

Deterministic grants never become fake choices.

## 14. Resources and action economy

Resources are common tracked quantities with definition, current value, maximum, source, and lifecycle/reset policy.

Action economy is RulesProfile-defined rules state, not UI decoration. The common engine supports named economy buckets/budgets without hard-coding a specific edition's exact names.

An Action declares costs. The engine produces an explainable legality result before execution.

Freeform economy policy is defined by the RulesProfile so per-turn costs do not remain permanently spent when no turn exists.

## 15. EffectInstance

RuleSource definitions and runtime effects are separate.

An EffectInstance carries:

- runtime instance ID;
- source definition identity/version;
- creator/caster/source entity;
- targets;
- active mechanics;
- start event/time;
- duration/expiry;
- activation state;
- stack/refresh/replace identity;
- parent/child relationship when needed;
- lifetime classification;
- provenance.

RulesProfile/content defines whether repeated application stacks, refreshes, replaces, or conflicts. Load order is never the implicit rule.

## 16. ItemDefinition and ItemInstance

An ItemDefinition is portable content. An ItemInstance is one owned mutable copy.

Definitions may provide passive RuleSources, Actions/Reactions, Resources/charges, activation requirements, configuration choices, and EffectInstance creation.

Instances carry identity, owner, quantity, activation/loadout state, charges/resources, selected configuration, and durable/session lifetime.

Use/consumption is atomic with the resulting ResolutionEvent.

## 17. ProgressionTrack

Progression is RulesProfile-driven and not limited to one global `level` integer.

A ProgressionTrack may define thresholds, prerequisites, grants, and choices. Content may activate when progression Predicates become true.

Level-up/progression uses a draft transaction:

```text
current Character
+ proposed progression change
+ modules/profile
+ required choices
-> ProgressionDraft
-> before/after review
-> Character revision commit
```

## 18. RuleModule and ContentCatalog

RuleModules package declarative content. The same portable module can be mounted as builtin, local/personal, or session scope.

Manifest requirements include:

- module ID/version;
- common spec compatibility;
- RulesProfile compatibility;
- dependencies/conflicts/replacements/extensions;
- stable content IDs;
- optional author/license/reference metadata;
- capability requirements.

`ContentCatalog` is the resolved view used by Character creation/editing. Default content and imported homebrew use the same mechanics pipeline.

A single feat/item JSON may be normalized into a one-entry local module/catalog entry.

## 19. RulesProfile

RulesProfile supplies ruleset-specific semantics, including:

- property registry and derived formulas;
- stacking/priority;
- rounding;
- critical/result rules;
- damage/defense interpretation;
- economy buckets and reset behavior;
- Freeform economy policy;
- Timing/Duration mappings;
- Initiative lifecycle;
- progression tracks;
- recovery/rest policies;
- validation and content-category metadata.

Generic engine code must not scatter these policies across unrelated components.

## 20. Provenance

Every important resolution result should be inspectable.

Provenance records should preserve:

- source/module/version;
- property/mechanic target;
- operation/value/expression result;
- Predicate result;
- activation result;
- stacking/priority decision;
- applied/suppressed/superseded/overridden status;
- DM adjudication when present;
- relationship to generated StateChanges.

The same records power user-facing breakdowns and developer/rule-author diagnostics.

## 21. Resolution lifecycle

The canonical transaction lifecycle is:

```text
ActionRequest
  -> PendingResolution
  -> targets / dice / choices / interrupts / adjudication
  -> typed StateChange[]
  -> atomic validation
  -> committed ResolutionEvent
```

An ActionRequest is intent only. PendingResolution is ephemeral. Only a committed ResolutionEvent changes authoritative shared runtime state.

## 22. StateChange

Do not use unrestricted JSON Patch as the only mutation contract.

Typed StateChange families should cover:

- HP/temp HP;
- Resource values/maxima;
- ItemInstance quantity/charges/configuration;
- ActivationState;
- EffectInstance lifecycle;
- condition/state marker;
- economy ledger;
- SessionMode/initiative/order;
- explicit durable grant/source change;
- correction/reversal.

Each change carries target, before/after or operation semantics, provenance, lifetime, write-back classification, and enough information for deterministic validation/application.

All StateChanges from one Resolution commit together or not at all.

## 23. ResolutionEvent

ResolutionEvent is the common committed event/log/synchronization unit for Freeform and Initiative.

Envelope concerns include:

- event ID/version;
- authoritative sequence/cursor;
- actor/authority;
- request/causation/correlation IDs;
- action/activity/source identity;
- target results;
- dice records;
- choices/reactions;
- DM adjudication;
- provenance/calculation detail;
- StateChanges;
- session/mode/turn context when applicable;
- revision/version references;
- reversal/correction relationships.

Applying the same event ID twice is a no-op.

## 24. Authority and lifetime classes

Important state is classified into explicit lifetime categories:

- portable definition;
- Character source data;
- Character durable runtime state;
- derived/cache state;
- SessionProjection;
- session/encounter runtime;
- EffectInstance runtime state;
- PendingResolution;
- event/history.

Permanent ownership and connected-session authority are distinct. Player owns the Character; DM host owns authoritative shared session ordering/results. Character-owned durable runtime changes are written back after authoritative confirmation.

## 25. Validation and unsupported mechanics

Validation has at least:

- structural/schema validation;
- semantic reference validation;
- capability validation;
- RulesProfile/module compatibility validation;
- state/context validation at activation/execution time.

User-facing severities:

- blocking error;
- warning;
- info;
- unsupported mechanic/capability.

Unsupported content may be preserved for inspection/round-trip when safe, but must not silently behave as if fully supported.

## 26. Versioning and capability negotiation

Persisted/user-authored contracts are versioned independently where useful:

- common rule spec;
- RulesProfile;
- RuleModule;
- Character schema/build revision/runtime revision;
- Combatant schema;
- ResolutionEvent schema;
- session wire protocol.

Compatibility is capability-aware, not schema-number-only. A client may need support for a mechanic kind, Predicate operator, TimingPoint, targeting strategy, or RulesProfile policy.

## 27. Change policy

After the first implementation slice, new common primitives require a concrete failing scenario:

1. reproduce the table case as a deterministic golden scenario;
2. try to express it with existing primitives;
3. add the smallest missing primitive/operator/timing point only if needed;
4. version schema/spec as required;
5. add migration/compatibility behavior for persisted data;
6. rerun existing scenarios.

This is the primary extension strategy for SimpleVTT.
