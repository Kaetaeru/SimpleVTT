# SimpleVTT UI/UX Review Coverage Plan

Status: active review-order control

This file controls **which governance sheet is being reviewed, which Decision Maps are already declared, and which sheets must not start yet**.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Templates: [`templates.md`](templates.md)

## Review-order rule

- Do not ask a sheet's first question until that sheet's complete Decision Map is shown/materialized.
- A Decision Map is `Complete` only when it satisfies T2: Scope, Non-scope, Exit Criteria, and a full table containing ID, Question, Status, Depends On, Conditional, and Destination.
- `Review Status` is a sheet-review progress enum only: `Not Started`, `In Review`, or `Reviewed`.
- Seed decisions, inventory, gaps, or matrices belong in `Notes`; they are not Review Status values.
- `Review Status: Reviewed` does not imply that every Decision Card in that area is Frozen or implementation-ready.
- Rows with existing `Status: Reviewed` are preserved seed decisions and MUST NOT be asked again unless the owner explicitly reopens them.
- Do not skip an unfinished earlier dependency merely because a later UI area looks interesting.
- Existing migrated decisions may seed a later Decision Map, but they do not authorize inventing the rest of that map mid-review.
- New discoveries go to Planning Gaps or a downstream sheet before becoming owner questions.
- AI MAY propose a review-order change when dependency analysis shows a better order.
- AI MUST NOT change the declared review order without owner approval. Record the approved reason when the order changes.
- All reference fields use full stable IDs; do not use ranges or omitted prefixes.

## Current sequence

| Order | Sheet | Purpose | Map status | Review Status | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `UX-01` Product Principles | top-level product experience principles | **Complete** | **Reviewed** | 7 Decision Cards are Reviewed; none Frozen |
| 2 | `UX-02` User & Role Model | users, roles, ownership/control, information entitlement | **Complete** | Not Started | first individual review sheet only after Global Planning Gate passes |
| 3 | `UX-03` Information Hierarchy | global/contextual information priority and duplication | **Complete** | Not Started | blocked by Global Planning Gate |
| 4 | `NAV-01` Navigation | product destinations, contextual return, hierarchy | **Complete** | Not Started | contains Reviewed direct Session-entry seed |
| 5 | `UI-01` Layout & Grid | global layout primitives | **Complete** | Not Started | Dual Anchor / Actor Board dependencies declared |
| 6 | `INT-01` Interaction | click/right-click/selection/target/context interaction | **Complete** | Not Started | contains Reviewed Actor interaction seed |
| 7 | `STATE-01` UI States | local component/task states | **Complete** | Not Started | R5/R6/M6 coverage declared |
| 8 | `STATE-02` System States | loading/error/reconnect/permission/system state | **Complete** | Not Started | R6/system recovery coverage declared |
| 9 | `INT-02` Layering | modal/nonmodal overlay rules | **Complete** | Not Started | R4/layer stack coverage declared |
| 10 | `INT-03` Confirmation | destructive/confirmation/cancel grammar | **Complete** | Not Started | includes no-extra-confirm reviewed targeting dependency |
| 11 | `UI-02` Typography | type system | **Complete** | Not Started | typography hierarchy/density coverage declared |
| 12 | `UI-03` Color & Semantic Color | semantic color system | **Complete** | Not Started | state/target/visibility/contrast coverage declared |
| 13 | `UI-04` Iconography | icon language | **Complete** | Not Started | action/status/navigation icon coverage declared |
| 14 | `UI-05` Density & Spacing | density/spacing tokens | **Complete** | Not Started | product/play/sheet density coverage declared |
| 15 | `CMP-01` Core Components | reusable component contracts | **Complete** | Not Started | R7/component families declared |
| 16 | `CONTENT-01` UX Writing | labels, error, confirmation, terminology | **Complete** | Not Started | R8 terminology/copy coverage declared |
| 17 | `A11Y-01` Accessibility | keyboard/focus/semantics/reduced motion | **Complete** | Not Started | M4/R9 coverage declared |
| 18 | `PLATFORM-01` Desktop Responsive | wide/normal/narrow behavior | **Complete** | Not Started | M5 responsive coverage declared |
| 19 | `DND-01` Character Presentation | Character Library/Builder/Sheet/Level Up | **Complete** | Not Started | current multi-layout/portrait/import evidence covered |
| 20 | `DND-02` Roll & Dice UX | dice, result, resolution presentation | **Complete** | Not Started | contains five Reviewed roll/dice seeds |
| 21 | `DND-03` Action UX | capability/hotbar/economy/targeting/execution | **Complete** | Not Started | contains Reviewed Hotbar/targeting/action seeds |
| 22 | `DND-04` Combat UX | initiative/turn/interrupt combat presentation | **Complete** | Not Started | contains two Reviewed Initiative seeds |
| 23 | `SES-01` Session UX | session lifecycle and Play workspace | **Complete** | Not Started | contains Reviewed Join/Command Center/Actor Board/Handout seeds |
| 24 | `SES-02` Multiplayer Authority UX | role-scoped delivery/visibility/reconnect authority | **Complete** | Not Started | contains Reviewed DM-only delivery seeds + Critical gap |
| 25 | `DM-01` DM Controls | persistent DM controls and management surfaces | **Complete** | Not Started | contains Reviewed visibility-toggle seed |
| 26 | `DM-02` Adjudication & Undo | disclosure, activity, correction, undo | **Complete** | Not Started | contains Reviewed disclosure seed + deferred Activity gap |
| 27 | `CONTENT-02` Rules & Add-on UX | Rules browser, import, validation, add-on management | **Complete** | Not Started | Rules/Content/import coverage declared |

---

# UX-01 — Product Principles

## Scope

Define the top-level experience principles that constrain all later UI/UX planning: product posture, Shell/Play relationship, Play continuity, core capability exposure, context adaptation, discoverability/customization, and Play visual priority.

## Non-scope

Do not define exact navigation topology, role permissions, pixel layout, component styling, individual Hotbar contents, detailed targeting rules, session wire formats, or DM authority implementation here.

## Exit Criteria

- Standalone Character and Connected VTT product posture is defined.
- Product Shell and dedicated Play relationship is defined.
- Leaving/returning to Play continuity principle is defined.
- Core capability visibility and contextual adaptation principles are defined.
- Discoverability/customization relationship is defined.
- Play Workspace co-primary visual anchors are defined.
- No additional question is appended to UX-01 without explicitly reopening/updating this complete map.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-01-01` | What is SimpleVTT's product posture between standalone Character use and connected VTT play? | Reviewed | none | no | `UX-01`, `DND-01`, `SES-01` |
| `UX-01-02` | How do the common Product Shell and dedicated Play Workspace relate? | Reviewed | `UX-01-01` | no | `UX-01`, `NAV-01`, `SES-01` |
| `UX-01-03` | What authoritative/session/game state must survive leaving and returning to Play? | Reviewed | `UX-01-02` | no | `UX-01`, `NAV-01`, `SES-01`, `SES-02` |
| `UX-01-04` | How directly must core capabilities be exposed? | Reviewed | none | no | `UX-01`, `DND-03`, `CMP-01` |
| `UX-01-05` | How should a stable capability skeleton adapt to canonical context? | Reviewed | `UX-01-04` | no | `UX-01`, `DND-03`, `STATE-01` |
| `UX-01-06` | How should automatic capability discovery coexist with user Hotbar customization? | Reviewed | `UX-01-04`, `UX-01-05` | no | `UX-01`, `DND-03` |
| `UX-01-07` | What are the co-primary visual anchors of Play? | Reviewed | `UX-01-02`, `UX-01-04` | no | `UX-01`, `SES-01`, `DND-03`, `DND-04` |

---

# UX-02 — User & Role Model

## Scope

Define the product-level user/role model used by standalone and connected experiences: role axes, Character ownership vs Actor control, number/control scope, role switching, UI divergence, unauthorized information, and v1 extra-role scope.

## Non-scope

Do not define secret-event wire format, exact payload redaction, exact DM menu layout, role-specific component styling, or implementation schema here.

## Exit Criteria

- Role axes are defined.
- Offline role treatment is defined.
- Character ownership and Actor control are distinguishable.
- Player/DM control scope is defined at product level.
- Role switching policy is defined.
- UI divergence and unauthorized-information principles are defined.
- v1 extra-role scope is decided.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-02-01` | Separate Play Role and Connection Role, or one role axis? | Draft | none | no | `UX-02`, `SES-02` |
| `UX-02-02` | Does Offline/Standalone have a DM/Player identity? | Draft | `UX-02-01` | no | `UX-02` |
| `UX-02-03` | How does Character ownership relate to actual Actor control? | Draft | `UX-02-01` | no | `UX-02`, `SES-01`, `SES-02` |
| `UX-02-04` | How many Actors may a Player control? | Draft | `UX-02-03` | no | `UX-02`, `SES-01` |
| `UX-02-05` | What is the DM Actor-control authority model? | Draft | `UX-02-03` | no | `UX-02`, `DM-01` |
| `UX-02-06` | Allow live DM <-> Player role switching? | Draft | `UX-02-01` | no | `UX-02`, `SES-02` |
| `UX-02-07` | What is the allowed limit of role-specific UI structural divergence? | Draft | `UX-02-01` | no | `UX-02`, `NAV-01` |
| `UX-02-08` | What is the default principle for information a role is not authorized to know? | Draft | `UX-02-03` | no | `UX-02`, `SES-02` |
| `UX-02-09` | Include Spectator / Co-DM / Observer in v1? | Draft | `UX-02-01` | no | `UX-02` |
| `UX-02-09A` | Define extra-role permission boundaries. | Draft | `UX-02-09` | yes; only if extra roles included | `UX-02`, `SES-02` |

---

# UX-03 — Information Hierarchy

## Scope

Define which information/destinations are global vs contextual, how Product Shell and live Play relate, what UI remains persistent vs contextual, the high-level priority of Play/Character information, progressive disclosure, duplicate-information policy, and transient result/notification/Activity priority.

## Non-scope

Do not set exact pixel layout, Actor Board height, Initiative Tracker geometry, Result Strip size, typography values, exact component styling, or network disclosure implementation.

## Exit Criteria

- Global vs contextual destination boundary is defined.
- Product Shell <-> live Play continuity principle is defined.
- Persistent vs contextual UI principle is defined.
- Play Workspace and standalone Character Sheet information priorities are defined.
- Progressive disclosure and duplication principles are defined.
- Transient result/notification/Activity priority is defined.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-03-01` | What is the boundary between Global and Contextual destinations? | Draft | `UX-01-02` | no | `NAV-01` |
| `UX-03-02` | How should Product Shell <-> Live Play continuity behave at the hierarchy level? | Draft | `UX-01-03` | no | `NAV-01`, `SES-01` |
| `UX-03-03` | What is the principle for Permanent UI vs Contextual UI? | Draft | `UX-01-04`, `UX-01-05` | no | `INT-02` |
| `UX-03-04` | What information has priority inside Play Workspace? | Draft | `UX-01-07` | no | `SES-01`, `DND-04` |
| `UX-03-05` | What information has priority on standalone Character Sheet? | Draft | `UX-01-01` | no | `DND-01` |
| `UX-03-06` | What scope of progressive disclosure is allowed? | Draft | `UX-01-04` | no | `UI-05`, `CONTENT-01` |
| `UX-03-07` | What is the principle for duplicated information? | Draft | none | no | `CMP-01` |
| `UX-03-08` | What is the priority of transient result/notification/Activity information? | Draft | none | no | `STATE-01`, `STATE-02`, `DND-02`, `DM-02` |

---

# NAV-01 — Navigation

## Scope

Define the stable product destinations, Home entry choices, Product Shell navigation, Return-to-Play continuity, Character/Session/Rules/Content/Settings hierarchy, contextual-tool boundaries, and first-use navigation placement.

## Non-scope

Do not define exact sidebar width, icon artwork, keyboard focus behavior, network role permissions, or Play internal layout.

## Exit Criteria

- Top-level destinations and Home actions are known.
- Direct Host/Join and Return-to-Play navigation are represented without making Character a universal Session prerequisite.
- Character/Rules/Content/Settings entry/return hierarchy is defined.
- Contextual tools are not accidentally promoted to top-level destinations.
- First-use/onboarding entry/reopen placement is defined.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-FLOW-01` | Should Home expose direct first-class Host and Join entry while keeping Character non-mandatory for Session entry? | Reviewed | `UX-01-01` | no | `NAV-01`, `SES-01` |
| `NAV-01-01` | What is the final top-level Product Shell destination set and order? | Draft | `UX-01-01`, `UX-01-02`, `UX-03-01` | no | `NAV-01`, `R1-HOME` |
| `NAV-01-02` | Where and when does Return to Play appear while a live session exists? | Draft | `UX-01-03`, `UX-03-02` | no | `NAV-01`, `SES-01` |
| `NAV-01-03` | How do Character Library, Character Sheet, Builder, Edit, and Level Up enter/return within Product Shell? | Draft | `UX-03-05` | no | `NAV-01`, `DND-01` |
| `NAV-01-04` | How do Rules, Content, and Settings preserve/restore prior Product Shell context? | Draft | `UX-03-01`, `UX-03-02` | no | `NAV-01`, `CONTENT-02` |
| `NAV-01-05` | Which Activity, Encounter, Adjudication, Session utility, and similar tools remain contextual rather than top-level? | Draft | `UX-03-01`, `UX-03-03` | no | `NAV-01`, `SES-01`, `DM-01`, `DM-02` |
| `NAV-01-06` | What Back/Close/Return grammar applies when moving between Product Shell and contextual/full-workspace layers? | Draft | `UX-03-02`, `UX-03-03` | no | `NAV-01`, `INT-02` |
| `NAV-01-07` | Where does first-use guidance live and how can it be reopened after dismissal? | Draft | `UX-03-06` | no | `NAV-01`, `R2-FIRST-USE`, `CONTENT-01` |
| `NAV-01-08` | Which restored/deep-linked state may reopen directly after app restart, and which returns through Home? | Draft | `UX-01-03` | no | `NAV-01`, `STATE-02` |

---

# UI-01 — Layout & Grid

## Scope

Define product-wide layout regions and grid relationships for Product Shell, Home/content pages, Character surfaces, Play Dual Anchor, Actor Boards, Command Center, utilities, and overlay/full-workspace layers.

## Non-scope

Do not choose exact pixel dimensions, spacing token values, typography sizes, colors, or narrow-desktop breakpoints here.

## Exit Criteria

- Product Shell/content-page grid grammar is defined.
- Play regions preserve Scene/Actor Context and Command Center as co-primary anchors.
- Actor Board, Initiative Tracker, utility, and result-layer regions have explicit relationships.
- Character Sheet/Builder major layout model is defined at region level.
- Scrolling/sticky boundaries are clear enough for downstream responsive/component work.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-01-01` | What global region grammar does Product Shell use for primary navigation and content? | Draft | `NAV-01-01` | no | `UI-01`, `R7-PRIMARY-NAV` |
| `UI-01-02` | What region model realizes the Play Dual Anchor without one anchor visually dominating the other? | Draft | `UX-01-07` | no | `UI-01`, `SES-01`, `R1-PLAY` |
| `UI-01-03` | How are upper opposing and lower allied Actor Boards allocated around Scene/Table Context in Freeform? | Draft | `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11` | no | `UI-01`, `SES-01` |
| `UI-01-04` | How does the top Initiative Tracker fit without replacing Actor Boards or Command Center? | Draft | `ORIGIN-UX-01-14`, `ORIGIN-UX-01-15` | no | `UI-01`, `DND-04` |
| `UI-01-05` | What is the major internal region model of the bottom Command Center? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-09` | no | `UI-01`, `DND-03`, `R7-COMMAND-CENTER` |
| `UI-01-06` | Where may contextual Session/DM utilities occupy space without displacing core Play anchors? | Draft | `UX-03-03`, `NAV-01-05` | no | `UI-01`, `SES-01`, `DM-01` |
| `UI-01-07` | What region model does standalone Character Sheet use for high-priority vs secondary information? | Draft | `UX-03-05` | no | `UI-01`, `DND-01` |
| `UI-01-08` | What region model does Character Builder/Level Up use for steps, primary work, preview, and footer actions? | Draft | `DND-01-02` | no | `UI-01`, `DND-01` |
| `UI-01-09` | Which regions own scrolling/sticky behavior on normal desktop before responsive reflow is applied? | Draft | `UI-01-01`, `UI-01-02`, `UI-01-07` | no | `UI-01`, `PLATFORM-01` |

---

# INT-01 — Interaction

## Scope

Define primary pointer/keyboard interaction grammar: Actor selection/targeting/context actions, selection ownership, Escape/back cancellation, unavailable-reason access, menu vs direct action, and interaction priority when multiple contexts overlap.

## Non-scope

Do not define exact context-menu commands before their declared question, rules legality, network authority, animation timing, or final visual styling.

## Exit Criteria

- Actor primary/right-click interaction grammar is established.
- Selection vs targeting vs DM actor selection conflicts are resolved.
- Context-menu scope and keyboard equivalent are defined.
- Escape/back/cancel hierarchy is defined.
- Essential unavailable reasons are accessible without hover-only dependence.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-16` | What is the Actor Card left-click/right-click interaction family? | Reviewed | `UX-01-05` | no | `INT-01`, `DND-03` |
| `INT-01-01` | When Actor selection, selected-action targeting, and DM actor control overlap, which interaction context has priority? | Draft | `ORIGIN-UX-01-16`, `UX-02-03`, `UX-02-05` | no | `INT-01`, `DND-03`, `DM-01` |
| `INT-01-02` | What command categories belong in Actor Context Menu without duplicating common Hotbar actions? | Draft | `ORIGIN-UX-01-16` | no | `INT-01`, `R4-ACTOR-CONTEXT` |
| `INT-01-03` | What keyboard interaction is equivalent to right-click/context-menu access on Actor Cards? | Draft | `INT-01-02` | no | `INT-01`, `A11Y-01` |
| `INT-01-04` | What is the global Escape/Back priority across targeting, expanded capability UI, contextual pane, modal, full sheet, and Play? | Draft | `UX-03-03` | no | `INT-01`, `INT-02`, `A11Y-01` |
| `INT-01-05` | Which common actions are direct controls vs secondary/contextual commands? | Draft | `UX-01-04`, `UX-03-06` | no | `INT-01`, `CMP-01` |
| `INT-01-06` | How are unavailable/invalid reasons exposed for pointer, keyboard, and focus users? | Draft | `UX-01-05`, `ORIGIN-UX-01-19` | no | `INT-01`, `CONTENT-01`, `A11Y-01` |
| `INT-01-07` | What selection visual/state model distinguishes controlled Actor, current turn, targetable, selected target, and contextual focus? | Draft | `UX-02-03`, `ORIGIN-UX-01-19` | no | `INT-01`, `UI-03`, `CMP-01` |

---

# STATE-01 — UI States

## Scope

Define reusable local UI/component/task states such as default, hover, focus, selected, disabled, pending, empty, no-results, validation, success/warning/error, stale local selection, and action-flow feedback.

## Non-scope

Do not define application/network lifecycle states, authority semantics, rules legality, or exact visual tokens.

## Exit Criteria

- Common interactive-state vocabulary is defined.
- Disabled vs unavailable vs pending vs selected meanings are distinct.
- Empty/no-results/validation patterns are defined.
- Stale local selection recovery is defined.
- Feedback placement/escalation principles are defined.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `STATE-01-01` | What reusable interactive-state vocabulary must all controls support where applicable? | Draft | none | no | `STATE-01`, `CMP-01` |
| `STATE-01-02` | How do Disabled, Unavailable, Pending, Selected, and Current differ semantically? | Draft | `UX-01-05` | no | `STATE-01`, `CONTENT-01` |
| `STATE-01-03` | When must a disabled/unavailable state expose an explicit reason? | Draft | `INT-01-06` | no | `STATE-01`, `R8-DISABLED-REASON` |
| `STATE-01-04` | What is the default pattern for empty state vs no search results? | Draft | none | no | `STATE-01`, `R6-EMPTY`, `R6-NO-RESULTS` |
| `STATE-01-05` | What validation severity/presentation states exist for forms/import/builders? | Draft | none | no | `STATE-01`, `R5-FIELD-VALIDATION`, `R4-IMPORT-REVIEW` |
| `STATE-01-06` | How should local selection recover when canonical state invalidates the selected action/target/item? | Draft | `UX-01-05` | no | `STATE-01`, `DND-03` |
| `STATE-01-07` | When should feedback use inline message, toast, persistent banner, or durable Activity entry? | Draft | `UX-03-08` | no | `STATE-01`, `STATE-02`, `CONTENT-01` |
| `STATE-01-08` | How are pending operations protected against duplicate submission while keeping unrelated controls usable? | Draft | `ORIGIN-UX-01-21` | no | `STATE-01`, `DND-03` |

---

# STATE-02 — System States

## Scope

Define app/session/system states and recovery presentation: bootstrap, save failure, unsupported content, disconnected/reconnecting, incompatible session, permission denied, stale/reconciliation, persistence failure, recoverable vs blocking error, and unrecoverable recovery.

## Non-scope

Do not define network protocol/schema, domain error calculations, or exact copy wording.

## Exit Criteria

- System-state taxonomy and severity are defined.
- Reconnect/disconnect/incompatibility/permission states have recovery principles.
- Save/persistence/unsupported failures preserve user data/context appropriately.
- Blocking vs recoverable states are distinguishable.
- Global vs local placement rules are clear.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `STATE-02-01` | What does the user see during app bootstrap/restore before product state is ready? | Draft | `UX-01-03` | no | `STATE-02`, `R6-INITIAL-LOAD` |
| `STATE-02-02` | What is the required recovery contract when durable Character/content saving fails? | Draft | `UX-01-03` | no | `STATE-02`, `R6-SAVE-FAILURE` |
| `STATE-02-03` | How is unsupported content/mechanic distinguished from a generic error? | Draft | none | no | `STATE-02`, `R6-UNSUPPORTED`, `CONTENT-02` |
| `STATE-02-04` | How do reconnecting, disconnected, and unrecoverable connection states differ in presentation/action? | Draft | `UX-01-03` | no | `STATE-02`, `SES-02`, `R5-CONNECTION-RECOVERY` |
| `STATE-02-05` | How is session/content incompatibility presented and what recovery actions are allowed? | Draft | none | no | `STATE-02`, `SES-02`, `R6-INCOMPATIBLE` |
| `STATE-02-06` | How is permission/authority denial shown without leaking unauthorized information? | Draft | `UX-02-08`, `ORIGIN-UX-01-29` | no | `STATE-02`, `SES-02`, `R6-PERMISSION` |
| `STATE-02-07` | How is stale/reconciliation state surfaced while canonical state is being restored? | Draft | `UX-01-03` | no | `STATE-02`, `SES-02`, `R6-STALE` |
| `STATE-02-08` | What distinguishes a recoverable local error, blocking task error, and global/system blocker? | Draft | `STATE-01-07` | no | `STATE-02`, `CONTENT-01` |
| `STATE-02-09` | How should content-catalog/session presentation persistence degradation be surfaced if durable storage is unavailable? | Draft | `STATE-02-02` | no | `STATE-02`, `CONTENT-02` |

---

# INT-02 — Layering

## Scope

Define the layer taxonomy and stack behavior for inline expansion, popover, contextual pane/drawer, modal dialog, full-workspace layer, resolution/interrupt, handout presentation, and session utilities.

## Non-scope

Do not decide each tool's product topology, exact z-index numbers, animation values, or authority semantics.

## Exit Criteria

- Layer categories and modality rules are explicit.
- Stack/priority conflicts have a deterministic policy.
- Dismissibility/backdrop/Escape/focus-return principles are known.
- Full Sheet/Session utility layers preserve canonical Play state.
- Handout/resolution/interrupt relationships are routed to their owning decisions without guesswork.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `INT-02-01` | What layer categories does SimpleVTT support and what makes each category distinct? | Draft | `UX-03-03` | no | `INT-02`, `R4-DRAWER`, `R4-POPOVER` |
| `INT-02-02` | Which layer categories are modal vs nonmodal? | Draft | `INT-02-01` | no | `INT-02`, `A11Y-01` |
| `INT-02-03` | What stack priority applies when utility, full sheet, handout, resolution, interrupt, and destructive confirmation compete? | Draft | `INT-02-01` | no | `INT-02`, `SES-01`, `DND-02` |
| `INT-02-04` | What default rules govern outside-click, Escape, explicit close, and focus return for each layer category? | Draft | `INT-02-01`, `INT-01-04` | no | `INT-02`, `A11Y-01` |
| `INT-02-05` | May multiple contextual Session/DM panes remain open simultaneously, or is one utility active at a time? | Draft | `NAV-01-05` | no | `INT-02`, `SES-01`, `DM-01` |
| `INT-02-06` | How does Full Character Sheet layer coexist with ongoing Play/session state and other utilities? | Draft | `UX-01-03`, `UX-03-02` | no | `INT-02`, `R4-FULL-SHEET-LAYER` |
| `INT-02-07` | Which parts of Handout Overlay/Upper/Full use general layer rules vs SES-specific presentation rules? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `INT-02`, `SES-01` |
| `INT-02-08` | How does the resolution/result layer suppress or coexist with unrelated interaction layers? | Draft | `ORIGIN-UX-01-21` | no | `INT-02`, `DND-02`, `DND-03` |

---

# INT-03 — Confirmation

## Scope

Define when explicit confirmation is required, when it is prohibited as unnecessary friction, destructive/unsaved/cancel grammar, and confirmation behavior for session leave/end, Character changes, import/install, adjudication/Undo, and targeting.

## Non-scope

Do not define exact copy, domain legality, or final dialog styling.

## Exit Criteria

- Confirmation is reserved for meaningful decisions/irreversibility.
- Known no-confirm action paths stay no-confirm.
- Session/Character/destructive flows have explicit confirmation policy.
- Unsaved changes and cancel/retry behavior are defined.
- DM correction/Undo confirmation policy is routed clearly.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `INT-03-01` | What principle determines whether an action requires explicit confirmation? | Draft | none | no | `INT-03`, `R4-CONFIRM` |
| `ORIGIN-UX-01-20` | Does a valid selected single-target click execute without an extra confirmation while multi-target uses explicit Execute? | Reviewed | `ORIGIN-UX-01-19` | no | `DND-03`, `INT-03` |
| `INT-03-02` | Which Character create/edit/level-up exits require unsaved-change confirmation? | Draft | `INT-03-01` | no | `INT-03`, `DND-01`, `R4-UNSAVED` |
| `INT-03-03` | What confirmation/consequence model applies when a Player leaves a live session? | Draft | `INT-03-01`, `UX-01-03` | no | `INT-03`, `SES-01` |
| `INT-03-04` | What confirmation/consequence model applies when a Host ends a session? | Draft | `INT-03-01` | no | `INT-03`, `SES-01`, `R4-DESTRUCTIVE` |
| `INT-03-05` | Which import/install/remove actions require preview only vs explicit confirmation? | Draft | `INT-03-01` | no | `INT-03`, `CONTENT-02` |
| `INT-03-06` | Which DM adjudication/Undo operations require confirmation before authoritative mutation? | Draft | `INT-03-01` | no | `INT-03`, `DM-02` |
| `INT-03-07` | How do Cancel, Back, Retry, and Close differ for pending or failed operations? | Draft | `STATE-01-08`, `STATE-02-08` | no | `INT-03`, `CONTENT-01` |
| `INT-03-08` | Does manual movement-reaction declaration require a final confirmation beyond its explicit Submit action? | Draft | `INT-03-01`, `R4-MOVEMENT-REACTION-INPUT` | no | `INT-03`, `DND-04` |

---

# UI-02 — Typography

## Scope

Define typography hierarchy for product pages, Play HUD, Character sheets, forms, dense stat/numeric data, labels, source metadata, bilingual names, and critical feedback.

## Non-scope

Do not choose color, spacing, icons, or final copy wording.

## Exit Criteria

- Heading/body/label/meta/stat hierarchy is defined.
- Play density remains readable.
- Numeric/stat and formula presentation is consistent.
- Korean/English/source-name handling is defined.
- Truncation/wrapping/scaling principles are defined.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-02-01` | What product-wide type hierarchy is used for page title, section title, body, label, meta, and caption? | Draft | none | no | `UI-02` |
| `UI-02-02` | What typography hierarchy is used for dense Play HUD/Command Center information? | Draft | `UX-03-04` | no | `UI-02`, `DND-03` |
| `UI-02-03` | How are stats, dice notation, modifiers, DC/AC, HP, resources, and initiative numbers distinguished typographically? | Draft | none | no | `UI-02`, `DND-02`, `DND-03` |
| `UI-02-04` | How should Korean primary labels, English names, and source/provenance metadata coexist? | Draft | none | no | `UI-02`, `CONTENT-01` |
| `UI-02-05` | What wrapping/truncation rule applies to long Character, Actor, spell, item, status, and source names? | Draft | none | no | `UI-02`, `CMP-01` |
| `UI-02-06` | Which text may become visually compact on narrow desktop without losing essential meaning? | Draft | `PLATFORM-01-01` | no | `UI-02`, `PLATFORM-01` |
| `UI-02-07` | Which critical error/visibility/result text requires stronger emphasis than ordinary metadata? | Draft | `STATE-01-07` | no | `UI-02`, `CONTENT-01` |

---

# UI-03 — Color & Semantic Color

## Scope

Define appearance modes and semantic color use for accent, focus, selection, success/warning/error/info, Actor side, target eligibility, status, economy/resources, visibility/privacy, and dice/results.

## Non-scope

Do not define icon shape, typography, exact component layout, or rules meaning based on color alone.

## Exit Criteria

- Light/dark/accent relationship is defined.
- Semantic state colors have one meaning each.
- Focus/selection/target/current-turn states remain distinguishable.
- DM-only/privacy and side/target colors do not rely on color alone.
- Contrast requirements are routed to accessibility.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-03-01` | What appearance modes and accent-color customization are product-supported? | Draft | none | no | `UI-03`, `R1-SETTINGS` |
| `UI-03-02` | What are the canonical semantic meanings of success, warning, error, info, disabled, and pending colors? | Draft | `STATE-01-01` | no | `UI-03`, `STATE-01` |
| `UI-03-03` | How are focus, selection, current-turn, controlled Actor, targetable, and selected-target states visually distinct? | Draft | `INT-01-07` | no | `UI-03`, `A11Y-01` |
| `UI-03-04` | How are ally/neutral/hostile relationships represented without making color the only carrier? | Draft | `UX-03-04` | no | `UI-03`, `DND-04` |
| `UI-03-05` | How are Action/Bonus/Reaction/Movement and dynamic resources semantically colored? | Draft | `ORIGIN-UX-01-08` | no | `UI-03`, `DND-03` |
| `UI-03-06` | How is Public vs DM Only visibility indicated continuously and unambiguously? | Draft | `ORIGIN-UX-01-27` | no | `UI-03`, `DM-01` |
| `UI-03-07` | How do roll/result colors communicate critical success/failure/outcome without inventing rules meaning? | Draft | `DND-02-06` | no | `UI-03`, `DND-02` |
| `UI-03-08` | What minimum contrast/forced-color principles constrain semantic colors? | Draft | none | no | `UI-03`, `A11Y-01` |

---

# UI-04 — Iconography

## Scope

Define icon style, icon+label rules, action/economy/resource/status/navigation/visibility icon families, unknown/fallback icons, and use across dense Play UI.

## Non-scope

Do not define color, spacing, exact artwork assets, or product behavior.

## Exit Criteria

- One icon language is defined.
- Essential meaning is not icon-only without an accessible/visible equivalent where needed.
- Action/economy/status/navigation/visibility families are defined.
- Unknown/custom content has safe fallback behavior.
- Dense Hotbar/Actor/Initiative use is consistent.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-04-01` | What visual style and stroke/fill language defines SimpleVTT icons? | Draft | none | no | `UI-04` |
| `UI-04-02` | When may a control be icon-only vs icon+label/text? | Draft | none | no | `UI-04`, `CMP-01`, `A11Y-01` |
| `UI-04-03` | What icon family represents Action/Bonus/Reaction/Movement and resources? | Draft | `ORIGIN-UX-01-08` | no | `UI-04`, `DND-03` |
| `UI-04-04` | What icon family represents conditions/statuses and current-turn/initiative state? | Draft | `ORIGIN-UX-01-15` | no | `UI-04`, `DND-04` |
| `UI-04-05` | What icon family represents Product Shell and Session/DM utilities? | Draft | `NAV-01-01`, `NAV-01-05` | no | `UI-04`, `NAV-01` |
| `UI-04-06` | How is Public vs DM Only represented iconographically with redundant text/state? | Draft | `ORIGIN-UX-01-27` | no | `UI-04`, `DM-01` |
| `UI-04-07` | What fallback is used when custom/add-on actions or content have no mapped icon? | Draft | `CONTENT-02-01` | no | `UI-04`, `CONTENT-02` |
| `UI-04-08` | How are tooltips/accessible names supplied for compact icons? | Draft | `UI-04-02` | no | `UI-04`, `A11Y-01` |

---

# UI-05 — Density & Spacing

## Scope

Define density and spacing principles/tokens for Product Shell, Play HUD/Command Center, Actor Cards, Character surfaces, forms/lists, utilities, and narrow-desktop reflow.

## Non-scope

Do not define exact layout topology, typography hierarchy, or breakpoint values.

## Exit Criteria

- Product/content vs live-Play density relationship is defined.
- Command Center/Actor/Initiative density keeps required information reachable.
- Character/create/settings forms remain readable.
- Reusable spacing/density token categories are known.
- Narrow reflow may compress but not hide core capabilities.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-05-01` | Should SimpleVTT use one density level or context-specific density families for Product vs Play? | Draft | `UX-01-02` | no | `UI-05` |
| `UI-05-02` | What information may compact inside Command Center while keeping core capabilities discoverable? | Draft | `UX-01-04`, `ORIGIN-UX-01-09` | no | `UI-05`, `DND-03` |
| `UI-05-03` | What compactness rules apply to Actor Cards and Initiative entries? | Draft | `ORIGIN-UX-01-15`, `ORIGIN-UX-01-19` | no | `UI-05`, `DND-04` |
| `UI-05-04` | What density relationship applies across Character Library, Builder, Sheet, and Level Up? | Draft | `UX-03-05` | no | `UI-05`, `DND-01` |
| `UI-05-05` | What spacing token categories are required for page, section, component, control, and dense-HUD gaps? | Draft | none | no | `UI-05`, `CMP-01` |
| `UI-05-06` | How should contextual panes/dialogs balance information density with scanability? | Draft | `INT-02-01` | no | `UI-05`, `INT-02` |
| `UI-05-07` | What may compress/reflow on narrow desktop, and what must retain touch/pointer/focus target usability? | Draft | `PLATFORM-01-01` | no | `UI-05`, `PLATFORM-01`, `A11Y-01` |

---

# CMP-01 — Core Components

## Scope

Define reusable contracts/families for buttons, tabs, toggles/segmented controls, search/filter, Character/Actor Cards, Hotbar/Command Center, economy/resources, Initiative entries, status/connection indicators, utility panes, file/import controls, and shared selection/list patterns.

## Non-scope

Do not move page/business/rules logic into components or decide final page topology here.

## Exit Criteria

- Shared component families and non-purpose boundaries are known.
- State/accessibility/responsive expectations are identified for each family.
- Actor/Hotbar/Command Center components preserve canonical product decisions.
- Utility/import/status components avoid one-off incompatible patterns.
- Components do not calculate domain rules.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CMP-01-01` | What variants/states belong to the Button family vs separate controls? | Draft | `STATE-01-01` | no | `CMP-01`, `R7-BUTTON` |
| `CMP-01-02` | What shared contract governs tabs/segmented/toggle controls? | Draft | `STATE-01-01` | no | `CMP-01`, `R7-TABS`, `R7-SEGMENTED`, `R7-TOGGLE` |
| `CMP-01-03` | What shared contract governs search/filter/no-results patterns? | Draft | `STATE-01-04` | no | `CMP-01`, `R7-SEARCH`, `R7-FILTER` |
| `CMP-01-04` | What reusable information/action contract defines Character Card? | Draft | `DND-01-01` | no | `CMP-01`, `R7-CHAR-CARD` |
| `CMP-01-05` | What reusable state/interaction contract defines Actor Card? | Draft | `ORIGIN-UX-01-16`, `ORIGIN-UX-01-19` | no | `CMP-01`, `R7-ACTOR-CARD` |
| `CMP-01-06` | What component boundary separates Command Center container, Hotbar pages, Hotbar Slot, Economy, and Resource Rail? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-09` | no | `CMP-01`, `R7-COMMAND-CENTER`, `R7-HOTBAR-SLOT` |
| `CMP-01-07` | What reusable contract defines Initiative Entry and current-turn state? | Draft | `ORIGIN-UX-01-15` | no | `CMP-01`, `R7-INITIATIVE-ENTRY` |
| `CMP-01-08` | What shared pane/header/close/focus contract applies to contextual Session/DM utilities? | Draft | `INT-02-01` | no | `CMP-01`, `R4-QUICK-SHEET`, `R4-SESSION-RULES`, `R4-PARTICIPANTS` |
| `CMP-01-09` | What shared contract defines status, connection, warning, and persistent indicators? | Draft | `STATE-01-07`, `STATE-02-08` | no | `CMP-01`, `R5-STATUS`, `R7-CONNECTION-STATUS` |
| `CMP-01-10` | What shared contract defines file input + preview + validation + install/save patterns? | Draft | `STATE-01-05` | no | `CMP-01`, `R4-FILE-PICKER`, `R4-IMPORT-REVIEW` |
| `CMP-01-11` | What component contract prevents UI controls from duplicating or calculating domain/rules state? | Draft | `UX-01-05` | no | `CMP-01` |

---

# CONTENT-01 — UX Writing

## Scope

Define user-facing terminology, action labels, errors, empty states, disabled reasons, confirmation/destructive language, connection wording, visibility/privacy terms, result terms, onboarding language, bilingual/source metadata, and technical-vs-friendly language boundaries.

## Non-scope

Do not define rules content prose, localization architecture, or visual typography.

## Exit Criteria

- Core nouns/roles/entities use consistent terminology.
- Actions use concrete verbs and outcomes.
- Error/empty/disabled/confirmation anatomy is defined.
- Connection/visibility/result wording is unambiguous.
- Technical network/domain terms appear only where useful.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CONTENT-01-01` | What canonical user-facing terms distinguish Character, Actor, Combatant, Player, DM, Session, Scene, Encounter, and Play? | Draft | `UX-02-01`, `UX-02-03` | no | `CONTENT-01`, `R8-ACTION-LABELS` |
| `CONTENT-01-02` | What verb grammar should primary actions use so labels describe the actual next effect? | Draft | none | no | `CONTENT-01`, `R8-ACTION-LABELS` |
| `CONTENT-01-03` | What information anatomy must an error message contain? | Draft | `STATE-02-08` | no | `CONTENT-01`, `R8-ERROR-COPY` |
| `CONTENT-01-04` | What information anatomy must empty/no-results messages contain? | Draft | `STATE-01-04` | no | `CONTENT-01`, `R8-EMPTY-COPY` |
| `CONTENT-01-05` | How are unavailable/disabled reasons phrased when the reason comes from canonical rules/state? | Draft | `INT-01-06` | no | `CONTENT-01`, `R8-DISABLED-REASON` |
| `CONTENT-01-06` | What grammar distinguishes normal confirmation, destructive confirmation, cancel, retry, and close? | Draft | `INT-03-01`, `INT-03-07` | no | `CONTENT-01`, `R8-CONFIRM-COPY`, `R8-DESTRUCTIVE-COPY` |
| `CONTENT-01-07` | What exact product terms represent Public vs DM Only and later disclosure states? | Draft | `ORIGIN-UX-01-26`, `ORIGIN-UX-01-28` | no | `CONTENT-01`, `R8-VISIBILITY` |
| `CONTENT-01-08` | What result vocabulary distinguishes roll, total, outcome, effect, state change, adjudication, and Undo? | Draft | `ORIGIN-UX-01-22` | no | `CONTENT-01`, `R8-RESULT-TERMS` |
| `CONTENT-01-09` | What connection/reconnect/disconnect/rejoin/leave terminology is used consistently? | Draft | `STATE-02-04` | no | `CONTENT-01`, `R8-CONNECTION` |
| `CONTENT-01-10` | What is the tone/scope of first-use guidance, and which implementation/technical concepts must it avoid? | Draft | `NAV-01-07` | no | `CONTENT-01`, `R8-ONBOARDING` |
| `CONTENT-01-11` | How should Korean primary labels, English names, source/provenance, IDs, and network addresses be presented? | Draft | `UI-02-04` | no | `CONTENT-01`, `UI-02` |

---

# A11Y-01 — Accessibility

## Scope

Define keyboard navigation, focus visibility/order/trap/return, semantic roles/states, pointer alternatives, announcements, reduced motion, color independence, image alternatives, zoom/text scaling, and accessibility requirements across Product, Character, Play, dialogs, targeting, dice, handouts, and utilities.

## Non-scope

Do not define exact visual design tokens or domain rules behavior.

## Exit Criteria

- Every material action is keyboard reachable or has an equivalent.
- Focus behavior is defined for layers and dynamic state changes.
- Critical status/result/reconnect feedback is announced appropriately.
- Targeting/Actor/Hotbar semantics do not rely on pointer/color alone.
- Dice/VFX/overlay motion has equivalent reduced-motion information.
- Images/handouts and text scaling have explicit requirements.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `A11Y-01-01` | What product-wide keyboard navigation and visible-focus standard applies to all interactive controls? | Draft | none | no | `A11Y-01`, `M4` |
| `A11Y-01-02` | What focus trap/initial-focus/return rules apply by layer category? | Draft | `INT-02-01`, `INT-02-04` | no | `A11Y-01`, `M4` |
| `A11Y-01-03` | What semantic and keyboard model applies to Actor Cards, targeting, context menu, and selected/current states? | Draft | `INT-01-01`, `INT-01-03`, `INT-01-07` | no | `A11Y-01`, `R7-ACTOR-CARD` |
| `A11Y-01-04` | What semantic and keyboard model applies to Hotbar/Command Center capability selection and targeting cancel? | Draft | `DND-03-01` | no | `A11Y-01`, `R7-COMMAND-CENTER` |
| `A11Y-01-05` | Which loading/error/reconnect/result/interrupt changes use status vs alert/live announcements? | Draft | `STATE-01-07`, `STATE-02-04` | no | `A11Y-01`, `STATE-02` |
| `A11Y-01-06` | What reduced-motion equivalent is required for dice, combat VFX, overlay transitions, and result reveal? | Draft | `ORIGIN-UX-01-25`, `R9-COMBAT-VFX` | no | `A11Y-01`, `R9-REDUCED-MOTION` |
| `A11Y-01-07` | How are target eligibility, Actor side, status, DM-only, and semantic states conveyed without color alone? | Draft | `UI-03-03`, `UI-03-04`, `UI-03-06` | no | `A11Y-01`, `UI-03` |
| `A11Y-01-08` | What alt text/description and zoom/pan accessibility applies to portraits and DM handouts? | Draft | `DND-01-08`, `SES-01-08` | no | `A11Y-01`, `R4-PLAYER-HANDOUT-VIEWER`, `R4-PORTRAIT-EDITOR` |
| `A11Y-01-09` | What minimum text scaling/zoom behavior must Product, Sheet, and Play preserve before horizontal loss becomes acceptable? | Draft | `PLATFORM-01-01` | no | `A11Y-01`, `PLATFORM-01` |
| `A11Y-01-10` | Which icon-only/compact controls require visible labels, accessible names, or discoverable tooltip/help? | Draft | `UI-04-02`, `UI-04-08` | no | `A11Y-01`, `UI-04` |

---

# PLATFORM-01 — Desktop Responsive

## Scope

Define supported desktop width classes and reflow behavior for Product Shell, Play Dual Anchor, Actor Boards, Command Center, utilities, Character surfaces, dialogs, handouts, and dice while preserving desktop pointer/keyboard usability.

## Non-scope

Do not add mobile product scope unless explicitly approved; do not invent numeric breakpoints before token/layout review.

## Exit Criteria

- Wide/normal/narrow desktop model is defined.
- Core navigation and Play anchors remain reachable.
- Command Center/Actor Boards/utilities have explicit narrow behavior.
- Character Sheet/Builder and contextual layers reflow safely.
- Handout/dice presentation remains usable without changing authoritative outcome.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `PLATFORM-01-01` | What desktop width classes does v1 support, and is mobile/touch-first layout out of scope? | Draft | none | no | `PLATFORM-01`, `M5` |
| `PLATFORM-01-02` | How does Product Shell primary navigation reflow on narrow desktop? | Draft | `NAV-01-01`, `UI-01-01` | no | `PLATFORM-01`, `R7-PRIMARY-NAV` |
| `PLATFORM-01-03` | How does Play Dual Anchor reflow while keeping Scene/Actor Context and Command Center co-primary? | Draft | `UX-01-07`, `UI-01-02` | no | `PLATFORM-01`, `R1-PLAY` |
| `PLATFORM-01-04` | How do upper/lower Actor Boards and Initiative Tracker reflow on narrow desktop? | Draft | `UI-01-03`, `UI-01-04` | no | `PLATFORM-01`, `DND-04` |
| `PLATFORM-01-05` | How does Command Center/Hotbar/Economy/Resource Rail preserve reachability on narrow desktop? | Draft | `UI-01-05`, `UI-05-02` | no | `PLATFORM-01`, `DND-03` |
| `PLATFORM-01-06` | How do contextual utility rail/panes transform on narrow desktop? | Draft | `UI-01-06` | no | `PLATFORM-01`, `R7-SESSION-UTILITY-RAIL` |
| `PLATFORM-01-07` | How do Character Sheet, Builder, Level Up, and Full Sheet layer reflow? | Draft | `UI-01-07`, `UI-01-08` | no | `PLATFORM-01`, `DND-01` |
| `PLATFORM-01-08` | How do Handout Overlay/Upper/Full and image zoom/pan behave on narrow desktop? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `PLATFORM-01`, `SES-01` |
| `PLATFORM-01-09` | How does physical dice/result presentation adapt to narrow desktop without obscuring essential actions? | Draft | `ORIGIN-UX-01-23`, `ORIGIN-UX-01-25` | no | `PLATFORM-01`, `DND-02` |

---

# DND-01 — Character Presentation

## Scope

Define Character Library, Character Builder, import/edit, Character Sheet, standalone rolling, sheet layout choice, portrait, Level Up, validation/recovery, and Character-related transitions while preserving canonical Character/domain data.

## Non-scope

Do not define D&D rules calculations, connected Actor-control authority, Session join policy, or exact component styling.

## Exit Criteria

- Library/card information and actions are defined.
- Builder modes/steps and exit/recovery are defined.
- Character Sheet information hierarchy/layout strategy is defined.
- Standalone roll policy is defined.
- Portrait, edit, level-up, import, and empty/no-character states are covered.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `DND-01-01` | What information/actions must Character Library cards expose before opening a Character? | Draft | `UX-03-05` | no | `DND-01`, `R7-CHAR-CARD` |
| `DND-01-02` | What Character Builder modes and top-level step structure are first-class in v1? | Draft | `UX-01-01` | no | `DND-01`, `R3-BUILDER-GUIDED`, `R3-BUILDER-QUICK`, `R3-BUILDER-IMPORT`, `R3-BUILDER-EDIT` |
| `DND-01-03` | How are dependent choices surfaced within Builder without turning the flow into hidden rule logic? | Draft | `DND-01-02` | no | `DND-01`, `CMP-01` |
| `DND-01-04` | What happens when the user closes/cancels a create/edit/import flow with unsaved changes? | Draft | `INT-03-02` | no | `DND-01`, `R4-UNSAVED` |
| `DND-01-05` | What is the standalone Character Sheet information/action hierarchy? | Draft | `UX-03-05` | no | `DND-01`, `R1-CHAR-SHEET` |
| `DND-01-06` | Does v1 productize one Character Sheet layout, multiple selectable layouts, or a migration path between them? | Draft | `DND-01-05` | no | `DND-01`, `R3-SHEET-SIMPLEVTT`, `R3-SHEET-OFFICIAL` |
| `DND-01-07` | What is the standalone roll interaction/result model from Character Sheet? | Draft | `UX-01-01` | no | `DND-01`, `DND-02`, `R2-STANDALONE-ROLL` |
| `DND-01-08` | What portrait add/edit/remove/focal-point experience is supported and where does portrait data belong? | Draft | `DND-01-05` | no | `DND-01`, `R4-PORTRAIT-EDITOR`, `M3` |
| `DND-01-09` | What Level Up stages, preview, choices, commit, and cancel/recovery model are required? | Draft | `DND-01-05` | no | `DND-01`, `R2-LEVEL-UP` |
| `DND-01-10` | How does Character import recover from unsupported/missing/invalid fields without approximating rules? | Draft | `STATE-01-05`, `STATE-02-03` | no | `DND-01`, `R4-IMPORT-REVIEW` |
| `DND-01-11` | What is the empty/no-Character experience outside Join, including first creation CTA and library state? | Draft | `NAV-01-03` | no | `DND-01`, `STATE-01` |
| `DND-01-12` | Which Character actions remain available when the same Character is currently linked to an active Session? | Draft | `UX-01-03`, `UX-02-03` | no | `DND-01`, `SES-01` |

---

# DND-02 — Roll & Dice UX

## Scope

Define authoritative-result presentation, physical dice, result feedback, scene/table integration, standalone vs session presentation, result hierarchy, timing, VFX relationship, reduced motion, failure fallback, and durable Activity handoff.

## Non-scope

Do not define rules calculation, RNG authority, DM visibility protocol, or arbitrary numeric animation budgets here.

## Exit Criteria

- Reviewed physical-dice/result authority decisions are preserved.
- Result hierarchy and session/standalone variants are defined.
- Reveal/VFX/reduced-motion/failure behavior is defined.
- Activity/detail relationship is clear.
- Dice never becomes gameplay authority.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-22` | Should result feedback stay integrated with scene/play context with durable detail through Activity? | Reviewed | `UX-01-07` | no | `DND-02`, `DM-02` |
| `ORIGIN-UX-01-22A` | Should physical dice throw/roll/settle on the tabletop plane rather than act as floating number effects? | Reviewed | `ORIGIN-UX-01-22` | no | `DND-02` |
| `ORIGIN-UX-01-23` | Is the broad central table/scene the Roll Area? | Reviewed | `ORIGIN-UX-01-22A` | no | `DND-02` |
| `ORIGIN-UX-01-24` | Does authoritative rules/host result exist before physical dice settle to that final face? | Reviewed | none | no | `DND-02` |
| `ORIGIN-UX-01-25` | May fine dice trajectories be client-local while canonical dice/result are shared? | Reviewed | `ORIGIN-UX-01-24`, `ORIGIN-UX-01-26` | no | `DND-02`, `SES-02` |
| `DND-02-01` | What information appears in the immediate result strip/layer vs Activity detail? | Draft | `ORIGIN-UX-01-22` | no | `DND-02`, `R5-ROLL-RESULT` |
| `DND-02-02` | How should standalone Character rolls differ from connected shared rolls in presentation and controls? | Draft | `DND-01-07`, `ORIGIN-UX-01-24` | no | `DND-02`, `R5-STANDALONE-ROLL-RESULT` |
| `DND-02-03` | What is the reveal sequence between roll start, dice motion, authoritative face, modifiers/total, outcome, and state changes? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `R9-RESULT-REVEAL` |
| `DND-02-04` | What visual fallback occurs if 3D dice/VFX cannot render? | Draft | `ORIGIN-UX-01-25` | no | `DND-02`, `STATE-02` |
| `DND-02-05` | How does reduced motion preserve the same information/order without relying on physical animation? | Draft | `ORIGIN-UX-01-25` | no | `DND-02`, `A11Y-01` |
| `DND-02-06` | What visual/result treatment applies to natural-20/natural-1/ordinary outcomes without inventing unsupported rule meaning? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `UI-03` |
| `DND-02-07` | What relationship does combat delivery/impact VFX have to dice/result sequencing? | Draft | `DND-02-03` | no | `DND-02`, `R9-COMBAT-VFX` |
| `DND-02-08` | What user controls may skip/advance/dismiss presentation without changing authoritative result? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `INT-02` |
| `DND-02-09` | How are multiple dice, advantage/disadvantage, saves, damage components, and aggregate legacy results presented? | Draft | `DND-02-03` | no | `DND-02`, `CMP-01` |

---

# DND-03 — Action UX

## Scope

Define capability exposure, Hotbar pages/customization, economy/resources, action detail, default attack interaction, targeting, invalid reasons, multi-target execution, cancellation, and safe interaction during resolution.

## Non-scope

Do not calculate legality/target eligibility/resources in UI or choose domain action relations heuristically.

## Exit Criteria

- Persistent capability/Hotbar direction is preserved.
- Economy/resource presentation and customization rules are defined.
- Default click/targeting/no-fallback decisions are preserved.
- Targeting/detail/cancel/unavailable states are defined.
- Resolution safe-interaction boundary is resolved or explicitly blocked.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-07` | What persistent Hotbar page family is required? | Reviewed | `UX-01-04`, `UX-01-06` | no | `DND-03` |
| `ORIGIN-UX-01-08` | What fixed economy indicators and dynamic Resource Rail are required? | Reviewed | `UX-01-04` | no | `DND-03` |
| `ORIGIN-UX-01-17` | What default action does a valid hostile click invoke in combat when no targeting action is selected? | Reviewed | `ORIGIN-UX-01-16` | no | `DND-03` |
| `ORIGIN-UX-01-18` | Is smart fallback prohibited when the canonical Main Hand default is unavailable? | Reviewed | `ORIGIN-UX-01-17` | no | `DND-03` |
| `ORIGIN-UX-01-19` | How are valid/invalid targets presented and who computes eligibility? | Reviewed | `UX-01-05` | no | `DND-03` |
| `ORIGIN-UX-01-20` | How do single-target and multi-target actions execute? | Reviewed | `ORIGIN-UX-01-19` | no | `DND-03`, `INT-03` |
| `ORIGIN-UX-01-21` | Does resolution keep Command Center visible and lock only conflicting interactions? | Reviewed | `UX-01-07` | no | `DND-03`, `INT-02` |
| `DND-03-01` | What exact capability grouping/page contents appear in Mixed/Action/Spell/Item/custom pages? | Draft | `ORIGIN-UX-01-07` | no | `DND-03`, `R7-HOTBAR-TABS` |
| `DND-03-02` | What Hotbar customization operations are supported and what may automatic discovery never overwrite? | Draft | `UX-01-06`, `ORIGIN-UX-01-07` | no | `DND-03`, `R7-HOTBAR-SLOT` |
| `DND-03-03` | What information is visible on a Hotbar Slot vs hover/focus detail vs expanded action detail? | Draft | `UX-01-04`, `UX-03-06` | no | `DND-03`, `CMP-01` |
| `DND-03-04` | How are unavailable actions/resources/costs shown without hiding the capability? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-18` | no | `DND-03`, `CONTENT-01` |
| `DND-03-05` | How does a user cancel/back out of selected capability or targeting without losing unrelated Play context? | Draft | `INT-01-04` | no | `DND-03`, `STATE-01` |
| `DND-03-06` | What target-selection feedback appears on Actor Cards for single vs multi-target selection? | Draft | `ORIGIN-UX-01-19`, `ORIGIN-UX-01-20` | no | `DND-03`, `R7-ACTOR-CARD` |
| `DND-03-07` | How are no-target/self-target actions executed while preserving clear feedback? | Draft | `ORIGIN-UX-01-20` | no | `DND-03` |
| `DND-03-08` | What explicit canonical relation provides the Main Hand executable default action? | Draft | `ORIGIN-UX-01-17` | no | `DND-03`, `GAP-MAIN-HAND-CANONICAL-RELATION` |
| `DND-03-09` | Which interactions remain safe vs conflicting during each resolution/interrupt stage? | Draft | `ORIGIN-UX-01-21` | no | `DND-03`, `GAP-RESOLUTION-SAFE-INTERACTIONS` |
| `DND-03-10` | Where is Rules/detail access available from action UI without turning Rules into an execution prerequisite? | Draft | `UX-01-04`, `NAV-01-05` | no | `DND-03`, `CONTENT-02` |

---

# DND-04 — Combat UX

## Scope

Define Initiative presentation, turn/round focus, Actor Board preservation, end-turn controls, off-turn states, interrupt/reaction presentation, manual movement-reaction input, combat VFX, and combat entry/exit at the UI level.

## Non-scope

Do not define initiative calculation, reaction legality, movement rules, or authoritative turn engine behavior.

## Exit Criteria

- Reviewed Initiative tracker/Actor Board decisions are preserved.
- Turn ownership/end-turn/off-turn presentation is defined.
- Reaction/interrupt presentation and manual declaration scope are defined.
- Combat entry/exit and round feedback are defined.
- VFX/reduced-motion relationship is routed clearly.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-14` | Does Initiative preserve Actor Boards and add a top horizontal tracker? | Reviewed | `UX-01-07` | no | `DND-04` |
| `ORIGIN-UX-01-15` | What information belongs in the compact Initiative Tracker entry? | Reviewed | `ORIGIN-UX-01-14` | no | `DND-04` |
| `DND-04-01` | How does the user enter Initiative from Freeform and what UI state changes immediately? | Draft | `ORIGIN-UX-01-14` | no | `DND-04`, `SES-01` |
| `DND-04-02` | How are current turn, controlled Actor, next order, round, and off-turn state visually distinguished? | Draft | `ORIGIN-UX-01-15`, `UX-02-03` | no | `DND-04`, `UI-03` |
| `DND-04-03` | Where and when is End Turn / Next Turn available for Player and DM? | Draft | `UX-02-05` | no | `DND-04`, `SES-02` |
| `DND-04-04` | What interactions remain available when it is not the user's turn? | Draft | `DND-03-09`, `UX-02-03` | no | `DND-04`, `DND-03` |
| `DND-04-05` | What is the UI model for Reaction/Interrupt prompt, response, timeout/no-timeout, and return to resolution? | Draft | `R3-INTERRUPT`, `GAP-RESOLUTION-SAFE-INTERACTIONS` | no | `DND-04`, `R4-REACTION-PROMPT` |
| `DND-04-06` | Is manual movement-reaction input a supported first-class control, and who may invoke it? | Draft | `UX-02-03`, `UX-02-05` | no | `DND-04`, `R4-MOVEMENT-REACTION-INPUT` |
| `DND-04-07` | What combat entry/round/turn transition feedback is shown without creating separate combat-stage topology? | Draft | `ORIGIN-UX-01-14` | no | `DND-04`, `R5-STATUS` |
| `DND-04-08` | How does combat VFX relate to Actor positions/cards, result reveal, and reduced-motion behavior? | Draft | `DND-02-07`, `A11Y-01-06` | no | `DND-04`, `R9-COMBAT-VFX` |
| `DND-04-09` | How is Initiative exited, and does ending it require explicit confirmation? | Draft | `INT-03-01` | no | `DND-04`, `INT-03` |

---

# SES-01 — Session UX

## Scope

Define Host/Join setup, Character Select, lobby/readiness, Play workspace composition, Command Center/Actor Boards, handouts, in-session utilities, identity/status, empty/freeform states, leave/end flows, and session continuity at the user-visible level.

## Non-scope

Do not define wire protocols, secret-data delivery schema, domain combat rules, or final DM authority semantics.

## Exit Criteria

- Host/Join/lobby/Play task flows are defined.
- Reviewed Command Center/Actor Board/Handout decisions are preserved.
- In-session utility topology and identity/status are defined.
- Leave/end/empty-state flows are defined.
- Reconnect continuity requirements are handed to SES-02 without duplicating protocol semantics.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-FLOW-02` | Does Join include Character Select before Player lobby/live Play without making Character a universal Session prerequisite? | Reviewed | `ORIGIN-FLOW-01` | no | `SES-01` |
| `ORIGIN-UX-01-09` | What content belongs in the bottom Command Center? | Reviewed | `UX-01-07` | no | `SES-01`, `DND-03` |
| `ORIGIN-UX-01-10` | Does Freeform use a lower Player/Allied Actor Board above Command Center instead of permanent side portrait rail? | Reviewed | `UX-01-07` | no | `SES-01` |
| `ORIGIN-UX-01-11` | Does Freeform also use an upper NPC/Neutral/Hostile Actor Board? | Reviewed | `ORIGIN-UX-01-10` | no | `SES-01` |
| `ORIGIN-UX-01-12` | What Handout presentation modes are supported and is mode shared/restored? | Reviewed | `UX-01-03` | no | `SES-01`, `SES-02` |
| `ORIGIN-UX-01-13` | Which Handout modes may Player dismiss/reopen locally? | Reviewed | `ORIGIN-UX-01-12` | no | `SES-01` |
| `SES-01-01` | What fields/actions belong in direct Host Setup before a Host Lobby exists? | Draft | `ORIGIN-FLOW-01` | no | `SES-01`, `R2-HOST` |
| `SES-01-02` | What participant/readiness conditions are required before Host may start Play? | Draft | `UX-02-03` | no | `SES-01`, `SES-02` |
| `SES-01-03` | What fields/actions belong in direct Join Setup and Character Select? | Draft | `ORIGIN-FLOW-02` | no | `SES-01`, `R2-JOIN` |
| `SES-01-04` | What happens when Join has no valid Character available? | Draft | `ORIGIN-FLOW-02` | no | `SES-01`, `GAP-JOIN-NO-CHARACTER` |
| `SES-01-05` | What information/actions belong in Player Lobby/Ready before live Play? | Draft | `SES-01-02`, `SES-01-03` | no | `SES-01` |
| `SES-01-06` | What is the complete Play Workspace composition in Freeform and Initiative, including persistent vs contextual regions? | Draft | `ORIGIN-UX-01-09`, `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11`, `ORIGIN-UX-01-14` | no | `SES-01`, `UI-01` |
| `SES-01-07` | Which Quick Sheet, Full Sheet, Rules, Activity, Encounter, Participants, Session Share, and connection utilities exist in-session and where are they launched? | Draft | `NAV-01-05`, `INT-02-05` | no | `SES-01`, `R7-SESSION-UTILITY-RAIL` |
| `SES-01-08` | What exact UI behavior realizes Handout Overlay/Upper/Full across Actor Boards, scene, Command Center, close/reopen, zoom/pan? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `SES-01`, `R4-DM-HANDOUT-PANE`, `R4-PLAYER-HANDOUT-VIEWER` |
| `SES-01-09` | How are Session identity, Character/Actor identity, connection state, and current mode continuously presented? | Draft | `UX-02-01`, `UX-02-03` | no | `SES-01`, `R7-SESSION-IDENTITY`, `R7-CONNECTION-STATUS` |
| `SES-01-10` | What is the normal Freeform experience when there are no connected Players and/or no Combatants? | Draft | `SES-01-06` | no | `SES-01`, `STATE-01` |
| `SES-01-11` | What user-visible flow applies when Player leaves vs Host ends a session? | Draft | `INT-03-03`, `INT-03-04` | no | `SES-01`, `R2-LEAVE`, `R2-END-SESSION` |
| `SES-01-12` | What user-visible continuity must be restored after reconnect before Play interaction resumes? | Draft | `UX-01-03`, `STATE-02-04` | no | `SES-01`, `SES-02` |

---

# SES-02 — Multiplayer Authority UX

## Scope

Define role-scoped visibility/delivery/control/disclosure UX, session-authority projection, reconnect/reconciliation, participant/session compatibility, Handout shared state, DM-only event delivery, authorization denial, and UI-visible consequences of multiplayer authority contracts.

## Non-scope

Do not define the low-level transport implementation inside this sheet; required protocol/schema changes become architecture contracts/gaps.

## Exit Criteria

- Role model dependencies are incorporated.
- Public/DM-only delivery/disclosure decisions are preserved.
- Secret-event and Handout network contracts are explicit or blocking.
- Reconnect/reconciliation projection is defined.
- Unauthorized commands/data and compatibility failures have safe UX behavior.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-26` | Does authoritative roll visibility include Public and DM Only with no secret details delivered to Player? | Reviewed | `UX-02-08` | no | `SES-02` |
| `ORIGIN-UX-01-29` | Does DM Only leave no Player-side existence metadata until authorized disclosure? | Reviewed | `ORIGIN-UX-01-26` | no | `SES-02` |
| `SES-02-01` | How do Play Role and Connection Role combine into the effective authority context used by UI? | Draft | `UX-02-01`, `UX-02-02` | no | `SES-02`, `M1` |
| `SES-02-02` | What commands/data may Player vs DM see, receive, control, and mutate for Actor/Encounter/session utilities? | Draft | `UX-02-03`, `UX-02-04`, `UX-02-05` | no | `SES-02`, `M1` |
| `SES-02-03` | What authoritative event/projection contract implements DM-only roll/adjudication with zero Player existence leakage? | Draft | `ORIGIN-UX-01-26`, `ORIGIN-UX-01-29` | no | `SES-02`, `GAP-DM-ONLY-DELIVERY-PROTOCOL` |
| `SES-02-04` | What later-disclosure projection is emitted for full adjudication vs result-only reveal? | Draft | `ORIGIN-UX-01-28`, `SES-02-03` | no | `SES-02`, `DM-02` |
| `SES-02-05` | What shared Handout presentation state fields/projection/reconnect contract supports Overlay/Upper/Full? | Draft | `ORIGIN-UX-01-12` | no | `SES-02`, `GAP-HANDOUT-NETWORK-CONTRACT` |
| `SES-02-06` | What session state/event cursor is restored on reconnect, and how is stale state reconciled before interaction? | Draft | `UX-01-03`, `STATE-02-04`, `STATE-02-07` | no | `SES-02`, `M2`, `M3` |
| `SES-02-07` | How are incompatible client/session/content versions detected and presented before unsafe Play? | Draft | `STATE-02-05` | no | `SES-02`, `R6-INCOMPATIBLE` |
| `SES-02-08` | How are unauthorized commands rejected without leaking unavailable private state? | Draft | `UX-02-08`, `STATE-02-06` | no | `SES-02`, `R6-PERMISSION` |
| `SES-02-09` | What participant connection/ready/identity information is role-visible and role-delivered? | Draft | `UX-02-07`, `UX-02-08` | no | `SES-02`, `R4-PARTICIPANTS` |
| `SES-02-10` | If live role switching is allowed, what state/visibility reconciliation occurs at switch time? | Draft | `UX-02-06` | yes; only if live role switching is allowed | `SES-02`, `M1`, `M3` |

---

# DM-01 — DM Controls

## Scope

Define persistent/contextual DM controls for roll visibility, actor control, Encounter management, participants/session share, Handout, session start/end, and DM-specific utility access/indicators.

## Non-scope

Do not define adjudication/Undo mechanics, network delivery schema, or domain rules calculations.

## Exit Criteria

- Roll visibility control/default/persistence is resolved.
- DM actor/Encounter/session utility control placement is defined.
- Public/DM-only status remains obvious.
- DM utility density/contextuality is defined.
- Session and Handout controls have clear ownership.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-27` | Does DM Command Center expose persistent Public/DM Only control with strong continuous indicator and no auto-switching? | Reviewed | `ORIGIN-UX-01-26` | no | `DM-01` |
| `DM-01-01` | What is the initial Public/DM Only value and persistence lifetime? | Draft | `ORIGIN-UX-01-27` | no | `DM-01`, `GAP-DM-ROLL-VISIBILITY-PERSISTENCE` |
| `DM-01-02` | Where and how does DM switch selected/controlled Actor without confusing current turn/target selection? | Draft | `UX-02-05`, `INT-01-01` | no | `DM-01`, `R4-ACTOR-CONTEXT` |
| `DM-01-03` | What Encounter management controls are available in preparation, Freeform, and Initiative? | Draft | `UX-02-05`, `DND-04-01` | no | `DM-01`, `R4-ENCOUNTER` |
| `DM-01-04` | What participant/session-share controls belong in persistent vs contextual DM utilities? | Draft | `NAV-01-05`, `SES-01-07` | no | `DM-01`, `R4-PARTICIPANTS`, `R4-SESSION-SHARE` |
| `DM-01-05` | Where does Handout authoring/reveal/withdraw/mode control live for DM? | Draft | `SES-01-08` | no | `DM-01`, `R4-DM-HANDOUT-PANE` |
| `DM-01-06` | Which session lifecycle controls remain accessible during live Play and which require destructive confirmation? | Draft | `SES-01-11` | no | `DM-01`, `INT-03` |
| `DM-01-07` | What DM-only persistent indicators must remain visible while contextual tools are closed? | Draft | `ORIGIN-UX-01-27`, `UX-02-07` | no | `DM-01`, `UI-03`, `UI-04` |
| `DM-01-08` | How is the DM utility surface organized without becoming a duplicate second Command Center? | Draft | `UX-01-07`, `NAV-01-05` | no | `DM-01`, `UI-01` |

---

# DM-02 — Adjudication & Undo

## Scope

Define DM adjudication/correction, Undo, private Activity presentation, disclosure controls, audit/provenance, result detail, and how corrections interact with already-visible outcomes.

## Non-scope

Do not define rules calculations, low-level event schema, or general DM utility navigation.

## Exit Criteria

- Reviewed later-disclosure model is preserved.
- Private Activity presentation is decided.
- Adjudication operations/scope/reason/preview are defined.
- Undo/correction limits and audit presentation are defined.
- Disclosure/correction ordering and confirmation behavior are explicit.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-28` | May a hidden roll later be disclosed as full adjudication or result-only without reroll? | Reviewed | `ORIGIN-UX-01-26` | no | `DM-02`, `SES-02` |
| `DM-02-01` | How does DM Activity present private rolls/adjudications before disclosure? | Draft | `ORIGIN-UX-01-26` | no | `DM-02`, `GAP-DM-PRIVATE-ACTIVITY-PRESENTATION` |
| `DM-02-02` | Which adjudication operation categories are supported at product level? | Draft | none | no | `DM-02`, `R4-ADJUDICATION` |
| `DM-02-03` | What scope/lifetime choices may an adjudication have and how are they previewed before commit? | Draft | `DM-02-02` | no | `DM-02`, `M3` |
| `DM-02-04` | Is a reason/provenance field required, optional, or operation-dependent? | Draft | `DM-02-02` | no | `DM-02`, `CONTENT-01` |
| `DM-02-05` | What may Undo reverse, and what must instead use a new corrective adjudication? | Draft | `DM-02-02` | no | `DM-02`, `R2-DM-UNDO` |
| `DM-02-06` | What confirmation is required for adjudication/Undo based on consequence and visibility? | Draft | `INT-03-06` | no | `DM-02`, `INT-03` |
| `DM-02-07` | Where and how does DM choose full-adjudication vs result-only disclosure? | Draft | `ORIGIN-UX-01-28`, `SES-02-04` | no | `DM-02`, `R2-DM-DISCLOSE` |
| `DM-02-08` | How is an already disclosed result corrected without erasing audit history or pretending the original never existed? | Draft | `DM-02-05`, `DM-02-07` | no | `DM-02`, `R5-ACTIVITY-EVENT` |
| `DM-02-09` | What information belongs in immediate result controls vs Activity detail for adjudicated/undone events? | Draft | `ORIGIN-UX-01-22` | no | `DM-02`, `R4-ACTIVITY-DETAIL` |

---

# CONTENT-02 — Rules & Add-on UX

## Scope

Define Rules Browser/search/detail/relations/source presentation and Content/Add-on import/preview/validation/install/persistence/conflict/unsupported/update/remove flows, including Combatant/content imports and session-active content visibility.

## Non-scope

Do not define rules text itself, executable plugin architecture, domain rule semantics, or general UX writing style.

## Exit Criteria

- Rules search/filter/detail/related/source flow is defined.
- Add-on import/preview/validation/install lifecycle is defined.
- Validation/conflict/unsupported/persistence states have explicit behavior.
- Update/remove and active-session content policies are decided.
- Rules/Content surfaces remain safe reference/management UI rather than hidden rules authority.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CONTENT-02-01` | What content categories/source metadata must Rules Browser expose and search? | Draft | none | no | `CONTENT-02`, `R1-RULES` |
| `CONTENT-02-02` | How do Search, Filter, no-results, Rule Detail, related rules, and return-to-results behave? | Draft | `CONTENT-02-01`, `STATE-01-04` | no | `CONTENT-02`, `R4-SESSION-RULES` |
| `CONTENT-02-03` | How is source/provenance/relationship information presented without overwhelming normal rule lookup? | Draft | `CONTENT-02-01`, `UX-03-06` | no | `CONTENT-02`, `CONTENT-01` |
| `CONTENT-02-04` | What add-on import package/file types and file-size/support boundaries are productized? | Draft | none | no | `CONTENT-02`, `R7-FILE-INPUT` |
| `CONTENT-02-05` | What Preview/Validation information must be shown before install/activation? | Draft | `CONTENT-02-04`, `STATE-01-05` | no | `CONTENT-02`, `R4-IMPORT-REVIEW` |
| `CONTENT-02-06` | What validation severities block install vs warn vs inform, and how are dependency/conflict issues represented? | Draft | `CONTENT-02-05` | no | `CONTENT-02`, `STATE-01`, `STATE-02` |
| `CONTENT-02-07` | What happens when imported content requests unsupported mechanics or unsafe rule extensions? | Draft | `STATE-02-03` | no | `CONTENT-02`, `R6-UNSUPPORTED` |
| `CONTENT-02-08` | What persistence/durability behavior and recovery applies after install or catalog-save failure? | Draft | `STATE-02-02`, `STATE-02-09` | no | `CONTENT-02`, `M3` |
| `CONTENT-02-09` | Does v1 support update/replace/remove/disable of installed add-ons, and what happens to dependent Characters/Sessions? | Draft | `CONTENT-02-08` | no | `CONTENT-02`, `INT-03` |
| `CONTENT-02-10` | How are Combatant-specific imports unified with or distinguished from general Content import? | Draft | `CONTENT-02-04` | no | `CONTENT-02`, `R4-IMPORT-REVIEW` |
| `CONTENT-02-11` | How is active Session content shown, and which changes are allowed while a session is live? | Draft | `SES-02-07` | no | `CONTENT-02`, `SES-01`, `R4-SESSION-SHARE` |

---

# Global Planning Gate — required before individual review resumes

**No individual governance-sheet question, including `UX-02-01`, may resume until every item below is complete.**

AI performs this preparation without asking new product questions unless a genuinely blocking ambiguity requires owner input. Newly discovered material choices are registered as Planning Gaps or placed into the appropriate still-unreviewed Decision Map.

```text
[ ] R1-R9 complete Master UI Inventory is cross-checked against current implementation, derived master-flow.md, existing Decision Cards, and generic non-route UI patterns.
[ ] M1-M6 required coverage is materialized for every material Registry item; material TBD behavior is represented by a Decision/Contract, N/A with reason, or explicit Planning Gap.
[x] All 27 governance sheets have a complete predeclared T2 Decision Map containing Scope, Non-scope, Exit Criteria, full decision list, Status, full dependency IDs/conditional branches, and Destination.
[ ] Missing / Duplication / Coverage audit passes:
    [ ] every Registry item has at least one governing sheet/contract owner;
    [ ] every governance sheet has inventory/decision-map coverage;
    [ ] no normative requirement has duplicate canonical authority;
    [ ] all material unknowns are explicit Planning Gaps rather than AI inference.
[ ] Owner receives one concise whole-product coverage checkpoint showing what is ready, what is still a gap, and confirming no product decisions were silently added.
```

Only after this Global Planning Gate passes may the sequential owner review resume at `UX-02-01`.

Do not append spontaneous questions to any sheet. A new material question discovered during later planning first updates the appropriate complete Decision Map with recorded scope/dependency impact; if it cannot safely be routed yet, record a Planning Gap instead.