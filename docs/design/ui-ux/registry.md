# SimpleVTT R1-R9 UI Registry

Status: **Draft inventory — owner review not complete**

This file answers **what UI artifacts exist or are planned**. Normative product behavior lives in `decisions.md`; this file references decisions instead of duplicating them.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Gaps: [`planning-gaps.md`](planning-gaps.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)

## Two-axis status model

Registry rows separate two different questions:

1. **Planning Maturity** — how far the product decision for the artifact as a whole has progressed.
2. **Contract Readiness** — whether enough explicit contract exists for safe implementation.

A reviewed sub-decision does not automatically make the whole Registry artifact `Reviewed`. Use `Refs`/`Note` to show reviewed aspects while keeping artifact-level Planning Maturity `Draft` when material behavior/topology remains unreviewed.

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

A row existing here does not approve its final topology, placement, or behavior.

---

# R1 — IA & Destination

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R1-HOME` | Home | Draft | Partial | NAV-01 | UX-01-01, UX-01-02, ORIGIN-FLOW-01, src/V1HomeScreen.tsx | Product hub; direct Session entry direction reviewed, final navigation pending |
| `R1-CHARACTERS` | Character Library destination | Draft | None | NAV-01 / DND-01 | UX-01-01, src/App.tsx | Character management |
| `R1-CHAR-SHEET` | Character Sheet destination | Draft | Partial | DND-01 | UX-01-01, src/CharacterSheetPlayScreen.tsx | Standalone first-class surface; two current layout variants exist as evidence |
| `R1-CHAR-BUILDER` | Character Builder workspace | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Create/Edit/Import modes |
| `R1-LEVEL-UP` | Level Up workspace | Draft | None | DND-01 | src/LevelUpV10.tsx | Progression flow |
| `R1-SESSION` | Session destination | Draft | Partial | NAV-01 / SES-01 | UX-01-01, ORIGIN-FLOW-01, src/ProductionSessionWorkspaceBridge.tsx | Direct Host/Join direction reviewed; final destination topology/lifecycle pending |
| `R1-PLAY` | Dedicated Play Workspace | Draft | Partial | SES-01 | UX-01-02, UX-01-07, src/SessionModeRoot.tsx, src/ProductionPlayScreen.tsx | Connected and offline implementations currently differ; reviewed Play topology remains canonical planning intent |
| `R1-CONTENT` | Content / Add-ons | Draft | None | CONTENT-02 | src/V1ContentScreen.tsx | Installed/imported content management |
| `R1-RULES` | Rules Browser | Draft | None | CONTENT-02 / NAV-01 | src/App.tsx, src/SessionUtilityPanes.tsx | Product-shell Rules plus current in-session contextual Rules pane |
| `R1-SETTINGS` | Settings | Draft | None | NAV-01 | src/App.tsx, src/AppearanceSettingsBridge.tsx | Preferences / appearance / reduced motion |

Not yet promoted to top-level destinations: Activity, Encounter Manager, Adjudication. Current implementation may expose routes or utility panes for them; existence in code does not decide final topology.

---

# R2 — Task Flows

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R2-FIRST-USE` | First-use / Home onboarding | Draft | None | UX-03 / NAV-01 / CONTENT-01 | src/V1HomeScreen.tsx | Current dismiss/reopen guide is implementation evidence; final onboarding scope unreviewed |
| `R2-NEW-CHAR` | New Character flow | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Home -> Builder -> Review -> Sheet |
| `R2-OPEN-CHAR` | Open saved Character | Draft | None | DND-01 | src/App.tsx, src/CharacterLibraryUxBridge.tsx | Home/Library -> selected Sheet |
| `R2-EDIT-CHAR` | Edit Character | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Sheet -> Builder -> Sheet |
| `R2-LEVEL-UP` | Level Up | Draft | None | DND-01 | src/LevelUpV10.tsx | Sheet -> Level Up -> Review -> Sheet |
| `R2-STANDALONE-ROLL` | Standalone Character roll | Draft | None | DND-01 / DND-02 | UX-01-01, src/OfficialCharacterSheetPlayScreen.tsx | Current local sheet roll exists; exact standalone roll UX remains downstream review |
| `R2-HOST` | Host Session | Draft | Partial | SES-01 | ORIGIN-FLOW-01, src/ProductionSessionWorkspaceBridge.tsx, src/ProductionSessionDirectNetworkBridge.tsx | Direct Host entry reviewed; setup/lobby/recovery details pending |
| `R2-JOIN` | Join Session | Draft | Blocked | SES-01 / UX-02 | ORIGIN-FLOW-01, ORIGIN-FLOW-02, GAP-JOIN-NO-CHARACTER, src/ProductionSessionWorkspaceBridge.tsx | Direct Join + Character Select reviewed; current no-character block is evidence only |
| `R2-PLAY-ACTION` | Capability -> target -> resolution -> result | Draft | Partial | DND-03 / DND-02 | ORIGIN-UX-01-19, ORIGIN-UX-01-20, ORIGIN-UX-01-21, ORIGIN-UX-01-22, ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/SessionActionDock.tsx | Core play loop; current intent-first implementation is non-normative evidence |
| `R2-INITIATIVE` | Enter/exit Initiative | Draft | Partial | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15, src/SessionInitiativeStrip.tsx | Same Play Workspace direction reviewed |
| `R2-HANDOUT` | DM handout presentation | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Current implementation supports one modal viewer path; reviewed three-mode behavior remains canonical intent |
| `R2-DM-DISCLOSE` | DM-only roll later disclosure | Draft | Blocked | SES-02 / DM-02 | ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Needs authority contract |
| `R2-DM-ADJUDICATE` | DM adjudicate active resolution | Draft | None | DM-02 | src/App.tsx | Current implementation evidence; exact product policy/map not reviewed |
| `R2-DM-UNDO` | DM undo/correct recent resolution | Draft | None | DM-02 | src/App.tsx, src/SessionUtilityPanes.tsx | Existing Undo affordances are evidence; downstream policy still pending |
| `R2-CONTENT-INSTALL` | Add-on install | Draft | None | CONTENT-02 | src/V1ContentScreen.tsx | File -> Preview -> Validate -> Install |
| `R2-RECONNECT` | Reconnect / recovery | Draft | Partial | SES-02 / STATE-02 | UX-01-03, src/SessionPlayerSession.tsx | Preserve canonical session context |
| `R2-LEAVE` | Player leave | Draft | None | SES-01 / INT-03 | src/SessionPlayerSession.tsx | Consequence/confirmation still TBD |
| `R2-END-SESSION` | Host end session | Draft | None | SES-01 / INT-03 | src/SessionDmTools.tsx, src/SessionModeRoot.tsx | Current direct end controls exist; destructive-flow policy pending |

---

# R3 — Workspace Modes & Interaction States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R3-PLAY-FREEFORM` | Freeform mode | Draft | Partial | SES-01 | ORIGIN-UX-01-10, ORIGIN-UX-01-11, docs/design/session-runtime.md, src/SessionMainFocus.tsx | Reviewed Actor Board topology is not currently realized by connected SessionModeRoot |
| `R3-PLAY-INITIATIVE` | Initiative mode | Draft | Partial | DND-04 | ORIGIN-UX-01-14, ORIGIN-UX-01-15, docs/design/session-runtime.md, src/SessionInitiativeStrip.tsx | Adds compact top tracker; Actor Board preservation remains reviewed intent |
| `R3-ACTION-IDLE` | No action selected | Draft | None | DND-03 | src/SessionActionDock.tsx | Baseline Play state |
| `R3-ACTION-SELECTED` | Capability selected | Draft | Partial | DND-03 | UX-01-04, UX-01-05, UX-01-06 | Awaiting target/resolve path |
| `R3-TARGET-SINGLE` | Single-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-19, ORIGIN-UX-01-20 | Valid click immediate execute |
| `R3-TARGET-MULTI` | Multi-target targeting | Draft | Partial | DND-03 | ORIGIN-UX-01-20 | Explicit Execute |
| `R3-RESOLVING` | Resolution running | Draft | Blocked | DND-03 / DND-02 | ORIGIN-UX-01-21, GAP-RESOLUTION-SAFE-INTERACTIONS | Selective locking boundary incomplete |
| `R3-INTERRUPT` | Reaction / interrupt pending | Draft | Blocked | DND-03 / DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS, src/App.tsx, src/SessionModeRoot.tsx | Exact safe-interaction boundary TBD |
| `R3-DICE` | Physical dice presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Presentation-only authority |
| `R3-RESULT` | Result presentation | Draft | Partial | DND-02 | ORIGIN-UX-01-22, src/App.tsx, src/SessionModeRoot.tsx | Return to current Play context |
| `R3-HANDOUT-OVERLAY` | Handout Overlay | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Local dismiss allowed by reviewed intent |
| `R3-HANDOUT-UPPER` | Handout Upper Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Shared replacement state not implemented in current viewer |
| `R3-HANDOUT-FULL` | Handout Full Scene | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT | Shared replacement state not implemented in current viewer |
| `R3-SHEET-SIMPLEVTT` | SimpleVTT Character Sheet layout mode | Draft | None | DND-01 | src/CharacterSheetPlayScreen.tsx | Current local presentation preference evidence |
| `R3-SHEET-OFFICIAL` | Official-style Character Sheet layout mode | Draft | None | DND-01 | src/CharacterSheetPlayScreen.tsx | Current local presentation preference evidence |
| `R3-BUILDER-GUIDED` | Guided Character Builder | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Builder mode |
| `R3-BUILDER-QUICK` | Quick Character Builder | Draft | None | DND-01 | src/app/contracts.ts | Contract mode exists; active V10 UI coverage must be verified |
| `R3-BUILDER-IMPORT` | Character Import | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Builder import mode |
| `R3-BUILDER-EDIT` | Character Edit | Draft | None | DND-01 | src/CharacterCreateV10.tsx | Builder edit path |

---

# R4 — Overlay & Interruptive Surfaces

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | Confirmation dialog pattern | Draft | None | INT-03 | — | Use only when a decision is actually required |
| `R4-DESTRUCTIVE` | Destructive confirmation | Draft | None | INT-03 | — | Delete/end/irreversible consequences |
| `R4-UNSAVED` | Unsaved-change dialog | Draft | None | INT-03 | — | Edit/build flows |
| `R4-DRAWER` | Drawer pattern | Draft | None | INT-02 | — | Contextual detail, not automatic destination |
| `R4-POPOVER` | Popover pattern | Draft | None | INT-02 | — | Anchored contextual UI |
| `R4-RESOLUTION-DRAWER` | Offline/Product-shell resolution drawer | Draft | Partial | DND-02 / DM-02 | ORIGIN-UX-01-22, src/App.tsx | Current resolution, interrupt, adjudication and Undo host |
| `R4-SESSION-RESOLUTION` | Connected-session resolution layer | Draft | Partial | DND-02 / SES-01 | ORIGIN-UX-01-21, ORIGIN-UX-01-22, src/SessionModeRoot.tsx | Current compact session result/interrupt layer |
| `R4-QUICK-SHEET` | In-session Quick Sheet | Draft | None | DND-01 / SES-01 | src/SessionModeRoot.tsx | Current contextual Player utility; topology not reviewed |
| `R4-FULL-SHEET-LAYER` | In-session Full Character Sheet layer | Draft | None | DND-01 / SES-01 / INT-02 | src/SessionModeRoot.tsx, src/CharacterSheetPlayScreen.tsx | Session remains active behind full sheet |
| `R4-SESSION-RULES` | In-session Rules pane | Draft | None | CONTENT-02 / SES-01 | src/SessionUtilityPanes.tsx | Current contextual Rules surface |
| `R4-ACTIVITY` | Activity / Play Record surface | Draft | Blocked | DM-02 / SES-01 | ORIGIN-UX-01-22, DM-02-01, DM-02-09, GAP-DM-PRIVATE-ACTIVITY-PRESENTATION, src/App.tsx, src/SessionUtilityPanes.tsx | Current product-shell and connected utility surfaces; private-event presentation remains deferred |
| `R4-ACTOR-CONTEXT` | Actor Context Menu | Draft | Blocked | INT-01 | ORIGIN-UX-01-16, GAP-ACTOR-CONTEXT-MENU-CONTENTS | Context-menu pattern reviewed; command contents remain material TBD |
| `R4-TOOLTIP` | Tooltip / unavailable reason | Draft | Partial | INT-01 / CMP-01 | ORIGIN-UX-01-19, src/ProductionPlayScreen.tsx | Must not be sole carrier of essential info |
| `R4-DM-HANDOUT-PANE` | DM Handout authoring pane | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | File select/preview/reveal/withdraw current evidence |
| `R4-PLAYER-HANDOUT-VIEWER` | Player Handout viewer | Draft | Blocked | SES-01 | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Current modal implementation covers only part of reviewed mode model |
| `R4-HANDOUT-LIGHTBOX` | Handout image zoom/lightbox pattern | Draft | Partial | SES-01 / INT-02 | ORIGIN-UX-01-12, ORIGIN-UX-01-13 | Zoom/pan behavior downstream |
| `R4-REACTION-PROMPT` | Reaction/Interrupt prompt | Draft | Blocked | DND-04 | R3-INTERRUPT, GAP-RESOLUTION-SAFE-INTERACTIONS, src/App.tsx, src/SessionModeRoot.tsx | Response surface |
| `R4-CONCENTRATION-SAVE` | Concentration save input/result surface | Draft | None | DND-02 / STATE-01 | DND-02-09, STATE-01-08, src/ConcentrationSaveBridge.tsx | Current resolution-embedded d20 input/result evidence; exact UX/role handling remains downstream review |
| `R4-MOVEMENT-REACTION-INPUT` | Manual movement-reaction input dialog | Draft | None | DND-04 / INT-03 | src/MovementReactionBridge.tsx | Current implementation evidence; product role/authority/confirmation policy unreviewed |
| `R4-PORTRAIT-EDITOR` | Character portrait editor | Draft | None | DND-01 / INT-02 | src/CharacterPortraitBridge.tsx | Local image/focal-point editor attached to Character Sheet |
| `R4-IMPORT-REVIEW` | Import preview / validation review surface | Draft | None | CONTENT-02 / DND-01 / CMP-01 | src/V1ContentScreen.tsx, src/CharacterCreateV10.tsx, src/App.tsx | Used by add-on, Character and Combatant import implementations |
| `R4-ADJUDICATION` | DM adjudication surface | Draft | None | DM-02 | src/App.tsx | Current implementation embedded in resolution drawer; final topology/policy TBD |
| `R4-ACTIVITY-DETAIL` | Activity/resolution detail | Draft | Partial | DM-02 / SES-01 | ORIGIN-UX-01-22, src/SessionUtilityPanes.tsx | Durable detail path |
| `R4-ENCOUNTER` | Encounter Manager | Draft | None | DM-01 / SES-01 | src/SessionDmTools.tsx, src/App.tsx | Current route/pane evidence; final topology pending review |
| `R4-DM-SPATIAL-RELATION` | DM spatial relation authoring | Draft | None | DM-01 / SES-01 | DM-01-03, DM-01-08, src/ProductionSessionWorkspaceBridge.tsx | Current live-Host distance/visibility/cover editor evidence; product scope, placement and authority remain unreviewed |
| `R4-PARTICIPANTS` | DM Participants pane | Draft | None | DM-01 / SES-01 | src/SessionDmTools.tsx | Current connected-session utility evidence |
| `R4-SESSION-SHARE` | DM Session Share pane | Draft | None | DM-01 / SES-01 | src/SessionDmTools.tsx | Address/content/compatibility/end-session utility evidence |
| `R4-PLAYER-SESSION` | Player Session/connection pane | Draft | Partial | SES-01 / SES-02 | UX-01-03, src/SessionPlayerSession.tsx | Connection, rejoin and leave utility |
| `R4-FILE-PICKER` | File selection flow | Draft | None | CMP-01 / CONTENT-02 | src/V1ContentScreen.tsx, src/SessionImageHandoutBridge.tsx, src/CharacterPortraitBridge.tsx | Add-on/portrait/handout uses as applicable |

Developer-only `DebugPanel` is intentionally excluded from product UI Registry coverage. If it becomes user-facing, add it explicitly instead of silently treating debug UI as product UX.

---

# R5 — Feedback & Notification

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R5-TOAST-SUCCESS` | Success toast | Draft | None | STATE-01 | — | Brief non-blocking success |
| `R5-TOAST-INFO` | Informational toast | Draft | None | STATE-01 | — | Brief non-blocking info |
| `R5-TOAST-WARN` | Warning toast | Draft | None | STATE-01 | — | Non-blocking warning only |
| `R5-INLINE-ALERT` | Inline alert | Draft | None | STATE-01 | src/V1ContentScreen.tsx, src/ProductionSessionWorkspaceBridge.tsx | Scoped to task/section |
| `R5-BANNER` | Persistent banner | Draft | None | STATE-02 | src/App.tsx | Persistent global/session issue |
| `R5-STATUS` | Status indicator | Draft | None | STATE-02 | src/SessionModeRoot.tsx | Connected/ready/saved etc. |
| `R5-PROGRESS` | Progress indicator | Draft | None | STATE-01 | src/SessionActionDock.tsx, src/SessionDmTools.tsx | Real pending work only |
| `R5-FIELD-VALIDATION` | Field validation | Draft | None | STATE-01 | src/CharacterCreateV10.tsx, src/V1ContentScreen.tsx | Input-specific error |
| `R5-ROLL-RESULT` | Roll/action result feedback | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22, src/App.tsx, src/SessionModeRoot.tsx | Scene/session-integrated shared result direction reviewed |
| `R5-STANDALONE-ROLL-RESULT` | Standalone Character roll result | Draft | None | DND-01 / DND-02 | src/OfficialCharacterSheetPlayScreen.tsx | Local result panel + physical dice evidence |
| `R5-CONNECTION-RECOVERY` | Connection recovery strip/status | Draft | Partial | STATE-02 / SES-02 | UX-01-03, src/SessionPlayerSession.tsx | Reconnecting/disconnected status with recovery entry |
| `R5-HANDOUT-ERROR` | Handout client/author error | Draft | Blocked | STATE-02 / SES-01 | GAP-HANDOUT-NETWORK-CONTRACT, src/SessionImageHandoutBridge.tsx | Current inline/status error evidence |
| `R5-SESSION-COMPATIBILITY` | Session compatibility / host-join error alert | Draft | None | STATE-02 / SES-02 | src/ProductionSessionWorkspaceBridge.tsx, src/SessionDmTools.tsx | Current error/warning presentation; exact recovery semantics pending |
| `R5-ACTIVITY-EVENT` | Durable activity event | Draft | Blocked | DM-02 / SES-02 | ORIGIN-UX-01-29, GAP-DM-ONLY-DELIVERY-PROTOCOL | Visibility-sensitive |

---

# R6 — System & Edge States

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R6-INITIAL-LOAD` | Initial loading | Draft | None | STATE-02 | src/ProductRoot.tsx | App bootstrap |
| `R6-PENDING` | Local/remote operation pending | Draft | None | STATE-01 | src/SessionActionDock.tsx, src/SessionDmTools.tsx | Prevent duplicate submission as needed |
| `R6-EMPTY` | Empty state | Draft | None | STATE-01 | src/ProductionPlayScreen.tsx, src/V1ContentScreen.tsx, src/SessionUtilityPanes.tsx | Must expose next valid action when one exists |
| `R6-NO-RESULTS` | No search results | Draft | None | STATE-01 | src/SessionUtilityPanes.tsx, src/App.tsx | Query-aware |
| `R6-DISABLED` | Disabled/unavailable | Draft | Partial | STATE-01 | UX-01-05, src/SessionActionDock.tsx | Reason when material |
| `R6-RECOVERABLE-ERROR` | Recoverable error | Draft | None | STATE-02 | src/ProductionSessionWorkspaceBridge.tsx, src/CharacterPortraitBridge.tsx | Retry/recovery path |
| `R6-BLOCKING-ERROR` | Blocking error | Draft | None | STATE-02 | src/V1ContentScreen.tsx, src/CharacterCreateV10.tsx | Explicit blocker |
| `R6-SAVE-FAILURE` | Save failure | Draft | None | STATE-02 | src/App.tsx | Data preservation/retry required |
| `R6-UNSUPPORTED` | Unsupported content/mechanic | Draft | Partial | STATE-02 | docs/design/README.md, src/App.tsx | No approximation |
| `R6-DISCONNECTED` | Disconnected | Draft | Partial | STATE-02 / SES-02 | UX-01-03, src/SessionPlayerSession.tsx | Connection recovery surface exists |
| `R6-RECONNECTING` | Reconnecting | Draft | Partial | STATE-02 / SES-02 | UX-01-03, docs/design/session-runtime.md, src/SessionPlayerSession.tsx | Preserve canonical context |
| `R6-INCOMPATIBLE` | Incompatible session/content | Draft | None | STATE-02 | src/ProductionSessionWorkspaceBridge.tsx, src/SessionDmTools.tsx | Blocking/recovery behavior still downstream |
| `R6-NO-VALID-CHARACTER` | Join has no valid saved Character | Draft | Blocked | UX-02 / SES-01 | GAP-JOIN-NO-CHARACTER, src/ProductionSessionWorkspaceBridge.tsx, src/ProductionSessionDirectNetworkBridge.tsx | Current code blocks Join; product behavior remains explicitly undecided |
| `R6-PERMISSION` | Permission/authority denied | Draft | Partial | STATE-02 / SES-02 | ORIGIN-UX-01-26, ORIGIN-UX-01-29 | Do not leak unauthorized data |
| `R6-STALE` | Stale/reconciliation state | Draft | None | STATE-02 / SES-02 | docs/design/session-runtime.md | Canonical resync behavior |
| `R6-REDUCED-MOTION` | Reduced Motion | Draft | Partial | A11Y-01 / R9 | ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Result-preserving presentation |
| `R6-NARROW` | Narrow Desktop | Draft | Partial | PLATFORM-01 | UX-01-04, UX-01-07 | Core anchors/capabilities remain reachable |

---

# R7 — Components & Controls

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R7-PRIMARY-NAV` | Product Shell primary navigation | Draft | None | NAV-01 / CMP-01 | src/App.tsx | Current sidebar evidence; final navigation topology pending |
| `R7-BUTTON` | Button family | Draft | None | CMP-01 | — | Primary/secondary/destructive/quiet/icon |
| `R7-TABS` | Standard tabs | Draft | None | CMP-01 | — | Peer content navigation |
| `R7-HOTBAR-TABS` | Hotbar page tabs | Reviewed | Partial | DND-03 / CMP-01 | ORIGIN-UX-01-07 | Mixed/Action/Spell/Item + custom baseline |
| `R7-TOGGLE` | Toggle | Draft | None | CMP-01 | — | Immediate boolean state when appropriate |
| `R7-SEGMENTED` | Segmented mode control | Draft | None | CMP-01 | — | Small exclusive set |
| `R7-SEARCH` | Search input | Draft | None | CMP-01 | src/App.tsx, src/SessionUtilityPanes.tsx | Rules/content/library use as applicable |
| `R7-FILTER` | Filter controls | Draft | None | CMP-01 | src/App.tsx, src/LevelUpV10.tsx | Result-set narrowing |
| `R7-CHAR-CARD` | Character Card | Draft | None | DND-01 / CMP-01 | src/App.tsx | Library/select uses |
| `R7-ACTOR-CARD` | Actor Card | Reviewed | Partial | INT-01 / SES-01 | ORIGIN-UX-01-10, ORIGIN-UX-01-11, ORIGIN-UX-01-16, ORIGIN-UX-01-19 | Core planned scene interaction surface |
| `R7-COMMAND-CENTER` | Bottom Command Center container | Reviewed | Partial | SES-01 / DND-03 | UX-01-07, ORIGIN-UX-01-09 | Canonical planned co-primary anchor; current Session Action Dock is not equivalent by itself |
| `R7-HOTBAR-SLOT` | Capability/Hotbar slot | Reviewed | Partial | DND-03 | UX-01-04, UX-01-05, UX-01-06 | Capability execution/discoverability |
| `R7-ECONOMY` | Action-economy indicator | Reviewed | Partial | DND-03 | ORIGIN-UX-01-08 | Fixed economy grammar |
| `R7-RESOURCE-RAIL` | Dynamic Resource Rail | Reviewed | Partial | DND-03 | ORIGIN-UX-01-08 | Canonical resource projection |
| `R7-INITIATIVE-ENTRY` | Initiative tracker entry | Reviewed | Partial | DND-04 | ORIGIN-UX-01-15, src/SessionInitiativeStrip.tsx | Compact current/order info |
| `R7-SESSION-UTILITY-RAIL` | In-session utility rail | Draft | None | SES-01 / NAV-01 / CMP-01 | src/SessionModeRoot.tsx | Current implementation evidence; final topology unreviewed |
| `R7-SHEET-LAYOUT-SWITCH` | Character Sheet layout switch | Draft | None | DND-01 / CMP-01 | src/CharacterSheetPlayScreen.tsx, src/CharacterLibraryUxBridge.tsx | Current persisted local preference evidence |
| `R7-PORTRAIT` | Character portrait control | Draft | None | DND-01 / CMP-01 | src/CharacterPortraitBridge.tsx | Current image/focal-point UI evidence |
| `R7-CONNECTION-STATUS` | Session connection status indicator | Draft | Partial | SES-02 / CMP-01 | UX-01-03, src/SessionModeRoot.tsx, src/SessionPlayerSession.tsx | Connected/reconnecting/disconnected projection |
| `R7-SESSION-IDENTITY` | Session actor/character identity chip | Draft | None | SES-01 / CMP-01 | src/SessionModeRoot.tsx | Current Player/DM identity launcher evidence |
| `R7-STATUS` | Status/condition indicator | Draft | None | CMP-01 / DND-04 | — | Canonical projection only |
| `R7-FILE-INPUT` | File picker/input | Draft | None | CMP-01 | src/V1ContentScreen.tsx, src/SessionImageHandoutBridge.tsx, src/CharacterPortraitBridge.tsx | Import/presentation assets |
| `R7-ZOOM-PAN` | Zoom/pan controls | Draft | Partial | CMP-01 / SES-01 | ORIGIN-UX-01-13 | Handout local presentation; current viewer still lacks reviewed full mode contract |

---

# R8 — Content & Messaging

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R8-ONBOARDING` | First-use/onboarding copy | Draft | None | CONTENT-01 / UX-03 | src/V1HomeScreen.tsx | Current guide copy is implementation evidence |
| `R8-ACTION-LABELS` | Action button labels | Draft | None | CONTENT-01 | — | Prefer result/action wording over vague labels |
| `R8-CONFIRM-COPY` | Confirmation copy anatomy | Draft | None | CONTENT-01 / INT-03 | — | Consequence + explicit actions |
| `R8-DESTRUCTIVE-COPY` | Destructive wording | Draft | None | CONTENT-01 / INT-03 | — | Identify affected object/outcome |
| `R8-ERROR-COPY` | Error anatomy | Draft | None | CONTENT-01 / STATE-02 | src/V1ContentScreen.tsx, src/ProductionSessionWorkspaceBridge.tsx | What failed / impact / recovery |
| `R8-EMPTY-COPY` | Empty-state copy | Draft | None | CONTENT-01 / STATE-01 | src/V1ContentScreen.tsx, src/SessionUtilityPanes.tsx | Context + valid next action |
| `R8-DISABLED-REASON` | Unavailable reason | Draft | Partial | CONTENT-01 / DND-03 | ORIGIN-UX-01-18, ORIGIN-UX-01-19, src/SessionActionDock.tsx | Use canonical reason where available |
| `R8-VISIBILITY` | Public / DM Only terminology | Reviewed | Blocked | SES-02 / CONTENT-01 | ORIGIN-UX-01-26, ORIGIN-UX-01-27, GAP-DM-ROLL-VISIBILITY-PERSISTENCE | Default/persistence gap remains |
| `R8-RESULT-TERMS` | Roll/result terminology | Draft | None | CONTENT-01 / DND-02 | src/App.tsx, src/SessionModeRoot.tsx | Canonical outcome vocabulary pending content review |
| `R8-CONNECTION` | Connection-state wording | Draft | Partial | CONTENT-01 / STATE-02 | UX-01-03, src/SessionPlayerSession.tsx | Connected/reconnecting/disconnected/rejoin language |

---

# R9 — Motion & Temporal Behavior

| ID | Artifact | Planning | Contract | Owner | Refs | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `R9-DICE-THROW` | Physical dice throw/roll/settle | Reviewed | Partial | DND-02 | ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Authoritative result first; physics presentation only |
| `R9-RESULT-REVEAL` | Result reveal timing | Draft | None | DND-02 | ORIGIN-UX-01-22, src/VisualDiceBridge.tsx | Exact reveal point to review |
| `R9-RESOLUTION-AUTO-ADVANCE` | Resolution animation auto-advance timing | Draft | None | DND-02 / STATE-01 / A11Y-01 | src/App.tsx, src/SessionModeRoot.tsx | Current numeric timers are implementation evidence, not approved timing budgets |
| `R9-COMBAT-VFX` | Combat delivery/impact VFX | Draft | None | DND-02 / DND-04 / A11Y-01 | src/CombatVfxBridge.tsx | Current initiative VFX evidence; product timing/reduced-motion contract unreviewed |
| `R9-INTERRUPT-TIMING` | Reaction prompt timing/timeout | Draft | Blocked | DND-04 | GAP-RESOLUTION-SAFE-INTERACTIONS | Do not invent timeout |
| `R9-TOAST-LIFETIME` | Toast duration/auto-dismiss | Draft | None | STATE-01 | — | Numeric timing not yet approved |
| `R9-OVERLAY-ENTER-EXIT` | Overlay transitions | Draft | None | INT-02 | src/SessionModeRoot.tsx | Must preserve focus/interaction semantics |
| `R9-REDUCED-MOTION` | Reduced-motion equivalents | Draft | Partial | A11Y-01 | ORIGIN-UX-01-25, src/VisualDiceBridge.tsx | Preserve information/order/result |

---

# Current implementation evidence — not product authority

The following observations are recorded only to prevent current code from being mistaken for planning truth during later work.

- Connected sessions currently route from `ProductRoot` directly to `SessionModeRoot`, bypassing the common Product Shell. This differs from `UX-01-02` / `UX-01-03` planning intent and is implementation drift, not a new decision. (`src/ProductRoot.tsx`)
- Current Home exposes one combined `Host / Join` Session entry rather than distinct direct Host and direct Join actions. `ORIGIN-FLOW-01` remains the canonical planning direction. (`src/V1HomeScreen.tsx`)
- Current connected Freeform/Initiative focus does not render the reviewed upper opposing + lower allied Actor Board topology. `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11`, and `ORIGIN-UX-01-14` remain canonical planning intent. (`src/SessionMainFocus.tsx`, `src/SessionModeRoot.tsx`)
- Current connected `SessionActionDock` is an intent-first funnel that hides the full capability set behind intent/all-action expansion. It must not override `UX-01-04`, `UX-01-06`, `ORIGIN-UX-01-07`, `ORIGIN-UX-01-08`, and `ORIGIN-UX-01-09`. (`src/SessionActionDock.tsx`)
- Current Player handout implementation is a dismissible modal viewer. It does not satisfy the reviewed Overlay / Upper Scene / Full Scene mode model by itself; `GAP-HANDOUT-NETWORK-CONTRACT` remains blocking. (`src/SessionImageHandoutBridge.tsx`)
- Current Join UI blocks when no saved Character exists. That behavior remains evidence only because `GAP-JOIN-NO-CHARACTER` is still Open. (`src/ProductionSessionWorkspaceBridge.tsx`, `src/ProductionSessionDirectNetworkBridge.tsx`)
- Current Product-shell and connected-session Activity surfaces are real user-facing artifacts, but private-event presentation remains governed by `DM-02-01` / `GAP-DM-PRIVATE-ACTIVITY-PRESENTATION`. (`src/App.tsx`, `src/SessionUtilityPanes.tsx`)
- `ConcentrationSaveBridge` currently inserts a concentration-save d20 input/result surface into the resolution drawer. That existence does not decide its final interaction/role model. (`src/ConcentrationSaveBridge.tsx`)
- The live Host Session workspace currently exposes an advanced spatial relation editor for Actor-pair distance, visibility, and cover. Its existence does not productize that tool or decide its final authority/placement. (`src/ProductionSessionWorkspaceBridge.tsx`)
- `CombatSpellHudBridge` is imported by `main.tsx` but is not rendered into the active root; it is excluded from active user-facing inventory until an actual entry path exists. (`src/main.tsx`)
- Despite its filename, `LegacyCharacterSheetPlayScreen.tsx` is currently the active SimpleVTT sheet-layout implementation selected by `CharacterSheetWorkspace`; filename heuristics must not classify it as inactive. (`src/CharacterSheetPlayScreen.tsx`)
- Developer `DebugPanel` remains excluded from product UI coverage unless explicitly promoted later. (`src/App.tsx`)

---

# Inventory completion check

The Route D inventory cross-check has now covered:

- every active route/surface reachable from the current Product/Session entry graph;
- every user-facing globally mounted bridge/portal in `main.tsx`;
- the derived `master-flow.md` topology and all Reviewed Decision Cards;
- generic INT/STATE/CMP/A11Y/PLATFORM non-route patterns represented by R4-R9;
- every active Planning Gap with UI/UX impact;
- user-facing confirmation, notification, validation, permission, reconnect, handout, reaction, import, motion, Activity, concentration-save, and spatial-relation evidence discovered in the active runtime graph.

Inactive imports, developer-only UI, and historical filenames are classified explicitly rather than treated as product truth.

**Route D R1-R9 inventory cross-check: PASS for the current active runtime/planning snapshot.** Future code or planning changes may require a bounded delta audit; they do not keep the current Global Planning Gate blocked.

New rows may be added without owner approval when they only identify an existing/planned artifact. **Adding a row does not decide its product behavior.** Any new material behavior still requires a Decision Card or a declared Draft Decision Map item.

`Contract Readiness` is derived maintenance. AI may downgrade or upgrade `None / Partial / Blocked / Ready` when referenced contracts/gaps change, but MUST NOT change Planning Maturity without the decision lifecycle defined in the framework.