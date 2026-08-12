# Rule Modules, Content Packs, and Choice Grants

Status: Draft for Issue #11

## Product intent

SimpleVTT needs a rule-content layer above the common Rule Definition Specification.

The common rule layer defines how mechanics are expressed: RuleSource, Property, Predicate, Timing, Trigger, Action, Effect, Resource, Permission, Restriction, Choice, provenance, and action economy.

The module layer defines how authored rule content is packaged, discovered, enabled, selected, granted, imported, versioned, scoped, and exchanged between a player and a DM session.

The key product rule is:

> Built-in/default content, user-authored content, and DM/session content use the same mechanics language after validation.

There must not be a privileged hard-coded implementation for built-in feats/classes/spells and a weaker custom-data implementation for homebrew content.

## Terminology

### Rule Definition Specification

The common declarative language understood by the engine.

It defines mechanics and their semantics, not a catalog of named D&D content.

### RulesProfile

The edition/rules interpretation layer that defines property registries, lifecycle ordering, stacking rules, action-economy semantics, recognized content categories, validation policy, and other profile-specific rules.

### RuleModule

A portable, versioned package of declarative rule content.

A module may contain one RuleSource or many thousands of content entries. Module data never executes arbitrary code.

### InstalledModule

A RuleModule mounted into a particular application context.

Scope belongs to the installation/mount, not intrinsically to the portable module file.

Conceptual shape:

```ts
interface InstalledModule {
  moduleId: string
  version: string
  scope: 'builtin' | 'local' | 'session'
  enabled: boolean
  origin?: string
  integrity?: string
}
```

The same RuleModule can therefore be installed locally by a player or mounted only for one hosted session by a DM.

### ContentCatalog

The effective searchable view of content from all enabled compatible modules in the current context.

Character creation and editing query this catalog instead of hard-coding lists into React components.

### Qualified source identity

Every module-provided content entry has a stable identity derived from its module and entry IDs.

Conceptually:

```text
<module-id>:<source-id>
```

Display names are never identities.

## Scope model

SimpleVTT supports three initial scopes.

### Built-in/default scope

Curated content distributed with or explicitly enabled for a RulesProfile.

Purpose:

- good default Character creation UX;
- automatic deterministic grants;
- normal class/species/background/feat/spell/item browsing;
- profile-provided conditions or standard reusable mechanics.

Built-in status does not give a RuleSource special runtime behavior. Once loaded, it uses the same rule primitives as every other source.

### Local/personal scope

Content installed in one player's local library.

Examples:

- a single homebrew feat;
- a personal item;
- a custom spell;
- a homebrew species;
- a private class/module pack.

Local content remains under player ownership and is not automatically sent to a DM or installed on other machines.

### Session/server scope

Content mounted by the DM host for a current campaign/session context.

Examples:

- campaign-specific feats;
- custom items or spells;
- optional house rules represented with supported mechanics;
- session-specific RuleSources;
- encounter-specific reusable rules.

Session content is temporary from the player's perspective by default.

Receiving session content must never silently overwrite or permanently install content into the player's local library.

## RuleModule manifest

A RuleModule requires a versioned manifest.

Conceptual shape:

```json
{
  "schemaVersion": "0.1-draft",
  "moduleId": "example.homebrew.core",
  "version": "1.0.0",
  "name": "Example Homebrew Core",
  "description": "Example rules content.",
  "ruleSpec": "0.1-draft",
  "rulesProfiles": [
    "dnd.example"
  ],
  "dependencies": [],
  "conflicts": [],
  "entries": [
    "feat.example-defense",
    "species.example-lineage"
  ],
  "metadata": {
    "author": "Example Author"
  }
}
```

Exact serialized fields remain draft, but the manifest semantics should include:

- stable module ID;
- module version;
- human-readable label/description;
- compatible Rule Definition Specification versions;
- compatible RulesProfile IDs/version ranges;
- explicit module dependencies;
- explicit conflicts/incompatibilities;
- stable content-entry IDs;
- optional author/license/reference metadata;
- content integrity/digest information where required for session comparison;
- migration metadata when a later format requires it.

## Scope is not part of portable identity

A module should not contain a permanent declaration such as `scope: server` or `scope: local` as its identity.

Instead:

```text
RuleModule
Example Homebrew Core 1.0.0

Installed as:
- local on Alice's app
- session on Bob's DM host
```

This permits intentional sharing without creating separate file formats.

## Content entry model

Every catalog entry ultimately resolves to one or more RuleSources plus authoring/catalog metadata.

A RulesProfile determines which categories are recognized and how they participate in Character building.

Potential categories include:

- class;
- subclass;
- species/ancestry;
- background;
- feat;
- spell;
- equipment/item;
- condition;
- optional rule;
- reusable Action/Effect/Resource definition;
- Combatant-related reusable rule source.

The generic module system must not assume that every RulesProfile has exactly these categories.

## Built-in and custom content are mechanically equivalent

This is a hard invariant.

A feat selected from a built-in module and a feat imported by the user must end up represented by compatible RuleSource mechanics.

For example:

```text
Built-in feat
    -> validated RuleSource
    -> Predicate/Timing/Mechanics

Imported feat JSON
    -> validated RuleSource
    -> Predicate/Timing/Mechanics
```

The resolver does not receive a `builtIn=true` branch.

## Automatic grants

Content may grant deterministic mechanics without asking the user to confirm them.

Example:

```text
User selects Class X

Automatically granted
- save proficiency A
- save proficiency B
- starting resource C
- feature D
- action E
```

The user should not be forced through confirmation dialogs for deterministic consequences of a choice already made.

Automatic grants remain fully visible in provenance and Final Review.

Conceptually, content can declare grant relationships:

```text
Source: class.example
When active:
  grant source: class.example.save-a
  grant source: class.example.save-b
  grant source: class.example.resource
```

A grant is not a copy/paste operation into flattened Character totals. The Character records the parent source selection, and the derived source graph determines the active grants.

## ChoiceDefinition

Some content creates real player choices.

Choices are first-class declarative rule data rather than UI-specific branching logic.

Conceptual shape:

```ts
interface ChoiceDefinition {
  id: string
  prompt: string
  minSelections: number
  maxSelections: number
  options: ChoiceOption[]
  predicate?: Predicate
  timing?: ChoiceTiming
  changePolicy?: ChoiceChangePolicy
}
```

Each option has a stable ID and may grant RuleSources/mechanics.

Conceptual example:

```json
{
  "id": "lineage-trait-choice",
  "prompt": "Choose one lineage trait",
  "minSelections": 1,
  "maxSelections": 1,
  "options": [
    {
      "id": "trait-a",
      "grants": ["species.example.trait-a"]
    },
    {
      "id": "trait-b",
      "grants": ["species.example.trait-b"]
    }
  ]
}
```

## Choice behavior requirements

ChoiceDefinition must support at least:

- stable choice ID;
- prompt/label/help text;
- minimum/maximum selection count;
- stable option IDs;
- option-specific prerequisites/predicates;
- mutually exclusive choices;
- grants created by each selection;
- source attribution;
- when the choice becomes required;
- whether the choice is optional or blocking;
- change/reselection policy;
- validation when a formerly selected option becomes unavailable after a module/profile change.

## Character stores choices, not flattened consequences

When a player chooses an option, the Character should preserve the source decision.

Conceptually:

```json
{
  "choiceId": "lineage-trait-choice",
  "source": "example.species:example-lineage",
  "selectedOptionIds": ["trait-b"]
}
```

The resulting RuleSources and derived values are reproducible from that selection.

This allows the system to explain:

```text
Why do I have this feature?
Species: Example Lineage
  -> Choice: Lineage Trait
     -> Selected: Trait B
        -> grants RuleSource ...
```

## Progression-driven grants and choices

Modules need to support content that becomes active later.

The generic module layer does not hard-code level semantics. It provides context/predicate-based activation.

Conceptual example:

```text
Class source active

Predicate: character.level >= 1
  -> grant Feature A

Predicate: character.level >= 2
  -> require Choice B

Predicate: character.level >= 3
  -> grant Action C
```

The selected RulesProfile determines how progression properties are defined and validated.

Changing progression data should deterministically activate/deactivate grants and surface newly required choices.

Previously resolved choices must not be duplicated each time recalculation occurs.

## Predicate and Timing integration

Module content uses the exact same Predicate and Timing contracts as all other RuleSources.

Examples:

- a feat option only appears if a prerequisite predicate passes;
- a class grant becomes active at a progression threshold;
- a reaction granted by a module listens at a specific Timing/Trigger point;
- an effect granted by a spell uses the standard Duration/expiry model;
- a choice appears only when its activation predicate becomes true.

There is no separate `modulePredicate` or `moduleTiming` language.

## ContentCatalog

The application builds an effective catalog from enabled compatible modules.

Conceptual input:

```text
Built-in modules
+ local modules
+ current session modules
        ↓
compatible/validated entries
        ↓
ContentCatalog
```

A catalog record should retain:

- qualified source ID;
- display name;
- content category;
- supplying module ID/version;
- compatible RulesProfile;
- prerequisite/availability result;
- summary of mechanical grants;
- source/scope badge for UX;
- validation status.

## Character builder integration

The Character builder queries ContentCatalog instead of containing lists of named classes, species, feats, or spells inside UI code.

Example:

```text
Choose Class

[Search...]

Warrior-like option        [Default Core]
Custom Alchemist           [My Homebrew]
Campaign Knight            [DM Session]
```

After selection:

```text
Campaign Knight

Automatically granted
✓ Armor proficiency
✓ Example Resource 3/3
✓ Example Action

Required choice
Choose 1 fighting style
[Option A] [Option B] [Option C]
```

The source module remains visible without overwhelming the normal UX.

## Progressive disclosure in selection UX

Normal users should see meaningful rule choices, not raw RuleSource JSON.

A content card should show concise mechanical consequences when practical.

Example:

```text
Trait B

Grants
+ Resistance: example damage type
+ Action: Example Burst (1/rest)
```

Advanced detail may expose:

- exact RuleSource IDs;
- Predicate;
- Timing;
- resource/economy mechanics;
- source module/version;
- unsupported/warning state.

## Single RuleSource import

Users should be able to add one feat/item/spell/etc. without first learning how to package a full module.

Recommended UX:

1. **Add Rule Content**.
2. Choose **Import single JSON**.
3. Paste or select a file.
4. Structural validation.
5. Semantic validation.
6. Preview human-readable mechanics.
7. Select destination scope when allowed.
8. Save into the catalog.

A standalone RuleSource is internally normalized into module-backed content rather than creating a parallel storage model.

## Auto-managed personal module

For a simple single-entry import, the application may store the content in an auto-managed local module such as:

```text
local.user-content
```

or generate a stable user module identity.

This is an implementation choice, but the invariant is:

> a single imported feat and a feat from a multi-entry pack must use the same catalog and mechanics pipeline.

The user can later export selected local entries as a portable RuleModule if that feature is added.

## Single JSON import review

Preview should show at least:

```text
Example Feat
Type: Feat
RulesProfile: ...

Prerequisites
- ...

Mechanical grants
- Action: ...
- Resource: ...
- Modifier: ...
- Reaction: ...

Predicate/Timing warnings
- ...

Unsupported mechanics
- ...
```

Unsupported mechanics must never be silently approximated.

## Full module import

Module import adds another validation layer before individual entry validation.

Order:

1. validate manifest shape;
2. validate Rule Definition Specification compatibility;
3. validate RulesProfile compatibility;
4. resolve dependencies;
5. detect explicit conflicts;
6. validate all entries structurally;
7. validate cross-entry references;
8. semantic validation of properties/predicates/timing/mechanics;
9. summarize warnings/unsupported mechanics;
10. show install/enable review;
11. activate only after approval.

## Dependencies

Dependencies must use stable module IDs and compatible versions.

A module may reference another module only through explicit dependencies.

Missing dependencies should prevent activation when required.

Optional dependencies may be considered later; the MVP should prefer simple deterministic dependency semantics.

## Conflict and replacement rules

Do not use implicit load order as the primary conflict model.

Bad model:

```text
whichever module loads last wins
```

Preferred model:

- duplicate qualified IDs are validation conflicts;
- intentional replacement uses explicit `replaces` metadata;
- intentional extension uses explicit relationship metadata;
- a RulesProfile may define allowed replacement/extension semantics;
- provenance records retain the original and replacing source identities where relevant;
- UI explains conflicts before activation.

## Module version changes

A Character may reference sources from an older module version.

Updating a module must not silently reinterpret permanent Character choices when the update contains incompatible semantic changes.

The design should support a review/migration state such as:

```text
Character references:
example.homebrew.core 1.0.0

Installed:
example.homebrew.core 2.0.0

Review required
- source X changed
- choice Y no longer exists
```

Exact migration tooling is a later implementation concern, but source version provenance is mandatory now.

## Character module references

A Character should be able to identify which module-provided sources it depends on.

This can be derived from source selections/provenance rather than maintained as a second manually edited list.

Conceptually:

```text
Required rules content
- core.default@1.x : class.example
- alice.homebrew@1.2.0 : feat.example
```

This requirement becomes important during session join.

## Session module authority

The DM host owns the session's effective rule-module environment.

However, player Characters remain player-owned.

Joining a session therefore requires compatibility negotiation rather than silently rewriting either side.

The host should have a configurable policy eventually, such as:

- require host-known modules only;
- allow unknown player RuleSources after DM review;
- accept validated player-provided session projections.

For the first implementation, a review-based policy is safer than silently trusting unknown local rules.

## Session module negotiation

At join time compare at least:

- RulesProfile identity/version;
- required module IDs/versions;
- relevant content IDs;
- integrity/hash when available;
- unsupported mechanic status.

Possible results:

```text
Compatible

Compatible with session additions

Needs DM review
- player feat from unknown local module

Blocked
- incompatible RulesProfile
- conflicting source identity
- unsupported required mechanics
```

The networking protocol is separate work, but these identities must exist before networking is designed.

## Session-only module delivery

A DM may provide declarative module content to clients for the current session.

The client:

1. receives manifest/content through the trusted session connection;
2. validates it locally;
3. mounts it as `scope=session`;
4. exposes it in the session catalog;
5. does not write it into the permanent local module library unless the player explicitly installs it.

This permits campaign content without creating a central cloud account system.

## Session overlays do not mutate permanent Character source

A session may apply temporary campaign rules or session-only RuleSources.

Those are session state/overlays unless the player explicitly adopts them into their permanent Character.

Example:

```text
Permanent Character
Alice's local feat

Session overlay
DM campaign blessing
```

Ending the session removes the overlay but does not delete or rewrite the Character's permanent sources.

## Using server content in Character choices

Some campaign content may create a Character choice when joining or leveling within a session.

The UX should distinguish whether the choice is:

- permanent Character content from an installed local module;
- session-only choice stored in session projection/state;
- an explicitly accepted permanent install/adoption.

Never make this distinction implicit.

## Module manager UX

Recommended high-level surface:

```text
Rule Content

Built-in
Core Rules                     Enabled

My Content
Homebrew Feats                 Enabled
[Import JSON] [Import Pack]

Current Session
DM Campaign Rules              Session only
Campaign Items                 Session only
```

Each module should expose:

- name/version;
- RulesProfile compatibility;
- source/scope;
- number/category of entries;
- dependency/conflict state;
- warning/unsupported count;
- enable/disable action when safe.

## Character builder source badges

Default UX should remain clean, but users need to distinguish duplicate names or campaign content.

Example:

```text
Example Feat
[Default]

Example Feat
[My Homebrew]

Example Feat
[DM Session]
```

Qualified IDs remain available in advanced detail.

## DM module UX

The DM host should be able to:

- import a single RuleSource JSON;
- import a RuleModule pack;
- validate before activation;
- install content into the host's local library;
- enable selected modules for a session;
- view which connected Characters require unknown modules;
- approve/reject reviewed player-provided custom rules when that policy is supported;
- expose session-only modules to connected clients.

The server does not need a marketplace or cloud package manager.

## Trust model

All imported content is data, not code.

Forbidden in modules:

- JavaScript execution;
- native code;
- shell commands;
- arbitrary filesystem/network operations;
- arbitrary dynamic functions.

Allowed behavior is restricted to versioned Rule Definition Specification primitives and RulesProfile-defined semantics.

## Integrity and reproducibility

For networking and logs, it should eventually be possible to record the exact rule content used for a resolution.

At minimum provenance should identify:

```text
RulesProfile ID/version
Rule Definition Specification version
Module ID/version
RuleSource ID
```

A content digest/hash may be added so the host and client can detect same-version-but-different-data cases.

## AI-assisted module authoring

External AI can be used as an authoring aid.

Recommended inputs:

- RuleSource schema;
- Predicate specification;
- Timing/Trigger specification;
- ChoiceDefinition specification;
- module manifest schema;
- example modules;
- active RulesProfile property registry.

AI output must pass the same validation as human-authored JSON.

The authoring instruction should require uncertain/unrepresentable behavior to be placed in `unsupportedMechanics` rather than guessed.

## Example end-to-end: default class

```text
Enable default module
        ↓
Character builder catalog
        ↓
User selects Class X
        ↓
Character stores class source selection
        ↓
automatic grants activate
        ↓
ChoiceDefinition becomes required
        ↓
user chooses Option B
        ↓
Character stores selected option ID
        ↓
granted RuleSources become active
        ↓
property/action/resource graph recalculates
        ↓
Final Review shows all grants + provenance
```

No deterministic grant requires duplicate manual entry.

## Example end-to-end: imported feat

```text
Import feat.json
      ↓
validate RuleSource
      ↓
preview Predicate / Timing / mechanics
      ↓
install to local content
      ↓
ContentCatalog contains feat
      ↓
Character builder eligibility predicate passes
      ↓
user selects feat
      ↓
Character stores qualified source ID
      ↓
same RuleSource engine as default content
```

## Example end-to-end: DM campaign module

```text
DM imports campaign-pack.json
        ↓
module validation
        ↓
DM enables pack for session
        ↓
players join
        ↓
module identities negotiated
        ↓
client validates received session data
        ↓
session module mounted temporarily
        ↓
session-only options/effects become available
        ↓
ending session unmounts session content
```

Permanent local libraries remain untouched unless an explicit install occurs.

## Acceptance requirements

The eventual implementation should demonstrate:

1. A default module contributes selectable Character content without React hard-coding named options.
2. Selecting a class automatically grants deterministic RuleSources.
3. A species/content source creates a `choose 1 of 2` ChoiceDefinition and blocks Final Review until resolved when required.
4. A progression change activates a new grant/choice exactly once.
5. A single feat JSON can be imported into the local catalog and selected like default content.
6. The imported feat uses the same Predicate/Timing/Mechanic system as built-in content.
7. Source provenance includes module ID/version and source ID.
8. Duplicate/conflicting identities produce an actionable error rather than accidental load-order behavior.
9. A DM can enable a module for the session without permanently installing it on player machines.
10. Session content is locally validated before use.
11. A Character with an unknown local source produces a clear join compatibility/review result.
12. Session overlays disappear cleanly when the session ends without damaging permanent Character data.

## Relationship to other design issues

### Issue #7

Defines what RuleSources and mechanics mean.

Issue #11 packages and catalogs those RuleSources and supplies automatic grants/choices.

### Issue #5

Character creation consumes ContentCatalog and ChoiceDefinition rather than hard-coded option arrays.

### Issue #3

Combat Resolution consumes the active resolved RuleSource graph regardless of whether a source came from built-in, local, or session content.

### Future networking work

Networking transports module identities, compatibility information, session-scoped declarative content, and resolved session state. It must not redefine module semantics.

## Open design questions

Before implementation, resolve:

- exact manifest serialization and version-range syntax;
- module/source ID naming rules;
- content digest strategy;
- exact replacement/extension contract;
- whether standalone imports use one global auto-managed user module or generated per-import mini modules;
- session policy for unknown player-local sources;
- exact boundary between permanent Character choice and session-only choice;
- module migration UX after incompatible content updates;
- MVP subset of content categories required for the first RulesProfile.
