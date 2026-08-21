# UI Reference Prototype — Mock Data Contract

Status: **Synthetic presentation data only — reconciled for mapless Core**

The Reference Prototype needs believable data so the owner can judge density, hierarchy, targeting, privacy and visible state.

This file defines safe synthetic fixtures. It does **not** define SimpleVTT domain schemas and MUST NOT be copied into production as authoritative data modeling.

Cross-source baseline: [`../INTEGRATED-PRODUCT-UX-PLAN.md`](../INTEGRATED-PRODUCT-UX-PLAN.md)

Rebuild contract: [`PROTOTYPE-REBUILD-CONTRACT.md`](PROTOTYPE-REBUILD-CONTRACT.md)

---

# 1. Core rule

Prototype fixtures supply presentation answers. Prototype logic does not derive them.

Fixture values may include:

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

Prototype JavaScript MUST NOT calculate these from D&D rules, visual position, physics, network authority or hidden data.

---

# 2. MAPLESS fixture boundary

Core Actor fixtures MUST NOT contain tactical spatial placement.

Forbidden for routine Core Play fixtures:

```text
sceneX
sceneY
x
y
gridX
gridY
tile
hex
worldPosition
tokenPosition
movementPath
losRay
visionPolygon
rangeCircle
fogState
collisionShape
```

Do not encode a hidden battlemap in fixtures under different names.

The central prototype Play Context may use non-semantic visual decoration, but Actor identity/state lives in Actor Boards/cards and authoritative/manual fact fields.

Allowed optional advanced spatial facts when explicitly needed for a review scenario:

```text
actorAId
actorBId
distanceDisplay
visibilityState
coverState
manualFactNote
```

These are relationship/fact inputs, not coordinates. Prototype code does not derive them geometrically.

---

# 3. Synthetic session

Primary session fixture:

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

Required variants:

- zero-player immediately-live Host;
- live Freeform Player join;
- live Initiative Player join;
- reconnecting;
- disconnected/recoverable;
- incompatible/blocking.

No Spectator / Co-DM / Observer fixture exists in v1.

No Lobby/Ready fixture is used as the normal product lifecycle.

---

# 4. Synthetic Characters

Use fictional test Characters with varied name lengths and resource density.

## PROTO-MOCK-CHAR-01 — Rowan Ash

```text
Display: Rowan Ash
Summary: Fighter 5
HP: 38 / 44
Temp HP: 4
Conditions: none
Sheet layouts: Official-style + SimpleVTT
Portrait: generated placeholder/gradient initials
```

## PROTO-MOCK-CHAR-02 — Mina Vale

```text
Display: Mina Vale
Summary: Wizard 5
HP: 21 / 28
Temp HP: 0
Conditions: Concentrating
Resources: multiple mock spell/resource rows
```

## PROTO-MOCK-CHAR-03 — A Very Long Character Name For Truncation Review

Used only for wrapping/truncation/narrow-layout stress.

No fixture number is official D&D/stat truth.

---

# 5. First-run fixture

Required first-run fixture state:

```text
firstRunTutorialComplete: false
initialSheetLayout: unset
```

Tutorial choice examples:

```text
initialSheetLayout: official
initialSheetLayout: simplevtt
```

The prototype may persist this choice only inside mock UI state for the review session. It does not write real app preferences.

A returning-user fixture may set:

```text
firstRunTutorialComplete: true
initialSheetLayout: official | simplevtt
```

---

# 6. Synthetic Actors — cards, not map tokens

Primary Actor set:

### Allied

- Rowan Ash — controlled by Client 1
- Mina Vale — controlled by Client 2
- Lantern Guard — additional Actor usable in mock DM-control scenario

### Neutral

- Archivist Nera

### Hostile

- Ash Raider
- Iron Hound
- Long-Name Hostile Captain of the Eastern Gate

Fixture fields may directly supply:

```text
id
name
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
portraitKey
```

Actor fixture fields do **not** include central-stage/map coordinates.

Do not calculate target validity from display order, distance, cover or stats.

---

# 7. Synthetic capabilities

Use simple recognizable capability names without pretending fixture formulas are canonical rules.

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

Prototype must not decide which capability is legal.

The normal capability presentation follows the current reviewed direct-discovery Hotbar direction; a fixture must not force a historical intent-first primary funnel.

---

# 8. Target eligibility / manual area fixture

Targeting data may explicitly supply:

```text
capabilityId
targetEligibility:
  actor-id-A: { valid: true }
  actor-id-B: { valid: false, reason: "Mock authoritative reason" }
```

Area-like action fixture:

```text
targetMode: multi
eligibleActorIds: [actor-a, actor-b, actor-c]
selectedTargetIds: [actor-a, actor-c]
requiresExplicitExecute: true
```

No AoE shape/template/map coordinates are used.

---

# 9. Main Hand gap fixture

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

Prototype must not select a replacement action.

---

# 10. Freeform / Initiative fixture

Freeform:

```text
mode: freeform
round: null
currentTurnActorId: null
turnEconomyVisible: false
```

Initiative:

```text
mode: initiative
round: 2
currentTurnActorId: rowan
actionEconomy: fixture-provided
initiativeOrder: fixture-provided actor IDs/values
```

Do not show fake `FREE` Action/Bonus/Reaction/Movement spend state in Freeform merely to fill the Command Center.

---

# 11. Resolution fixture

A mock submitted action may contain:

```text
actorId
actionId
targetIds[]
phase: resolving | interrupt | concentration | dice | result
conflictingControlIds[]
safeControlIds[]
finalDice[]
resultSummary
resultDetail
```

`conflictingControlIds` / `safeControlIds` exist only to visualize the reviewed selective-locking behavior while `GAP-RESOLUTION-SAFE-INTERACTIONS` is unresolved.

Prototype code must not generate these lists.

---

# 12. Dice fixture

Example:

```text
dice:
  - type: d20
    finalFace: 17
resultTotalDisplay: "24"
formulaDisplay: "d20 17 + 7 = 24"
outcomeLabel: "Mock authoritative result"
```

Multi-die example may supply multiple final faces and aggregate display explicitly.

For connected scenarios, `finalFace`, total and outcome are already-authoritative fixture data.

For Standalone review, local fixture state may model a locally generated result; prototype animation still does not become a rules engine.

Dice animation may converge to the supplied face but may not create authoritative connected results from physics.

---

# 13. Standalone Sheet roll fixture

Each Sheet roll fixture should identify the originating current Sheet control/context:

```text
rollId
label
notation
finalDice[]
resultDisplay
originSheetRegion
```

Presentation rule:

- current Sheet stays visible/stable;
- transient dice/result layer is presented over/within the same Sheet viewport;
- no fixture value requests navigation to a separate dice/result surface.

---

# 14. Visibility fixtures

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

The Player fixture collection itself should omit the private event where split-fixture presentation permits. Do not deliver a private row merely to hide it with CSS.

## Later disclosure

Fixture may explicitly add a new authorized public projection referencing the original DM event.

This tests presentation only. Real event projection remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 15. Activity history fixture

Include at least:

1. public roll/result;
2. DM-only adjudication in DM fixture only;
3. normal session status event;
4. correction/reversal referencing an earlier event;
5. later-disclosed public projection.

DM view:

- one chronology;
- Public / DM Only labels;
- filters.

Player view:

- authorized public chronology only;
- no invisible-event placeholder.

---

# 16. Handout fixture — presentation, not map

Use a synthetic letter, portrait, landscape illustration, diagram or abstract document/image made specifically for the prototype.

Do **not** use a tactical floor plan/grid image that makes the prototype read like a map VTT.

Fixture:

```text
handoutId: demo-handout-01
title: Archivist Letter
sharedMode: none | overlay | upper | full
playerLocalDismissed: true | false
zoom: local presentation value
panX / panY: local presentation value
```

`zoom/pan` applies to the local Handout image only and is not Actor spatial state.

`sharedMode` is mock state until `GAP-HANDOUT-NETWORK-CONTRACT` is resolved.

No Actor tokens/grid/targeting are layered onto the Handout.

---

# 17. Advanced spatial-fact fixture

Example:

```text
actorAId: rowan
actorBId: ash-raider
distanceDisplay: "25 ft"
visibilityState: visible
coverState: half
factSourceLabel: "Mock manual DM fact"
```

This is for the advanced DM fact panel only.

It must not be converted into Actor coordinates or geometry.

---

# 18. Connection fixtures

Provide:

```text
connected
reconnecting
disconnected
incompatible
```

For reconnecting/disconnected scenarios, preserve prior visible Session context where the scenario requires it.

Do not implement a real reconnect timer/protocol.

---

# 19. Content package fixtures

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
reason: "Mock validation: required package field missing."
```

## Unsupported Archive

```text
validation: unsupported
```

Prototype does not parse real packages or execute addon code.

---

# 20. Responsive stress fixtures

Provide:

- at least 8 Actor Cards for horizontal overflow;
- long Character/Actor names;
- at least 12 Hotbar slots;
- at least 5 resources;
- long Activity entries;
- long recoverable error message;
- multiple status indicators;
- wide Handout image.

These stress layout, not product data limits.

---

# 21. Asset rule

Prototype assets should be:

- CSS-generated;
- simple inline SVG made specifically for the prototype;
- neutral/generated geometric/illustrative placeholders;
- user-provided or explicitly licensed assets if added later.

Do not copy copyrighted game UI/art assets merely to look closer to another product.

Do not use a fake battlemap visual as generic filler.

---

# 22. Fixture file shape

Fixtures MAY be plain JavaScript objects such as:

```js
window.PROTOTYPE_FIXTURES = {
  tutorial: {},
  sessions: {},
  characters: {},
  actors: {},
  capabilities: {},
  targetEligibility: {},
  resolutions: {},
  activity: {},
  handouts: {},
  spatialFacts: {},
  content: {},
};
```

This is prototype convenience only.

It MUST NOT be treated as a production schema.
