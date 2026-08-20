# SimpleVTT R1-R9 UI Registry

Status: **Draft inventory — owner review not complete**

This file answers **what UI artifacts exist or are planned**. Normative product behavior lives in `decisions.md`; this file references decisions instead of duplicating them.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Gaps: [`planning-gaps.md`](planning-gaps.md)

## Two-axis status model

Registry rows separate two different questions:

1. **Planning Maturity** — how far the product decision has progressed.
2. **Contract Readiness** — whether enough explicit contract exists for safe implementation.

A `Reviewed` artifact may still be `Blocked` or `Partial` for implementation.

### Planning Maturity enum

- `Draft`
- `Selected`
- `Reviewed`
- `Frozen`
- `Superseded`

### Contract Readiness enum

- `None` — inventory exists, but no implementation contract is expected yet.
- `Partial` — meaningful direction exists, but required states/contracts are incomplete.
- `Ready` — applicable decisions/contracts are sufficient for the selected spec tier and no blocking gap remains.
- `Blocked` — a named Planning Gap or missing authority prevents safe implementation.

`Ready` does **not** authorize implementation. Implementation still requires the framework's authorization/Work Order rules.

## Registry row rules

| Field | Meaning |
| --- | --- |
| `ID` | Stable inventory ID |
| `Artifact` | Human-readable UI artifact |
| `Planning` | Planning Maturity |
| `Contract` | Contract Readiness |
| `Owner` | Governance sheet or contract family |
| `Refs` | Decision IDs / gaps / canonical contracts |
| `Note` | Short non-normative description only |

A row existing here does not approve its final topology, placement, or behavior.

---

# R1 — IA & Destination

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R1-HOME` | Home | Draft | None | NAV-01 | UX-01-01, UX-01-02 | Product hub |
| `R1-CHARACTERS` | Character Library destination | Draft | None | NAV-01 / DND-01 | UX-01-01 | Character management |
| `R1-CHAR-SHEET` | Character Sheet destination | Draft | Partial | DND-01 | UX-01-01 | Standalone first-class surface |
| `R1-CHAR-BUILDER` | Character Builder workspace | Draft | None | DND-01 | — | Create/Edit/Import modes |
| `R1-LEVEL-UP` | Level Up workspace | Draft | None | DND-01 | — | Progression flow |
| `R1-SESSION` | Session destination | Draft | Partial | NAV-01 / SES-01 | UX-01-01 | Host/Join/session lifecycle hub |
| `R1-PLAY` | Dedicated Play Workspace | Draft | Partial | SES-01 | UX-01-02, UX-01-07 | Freeform/Initiative share this workspace |
| `R1-CONTENT` | Content / Add-ons | Draft | None | CONTENT-02 | — | Installed/imported content management |
| `R1-RULES` | Rules Browser | Draft | None | CONTENT-02 / NAV-01 | — | Reference/search |
| `R1-SETTINGS` | Settings | Draft | None | NAV-01 | — | Preferences |

Not yet promoted to top-level destinations: Activity, Encounter Manager, Adjudication. Their topology remains contextual by current planning direction and requires downstream review.

---

# R2 — Task Flows

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R2-NEW-CHAR` | New Character flow | Draft | None | DND-01 | — | Home -> Builder -> Review -> Sheet |
| `R2-OPEN-CHAR` | Open saved Character | Draft | None | DND-01 | — | Home/Library -> Sheet |
| `R2-EDIT-CHAR` | Edit Character | Draft | None | DND-01 | — | Sheet -> Builder -> Sheet |
| `R2-LEVEL-UP` | Level Up | Draft | None | DND-01 | — | Sheet -> Level Up -> Review -> Sheet |
| `R2-HOST` | Host Session | Draft | Partial | SES-01 | — | Home/Session -> Host Setup -> Lobby -> Play |
| `R2-JOIN` | Join Session | Draft | Blocked | SES-01 / UX-02 | GAP-JOIN-NO-CHARACTER | Home/Session -> Join -> Character Select -> Lobby -> Play |
| `R2-PLAY-ACTION` | Capability -> target -> resolution -> result | Draft | Partial | DND-03 / DND-02 | ORIGIN-UX-01-19..25 | Core play loop |
| `R2-INITIATIVE` | Enter/exit Initiative | Draft | Partial | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15 | Same Play Workspace |
| `R2-HANDOUT` | DM handout presentation | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Overlay / Upper / Full branches |
| `R2-DM-DISCLOSE` | DM-only roll later disclosure | Draft | Blocked | SES-02 / DM-02 | ORIGIN-UX-01-26, 28, 29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Needs authority contract |
| `R2-CONTENT-INSTALL` | Add-on install | Draft | None | CONTENT-02 | — | File -> Preview -> Validate -> Install |
| `R2-RECONNECT` | Reconnect / recovery | Draft | Partial | SES-02 / STATE-02 | UX-01-03 | Preserve canonical session context |
| `R2-LEAVE` | Player leave | Draft | None | SES-01 / INT-03 | — | Consequence/confirmation TBD |
| `R2-END-SESSION` | Host end session | Draft | None | SES-01 / INT-03 | — | Destructive flow TBD |

---

# R3 — Workspace Modes & Interaction States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R3-PLAY-FREEFORM` | Freeform mode | Draft | Partial | SES-01 | ORIGIN-UX-01-10, 11 | Shared Play Workspace |
| `R3-PLAY-INITIATIVE` | Initiative mode | Draft | Partial | DND-04 | ORIGIN-UX-01-14, 15 | Adds top tracker |
| `R3-ACTION-IDLE` | No action selected | Draft | None | DND-03 | — | Baseline Play state |
| `R3-ACTION-SELECTED` | Capability selected | Draft | Partial | DND-03 | UX-01-04..06 | Awaiting target/resolve path |
| `R3-TARGET-SINGLE` | Single-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-19, 20 | Valid click immediate execute |
| `R3-TARGET-MULTI` | Multi-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-20 | Explicit Execute |
| `R3-RESOLVING` | Resolution running | Draft | Blocked | DND-03 / DND-02 | ORIGIN-UX-01-21, GAP-RESOLUTION-SAFE-INTERACTIONS | Selective locking boundary incomplete |
| `R3-INTERRUPT` | Reaction / interrupt pending | Draft | Blocked | DND-03 / DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Exact interaction boundary TBD |
| `R3-DICE` | Physical dice presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22A..25 | Presentation-only authority |
| `R3-RESULT` | Result presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22 | Return to current Play context |
| `R3-HANDOUT-OVERLAY` | Handout Overlay | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, 13, GAP-HANDOUT-NETWORK-CONTRACT | Local dismiss allowed |
| `R3-HANDOUT-UPPER` | Handout Upper Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, 13, GAP-HANDOUT-NETWORK-CONTRACT | Shared replacement state |
| `R3-HANDOUT-FULL` | Handout Full Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, 13, GAP-HANDOUT-NETWORK-CONTRACT | Command Center remains |
| `R3-BUILDER-GUIDED` | Guided Character Builder | Draft | None | DND-01 | — | Builder mode |
| `R3-BUILDER-QUICK` | Quick Character Builder | Draft | None | DND-01 | — | Builder mode |
| `R3-BUILDER-IMPORT` | Character Import | Draft | None | DND-01 | — | Builder mode |
| `R3-BUILDER-EDIT` | Character Edit | Draft | None | DND-01 | — | Builder mode |

---

# R4 — Overlay & Interruptive Surfaces

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | Confirmation dialog pattern | Draft | None | INT-03 | — | Use only when a decision is actually required |
| `R4-DESTRUCTIVE` | Destructive confirmation | Draft | None | INT-03 | — | Delete/end/irreversible consequences |
| `R4-UNSAVED` | Unsaved-change dialog | Draft | None | INT-03 | — | Edit/build flows |
| `R4-DRAWER` | Drawer pattern | Draft | None | INT-02 | — | Contextual detail, not automatic destination |
| `R4-POPOVER` | Popover pattern | Draft | None | INT-02 | — | Anchored contextual UI |
| `R4-ACTOR-CONTEXT` | Actor Context Menu | Reviewed | Blocked | INT-01 | ORIGIN-UX-01-16, GAP-ACTOR-CONTEXT-MENU-CONTENTS | Pattern selected; commands TBD |
| `R4-TOOLTIP` | Tooltip / unavailable reason | Draft | Partial | INT-01 / CMP-01 | ORIGIN-UX-01-19 | Must not be sole carrier of essential info |
| `R4-HANDOUT-LIGHTBOX` | Handout image lightbox | Draft | Partial | SES-01 / INT-02 | ORIGIN-UX-01-12, 13 | Zoom/pan behavior downstream |
| `R4-REACTION-PROMPT` | Reaction/Interrupt prompt | Draft | Blocked | DND-04 | R3-INTERRUPT, GAP-RESOLUTION-SAFE-INTERACTIONS | Response surface |
| `R4-ADJUDICATION` | DM adjudication surface | Draft | None | DM-02 | — | Exact topology TBD |
| `R4-ACTIVITY-DETAIL` | Activity/resolution detail | Draft | Partial | DM-02 / SES-01 | ORIGIN-UX-01-22 | Durable detail path |
| `R4-ENCOUNTER` | Encounter Manager | Draft | None | DM-01 / SES-01 | — | Current planning: contextual to Play |
| `R4-FILE-PICKER` | File selection flow | Draft | None | CMP-01 / CONTENT-02 | — | Add-on/portrait/handout uses as applicable |

---

# R5 — Feedback & Notification

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R5-TOAST-SUCCESS` | Success toast | Draft | None | STATE-01 | — | Brief non-blocking success |
| `R5-TOAST-INFO` | Informational toast | Draft | None | STATE-01 | — | Brief non-blocking info |
| `R5-TOAST-WARN` | Warning toast | Draft | None | STATE-01 | — | Non-blocking warning only |
| `R5-INLINE-ALERT` | Inline alert | Draft | None | STATE-01 | — | Scoped to task/section |
| `R5-BANNER` | Persistent banner | Draft | None | STATE-02 | — | Persistent global/session issue |
| `R5-STATUS` | Status indicator | Draft | None | STATE-02 | — | Connected/ready/saved etc. |
| `R5-PROGRESS` | Progress indicator | Draft | None | STATE-01 | — | Real pending work only |
| `R5-FIELD-VALIDATION` | Field validation | Draft | None | STATE-01 | — | Input-specific error |
| `R5-ROLL-RESULT` | Roll/action result feedback | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22 | Scene-integrated result |
| `R5-ACTIVITY-EVENT` | Durable activity event | Draft | Blocked | DM-02 / SES-02 | ORIGIN-UX-01-29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Visibility-sensitive |

---

# R6 — System & Edge States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R6-INITIAL-LOAD` | Initial loading | Draft | None | STATE-02 | — | App bootstrap |
| `R6-PENDING` | Local/remote operation pending | Draft | None | STATE-01 | — | Prevent duplicate submission as needed |
| `R6-EMPTY` | Empty state | Draft | None | STATE-01 | — | Must expose next valid action when one exists |
| `R6-NO-RESULTS` | No search results | Draft | None | STATE-01 | — | Query-aware |
| `R6-DISABLED` | Disabled/unavailable | Draft | Partial | STATE-01 | UX-01-05 | Reason when material |
| `R6-RECOVERABLE-ERROR` | Recoverable error | Draft | None | STATE-02 | — | Retry/recovery path |
| `R6-BLOCKING-ERROR` | Blocking error | Draft | None | STATE-02 | — | Explicit blocker |
| `R6-SAVE-FAILURE` | Save failure | Draft | None | STATE-02 | — | Data preservation/retry required |
| `R6-UNSUPPORTED` | Unsupported content/mechanic | Draft | Partial | STATE-02 | canonical no-approximation principle | No approximation |
| `R6-DISCONNECTED` | Disconnected | Draft | None | STATE-02 / SES-02 | — | Connection state |
| `R6-RECONNECTING` | Reconnecting | Draft | Partial | STATE-02 / SES-02 | UX-01-03 | Preserve canonical context |
| `R6-INCOMPATIBLE` | Incompatible session/content | Draft | None | STATE-02 | — | Blocking/recovery TBD |
| `R6-PERMISSION` | Permission/authority denied | Draft | Partial | STATE-02 / SES-02 | ORIGIN-UX-01-26, 29 | Do not leak unauthorized data |
| `R6-STALE` | Stale/reconciliation state | Draft | None | STATE-02 / SES-02 | — | Canonical resync behavior |
| `R6-REDUCED-MOTION` | Reduced Motion | Draft | Partial | A11Y-01 / R9 | ORIGIN-UX-01-25 | Result-preserving presentation |
| `R6-NARROW` | Narrow Desktop | Draft | Partial | PLATFORM-01 | UX-01-04, UX-01-07 | Core anchors/capabilities remain reachable |

---

# R7 — Components & Controls

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R7-BUTTON` | Button family | Draft | None | CMP-01 | — | Primary/secondary/destructive/quiet/icon |
| `R7-TABS` | Standard tabs | Draft | None | CMP-01 | — | Peer content navigation |
| `R7-HOTBAR-TABS` | Hotbar page tabs | Reviewed | Partial | DND-03 / CMP-01 | ORIGIN-UX-01-07 | Mixed/Action/Spell/Item + custom baseline |
| `R7-TOGGLE` | Toggle | Draft | None | CMP-01 | — | Immediate boolean state when appropriate |
| `R7-SEGMENTED` | Segmented mode control | Draft | None | CMP-01 | — | Small exclusive set |
| `R7-SEARCH` | Search input | Draft | None | CMP-01 | — | Rules/content/library use as applicable |
| `R7-FILTER` | Filter controls | Draft | None | CMP-01 | — | Result-set narrowing |
| `R7-CHAR-CARD` | Character Card | Draft | None | DND-01 / CMP-01 | — | Library/select uses |
| `R7-ACTOR-CARD` | Actor Card | Reviewed | Partial | INT-01 / SES-01 | ORIGIN-UX-01-10, 11, 16, 19 | Core scene interaction surface |
| `R7-HOTBAR-SLOT` | Capability/Hotbar slot | Reviewed | Partial | DND-03 | UX-01-04..06 | Capability execution/discoverability |
| `R7-ECONOMY` | Action-economy indicator | Reviewed | Partial | DND-03 | ORIGIN-UX-01-08 | Fixed economy grammar |
| `R7-RESOURCE-RAIL` | Dynamic Resource Rail | Reviewed | Partial | DND-03 | ORIGIN-UX-01-08 | Canonical resource projection |
| `R7-INITIATIVE-ENTRY` | Initiative tracker entry | Reviewed | Partial | DND-04 | ORIGIN-UX-01-15 | Compact current/order info |
| `R7-STATUS` | Status/condition indicator | Draft | None | CMP-01 / DND-04 | — | Canonical projection only |
| `R7-FILE-INPUT` | File picker/input | Draft | None | CMP-01 | — | Import/presentation assets |
| `R7-ZOOM-PAN` | Zoom/pan controls | Draft | Partial | CMP-01 / SES-01 | ORIGIN-UX-01-13 | Handout local presentation |

---

# R8 — Content & Messaging

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R8-ACTION-LABELS` | Action button labels | Draft | None | CONTENT-01 | — | Prefer result/action wording over vague labels |
| `R8-CONFIRM-COPY` | Confirmation copy anatomy | Draft | None | CONTENT-01 / INT-03 | — | Consequence + explicit actions |
| `R8-DESTRUCTIVE-COPY` | Destructive wording | Draft | None | CONTENT-01 / INT-03 | — | Identify affected object/outcome |
| `R8-ERROR-COPY` | Error anatomy | Draft | None | CONTENT-01 / STATE-02 | — | What failed / impact / recovery |
| `R8-EMPTY-COPY` | Empty-state copy | Draft | None | CONTENT-01 / STATE-01 | — | Context + valid next action |
| `R8-DISABLED-REASON` | Unavailable reason | Draft | Partial | CONTENT-01 / DND-03 | ORIGIN-UX-01-18, 19 | Use canonical reason where available |
| `R8-VISIBILITY` | Public / DM Only terminology | Reviewed | Blocked | SES-02 / CONTENT-01 | ORIGIN-UX-01-26, 27, GAP-DM-ROLL-VISIBILITY-PERSISTENCE | Default/persistence gap remains |
| `R8-RESULT-TERMS` | Roll/result terminology | Draft | None | CONTENT-01 / DND-02 | — | Canonical outcome vocabulary |
| `R8-CONNECTION` | Connection-state wording | Draft | None | CONTENT-01 / STATE-02 | — | Connected/reconnecting/disconnected |

---

# R9 — Motion & Temporal Behavior

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R9-DICE-THROW` | Physical dice throw/roll/settle | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22A..25 | Authoritative result first; physics presentation only |
| `R9-RESULT-REVEAL` | Result reveal timing | Draft | None | DND-02 | ORIGIN-UX-01-22 | Exact reveal point to review |
| `R9-INTERRUPT-TIMING` | Reaction prompt timing/timeout | Draft | Blocked | DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Do not invent timeout |
| `R9-TOAST-LIFETIME` | Toast duration/auto-dismiss | Draft | None | STATE-01 | — | Numeric timing not yet approved |
| `R9-OVERLAY-ENTER-EXIT` | Overlay transitions | Draft | None | INT-02 | — | Must preserve focus/interaction semantics |
| `R9-REDUCED-MOTION` | Reduced-motion equivalents | Draft | Partial | A11Y-01 | ORIGIN-UX-01-25 | Preserve information/order/result |

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

`Contract Readiness` is derived maintenance. AI may downgrade or upgrade `None / Partial / Blocked / Ready` when referenced contracts/gaps change, but MUST NOT change Planning Maturity without the decision lifecycle defined in the framework.
