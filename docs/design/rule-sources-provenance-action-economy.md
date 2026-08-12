# Rule Sources, Stat Provenance, and Action Economy

Status: Draft for Issue #7

## Product intent

SimpleVTT should not store important combat values as unexplained flattened numbers.

Whenever the system displays or uses a calculation-relevant value, it should be possible to answer:

- What is the final value?
- Which sources contributed to it?
- Which rules transformed those contributions?
- Which potential contributions did not apply, and why?
- Which source granted the action, option, resistance, resource, or permission currently being used?
- Which action-economy and resource costs will be consumed if the user proceeds?

The same rule data should drive character creation, character inspection, combat resolution, action legality, combat logs, synchronization, and undo.

## Core invariant: source data first, resolved values second

Characters and Combatants should primarily store source choices, source records, mutable state, and explicit overrides.

Resolved values are products of the active RulesProfile plus those inputs.

A calculated value should therefore be modeled conceptually as:

```text
Resolved Property
= RulesProfile base/derivation
+ active RuleSource contributions
+ context-dependent contributions
+ explicit override when allowed
```

The implementation must not require a user to maintain both a source and a duplicated final total manually.

## RuleSource

`RuleSource` is the common origin object for mechanically relevant rules contributions.

Representative source kinds include:

- class or subclass feature;
- feat;
- species/ancestry/background feature;
- spell;
- equipment or magic item;
- condition;
- temporary spell/effect instance;
- environmental or encounter rule;
- RulesProfile base rule;
- manual/homebrew source;
- explicit override.

A RuleSource has a stable ID and a human-readable label so every resulting calculation can reference the same source consistently.

Conceptual shape:

```ts
interface RuleSource {
  id: string
  kind: RuleSourceKind
  name: string
  rulesProfile: string
  description?: string
  parentSourceId?: string
  mechanics: Mechanic[]
  metadata?: SourceMetadata
}
```

The exact TypeScript contract is deferred until the implementation issue, but the semantic boundary is fixed here.

## Mechanics are structured, not runtime prose

Human-readable description is allowed and useful, but the resolver must never need to parse prose to learn what a feat, spell, item, or condition actually does.

A RuleSource may contribute one or more typed mechanics.

Initial mechanic families should cover at least:

- `StatContribution`
- `SetMembershipGrant`
- `ActionGrant`
- `ActionModification`
- `ResourceDefinition`
- `ResourceChange`
- `EffectGrant`
- `Trigger`
- `Permission`
- `Restriction`
- `EconomyModification`
- `RollModification`
- `DamageModification`
- `ChoiceDefinition`

These are families, not necessarily final serialized names.

### StatContribution

Used for numeric or otherwise ordered properties.

Examples:

- add `+2` to a defense;
- add a die to an attack/save roll;
- replace a value;
- enforce a minimum/maximum;
- multiply a value;
- select one of several candidate formulas under RulesProfile stacking rules.

A contribution should carry at least:

```text
source
operation
value/formula
predicate/context
stacking key/group when applicable
priority when applicable
target property path
```

### SetMembershipGrant

Used for properties whose result is membership rather than arithmetic.

Examples:

- proficiency;
- expertise-like capability;
- resistance;
- immunity;
- condition immunity;
- language/sense/tool capability where mechanically relevant.

The system should still retain provenance for why membership exists.

### ActionGrant

A feat, spell, item, class feature, or other source may grant an Action that appears automatically in the user's available actions.

The Action remains linked to the source that granted it.

### Permission and Restriction

Some rules do not change a number. They change whether something is legal.

Examples:

- grant permission to perform a particular action;
- prohibit an action while a condition is active;
- restrict targets;
- require a prerequisite;
- require a particular state before an option appears;
- restrict repeated use in the same turn/round/rest interval.

The legality engine should evaluate these explicitly.

### Trigger

Triggers create rule-driven opportunities or required processing points.

Examples:

```text
on hit
on miss
after damage
before damage
on save success
on save failure
turn start
turn end
when targeted
when attacked
when a resource reaches a threshold
```

A trigger may immediately apply deterministic mechanics or create an explicit user/GM choice.

## Property paths

Rule mechanics need stable semantic targets rather than arbitrary UI field IDs.

Conceptual examples:

```text
ability.str.score
ability.dex.modifier
defense.ac
save.dex
skill.stealth
initiative
movement.walk
attack.melee.toHit
damage.fire
resource.some-resource.max
economy.some-bucket.capacity
```

The final path registry is RulesProfile-aware.

UI component names must not become domain identifiers.

## Restricted expressions, not arbitrary code

Formulas and predicates must remain declarative.

The project may eventually use a small expression AST or restricted formula language capable of referring to known property paths and context values.

It must not evaluate imported JavaScript, shell commands, arbitrary functions, or other executable code.

This applies to Character imports, Combatant imports, external-AI-authored JSON, homebrew data, and rule-content packs.

## Derivation graph

Derived properties form a dependency graph.

Example:

```text
DEX score
   -> DEX modifier
       -> initiative
       -> AC contribution
       -> ranged attack contribution
       -> DEX save contribution
```

When a source changes, only affected dependents need to be recalculated, but correctness is more important than optimization in the first implementation.

### Requirements

- dependencies are explicit or discoverable from the restricted expression representation;
- cycles are detected and surfaced as validation errors;
- recalculation is deterministic for the same RulesProfile, inputs, context, dice, and choices;
- every final property can emit a derivation/provenance record;
- provenance records are reusable by both character UI and combat logs.

## Resolved property and provenance record

A numeric property should be explainable with a structure conceptually similar to:

```ts
interface ResolvedProperty<T> {
  path: string
  value: T
  contributions: ContributionResult[]
}

interface ContributionResult {
  sourceId: string
  sourceLabel: string
  operation: string
  input: unknown
  output?: unknown
  status: 'applied' | 'suppressed' | 'superseded' | 'inactive' | 'failed-predicate'
  reason?: string
}
```

The implementation shape may change, but these semantics should remain.

## Suppression and stacking are visible

A source that exists but did not contribute should not simply disappear from debugging/explanation when it matters.

For example:

```text
Armor Class 14

Applied
Base                     10
Leather Armor            +2
Arcane Ward              +2

Not applied
Other Shield Effect      +2
Reason: suppressed by stacking rule <rule-id>
```

The RulesProfile owns the stacking/priority semantics.

The provenance layer only records and explains the decision.

## Explicit overrides

Overrides are themselves RuleSources, not secret mutations of a flattened number.

An override should preserve:

- target property;
- override value;
- original resolved value before override;
- source/reason label;
- optional notes;
- active/inactive state.

Removing the override should reveal the current normal derivation immediately.

## Feats, spells, equipment, and conditions

These entities should be mechanically complete enough for the system to manage their actual gameplay consequences when those consequences are within the supported primitive set.

A feat may, for example, provide a combination of:

```text
RuleSource: Example Feat
- grant Action X
- define Resource Y (N uses)
- add modifier under predicate Z
- create Reaction trigger
- consume economy bucket + resource on use
```

A spell may provide:

```text
RuleSource: Example Spell
- casting Action
- spell-slot/resource cost
- target definition
- save or attack Resolution components
- damage/healing/effect components
- created ongoing RuleSource/Effect after successful resolution
- duration / concentration / expiry information where supported
```

An equipment item may provide:

```text
RuleSource: Example Armor
- armor/defense contribution
- proficiency requirement/restriction
- movement/skill or other supported modifiers
- granted Action if the item has one
```

The important requirement is that the mechanical behavior is not duplicated manually across unrelated fields.

## Action economy is state

Action economy must be represented as mutable rules state that changes during encounter play.

It is not only a group of UI buttons.

The generic engine must not assume one fixed edition's exact buckets. `RulesProfile` defines the economy model.

Conceptual economy definition:

```ts
interface EconomyBucketDefinition {
  id: string
  label: string
  capacity: Formula
  reset: ResetRule
}
```

A RulesProfile might define buckets representing concepts such as ordinary turn actions, secondary actions, reactions, movement budgets, or other rule-specific economy units.

The generic engine only sees bucket definitions, costs, grants, restrictions, and reset rules.

## Economy ledger

Each encounter participant should have an economy ledger derived from the active RulesProfile plus active RuleSources.

Conceptual state:

```text
bucket
capacity
spent
reserved
remaining
sources that changed capacity/availability
reset rule
```

A ledger entry must retain enough history to explain:

- why a bucket exists;
- why it currently has its capacity;
- what consumed it;
- whether an effect granted extra capacity or an alternative option;
- when it becomes available again.

## Action cost

Every mechanically executable Action declares its costs.

Costs may include:

- one or more economy buckets;
- resources/charges/uses;
- spell-resource expenditure;
- movement amount;
- another RulesProfile-defined cost;
- optional costs offered as choices.

Example conceptual Action card data:

```text
Action: Example Strike
Granted by: Example Feat
Economy cost: primary-action x1
Resource cost: feat-use x1
Currently available: yes
```

If unavailable:

```text
Currently available: no
Reason: primary-action already spent this turn
Reset: next turn start
```

## Action legality pipeline

Before execution, evaluate at least:

1. Action exists and source is active.
2. Actor satisfies source/action prerequisites.
3. Required economy is available.
4. Required resources are available.
5. Current conditions/effects do not prohibit the Action.
6. Required target/context constraints are satisfiable.
7. Any RulesProfile-specific mutual exclusions are satisfied.
8. Optional/pre-resolution choices are identified.

The UI should use this result to determine whether an Action is enabled.

A disabled Action remains inspectable so the user can see why it is unavailable.

## Commit economy with the same transaction

Using an Action should not update action economy separately from the action's actual Resolution.

The successful committed CombatEvent transaction should include all applicable changes together, such as:

```text
economy bucket spent
resource charge spent
spell resource spent
target HP changed
condition added
ongoing RuleSource created
```

If the Resolution is cancelled before commitment, these changes should not partially leak into live state.

If the CombatEvent is safely undone, the relevant economy/resource changes should be reverted consistently with the rest of that transaction.

## Reactions and interrupts

Reactions/interrupts are Actions whose availability is evaluated at defined resolution interrupt points.

A reaction offer should carry:

- triggering event/context;
- source that grants the reaction;
- economy/resource cost;
- current legality result;
- what immediate part of the pending Resolution it may affect;
- intended recipient/owner of the choice.

Accepting a reaction creates a committed economy/resource change only when the reaction itself is committed according to the resolution pipeline.

## Turn and round lifecycle

Encounter state should expose lifecycle events such as:

```text
round start
turn start
turn end
round end
```

The actual RulesProfile decides which resets, triggers, durations, and economy changes occur at each point.

The generic engine provides the event points and deterministic ordering.

## Effects that modify action economy

RuleSources must be able to change economy without special-casing their names.

Examples of representational requirements:

- increase/decrease a bucket capacity;
- grant a one-time alternative bucket;
- allow an Action to use a different cost;
- prohibit a bucket under a condition;
- refund or restore a bucket when a trigger is satisfied;
- create a new reaction opportunity;
- change/reset availability during an active turn.

Exact legality depends on RulesProfile rules.

## Character creation integration

Character creation must store source choices and mechanically structured RuleSources.

It must not flatten a feat, spell, or item into only its description and final totals.

For example, after selecting a feat, the creation review should be able to show:

```text
Example Feat

Mechanical grants
- Action: Example Strike
- Resource: Example Uses 3/3
- Reaction: Example Defense
- Modifier: +1 to <property> while <predicate>
```

The derived-stat summary reads the same provenance graph the combat engine will later use.

## Character sheet integration

Every major calculation-relevant field should support source inspection where meaningful.

Examples:

```text
AC 14
[details]

Initiative +5
[details]

Spell/Save DC 16
[details]

Walk 30
[details]
```

The default sheet remains clean; provenance is progressive disclosure rather than permanent visual noise.

## Combatant integration

Combatant Definitions need equivalent capability for calculation-relevant RuleSources.

A Combatant JSON should eventually be able to express:

- source-attributed stats and modifiers;
- actions and reactions;
- resources;
- passive mechanics;
- triggers;
- permissions/restrictions;
- economy costs;
- reset rules where required.

The current draft Combatant schema may need migration after these contracts stabilize. That migration is expected and preferable to locking a weaker schema prematurely.

## Combat log integration

The combat log must not implement its own ad-hoc arithmetic explanation.

It should render provenance records emitted by the same resolver/property engine.

Therefore the same source IDs and labels should appear consistently in:

```text
Character sheet stat details
Action preview
Resolution detail
Combat log
Undo/debug inspection
```

## UX: action-economy strip

During encounter play, a compact strip should show the current RulesProfile-defined economy state without forcing manual bookkeeping.

Conceptual example only:

```text
TURN ECONOMY
Primary     Ready
Secondary   Spent — Example Feature
Reaction    Ready
Movement    15 / 30 remaining
```

Names and semantics are supplied by RulesProfile; the generic UI renders the active bucket definitions.

Clicking a spent/unavailable entry should show the source event and reset rule.

## UX: Action cards

Action cards should expose only important cost/legality information by default.

Example:

```text
Example Attack                Available
Cost: Primary
Resource: 2 / 3 uses
[Use]
```

Unavailable example:

```text
Example Reaction              Unavailable
Reaction already spent
Resets: next valid profile reset point
[Why?]
```

The user should not manually remember whether a supported rule option has already consumed its action economy.

## Validation requirements

Validation must detect at least:

- unknown target property paths;
- broken source references;
- cyclic derivations;
- invalid operation/value combinations;
- missing resource/economy definitions referenced by an Action;
- impossible reset references;
- duplicate IDs;
- unsupported mechanic kinds for the active RulesProfile;
- imported arbitrary executable content.

Semantic warnings may also flag suspicious but structurally valid combinations.

## Required design scenarios

Before implementation begins, this contract should support modeling these scenarios without named-rule conditionals:

### Source-by-source AC

```text
AC
Base                         10
Leather Armor               +2
Magic Effect                +2
Final                        14
```

### Suppressed contribution

```text
Candidate defense bonus     +2
Status: suppressed
Reason: RulesProfile stacking decision <id>
```

### Feat with actual mechanics

```text
Feat
 -> grants Action
 -> defines limited-use Resource
 -> grants conditional modifier
 -> creates Reaction trigger
```

### Temporary spell/effect

```text
Spell resolution
 -> creates temporary RuleSource
 -> source modifies one or more properties
 -> expiry event removes source
 -> base Character values were never destructively rewritten
```

### Economy consumption

```text
Action legal
 -> commit Action
 -> economy bucket spent in same CombatEvent
 -> Action becomes unavailable
 -> reset lifecycle event restores availability
```

### Economy-changing effect

```text
Active RuleSource
 -> changes economy capacity or grants an alternative action option
 -> ledger explains the source
 -> expiry removes the grant deterministically
```

### Undo

```text
Undo CombatEvent
 -> restore target state
 -> restore resource spend
 -> restore economy spend
 -> emit undo event so connected clients converge
```

## Implementation consequences

The first domain implementation should include a dedicated rules/provenance layer instead of letting React components calculate totals directly.

A likely package boundary is conceptually:

```text
rules-profile
rule-sources
property-resolution
provenance
action-legality
economy
resolution
combat-events
```

Actual repository package names are deferred until the application scaffold issue.

## Non-goals

- The generic engine does not hard-code a single D&D edition's action bucket names or capacities.
- The runtime does not infer mechanics by reading feat/spell prose.
- RuleSource does not mean arbitrary executable plugin code.
- Provenance is not merely debug logging; it is a first-class product capability.
- Action economy is not manually tracked UI state detached from the rules engine.

## Decisions still required before edition-specific implementation

- initial supported D&D RulesProfile;
- exact property-path registry for that profile;
- stacking/priority rules and their identifiers;
- restricted expression/predicate representation;
- initial mechanic primitive set that is considered MVP;
- lifecycle ordering for the selected RulesProfile;
- how much of spell/feat content is bundled versus manually/authored/imported.
