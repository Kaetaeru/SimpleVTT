# D&D SRD 5.2.1 RulesProfile

Status: `0.1-draft`

This document defines the first concrete SimpleVTT `RulesProfile`.

The profile interprets the Common Rule Definition Specification using the rules semantics published in the official D&D System Reference Document 5.2.1. Named classes, subclasses, species, backgrounds, feats, spells, items, and monsters remain `RuleModule` content rather than resolver branches.

## 1. Identity

```text
profileId: dnd.srd-5.2.1
profileVersion: 0.1-draft
sourceDocument: System Reference Document 5.2.1
sourcePublished: 2025-05-01
sourceLicense: CC-BY-4.0
```

`profileVersion` is a SimpleVTT implementation-contract version. It is intentionally separate from `sourceDocument` version so fixing or extending SimpleVTT's interpretation does not imply that Wizards published a new SRD.

## 2. Source and licensing boundary

Official source:

```text
https://www.dndbeyond.com/srd
https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
```

SRD 5.2.1 is copyrighted material made available under Creative Commons Attribution 4.0 International. It is not public-domain content.

Before SimpleVTT distributes SRD-derived rules/content, the repository/product must include the attribution statement required by the SRD 5.2.1 Legal Information section and the applicable CC-BY-4.0 license reference.

Do not treat non-SRD D&D books, setting material, names, text, or datasets as covered merely because this profile exists.

### Source sections used by this profile

The initial semantic profile primarily maps these SRD areas:

- Playing the Game;
- D20 Tests and Proficiency;
- Actions, Bonus Actions, and Reactions;
- Exploration;
- Combat and Initiative;
- Damage and Healing;
- Character Creation and Level Advancement;
- Equipment and Magic Items;
- Rules Glossary;
- profile-relevant rest, condition, timing, and recharge rules.

The SRD also contains named character options, spells, magic items, and monsters. Those belong in the default SRD RuleModule, not this RulesProfile.

## 3. RulesProfile versus default SRD RuleModule

```text
Common Rule Definition Specification
              |
              v
dnd.srd-5.2.1 RulesProfile
  semantics / policies / registries
              |
              v
SRD 5.2.1 default RuleModule
  named declarative content
              |
              +-- class / subclass
              +-- species / background
              +-- feat / spell
              +-- equipment / magic item
              +-- condition-linked sources
              +-- Combatant definitions
```

A homebrew, expansion-style, local, or session module targets the same profile and may add content through the standard `parent`, `extends`, `replaces`, Choice option contribution, and Progression contribution contracts.

## 4. Global numeric policy

### 4.1 Integer division and multiplication

When profile rules produce a fractional game number through division or multiplication, the default policy is to round down unless a more specific rule says otherwise.

Profile policy ID:

```text
dnd.rounding.default-floor
```

This policy must be visible in provenance whenever rounding changes a result.

### 4.2 Ability scores and modifiers

Registered abilities:

```text
str dex con int wis cha
```

Minimum property paths:

```text
ability.str.score
ability.str.modifier
ability.dex.score
ability.dex.modifier
ability.con.score
ability.con.modifier
ability.int.score
ability.int.modifier
ability.wis.score
ability.wis.modifier
ability.cha.score
ability.cha.modifier
```

The standard modifier mapping is equivalent to:

```text
floor((score - 10) / 2)
```

for the normal supported score range.

The modifier is derived state. A Character stores the score/source contributions, not a manually maintained duplicate modifier.

### 4.3 Proficiency Bonus

Minimum properties:

```text
progression.character.level
proficiency.bonus
```

Character-level thresholds:

```text
levels 1-4    +2
levels 5-8    +3
levels 9-12   +4
levels 13-16  +5
levels 17-20  +6
```

Combatant/monster CR data may use the broader SRD progression through CR 30.

The same Proficiency Bonus is not added more than once to the same number merely because multiple qualifying proficiency sources exist.

Profile-supported proficiency multipliers must preserve the distinction among:

```text
0x  not proficient
0.5x profile-supported half proficiency when a RuleSource grants it
1x  proficient
2x  expertise-like doubled proficiency
```

A single use of the bonus may be multiplied and/or divided only according to supported RuleSources and profile policy; multiple sources do not implicitly stack into arbitrary repeated multiplication.

## 5. D20 Test model

The profile recognizes three primary D20 Test families:

```text
ability-check
saving-throw
attack-roll
```

Canonical pipeline:

```text
collect context
-> collect applicable RuleSources
-> resolve Advantage/Disadvantage state
-> generate authoritative d20 record(s)
-> choose kept d20
-> add relevant ability modifier
-> add proficiency contribution when applicable
-> add other ordered modifiers/dice
-> compare against DC/AC or rule-defined outcome
-> open supported interrupt/adjudication windows
-> commit result through ResolutionEvent
```

### 5.1 Advantage / Disadvantage

Roll state registry:

```text
normal
advantage
disadvantage
```

Policy:

- one or more Advantage contributions produce Advantage;
- one or more Disadvantage contributions produce Disadvantage;
- Advantage and Disadvantage present together cancel to normal;
- repeated same-side contributions do not cause additional d20s by default;
- provenance retains every contributing source, including suppressed duplicates/cancellation.

This is a profile stacking rule, not a UI shortcut.

### 5.2 Checks and saves

Minimum properties:

```text
check.<ability>
save.str
save.dex
save.con
save.int
save.wis
save.cha
skill.<registered-skill>
```

Skills are profile/category metadata linking a skill identity to its usual ability while still allowing a rule/GM context to request another supported ability when appropriate.

A save can be automatically failed only when an explicit rule, condition, effect, or DM adjudication says so. It is not inferred merely from low statistics.

### 5.3 Attack rolls

Minimum semantic inputs:

```text
attacker
attack source/action
attack kind
target
relevant ability
proficiency applicability
range/reach context
roll state
bonuses/penalties
critical/result policies
```

Weapon and spell attack specifics remain declarative Action/Item/RuleSource data.

## 6. Initiative and SessionMode

SimpleVTT retains the existing generic modes:

```text
Freeform
Initiative
```

SRD 5.2.1 combat semantics map onto `Initiative`; exploration and other non-ordered play remain `Freeform`.

### 6.1 Starting Initiative

Default Initiative check:

```text
Dexterity ability check
```

The result becomes the participant's initiative count. Ordering is highest first.

Tie resolution is an explicit DM/player ordering choice rather than an invisible random tiebreaker.

A surprised participant receives the profile-defined disadvantage contribution to the Initiative roll. Surprise is state/context, not a third SessionMode.

### 6.2 Turn / round lifecycle

Minimum TimingPoints:

```text
initiative.before-start
initiative.started
round.started
turn.started
turn.before-action-window
turn.ending
turn.ended
round.ended
initiative.ending
initiative.ended
```

Exact resolver interrupt points from the Common Specification remain available around rolls, outcomes, damage, and state application.

### 6.3 Economy buckets

Initial Initiative economy ledger:

```text
action        capacity 1 per turn
bonus-action  capacity 1 per turn, usable only when a rule grants a Bonus Action option
reaction      capacity 1 until reset at start of owner's next turn
movement      budget derived from applicable Speed
```

An Action/Reaction definition declares its cost rather than the UI deciding it.

Rules may modify capacities or permissions through normal Mechanics. The generic engine must not assume that capacity can never change.

### 6.4 Freeform economy policy

Freeform does not keep turn-limited buckets permanently spent.

Policy:

- real Resources, HP, item quantities, charges, and EffectInstances remain persistent;
- an action-like Activity can still require time, targets, Resources, and legality;
- Initiative-only economy spends are not carried forward as a perpetual Freeform spent state;
- a RuleSource may explicitly restrict an Action to Initiative or provide another Freeform timing/cost model.

## 7. Damage and healing

### 7.1 Damage components

Damage is represented as typed components rather than one untyped final integer.

Minimum component shape:

```text
damageType
rolledValue / fixedValue
source
modifiers
criticalEligibility
targetAdjustmentTrace
```

The profile registers the SRD damage-type identities used by default content. RuleModules reference those IDs.

### 7.2 Saving-throw damage to multiple targets

For a single damaging effect that calls for simultaneous saves by multiple targets, the profile must support one shared damage roll with independent per-target save/outcome and defensive adjustments.

This is a required golden scenario because it exercises multi-target Resolution without requiring a tactical map.

### 7.3 Critical hits

Initial critical policy for attack damage:

- qualifying attack damage dice are rolled twice;
- ordinary flat modifiers are added normally rather than doubled;
- additional eligible damage dice supplied by the attack may also be doubled;
- individual RuleSources may define exceptions through explicit supported mechanics;
- provenance identifies which dice were duplicated and why.

Critical determination is a profile/result policy; visual dice animation never independently decides it.

### 7.4 Resistance / Vulnerability / Immunity

Typed defensive states are source-attributed and profile-resolved.

Initial application order for a damage component:

```text
1. ordinary adjustments / bonuses / penalties / multipliers
2. Resistance
3. Vulnerability
4. final damage application
```

Immunity prevents the relevant damage or condition effect according to its typed immunity rule.

Multiple Resistance sources against the same damage instance do not repeatedly halve it. Multiple Vulnerability sources likewise do not repeatedly double it unless future explicit supported rules say otherwise.

Every suppressed duplicate remains inspectable in provenance.

### 7.5 Healing

Healing cannot raise current HP above the target's current HP maximum unless a specific supported rule changes the maximum or otherwise says so.

Healing and Temporary Hit Points are different state operations.

### 7.6 Temporary Hit Points

Minimum properties/state:

```text
hp.current
hp.maximum
hp.temporary
```

Policy:

- incoming damage removes Temporary HP before ordinary HP;
- leftover damage carries to ordinary HP;
- separate grants of Temporary HP do not add together by default;
- when a new grant competes with existing Temporary HP, the affected player/authority receives the profile-defined keep-or-replace choice when needed;
- Temporary HP are not healing;
- the default SRD lifetime ends when depleted or at the relevant Long Rest boundary unless another source provides a different supported duration.

## 8. Zero-HP and death-state boundary

The profile must eventually represent the SRD character zero-HP/death-save lifecycle, but the first vertical slice may stage it behind capabilities.

Initial required capability split:

```text
dnd.hp.basic
dnd.hp.zero-state
dnd.death-saves
```

`dnd.hp.basic` is required for the first attack/damage slice. `dnd.hp.zero-state` and `dnd.death-saves` may land immediately after the base Resolver if they make the first slice unnecessarily large.

Combatant death-at-zero versus player-character death-save behavior must be profile/content policy, not a hard-coded entity-type assumption that the DM cannot override.

## 9. Conditions

Conditions are RuleSource/EffectInstance-backed rule state.

The profile registers condition identities and their semantics. A condition can contribute:

- Action restrictions;
- movement/speed changes;
- roll-state changes;
- automatic save outcomes;
- attack outcome/critical changes;
- visibility/targeting effects;
- other supported properties and permissions.

Named condition mechanics belong in the SRD default module/profile data layer and must use common Mechanics rather than condition-name branches in React or the resolver.

## 10. Progression

### 10.1 Tracks

Minimum tracks:

```text
progression.character.level
progression.class.<classId>.level
```

Subclass content may read parent class progression through a stable context relationship without owning a duplicate class progression table.

Multiclassing therefore composes multiple class tracks under one Character-level track.

### 10.2 Character level

Initial supported Character progression is levels 1 through 20.

Character-level progression controls shared policies such as Proficiency Bonus thresholds and content prerequisites that explicitly reference Character level.

### 10.3 Grants and choices

At a threshold:

```text
deterministic grants -> apply automatically
real decisions        -> ChoiceDefinition
```

A level-up is committed as one Character source revision after all blocking choices/validation pass.

### 10.4 Cross-module progression

The profile explicitly supports the Common Specification content-relationship contract:

- a homebrew subclass may attach to a class supplied by another module;
- an external module may contribute a new option to a class/species/feat-related ChoiceDefinition;
- subclass features may activate at parent-class progression thresholds;
- missing parent/extension point/version is a validation problem rather than a silent omission.

## 11. Rest, recovery, and time

Rest is modeled as profile-defined Freeform Activities rather than new SessionModes.

Initial activity IDs:

```text
dnd.activity.short-rest
dnd.activity.long-rest
```

They expose timing hooks such as:

```text
rest.short.started
rest.short.completed
rest.long.started
rest.long.completed
```

Resources declare recovery rules against these lifecycle events.

Examples the engine must support declaratively:

```text
restore one use on Short Rest
restore all uses on Long Rest
reconfigure a choice on Long Rest
end an EffectInstance on Long Rest
```

Time-based item recharge such as dawn-style refreshes must use a generic profile time/recharge trigger rather than item-name code.

## 12. Item activation and magic-item policy

The profile recognizes common activation concepts through the generic ActivationState system:

```text
equipped
wielded
carried
attuned
selected-mode
enabled
suppressed
```

Not every item uses every state.

An ItemDefinition can grant passive RuleSources, Actions, Reactions, Resources/charges, configuration Choices, and EffectInstances.

Attunement-like requirements are profile-supported predicates. An item can still provide nonmagical/base behavior while its attunement-gated magical contributions remain inactive when the definition says so.

Attunement count/limit semantics belong to this profile and profile data, not generic engine code.

## 13. AC and defense formula candidates

`defense.ac` uses formula-candidate semantics rather than assuming every contribution is additive.

A candidate may represent concepts such as:

```text
base formula
armor formula
unarmored formula
special transformation formula
```

The profile selects among valid candidates according to explicit priority/compatibility rules, then applies compatible additive modifiers.

Equipment/content supplies the formulas and predicates; the profile supplies the candidate-resolution semantics.

This is required so adding a new homebrew armor or feature does not require editing AC code.

## 14. Predicate/operator requirements

Minimum operators/capabilities for the first executable profile:

```text
all
any
not
eq
ne
lt
lte
gt
gte
contains
exists
has-tag
activation-is
mode-is
source-active
resource-at-least
progression-at-least
relation-matches
```

Context references must cover at least:

```text
actor
target
action
item/effect source
session mode
turn owner
progression
resource/economy state
```

## 15. TimingPoint requirements

Minimum profile/common TimingPoints needed before the first Resolver slice:

```text
action.declared
targets.selected
roll.before
roll.generated
roll.after
outcome.before-determine
outcome.determined
damage.before-roll
damage.rolled
damage.before-apply
state.before-apply
state.applied
action.resolved
initiative.before-start
initiative.started
round.started
turn.started
turn.ending
turn.ended
round.ended
initiative.ended
rest.short.completed
rest.long.completed
effect.expiring
effect.expired
```

The exact registry names may change before schema freeze, but each semantic boundary must have one stable registered identifier in the executable profile.

## 16. Content categories

Initial category registry:

```text
class
subclass
species
background
feat
spell
item
condition
combatant
feature
option
```

`option` is a generic profile category for reusable content entries that contribute to extensible ChoiceDefinitions, such as fighting-style-, metamagic-, invocation-, lineage-, or similar option families.

Those examples do not become special resolver types.

## 17. Extension points

The default SRD module may publish stable extension points such as:

```text
class:<id>:subclass-options
class:<id>:feature-options:<choiceId>
species:<id>:lineage-options
feat:eligible-options:<contextId>
spell:eligible-options:<contextId>
```

Exact IDs belong to the RuleModule schema/content, not this document. The profile only defines the allowed category relationships and validation semantics.

The user interface resolves the active `ContentCatalog`; it never owns a static list of official options.

## 18. Default SRD RuleModule boundary

Proposed module identity:

```text
moduleId: dnd.srd-5.2.1.core
moduleVersion: 0.1-draft
rulesProfile: dnd.srd-5.2.1
sourceDocument: SRD 5.2.1
license: CC-BY-4.0
```

The initial module import effort should prioritize content needed by golden scenarios and the vertical slice rather than converting all 364 pages before implementation begins.

Suggested initial content subset:

```text
one or more representative classes
one representative subclass relationship
one species/background path
one feat/option Choice contribution
basic weapons and armor needed by attack/AC tests
one charge-based magic item
one reaction-producing source
several representative Combatants
a minimal set of conditions/effects used by tests
```

The architecture must permit the rest of SRD content to be added incrementally without schema redesign.

## 19. Capability set

Initial profile capability IDs:

```text
dnd.ability-modifier.v1
dnd.proficiency.v1
dnd.d20-test.v1
dnd.advantage-disadvantage.v1
dnd.ac-formula-candidate.v1
dnd.initiative.v1
dnd.economy.action-bonus-reaction.v1
dnd.damage.typed.v1
dnd.damage.critical.v1
dnd.damage.resistance-vulnerability-immunity.v1
dnd.hp.basic.v1
dnd.temp-hp.v1
dnd.rest.short-long.v1
dnd.progression.multitrack.v1
dnd.item.activation-attunement.v1
dnd.content.cross-module-contribution.v1
```

Additional capabilities are introduced only with a concrete rule/scenario and versioned as needed.

## 20. Required golden scenarios

Before treating this profile as executable, tests should cover at least:

1. ability modifier and Proficiency Bonus provenance;
2. skill/save D20 Test with proficiency;
3. Advantage plus Disadvantage cancellation while preserving all sources;
4. Initiative order with a surprised participant;
5. normal turn economy and Reaction reset at next-turn start;
6. AC formula candidate plus compatible item/effect modifier;
7. weapon attack hit/miss;
8. Critical Hit duplicates eligible dice but not ordinary flat modifiers;
9. shared damage roll against multiple saving-throw targets with mixed outcomes;
10. typed damage ordered through adjustment -> Resistance -> Vulnerability;
11. Immunity prevents a typed damage/condition application;
12. Temporary HP absorbs damage and competing temp-HP grants create the required choice;
13. Short/Long Rest resource recovery;
14. charge-based ItemInstance use commits cost and effect atomically;
15. homebrew subclass attaches to a class from the default module;
16. external module contributes a Choice option without replacing the base ChoiceDefinition;
17. subclass Progression contribution activates at a parent-class threshold;
18. missing parent/version/capability rejects or disables content explicitly;
19. Freeform -> Initiative -> Freeform preserves durable HP/resources/effects;
20. DM adjudication can override a calculated outcome without erasing the calculated provenance.

## 21. First implementation gate

The profile is ready to drive the first code slice when:

- profile identity/source/license metadata are stable enough to persist;
- initial Property registry is encoded;
- D20/Advantage/Proficiency policies are encoded;
- Initiative/economy lifecycle is encoded;
- typed damage/critical/RVI/temp-HP policies are encoded;
- required Predicate/Timing registries are encoded;
- initial Progression/rest/item activation semantics are encoded;
- Default SRD RuleModule schema boundary is encoded;
- the first golden scenarios pass deterministically.

Full SRD content conversion is not a prerequisite for this gate.

## 22. Explicit non-goals

This profile does not authorize or require bundling:

- non-SRD Player's Handbook content;
- non-SRD Dungeon Master's Guide content;
- non-SRD Monster Manual content;
- setting-specific proprietary material;
- arbitrary executable rules plugins.

If later user-supplied content references mechanics not representable by the current profile, preserve it for inspection when safe and report the missing capability rather than approximating it silently.
