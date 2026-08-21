# SimpleVTT Interaction / State / Layer / Motion Contract

Status: **Derived from accepted integrated reference; implementation-facing; not Frozen**

Accepted reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

This contract defines interaction precedence, visible states, layer coexistence and motion behavior that runtime UI must preserve.

It does not define gameplay legality, network authority or persistence semantics.

---

# 1. Interaction precedence

## Actor-card primary click order

When an Actor Card is clicked, interpretation follows this priority:

```text
1. selected-action targeting
2. explicit DM control mode
3. ordinary context/selection behavior
4. combat hostile default Main Hand behavior only where the canonical relation permits it
```

A lower-priority interpretation must not fire when a higher-priority mode is active.

### Selected-action targeting

If an action is selected:

- UI reads authoritative eligibility for the clicked Actor;
- invalid target remains visible and exposes supplied reason;
- valid single target submits immediately;
- valid multi target toggles membership in the selected target set until Execute.

### DM control mode

When explicit DM control mode is active and no action is targeting, Actor click changes DM control/context according to authoritative/session rules.

It must not accidentally invoke hostile default attack first.

### Default hostile click

Only applies when:

- no action is targeting;
- no higher-priority explicit control interaction is active;
- authoritative application state provides a canonical Main Hand executable relation;
- target is authoritative-valid.

No smart fallback.

---

# 2. Standalone dice interaction

All ordinary Sheet rolls use one interaction pattern.

```text
user invokes roll from current Character Sheet
-> current Sheet remains mounted
-> transient dice layer begins inside/over current Sheet viewport
-> dice move from visual depth/back toward near/front
-> dice settle to supplied/local result
-> compact result becomes readable in same Sheet context
-> transient layer clears automatically
-> user continues on exact same Sheet
```

Must not:

- navigate;
- open modal/drawer;
- create detached result page;
- require Close/Back to resume Sheet;
- resize/push the Sheet to make a permanent dice tray.

Roll animation must not become the rules authority.

---

# 3. Connected action lifecycle

Presentation lifecycle:

```text
Idle
-> Capability Selected
-> Targeting if needed
-> Submitted / Resolving
-> Required Response if any
-> Dice Presentation if any
-> Immediate Result
-> stable Play context / durable Activity
```

The Play workspace remains recognizable throughout.

## Stable anchors during normal resolution

Preserve:

- upper Actor Board;
- central Play Context orientation;
- lower Actor Board;
- Command Center skeleton;
- relevant connection/session status.

A routine resolution must not replace the app with a separate resolution screen.

---

# 4. Selective locking

During an authoritative PendingResolution, UI locks only interactions identified as conflicting by the authoritative/application contract.

It may leave non-conflicting interactions usable.

UI must not implement:

```text
if resolution exists -> disable whole HUD
```

UI also must not calculate the conflict boundary itself.

Runtime blocker:

```text
GAP-RESOLUTION-SAFE-INTERACTIONS
```

Until resolved, production code must not guess this contract.

---

# 5. Reaction / Interrupt / Concentration

Required response UI appears inside current Play context and temporarily becomes the interaction focus.

It should explain only supplied/public information:

- why a response is requested;
- available response choices;
- cost/resource where known and authorized;
- decline/cancel where legal;
- supplied authoritative reason/state.

UI must not invent:

- timeout;
- DC;
- modifier;
- reaction legality;
- concentration legality;
- hidden rule values.

Required response may outrank normal utility/hover layers but should preserve spatial orientation to the surrounding Play workspace.

---

# 6. State vocabulary

The runtime visual system must support distinct states where applicable.

## Generic interaction

```text
default
hover
focus-visible
pressed
selected
disabled
unavailable
pending
```

`disabled` and `unavailable` are not necessarily equivalent: unavailable commonly needs a supplied reason.

## Actor

```text
controlled
current turn
selected
context focus
target valid
target invalid
target selected
```

Do not merge these into one generic selected/highlight state.

## Action

```text
idle
selected
targeting
submitted
resolving
unavailable
```

## Session

```text
offline
connected
reconnecting
disconnected
incompatible/rejected
live
```

## Role

```text
Host / DM
Client / Player
Offline with no DM/Player identity
```

No connected Host/Player or Client/DM state.

## Visibility

```text
Public
DM Only
```

Player-visible UI must not contain an existence marker for undelivered DM-only authoritative events.

---

# 7. Freeform vs Initiative state

## Freeform

Do not show fake spent/available turn economy as if a turn is active.

Command Center remains structurally stable, but economy presentation is neutral/non-turn-based.

## Initiative

May activate:

- compact Initiative Tracker;
- current turn;
- Action / Bonus Action / Reaction / Movement economy;
- End Turn;
- turn-specific state emphasis.

Initiative does not replace Actor Boards or Command Center.

---

# 8. Layer model

Layer numbers describe priority/coexistence, not implementation z-index constants.

## L0 — Base surface

Examples:

- Home;
- Character Sheet;
- Connected Play.

## L1 — Persistent anchors/status

Examples:

- Product navigation;
- Play chrome;
- Actor Boards;
- Command Center;
- Initiative Tracker when active;
- persistent NOTICE/status.

## L2 — Contextual utility

Examples:

- Activity;
- Encounter;
- Participants;
- Session;
- Rules lookup;
- Quick Sheet;
- advanced DM facts.

One primary utility per dock region by default; switching replaces rather than endlessly stacking.

## L3 — Anchored transient UI

Examples:

- tooltip;
- rich hover/focus frame;
- Actor Context Menu;
- small popover/listbox.

## L4 — Major contextual presentation

Examples:

- Full Character Sheet;
- Handout Upper;
- Handout Full.

Live session state remains active underneath.

## L5 — Resolution / response / dice / result

Examples:

- resolving;
- Reaction/Interrupt;
- Concentration;
- dice;
- immediate result;
- Standalone transient dice over current Sheet.

## L6 — Confirmation

Examples:

- destructive Session end;
- unsaved change;
- high-impact correction where contract requires confirmation.

Routine valid target execution does not use this layer.

## L7 — System blocker

Reserved for incompatible/unsafe-to-continue states with explicit recovery/exit.

Do not use for ordinary validation.

---

# 9. Layer dismissal / Escape contract

Default behavior unless a stronger canonical contract says otherwise:

| Layer | Escape | Outside click | Focus containment | Return focus |
| --- | --- | --- | --- | --- |
| L2 utility | close when safe | usually no | no | launcher/context |
| L3 tooltip | clear | n/a | no | unchanged |
| L3 popover/menu | close | yes by default | no | invoker |
| L4 Full Sheet | return when safe | no | contained workspace behavior | prior Play context |
| L4 Handout Upper/Full | Player Escape does not withdraw shared state | no | local controls only | local context |
| L5 required response | only when contract permits cancel | no | may focus response | resolution context |
| L6 confirmation | Cancel if allowed | normally no | yes | invoker/logical next |
| L7 blocker | recovery/exit only | no | yes | recovery-defined |

---

# 10. Handout interaction

## Overlay

Player local dismiss/minimize/reopen changes local presentation only.

It does not necessarily withdraw DM shared state.

## Upper / Full

Shared DM-controlled presentation remains until authoritative shared state changes.

Player local Escape must not silently withdraw the shared Handout.

Zoom/pan may remain local visual state.

No map/grid/token interaction exists on Handout in Core.

---

# 11. Activity / privacy interaction

DM Activity may filter already-authorized data by:

- All;
- Public;
- DM Only.

Player Activity receives only authorized public projections.

Later disclosure appears as a new authorized projection related to prior private adjudication, not as a reroll.

Correction/reversal adds linked history; original event remains inspectable.

Runtime privacy semantics depend on:

```text
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

---

# 12. Navigation continuity

While live session exists:

- safe Product navigation may occur;
- Return to Play remains visible;
- Host/DM remains Host/DM;
- Client/Player remains Client/Player;
- session/turn/resolution authoritative state is preserved;
- transient local presentation may reset only where explicitly safe.

Closing the entire application is different: it disconnects and later launch begins at Home rather than auto-restoring the old live session.

---

# 13. Focus and keyboard behavior

Required:

- visible focus distinct from hover/selection;
- common controls keyboard reachable;
- rich hover information has focus-accessible equivalent where material;
- modal/confirmation focus contained;
- closing a pane/menu/layer returns focus to a logical prior control where practical;
- Escape follows the active interaction/layer stack rather than always navigating away.

Actor right-click Context Menu is supplementary; essential gameplay actions/information remain reachable through primary accessible UI.

---

# 14. Feedback hierarchy

Use the smallest durable channel matching the information lifetime.

```text
blocking local problem -> inline/blocking error surface
persistent current condition -> NOTICE/banner
immediate result -> current Sheet/Play context
brief acknowledgement -> toast
long-lived detail/history -> Activity
focused decision -> response/modal layer
```

Do not duplicate every message in every channel.

---

# 15. Motion timing defaults

Unless later visual tuning demonstrates a reason to change them:

```text
micro transition      ~120ms
panel/popover          ~160-180ms
large contextual layer ~220-240ms
```

These are implementation defaults, not gameplay timing.

Motion must support orientation and responsiveness, not decorate at the cost of speed.

---

# 16. Dice motion contract

Both Standalone and Connected dice use the same physical visual grammar:

```text
far/back visual depth
-> move toward near/front
-> contact tabletop-like presentation plane
-> brief bounce/roll
-> settle quickly
-> result becomes readable
-> transient dice clears
```

Connected dice settle to the authoritative final face.

Standalone dice settle to the result produced by the local roll path.

Animation never determines mechanics.

Routine rolls should avoid long cinematic delay.

---

# 17. Reduced Motion

Reduced Motion removes or minimizes nonessential displacement/rotation while preserving:

- same state sequence;
- same authoritative result;
- same information order;
- clear transition into/out of required response;
- no additional interaction requirement.

Reduced Motion must never change mechanics state or privacy behavior.

---

# 18. Responsive interaction contract

Desktop-first.

At constrained desktop widths:

- preserve core hierarchy before decorative detail;
- Actor Cards reach minimum useful width then overflow horizontally;
- Command Center remains reachable;
- utility pane may narrow/overlay without becoming mobile navigation;
- central Play Context remains a useful interaction/result area;
- tooltip/popover must remain inside viewport;
- Full Sheet/Handout may reflow without losing session continuity;
- no tactical-map/minimap fallback is introduced.

Exact breakpoints are implementation detail.

---

# 19. Interaction anti-patterns

Do not implement:

- whole-HUD lock for any resolution;
- extra confirmation after ordinary valid single-target selection;
- smart action fallback when Main Hand is unavailable;
- map-position targeting;
- UI-derived target/range/LoS legality;
- fake Initiative economy in Freeform;
- detached Standalone dice workflow;
- automatic role switching on navigation;
- DM-only hiding that still delivers/render-mounts secret Player data;
- Handout as tactical map;
- hover-only essential action/state information;
- animation that determines or delays authoritative mechanics unnecessarily.

---

# 20. Runtime blockers that remain outside UI authority

The accepted interaction design depends on contracts not yet fully runtime-ready:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

UI implementation must consume these future authoritative contracts rather than encoding prototype fixture assumptions.
