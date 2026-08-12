# Extensibility, Compatibility, and Test Strategy

This document defines how SimpleVTT stays easy to change after real table use exposes friction, without prematurely building a general plugin runtime.

## 1. Primary architecture question

For every subsystem ask:

> Can one more valid kind of rule, content, state, or presentation be added without editing unrelated layers?

If the answer is consistently no, the boundary is too rigid.

## 2. Closed executable core, open declarative content

SimpleVTT separates trusted executable extension points from declarative user content.

### Trusted executable extension points

Implemented and shipped by application code:

- Property descriptors;
- Mechanic evaluators;
- Predicate operators;
- TimingPoint registry;
- Targeting strategies;
- Duration/lifecycle policies;
- RulesProfile policies;
- migration functions;
- domain-to-UI render adapters.

### Declarative extension points

Available to modules, homebrew JSON, Characters, Combatants, items, and sessions:

- RuleSources;
- Actions/Activities;
- Resources;
- ChoiceDefinitions;
- Effects;
- module/catalog content;
- ContentEntry relationships and contributions;
- Choice option extension points;
- Progression contributions;
- ItemDefinitions;
- CombatantDefinitions;
- SituationalRules;
- supported ActivationState and targeting/configuration data.

Imported data cannot register arbitrary executable behavior.

## 3. Registries, not scattered switches

Extensible common concepts use a stable registry/descriptor pattern rather than many unrelated `switch` statements.

Candidates include:

- property path registry;
- mechanic kind registry;
- Predicate operator registry;
- TimingPoint registry;
- targeting-strategy registry;
- content-category descriptors;
- content relationship/extension-point descriptors;
- RulesProfile policy tables;
- UI presentation descriptors where appropriate.

Adding one trusted operator should have one clear implementation/registration location plus schema/tests, not many feature-specific branches.

## 4. No UI-owned rules

React components may:

- render domain/view-model state;
- collect Choices;
- send domain commands/ActionRequests;
- present validation/provenance.

They must not become the source of truth for:

- edition arithmetic;
- stacking;
- named feat/spell/item behavior;
- named class/subclass/species expansion wiring;
- Timing/Duration;
- action legality;
- session authority;
- resource/economy lifecycle.

This keeps UX redesign cheap.

## 5. Change-safe domain boundaries

Prefer explicit input/output contracts.

Representative boundaries:

```text
RuleModule(s) -> ContentCatalog
ContentEntry relationships -> resolved catalog/extension graph
Character source -> Rule/property resolver
ActionRequest + Context -> PendingResolution
PendingResolution -> StateChange[]
validated StateChange[] -> ResolutionEvent
Domain state -> UI view model
Persisted JSON -> validation/migration -> current domain model
Transport messages -> protocol commands/events -> domain
```

Avoid one giant mutable `GameState` object that every package reaches into directly.

## 6. Stability levels

Not every internal type is a permanent public promise.

### Internal implementation detail

Freely refactorable behind tests.

### Domain contract

Coordinated change across internal packages.

### Persisted/public JSON contract

Versioned and migrated.

### RuleModule authoring contract

Documented compatibility/capability policy.

### Session wire contract

Versioned/negotiated; transport-independent domain meaning remains stable.

This distinction lets implementation evolve quickly while protecting user-created data.

## 7. Capability model

A version number alone is insufficient for compatibility.

Content/session negotiation may require named capabilities such as:

- mechanic kind;
- Predicate operator;
- TimingPoint;
- targeting strategy;
- ActivationState semantics;
- content relationship kind;
- Choice option contribution;
- Progression contribution;
- ResolutionEvent payload capability;
- RulesProfile policy version.

An older client must be able to report what it cannot execute before authoritative play.

## 8. Unsupported/unknown behavior

Unknown data must degrade safely.

Allowed outcomes include:

- reject activation with an actionable validation error;
- load in inspection-only/disabled state;
- preserve unknown fields for round-trip when safe;
- mark Character/session incompatible;
- request explicit user/DM review.

Never silently discard an unsupported mechanic while claiming the content is fully supported.

The same rule applies to unsupported cross-module relationship semantics: a client that can parse a module but cannot safely resolve its `parent`, `extends`, `replaces`, option contribution, or progression contribution contract must not partially activate it as if complete.

## 9. Versioning and migration

Track independently where needed:

- Common Rule Definition Specification version;
- RulesProfile version;
- RuleModule version;
- Character schema version;
- Character source/build revision;
- Character durable-runtime revision;
- Combatant schema version;
- ResolutionEvent schema version;
- session protocol version.

Rules content updates must not silently reinterpret old Characters or historical event data.

Migration boundaries should be explicit and testable.

Cross-module selections must retain stable target/source identities so a module update cannot silently retarget a Character to a different same-named subclass/species/choice option.

## 10. Scenario-driven evolution

After the first vertical slice, new common abstractions require a concrete scenario.

Process:

1. Reproduce the table situation as a deterministic fixture.
2. Confirm whether existing primitives can express it cleanly.
3. If not, add the smallest missing common primitive/operator/TimingPoint.
4. Update spec/schema/capabilities.
5. Add migration/compatibility behavior if persisted data changes.
6. Run all existing golden scenarios.
7. Update UX only where the new domain capability requires it.

This is preferred over speculative generic architecture.

## 11. Golden scenario format

The rules engine should be tested primarily with deterministic domain scenarios.

A fixture should be able to specify:

- RulesProfile/module versions/capabilities;
- module/content relationship graph where relevant;
- initial Character/Combatant/session state;
- active RuleSources/ItemInstances/EffectInstances;
- ActionRequest;
- explicit targets;
- explicit dice outcomes;
- explicit user/DM choices;
- expected provenance;
- expected StateChanges;
- expected ResolutionEvent shape;
- expected final state.

## 12. Required early scenarios

At minimum cover:

1. AC from multiple RuleSources, including one suppressed contribution.
2. Attack with advantage/disadvantage cancellation and additional attack die.
3. Critical hit with flat modifiers not incorrectly doubled.
4. Typed damage with resistance, temp HP, and final HP.
5. Save-based multi-target Action with mixed success/failure.
6. Reaction that changes AC before final hit determination.
7. Cancelled reaction consumes nothing.
8. Item use spends charge/quantity atomically with the effect.
9. EffectInstance refresh/replace/expiry behavior.
10. Freeform resource-consuming Activity without persistent turn economy.
11. Freeform -> Initiative -> Freeform preserving durable state.
12. DM force miss -> hit while preserving calculated/adjudicated outcomes.
13. Undo restoring economy/resource/item/HP/effect together when safe.
14. Duplicate ResolutionEvent application is a no-op.
15. Reconnect from an event cursor applies only missing events.
16. Character progression applies deterministic grants and asks only new choices.
17. Unsupported imported rule remains explicit rather than partially executing.
18. Homebrew subclass contributes to a builtin class subclass choice without changing the base module.
19. Two compatible modules add independent options to one ChoiceDefinition extension point.
20. Standalone homebrew species and a variant attached to an existing species both resolve through ContentCatalog.
21. Subclass progression contribution activates against the parent class ProgressionTrack at the expected threshold.
22. Missing parent/extension target disables or rejects only the affected content with a useful diagnostic.
23. Competing explicit replacements produce a deterministic conflict rather than load-order behavior.
24. Content relationship cycle is rejected.
25. Character preserves exact module/version/content identity for extension content across save/load.
26. Session-only extension content does not silently become a durable Character dependency.

## 13. Undo symmetry tests

Where a transaction is marked cleanly reversible:

```text
State A
-> ResolutionEvent
State B
-> reversal event
State A-equivalent
```

must hold for all reversible StateChanges.

If later events depend on the changed state, the system must reject unsafe reversal and require correction instead.

## 14. Determinism tests

Given the same:

- versions/capabilities;
- module/content relationship graph;
- snapshots;
- ActionRequest;
- dice;
- Choices;
- DM adjudication;
- authoritative ordering;

the engine must produce the same catalog resolution and the same outcome/provenance/StateChanges.

Visual dice state is never an input to deterministic rules tests.

## 15. Migration tests

Persisted user-created content deserves explicit migration coverage.

Test:

- old Character -> current model;
- old RuleModule -> validation/migration or clear incompatibility;
- old cross-module selection -> current relationship graph or explicit review;
- old CombatantDefinition -> current model;
- old event/log -> supported read/replay/inspection behavior;
- unknown future fields -> safe preservation/rejection according to policy.

## 16. Failure/recovery UX

Design and tests must cover:

- local save failure;
- corrupted Character file;
- invalid RuleModule/Combatant/item JSON;
- missing module/version;
- missing parent/extension-point target;
- relationship cycle/conflict;
- unresolved required ChoiceDefinition;
- unsupported mechanic;
- stale ActionRequest;
- failed mode transition;
- reconnect mismatch;
- PendingResolution cancellation/invalidation;
- authoritative event applied but not yet persisted locally.

No error path should leave a half-applied transaction.

## 17. Networking boundary

WebSocket is transport, not rules architecture.

Transport handlers should not contain rule calculations. The protocol eventually carries/acknowledges concepts such as:

- session handshake/capabilities;
- Character/SessionProjection revisions;
- snapshots;
- ActionRequests;
- ResolutionEvents;
- event cursors/acknowledgements;
- Choice/reaction messages;
- session module transfer/mount metadata.

The domain semantics remain testable without a network.

## 18. Fast UX experimentation

UI experiments should not invalidate saved data.

Prefer:

- view-model/adaptor layers;
- domain commands over component-local mutation;
- development feature toggles when useful;
- local debug traces and scenario fixtures;
- accessibility/reduced-motion choices independent from rules semantics.

Feature flags are not alternate permanent rules engines.

## 19. Content/licensing boundary

The generic engine and schemas must not require bundling proprietary rules text/content.

Before shipping a default content module, document which rules data/text can be redistributed and which content must remain user-supplied or externally authored.

Mechanics architecture remains independent from a particular proprietary dataset.

## 20. MVP non-goals

Do not add merely for extensibility:

- arbitrary JavaScript/native plugin runtime;
- marketplace/plugin SDK;
- automatic Internet module download;
- cloud sync/account infrastructure;
- requirement that all internal TypeScript details remain backward-compatible forever.

## 21. Cross-module content extension contract

The normative contract is `docs/rules/content-relationships.md`.

The architectural test for this feature is simple:

> Can a new compatible module add a subclass, species variant, ChoiceDefinition option, or progression contribution to existing content without modifying the original module, without React-specific wiring, and without load-order-dependent behavior?

If not, the ContentCatalog/relationship boundary is too rigid.
