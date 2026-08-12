# Character Lifecycle and Authoring

This document defines the canonical UX and data boundaries for Character creation, editing, progression, revision, and local ownership.

## 1. Character ownership

The permanent Character belongs to the player and is stored locally.

A Character contains two durable categories:

### Character source data

Choices and inputs required to reproduce the build:

- identity;
- RulesProfile identity/version;
- progression selections/tracks;
- class/species/background/feat/spell and similar content selections;
- ChoiceDefinition selections;
- permanent ItemInstances/inventory;
- explicit permanent overrides;
- module/source identity/version references.

### Character durable runtime state

Mutable values that persist across normal sessions when rules say they do:

- current HP;
- persistent resources;
- consumable quantities;
- item charges/configuration;
- persistent Character-bound EffectInstances/conditions where supported.

Derived totals such as AC, attack modifiers, save DCs, and action availability are reproducible and are not the canonical source of truth.

## 2. Creation entry modes

The Character library should support:

1. **Guided Create** — progressive, profile/content-driven steps.
2. **Quick Create** — expert-oriented section view without a mandatory wizard.
3. **Import** — validated Character file/JSON when the Character schema exists.
4. **Duplicate** — clone an existing Character into a new draft.

Guided and Quick Create are two views over the same autosaved Character draft.

## 3. Creation UX principles

### Enter source values once

If a value can be derived from source choices + RulesProfile + RuleSources, do not ask the user to type it again.

Changing a source value recalculates dependents immediately.

Example:

```text
DEX 14 -> 16

Affected values
AC           16 -> 17
Initiative   +2 -> +3
Longbow      +6 -> +7
DEX Save     +4 -> +5
```

### Deterministic grants are automatic

Selecting content such as a class/species/background should automatically apply grants that contain no real decision.

Only actual choices appear as ChoiceDefinitions.

Example:

```text
Class selected

Automatically granted
✓ proficiencies
✓ resource
✓ feature A

Choose one
[Option A] [Option B] [Option C]
```

### Progressive disclosure

New users should not see every advanced field at once. Advanced fields and raw mechanical details remain inspectable but do not dominate the default path.

### Always resumable

The first meaningful input creates an autosaved draft. Closing the application never requires discarding incomplete work.

Suggested status:

```text
Saved
Saving…
Save failed
```

A failed write preserves the last valid revision.

## 4. Guided flow

The exact steps are RulesProfile-driven, but the default shape is:

1. RulesProfile.
2. Identity.
3. Core build/progression choices.
4. Ability/source values.
5. Derived proficiencies/saves and unresolved choices.
6. HP/defenses/movement/resources.
7. Features/actions/spells/equipment/items.
8. Review.
9. Commit Character revision.

The builder queries the active ContentCatalog. Named class/species/feat lists are not hard-coded in React.

The resolved ContentCatalog may contain builtin entries plus compatible additions from expansion-style modules, local homebrew, and session modules. If an external module adds a subclass, species variant, feature option, or progression contribution through the content-relationship contract, it appears in the same Guided/Quick flow as native content.

## 5. Source, derived, contribution, override

The UI distinguishes:

- **source** — chosen/entered durable input;
- **derived** — calculated property;
- **contribution** — RuleSource mechanic affecting a property/result;
- **override** — explicit exceptional RuleSource, never silent flattened mutation.

Derived values are normally read-only in the primary editor and provide an expandable provenance breakdown.

An override should show:

- computed value without override;
- overridden value;
- source/authority;
- reason when provided;
- scope/lifetime.

## 6. Final review and validation

Validation levels:

- **Blocking error** — cannot commit/finalize.
- **Warning** — unusual or incomplete, but still saveable when safe.
- **Info** — optional guidance.
- **Unsupported** — content/mechanic cannot currently execute correctly.

Review surfaces should link directly to the source section/choice that needs attention.

Final review summarizes:

- unresolved required choices;
- major derived properties;
- active RuleSources;
- Actions/Reactions;
- Resources;
- inventory/loadout;
- explicit overrides;
- unsupported/warning state.

## 7. Character must be action-ready

Finishing Character creation must not create a second setup job for combat.

The Character source graph must already be able to derive:

- abilities and profile-defined modifiers;
- saves/skills;
- HP/defenses/movement;
- Actions/Reactions/Activities;
- typed damage/healing components;
- Resources/costs;
- passive/active RuleSources;
- inventory-provided mechanics;
- activation state;
- provenance.

If a weapon attack formula is already represented by the Character's RuleSources and item data, the user must not re-enter it on the combat screen.

## 8. Editing after creation

Creation and editing share the same section mental model.

Editing a source value:

1. modifies Character source data;
2. validates references/choices;
3. recalculates dependent properties/actions;
4. shows affected values when useful;
5. safely persists a new local revision;
6. updates SessionProjection only after connected-session compatibility checks.

## 9. Progression and level-up

Progression is not hard-coded as one global level integer. The RulesProfile may define one or more ProgressionTracks.

Examples include overall progression, class progression, subclass progression, or campaign-specific milestone tracks.

### Progression workflow

```text
Current Character revision
+ proposed ProgressionTrack change
+ RulesProfile/modules
+ newly required choices
-> ProgressionDraft
-> derive grants/replacements/property changes
-> before/after review
-> commit new Character revision
```

The live finalized Character does not change until commit.

### Automatic progression behavior

At a threshold, content may:

- activate new RuleSources;
- grant Actions/Resources/permissions;
- change resource maxima;
- replace/supersede earlier RuleSources;
- create new ChoiceDefinitions;
- unlock catalog options.

Deterministic changes are automatic. Only real choices are presented.

Progression resolution includes compatible cross-module progression contributions. A subclass or optional-rules module can attach grants/choices to an existing progression context without duplicating the parent progression definition.

### Review

Level-up review should show meaningful source-level changes, for example:

```text
Progression             4 -> 5
New RuleSource          Feature X
New Action              Action Y
Resource max            3 -> 4
Attack                   +7 -> +8
Save DC                  15 -> 16
Required choice          choose 1
```

Every change links back to module/source/provenance.

When multiple modules contribute to the same level-up, the review should group changes by source where useful while still presenting one coherent Character revision.

### HP/resource current value policy

When progression changes a maximum, the UI does not guess how current values change. RulesProfile policy defines whether current HP/resource stays, increases, recovers, clamps, or requires a choice.

## 10. Revision model

Persisted Character identity should separate concerns where useful:

- stable Character ID;
- source/build revision;
- durable runtime-state revision;
- schema version;
- RulesProfile/module identity/version set.

A source/build revision changes when the build/source graph changes. Runtime HP/resource changes need not imply the same kind of build revision.

## 11. Active-session edits

While connected:

- the Character remains player-owned;
- source edits save locally first;
- unresolved choices or incompatible modules block SessionProjection update;
- a valid new revision is negotiated/projected to the host;
- authoritative shared runtime outcomes remain ordered by the host session.

Level-up during a session follows the same rule. The UI may recommend doing it outside an active encounter, but the architecture does not require that restriction.

## 12. Session write-back

Confirmed shared ResolutionEvents may change Character-owned durable runtime state such as HP, resources, item charges, or consumable quantities.

Those changes are written back locally after authoritative confirmation.

Session-only state never silently becomes permanent Character source data.

A DM permanent grant/boon/item uses an explicit durable-grant workflow rather than masquerading as a temporary session effect.

## 13. Failure/recovery UX

The player should see actionable states, not distributed-system jargon:

- Saved locally.
- Session synchronized.
- Reconnecting.
- Session changes not yet saved locally.
- Character changed locally — review before resuming session.
- Missing/incompatible module.
- Draft recovered.

A confirmed host event is not independently rolled back from shared history merely because local disk persistence failed. Instead, the local app enters a recoverable unsaved state.

## 14. Cross-module Character content

Character authoring must support content supplied by modules other than the module that defined the parent choice.

Normative relationship semantics are defined in `docs/rules/content-relationships.md`.

Required authoring cases include:

- new standalone class/species/background/feat/spell/item content;
- external subclass attached to an existing class;
- external variant/lineage/trait branch attached to an existing species/ancestry;
- external option contributed to an existing ChoiceDefinition;
- external progression feature/choice contributed to an existing ProgressionTrack context.

The Character source stores the selected qualified module/content identity and ChoiceDefinition option identity. It does not flatten the extension into anonymous grants.

Example source chain:

```text
Class: Fighter (core.rules)
-> Choice: subclass
-> Spellblade (my.homebrew)
-> Fighter progression 7 contribution
-> Arcane Assault RuleSource
```

The same chain feeds provenance, migration, compatibility checks, and the UI's source labels.

If the selected extension module becomes unavailable or incompatible, the Character remains intact but enters an actionable missing/incompatible-content state. The app must not silently substitute a same-named option from another module.

A session-only module may expose temporary choices/actions, but a durable Character build cannot silently acquire a permanent dependency on session-only content. Permanent adoption requires explicit local installation/adoption or a durable-grant workflow.
