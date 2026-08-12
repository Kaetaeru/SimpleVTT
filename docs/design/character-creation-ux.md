# Character Creation and Editing UX

Status: Draft for Issue #5

## Product goal

Character creation should feel like preparing a playable character, not filling out a database.

The user should enter decisions and source values once. SimpleVTT should derive dependent values, preserve where each value came from, and produce a Character that is immediately usable by the combat resolver.

The default experience should be understandable for a first-time user while still giving experienced users a fast path that avoids a long mandatory wizard.

## UX principles

### Enter sources once

Do not ask the user to repeatedly enter values that can be calculated from existing data.

Examples:

- ability score -> ability modifier;
- chosen proficiency -> applicable proficiency contribution;
- selected armor/equipment/effects -> derived AC contribution;
- action sources -> attack/save/damage data used by combat;
- class/level/profile data -> derived resources or rule-dependent values where supported.

If a derived value is unusual, the user should override it explicitly instead of replacing the underlying source silently.

### Progressive disclosure

The default path shows only the decisions required at the current step.

Rare, optional, homebrew, or advanced fields remain available through expandable sections or an Advanced control. They should not dominate the initial experience.

### Creation is never fragile

A new Character becomes an autosaved draft after the first meaningful input.

The user may close the app, navigate away, or switch modes and resume later without losing progress.

### Guided and expert flows share one model

Guided creation and quick/manual creation are two views over the same Character draft. They must not create incompatible data shapes or require conversion between modes.

A user can start guided, switch to quick edit, then return to guided review if desired.

### Derived math is visible but not noisy

Derived values should normally show the final result first.

Example:

`AC 17`

An expansion can show:

`Base 10 + DEX 3 + Armor 4 = 17`

The user should not need to understand that breakdown to continue, but it must be available for trust, debugging, homebrew, and later combat explanations.

### Character authoring feeds combat directly

Creation is not followed by a second combat-setup form.

If a weapon, spell, feature, item, or other source creates an Action, Effect, Modifier, or Resource, the Character should already contain the structured data needed by the resolver.

## Entry screen

The Character library should expose a small set of clear entry paths:

- **Create Character** — guided creation.
- **Quick Create** — compact expert-oriented editor.
- **Import Character** — load a supported local Character file once the Character contract is versioned.
- **Duplicate** — clone an existing local Character into a new draft.

Existing drafts should appear separately from completed Characters so incomplete work is easy to resume and does not look accidentally finished.

Example:

```text
Characters

Aelar          Lv 5   Ready
Mira           Lv 3   Ready

Drafts
New Character         62%   Continue

[Create Character] [Quick Create] [Import]
```

## Guided creation shell

The guided experience should use a stable shell rather than a chain of unrelated pages.

Recommended layout:

```text
Character Creation

1 Rules   2 Identity   3 Build   4 Abilities   5 Details   6 Actions   7 Review
──────────────────────────────────────────────────────────────────────────────

Current step content

                                               Live summary
                                               Name
                                               Level
                                               AC
                                               HP
                                               Key abilities
                                               Warnings

[Back]                                             [Save state] [Continue]
```

The exact step labels and fields may change by RulesProfile. The shell and interaction rules remain stable.

## Step 1 — Rules profile

Choose the supported D&D RulesProfile before edition-specific derivation or validation occurs.

The profile determines:

- available fields and terminology;
- legal build choices;
- ability generation methods;
- proficiency/save logic;
- derived-stat formulas;
- critical/damage and other calculation rules;
- validation requirements;
- which rule-content packs, if any, can provide prefilled options.

Changing RulesProfile after substantial data exists should require a review because some fields may no longer map cleanly.

## Step 2 — Identity

Keep this short.

Required by default:

- character name.

Optional descriptive data should not block progress unless the RulesProfile explicitly requires it.

Examples:

- portrait;
- player-facing notes;
- appearance;
- alignment or similar descriptive metadata when relevant.

## Step 3 — Core build choices

The RulesProfile defines the actual concepts, such as class, level, species, background, subclass, ancestry, or equivalent choices.

When rule content is available, use searchable cards/pickers rather than huge dropdowns.

A selection should immediately show what it contributes:

```text
Selected source

Grants
- Save proficiency: CON, WIS
- Resource: Example Resource 3/3
- Action: Example Strike
- Effect: +1 AC while condition X applies
```

The user should not need to manually recreate those contributions elsewhere.

When bundled rule content is unavailable, the same source concept may be entered manually as structured Character data.

## Step 4 — Abilities

The RulesProfile decides available entry methods.

Potential modes include:

- direct/manual values;
- standard array;
- point allocation;
- rolled values.

Do not hard-code a method until the initial RulesProfile is chosen.

The UI should show the derived modifier immediately next to each score and update dependents live.

Example:

```text
STR  16   (+3)
DEX  14   (+2)
CON  14   (+2)
INT  10   (+0)
WIS  12   (+1)
CHA   8   (-1)
```

Changing a score should automatically update every dependent calculation instead of asking the user to repair each field.

## Step 5 — Proficiencies, defenses, HP, movement, and other derived details

Default values should be calculated or prefilled from the selected sources and RulesProfile.

The main UI should show final values with their origin status:

- **Calculated** — derived entirely from known sources;
- **Chosen** — the user selected one of several legal options;
- **Manual** — directly entered because no derivation exists;
- **Overridden** — the user intentionally replaced a computed result.

Example:

```text
Armor Class
17  Calculated
Base 10 + DEX 3 + Armor 4
[Override]
```

### Override behavior

An override must never look like an ordinary calculated value.

When creating one, capture:

- override value;
- optional reason/source label;
- original calculated value;
- timestamp or revision metadata if the Character format supports it.

Example:

```text
Armor Class
19  OVERRIDDEN
Calculated value: 17
Reason: Homebrew blessing
[Remove override]
```

Removing the override immediately returns to the current calculated value.

## Step 6 — Features, equipment, actions, resources, spells, and effects

This is the most important bridge between creation and combat.

Each source should be capable of contributing structured domain objects rather than only descriptive text.

A source may contribute:

- one or more Actions;
- passive or active Effects/Modifiers;
- Resources;
- typed damage components;
- saving-throw behavior;
- costs;
- conditions;
- equipment properties;
- descriptive text for human reference.

### Compact source cards

Default view should summarize what matters in play.

```text
Longsword
Attack   +7
Damage   1d8 + 4 slashing
[Edit details]
```

The detailed editor may expose structured fields and advanced Effect configuration, but a normal user should not be forced to understand the internal resolver schema for common content.

### Rule-content-assisted authoring

When a permitted rule-content pack exists, selecting an item should prefill its structured behavior.

When it does not exist, provide reusable templates for common patterns such as:

- attack + damage;
- save + full/half damage;
- healing;
- passive modifier;
- limited resource action;
- effect application.

This keeps manual/homebrew authoring usable without requiring raw JSON.

## Step 7 — Review

The review page should answer two questions:

1. Can this Character be finalized safely?
2. Is it ready to use in combat without another setup pass?

Recommended sections:

- identity and build summary;
- abilities and key derived values;
- defenses / HP / movement;
- proficiencies/saves/skills as relevant;
- actions;
- resources;
- active/passive source effects;
- manual fields;
- overrides;
- validation findings.

Validation items should be clickable and navigate directly to the relevant field or section.

## Validation severity

### Blocking error

The Character cannot be finalized because required or structurally invalid information is missing.

Examples:

- missing required RulesProfile field;
- unresolved mandatory choice;
- broken reference from an Action to a required Resource;
- invalid formula/data shape that the resolver cannot consume.

### Warning

The Character can be saved/finalized, but something unusual or incomplete may affect expected behavior.

Examples:

- action has descriptive text but no structured combat effect;
- manual override differs significantly from the current calculated value;
- optional but commonly useful combat information is missing.

### Info

Non-critical guidance.

Examples:

- optional portrait missing;
- an unused resource exists;
- a section can be completed later.

## Autosave and draft behavior

Creation and normal editing use local autosave.

Recommended state indicator:

- `Saving...`
- `Saved`
- `Save failed — Retry`

Rules:

- save after meaningful edits with debounce rather than on every keystroke write;
- keep the last known-good local version when a write fails;
- do not silently discard an invalid draft;
- allow a draft to contain incomplete data that would not pass finalization validation;
- distinguish draft validity from storage validity.

The Character library should offer resume/delete/duplicate for drafts.

## Quick/manual creation

Experienced users should not be forced through every wizard step.

Quick Create presents the same underlying sections in a single scrollable or tabbed editor with a sticky summary/validation panel.

Recommended behavior:

- sections can collapse;
- keyboard navigation is efficient;
- derived values update immediately;
- unresolved required choices remain visible in the validation panel;
- user may switch to Guided Review at any time.

Quick Create is not a raw JSON editor.

## Editing after creation

The finalized Character uses the same section components as creation where practical.

Editing a source value should recalculate dependents immediately.

Example:

```text
DEX 14 -> 16

Affected values
AC        16 -> 17
Initiative +2 -> +3
Longbow    +6 -> +7
DEX save   +4 -> +5
```

This change preview is especially useful when multiple combat-relevant values move at once.

The user should not have to confirm routine deterministic recalculation. Explicit overrides that are affected should be highlighted for review.

## Source attribution

Every value that can appear in a calculation breakdown should retain enough provenance to explain itself.

Example internal concept:

```text
Attack modifier +8
- DEX modifier        +4   [Ability]
- Proficiency         +3   [RulesProfile]
- Magic Weapon        +1   [Equipment: Bow +1]
```

Creation/editing UX should preserve these sources so combat logs can later answer the same question without inventing attribution after the fact.

## Character import

Once the Character format is versioned, Import should follow a similar safety pattern to Combatant import:

1. choose a local Character file;
2. structural validation;
3. semantic validation;
4. review summary;
5. show migration requirements if the schema version is old;
6. import into local library as a new Character/draft;
7. never overwrite an existing Character silently.

AI-assisted Character generation may be considered later, but it is not required for the first Character UX design.

## Accessibility and interaction quality

- full keyboard navigation for standard controls;
- clear focus state;
- labels not dependent on color alone;
- screen-reader-friendly validation messages and field relationships;
- reduced-motion support;
- no required drag-and-drop interactions;
- predictable Back/Forward behavior that never loses data.

## Product boundary

Character creation should be powerful enough to prepare combat-ready data but should not become a full character-building rules encyclopedia.

SimpleVTT may use legal/permitted rules data packs or manually authored structured data, but the UX architecture must not depend on bundling a large proprietary content database.

## Acceptance scenarios

The design/implementation should eventually demonstrate:

1. A new user completes a basic valid Character through Guided Creation without opening advanced fields.
2. An experienced user creates the equivalent Character through Quick Create without a mandatory step-by-step flow.
3. A draft survives app restart and resumes at the same logical point.
4. Changing an ability automatically updates visible dependent values.
5. A calculated value can be inspected source-by-source.
6. A manual homebrew override is visually distinct and reversible.
7. Final Review links directly to every blocking issue.
8. A finalized Character already contains structured Actions/Effects/Resources consumable by the combat resolver.
9. Editing a Character after creation uses the same mental model and does not require rebuilding combat data separately.
