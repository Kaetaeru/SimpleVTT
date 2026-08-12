# Combat and Activity UX

This document defines the canonical player/DM interaction model for actions, dice presentation, logs, calculation inspection, targets, and fast corrections.

## 1. Primary UX goal

During play, SimpleVTT should feel action-first rather than form-first.

The normal flow is:

```text
select target
-> select Action
-> answer only real choices
-> authoritative dice/result presentation
-> state changes commit
-> compact activity card
-> expand only when explanation is needed
```

Routine arithmetic should not require manual input when the system already has the necessary Character, Combatant, RuleSource, item, Resource, EffectInstance, and situational data.

## 2. Player play surface

The main play surface prioritizes:

- Character identity;
- HP/temp HP;
- key defenses;
- current Resources;
- active Effects/conditions;
- selected target(s);
- commonly available Actions/Reactions;
- action-economy state in Initiative;
- recent activity/roll log.

The full Character editor remains available but is not the primary interaction surface during play.

Example:

```text
Aelar                      HP 32 / 41
AC 18                      Speed 30

ACTIVE EFFECTS
[ Bless ] [ Haste ]

ACTIONS
Longsword        +8      [Attack]
Longbow          +9      [Attack]
Spell            DC 16   [Cast]
Healing                  [Cast]

TARGET
Goblin A                    [Change]
```

## 3. Action preview

Before commit, the Action preview should show enough context to understand what will happen without dumping the entire rule graph.

Example:

```text
Longsword -> Goblin A

Current attack plan
1d20 + 8 + 1d4
Advantage

Costs
Action x1

[Roll]
```

Unavailable Actions remain visible when useful, but clearly explain why they cannot currently be used.

Example:

```text
Example Reaction
Unavailable
Reason: Reaction economy already spent
Resets: next RulesProfile-defined reset
```

## 4. Multi-target UX

Actions may target one or many entities.

Without a tactical map, area-like Actions use a manual target-selection list.

Example:

```text
Targets
☑ Goblin A
☑ Goblin B
☑ Goblin C
☐ Ally A

[Resolve for 3 targets]
```

The result card groups per-target outcomes without hiding shared rolls.

## 5. Authoritative dice presentation

Dice animation is presentation only.

The rules engine determines authoritative dice outcomes once and stores structured dice records in the ResolutionEvent. The visual layer renders those outcomes.

Requirements:

- visible rolling motion/feedback;
- individual die faces remain inspectable;
- selected/discarded dice can be shown for advantage/disadvantage-like rules;
- multiple dice may be grouped by purpose or damage type;
- animation can be skipped/shortened;
- reduced-motion preference is respected;
- replay/log rendering never generates new random values.

## 6. Activity log

Use a compact activity feed inspired by the usefulness of Roll20/FVTT-style logs without copying their UI.

The log is not combat-only. It covers Freeform and Initiative activity through the same ResolutionEvent family.

Examples:

```text
Aelar — Perception
14 + 5 = 19
```

```text
Mira — Healing -> Thorin
Slot 2: 2 -> 1
Heal 8
HP 17 -> 25
```

```text
Initiative Started
Round 1
```

```text
Aelar — Longsword -> Goblin
Attack 17 + 7 + Bless 3 = 27 — Hit vs AC 18
Slashing 9 + Fire 6 -> Fire resistance 3 — 12 total
Temp HP 5 -> 0, HP 24 -> 17
```

## 7. Collapsed result card

A compact card normally shows:

- actor;
- Action/Activity;
- target(s);
- primary dice/total;
- hit/save/check result;
- final damage/healing/state summary;
- important DM adjudication badge when present.

The card must be reconstructable from committed ResolutionEvent data alone.

## 8. Expanded calculation detail

Expansion shows ordered provenance, not just a flattened formula.

Useful details include:

- dice faces and selected/discarded dice;
- attack/check/save base;
- proficiency/item/feature/effect/situational contributions;
- Predicate/activation failures when relevant;
- advantage/disadvantage sources and cancellation;
- target defense calculation;
- critical/result policy;
- each damage/healing component;
- resistance/immunity/vulnerability decisions;
- temp HP then HP application;
- Resource/economy/item charge changes;
- generated/removed EffectInstances;
- calculated versus DM-adjudicated outcome;
- source/module/version links.

The UI should answer:

- Why is this +11?
- Why did this source not apply?
- Why was this damage halved?
- Why can I not use this Action?
- Why did this Effect expire?

without requiring manual recalculation.

## 9. Stat inspection

The same provenance renderer is used outside the log.

Example:

```text
AC 14

Base                        10
Leather Armor               +2
Magic Effect                +2
Other Shield Effect         +2   suppressed: stacking rule
```

Do not build separate calculation systems for Character sheet and activity log.

## 10. Reaction/interrupt UX

A PendingResolution may pause at a legal TimingPoint.

Example:

```text
Goblin attacks you
Current attack result: 18
Current AC: 16

Available reaction
[Use Shield-like reaction]
[Decline]
```

The prompt should explain:

- why it appeared;
- what it costs;
- what immediate value/outcome it may change when visibility permits;
- who has authority to answer;
- what happens if declined.

Declining or cancelling never consumes the Resource/economy cost.

## 11. DM situation/ruling control

The DM needs a persistent, fast `Situation / Ruling` affordance near pending resolutions and the activity log.

Common presets:

```text
+1  +2  +3  custom
Advantage
Disadvantage
Force success
Force failure
Damage
Heal
Add/remove condition or Effect
Spend/restore Resource
```

Scope control:

```text
this Resolution only
this target
this turn/round
this Initiative
until cleared
profile-defined duration
```

The normal path must be faster than opening a raw rule editor.

## 12. DM adjudication transparency

Do not hide the engine result when the DM rules differently.

Example:

```text
Attack total: 14
Target AC: 15
Calculated: Miss
DM ruling: Hit
Reason: situational adjudication
```

Downstream mechanics resolve from the adjudicated result, while the original calculation remains inspectable.

## 13. Correction and Undo UX

A committed mistake is fixed through a correction/reversal ResolutionEvent.

Fast correction actions include:

- adjust HP/temp HP;
- add/remove damage/healing;
- restore/spend Resource or item charge;
- add/remove Effect/condition;
- correct economy;
- correct initiative/order;
- safely undo the last transaction when allowed.

A full Undo restores all reversible StateChanges from the transaction together, for example:

```text
Action economy   spent -> ready
Item charge      2 -> 3
Target HP        17 -> 24
EffectInstance   removed
```

If later dependent events make full reversal unsafe, offer an explicit correction instead of pretending history can be deleted.

## 14. Character creation and play continuity

The Character builder must produce the same structured Actions, Resources, RuleSources, ItemInstances, and provenance used here.

There is no second combat-setup pass.

## 15. Freeform UX

Freeform is the normal non-initiative surface.

- no turn banner;
- no persistent per-turn economy strip unless a profile explicitly needs one;
- checks, spells, items, healing, effects, attacks, and Activities remain usable;
- real Resources/HP/Effects still change;
- activity log remains active.

## 16. Initiative UX

Initiative adds:

- current round/turn;
- participant order;
- action-economy strip;
- reaction/interrupt availability;
- end-turn controls;
- explicit DM mode-transition authority.

The transition does not create a different rules engine.

## 17. Accessibility and speed

The play UX should support:

- keyboard navigation;
- reduced motion;
- skippable dice animation;
- compact default cards with optional detail;
- avoiding modal chains for common actions;
- responsive layout that keeps current state/action choices visible;
- human-readable validation and unsupported-mechanic messages.
