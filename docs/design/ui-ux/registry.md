# SimpleVTT R1-R9 UI Registry

Status: **Draft inventory — owner review not complete**

This file answers **what UI artifacts exist or are planned**. It is intentionally concise. Normative product behavior lives in `decisions.md`; this file references decisions instead of duplicating them.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Gaps: [`planning-gaps.md`](planning-gaps.md)

## Registry row rules

Each row uses:

| Field | Meaning |
| --- | --- |
| `ID` | Stable inventory ID |
| `Artifact` | Human-readable UI artifact |
| `Status` | Draft / Selected / Reviewed / Frozen / Superseded |
| `Owner` | Governance sheet or contract family |
| `Refs` | Decision IDs / gaps / canonical contracts |
| `Note` | Short non-normative description only |

A row existing here does not automatically approve its final topology, placement, or behavior.

---

# R1 — IA & Destination

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R1-HOME` | Home | Draft | NAV-01 | UX-01-01, UX-01-02 | Product hub |
| `R1-CHARACTERS` | Character Library destination | Draft | NAV-01 / DND-01 | UX-01-01 | Character management |
| `R1-CHAR-SHEET` | Character Sheet destination | Draft | DND-01 | UX-01-01 | Standalone first-class surface |
| `R1-CHAR-BUILDER` | Character Builder workspace | Draft | DND-01 | — | Create/Edit/Import modes |
| `R1-LEVEL-UP` | Level Up workspace | Draft | DND-01 | — | Progression flow |
| `R1-SESSION` | Session destination | Draft | NAV-01 / SES-01 | UX-01-01 | Host/Join/session lifecycle hub |
| `R1-PLAY` | Dedicated Play Workspace | Draft | SES-01 | UX-01-02, UX-01-07 | Freeform/Initiative share this workspace |
| `R1-CONTENT` | Content / Add-ons | Draft | CONTENT-02 | — | Installed/imported content management |
| `R1-RULES` | Rules Browser | Draft | CONTENT-02 / NAV-01 | — | Reference/search |
| `R1-SETTINGS` | Settings | Draft | NAV-01 | — | Preferences |

Not yet promoted to top-level destinations: Activity, Encounter Manager, Adjudication. Their topology remains contextual by current planning direction and requires downstream review.

---

# R2 — Task Flows

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R2-NEW-CHAR` | New Character flow | Draft | DND-01 | — | Home -> Builder -> Review -> Sheet |
| `R2-OPEN-CHAR` | Open saved Character | Draft | DND-01 | — | Home/Library -> Sheet |
| `R2-EDIT-CHAR` | Edit Character | Draft | DND-01 | — | Sheet -> Builder -> Sheet |
| `R2-LEVEL-UP` | Level Up | Draft | DND-01 | — | Sheet -> Level Up -> Review -> Sheet |
| `R2-HOST` | Host Session | Draft | SES-01 | — | Home/Session -> Host Setup -> Lobby -> Play |
| `R2-JOIN` | Join Session | Draft | SES-01 / UX-02 | GAP-JOIN-NO-CHARACTER | Home/Session -> Join -> Character Select -> Lobby -> Play |
| `R2-PLAY-ACTION` | Capability -> target -> resolution -> result | Draft | DND-03 / DND-02 | ORIGIN-UX-01-19..25 | Core play loop |
| `R2-INITIATIVE` | Enter/exit Initiative | Draft | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15 | Same Play Workspace |
| `R2-HANDOUT` | DM handout presentation | Draft | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13 | Overlay / Upper / Full branches |
| `R2-DM-DISCLOSE` | DM-only roll later disclosure | Draft | SES-02 / DM-02 | ORIGIN-UX-01-26, 28, 29 | Needs authority contract |
| `R2-CONTENT-INSTALL` | Add-on install | Draft | CONTENT-02 | — | File -> Preview -> Validate -> Install |
| `R2-RECONNECT` | Reconnect / recovery | Draft | SES-02 / STATE-02 | UX-01-03 | Preserve canonical session context |
| `R2-LEAVE` | Player leave | Draft | SES-01 / INT-03 | — | Consequence/confirmation TBD |
| `R2-END-SESSION` | Host end session | Draft | SES-01 / INT-03 | — | Destructive flow TBD |

---

# R3 — Workspace Modes & Interaction States

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R3-PLAY-FREEFORM` | Freeform mode | Draft | SES-01 | ORIGIN-UX-01-10, 11 | Shared Play Workspace |
| `R3-PLAY-INITIATIVE` | Initiative mode | Draft | DND-04 | ORIGIN-UX-01-14, 15 | Adds top tracker |
| `R3-ACTION-IDLE` | No action selected | Draft | DND-03 | — | Baseline Play state |
| `R3-ACTION-SELECTED` | Capability selected | Draft | DND-03 | UX-01-04..06 | Awaiting target/resolve path |
| `R3-TARGET-SINGLE` | Single-target targeting | Draft | DND-03 | ORIGIN-UX-01-19, 20 | Valid click immediate execute |
| `R3-TARGET-MULTI` | Multi-target targeting | Draft | DND-03 | ORIGIN-UX-01-20 | Explicit Execute |
| `R3-RESOLVING` | Resolution running | Draft | DND-03 / DND-02 | ORIGIN-UX-01-21 | Selective locking only |
| `R3-INTERRUPT` | Reaction / interrupt pending | Draft | DND-03 / DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Exact interaction boundary TBD |
| `R3-DICE` | Physical dice presentation | Draft | DND-02 | ORIGIN-UX-01-22A..25 | Presentation-only authority |
| `R3-RESULT` | Result presentation | Draft | DND-02 | ORIGIN-UX-01-22 | Return to current Play context |
| `R3-HANDOUT-OVERLAY` | Handout Overlay | Draft | SES-01 | ORIGIN-UX-01-12, 13 | Local dismiss allowed |
| `R3-HANDOUT-UPPER` | Handout Upper Scene | Draft | SES-01 | ORIGIN-UX-01-12, 13 | Shared replacement state |
| `R3-HANDOUT-FULL` | Handout Full Scene | Draft | SES-01 | ORIGIN-UX-01-12, 13 | Command Center remains |
| `R3-BUILDER-GUIDED` | Guided Character Builder | Draft | DND-01 | — | Builder mode |
| `R3-BUILDER-QUICK` | Quick Character Builder | Draft | DND-01 | — | Builder mode |
| `R3-BUILDER-IMPORT` | Character Import | Draft | DND-01 | — | Builder mode |
| `R3-BUILDER-EDIT` | Character Edit | Draft | DND-01 | — | Builder mode |

---

# R4 — Overlay & Interruptive Surfaces

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | Confirmation dialog pattern | Draft | INT-03 | — | Use only when a decision is actually required |
| `R4-DESTRUCTIVE` | Destructive confirmation | Draft | INT-03 | — | Delete/end/irreversible consequences |
| `R4-UNSAVED` | Unsaved-change dialog | Draft | INT-03 | — | Edit/build flows |
| `R4-DRAWER` | Drawer pattern | Draft | INT-02 | — | Contextual detail, not automatic destination |
| `R4-POPOVER` | Popover pattern | Draft | INT-02 | — | Anchored contextual UI |
| `R4-ACTOR-CONTEXT` | Actor Context Menu | Reviewed | INT-01 | ORIGIN-UX-01-16, GAP-ACTOR-CONTEXT-MENU-CONTENTS | Exact commands TBD |
| `R4-TOOLTIP` | Tooltip / unavailable reason | Draft | INT-01 / CMP-01 | ORIGIN-UX-01-19 | Must not be sole carrier of essential info |
| `R4-HANDOUT-LIGHTBOX` | Handout image lightbox | Draft | SES-01 / INT-02 | ORIGIN-UX-01-12, 13 | Zoom/pan behavior downstream |
| `R4-REACTION-PROMPT` | Reaction/Interrupt prompt | Draft | DND-04 | R3-INTERRUPT | Response surface |
| `R4-ADJUDICATION` | DM adjudication surface | Draft | DM-02 | — | Exact topology TBD |
| `R4-ACTIVITY-DETAIL` | Activity/resolution detail | Draft | DM-02 / SES-01 | ORIGIN-UX-01-22 | Durable detail path |
| `R4-ENCOUNTER` | Encounter Manager | Draft | DM-01 / SES-01 | — | Current planning: contextual to Play |
| `R4-FILE-PICKER` | File selection flow | Draft | CMP-01 / CONTENT-02 | — | Add-on/portrait/handout uses as applicable |

---

# R5 — Feedback & Notification

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R5-TOAST-SUCCESS` | Success toast | Draft | STATE-01 | — | Brief non-blocking success |
| `R5-TOAST-INFO` | Informational toast | Draft | STATE-01 | — | Brief non-blocking info |
| `R5-TOAST-WARN` | Warning toast | Draft | STATE-01 | — | Non-blocking warning only |
| `R5-INLINE-ALERT` | Inline alert | Draft | STATE-01 | — | Scoped to task/section |
| `R5-BANNER` | Persistent banner | Draft | STATE-02 | — | Persistent global/session issue |
| `R5-STATUS` | Status indicator | Draft | STATE-02 | — | Connected/ready/saved etc. |
| `R5-PROGRESS` | Progress indicator | Draft | STATE-01 | — | Real pending work only |
| `R5-FIELD-VALIDATION` | Field validation | Draft | STATE-01 | — | Input-specific error |
| `R5-ROLL-RESULT` | Roll/action result feedback | Reviewed | DND-02 | ORIGIN-UX-01-22 | Scene-integrated result |
| `R5-ACTIVITY-EVENT` | Durable activity event | Draft | DM-02 / SES-02 | ORIGIN-UX-01-29 | Visibility-sensitive |

---

# R6 — System & Edge States

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R6-INITIAL-LOAD` | Initial loading | Draft | STATE-02 | — | App bootstrap |
| `R6-PENDING` | Local/remote operation pending | Draft | STATE-01 | — | Prevent duplicate submission as needed |
| `R6-EMPTY` | Empty state | Draft | STATE-01 | — | Must expose next valid action when one exists |
| `R6-NO-RESULTS` | No search results | Draft | STATE-01 | — | Query-aware |
| `R6-DISABLED` | Disabled/unavailable | Draft | STATE-01 | UX-01-05 | Reason when material |
| `R6-RECOVERABLE-ERROR` | Recoverable error | Draft | STATE-02 | — | Retry/recovery path |
| `R6-BLOCKING-ERROR` | Blocking error | Draft | STATE-02 | — | Explicit blocker |
| `R6-SAVE-FAILURE` | Save failure | Draft | STATE-02 | — | Data preservation/retry required |
| `R6-UNSUPPORTED` | Unsupported content/mechanic | Draft | STATE-02 | — | No approximation |
| `R6-DISCONNECTED` | Disconnected | Draft | STATE-02 / SES-02 | — | Connection state |
| `R6-RECONNECTING` | Reconnecting | Draft | STATE-02 / SES-02 | UX-01-03 | Preserve canonical context |
| `R6-INCOMPATIBLE` | Incompatible session/content | Draft | STATE-02 | — | Blocking/recovery TBD |
| `R6-PERMISSION` | Permission/authority denied | Draft | STATE-02 / SES-02 | — | Do not leak unauthorized data |
| `R6-STALE` | Stale/reconciliation state | Draft | STATE-02 / SES-02 | — | Canonical resync behavior |
| `R6-REDUCED-MOTION` | Reduced Motion | Draft | A11Y-01 / R9 | ORIGIN-UX-01-25 | Result-preserving presentation |
| `R6-NARROW` | Narrow Desktop | Draft | PLATFORM-01 | UX-01-04, UX-01-07 | Core anchors/capabilities must remain reachable |

---

# R7 — Components & Controls

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R7-BUTTON` | Button family | Draft | CMP-01 | — | Primary/secondary/destructive/quiet/icon |
| `R7-TABS` | Standard tabs | Draft | CMP-01 | — | Peer content navigation |
| `R7-HOTBAR-TABS` | Hotbar page tabs | Reviewed | DND-03 / CMP-01 | ORIGIN-UX-01-07 | Mixed/Action/Spell/Item + custom baseline |
| `R7-TOGGLE` | Toggle | Draft | CMP-01 | — | Immediate boolean state when appropriate |
| `R7-SEGMENTED` | Segmented mode control | Draft | CMP-01 | — | Small exclusive set |
| `R7-SEARCH` | Search input | Draft | CMP-01 | — | Rules/content/library use as applicable |
| `R7-FILTER` | Filter controls | Draft | CMP-01 | — | Result-set narrowing |
| `R7-CHAR-CARD` | Character Card | Draft | DND-01 / CMP-01 | — | Library/select uses |
| `R7-ACTOR-CARD` | Actor Card | Reviewed | INT-01 / SES-01 | ORIGIN-UX-01-10, 11, 16, 19 | Core scene interaction surface |
| `R7-HOTBAR-SLOT` | Capability/Hotbar slot | Reviewed | DND-03 | UX-01-04..06 | Capability execution/discoverability |
| `R7-ECONOMY` | Action-economy indicator | Reviewed | DND-03 | ORIGIN-UX-01-08 | Fixed economy grammar |
| `R7-RESOURCE-RAIL` | Dynamic Resource Rail | Reviewed | DND-03 | ORIGIN-UX-01-08 | Canonical resource projection |
| `R7-INITIATIVE-ENTRY` | Initiative tracker entry | Reviewed | DND-04 | ORIGIN-UX-01-15 | Compact current/order info |
| `R7-STATUS` | Status/condition indicator | Draft | CMP-01 / DND-04 | — | Canonical projection only |
| `R7-FILE-INPUT` | File picker/input | Draft | CMP-01 | — | Import/presentation assets |
| `R7-ZOOM-PAN` | Zoom/pan controls | Draft | CMP-01 / SES-01 | ORIGIN-UX-01-13 | Handout local presentation |

---

# R8 — Content & Messaging

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R8-ACTION-LABELS` | Action button labels | Draft | CONTENT-01 | — | Prefer result/action wording over vague labels |
| `R8-CONFIRM-COPY` | Confirmation copy anatomy | Draft | CONTENT-01 / INT-03 | — | Consequence + explicit actions |
| `R8-DESTRUCTIVE-COPY` | Destructive wording | Draft | CONTENT-01 / INT-03 | — | Identify affected object/outcome |
| `R8-ERROR-COPY` | Error anatomy | Draft | CONTENT-01 / STATE-02 | — | What failed / impact / recovery |
| `R8-EMPTY-COPY` | Empty-state copy | Draft | CONTENT-01 / STATE-01 | — | Context + valid next action |
| `R8-DISABLED-REASON` | Unavailable reason | Draft | CONTENT-01 / DND-03 | ORIGIN-UX-01-18, 19 | Use canonical reason where available |
| `R8-VISIBILITY` | Public / DM Only terminology | Reviewed | SES-02 / CONTENT-01 | ORIGIN-UX-01-26, 27 | Exact initial/default persistence gap remains |
| `R8-RESULT-TERMS` | Roll/result terminology | Draft | CONTENT-01 / DND-02 | — | Canonical outcome vocabulary |
| `R8-CONNECTION` | Connection-state wording | Draft | CONTENT-01 / STATE-02 | — | Connected/reconnecting/disconnected |

---

# R9 — Motion & Temporal Behavior

| ID | Artifact | Status | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- |
| `R9-DICE-THROW` | Physical dice throw/roll/settle | Reviewed | DND-02 | ORIGIN-UX-01-22A..25 | Authoritative result first; physics presentation only |
| `R9-RESULT-REVEAL` | Result reveal timing | Draft | DND-02 | ORIGIN-UX-01-22 | Exact reveal point to review |
| `R9-INTERRUPT-TIMING` | Reaction prompt timing/timeout | Draft | DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Do not invent timeout |
| `R9-TOAST-LIFETIME` | Toast duration/auto-dismiss | Draft | STATE-01 | — | Numeric timing not yet approved |
| `R9-OVERLAY-ENTER-EXIT` | Overlay transitions | Draft | INT-02 | — | Must preserve focus/interaction semantics |
| `R9-REDUCED-MOTION` | Reduced-motion equivalents | Draft | A11Y-01 | ORIGIN-UX-01-25 | Preserve information/order/result |

---

# Inventory completion check

This inventory is not complete until AI cross-checks:

- every route/surface in the current implementation;
- every item in `master-flow.md`;
- every reviewed Decision Card in `decisions.md`;
- generic UI patterns required by INT/STATE/CMP/A11Y/PLATFORM sheets;
- every open gap in `planning-gaps.md`;
- non-route UI such as confirmations, notifications, validation, permission, reconnect, and motion.

New rows may be added without owner approval when they only identify an existing/planned artifact. **Adding a row does not decide its product behavior.** Any new material behavior still requires a Decision Card.
