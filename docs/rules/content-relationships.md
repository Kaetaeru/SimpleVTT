# Content Relationships and Cross-Module Contributions

Status: normative draft extension to the Common Rule Definition Specification

This document defines how independently authored RuleModules add, extend, replace, and contribute content to existing rules content without copying or editing the module that originally defined the target.

It is specifically intended to support expansion-book-style content and homebrew such as:

- a new subclass for an existing class;
- a new species/ancestry or a new variant/lineage for an existing species;
- a new background, feat, spell, item, condition, or optional rule;
- a new option added to an existing ChoiceDefinition;
- a new progression feature attached to an existing class/subclass/species progression context;
- a session-only extension supplied by a DM module;
- a local user module that augments default content without mutating it.

The generic engine must not require named classes, species, subclasses, or books to be hard-coded. Category semantics are supplied by the active RulesProfile and module metadata.

## 1. Core rule

Content extension is declarative composition, not file mutation.

A module that adds a subclass to an existing class does not rewrite the class entry. A module that adds one option to an existing choice does not replace the whole ChoiceDefinition. A module that adds a progression feature does not copy the parent progression table.

Instead, RuleModules publish stable ContentEntries plus explicit relationships/contributions. ContentCatalog resolves the enabled compatible graph into the options and grants shown to Character authoring and progression.

## 2. Stable identity

Every relationship targets stable qualified identities, never display names.

Recommended qualified identity:

```text
moduleId@moduleVersion/contentId
```

At runtime, the exact stored representation may use separate fields, but the semantic identity must include enough information to resolve:

- source module ID;
- source module version or compatible version range where appropriate;
- content entry ID;
- target module/content identity for cross-module relationships.

Display labels such as `Fighter`, `Spellblade`, or localized names are never relationship keys.

## 3. ContentEntry

A ContentEntry is a catalog-visible declarative unit supplied by a RuleModule.

Conceptual shape:

```json
{
  "id": "subclass.spellblade",
  "category": "subclass",
  "relationships": [],
  "grants": [],
  "choices": [],
  "progressionContributions": []
}
```

The active RulesProfile defines recognized categories and any category-specific validation. The common module layer remains generic.

A ContentEntry may represent a class, subclass, species/ancestry, variant, background, feat, spell, item, optional rule, reusable feature, or another profile-defined category.

## 4. Relationship kinds

The initial common relationship kinds are:

### `parent`

Declares hierarchical placement/ownership in the content graph.

Examples:

```text
subclass -> class
species variant -> species
subrace/lineage-like option -> species
subclass-specific feature group -> subclass
```

Conceptual example:

```json
{
  "kind": "parent",
  "target": {
    "moduleId": "core.rules",
    "contentId": "class.fighter"
  }
}
```

`parent` means "this entry belongs under/is selected through this target". It does not automatically replace or modify the target.

### `extends`

Declares an additive contribution to an extensible target or extension point.

Examples:

- add one option to an existing ChoiceDefinition;
- add a new progression grant at an existing progression context;
- add a new catalog child to a target's allowed child category;
- add a new optional feature candidate;
- add a new spell/feat/item option to a profile-defined selection source.

`extends` is additive by default. Existing target data remains intact.

### `replaces`

Declares an explicit substitution for an existing content entry, option, contribution, or compatible target.

`replaces` is never inferred from module load order.

A replacement must identify:

- exact target identity;
- compatibility/version requirements;
- scope of replacement;
- whether prior source identity remains visible for migration/provenance;
- conflict behavior when multiple replacements claim the same target.

Replacement is intentionally stricter than additive extension.

## 5. Relationship semantics

The common rules are:

- `parent` establishes hierarchy/selection placement;
- `extends` adds compatible content without deleting target content;
- `replaces` substitutes explicitly named content;
- relationship meaning is independent of file load order;
- a module may have both a parent relationship and additive contributions;
- a child entry may reference a parent defined by another module;
- cross-module relationships require declared dependency/compatibility sufficient to resolve the target safely.

The engine must not treat `extends` and `replaces` as synonyms.

## 6. Module dependency requirements

If module B targets content in module A, module B's manifest must declare enough dependency/compatibility information to make that relationship reproducible.

Example:

```text
homebrew.arcane-warriors
  depends on core.rules >= compatible version
  adds subclass.spellblade
  parent -> core.rules/class.fighter
```

If the required parent/target module is missing or incompatible:

- the contribution does not silently retarget by display name;
- the entry is rejected, disabled, or inspection-only according to validation policy;
- the user receives an actionable missing-target/module diagnostic.

## 7. ChoiceDefinition extension points

A ChoiceDefinition may expose a stable extension point so compatible modules can contribute options.

Conceptual base choice:

```json
{
  "id": "choice.fighter.subclass",
  "optionProvider": {
    "kind": "catalog",
    "extensionPoint": "class.fighter.subclass-options"
  },
  "minSelections": 1,
  "maxSelections": 1
}
```

A different module may contribute:

```json
{
  "id": "subclass.spellblade",
  "category": "subclass",
  "relationships": [
    {
      "kind": "parent",
      "target": {
        "moduleId": "core.rules",
        "contentId": "class.fighter"
      }
    },
    {
      "kind": "extends",
      "target": {
        "moduleId": "core.rules",
        "extensionPoint": "class.fighter.subclass-options"
      }
    }
  ]
}
```

The resulting Character UI may show:

```text
Fighter — choose subclass

Core Rules
- Champion
- Battle Master

Expansion X
- Rune Knight

My Homebrew
- Spellblade
```

The UI does not own this list. It renders the resolved ContentCatalog/ChoiceDefinition result.

## 8. Choice option contribution rules

Cross-module option contributions must support:

- stable option/content ID;
- target extension-point ID;
- source module/version provenance;
- option Predicate/prerequisites;
- category compatibility;
- explicit ordering metadata only when the profile/content requires it;
- conflict detection for duplicate stable identities;
- optional grouping/source labels for UX;
- replacement/suppression metadata when an option intentionally supersedes another.

An extension must not require copying all existing options from the base module.

## 9. Catalog child contributions

Some content relationships are naturally hierarchical rather than explicit ChoiceDefinition option injection.

Example:

```text
class.fighter
  children(category=subclass)
```

A RulesProfile/content descriptor may define that a class selection exposes catalog children in category `subclass` whose `parent` points to the selected class.

This allows a new subclass module to become eligible automatically when:

- its parent target exists;
- its module is enabled and compatible;
- its prerequisites pass;
- the active RulesProfile recognizes that category relationship.

The exact D&D taxonomy is profile-defined; the generic resolver only understands stable relationships and catalog queries.

## 10. Progression contributions

A module may add progression behavior to a parent/related content context without duplicating the parent's progression data.

Conceptual example:

```json
{
  "id": "subclass.spellblade",
  "category": "subclass",
  "progressionContributions": [
    {
      "trackRef": "progression.class.fighter",
      "when": {
        "op": "gte",
        "left": { "ref": "progression.class.fighter" },
        "right": { "value": 3 }
      },
      "grants": ["feature.spellblade.level3"]
    },
    {
      "trackRef": "progression.class.fighter",
      "when": {
        "op": "gte",
        "left": { "ref": "progression.class.fighter" },
        "right": { "value": 7 }
      },
      "grants": ["feature.spellblade.level7"]
    }
  ]
}
```

The exact Predicate AST syntax will follow the common schema once implemented. The important contract is that progression contributions reference a stable progression context/track and produce ordinary grants/ChoiceDefinitions/RuleSources.

## 11. Progression contribution behavior

When a progression change is previewed:

1. resolve the Character's selected content graph;
2. collect applicable base progression rules;
3. collect enabled compatible extension contributions;
4. evaluate their Predicates/thresholds;
5. apply deterministic grants automatically;
6. surface only newly required ChoiceDefinitions;
7. preserve source/module provenance for every grant;
8. show replacements/supersessions explicitly;
9. commit the result as one Character revision only after validation/review.

A subclass/extension module does not own or mutate the parent class's progression table.

## 12. New standalone content

A module may also add completely standalone content with no parent relationship.

Examples:

- a new species/ancestry;
- a new class;
- a new feat;
- a new spell;
- a new background;
- a new item;
- a new optional campaign rule.

If the ContentCatalog category is eligible for a builder selection, the entry becomes available through normal catalog filtering and prerequisites.

Therefore both of these are supported:

```text
new standalone class
new subclass attached to existing class
```

and:

```text
new standalone species
new variant/trait option attached to existing species
```

## 13. Extending existing feature choices

An expansion/homebrew module may add options to feature choices that are not top-level Character categories.

Examples:

- fighting-style option;
- invocation-like option;
- maneuver-like option;
- species trait branch;
- damage-type choice;
- spell-list/known/prepared candidate;
- equipment proficiency/feature choice.

These use stable extension-point or option-provider targets rather than named UI screens.

## 14. Extension-point ownership

The module/content that defines an extensible selection owns the extension-point ID and baseline constraints.

It may define:

- accepted content categories;
- minimum/maximum selections;
- eligibility Predicate contract;
- whether external modules may contribute;
- optional required tags/capabilities;
- replacement policy;
- ordering/grouping hints;
- whether session-only contributions are legal for durable Character source selections.

External modules may contribute only within the declared contract.

## 15. Session-scoped contributions

A DM session module may contribute temporary catalog/rule content.

Rules:

- session contributions are mounted only for that session by default;
- session-only content must not silently become permanent local Character source data;
- if a durable Character selection would reference session-only content, the UI must require an explicit adoption/install/durable-grant workflow or block the durable commit;
- session-only Actions/Rules/Items may still be used as session runtime content when their lifetime permits it;
- source/module/version provenance remains visible.

## 16. Character persistence

When a Character selects content supplied by an extension module, Character source data persists the exact relationship result by identity, not by flattened mechanics.

At minimum preserve:

- selected content ID;
- supplying module ID/version;
- parent/extension context when required for validation;
- selected ChoiceDefinition/option ID;
- progression selection context;
- migration/replacement provenance when later changed.

Derived grants remain reproducible from the selected source graph plus the exact module/profile versions.

## 17. Provenance

A rule granted through an extension must remain traceable through the full chain.

Example:

```text
Character
-> Class: Fighter (core.rules)
-> Subclass choice
-> Spellblade (my.homebrew)
-> progression contribution at Fighter 7
-> Feature: Arcane Assault
-> RuleSource
-> Mechanic
-> final property/action/result
```

The UI/debugger should be able to display this chain when useful.

## 18. Conflict rules

The resolver must reject or surface ambiguity rather than use accidental load order.

Required checks include:

- duplicate qualified content ID;
- multiple active replacements for the same exclusive target;
- replacement target missing;
- extension point missing;
- parent target missing;
- relationship cycle;
- category mismatch;
- incompatible RulesProfile/module version;
- missing required capability;
- mutually exclusive module/content relationship;
- durable Character selection that depends on unavailable session-only content.

Additive contributions from multiple compatible modules are allowed unless the extension point declares otherwise.

## 19. Cycle detection

Content relationship graphs must be acyclic for hierarchy/replacement relationships where a cycle would make meaning undefined.

Examples to reject:

```text
A parent -> B
B parent -> A
```

and:

```text
A replaces B
B replaces A
```

A valid dependency graph may have shared ancestors and multiple additive contributors; only semantically invalid cycles are rejected.

## 20. Replacement and migration

Replacement does not erase historical identity.

When content is replaced:

- old Characters remain reproducible under their recorded module/version when available;
- migration to the replacement is explicit when semantics change;
- provenance records old and new identities;
- replacement is not automatically applied to every historical Character unless a migration policy explicitly says so;
- users receive review when a saved Character depends on content no longer installed.

## 21. ContentCatalog resolution

ContentCatalog resolves enabled compatible modules into a deterministic view.

Conceptual pipeline:

```text
Installed/mounted modules
-> validate manifests/dependencies/capabilities
-> load ContentEntries
-> resolve stable identities
-> resolve parent graph
-> resolve extension points and additive contributions
-> resolve explicit replacements/conflicts
-> filter by RulesProfile/context/Predicate
-> expose catalog/ChoiceDefinition view models
```

Catalog resolution must be deterministic for the same module/profile set.

## 22. Character builder UX

The Character builder should make cross-module content feel native, not bolted on.

Requirements:

- compatible options appear in the normal selection flow;
- deterministic grants still happen automatically;
- source module is visible when useful, especially for duplicate/similar names;
- prerequisites and unavailable reasons are explainable;
- unresolved missing dependencies block only the affected commit/selection rather than corrupting the Character;
- search/filter may include module/source/category;
- Guided and Quick Create use the same resolved catalog.

## 23. Progression UX

Level-up/progression review must merge base and extension contributions before presenting the diff.

Example:

```text
Fighter 6 -> 7

Base class
+ Feature A

Spellblade (My Homebrew)
+ Arcane Assault
+ Resource max 2 -> 3

Required choices
+ Choose one Spellblade technique
```

The player should not need to know which JSON file supplied each entry, but provenance must remain inspectable.

## 24. Authoring/import UX

When importing a module or individual related content entry, preview:

- category;
- stable content ID;
- parent target;
- extension targets;
- replacement targets;
- progression contributions;
- ChoiceDefinition contributions;
- required modules/versions;
- capabilities;
- unsupported mechanics;
- conflicts/missing targets.

An AI-generated module must pass the same validation and review.

## 25. Schema requirements

When the common RuleModule/ContentEntry JSON Schema tree is implemented, it must provide explicit structures for at least:

- `relationships[]`;
- relationship `kind`;
- stable target reference;
- extension-point reference;
- compatibility/version constraint where required;
- `progressionContributions[]`;
- choice/option contribution reference;
- conflict/replacement metadata;
- source/provenance metadata.

Do not encode these relationships as arbitrary free-form strings.

## 26. Capability requirements

If a module depends on relationship semantics introduced after an older client version, capability negotiation must make that explicit.

Representative capabilities may include concepts such as:

```text
content.relationship.parent
content.relationship.extend
content.relationship.replace
content.choice.option-contribution
content.progression.contribution
```

The final capability names may change, but the session/import validator must be able to distinguish support from mere JSON parseability.

## 27. Golden scenarios

The rules/content test suite should eventually include deterministic fixtures for:

1. homebrew subclass added to a builtin class;
2. expansion module adds one option to an existing ChoiceDefinition without copying base options;
3. new species added as standalone content;
4. new variant attached to an existing species;
5. subclass progression contribution activates at the correct parent progression threshold;
6. two compatible modules add independent options to the same extension point;
7. missing parent module disables/rejects only the affected content with a useful diagnostic;
8. two replacements targeting the same exclusive entry produce a conflict;
9. relationship cycle is rejected;
10. Character persists exact module/content identity for an externally supplied subclass;
11. session-only subclass/option cannot silently become a permanent Character dependency;
12. module version migration preserves or explicitly reviews old extension selections.

## 28. Non-goals

This contract does not require:

- automatic Internet package download;
- marketplace/package registry;
- arbitrary executable plugins;
- proprietary expansion-book data bundled with SimpleVTT;
- a fixed D&D edition taxonomy in the generic engine;
- implicit display-name matching;
- load-order-based overriding.

## 29. Summary invariant

The system must support this without modifying the base module:

```text
Base Rules Module
  Class: Fighter
  Choice: subclass

Expansion Module
  Subclass: Option X
  parent -> Fighter
  extends -> Fighter subclass options

Homebrew Module
  Subclass: Spellblade
  parent -> Fighter
  extends -> Fighter subclass options

Resolved ContentCatalog
  Fighter subclass choices
  - base options
  - Option X
  - Spellblade
```

The same principle applies to species/ancestry variants, feature choices, progression grants, spells, feats, items, and other RulesProfile-defined extensible content.
