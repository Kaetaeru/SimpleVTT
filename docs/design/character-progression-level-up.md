# Character Progression and Level-Up

Status: Draft for Issue #13

## Product intent

Level-up should feel like a guided change to an existing Character, not like rebuilding the sheet or manually editing every number that changed.

A Character remains player-owned and locally stored. Progression changes the Character's source data; RuleSources, actions, resources, derived values, and provenance are recalculated from that source data through the active RulesProfile and enabled rule modules.

The generic application must not hard-code named classes, level tables, or edition-specific progression rules.

## Core invariant: progression changes sources, not flattened totals

A level-up is conceptually:

```text
Current Character revision
        +
Proposed progression change
        +
RulesProfile
        +
Enabled RuleModules
        +
Required user choices
        ↓
Progression Draft
        ↓
Derived RuleSources / properties / resources / actions
        ↓
Review
        ↓
Committed Character revision
```

The application should never require the user to manually repair AC, saves, attack bonuses, resource maxima, action lists, or similar values after a supported progression change.

## Progression tracks

Do not assume that all rules can be represented by one global integer called `level`.

A RulesProfile may expose one or more progression tracks.

Conceptual examples:

```text
character-level
class:fighter
class:wizard
subclass:example
milestone:campaign-boon
```

A progression track definition should be able to describe:

- stable track ID;
- human-readable label;
- current progression value/rank;
- allowed next values;
- prerequisites for entering/advancing the track;
- content context used by Predicate evaluation;
- grants or choices that activate at thresholds;
- relationships to other tracks where the RulesProfile requires them.

The generic engine treats these as profile-defined progression state. It does not embed multiclassing, subclassing, or any other edition-specific concept directly into core engine code.

## Module integration

RuleModules provide progression-aware content using the same RuleSource and ChoiceDefinition contracts used during initial Character creation.

A content entry may declare mechanics or grants that become active under predicates such as:

```text
progression.class.example >= 2
progression.character >= 4
choice.some-branch == option-b
```

Deterministic grants activate automatically when their predicate becomes true.

Required choices become unresolved Character source choices until the user selects an option.

## Starting a level-up

The Character sheet should expose a clear `Level Up` or profile-equivalent progression action when a valid progression path exists.

Starting it creates a separate autosaved `ProgressionDraft` that references the base Character revision.

The live Character remains unchanged until the draft is committed.

Conceptual state:

```text
Base Character revision: 17
Progression Draft
  target: class:example
  from: 4
  to: 5
  choices: ...
  status: incomplete
```

Closing the application does not discard the draft.

## Recommended level-up flow

The exact screens are RulesProfile-driven, but the interaction should follow this sequence.

### 1. Choose progression target only when necessary

If only one legal progression path exists, do not ask a redundant question.

If multiple paths exist, show only legal candidates with unmet prerequisites clearly explained.

### 2. Evaluate automatic changes

The system evaluates enabled modules and derives all deterministic changes.

Examples include:

- new RuleSources;
- upgraded/replaced RuleSources;
- new actions/reactions;
- new passive mechanics;
- resource definitions or maximum changes;
- newly active proficiencies or permissions;
- derived-stat formula changes;
- new progression-dependent catalog entries.

Do not ask the player to confirm each automatic grant individually.

### 3. Surface unresolved choices

Only real choices become interaction steps.

Potential RulesProfile/content-driven examples include:

- choose one feature from N options;
- choose a subclass/branch;
- choose an ability/feat option;
- choose one or more proficiencies;
- choose new known/prepared rule content;
- choose an HP growth method;
- choose a replacement/retraining option when the profile permits it.

These examples are not hard-coded requirements. They are ChoiceDefinitions supplied by the profile/modules.

### 4. Recalculate Character state

After every choice, recalculate all affected properties through the normal dependency/provenance engine.

Examples:

```text
progression value
  -> proficiency-derived contribution
     -> saves
     -> attacks
     -> DCs

new feature
  -> RuleSource
     -> resource max
     -> new Action
     -> passive modifier
```

### 5. Review before commit

The user sees one coherent diff, not a collection of unrelated form changes.

Recommended review groups:

```text
Progression
4 -> 5

New sources
+ Feature X
+ Feature Y

Choices
✓ Option B selected

Resources
Example Uses   max 3 -> 4

Derived values
Attack bonus   +7 -> +8
Save DC        15 -> 16

Actions
+ Example Action

Warnings
- Homebrew module source Z uses an unsupported mechanic
```

Every item should link back to the supplying module/source and provenance where possible.

## HP and other progression policies

The UI must not guess edition-specific progression behavior.

For changes such as HP, resource maxima, spell-resource capacity, or other profile-specific values, the RulesProfile provides a policy or ChoiceDefinition.

The policy must define how current mutable state relates to a changed maximum.

For example, when a resource maximum increases, the generic application must not assume whether current uses:

```text
stay unchanged
increase by the same delta
refill to maximum
follow another rule
```

That behavior belongs to the RulesProfile/mechanic, and the review should show the result before commit.

## Replacing and upgrading RuleSources

Progression may upgrade or replace an earlier feature.

Do not mutate the old source invisibly.

The resulting provenance should retain enough information to explain the relationship, conceptually:

```text
Old RuleSource
status: superseded
supersededBy: source.example.v2

New RuleSource
source: module.example@1.0
activatedBy: progression.class.example >= 5
```

Historical Character revisions keep the old source relationship intact.

## Choice persistence

A Character stores the selected choice identity as source data.

Example:

```text
choiceId: class.example.level5.option
selectedOptionIds:
  - option-b
sourceModule: example.rules@1.2.0
```

The resulting RuleSources are derived from that choice.

Do not store only the final mechanic consequences, because later editing, provenance, migration, and RulesProfile re-evaluation need the original selection.

## Changing a past choice

Normal level-up and respec/retraining are separate operations.

For MVP:

- forward progression is required;
- replacing a choice is allowed only when a RulesProfile/module explicitly grants that operation;
- unrestricted editing of historical progression choices is not assumed.

If later respec support is added, it should create a new Character revision and calculate the full dependency impact rather than rewriting history silently.

## Progression draft validation

Use the same validation severity model as Character creation.

### Blocking

Examples:

- required progression ChoiceDefinition unresolved;
- prerequisite is not satisfied;
- referenced module/source is missing;
- broken property/expression reference;
- unsupported mechanic is required to determine a critical Character value.

### Warning

Examples:

- source is compatible but from a different module version than the Character previously used;
- an optional progression benefit has not been configured;
- a manual override may hide a newly changed derived value.

### Info

Examples:

- newly unlocked optional content is available;
- a source changed only descriptive metadata.

## Commit semantics

A successful level-up commit should be atomic from the Character owner's perspective.

Conceptually:

```text
validate draft
resolve all required choices
calculate new derived state
write new Character revision safely
mark draft committed
update local library index
```

If persistence fails, the previous finalized revision remains the last known-good Character.

## Character revisions

Progression makes revision history useful even before a full history UI exists.

Minimum requirements:

- stable Character ID;
- monotonically changing revision/version identifier;
- previous revision reference or recoverable previous snapshot strategy;
- timestamp;
- change kind such as `creation`, `edit`, `progression`, `migration`;
- RulesProfile version;
- relevant module identities/versions.

This supports recovery, migration, debugging, and future comparison without requiring cloud storage.

## Active-session behavior

The permanent Character remains local-first.

A progression can be prepared offline without a DM.

When a progression is committed while connected to a session:

1. write and validate the new Character locally;
2. compare RulesProfile/module/source compatibility with the session;
3. build a new Character session projection;
4. send/update that projection only when compatible;
5. keep the previous projection active or clearly block participation if required data cannot be understood safely.

The initial UI may discourage progression during active Initiative mode because it can materially change encounter state, but this should be a UX/session policy rather than a permanent storage limitation.

## Progression during Initiative

For the first implementation, a RulesProfile/session may mark progression as unavailable while Initiative mode is active.

If progression is eventually allowed mid-initiative, all resulting state changes must be represented as an explicit synchronized transaction/event, including changes to:

- maximum HP/resources;
- current resources when the profile dictates changes;
- action availability;
- action-economy capacity;
- active RuleSources;
- derived defenses and attacks.

No silent local-only combat math changes are acceptable while the shared session projection is authoritative.

## Module version and migration behavior

Characters retain the module/version identity that supplied each selected source.

When progressing later:

- an old version may still be used if installed and compatible;
- a newer module must not silently reinterpret past selections;
- migration to new content semantics should be explicit when it changes mechanical meaning;
- missing required source content creates an actionable error;
- newly installed optional modules may add legal choices without changing previously committed choices automatically.

## UX integration with Character sheet

A completed Character should make progression history understandable without making the normal sheet noisy.

Potential progressive-disclosure view:

```text
Progression
Character 5
Example Class 5

Recent change
Level 4 -> 5
+ Feature X
+ Action Y
Resource max 3 -> 4
[View details]
```

The detailed view reuses provenance and source/module identities.

## Acceptance scenarios

The implementation should eventually demonstrate:

1. A progression with only deterministic grants completes without unnecessary choice screens.
2. A progression that introduces `choose 1 of 2` blocks commit until one option is selected.
3. A new source automatically changes several dependent stats without manual edits.
4. A resource maximum change follows an explicit RulesProfile policy for current state.
5. A source upgrade marks the previous source superseded rather than deleting provenance.
6. Cancelling a ProgressionDraft leaves the finalized Character unchanged.
7. Closing and reopening the app restores an incomplete ProgressionDraft.
8. Commit creates one coherent Character revision.
9. Missing required module data produces a validation issue instead of silently flattening the result.
10. When connected to a session, a committed progression is compatibility-checked before replacing the session projection.

## Relationship to other design contracts

This design depends on:

- Character creation/editing UX;
- RuleSource/provenance/action-economy;
- RuleModules/ContentCatalog/ChoiceDefinition;
- Predicate/Timing and the future common Rule Definition Specification;
- RulesProfile-specific progression semantics.

It does not introduce a parallel progression-only mechanics language.
