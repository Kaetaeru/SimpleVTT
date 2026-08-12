# Combat Automation UX

Status: Draft for Issue #3

## Product goal

SimpleVTT exists to remove routine D&D combat arithmetic while preserving player and GM decisions.

The normal combat interaction should approach:

1. Select a target.
2. Select an action.
3. Answer only choices that materially require a player or GM decision.
4. Watch the dice/result presentation.
5. See the resulting state change.
6. Expand the result only when the calculation needs inspection.

The user should not need to manually add attack bonuses, effect dice, target AC adjustments, resistance, temporary HP, or similar routine arithmetic during this flow when the relevant data already exists in the system.

## UX principles

### Automate arithmetic, not decisions

The resolver should calculate deterministic consequences from known rules and active data. Optional reactions, optional resource spending, target choices, and other game decisions remain explicit user choices.

### Never make automation a black box

Every final result must be explainable. A user must be able to inspect which base values, dice, effects, defenses, conditions, and rule steps produced the result.

### Keep the primary combat surface small

During play, actions and current combat state should be more prominent than the full edit form of the character sheet.

A typical player combat surface should prioritize:

- current HP / temporary HP;
- AC and other frequently referenced defenses;
- active effects and conditions;
- selected target;
- frequently used actions;
- current resources;
- the recent roll/combat log.

The complete character sheet remains available for inspection and editing but should not be required for every combat action.

### Dice presentation and dice truth are separate

The rules engine determines the dice result. The visual dice experience renders that already-determined result.

The animation must never independently generate a second result. This guarantees that the same event can be logged, synchronized, replayed visually, and inspected consistently.

Animation should be skippable and should respect reduced-motion preferences.

## Data ownership

### Character

The permanent Character source belongs to the player's local application.

The player can create and edit it without a session. Joining a session creates a session projection containing only the data required for shared play.

### DM session host

The DM host owns temporary encounter/session state, including:

- encounter Combatants;
- active session effects and conditions;
- event ordering;
- shared combat history;
- temporary projections of connected player characters.

The DM host does not become the permanent owner of player Character files.

### Combatant Definition and Combatant State

A Combatant Definition is the reusable stat-block-like source data used to instantiate an encounter participant.

A Combatant State is the mutable encounter instance, including current HP, temporary HP, consumed resources, active effects, conditions, and other session-only changes.

JSON import creates or updates a Combatant Definition. Starting or adding an encounter creates a Combatant State from that definition.

## Core domain concepts

### Action

An Action describes a resolvable operation such as:

- attack roll and damage;
- saving throw and damage/effect;
- healing;
- resource use;
- application/removal of an effect;
- utility/custom action that still produces structured events.

The engine should not require branches such as `if spellName === "..."`. Named spells/features should be data composed from generic action/effect primitives.

### Effect / Modifier

Effects may come from spells, features, equipment, conditions, the environment, or temporary encounter state.

The initial primitive set should be able to express at least:

- flat numeric add/subtract;
- additional dice;
- advantage/disadvantage;
- replace/set value;
- minimum/maximum value;
- multiplier;
- typed damage addition;
- resistance/immunity/vulnerability;
- condition application/removal;
- resource increase/decrease;
- duration/expiry;
- source attribution;
- timing/trigger such as passive, before roll, after roll, on hit, on damage, turn start/end, successful/failed save.

An effect must carry enough source information for the calculation breakdown to explain why it applied.

### Resolution

A Resolution is a deterministic calculation transaction over fixed input snapshots plus generated dice results and explicit user choices.

A resolution should not mutate live state incrementally without recording what happened. It should produce a structured result containing the state changes that are then committed together.

### CombatEvent

A committed Resolution becomes one or more ordered CombatEvents with stable IDs.

Events are the basis for:

- shared combat history;
- duplicate protection during reconnect;
- Roll/Combat log cards;
- debugging and calculation inspection;
- transaction-style undo where safe;
- later network synchronization.

## Resolution pipeline

The exact rules profile may adjust details, but the architecture should preserve a clear sequence.

1. **Create snapshots** of actor, target(s), action, relevant session state, and active effects.
2. **Collect applicable modifiers/effects** from actor, targets, action, environment, and session.
3. **Resolve pre-roll choices** that materially require user input.
4. **Build the roll plan** including advantage/disadvantage and extra dice.
5. **Generate authoritative dice results** once.
6. **Evaluate the roll** and compare against the applicable target value.
7. **Offer reaction/interrupt choices** when the rules profile permits the result to be changed before commitment.
8. **Re-evaluate affected comparisons** if an interrupt changes the state used by the resolution.
9. **Build outcome components**, including critical rules and typed damage/healing/effects.
10. **Apply target-side modifiers**, including resistance/immunity/vulnerability and other conditional defenses.
11. **Calculate state changes**, including temporary HP, HP, resources, conditions, and effects.
12. **Produce calculation breakdown + event transaction**.
13. **Commit the transaction** and publish the visual/log result.

This ordering must be explicit in code and tests; it must not be an accidental result of UI component order.

## Choice and reaction UX

A resolution may temporarily enter `awaiting_choice` instead of committing.

Example:

- Attack total is known.
- Target would be hit against current AC.
- A reaction can modify AC.
- The target's owner is offered the reaction.
- If declined, the original calculation continues.
- If accepted, the affected defense is recalculated and the resolution continues from the defined interrupt point.

The UI should clearly show why the choice appeared, what resource it consumes, and what immediate value it changes when that information is allowed to be visible.

## Dice UX

The dice surface should feel immediate rather than ceremonial.

Recommended behavior:

- action click creates a pending roll card immediately;
- visual dice begin rolling while the already-authoritative result is being presented;
- individual die faces/results remain visible after the animation;
- natural critical/failure results receive distinct treatment without hiding the arithmetic;
- a user may skip or shorten animation;
- multiple dice may be visually grouped by purpose/damage type;
- the animation state is never the source of truth.

## Roll / Combat log

Use a compact activity feed inspired by the usefulness of Roll20/FVTT logs, without copying their UI.

### Collapsed card

A collapsed result should normally show:

- actor;
- action name;
- target(s);
- primary dice result(s);
- final attack/save/skill total when applicable;
- hit/miss/save outcome;
- final damage/healing/state summary.

Example structure:

`Aelar — Longsword → Training Brute`

`Attack 17 + 7 + Bless 3 = 27 — Hit vs AC 18`

`Slashing 9 + Fire 6 → Fire resistance 3 — 12 total`

`Temp HP 5 → 0, HP 24 → 17`

### Expanded calculation detail

Expansion should show ordered sources, not only a flattened formula.

For an attack it may contain:

- d20 faces rolled and which one was selected;
- advantage/disadvantage sources and cancellation;
- base attack modifier;
- proficiency/equipment/feature/effect contributions;
- target defense base and active modifiers;
- critical determination;
- each damage component and dice faces;
- resistance/immunity/vulnerability decisions by damage component;
- temporary HP handling;
- final HP/resource/effect changes;
- source references for every applied modifier.

The detail should make questions such as “Why was this +11?” or “Why was fire damage halved?” answerable without recalculating by hand.

## Undo

When one completed action changes several pieces of state, the user should be able to undo the committed transaction rather than manually repair every field.

A transaction should record before/after values for changed session state. Undo must itself be an event so every connected client can converge on the same result.

Undo is not required to rewrite permanent source files that were independently edited outside the session.

## Combatant import UX

DM flow:

1. Choose **Import Combatant JSON**.
2. Select/paste a JSON file.
3. Validate against the versioned schema.
4. Show errors and warnings before activation.
5. Show a review summary of calculation-relevant values and actions.
6. Save as a local reusable Combatant Definition or add directly to the current encounter.
7. Instantiate encounter state from the reviewed definition.

Import must never silently accept unknown executable behavior. The format is declarative JSON only.

## AI-assisted authoring

AI is an optional external authoring aid, not a runtime dependency.

The repository should provide:

- a JSON Schema;
- a blank template;
- a complete example;
- a human-readable guide;
- a copyable prompt pattern.

A user can provide a stat block plus these materials to an AI, receive JSON, then validate and review it locally before use.

AI-generated JSON must not bypass validation.

## Required design scenarios

Before implementation is considered ready, tests and/or design examples must cover:

1. Attack with an additional attack-roll die, simultaneous advantage and disadvantage, extra typed damage, target resistance, temporary HP, and final HP change.
2. Saving-throw action with half damage on successful save.
3. Reaction that changes AC after an initial attack result and forces the hit comparison to be re-evaluated.
4. Critical hit that changes the correct damage dice without incorrectly multiplying flat modifiers.
5. Multiple active effects where every applied source appears separately in calculation detail.
6. Valid Combatant JSON import and review.
7. Invalid Combatant JSON with actionable validation errors.
8. Rebuilding the visible log card entirely from stored event/resolution data.

## Rules profile boundary

SimpleVTT should not scatter edition-specific math throughout UI components.

A `RulesProfile`/rules adapter should own edition-specific decisions such as derived modifiers, critical behavior, rounding rules, and other rules that may differ by supported ruleset.

The exact initial D&D rules version must be explicitly chosen before implementation of those rule-specific calculations.

## Non-goals

This design does not require:

- map/token/fog-of-war features;
- voice or text chat;
- cloud accounts;
- a bundled proprietary monster/spell library;
- an AI model running inside SimpleVTT;
- replacing a full VTT.
