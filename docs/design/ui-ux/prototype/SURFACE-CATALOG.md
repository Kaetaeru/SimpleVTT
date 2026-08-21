# UI Reference Prototype — Surface Catalog

Status: **Prototype inventory**

This catalog defines which screens, scenes, workspaces and contextual surfaces the standalone HTML prototype must be able to show.

A row existing here does not create new product behavior. It represents an already-reviewed direction, a current product surface that needs visual definition, or a bounded prototype state needed for review.

Every future prototype surface SHOULD render a `data-proto-id` matching the ID below.

---

# 1. Prototype-only harness

## PROTO-SURF-HARNESS — Prototype Controls

**Product UI:** No — prototype-only.

Purpose:

- switch screens instantly;
- switch Host/DM and Client/Player presentation;
- switch Freeform / Initiative / targeting / resolving / interrupt / result states;
- switch wide / normal / narrow viewport presets;
- toggle empty/loading/error/disconnected examples;
- change Handout mode;
- load named review scenarios.

The harness MUST be visually separated from the product frame and labeled `PROTOTYPE CONTROLS — NOT PRODUCT UI`.

---

# 2. Product Shell / global surfaces

| ID | Surface | Required prototype variants | Canonical basis |
| --- | --- | --- | --- |
| `PROTO-SURF-FIRST-RUN` | First-run guide | first launch; sheet-style selection; dismiss | NAV-01-07, UI-01-07 |
| `PROTO-SURF-HOME` | Home | default; live-session Return to Play; reconnect notice; empty recent content | NAV-01, UX-03 |
| `PROTO-SURF-CHAR-LIBRARY` | Character Library | populated; empty; search/filter/no-results; selected card | NAV-01-03, UI-01-07 |
| `PROTO-SURF-CHAR-SHEET-OFFICIAL` | Official-style Character Sheet | normal; standalone roll/result; session-linked; narrow | UX-03-05, UI-01-07 |
| `PROTO-SURF-CHAR-SHEET-SVTT` | SimpleVTT-optimized Character Sheet | normal; standalone roll/result; session-linked; narrow | UX-03-05, UI-01-07 |
| `PROTO-SURF-CHAR-BUILDER` | Character Builder | current accepted workflow shell; validation; import/edit example | UI-01-08 |
| `PROTO-SURF-LEVEL-UP` | Level Up | current accepted workflow shell; choice blocked; review/commit | UI-01-08 |
| `PROTO-SURF-HOST-SETUP` | Host Session Setup | normal; validation error; open-session action | ORIGIN-FLOW-01, SES-01-02 |
| `PROTO-SURF-JOIN-SETUP` | Join Setup + Character Select | valid character; no character blocked; connection failure | ORIGIN-FLOW-02, SES-01-04 |
| `PROTO-SURF-CONTENT` | Content / Add-ons | installed; empty; update available; disabled; dependency warning | CONTENT-02-04, CONTENT-02-09, CONTENT-02-11 |
| `PROTO-SURF-CONTENT-IMPORT` | Add-on Import Review | valid; warning; blocking validation; unsupported package | CONTENT-02-04 |
| `PROTO-SURF-RULES` | Rules Browser | search; results; detail; no results | NAV-01-04, NAV-01-05 |
| `PROTO-SURF-SETTINGS` | Settings | appearance; reduced motion; reopen help; layout reset | NAV-01-04, NAV-01-07 |

---

# 3. Live Play scenes

The prototype MUST treat the Play Workspace as a first-class visual system, not as one generic screenshot.

## PROTO-SURF-PLAY-DM-FREEFORM — Host/DM Freeform

Required visible regions:

- compact global return/navigation access;
- top NPC/Neutral/Hostile Actor Board;
- central Scene/Table Context;
- lower Player/Allied Actor Board;
- bottom Command Center;
- persistent DM visibility state;
- NOTICE UI when a persistent state exists;
- contextual DM/Session utility launchers;
- no permanent lobby/readiness UI.

Must demonstrate:

- zero connected Players is valid;
- DM can prepare/edit while the session is already live;
- advanced spatial relation tool is contextual, not permanently open.

Canonical basis: UX-01-07, ORIGIN-UX-01-09, ORIGIN-UX-01-10, ORIGIN-UX-01-11, SES-01-02, DM-01-03.

## PROTO-SURF-PLAY-PLAYER-FREEFORM — Client/Player Freeform

Required differences from DM view:

- same core Play skeleton;
- no DM-only utility controls;
- Player-controlled Actor identity clearly visible;
- only authorized session information shown;
- connection/session utility remains available;
- Handout/Activity presentation respects visibility examples.

Canonical basis: UX-02-01, UX-02-07, UX-02-08.

## PROTO-SURF-PLAY-DM-INITIATIVE — Host/DM Initiative

Adds:

- horizontal top Initiative Tracker;
- current-turn presentation;
- DM any-Actor control example;
- End/Next Turn location example;
- Action/Bonus/Reaction/Movement/resource projection in Command Center.

Must retain Actor Boards and Command Center.

Canonical basis: ORIGIN-UX-01-14, ORIGIN-UX-01-15.

## PROTO-SURF-PLAY-PLAYER-INITIATIVE — Client/Player Initiative

Adds:

- current-turn / off-turn distinction;
- controlled Actor distinction;
- current target/selected action example;
- reaction/interrupt entry example;
- invalid target presentation.

---

# 4. Action / resolution scene variants

These are states of Play, not separate product destinations.

| ID | Variant | Must demonstrate | Basis / blocker |
| --- | --- | --- | --- |
| `PROTO-SURF-PLAY-TARGET-SINGLE` | selected single-target action | all Actor Cards remain visible; valid emphasized; invalid disabled/dimmed with reason; valid click implied immediate execute | ORIGIN-UX-01-19, ORIGIN-UX-01-20 |
| `PROTO-SURF-PLAY-TARGET-MULTI` | multi-target action | selected target set; valid/invalid states; explicit Execute | ORIGIN-UX-01-20 |
| `PROTO-SURF-PLAY-DEFAULT-ATTACK` | hostile Actor default click | canonical Main Hand action shown as provided mock relation; unavailable case shows explicit reason/no smart fallback | ORIGIN-UX-01-17, ORIGIN-UX-01-18, GAP-MAIN-HAND-CANONICAL-RELATION |
| `PROTO-SURF-PLAY-RESOLVING` | authoritative resolution active | Command Center skeleton remains; only mock-declared conflicting controls lock | ORIGIN-UX-01-21, GAP-RESOLUTION-SAFE-INTERACTIONS |
| `PROTO-SURF-PLAY-INTERRUPT` | reaction/interrupt pending | response prompt + preserved Play context; timeout semantics not invented | GAP-RESOLUTION-SAFE-INTERACTIONS |
| `PROTO-SURF-PLAY-DICE` | physical dice presentation | central roll area; far/back to near/front visual concept; result remains mock-authoritative | ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25 |
| `PROTO-SURF-PLAY-RESULT` | immediate result | scene-integrated result + durable Activity detail path | ORIGIN-UX-01-22 |
| `PROTO-SURF-CONCENTRATION` | concentration-save response | resolution-embedded input/result example using explicit mock response contract | R4-CONCENTRATION-SAVE |

---

# 5. Contextual Play surfaces

| ID | Surface | Presentation role | Required variants |
| --- | --- | --- | --- |
| `PROTO-SURF-QUICK-SHEET` | Quick Sheet | non-destructive contextual Character detail | normal; narrow |
| `PROTO-SURF-FULL-SHEET` | Full Character Sheet layer | full workspace over preserved live session | Official/SVTT layout; close/return |
| `PROTO-SURF-ACTIVITY` | Activity / Play Record | durable chronology/detail | DM combined public/private+filter; Player authorized-only; correction chain |
| `PROTO-SURF-ENCOUNTER` | Encounter Manager | contextual DM management | populated; empty; Initiative relationship |
| `PROTO-SURF-PARTICIPANTS` | Participants | contextual DM session utility | zero players; players connected; late join |
| `PROTO-SURF-SESSION-SHARE` | Session Share | contextual Host utility | connection address/info; content snapshot state |
| `PROTO-SURF-PLAYER-SESSION` | Player Session utility | connection/rejoin/leave | connected; reconnecting; disconnected |
| `PROTO-SURF-DM-SPATIAL` | Advanced spatial relation | advanced DM-only contextual tool | actor pair selected; distance; visibility; cover; validation |
| `PROTO-SURF-ADJUDICATION` | DM adjudication/correction | contextual resolution/history correction | preview; correction/reversal; prior event remains |

---

# 6. Handout modes

All three must be distinct in the prototype.

## PROTO-SURF-HANDOUT-OVERLAY

- image appears as overlay over the current Play scene;
- Player may locally dismiss/minimize and reopen;
- shared handout still conceptually active in mock session state.

## PROTO-SURF-HANDOUT-UPPER

- Handout occupies/replaces the upper Scene presentation region according to the reviewed concept;
- remains until DM changes/withdraws it;
- Command Center and required Play anchors remain reachable.

## PROTO-SURF-HANDOUT-FULL

- Handout becomes the dominant Scene presentation;
- remains DM-controlled;
- zoom/pan controls are local presentation state;
- this is still within the live-session product frame, not a new route.

Canonical basis: ORIGIN-UX-01-12, ORIGIN-UX-01-13.

Network/reconnect semantics remain blocked by `GAP-HANDOUT-NETWORK-CONTRACT`; the prototype uses mock shared state only.

---

# 7. Overlay / feedback examples

The prototype must be able to display these independently and in safe combinations:

| ID | Surface |
| --- | --- |
| `PROTO-SURF-ACTOR-CONTEXT` | Actor right-click context menu |
| `PROTO-SURF-HOVER-EXPLAIN` | rich hover/focus explanation frame |
| `PROTO-SURF-TOOLTIP` | small tooltip |
| `PROTO-SURF-CONFIRM` | ordinary confirmation dialog |
| `PROTO-SURF-DESTRUCTIVE-CONFIRM` | destructive confirmation dialog |
| `PROTO-SURF-UNSAVED` | unsaved-change dialog |
| `PROTO-SURF-TOAST` | non-blocking acknowledgement |
| `PROTO-SURF-BANNER` | persistent banner |
| `PROTO-SURF-NOTICE` | persistent NOTICE UI |
| `PROTO-SURF-ERROR-BLOCK` | local blocking error |
| `PROTO-SURF-RECONNECT` | reconnect/recovery strip |

---

# 8. Required responsive demonstrations

Every major surface must be reviewable in the three prototype viewport presets:

- Wide 1600×1000
- Normal 1366×768
- Narrow Desktop 960×700

At minimum, the HTML prototype must explicitly demonstrate all three sizes for:

- Home;
- Character Sheet;
- DM Freeform Play;
- Player Initiative Play;
- Command Center;
- Actor Boards;
- Activity side pane;
- Handout Full;
- Content page.

---

# 9. Surface completion rule

A surface counts as represented only when the prototype shows:

1. its intended location in the product hierarchy;
2. its normal state;
3. any material role difference;
4. applicable narrow-desktop behavior;
5. at least one important non-happy-path state when relevant;
6. any relevant coexistence with other layers/anchors.

A static screenshot without interaction/state demonstration does not complete the Reference Prototype.