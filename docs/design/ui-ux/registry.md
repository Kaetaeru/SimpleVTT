# SimpleVTT R1-R9 UI Registry

Status: **Draft derived inventory — owner material checkpoints complete; AI/contract detail remains**

This file answers **what UI artifacts exist or are planned**. Normative product behavior lives in `decisions.md`; this file references decisions instead of duplicating them.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Gaps: [`planning-gaps.md`](planning-gaps.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)

## Two-axis status model

Registry rows separate two different questions:

1. **Planning Maturity** — how far the product decision for the artifact as a whole has progressed.
2. **Contract Readiness** — whether enough explicit contract exists for safe implementation.

A reviewed sub-decision does not automatically make the whole Registry artifact `Reviewed`. Use `Refs`/`Note` to show reviewed aspects while keeping artifact-level Planning Maturity `Draft` when material behavior/topology remains unresolved or intentionally delegated to later contracts.

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
| `Planning` | Artifact-level Planning Maturity |
| `Contract` | Contract Readiness |
| `Owner` | Governance sheet or contract family |
| `Refs` | Full Decision/Gap/Registry/Contract IDs or repository paths |
| `Note` | Short non-normative description only |

`Refs` MUST follow `MANIFEST.yaml` reference rules: full resolvable IDs/paths only; no ranges, omitted prefixes, or prose substitutes.

A row existing here does not approve behavior that is not supported by its referenced canonical Decision/contract.

---

# R1 — IA & Destination

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R1-HOME` | Home | Draft | Partial | NAV-01 | UX-01-01, UX-01-02, NAV-01-01, NAV-01-02, NAV-01-07, NAV-01-08, src/V1HomeScreen.tsx | Product hub; global navigation/first-run/relaunch direction is Reviewed, remaining composition is AI-managed detail |
| `R1-CHARACTERS` | Character Library destination | Draft | Partial | NAV-01 / DND-01 | NAV-01-03, UI-01-08, src/App.tsx | Character-management hub; current Builder/Level Up UX preserved |
| `R1-CHAR-SHEET` | Character Sheet destination | Draft | Partial | DND-01 | UX-03-05, UI-01-07, src/CharacterSheetPlayScreen.tsx | Official-style and SimpleVTT-optimized layouts are both first-class |
| `R1-CHAR-BUILDER` | Character Builder workspace | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing creation/edit/import UX is accepted baseline |
| `R1-LEVEL-UP` | Level Up workspace | Draft | Partial | DND-01 | UI-01-08, src/LevelUpV10.tsx | Existing Level Up UX is accepted baseline |
| `R1-SESSION` | Session destination | Draft | Partial | NAV-01 / SES-01 | ORIGIN-FLOW-01, SES-01-02, SES-01-04, SES-01-05, src/ProductionSessionWorkspaceBridge.tsx | Host opens directly into live session; no Lobby/Ready gate; valid Clients may join mid-session |
| `R1-PLAY` | Dedicated Play Workspace | Draft | Partial | SES-01 | UX-01-02, UX-01-07, UX-03-04, UI-01-02, UI-01-03, UI-01-04, UI-01-05, src/SessionModeRoot.tsx, src/ProductionPlayScreen.tsx | Reviewed Play topology; current connected implementation still contains drift |
| `R1-CONTENT` | Content / Add-ons | Draft | Partial | CONTENT-02 | CONTENT-02-04, CONTENT-02-09, CONTENT-02-11, src/V1ContentScreen.tsx | Official SimpleVTT package format; full v1 lifecycle; active session uses fixed content snapshot |
| `R1-RULES` | Rules Browser | Draft | None | CONTENT-02 / NAV-01 | NAV-01-04, NAV-01-05, src/App.tsx, src/SessionUtilityPanes.tsx | Global Rules destination plus contextual in-session lookup |
| `R1-SETTINGS` | Settings | Draft | None | NAV-01 | NAV-01-04, NAV-01-07, src/App.tsx, src/AppearanceSettingsBridge.tsx | Preferences / appearance / reduced motion; first-run help may reopen here |

Activity, Encounter Manager, and Adjudication remain contextual tools rather than top-level global destinations according to `NAV-01-05`.

---

# R2 — Task Flows

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R2-FIRST-USE` | First-use / Home onboarding | Draft | Partial | UX-03 / NAV-01 / CONTENT-01 | NAV-01-07, UI-01-07, src/V1HomeScreen.tsx | Dedicated first-run overlay; includes initial Character Sheet layout choice; low-risk copy/detail is AI-managed |
| `R2-NEW-CHAR` | New Character flow | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing Builder flow preserved |
| `R2-OPEN-CHAR` | Open saved Character | Draft | Partial | DND-01 | NAV-01-03, UI-01-07, src/App.tsx, src/CharacterLibraryUxBridge.tsx | Library -> selected Sheet |
| `R2-EDIT-CHAR` | Edit Character | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing Edit flow preserved |
| `R2-LEVEL-UP` | Level Up | Draft | Partial | DND-01 | UI-01-08, src/LevelUpV10.tsx | Existing Level Up flow preserved |
| `R2-STANDALONE-ROLL` | Standalone Character roll | Draft | None | DND-01 / DND-02 | UX-01-01, UX-03-05, src/OfficialCharacterSheetPlayScreen.tsx | Standalone sheet roll remains first-class; detailed presentation is downstream/AI-managed |
| `R2-HOST` | Host Session | Draft | Partial | SES-01 | ORIGIN-FLOW-01, SES-01-02, CONTENT-02-11, src/ProductionSessionWorkspaceBridge.tsx, src/ProductionSessionDirectNetworkBridge.tsx | Valid Host setup opens the authoritative live session immediately; no waiting/readiness lobby |
| `R2-JOIN` | Join Session | Draft | Partial | SES-01 / UX-02 | ORIGIN-FLOW-01, ORIGIN-FLOW-02, SES-01-04, SES-01-05, src/ProductionSessionWorkspaceBridge.tsx | Character Select is required; no valid Character blocks Join with Create/Import recovery; valid Client may join live session mid-session |
| `R2-PLAY-ACTION` | Capability -> target -> resolution -> result | Draft | Partial | DND-03 / DND-02 | ORIGIN-UX-01-19, ORIGIN-UX-01-20, ORIGIN-UX-01-21, ORIGIN-UX-01-22, ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/SessionActionDock.tsx | Core play loop; current intent-first implementation is non-normative evidence |
| `R2-INITIATIVE` | Enter/exit Initiative | Draft | Partial | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15, UI-01-04, src/SessionInitiativeStrip.tsx | Same Play Workspace with compact top tracker |
| `R2-HANDOUT` | DM handout presentation | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Three reviewed presentation modes remain blocked on shared network/reconnect contract |
| `R2-DM-DISCLOSE` | DM-only roll later disclosure | Draft | Blocked | SES-02 / DM-02 | ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Needs role-scoped authority/delivery contract |
| `R2-DM-ADJUDICATE` | DM adjudicate active resolution | Draft | Partial | DM-02 | DM-02-05, docs/design/session-runtime.md, src/App.tsx | Correction history semantics are Reviewed; remaining operation/detail is AI/domain-contract work |
| `R2-DM-UNDO` | DM undo/correct recent resolution | Draft | Partial | DM-02 | DM-02-05, docs/design/session-runtime.md, src/App.tsx, src/SessionUtilityPanes.tsx | Committed history is never deleted; reversal/correction appends a related event |
| `R2-CONTENT-INSTALL` | Add-on install | Draft | Partial | CONTENT-02 | CONTENT-02-04, CONTENT-02-09, CONTENT-02-11, src/V1ContentScreen.tsx | Official package -> Preview -> Validate -> Install; lifecycle includes update/replace/disable/delete |
| `R2-RECONNECT` | Reconnect / recovery | Draft | Partial | SES-02 / STATE-02 | UX-01-03, NAV-01-08, src/SessionPlayerSession.tsx | Transient live-session reconnect preserves canonical context; app relaunch starts at Home |
| `R2-LEAVE` | Player leave | Draft | None | SES-01 / INT-03 | src/SessionPlayerSession.tsx | Consequence/confirmation is low-level contract/default work unless material escalation occurs |
| `R2-END-SESSION` | Host end session | Draft | None | SES-01 / INT-03 | src/SessionDmTools.tsx, src/SessionModeRoot.tsx | Destructive session-end behavior still requires safe contract/confirmation detail |

---

# R3 — Workspace Modes & Interaction States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R3-PLAY-FREEFORM` | Freeform mode | Draft | Partial | SES-01 | ORIGIN-UX-01-10, ORIGIN-UX-01-11, SES-01-02, docs/design/session-runtime.md, src/SessionMainFocus.tsx | Live session opens into Freeform; reviewed Actor Board topology is not yet fully realized in current code |
| `R3-PLAY-INITIATIVE` | Initiative mode | Draft | Partial | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15, UI-01-04, docs/design/session-runtime.md, src/SessionInitiativeStrip.tsx | Adds compact top tracker without replacing Actor Boards |
| `R3-ACTION-IDLE` | No action selected | Draft | None | DND-03 | src/SessionActionDock.tsx | Baseline Play state |
| `R3-ACTION-SELECTED` | Capability selected | Draft | Partial | DND-03 | UX-01-04, UX-01-05, UX-01-06 | Awaiting target/resolve path |
| `R3-TARGET-SINGLE` | Single-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-19, ORIGIN-UX-01-20 | Valid click immediate execute |
| `R3-TARGET-MULTI` | Multi-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-20 | Explicit Execute |
| `R3-RESOLVING` | Resolution running | Draft | Blocked | DND-03 / DND-02 | ORIGIN-UX-01-21, GAP-RESOLUTION-SAFE-INTERACTIONS | Selective locking behavior reviewed; command-conflict semantics require Domain contract |
| `R3-INTERRUPT` | Reaction / interrupt pending | Draft | Blocked | DND-03 / DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS, src/App.tsx, src/SessionModeRoot.tsx | Exact safe interaction boundary is authoritative-domain work |
| `R3-DICE` | Physical dice presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Presentation-only authority |
| `R3-RESULT` | Result presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22, src/App.tsx, src/SessionModeRoot.tsx | Scene-integrated result then return to current Play context |
| `R3-HANDOUT-OVERLAY` | Handout Overlay | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Local dismiss allowed by reviewed intent |
| `R3-HANDOUT-UPPER` | Handout Upper Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Shared replacement state requires network contract |
| `R3-HANDOUT-FULL` | Handout Full Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Shared replacement state requires network contract |
| `R3-SHEET-SIMPLEVTT` | SimpleVTT Character Sheet layout mode | Reviewed | Partial | DND-01 | UX-03-05, UI-01-07, src/CharacterSheetPlayScreen.tsx | First-class optimized layout |
| `R3-SHEET-OFFICIAL` | Official-style Character Sheet layout mode | Reviewed | Partial | DND-01 | UX-03-05, UI-01-07, src/CharacterSheetPlayScreen.tsx | First-class official-style layout |
| `R3-BUILDER-GUIDED` | Guided Character Builder | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing accepted implementation |
| `R3-BUILDER-QUICK` | Quick Character Builder | Draft | Partial | DND-01 | UI-01-08, src/app/contracts.ts | Existing contract mode; preserve accepted Builder UX |
| `R3-BUILDER-IMPORT` | Character Import | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing accepted import mode |
| `R3-BUILDER-EDIT` | Character Edit | Draft | Partial | DND-01 | UI-01-08, src/CharacterCreateV10.tsx | Existing accepted edit path |

---

# R4 — Overlay & Interruptive Surfaces

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | Confirmation dialog pattern | Draft | None | INT-03 | — | AI-managed ordinary confirmation pattern unless consequence triggers material escalation |
| `R4-DESTRUCTIVE` | Destructive confirmation | Draft | Partial | INT-03 | DM-02-05 | Destructive/correction semantics must preserve authoritative history |
| `R4-UNSAVED` | Unsaved-change dialog | Draft | None | INT-03 | — | AI-managed ordinary unsaved-change handling within persistence contracts |
| `R4-DRAWER` | Drawer pattern | Draft | None | INT-02 | — | Contextual detail, not automatic destination |
| `R4-POPOVER` | Popover pattern | Draft | None | INT-02 | UX-03-06 | Anchored contextual detail/explanation |
| `R4-RESOLUTION-DRAWER` | Offline/Product-shell resolution drawer | Draft | Partial | DND-02 / DM-02 | ORIGIN-UX-01-22, DM-02-05, src/App.tsx | Current resolution/interrupt/adjudication host; history correction semantics reviewed |
| `R4-SESSION-RESOLUTION` | Connected-session resolution layer | Draft | Partial | DND-02 / SES-01 | ORIGIN-UX-01-21, ORIGIN-UX-01-22, src/SessionModeRoot.tsx | Current compact session result/interrupt layer |
| `R4-QUICK-SHEET` | In-session Quick Sheet | Draft | None | DND-01 / SES-01 | UX-03-03, src/SessionModeRoot.tsx | Contextual Player utility; detailed composition AI-managed |
| `R4-FULL-SHEET-LAYER` | In-session Full Character Sheet layer | Draft | Partial | DND-01 / SES-01 / INT-02 | UI-01-07, UX-01-03, src/SessionModeRoot.tsx, src/CharacterSheetPlayScreen.tsx | Session remains active behind selected sheet layout |
| `R4-SESSION-RULES` | In-session Rules pane | Draft | None | CONTENT-02 / SES-01 | NAV-01-05, src/SessionUtilityPanes.tsx | Contextual Rules surface |
| `R4-ACTIVITY` | Activity / Play Record surface | Draft | Blocked | DM-02 / SES-01 | ORIGIN-UX-01-22, DM-02-01, DM-02-05, GAP-DM-ONLY-DELIVERY-PROTOCOL, src/App.tsx, src/SessionUtilityPanes.tsx | DM view uses one chronology with public/private indicators+filter; private delivery remains architecture-blocked |
| `R4-ACTOR-CONTEXT` | Actor Context Menu | Reviewed | Partial | INT-01 | ORIGIN-UX-01-16, INT-01-02, INT-01-03 | UI/context-management actions only; no gameplay actions; no v1 keyboard-open equivalent; exact low-risk commands are AI-managed |
| `R4-TOOLTIP` | Tooltip / unavailable reason | Draft | Partial | INT-01 / CMP-01 | UX-03-06, INT-01-06, ORIGIN-UX-01-19, src/ProductionPlayScreen.tsx | Hover/focus explanation is normal; material blockers may also be inline |
| `R4-DM-HANDOUT-PANE` | DM Handout authoring pane | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | File select/preview/reveal/withdraw current evidence |
| `R4-PLAYER-HANDOUT-VIEWER` | Player Handout viewer | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Current modal implementation covers only part of reviewed mode model |
| `R4-HANDOUT-LIGHTBOX` | Handout image zoom/lightbox pattern | Draft | Partial | SES-01 / INT-02 | ORIGIN-UX-01-12, ORIGIN-UX-01-13 | Zoom/pan is local presentation detail within mode contract |
| `R4-REACTION-PROMPT` | Reaction/Interrupt prompt | Draft | Blocked | DND-04 | R3-INTERRUPT, GAP-RESOLUTION-SAFE-INTERACTIONS, src/App.tsx, src/SessionModeRoot.tsx | Response surface; authoritative safe-command boundary unresolved |
| `R4-CONCENTRATION-SAVE` | Concentration save input/result surface | Draft | None | DND-02 / STATE-01 | DND-02-09, STATE-01-08, src/ConcentrationSaveBridge.tsx | Current resolution-embedded d20 input/result evidence; exact response contract remains downstream |
| `R4-MOVEMENT-REACTION-INPUT` | Manual movement-reaction input dialog | Draft | None | DND-04 / INT-03 | src/MovementReactionBridge.tsx | Current implementation evidence; authority/invocation contract remains downstream |
| `R4-PORTRAIT-EDITOR` | Character portrait editor | Draft | None | DND-01 / INT-02 | src/CharacterPortraitBridge.tsx | Local image/focal-point editor attached to Character Sheet |
| `R4-IMPORT-REVIEW` | Import preview / validation review surface | Draft | Partial | CONTENT-02 / DND-01 / CMP-01 | CONTENT-02-04, CONTENT-02-09, src/V1ContentScreen.tsx, src/CharacterCreateV10.tsx, src/App.tsx | SimpleVTT package plus Character/Combatant import variants as applicable |
| `R4-ADJUDICATION` | DM adjudication surface | Draft | Partial | DM-02 | DM-02-05, docs/design/session-runtime.md, src/App.tsx | Corrections append history; remaining operation details are contract/default work |
| `R4-ACTIVITY-DETAIL` | Activity/resolution detail | Draft | Partial | DM-02 / SES-01 | ORIGIN-UX-01-22, DM-02-01, DM-02-05, src/SessionUtilityPanes.tsx | Durable detail path including correction relationships and DM visibility state |
| `R4-ENCOUNTER` | Encounter Manager | Draft | Partial | DM-01 / SES-01 | NAV-01-05, DM-01-03, src/SessionDmTools.tsx, src/App.tsx | Contextual DM tool; ordinary encounter controls plus optional advanced spatial authoring |
| `R4-DM-SPATIAL-RELATION` | DM spatial relation authoring | Reviewed | Partial | DM-01 / SES-01 | UX-02-05, DM-01-03, src/ProductionSessionWorkspaceBridge.tsx | Productized as advanced DM-only tool; authoritative relation projection remains contract work |
| `R4-PARTICIPANTS` | DM Participants pane | Draft | Partial | DM-01 / SES-01 | SES-01-05, src/SessionDmTools.tsx | Connected-session participant utility must support normal mid-session join deltas |
| `R4-SESSION-SHARE` | DM Session Share pane | Draft | Partial | DM-01 / SES-01 | CONTENT-02-11, src/SessionDmTools.tsx | Shows live connection/share info and the fixed active-session content snapshot |
| `R4-PLAYER-SESSION` | Player Session/connection pane | Draft | Partial | SES-01 / SES-02 | UX-01-03, SES-01-05, src/SessionPlayerSession.tsx | Connection, late join/rejoin and leave utility |
| `R4-FILE-PICKER` | File selection flow | Draft | Partial | CMP-01 / CONTENT-02 | CONTENT-02-04, src/V1ContentScreen.tsx, src/SessionImageHandoutBridge.tsx, src/CharacterPortraitBridge.tsx | Content package file selection plus portrait/handout uses as applicable |

Developer-only `DebugPanel` is intentionally excluded from product UI Registry coverage. If it becomes user-facing, add it explicitly instead of silently treating debug UI as product UX.

---

# R5 — Feedback & Notification

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R5-TOAST-SUCCESS` | Success toast | Draft | None | STATE-01 | — | Brief non-blocking success |
| `R5-TOAST-INFO` | Informational toast | Draft | None | STATE-01 | — | Brief non-blocking info |
| `R5-TOAST-WARN` | Warning toast | Draft | None | STATE-01 | — | Non-blocking warning only |
| `R5-INLINE-ALERT` | Inline alert | Draft | None | STATE-01 | INT-01-06, src/V1ContentScreen.tsx, src/ProductionSessionWorkspaceBridge.tsx | Scoped task/section feedback |
| `R5-BANNER` | Persistent banner | Draft | None | STATE-02 | UX-03-08, src/App.tsx | Persistent global/session issue |
| `R5-STATUS` | Status indicator | Draft | Partial | STATE-02 | INT-01-07, src/SessionModeRoot.tsx | Connected/current-turn/operational state may also feed NOTICE UI |
| `R5-PROGRESS` | Progress indicator | Draft | None | STATE-01 | src/SessionActionDock.tsx, src/SessionDmTools.tsx | Real pending work only |
| `R5-FIELD-VALIDATION` | Field validation | Draft | None | STATE-01 | src/CharacterCreateV10.tsx, src/V1ContentScreen.tsx | Input-specific error |
| `R5-ROLL-RESULT` | Roll/action result feedback | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22, UX-03-08, src/App.tsx, src/SessionModeRoot.tsx | Scene/session-integrated result; durable detail in Activity |
| `R5-STANDALONE-ROLL-RESULT` | Standalone Character roll result | Draft | None | DND-01 / DND-02 | UX-03-05, src/OfficialCharacterSheetPlayScreen.tsx | Local result panel + physical dice evidence |
| `R5-CONNECTION-RECOVERY` | Connection recovery strip/status | Draft | Partial | STATE-02 / SES-02 | UX-01-03, NAV-01-08, src/SessionPlayerSession.tsx | Transient reconnect while app is running; process relaunch starts Home |
| `R5-HANDOUT-ERROR` | Handout client/author error | Draft | Blocked | STATE-02 / SES-01 | GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Current inline/status error evidence |
| `R5-SESSION-COMPATIBILITY` | Session compatibility / host-join error alert | Draft | None | STATE-02 / SES-02 | src/ProductionSessionWorkspaceBridge.tsx, src/SessionDmTools.tsx | Current error/warning presentation; exact recovery semantics are technical contract work |
| `R5-ACTIVITY-EVENT` | Durable activity event | Draft | Blocked | DM-02 / SES-02 | DM-02-01, DM-02-05, ORIGIN-UX-01-29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Durable history/correction semantics reviewed; private projection remains architecture-blocked |

---

# R6 — System & Edge States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R6-INITIAL-LOAD` | Initial loading | Draft | None | STATE-02 | NAV-01-08, src/ProductRoot.tsx | Fresh app launch lands at Home after bootstrap |
| `R6-PENDING` | Local/remote operation pending | Draft | None | STATE-01 | src/SessionActionDock.tsx, src/SessionDmTools.tsx | Prevent duplicate submission as needed |
| `R6-EMPTY` | Empty state | Draft | None | STATE-01 | src/ProductionPlayScreen.tsx, src/V1ContentScreen.tsx, src/SessionUtilityPanes.tsx | Must expose next valid action when one exists |
| `R6-NO-RESULTS` | No search results | Draft | None | STATE-01 | src/SessionUtilityPanes.tsx, src/App.tsx | Query-aware |
| `R6-DISABLED` | Disabled/unavailable | Draft | Partial | STATE-01 | UX-01-05, INT-01-06, src/SessionActionDock.tsx | Material unavailable reason must be discoverable |
| `R6-RECOVERABLE-ERROR` | Recoverable error | Draft | None | STATE-02 | src/ProductionSessionWorkspaceBridge.tsx, src/CharacterPortraitBridge.tsx | Retry/recovery path |
| `R6-BLOCKING-ERROR` | Blocking error | Draft | None | STATE-02 | src/V1ContentScreen.tsx, src/CharacterCreateV10.tsx | Explicit blocker |
| `R6-SAVE-FAILURE` | Save failure | Draft | None | STATE-02 | src/App.tsx | Data preservation/retry required |
| `R6-UNSUPPORTED` | Unsupported content/mechanic | Draft | Partial | STATE-02 | CONTENT-02-04, docs/design/README.md, src/App.tsx | No heuristic package/mechanic approximation |
| `R6-DISCONNECTED` | Disconnected | Draft | Partial | STATE-02 / SES-02 | UX-01-03, NAV-01-08, src/SessionPlayerSession.tsx | Transient recovery while process stays active; relaunch starts Home |
| `R6-RECONNECTING` | Reconnecting | Draft | Partial | STATE-02 / SES-02 | UX-01-03, docs/design/session-runtime.md, src/SessionPlayerSession.tsx | Preserve canonical live-session context during supported reconnect |
| `R6-INCOMPATIBLE` | Incompatible session/content | Draft | None | STATE-02 | CONTENT-02-11, src/ProductionSessionWorkspaceBridge.tsx, src/SessionDmTools.tsx | Live session uses fixed content snapshot; compatibility failure stays explicit |
| `R6-NO-VALID-CHARACTER` | Join has no valid saved Character | Reviewed | Partial | UX-02 / SES-01 | SES-01-04, src/ProductionSessionWorkspaceBridge.tsx, src/ProductionSessionDirectNetworkBridge.tsx | Join blocked; show Create/Import recovery; retry Join after a valid Character exists |
| `R6-PERMISSION` | Permission/authority denied | Draft | Partial | STATE-02 / SES-02 | UX-02-08, ORIGIN-UX-01-26, ORIGIN-UX-01-29 | Do not leak unauthorized data |
| `R6-STALE` | Stale/reconciliation state | Draft | None | STATE-02 / SES-02 | docs/design/session-runtime.md | Canonical resync behavior |
| `R6-REDUCED-MOTION` | Reduced Motion | Draft | Partial | A11Y-01 / R9 | ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Result-preserving presentation |
| `R6-NARROW` | Narrow Desktop | Reviewed | Partial | PLATFORM-01 | PLATFORM-01-01, UX-01-04, UX-01-07 | Narrow desktop is supported; mobile/touch-first is out of v1 scope |

---

# R7 — Components & Controls

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R7-PRIMARY-NAV` | Product Shell primary navigation | Reviewed | Partial | NAV-01 / CMP-01 | NAV-01-01, UI-01-01, src/App.tsx | Top navigation/header with Reviewed global destination order; current sidebar code is drift evidence |
| `R7-BUTTON` | Button family | Draft | None | CMP-01 | — | AI-managed design-system variants |
| `R7-TABS` | Standard tabs | Draft | None | CMP-01 | — | AI-managed peer-content navigation |
| `R7-HOTBAR-TABS` | Hotbar page tabs | Reviewed | Partial | DND-03 / CMP-01 | ORIGIN-UX-01-07 | Mixed/Action/Spell/Item + custom baseline |
| `R7-TOGGLE` | Toggle | Draft | None | CMP-01 | — | AI-managed immediate boolean control |
| `R7-SEGMENTED` | Segmented mode control | Draft | None | CMP-01 | — | AI-managed small exclusive set |
| `R7-SEARCH` | Search input | Draft | None | CMP-01 | src/App.tsx, src/SessionUtilityPanes.tsx | Rules/content/library use as applicable |
| `R7-FILTER` | Filter controls | Draft | None | CMP-01 | DM-02-01, src/App.tsx, src/LevelUpV10.tsx | Includes Activity public/private filter when applicable |
| `R7-CHAR-CARD` | Character Card | Draft | None | DND-01 / CMP-01 | NAV-01-03, src/App.tsx | Library/select uses |
| `R7-ACTOR-CARD` | Actor Card | Reviewed | Partial | INT-01 / SES-01 | ORIGIN-UX-01-10, ORIGIN-UX-01-11, ORIGIN-UX-01-16, ORIGIN-UX-01-19, INT-01-02 | Core scene interaction surface |
| `R7-COMMAND-CENTER` | Bottom Command Center container | Reviewed | Partial | SES-01 / DND-03 | UX-01-07, UI-01-05, ORIGIN-UX-01-09 | BG3-family co-primary bottom command surface |
| `R7-HOTBAR-SLOT` | Capability/Hotbar slot | Reviewed | Partial | DND-03 | UX-01-04, UX-01-05, UX-01-06 | Capability execution/discoverability |
| `R7-ECONOMY` | Action-economy indicator | Reviewed | Partial | DND-03 | UI-01-05, ORIGIN-UX-01-08 | Fixed economy grammar |
| `R7-RESOURCE-RAIL` | Dynamic Resource Rail | Reviewed | Partial | DND-03 | UI-01-05, ORIGIN-UX-01-08 | Canonical resource projection |
| `R7-INITIATIVE-ENTRY` | Initiative tracker entry | Reviewed | Partial | DND-04 | UI-01-04, ORIGIN-UX-01-15, src/SessionInitiativeStrip.tsx | Compact current/order info |
| `R7-SESSION-UTILITY-RAIL` | In-session utility rail / side-pane launchers | Draft | Partial | SES-01 / NAV-01 / CMP-01 | NAV-01-05, UI-01-06, src/SessionModeRoot.tsx | Contextual utilities use side panes; exact launcher detail AI-managed |
| `R7-SHEET-LAYOUT-SWITCH` | Character Sheet layout switch | Reviewed | Partial | DND-01 / CMP-01 | UI-01-07, NAV-01-07, src/CharacterSheetPlayScreen.tsx, src/CharacterLibraryUxBridge.tsx | Official-style / SimpleVTT layout preference, initially chosen during onboarding |
| `R7-PORTRAIT` | Character portrait control | Draft | None | DND-01 / CMP-01 | src/CharacterPortraitBridge.tsx | Current image/focal-point UI evidence |
| `R7-CONNECTION-STATUS` | Session connection status indicator | Draft | Partial | SES-02 / CMP-01 | UX-01-03, INT-01-07, src/SessionModeRoot.tsx, src/SessionPlayerSession.tsx | Connected/reconnecting/disconnected projection; important state may feed NOTICE UI |
| `R7-SESSION-IDENTITY` | Session actor/character identity chip | Draft | None | SES-01 / CMP-01 | UX-02-01, UX-02-03, src/SessionModeRoot.tsx | Player/DM identity and controlled Actor context |
| `R7-STATUS` | Status/condition indicator | Draft | None | CMP-01 / DND-04 | INT-01-07 | Canonical projection plus persistent NOTICE summary where material |
| `R7-FILE-INPUT` | File picker/input | Draft | Partial | CMP-01 | CONTENT-02-04, src/V1ContentScreen.tsx, src/SessionImageHandoutBridge.tsx, src/CharacterPortraitBridge.tsx | Add-on import accepts official SimpleVTT package; other asset uses as applicable |
| `R7-ZOOM-PAN` | Zoom/pan controls | Draft | Partial | CMP-01 / SES-01 | ORIGIN-UX-01-13 | Handout local presentation; shared mode contract still blocked |

---

# R8 — Content & Messaging

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R8-ONBOARDING` | First-use/onboarding copy | Draft | Partial | CONTENT-01 / UX-03 | NAV-01-07, UI-01-07, src/V1HomeScreen.tsx | Dedicated first-run tutorial; exact copy AI-managed |
| `R8-ACTION-LABELS` | Action button labels | Draft | None | CONTENT-01 | — | Prefer result/action wording over vague labels |
| `R8-CONFIRM-COPY` | Confirmation copy anatomy | Draft | None | CONTENT-01 / INT-03 | — | Consequence + explicit actions; low-risk wording AI-managed |
| `R8-DESTRUCTIVE-COPY` | Destructive wording | Draft | Partial | CONTENT-01 / INT-03 | DM-02-05 | Identify affected outcome without implying history deletion |
| `R8-ERROR-COPY` | Error anatomy | Draft | None | CONTENT-01 / STATE-02 | src/V1ContentScreen.tsx, src/ProductionSessionWorkspaceBridge.tsx | What failed / impact / recovery |
| `R8-EMPTY-COPY` | Empty-state copy | Draft | None | CONTENT-01 / STATE-01 | src/V1ContentScreen.tsx, src/SessionUtilityPanes.tsx | Context + valid next action |
| `R8-DISABLED-REASON` | Unavailable reason | Draft | Partial | CONTENT-01 / DND-03 | INT-01-06, ORIGIN-UX-01-18, ORIGIN-UX-01-19, src/SessionActionDock.tsx | Hover/focus canonical reason; material blockers may appear inline |
| `R8-VISIBILITY` | Public / DM Only terminology | Reviewed | Partial | SES-02 / CONTENT-01 | ORIGIN-UX-01-26, ORIGIN-UX-01-27, DM-01-01 | New session defaults Public; chosen toggle value persists for live-session lifetime; secret delivery still architecture-governed |
| `R8-RESULT-TERMS` | Roll/result terminology | Draft | None | CONTENT-01 / DND-02 | src/App.tsx, src/SessionModeRoot.tsx | Canonical outcome vocabulary may be AI-managed within domain terminology |
| `R8-CONNECTION` | Connection-state wording | Draft | Partial | CONTENT-01 / STATE-02 | UX-01-03, NAV-01-08, SES-01-05, src/SessionPlayerSession.tsx | Distinguish late join/reconnect from fresh app relaunch |

---

# R9 — Motion & Temporal Behavior

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R9-DICE-THROW` | Physical dice throw/roll/settle | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Authoritative result first; physics presentation only |
| `R9-RESULT-REVEAL` | Result reveal timing | Draft | None | DND-02 | ORIGIN-UX-01-22, src/VisualDiceBridge.tsx | Exact non-authoritative timing is AI/Motion-contract detail |
| `R9-RESOLUTION-AUTO-ADVANCE` | Resolution animation auto-advance timing | Draft | None | DND-02 / STATE-01 / A11Y-01 | src/App.tsx, src/SessionModeRoot.tsx | Current numeric timers are implementation evidence, not approved budgets |
| `R9-COMBAT-VFX` | Combat delivery/impact VFX | Draft | None | DND-02 / DND-04 / A11Y-01 | src/CombatVfxBridge.tsx | Timing/reduced-motion detail belongs to contracts |
| `R9-INTERRUPT-TIMING` | Reaction prompt timing/timeout | Draft | Blocked | DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Do not invent authoritative timeout/safe-command semantics |
| `R9-TOAST-LIFETIME` | Toast duration/auto-dismiss | Draft | None | STATE-01 | — | AI-managed timing within accessibility/readability constraints |
| `R9-OVERLAY-ENTER-EXIT` | Overlay transitions | Draft | None | INT-02 | src/SessionModeRoot.tsx | Preserve focus/interaction semantics |
| `R9-REDUCED-MOTION` | Reduced-motion equivalents | Draft | Partial | A11Y-01 | ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Preserve information/order/result |

---

# Current implementation evidence — not product authority

The following observations are recorded only to prevent current code from being mistaken for planning truth during later work.

- Connected sessions currently route from `ProductRoot` directly to `SessionModeRoot`, bypassing the common Product Shell. This differs from `UX-01-02` / `UX-01-03` planning intent and is implementation drift, not a new decision. (`src/ProductRoot.tsx`)
- Current Home exposes one combined `Host / Join` Session entry rather than distinct direct Host and direct Join actions. `ORIGIN-FLOW-01` remains the canonical planning direction. (`src/V1HomeScreen.tsx`)
- Current connected Freeform/Initiative focus does not render the reviewed upper opposing + lower allied Actor Board topology. `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11`, and `ORIGIN-UX-01-14` remain canonical planning intent. (`src/SessionMainFocus.tsx`, `src/SessionModeRoot.tsx`)
- Current connected `SessionActionDock` is an intent-first funnel that hides the full capability set behind intent/all-action expansion. It must not override `UX-01-04`, `UX-01-06`, `ORIGIN-UX-01-07`, `ORIGIN-UX-01-08`, and `ORIGIN-UX-01-09`. (`src/SessionActionDock.tsx`)
- Current Player handout implementation is a dismissible modal viewer. It does not satisfy the reviewed Overlay / Upper Scene / Full Scene mode model by itself; `GAP-HANDOUT-NETWORK-CONTRACT` remains blocking. (`src/SessionImageHandoutBridge.tsx`)
- Current Join UI's no-Character block now aligns with `SES-01-04` at the policy level; implementation still must provide the Reviewed Create/Import recovery and retry flow rather than treating the old code as sufficient by itself. (`src/ProductionSessionWorkspaceBridge.tsx`, `src/ProductionSessionDirectNetworkBridge.tsx`)
- Current Product-shell and connected-session Activity surfaces are user-facing evidence; final DM private presentation now follows `DM-02-01`, while actual non-delivery of secret records remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`. (`src/App.tsx`, `src/SessionUtilityPanes.tsx`)
- `ConcentrationSaveBridge` currently inserts a concentration-save d20 input/result surface into the resolution drawer. That existence does not decide authoritative response semantics. (`src/ConcentrationSaveBridge.tsx`)
- The current Host workspace exposes a distance/visibility/cover editor. `DM-01-03` now productizes that capability as an **advanced contextual DM tool**, not a default always-visible Play control. (`src/ProductionSessionWorkspaceBridge.tsx`)
- `CombatSpellHudBridge` is imported by `main.tsx` but is not rendered into the active root; it is excluded from active user-facing inventory until an actual entry path exists. (`src/main.tsx`)
- Despite its filename, `LegacyCharacterSheetPlayScreen.tsx` is currently the active SimpleVTT sheet-layout implementation selected by `CharacterSheetWorkspace`; filename heuristics must not classify it as inactive. (`src/CharacterSheetPlayScreen.tsx`)
- Developer `DebugPanel` remains excluded from product UI coverage unless explicitly promoted later. (`src/App.tsx`)

---

# Inventory completion check

The Route D inventory cross-check covers:

- every active route/surface reachable from the current Product/Session entry graph;
- every user-facing globally mounted bridge/portal in `main.tsx`;
- the derived `master-flow.md` topology and Reviewed Decision Cards;
- generic INT/STATE/CMP/A11Y/PLATFORM non-route patterns represented by R4-R9;
- every active Planning Gap with UI/UX impact;
- user-facing confirmation, notification, validation, permission, reconnect, handout, reaction, import, motion, Activity, concentration-save, and spatial-relation evidence discovered in the active runtime graph.

Inactive imports, developer-only UI, and historical filenames are classified explicitly rather than treated as product truth.

**Route D R1-R9 inventory cross-check: PASS for the current active runtime/planning snapshot.** Future code or planning changes may require a bounded delta audit; they do not keep the current Global Planning Gate blocked.

Owner material checkpoints are complete. Remaining low-risk `Draft` rows are resolved through AI Design Defaults/contracts under `OWNER-CONTROL-POLICY.md`, while rules/network/privacy/persistence truth remains Domain/Architecture-owned.

New rows may be added without owner approval when they only identify an existing/planned artifact. **Adding a row does not decide new material product behavior.** Any new material behavior still follows the Owner Checkpoint / AI Design Default / Domain-Architecture classification policy.

`Contract Readiness` is derived maintenance. AI may downgrade or upgrade `None / Partial / Blocked / Ready` when referenced contracts/gaps change, but MUST NOT change Planning Maturity without the decision lifecycle defined in the framework.
