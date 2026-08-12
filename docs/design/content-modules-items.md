# Content Modules, Rule Libraries, and Items

This document defines how reusable rules content is packaged, selected, imported, scoped, and activated, including inventory and magic/homebrew items.

## 1. One mechanics model for default and homebrew content

Default content and imported/homebrew content use the same RuleSource, Predicate, Timing, Mechanic, Action, Resource, ChoiceDefinition, and provenance contracts after validation.

There is no weaker or separate homebrew rules engine.

## 2. RuleModule

A RuleModule is portable declarative content.

A module manifest should identify:

- module ID and version;
- display name/description;
- Common Rule Definition Specification compatibility;
- RulesProfile compatibility;
- dependencies;
- explicit conflicts/replacements/extensions;
- stable content IDs;
- required capabilities;
- optional author/license/reference metadata.

Load order is not a conflict-resolution policy.

## 3. Mount/install scope

Scope belongs to the installed/mounted module instance, not the portable module identity.

Initial scopes:

- `builtin` — curated/default content available with a supported profile;
- `local` — user-owned personal/homebrew library content;
- `session` — DM-hosted content mounted for the current session.

The same RuleModule may be installed locally or mounted for a session.

Session modules never silently become permanent player content.

## 4. ContentCatalog

The ContentCatalog is the resolved searchable view of enabled compatible modules.

Character creation/editing and progression query the catalog instead of hard-coding named rule options in UI code.

Catalog entries may include profile-defined categories such as:

- class/subclass;
- species/ancestry;
- background;
- feat;
- spell;
- condition;
- equipment/item;
- reusable Action/Effect/Resource template;
- Combatant-related reusable feature.

The generic module layer does not hard-code one edition's taxonomy.

## 5. Grants and ChoiceDefinition

Content may produce deterministic grants and/or real choices.

### Deterministic grant

Automatically derived. Do not ask the user to confirm it.

Examples:

- proficiency;
- RuleSource;
- Resource;
- Action/Reaction;
- economy option;
- progression threshold feature.

### ChoiceDefinition

Used only when the user must actually choose.

Examples:

- choose 1 of 2 species traits;
- choose N proficiencies;
- choose one feat;
- choose a damage type;
- choose one Action/feature branch;
- choose one prepared/known option.

Selections are stored as Character source data. Resulting grants are derived.

## 6. Progression-driven content

Module entries may use ProgressionTrack context and Predicates.

Example:

```text
progression.class.example >= 2
```

When a threshold becomes true:

- deterministic grants activate automatically;
- new required ChoiceDefinitions become unresolved until answered;
- replacements/supersessions retain provenance.

## 7. Single RuleSource import

Users must be able to add one feat, spell-like feature, item feature, or similar JSON without manually building a large pack.

Recommended flow:

1. paste/select JSON;
2. structural validation;
3. semantic validation;
4. capability/RulesProfile compatibility check;
5. human-readable mechanical preview;
6. show unsupported mechanics explicitly;
7. choose local or DM/session destination;
8. normalize into catalog/module-backed content.

An AI may be used externally to author the JSON, but AI output never bypasses local validation/review.

## 8. Session compatibility

On join, compare at least:

- RulesProfile ID/version;
- module IDs/versions;
- required source identities;
- required capabilities.

Cases to handle:

- exact compatible source exists on both sides;
- player has local content unknown to host;
- host requires session module unknown to player;
- profile/module/capability mismatch;
- session content may be mounted temporarily.

Unknown player-local content should produce an explicit DM review/compatibility result rather than silent trust or silent deletion.

## 9. ItemDefinition

An ItemDefinition is reusable portable content supplied by a module/catalog entry.

It may declare:

- category/tags;
- passive RuleSources;
- granted Actions/Reactions/Activities;
- Resources/charges;
- activation/loadout requirements;
- Predicate/Timing rules;
- configuration choices;
- consumable behavior;
- target/range/cost rules;
- EffectInstance creation;
- recharge/reset policy;
- unsupported mechanics when necessary.

`magicItem: true` may exist as metadata for UX, but it is not an engine branch. Magic behavior is composed from common mechanics.

## 10. ItemInstance

An ItemInstance is one owned/runtime copy linked to a Character or Combatant.

Instance state may include:

- stable instance ID;
- ItemDefinition/module/version identity;
- owner;
- quantity;
- activation/loadout state;
- charges/resources;
- selected configuration/mode;
- temporary item-specific state;
- custom display name/notes;
- lifetime/write-back classification.

Definition is reusable content. Instance state is mutable ownership data. Derived mechanics are computed from both.

## 11. Passive item mechanics

An item may affect the owner while activation requirements pass.

Examples:

- AC/defense contribution while equipped;
- attack/damage modifier while wielded;
- resistance/immunity/sense/movement contribution;
- proficiency/permission/restriction;
- passive trigger;
- Resource maximum change;
- economy change;
- curse/penalty.

The contribution remains provenance-linked:

```text
ItemInstance -> ItemDefinition -> RuleSource -> Mechanic -> result
```

## 12. Active item mechanics

An item may grant Actions/Reactions visible on the Character action surface.

An item Action may:

- spend charge/resource;
- decrement quantity;
- spend action economy;
- roll attack/save/check;
- deal typed damage/heal;
- create/remove EffectInstances/conditions;
- request a ChoiceDefinition;
- require target/context Predicates.

The item cost and resulting state changes commit atomically in one ResolutionEvent.

## 13. Magic-item composition

The common model must allow a single item to combine:

- passive bonus;
- active charged ability;
- recharge lifecycle;
- granted Action/Reaction;
- timed EffectInstance;
- alternate configuration/mode;
- conditional mechanics;
- activation prerequisites;
- consumable/limited-use powers;
- session-only lifetime when supplied by a DM module.

No item name may be special-cased in the resolver.

## 14. Quantity, stacks, and consumables

Stack behavior is deterministic.

The design distinguishes:

- stackable identical items with no per-instance divergent state;
- individually tracked items when charges/configuration/identity differ;
- stack split/merge without losing state;
- last-item consumption;
- quantity changes as typed StateChanges.

A potion-like use must not reduce quantity separately from its healing/effect transaction.

## 15. Inventory UX

The Character inventory prioritizes play-relevant state:

```text
Item name
quantity
active/equipped/wielded state
charge/resource summary
short mechanical summary
quick activation/configuration control
granted Action shortcut
[Why is this affecting me?]
```

Changing activation state immediately recalculates dependent values and Action availability.

## 16. Activation/loadout model

Do not create unrelated booleans in UI components for every content concept.

Items and other RuleSources use the common ActivationState/Predicate system for concepts such as equipped, wielded, prepared, attuned-like, selected mode, enabled, disabled, and suppressed.

If a source is inactive, inspection should explain why.

## 17. Item import/authoring

A single item JSON and a module-provided item use the same ItemDefinition mechanics.

Import review should show:

- source/module identity;
- passive effects;
- Actions/Reactions;
- Resources/charges;
- activation requirements;
- Predicate/Timing behavior;
- configuration choices;
- unsupported mechanics.

Imported content never executes arbitrary code.

## 18. Ownership and session scope

Permanent Character inventory remains player-owned.

The system distinguishes:

- local permanent ItemInstances;
- SessionProjection of local inventory;
- session-only temporary items/equipment;
- explicit durable DM grants/transfers.

A session-only item is removed/unmounted according to its lifetime and is not silently persisted.

A permanent DM grant requires an explicit durable-grant/write-back operation.
