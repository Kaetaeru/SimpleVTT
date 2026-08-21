# UI Reference Prototype — State Model

Status: **AI Design Default / visible-state contract**

This document defines user-visible states the HTML Reference Prototype must be able to render. It does not define authoritative gameplay semantics.

The prototype receives state as mock data. It never derives D&D legality, network authority, privacy, persistence, or command-conflict truth.

---

# 1. Common interactive states

## PROTO-STATE-DEFAULT

Normal available control/object.

## PROTO-STATE-HOVER

Pointer hover. May reveal tooltip/rich explanation when appropriate.

## PROTO-STATE-FOCUS

Keyboard/focus-visible state. Must be visually distinct from hover and selected state.

## PROTO-STATE-PRESSED

Short active/pressed interaction feedback.

## PROTO-STATE-SELECTED

User-selected item/action/Actor. Selection is not the same as current turn, control ownership, or valid target.

## PROTO-STATE-DISABLED

Control cannot be invoked in the current mock context.

Use when the control remains useful to show but is not available.

## PROTO-STATE-UNAVAILABLE

Capability/object exists but authoritative/mock-provided reason says it cannot currently be used.

Must expose the supplied reason when material. The prototype does not invent the reason.

## PROTO-STATE-PENDING

A submitted local/mock operation has not completed. Prevent duplicate submit on the same operation while leaving unrelated controls available unless explicit mock conflict says otherwise.

---

# 2. Task/data states

## PROTO-STATE-EMPTY

No data exists for the surface.

Show context and next valid action where one exists.

Examples:

- no Characters;
- no installed add-ons;
- no connected Players;
- no Activity records.

## PROTO-STATE-NO-RESULTS

Data exists but current search/filter produces none. Must be distinct from true empty state.

## PROTO-STATE-VALIDATION-WARNING

Input may continue but user should understand a non-blocking issue.

## PROTO-STATE-VALIDATION-BLOCKING

Cannot proceed until corrected. Keep error near the affected input/section.

## PROTO-STATE-SAVE-ERROR

Durable save failed in a mock scenario. Prototype demonstrates preserved user input + retry/recovery presentation, not real persistence.

## PROTO-STATE-UNSUPPORTED

Content/mechanic/package is explicitly unsupported. Do not present it as a generic unknown crash.

---

# 3. Connection/session states

## PROTO-STATE-CONNECTED

Connected Host/DM or Client/Player.

## PROTO-STATE-RECONNECTING

Connection temporarily lost and recovery in progress.

Presentation:

- persistent NOTICE/status;
- preserve visible prior session context;
- disable only mock-declared unsafe submission controls;
- do not wipe the Play workspace.

## PROTO-STATE-DISCONNECTED

Not currently connected. Show recovery/rejoin/leave options appropriate to the mock scenario.

## PROTO-STATE-INCOMPATIBLE

Connection/content/version mock incompatibility prevents safe session entry. Explicit blocker + recovery/exit path.

## PROTO-STATE-LIVE-SESSION

Host has opened a session and it is already live. There is no Lobby/Ready pre-play state.

## PROTO-STATE-LATE-JOIN

A valid Client/Player joins an already-live session.

## PROTO-STATE-NO-CHARACTER-JOIN

Join is blocked because the Client has no valid Character. Show Create Character / Import Character actions, then require a new Join attempt after Character creation/import.

---

# 4. Role / visibility states

## PROTO-STATE-HOST-DM

Connected Host is DM. No connected Host/Player variant exists.

## PROTO-STATE-CLIENT-PLAYER

Connected Client is Player. No connected Client/DM variant exists.

## PROTO-STATE-OFFLINE

Standalone local product context. No DM/Player role label required.

## PROTO-STATE-PUBLIC

Public adjudication/result projection example.

## PROTO-STATE-DM-ONLY

DM-only authoritative/mock result example.

Rules for prototype split-view review:

- DM view may show the private item with explicit `DM Only` marking;
- Player view must show **no placeholder/existence marker** for the private event;
- later disclosure can add an authorized public projection;
- actual event-delivery mechanics remain blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 5. Actor / targeting states

These states must remain visually distinguishable.

## PROTO-STATE-ACTOR-CONTROLLED

Actor the current Player controls, or Actor the DM currently controls in a mock scenario.

## PROTO-STATE-ACTOR-CURRENT-TURN

Actor whose turn is current in Initiative.

## PROTO-STATE-ACTOR-SELECTED

Actor selected for inspection/context.

## PROTO-STATE-ACTOR-CONTEXT-FOCUS

Actor receiving contextual hover/focus attention without becoming gameplay target selection.

## PROTO-STATE-TARGET-VALID

Mock-provided eligibility says valid target.

## PROTO-STATE-TARGET-INVALID

Mock-provided eligibility says invalid. Keep Actor visible, dim/disable target affordance, show supplied reason.

## PROTO-STATE-TARGET-SELECTED

Valid target already chosen in a multi-target set.

## PROTO-STATE-TARGETING-SINGLE

Single-target capability selected. Clicking a valid target visually transitions to submitted/resolving without an extra confirmation.

## PROTO-STATE-TARGETING-MULTI

Multi-target capability selected. Explicit Execute appears after valid target-set selection.

---

# 6. Action / resource states

## PROTO-STATE-ACTION-IDLE

No capability selected.

## PROTO-STATE-ACTION-SELECTED

Capability selected; target/self/no-target behavior supplied by mock scenario.

## PROTO-STATE-ECONOMY-AVAILABLE

Action/Bonus/Reaction/Movement mock resource available.

## PROTO-STATE-ECONOMY-SPENT

Mock state says consumed/unavailable for the current context.

## PROTO-STATE-RESOURCE-NORMAL

Dynamic resource with current/max or count supplied by mock data.

## PROTO-STATE-RESOURCE-LOW

Optional visual emphasis when the mock explicitly flags low status. Prototype must not compute a gameplay threshold itself.

## PROTO-STATE-MAIN-HAND-AVAILABLE

Mock contract provides a canonical default Main Hand action relation.

## PROTO-STATE-MAIN-HAND-UNAVAILABLE

Mock explicitly says the canonical Main Hand default cannot execute and supplies a reason. No fallback action is chosen by prototype logic.

---

# 7. Resolution states

## PROTO-STATE-RESOLVING

Authoritative/mock action submitted. Command Center skeleton remains visible.

## PROTO-STATE-INTERRUPT

Mock resolution requests reaction/interrupt response. No timeout is invented unless the mock scenario explicitly supplies presentation-only timing.

## PROTO-STATE-CONCENTRATION-RESPONSE

Mock resolution requests concentration-save input/result.

## PROTO-STATE-DICE

Presentation phase for dice. Final die face/result already exists in mock authoritative state.

## PROTO-STATE-RESULT

Immediate scene-integrated result state with Activity/detail path.

## PROTO-STATE-CORRECTED

A prior event has a later correction/reversal event. Original remains visible/inspectable in DM Activity.

---

# 8. Initiative states

## PROTO-STATE-FREEFORM

Normal live session outside Initiative.

## PROTO-STATE-INITIATIVE

Initiative Tracker visible. Actor Boards and Command Center remain.

## PROTO-STATE-TURN-OWN

Current turn belongs to Player-controlled Actor in mock scenario.

## PROTO-STATE-TURN-OFF

It is not the Player-controlled Actor's turn. Prototype shows appropriate persistent state without assuming which commands are legally safe; safe command behavior comes from explicit mock flags/domain contract later.

---

# 9. Handout states

## PROTO-STATE-HANDOUT-NONE

No shared handout active.

## PROTO-STATE-HANDOUT-OVERLAY

Overlay presentation active. Player local dismissed/open flag may differ from shared mock mode.

## PROTO-STATE-HANDOUT-UPPER

Upper Scene mode active.

## PROTO-STATE-HANDOUT-FULL

Full Scene mode active.

## PROTO-STATE-HANDOUT-LOCAL-HIDDEN

Player locally dismissed an Overlay; shared mock mode still exists.

---

# 10. Content states

## PROTO-STATE-CONTENT-INSTALLED

Installed package.

## PROTO-STATE-CONTENT-UPDATE

Update available.

## PROTO-STATE-CONTENT-DISABLED

Installed but disabled for future sessions/library use.

## PROTO-STATE-CONTENT-VALIDATION-WARN

Package can continue with warning.

## PROTO-STATE-CONTENT-VALIDATION-BLOCK

Package cannot install/replace safely.

## PROTO-STATE-CONTENT-LIVE-SNAPSHOT

Live session uses the content snapshot captured when it opened.

If local library content changes while live:

- current live session mock snapshot remains unchanged;
- NOTICE/Session Share may explain that changes apply later;
- prototype does not mutate live session content.

---

# 11. NOTICE priority model

When multiple visible states exist, default presentation priority is:

1. Layer-6/7 blocking decision/system blocker;
2. required resolution/interrupt response;
3. persistent NOTICE condition;
4. local inline warning/error;
5. immediate result feedback;
6. short toast acknowledgement;
7. durable Activity history.

Do not show the same state in every channel unless there is a strong reason.

---

# 12. State collision examples the prototype must handle

The prototype must visually test at least:

- `CONNECTED + HOST-DM + FREEFORM + DM-ONLY`;
- `CONNECTED + CLIENT-PLAYER + INITIATIVE + TARGETING-SINGLE + TARGET-INVALID`;
- `RECONNECTING + FULL-SHEET`;
- `RESOLVING + INTERRUPT`;
- `RESOLVING + CONCENTRATION-RESPONSE`;
- `RESULT + CORRECTED` in Activity;
- `HANDOUT-OVERLAY + LOCAL-HIDDEN` for Player;
- `LIVE-SESSION + CONTENT-LIVE-SNAPSHOT + local update available`;
- `NARROW viewport + utility pane + Actor Board overflow`.

If a visual collision makes the state ambiguous, fix the prototype/design system before runtime implementation.

---

# 13. No-invention rule

Prototype JavaScript may only change state values explicitly defined by scenario/mock fixtures.

It may not infer:

- target eligibility;
- attack availability;
- current legal action;
- authority permission;
- private-data entitlement;
- command conflict;
- rules outcome;
- resource legality;
- reconnect truth.

Those values are fixture inputs, not prototype calculations.