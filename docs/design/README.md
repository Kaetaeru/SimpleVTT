# SimpleVTT Design Canon

Status: canonical design baseline for pre-implementation work

This directory contains the current product and architecture decisions for SimpleVTT. Older stacked design PRs are superseded by this consolidated baseline.

## Product definition

SimpleVTT is a local-first D&D play assistant focused on removing routine arithmetic and rules-state bookkeeping while preserving player and DM decisions.

The product is not trying to become a full general-purpose VTT. It deliberately excludes battle maps, tokens, fog of war, chat, cloud accounts, social features, and large proprietary rules databases unless a later concrete need justifies them.

The target play loop is:

1. Prepare a Character and rule content locally.
2. Join or host a LAN/Hamachi session.
3. Select a target and an Action.
4. Answer only choices that require a human decision.
5. Let the rules engine resolve known arithmetic, state, timing, resources, and legality.
6. See a compact result with expandable provenance.
7. Keep shared session state synchronized and durable Character-owned state written back locally.

## Non-negotiable principles

### Automate arithmetic, preserve choices

The engine should calculate every deterministic consequence it can. Reactions, optional resource spending, target choices, ambiguous rulings, and other genuine decisions remain explicit.

### Every important value is explainable

A resolved value is not just a number. It is a value plus provenance.

Example:

```text
AC 14

Base                         10
Leather Armor                +2
Magic Effect                 +2
Suppressed Shield Effect     +2  (not applied: stacking rule)
```

Character UI, action previews, activity logs, debugging tools, and imported-content previews all reuse the same provenance records.

### Rules content is declarative

Feats, spells, class/species/background features, items, conditions, effects, Combatants, and homebrew content use shared declarative contracts. Imported JSON cannot execute arbitrary JavaScript, shell, native code, or scripts.

Unknown mechanics are reported as `unsupported`; the engine does not silently approximate them.

### Rule content composes across modules

Builtin rules, expansion-style modules, local homebrew, and DM session modules use the same ContentCatalog and RuleSource pipeline.

A module may add standalone content or contribute to content owned by another module without rewriting that module. Cross-module composition uses stable declarative relationships such as `parent`, `extends`, and explicit `replaces`, plus ChoiceDefinition option and ProgressionTrack contributions.

Examples include a homebrew subclass attached to an existing class, a new species variant attached to an existing species, or an expansion module adding an option to an existing feature choice. The normative relationship/contribution contract is `docs/rules/content-relationships.md`.

### UI does not own rules

React components render domain state and collect user decisions. They do not contain hidden edition-specific arithmetic, named spell/feat logic, stacking rules, or lifecycle semantics.

### Permanent ownership and runtime authority are separate

The player owns the permanent Character and local library. During a connected session, the DM host is authoritative for the shared ordered session state and committed ResolutionEvents. Character-owned durable runtime changes are written back to the player after authoritative confirmation.

### One runtime event model

Freeform exploration, initiative play, attacks, healing, item use, rests, DM corrections, resource changes, and effect expiry use one `ResolutionEvent` / typed `StateChange` model. `CombatEvent` is obsolete terminology.

### Freeform and Initiative share one engine

`Freeform` has no turn/round/initiative requirement. `Initiative` adds explicit ordering, turns, rounds, and RulesProfile-defined economy enforcement. Both use the same RuleSource, Predicate, Timing, Action, Resource, Effect, Resolution, provenance, and event systems.

### Change should stay cheap

Use versioned contracts, registries, descriptors, scenario tests, and declarative composition. Do not build a general executable plugin runtime for MVP. New primitives are added only when a real play scenario demonstrates the need.

## Canonical documents

- `docs/design/ui-ux-planning-framework.md` — canonical owner-friendly and AI-readable UI/UX planning, decision, handoff, and verification framework.
- `docs/rules/README.md` — Common Rule Definition Specification v0.x draft.
- `docs/rules/content-relationships.md` — normative cross-module `parent` / `extends` / `replaces`, Choice option contribution, and progression contribution semantics.
- `docs/design/character-lifecycle.md` — Character creation, editing, progression, revision, and local ownership.
- `docs/design/content-modules-items.md` — RuleModule, ContentCatalog, RuleSource import, inventory, ItemDefinition, and ItemInstance.
- `docs/design/session-runtime.md` — state lifetimes, authority, Freeform/Initiative, targeting, ResolutionEvent, EffectInstance, and DM adjudication.
- `docs/design/combat-ux.md` — action-first player UX, authoritative dice presentation, activity log, breakdowns, and Undo.
- `docs/design/extensibility-testing.md` — extension seams, capabilities, compatibility, migration, and golden-scenario testing.
- `docs/design/movement-modules.md` — canonical mapless-Core policy, optional 2D/3D movement-module seam, and current-turn-controller manual movement-triggered reaction policy.
- `docs/guides/combatant-json-import.md` — Combatant authoring/import workflow.
- `schemas/combatant.schema.json` — current draft structural Combatant contract.

## Core domain vocabulary

### Definition/content layer

- `RulesProfile` — edition/ruleset policy: formulas, stacking, economy, timing interpretation, progression semantics, recovery policy, and validation.
- `RuleModule` — portable content package.
- `ContentEntry` — stable catalog-visible content unit supplied by a RuleModule.
- `ContentRelationship` — stable cross-content relation such as `parent`, additive `extends`, or explicit `replaces`.
- `ExtensionPoint` — stable target through which compatible modules may contribute options/content without copying the target definition.
- `ContentCatalog` — merged view of enabled compatible content and resolved cross-module contributions.
- `RuleSource` — stable source of one or more mechanics: feat, spell, item feature, class feature, condition, situational rule, and similar.
- `ItemDefinition` — reusable content definition for an item.
- `CombatantDefinition` — reusable stat-block-like content definition.

### Character/runtime layer

- `Character` — player-owned durable source choices plus durable runtime state.
- `ItemInstance` — one owned item instance with mutable state such as quantity, charges, configuration, and activation state.
- `CombatantState` — mutable encounter/session instance created from a CombatantDefinition.
- `EffectInstance` — runtime effect created from a RuleSource/Action with source, target, duration, scope, and stacking identity.
- `SessionProjection` — host-facing representation of a connected Character; never a second permanent Character file.

### Rules execution layer

- `Property` — stable addressable rules value such as `defense.ac` or `ability.dex.modifier`.
- `Expression` — restricted declarative arithmetic tree.
- `Predicate` — restricted declarative condition tree.
- `TimingPoint` — stable event/timing identifier.
- `Mechanic` — typed operation that changes or grants rules behavior.
