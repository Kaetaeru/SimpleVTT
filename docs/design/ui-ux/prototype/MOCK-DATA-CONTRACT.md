# UI Reference Prototype — Mock Data Contract

Status: **Synthetic presentation data only**

The Reference Prototype needs believable data so the owner can judge density, hierarchy, targeting, privacy and state presentation.

This file defines safe synthetic fixtures. It does **not** define SimpleVTT domain schemas and MUST NOT be copied into production as authoritative data modeling.

---

# 1. Core rule

Prototype fixtures supply answers. Prototype logic does not derive them.

Fixture values may include fields such as:

```text
isTargetValid
unavailableReason
mockOutcome
canExecute
conflictsDuringResolution
visibility
isCurrentTurn
isControlled
connectionState
```

These are direct presentation inputs.

Prototype JavaScript MUST NOT calculate their values from game rules or network authority.

---

# 2. Synthetic session

Use one primary review session fixture:

```text
Session name: Glass Lantern Demo
Host: Demo DM
Connection role: Host
Play role: DM
State: Live Freeform
Content snapshot: demo-snapshot-A
DM roll visibility: Public by default
```

Client fixtures:

```text
Client 1: Rowan / Player
Client 2: Mina / Player
```

A zero-player variant must also exist for immediate-live Host review.

No Spectator / Co-DM / Observer fixture exists in v1.

---

# 3. Synthetic Characters

Use fictional test Characters with varied name lengths and resource density.

## PROTO-MOCK-CHAR-01 — Rowan Ash

```text
Display: Rowan Ash
Summary: Fighter 5
HP: 38 / 44
Temp HP: 4
Conditions: none
Sheet layouts: Official-style + SimpleVTT
Portrait: generated placeholder/gradient initials, no external copyrighted asset required
```

## PROTO-MOCK-CHAR-02 — Mina Vale

```text
Display: Mina Vale
Summary: Wizard 5
HP: 21 / 28
Temp HP: 0
Conditions: Concentrating
Resources: multiple mock spell/resource rows to stress Resource Rail
```

## PROTO-MOCK-CHAR-03 — A Very Long Character Name For Truncation Review

Used only to review wrapping/truncation and narrow layouts.

No fixture number should be treated as official D&D/stat rules.

---

# 4. Synthetic Actors

Primary scene actor set:

### Allied

- Rowan Ash — controlled by Client 1
- Mina Vale — controlled by Client 2
- Lantern Guard — additional Actor assignable in mock DM-control scenario

### Neutral

- Archivist Nera

### Hostile

- Ash Raider
- Iron Hound
- Long-Name Hostile Captain of the Eastern Gate

Fixture fields should directly supply:

```text
relation: allied | neutral | hostile
isControlled
controllerLabel
isCurrentTurn
isSelected
isTargetValid
invalidReason
hpDisplay
conditions[]
initiativeDisplay
```

Do not calculate target validity from distance, cover or stats.

---

# 5. Synthetic capabilities

Use simple recognizable capability names without encoding gameplay formulas.

Suggested entries:

```text
Main Hand Strike
Quick Step
Guard
Arc Bolt
Ward
Healing Draught
Dash
Interact
```

Each capability fixture may supply:

```text
id
label
category
iconKey
shortcutLabel
costLabels[]
resourceLabels[]
targetMode: none | self | single | multi
isAvailable
unavailableReason
canExecute
```

The prototype must not decide which capability is legal.

---

# 6. Main Hand gap fixture

To visually test `GAP-MAIN-HAND-CANONICAL-RELATION`, provide two explicit fixtures.

## Available

```text
mainHandActionId: mock-main-hand-strike
mainHandAvailable: true
```

## Unavailable

```text
mainHandActionId: mock-main-hand-strike
mainHandAvailable: false
unavailableReason: "Mock authoritative state: Main Hand action is unavailable."
```

The prototype must not select a replacement action.

---

# 7. Resolution fixture

A mock submitted action may contain:

```text
actorId
actionId
targetIds[]
phase: resolving | interrupt | dice | result
conflictingControlIds[]
safeControlIds[]
finalDice[]
resultSummary
resultDetail
```

`conflictingControlIds` and `safeControlIds` exist only to visualize `ORIGIN-UX-01-21` while `GAP-RESOLUTION-SAFE-INTERACTIONS` is unresolved.

Prototype code must not generate these lists.

---

# 8. Dice fixture

Example:

```text
dice:
  - type: d20
    finalFace: 17
  - type: d6
    finalFace: 4
resultTotalDisplay: "21"
outcomeLabel: "Mock Hit"
```

`finalFace`, total and outcome are fixture data.

The prototype may animate toward the supplied final face but cannot roll random gameplay results and then treat them as authoritative.

---

# 9. Visibility fixtures

## Public event

```text
visibility: public
playerReceives: true
playerSees: true
```

## DM-only event

```text
visibility: dm-only
playerReceives: false
playerSees: false
```

Player rendering for DM-only event must produce **no placeholder row**.

## Later disclosure

Fixture may explicitly add a new public projection referencing the original DM event.

This tests presentation only. Real event projection remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 10. Activity history fixture

Include at least:

1. public roll/result;
2. DM-only adjudication;
3. normal session status event;
4. correction/reversal event referencing an earlier event;
5. later-disclosed public projection.

DM view:

- one chronology;
- explicit Public / DM Only labels;
- visibility filters.

Player view:

- authorized public chronology only;
- no invisible-event placeholders.

---

# 11. Handout fixture

Use a synthetic abstract/map-like image generated locally with CSS/SVG/placeholder geometry, not copied game/book art.

Fixture:

```text
handoutId: demo-handout-01
title: Old Observatory
sharedMode: none | overlay | upper | full
playerLocalDismissed: true | false
zoom: local presentation value
panX / panY: local presentation value
```

`sharedMode` is mock state only until `GAP-HANDOUT-NETWORK-CONTRACT` is resolved.

---

# 12. Connection fixtures

Provide:

```text
connected
reconnecting
disconnected
incompatible
```

For reconnecting/disconnected scenarios, preserve prior visible session mock context.

Do not implement a real reconnect timer/protocol.

---

# 13. Content package fixtures

Synthetic packages:

## Ember Toolkit

```text
status: installed
version: 1.2.0
updateAvailable: 1.3.0
sessionSnapshotVersion: 1.2.0
```

## Atlas Rules Pack

```text
status: disabled
```

## Broken Demo Package

```text
validation: blocking
reason: "Mock validation: required manifest field missing."
```

## Unsupported Archive

```text
validation: unsupported
```

The prototype does not parse real packages.

---

# 14. Responsive stress fixtures

Provide:

- at least 8 Actor Cards for horizontal overflow;
- long Character/Actor names;
- at least 12 Hotbar slots;
- at least 5 resources;
- long Activity entries;
- long error message;
- multiple status badges;
- Handout image with wide aspect ratio.

These exist to stress layout, not product data limits.

---

# 15. Asset rule

Prototype assets should be:

- CSS-generated;
- simple inline SVG made specifically for the prototype;
- neutral geometric placeholders;
- user-provided or explicitly licensed assets if added later.

Do not copy copyrighted UI/game assets merely to make the reference look closer to another game.

---

# 16. Fixture file shape for later HTML

When the prototype is built, fixtures MAY be represented in plain JavaScript objects such as:

```js
window.PROTOTYPE_FIXTURES = {
  sessions: {},
  characters: {},
  actors: {},
  capabilities: {},
  resolutions: {},
  activity: {},
  handouts: {},
  content: {},
};
```

This is prototype convenience only and must not be treated as a production schema.