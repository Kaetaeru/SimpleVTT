# Character Lifecycle and Authoring

This document defines canonical Character ownership, creation, editing, progression, revision, and session-writeback boundaries.

Detailed Character creation UI/UX is defined by `docs/design/character-creation-ui.md` (**canonical v0.9**). Where older references conflict, v0.9 wins.

## 1. Ownership and source of truth

The permanent Character belongs to the player and is stored locally.

Durable Character source data includes identity, RulesProfile identity/version, class/species/background and other content selections, progression selections, ChoiceDefinition selections, permanent ItemInstances, explicit overrides, and qualified module/content references.

Durable runtime state includes current HP, persistent resources, consumable quantities, item charges/configuration, and persistent Character-bound effects when supported.

Derived totals such as AC, attack modifiers, save DCs, and action availability are reproducible and are not canonical source data.

## 2. Creation entry paths

The library supports Guided Create, Quick Create, Import, and Duplicate.

All four paths converge on one `CharacterCreationDraft` and one application-provided `CharacterCreationPlan`.

Guided and Quick are views over the same autosaved draft. Import and Duplicate initialize the same source graph and do not bypass validation.

## 3. No combined core-build step

`핵심 빌드` is not canonical.

Species, background, and class are independent source selections and independent authoring sections.

React must not own a fixed creation-step array or named class/species/background rules. The application layer derives the current plan from RulesProfile + ContentCatalog + current draft/source selections.

Default SRD-oriented creation is level 1. Future progression-gated choices, including subclass or later feat choices, are not asked early. They appear through ProgressionDraft when their RuleSource-defined unlock condition is reached.

## 4. Creation rules

- Enter durable source values once; derive dependent values.
- Deterministic grants are automatic.
- Only genuine current choices appear as ChoiceDefinitions.
- Major selection domains remain revisitable before commit.
- Sections may be complete, incomplete, blocked, warning, or not-applicable according to real dependency state.
- The draft autosaves after meaningful changes.
- Final review separates source choices, automatic grants, derived values, validation, and provenance.
- A committed Character must already be action-ready; combat must not require re-entering formulas.

The initial section composition is expected to include identity, species, background, class, abilities, proficiencies/languages/tools, current-level class choices, equipment, conditional spell/other choices, and review. Exact composition is RulesProfile/content-driven.

## 5. Source, derived, contribution, override

The UI distinguishes source input, derived properties, RuleSource contributions, and explicit overrides.

Derived values are normally read-only and expose provenance. Overrides preserve the computed value, replacement value, authority/source, optional reason, and scope/lifetime.

## 6. Editing

Creation and editing share the same section mental model.

Changing a source selection recalculates dependencies and choices, validates references, recalculates derived properties/actions, shows meaningful effects, persists a new local source revision, and updates SessionProjection only when compatible.

Upstream changes may invalidate downstream selections. Recoverable user intent may be retained, but incompatible grants are never silently preserved.

## 7. Progression and level-up

Progression is represented by one or more RulesProfile-defined ProgressionTracks, not by a UI-only `level += 1` mutation.

```text
Current Character revision
+ proposed ProgressionTrack change
+ RulesProfile/modules
+ newly active choices
→ ProgressionDraft
→ derive grants/replacements/property changes
→ before/after review
→ commit Character revision
```

Deterministic progression grants are automatic. Only newly active choices are presented.

This is the canonical place for subclass, later feat, later spell, Ability Score Improvement, or other progression-gated decisions when their unlock conditions become true.

If direct creation above the normal starting level is supported later, it should semantically advance through reviewed ProgressionDraft stages rather than exposing all future choices in the initial Class section.

## 8. Revision and active-session boundaries

Persisted identity separates stable Character ID, source/build revision, durable runtime-state revision, schema version, and RulesProfile/module identity/version where useful.

While connected, source edits save locally first. Unresolved/incompatible source changes block SessionProjection refresh until valid. Authoritative shared ResolutionEvents remain host-ordered.

Confirmed ResolutionEvents may write durable runtime changes such as HP, resources, item charges, or consumable quantities back to the player's local Character.

Session-only state never silently becomes permanent Character source data.

## 9. Cross-module content

Character authoring supports standalone external content, external subclasses, species variants, contributed ChoiceDefinition options, and progression contributions through the content-relationship contract.

The Character stores qualified module/content and ChoiceDefinition identities rather than flattened anonymous grants.

Example:

```text
Class: Fighter (core.rules)
→ progression threshold reached
→ subclass ChoiceDefinition activates
→ Spellblade (my.homebrew) selected
→ contributed progression RuleSource activates
```

Missing/incompatible modules produce an actionable state. The app never silently substitutes same-named content from another module.
