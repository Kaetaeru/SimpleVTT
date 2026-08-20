# SimpleVTT UI/UX Review Coverage Plan

Status: active review-order control

This file controls **which governance sheet is being reviewed, which Decision Maps are declared, and which question may be asked next**.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Templates: [`templates.md`](templates.md)

## Review-order rule

- Do not ask a sheet's first question until that sheet's complete Decision Map is materialized.
- A Decision Map is `Complete` only when it has Scope, Non-scope, Exit Criteria, and a full table with ID, Question, Status, Depends On, Conditional, Destination.
- `Review Status` is exactly `Not Started`, `In Review`, or `Reviewed`.
- Reviewed seed decisions are canonical in their owning map and referenced as dependencies elsewhere; do not duplicate the same normative question body across maps.
- Existing migrated decisions may seed later maps but do not authorize inventing the rest.
- New discoveries go to a declared Draft map item or Planning Gap before becoming owner questions.
- AI MAY propose review-order changes; owner approval is required to change the declared order.
- All structured references use complete stable IDs.

## Current sequence

| Order | Sheet | Purpose | Map status | Review Status | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `UX-01` Product Principles | product posture and top-level experience principles | **Complete** | **Reviewed** | 7 Reviewed Decision Cards; none Frozen |
| 2 | `UX-02` User & Role Model | roles, ownership/control, information entitlement | **Complete** | **In Review** | `UX-02-01` Selected; next `UX-02-02` |
| 3 | `UX-03` Information Hierarchy | global/contextual information priority | **Complete** | Not Started | follows UX-02 dependencies |
| 4 | `NAV-01` Navigation | destinations, return, hierarchy | **Complete** | Not Started | Reviewed direct Session-entry seed retained |
| 5 | `UI-01` Layout & Grid | global layout primitives | **Complete** | Not Started | Dual Anchor / Actor Board dependencies declared |
| 6 | `INT-01` Interaction | pointer/keyboard/context interaction | **Complete** | Not Started | Reviewed Actor interaction seed retained |
| 7 | `STATE-01` UI States | local component/task states | **Complete** | Not Started | R5/R6/M6 coverage declared |
| 8 | `STATE-02` System States | loading/error/reconnect/system state | **Complete** | Not Started | system recovery coverage declared |
| 9 | `INT-02` Layering | modal/nonmodal layering | **Complete** | Not Started | R4 layer coverage declared |
| 10 | `INT-03` Confirmation | destructive/confirmation/cancel grammar | **Complete** | Not Started | no-confirm targeting rule referenced from DND-03, not duplicated |
| 11 | `UI-02` Typography | type system | **Complete** | Not Started | typography coverage declared |
| 12 | `UI-03` Color & Semantic Color | semantic color system | **Complete** | Not Started | state/target/privacy coverage declared |
| 13 | `UI-04` Iconography | icon language | **Complete** | Not Started | icon families declared |
| 14 | `UI-05` Density & Spacing | density/spacing tokens | **Complete** | Not Started | product/play/sheet density coverage declared |
| 15 | `CMP-01` Core Components | reusable component contracts | **Complete** | Not Started | component families declared |
| 16 | `CONTENT-01` UX Writing | terminology, labels, error/confirmation copy | **Complete** | Not Started | R8 coverage declared |
| 17 | `A11Y-01` Accessibility | keyboard/focus/semantics/reduced motion | **Complete** | Not Started | M4/R9 coverage declared |
| 18 | `PLATFORM-01` Desktop Responsive | wide/normal/narrow behavior | **Complete** | Not Started | M5 coverage declared |
| 19 | `DND-01` Character Presentation | Library/Builder/Sheet/Level Up | **Complete** | Not Started | active layout/portrait/import evidence covered |
| 20 | `DND-02` Roll & Dice UX | dice/result/resolution presentation | **Complete** | Not Started | Reviewed roll/dice seeds retained |
| 21 | `DND-03` Action UX | capability/hotbar/economy/targeting | **Complete** | Not Started | canonical owner of `ORIGIN-UX-01-20` seed |
| 22 | `DND-04` Combat UX | initiative/turn/interrupt combat presentation | **Complete** | Not Started | Reviewed Initiative seeds retained |
| 23 | `SES-01` Session UX | lifecycle and Play workspace | **Complete** | Not Started | Reviewed Join/Command Center/Actor Board/Handout seeds retained |
| 24 | `SES-02` Multiplayer Authority UX | delivery/visibility/reconnect authority | **Complete** | Not Started | Critical private-delivery gap retained |
| 25 | `DM-01` DM Controls | persistent/contextual DM controls | **Complete** | Not Started | current spatial-relation tool covered by existing Draft DM questions |
| 26 | `DM-02` Adjudication & Undo | disclosure, Activity, correction, Undo | **Complete** | Not Started | private Activity gap retained |
| 27 | `CONTENT-02` Rules & Add-on UX | Rules browser and content management | **Complete** | Not Started | import/content coverage declared |

---

# UX-01 — Product Principles

**Scope:** product posture, Shell/Play relationship, continuity, core capability exposure, contextual adaptation, discoverability/customization, Play visual priority.

**Non-scope:** exact navigation topology, role permissions, pixel layout, styling, detailed Hotbar contents, detailed targeting rules, network contracts.

**Exit Criteria:** all seven top-level principles are Reviewed; no new UX-01 question is appended without explicit reopening.

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

**Scope:** role axes, offline identity, Character ownership vs Actor control, control scope, role switching, role UI divergence, unauthorized information, v1 extra roles.

**Non-scope:** wire format, payload redaction implementation, exact DM menu layout, role-specific styling, schema implementation.

**Exit Criteria:** role axes, offline treatment, ownership/control, Player/DM scope, switching, UI divergence, unauthorized-information principle, extra-role scope are decided.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-02-01` | Separate Play Role and Connection Role, or one role axis? | Selected | none | no | `UX-02`, `SES-02` |
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

**Scope:** global/contextual boundaries, Shell/Play continuity, permanent/contextual UI, Play/Sheet priority, progressive disclosure, duplication, transient result/Activity priority.

**Non-scope:** exact dimensions, pixels, styling, network implementation.

**Exit Criteria:** all hierarchy and disclosure principles are decided.

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

**Scope:** stable destinations, Home actions, Product Shell navigation, Return to Play, Character/Session/Rules/Content/Settings hierarchy, contextual tools, onboarding entry.

**Non-scope:** exact sidebar dimensions/art, keyboard focus implementation, network permissions, Play internal layout.

**Exit Criteria:** destination set, direct Host/Join, Return to Play, Character/Rules/Content/Settings hierarchy, contextual-tool boundary, onboarding placement are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-FLOW-01` | Should Home expose direct first-class Host and Join entry while keeping Character non-mandatory for Session entry? | Reviewed | `UX-01-01` | no | `NAV-01`, `SES-01` |
| `NAV-01-01` | What is the final top-level Product Shell destination set and order? | Draft | `UX-01-01`, `UX-01-02`, `UX-03-01` | no | `NAV-01`, `R1-HOME` |
| `NAV-01-02` | Where and when does Return to Play appear while a live session exists? | Draft | `UX-01-03`, `UX-03-02` | no | `NAV-01`, `SES-01` |
| `NAV-01-03` | How do Character Library, Character Sheet, Builder, Edit, and Level Up enter/return within Product Shell? | Draft | `UX-03-05` | no | `NAV-01`, `DND-01` |
| `NAV-01-04` | How do Rules, Content, and Settings preserve/restore prior Product Shell context? | Draft | `UX-03-01`, `UX-03-02` | no | `NAV-01`, `CONTENT-02` |
| `NAV-01-05` | Which Activity, Encounter, Adjudication, Session utility, and similar tools remain contextual rather than top-level? | Draft | `UX-03-01`, `UX-03-03` | no | `NAV-01`, `SES-01`, `DM-01`, `DM-02` |
| `NAV-01-06` | What Back/Close/Return grammar applies across Product Shell and contextual/full-workspace layers? | Draft | `UX-03-02`, `UX-03-03` | no | `NAV-01`, `INT-02` |
| `NAV-01-07` | Where does first-use guidance live and how can it be reopened after dismissal? | Draft | `UX-03-06` | no | `NAV-01`, `R2-FIRST-USE`, `CONTENT-01` |
| `NAV-01-08` | Which restored/deep-linked state may reopen directly after app restart, and which returns through Home? | Draft | `UX-01-03` | no | `NAV-01`, `STATE-02` |

---

# UI-01 — Layout & Grid

**Scope:** Product Shell, Character, Play Dual Anchor, Actor Boards, Command Center, utilities, full-workspace region relationships.

**Non-scope:** exact pixel dimensions, spacing values, typography, colors, breakpoints.

**Exit Criteria:** major regions, scrolling/sticky ownership, Play/Character region models are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-01-01` | What global region grammar does Product Shell use for primary navigation and content? | Draft | `NAV-01-01` | no | `UI-01`, `R7-PRIMARY-NAV` |
| `UI-01-02` | What region model realizes the Play Dual Anchor without one anchor dominating the other? | Draft | `UX-01-07` | no | `UI-01`, `SES-01`, `R1-PLAY` |
| `UI-01-03` | How are upper opposing and lower allied Actor Boards allocated around Scene/Table Context? | Draft | `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11` | no | `UI-01`, `SES-01` |
| `UI-01-04` | How does the top Initiative Tracker fit without replacing Actor Boards or Command Center? | Draft | `ORIGIN-UX-01-14`, `ORIGIN-UX-01-15` | no | `UI-01`, `DND-04` |
| `UI-01-05` | What is the major internal region model of the bottom Command Center? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-09` | no | `UI-01`, `DND-03`, `R7-COMMAND-CENTER` |
| `UI-01-06` | Where may contextual Session/DM utilities occupy space without displacing core Play anchors? | Draft | `UX-03-03`, `NAV-01-05` | no | `UI-01`, `SES-01`, `DM-01` |
| `UI-01-07` | What region model does standalone Character Sheet use? | Draft | `UX-03-05` | no | `UI-01`, `DND-01` |
| `UI-01-08` | What region model does Character Builder/Level Up use? | Draft | `DND-01-02` | no | `UI-01`, `DND-01` |
| `UI-01-09` | Which regions own scrolling/sticky behavior on normal desktop? | Draft | `UI-01-01`, `UI-01-02`, `UI-01-07` | no | `UI-01`, `PLATFORM-01` |

---

# INT-01 — Interaction

**Scope:** Actor selection/target/context action, selection priority, Escape/back, unavailable reasons, direct vs contextual action.

**Non-scope:** rules legality, network authority, animation timing, final styling.

**Exit Criteria:** Actor interaction, context menu, keyboard equivalent, cancellation priority, unavailable-reason access are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-16` | What is the Actor Card left-click/right-click interaction family? | Reviewed | `UX-01-05` | no | `INT-01`, `DND-03` |
| `INT-01-01` | When Actor selection, selected-action targeting, and DM actor control overlap, which context has priority? | Draft | `ORIGIN-UX-01-16`, `UX-02-03`, `UX-02-05` | no | `INT-01`, `DND-03`, `DM-01` |
| `INT-01-02` | What command categories belong in Actor Context Menu without duplicating common Hotbar actions? | Draft | `ORIGIN-UX-01-16` | no | `INT-01`, `R4-ACTOR-CONTEXT` |
| `INT-01-03` | What keyboard interaction is equivalent to right-click/context-menu access on Actor Cards? | Draft | `INT-01-02` | no | `INT-01`, `A11Y-01` |
| `INT-01-04` | What is the global Escape/Back priority across targeting, expanded UI, panes, modals, full sheet, and Play? | Draft | `UX-03-03` | no | `INT-01`, `INT-02`, `A11Y-01` |
| `INT-01-05` | Which common actions are direct controls vs secondary/contextual commands? | Draft | `UX-01-04`, `UX-03-06` | no | `INT-01`, `CMP-01` |
| `INT-01-06` | How are unavailable/invalid reasons exposed for pointer, keyboard, and focus users? | Draft | `UX-01-05`, `ORIGIN-UX-01-19` | no | `INT-01`, `CONTENT-01`, `A11Y-01` |
| `INT-01-07` | What selection model distinguishes controlled Actor, current turn, targetable, selected target, contextual focus? | Draft | `UX-02-03`, `ORIGIN-UX-01-19` | no | `INT-01`, `UI-03`, `CMP-01` |

---

# STATE-01 — UI States

**Scope:** default/hover/focus/selected/disabled/pending/empty/no-results/validation/feedback states.

**Non-scope:** app/network lifecycle, rules legality, authority semantics, exact visual tokens.

**Exit Criteria:** common state vocabulary, validation, stale selection recovery, feedback placement, duplicate-submit protection are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `STATE-01-01` | What reusable interactive-state vocabulary must all controls support where applicable? | Draft | none | no | `STATE-01`, `CMP-01` |
| `STATE-01-02` | How do Disabled, Unavailable, Pending, Selected, and Current differ semantically? | Draft | `UX-01-05` | no | `STATE-01`, `CONTENT-01` |
| `STATE-01-03` | When must a disabled/unavailable state expose an explicit reason? | Draft | `INT-01-06` | no | `STATE-01`, `R8-DISABLED-REASON` |
| `STATE-01-04` | What is the default pattern for empty state vs no search results? | Draft | none | no | `STATE-01`, `R6-EMPTY`, `R6-NO-RESULTS` |
| `STATE-01-05` | What validation severity/presentation states exist for forms/import/builders? | Draft | none | no | `STATE-01`, `R5-FIELD-VALIDATION`, `R4-IMPORT-REVIEW` |
| `STATE-01-06` | How should local selection recover when canonical state invalidates the selected action/target/item? | Draft | `UX-01-05` | no | `STATE-01`, `DND-03` |
| `STATE-01-07` | When should feedback use inline message, toast, persistent banner, or durable Activity entry? | Draft | `UX-03-08` | no | `STATE-01`, `STATE-02`, `CONTENT-01` |
| `STATE-01-08` | How are pending operations protected against duplicate submission while unrelated controls remain usable? | Draft | `ORIGIN-UX-01-21` | no | `STATE-01`, `DND-03` |

---

# STATE-02 — System States

**Scope:** bootstrap, save failure, unsupported, disconnect/reconnect, incompatibility, permission, stale/reconciliation, blocking/recoverable errors.

**Non-scope:** network protocol/schema, domain calculations, exact copy.

**Exit Criteria:** taxonomy, recovery principles, blocking/recoverable distinction and placement are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `STATE-02-01` | What does the user see during app bootstrap/restore before product state is ready? | Draft | `UX-01-03` | no | `STATE-02`, `R6-INITIAL-LOAD` |
| `STATE-02-02` | What is the required recovery contract when durable Character/content saving fails? | Draft | `UX-01-03` | no | `STATE-02`, `R6-SAVE-FAILURE` |
| `STATE-02-03` | How is unsupported content/mechanic distinguished from a generic error? | Draft | none | no | `STATE-02`, `R6-UNSUPPORTED`, `CONTENT-02` |
| `STATE-02-04` | How do reconnecting, disconnected, and unrecoverable connection states differ? | Draft | `UX-01-03` | no | `STATE-02`, `SES-02`, `R5-CONNECTION-RECOVERY` |
| `STATE-02-05` | How is session/content incompatibility presented and what recovery actions are allowed? | Draft | none | no | `STATE-02`, `SES-02`, `R6-INCOMPATIBLE` |
| `STATE-02-06` | How is permission/authority denial shown without leaking unauthorized information? | Draft | `UX-02-08`, `ORIGIN-UX-01-29` | no | `STATE-02`, `SES-02`, `R6-PERMISSION` |
| `STATE-02-07` | How is stale/reconciliation state surfaced while canonical state is restored? | Draft | `UX-01-03` | no | `STATE-02`, `SES-02`, `R6-STALE` |
| `STATE-02-08` | What distinguishes recoverable local error, blocking task error, and global/system blocker? | Draft | `STATE-01-07` | no | `STATE-02`, `CONTENT-01` |
| `STATE-02-09` | How is content/session presentation persistence degradation surfaced? | Draft | `STATE-02-02` | no | `STATE-02`, `CONTENT-02` |

---

# INT-02 — Layering

**Scope:** inline/popover/pane/drawer/modal/full-workspace/resolution/interrupt/handout/session-utility layering.

**Non-scope:** topology decisions, exact z-index/timing, authority semantics.

**Exit Criteria:** layer types, modality, stack priority, dismiss/focus rules, Full Sheet/Handout/resolution coexistence are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `INT-02-01` | What layer categories does SimpleVTT support and what makes each distinct? | Draft | `UX-03-03` | no | `INT-02`, `R4-DRAWER`, `R4-POPOVER` |
| `INT-02-02` | Which layer categories are modal vs nonmodal? | Draft | `INT-02-01` | no | `INT-02`, `A11Y-01` |
| `INT-02-03` | What stack priority applies when utility, full sheet, handout, resolution, interrupt, confirmation compete? | Draft | `INT-02-01` | no | `INT-02`, `SES-01`, `DND-02` |
| `INT-02-04` | What default outside-click, Escape, close, and focus-return rules apply per layer category? | Draft | `INT-02-01`, `INT-01-04` | no | `INT-02`, `A11Y-01` |
| `INT-02-05` | May multiple contextual Session/DM panes remain open simultaneously? | Draft | `NAV-01-05` | no | `INT-02`, `SES-01`, `DM-01` |
| `INT-02-06` | How does Full Character Sheet coexist with ongoing Play/session state and utilities? | Draft | `UX-01-03`, `UX-03-02` | no | `INT-02`, `R4-FULL-SHEET-LAYER` |
| `INT-02-07` | Which Handout behaviors use general layer rules vs SES-specific rules? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `INT-02`, `SES-01` |
| `INT-02-08` | How does resolution/result suppress or coexist with unrelated interaction layers? | Draft | `ORIGIN-UX-01-21` | no | `INT-02`, `DND-02`, `DND-03` |

---

# INT-03 — Confirmation

**Scope:** confirmation necessity, destructive/unsaved/cancel grammar, session leave/end, Character changes, imports, adjudication/Undo, targeting.

**Non-scope:** exact copy, domain legality, final dialog styling.

**Exit Criteria:** confirmation policy is explicit for material/irreversible actions while known no-confirm paths remain frictionless.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `INT-03-01` | What principle determines whether an action requires explicit confirmation? | Draft | none | no | `INT-03`, `R4-CONFIRM` |
| `INT-03-02` | Which Character create/edit/level-up exits require unsaved-change confirmation? | Draft | `INT-03-01` | no | `INT-03`, `DND-01`, `R4-UNSAVED` |
| `INT-03-03` | What confirmation/consequence model applies when a Player leaves a live session? | Draft | `INT-03-01`, `UX-01-03` | no | `INT-03`, `SES-01` |
| `INT-03-04` | What confirmation/consequence model applies when a Host ends a session? | Draft | `INT-03-01` | no | `INT-03`, `SES-01`, `R4-DESTRUCTIVE` |
| `INT-03-05` | Which import/install/remove actions require preview only vs explicit confirmation? | Draft | `INT-03-01` | no | `INT-03`, `CONTENT-02` |
| `INT-03-06` | Which DM adjudication/Undo operations require confirmation before authoritative mutation? | Draft | `INT-03-01` | no | `INT-03`, `DM-02` |
| `INT-03-07` | How do Cancel, Back, Retry, and Close differ for pending or failed operations? | Draft | `STATE-01-08`, `STATE-02-08` | no | `INT-03`, `CONTENT-01` |
| `INT-03-08` | Does manual movement-reaction declaration require a final confirmation beyond explicit Submit? | Draft | `INT-03-01`, `R4-MOVEMENT-REACTION-INPUT` | no | `INT-03`, `DND-04` |

`ORIGIN-UX-01-20` is a Reviewed DND-03 seed and is referenced by this sheet's confirmation policy; it is not duplicated as a second Decision Map row here.

---

# UI-02 — Typography

**Scope:** type hierarchy for pages, Play HUD, Character surfaces, forms, numeric/stat data, bilingual/source metadata.

**Non-scope:** color, spacing, icons, copy wording.

**Exit Criteria:** hierarchy, dense Play readability, numeric presentation, Korean/English/source treatment and truncation rules are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-02-01` | What product-wide type hierarchy is used? | Draft | none | no | `UI-02` |
| `UI-02-02` | What typography hierarchy is used for dense Play HUD/Command Center information? | Draft | `UX-03-04` | no | `UI-02`, `DND-03` |
| `UI-02-03` | How are stats, dice notation, modifiers, DC/AC, HP, resources, initiative numbers distinguished? | Draft | none | no | `UI-02`, `DND-02`, `DND-03` |
| `UI-02-04` | How should Korean labels, English names, and provenance metadata coexist? | Draft | none | no | `UI-02`, `CONTENT-01` |
| `UI-02-05` | What wrapping/truncation rule applies to long names? | Draft | none | no | `UI-02`, `CMP-01` |
| `UI-02-06` | Which text may compact on narrow desktop without losing essential meaning? | Draft | `PLATFORM-01-01` | no | `UI-02`, `PLATFORM-01` |
| `UI-02-07` | Which critical error/visibility/result text requires stronger emphasis? | Draft | `STATE-01-07` | no | `UI-02`, `CONTENT-01` |

---

# UI-03 — Color & Semantic Color

**Scope:** appearance/accent and semantic use for focus, selection, feedback, side/target, resources, privacy, results.

**Non-scope:** icon shape, typography, layout, rules meaning by color alone.

**Exit Criteria:** semantic meanings and non-color redundancies are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-03-01` | What appearance modes and accent-color customization are supported? | Draft | none | no | `UI-03`, `R1-SETTINGS` |
| `UI-03-02` | What are canonical semantic meanings of success/warning/error/info/disabled/pending colors? | Draft | `STATE-01-01` | no | `UI-03`, `STATE-01` |
| `UI-03-03` | How are focus, selection, current-turn, controlled Actor, targetable, selected-target states distinct? | Draft | `INT-01-07` | no | `UI-03`, `A11Y-01` |
| `UI-03-04` | How are ally/neutral/hostile relationships represented without color-only meaning? | Draft | `UX-03-04` | no | `UI-03`, `DND-04` |
| `UI-03-05` | How are Action/Bonus/Reaction/Movement and dynamic resources semantically colored? | Draft | `ORIGIN-UX-01-08` | no | `UI-03`, `DND-03` |
| `UI-03-06` | How is Public vs DM Only indicated continuously and unambiguously? | Draft | `ORIGIN-UX-01-27` | no | `UI-03`, `DM-01` |
| `UI-03-07` | How do result colors communicate outcomes without inventing rules meaning? | Draft | `DND-02-06` | no | `UI-03`, `DND-02` |
| `UI-03-08` | What contrast/forced-color principles constrain semantic colors? | Draft | none | no | `UI-03`, `A11Y-01` |

---

# UI-04 — Iconography

**Scope:** icon language and icon+label rules across action/economy/status/navigation/privacy/custom content.

**Non-scope:** exact artwork, color, spacing, behavior.

**Exit Criteria:** one icon language, accessible labeling and safe fallback are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-04-01` | What visual style defines SimpleVTT icons? | Draft | none | no | `UI-04` |
| `UI-04-02` | When may a control be icon-only vs icon+label/text? | Draft | none | no | `UI-04`, `CMP-01`, `A11Y-01` |
| `UI-04-03` | What icon family represents Action/Bonus/Reaction/Movement and resources? | Draft | `ORIGIN-UX-01-08` | no | `UI-04`, `DND-03` |
| `UI-04-04` | What icon family represents conditions/status and current-turn/initiative state? | Draft | `ORIGIN-UX-01-15` | no | `UI-04`, `DND-04` |
| `UI-04-05` | What icon family represents Product Shell and Session/DM utilities? | Draft | `NAV-01-01`, `NAV-01-05` | no | `UI-04`, `NAV-01` |
| `UI-04-06` | How is Public vs DM Only represented with redundant text/state? | Draft | `ORIGIN-UX-01-27` | no | `UI-04`, `DM-01` |
| `UI-04-07` | What fallback is used for custom/add-on actions without mapped icons? | Draft | `CONTENT-02-01` | no | `UI-04`, `CONTENT-02` |
| `UI-04-08` | How are tooltips/accessible names supplied for compact icons? | Draft | `UI-04-02` | no | `UI-04`, `A11Y-01` |

---

# UI-05 — Density & Spacing

**Scope:** density/spacing for Product, Play, Actor Cards, Character surfaces, forms, utilities, narrow reflow.

**Non-scope:** topology, typography hierarchy, breakpoint values.

**Exit Criteria:** density families and spacing token categories are defined without hiding core capabilities.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UI-05-01` | One density level or context-specific Product/Play density families? | Draft | `UX-01-02` | no | `UI-05` |
| `UI-05-02` | What may compact inside Command Center while core capabilities remain discoverable? | Draft | `UX-01-04`, `ORIGIN-UX-01-09` | no | `UI-05`, `DND-03` |
| `UI-05-03` | What compactness rules apply to Actor Cards and Initiative entries? | Draft | `ORIGIN-UX-01-15`, `ORIGIN-UX-01-19` | no | `UI-05`, `DND-04` |
| `UI-05-04` | What density relationship applies across Character Library, Builder, Sheet, Level Up? | Draft | `UX-03-05` | no | `UI-05`, `DND-01` |
| `UI-05-05` | What spacing token categories are required? | Draft | none | no | `UI-05`, `CMP-01` |
| `UI-05-06` | How should contextual panes/dialogs balance density and scanability? | Draft | `INT-02-01` | no | `UI-05`, `INT-02` |
| `UI-05-07` | What may compress/reflow on narrow desktop while preserving usable targets? | Draft | `PLATFORM-01-01` | no | `UI-05`, `PLATFORM-01`, `A11Y-01` |

---

# CMP-01 — Core Components

**Scope:** buttons, tabs, toggles, search/filter, cards, Command Center/Hotbar, economy/resources, Initiative, status, utilities, file/import controls.

**Non-scope:** page/business/rules logic and final topology.

**Exit Criteria:** shared component boundaries/states/accessibility/responsive expectations are defined without domain calculation.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CMP-01-01` | What variants/states belong to Button family? | Draft | `STATE-01-01` | no | `CMP-01`, `R7-BUTTON` |
| `CMP-01-02` | What shared contract governs tabs/segmented/toggle controls? | Draft | `STATE-01-01` | no | `CMP-01`, `R7-TABS`, `R7-SEGMENTED`, `R7-TOGGLE` |
| `CMP-01-03` | What shared contract governs search/filter/no-results patterns? | Draft | `STATE-01-04` | no | `CMP-01`, `R7-SEARCH`, `R7-FILTER` |
| `CMP-01-04` | What reusable information/action contract defines Character Card? | Draft | `DND-01-01` | no | `CMP-01`, `R7-CHAR-CARD` |
| `CMP-01-05` | What reusable state/interaction contract defines Actor Card? | Draft | `ORIGIN-UX-01-16`, `ORIGIN-UX-01-19` | no | `CMP-01`, `R7-ACTOR-CARD` |
| `CMP-01-06` | What boundary separates Command Center, Hotbar pages/slots, Economy, Resource Rail? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-09` | no | `CMP-01`, `R7-COMMAND-CENTER`, `R7-HOTBAR-SLOT` |
| `CMP-01-07` | What reusable contract defines Initiative Entry/current-turn state? | Draft | `ORIGIN-UX-01-15` | no | `CMP-01`, `R7-INITIATIVE-ENTRY` |
| `CMP-01-08` | What shared pane/header/close/focus contract applies to Session/DM utilities? | Draft | `INT-02-01` | no | `CMP-01`, `R4-QUICK-SHEET`, `R4-SESSION-RULES`, `R4-PARTICIPANTS` |
| `CMP-01-09` | What shared contract defines status, connection, warning and persistent indicators? | Draft | `STATE-01-07`, `STATE-02-08` | no | `CMP-01`, `R5-STATUS`, `R7-CONNECTION-STATUS` |
| `CMP-01-10` | What shared contract defines file input + preview + validation + install/save? | Draft | `STATE-01-05` | no | `CMP-01`, `R4-FILE-PICKER`, `R4-IMPORT-REVIEW` |
| `CMP-01-11` | What prevents UI components from duplicating/calculating domain/rules state? | Draft | `UX-01-05` | no | `CMP-01` |

---

# CONTENT-01 — UX Writing

**Scope:** terminology, action labels, errors, empty/disabled reasons, confirmation, connection/privacy/result/onboarding language, bilingual/source metadata.

**Non-scope:** rules text, localization architecture, typography.

**Exit Criteria:** core nouns, verb grammar, message anatomy, privacy/result/connection terminology are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CONTENT-01-01` | What user-facing terms distinguish Character, Actor, Combatant, Player, DM, Session, Scene, Encounter, Play? | Draft | `UX-02-01`, `UX-02-03` | no | `CONTENT-01`, `R8-ACTION-LABELS` |
| `CONTENT-01-02` | What verb grammar should primary actions use? | Draft | none | no | `CONTENT-01`, `R8-ACTION-LABELS` |
| `CONTENT-01-03` | What information anatomy must an error message contain? | Draft | `STATE-02-08` | no | `CONTENT-01`, `R8-ERROR-COPY` |
| `CONTENT-01-04` | What information anatomy must empty/no-results messages contain? | Draft | `STATE-01-04` | no | `CONTENT-01`, `R8-EMPTY-COPY` |
| `CONTENT-01-05` | How are canonical unavailable/disabled reasons phrased? | Draft | `INT-01-06` | no | `CONTENT-01`, `R8-DISABLED-REASON` |
| `CONTENT-01-06` | What grammar distinguishes normal/destructive confirmation, cancel, retry, close? | Draft | `INT-03-01`, `INT-03-07` | no | `CONTENT-01`, `R8-CONFIRM-COPY`, `R8-DESTRUCTIVE-COPY` |
| `CONTENT-01-07` | What terms represent Public vs DM Only and later disclosure? | Draft | `ORIGIN-UX-01-26`, `ORIGIN-UX-01-28` | no | `CONTENT-01`, `R8-VISIBILITY` |
| `CONTENT-01-08` | What vocabulary distinguishes roll, total, outcome, effect, state change, adjudication, Undo? | Draft | `ORIGIN-UX-01-22` | no | `CONTENT-01`, `R8-RESULT-TERMS` |
| `CONTENT-01-09` | What connection/reconnect/disconnect/rejoin/leave terminology is consistent? | Draft | `STATE-02-04` | no | `CONTENT-01`, `R8-CONNECTION` |
| `CONTENT-01-10` | What is the tone/scope of first-use guidance? | Draft | `NAV-01-07` | no | `CONTENT-01`, `R8-ONBOARDING` |
| `CONTENT-01-11` | How are Korean labels, English names, source/provenance, IDs and addresses presented? | Draft | `UI-02-04` | no | `CONTENT-01`, `UI-02` |

---

# A11Y-01 — Accessibility

**Scope:** keyboard, focus, semantics, announcements, reduced motion, color independence, image alternatives, zoom/text scaling.

**Non-scope:** exact visual token values or domain rules.

**Exit Criteria:** material actions are keyboard reachable; focus/status/targeting/dice/image/zoom accessibility requirements are explicit.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `A11Y-01-01` | What product-wide keyboard navigation and visible-focus standard applies? | Draft | none | no | `A11Y-01`, `M4` |
| `A11Y-01-02` | What focus trap/initial-focus/return rules apply by layer category? | Draft | `INT-02-01`, `INT-02-04` | no | `A11Y-01`, `M4` |
| `A11Y-01-03` | What semantic/keyboard model applies to Actor Cards, targeting and context menu? | Draft | `INT-01-01`, `INT-01-03`, `INT-01-07` | no | `A11Y-01`, `R7-ACTOR-CARD` |
| `A11Y-01-04` | What semantic/keyboard model applies to Hotbar/Command Center and targeting cancel? | Draft | `DND-03-01` | no | `A11Y-01`, `R7-COMMAND-CENTER` |
| `A11Y-01-05` | Which loading/error/reconnect/result/interrupt changes use status vs alert/live announcements? | Draft | `STATE-01-07`, `STATE-02-04` | no | `A11Y-01`, `STATE-02` |
| `A11Y-01-06` | What reduced-motion equivalent is required for dice, VFX, overlays and result reveal? | Draft | `ORIGIN-UX-01-25`, `R9-COMBAT-VFX` | no | `A11Y-01`, `R9-REDUCED-MOTION` |
| `A11Y-01-07` | How are target, side, status, DM-only and semantic states conveyed without color alone? | Draft | `UI-03-03`, `UI-03-04`, `UI-03-06` | no | `A11Y-01`, `UI-03` |
| `A11Y-01-08` | What alt/description and zoom/pan accessibility applies to portraits and handouts? | Draft | `DND-01-08`, `SES-01-08` | no | `A11Y-01`, `R4-PLAYER-HANDOUT-VIEWER`, `R4-PORTRAIT-EDITOR` |
| `A11Y-01-09` | What text scaling/zoom behavior must Product, Sheet and Play preserve? | Draft | `PLATFORM-01-01` | no | `A11Y-01`, `PLATFORM-01` |
| `A11Y-01-10` | Which compact/icon controls require labels, accessible names or discoverable help? | Draft | `UI-04-02`, `UI-04-08` | no | `A11Y-01`, `UI-04` |

---

# PLATFORM-01 — Desktop Responsive

**Scope:** wide/normal/narrow desktop reflow for Product, Play, Actor Boards, Command Center, utilities, Character, handouts and dice.

**Non-scope:** mobile product scope unless explicitly approved; numeric breakpoints before token/layout review.

**Exit Criteria:** desktop width classes and safe reflow are defined while core anchors/actions remain reachable.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `PLATFORM-01-01` | What desktop width classes does v1 support, and is mobile/touch-first out of scope? | Draft | none | no | `PLATFORM-01`, `M5` |
| `PLATFORM-01-02` | How does Product Shell primary navigation reflow? | Draft | `NAV-01-01`, `UI-01-01` | no | `PLATFORM-01`, `R7-PRIMARY-NAV` |
| `PLATFORM-01-03` | How does Play Dual Anchor reflow while keeping both anchors co-primary? | Draft | `UX-01-07`, `UI-01-02` | no | `PLATFORM-01`, `R1-PLAY` |
| `PLATFORM-01-04` | How do Actor Boards and Initiative Tracker reflow? | Draft | `UI-01-03`, `UI-01-04` | no | `PLATFORM-01`, `DND-04` |
| `PLATFORM-01-05` | How does Command Center/Hotbar/Economy/Resource Rail preserve reachability? | Draft | `UI-01-05`, `UI-05-02` | no | `PLATFORM-01`, `DND-03` |
| `PLATFORM-01-06` | How do contextual utility rail/panes transform? | Draft | `UI-01-06` | no | `PLATFORM-01`, `R7-SESSION-UTILITY-RAIL` |
| `PLATFORM-01-07` | How do Character Sheet, Builder, Level Up and Full Sheet reflow? | Draft | `UI-01-07`, `UI-01-08` | no | `PLATFORM-01`, `DND-01` |
| `PLATFORM-01-08` | How do Handout modes and zoom/pan behave on narrow desktop? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `PLATFORM-01`, `SES-01` |
| `PLATFORM-01-09` | How does physical dice/result presentation adapt without obscuring essential actions? | Draft | `ORIGIN-UX-01-23`, `ORIGIN-UX-01-25` | no | `PLATFORM-01`, `DND-02` |

---

# DND-01 — Character Presentation

**Scope:** Library, Builder/import/edit, Sheet, standalone rolling, layout choice, portrait, Level Up, validation/recovery.

**Non-scope:** D&D rules calculations, connected Actor authority, Session join policy, final styling.

**Exit Criteria:** Library/Builder/Sheet/roll/portrait/level-up/import/empty states are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `DND-01-01` | What information/actions must Character Library cards expose? | Draft | `UX-03-05` | no | `DND-01`, `R7-CHAR-CARD` |
| `DND-01-02` | What Character Builder modes and top-level step structure are first-class? | Draft | `UX-01-01` | no | `DND-01`, `R3-BUILDER-GUIDED`, `R3-BUILDER-QUICK`, `R3-BUILDER-IMPORT`, `R3-BUILDER-EDIT` |
| `DND-01-03` | How are dependent choices surfaced without hidden rule logic? | Draft | `DND-01-02` | no | `DND-01`, `CMP-01` |
| `DND-01-04` | What happens when create/edit/import exits with unsaved changes? | Draft | `INT-03-02` | no | `DND-01`, `R4-UNSAVED` |
| `DND-01-05` | What is the standalone Character Sheet information/action hierarchy? | Draft | `UX-03-05` | no | `DND-01`, `R1-CHAR-SHEET` |
| `DND-01-06` | Does v1 productize one Sheet layout, multiple selectable layouts, or migration? | Draft | `DND-01-05` | no | `DND-01`, `R3-SHEET-SIMPLEVTT`, `R3-SHEET-OFFICIAL` |
| `DND-01-07` | What is the standalone Character Sheet roll interaction/result model? | Draft | `UX-01-01` | no | `DND-01`, `DND-02`, `R2-STANDALONE-ROLL` |
| `DND-01-08` | What portrait add/edit/remove/focal-point experience is supported and where does data belong? | Draft | `DND-01-05` | no | `DND-01`, `R4-PORTRAIT-EDITOR`, `M3` |
| `DND-01-09` | What Level Up stages, preview, choices, commit and cancel/recovery model are required? | Draft | `DND-01-05` | no | `DND-01`, `R2-LEVEL-UP` |
| `DND-01-10` | How does Character import recover from unsupported/missing/invalid fields? | Draft | `STATE-01-05`, `STATE-02-03` | no | `DND-01`, `R4-IMPORT-REVIEW` |
| `DND-01-11` | What is the empty/no-Character experience outside Join? | Draft | `NAV-01-03` | no | `DND-01`, `STATE-01` |
| `DND-01-12` | Which Character actions remain available while that Character is linked to an active Session? | Draft | `UX-01-03`, `UX-02-03` | no | `DND-01`, `SES-01` |

---

# DND-02 — Roll & Dice UX

**Scope:** authoritative-result presentation, physical dice, result feedback, timing/VFX/reduced motion/fallback, Activity handoff, concentration/save variants.

**Non-scope:** rules calculation, RNG authority, DM visibility protocol, arbitrary timing budgets.

**Exit Criteria:** Reviewed dice authority decisions are preserved and remaining result/reveal/fallback/variant behavior is explicit.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-22` | Should result feedback stay scene-integrated with durable detail through Activity? | Reviewed | `UX-01-07` | no | `DND-02`, `DM-02` |
| `ORIGIN-UX-01-22A` | Should physical dice throw/roll/settle on tabletop plane? | Reviewed | `ORIGIN-UX-01-22` | no | `DND-02` |
| `ORIGIN-UX-01-23` | Is the broad central table/scene the Roll Area? | Reviewed | `ORIGIN-UX-01-22A` | no | `DND-02` |
| `ORIGIN-UX-01-24` | Does authoritative result exist before dice settle to the final face? | Reviewed | none | no | `DND-02` |
| `ORIGIN-UX-01-25` | May fine dice trajectories be client-local while canonical dice/result are shared? | Reviewed | `ORIGIN-UX-01-24`, `ORIGIN-UX-01-26` | no | `DND-02`, `SES-02` |
| `DND-02-01` | What appears in immediate result feedback vs Activity detail? | Draft | `ORIGIN-UX-01-22` | no | `DND-02`, `R5-ROLL-RESULT` |
| `DND-02-02` | How should standalone Character rolls differ from connected shared rolls? | Draft | `DND-01-07`, `ORIGIN-UX-01-24` | no | `DND-02`, `R5-STANDALONE-ROLL-RESULT` |
| `DND-02-03` | What is the reveal sequence from roll start through outcome/state changes? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `R9-RESULT-REVEAL` |
| `DND-02-04` | What visual fallback occurs if 3D dice/VFX cannot render? | Draft | `ORIGIN-UX-01-25` | no | `DND-02`, `STATE-02` |
| `DND-02-05` | How does reduced motion preserve information/order? | Draft | `ORIGIN-UX-01-25` | no | `DND-02`, `A11Y-01` |
| `DND-02-06` | What treatment applies to natural-20/natural-1/ordinary outcomes without inventing rules meaning? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `UI-03` |
| `DND-02-07` | What relationship does combat delivery/impact VFX have to dice/result sequencing? | Draft | `DND-02-03` | no | `DND-02`, `R9-COMBAT-VFX` |
| `DND-02-08` | What controls may skip/advance/dismiss presentation without changing authoritative result? | Draft | `ORIGIN-UX-01-24` | no | `DND-02`, `INT-02` |
| `DND-02-09` | How are multiple dice, advantage/disadvantage, saves, concentration saves, damage components and legacy aggregates presented? | Draft | `DND-02-03` | no | `DND-02`, `CMP-01`, `R4-CONCENTRATION-SAVE` |

---

# DND-03 — Action UX

**Scope:** capability/Hotbar, economy/resources, default attack, targeting, invalid reasons, multi-target execution, cancel, resolution-safe interaction.

**Non-scope:** UI rules calculation or heuristic domain relations.

**Exit Criteria:** Reviewed capability/targeting seeds are preserved and remaining grouping/customization/detail/cancel/contract gaps are resolved or explicit.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-07` | What persistent Hotbar page family is required? | Reviewed | `UX-01-04`, `UX-01-06` | no | `DND-03` |
| `ORIGIN-UX-01-08` | What fixed economy indicators and dynamic Resource Rail are required? | Reviewed | `UX-01-04` | no | `DND-03` |
| `ORIGIN-UX-01-17` | What default action does a valid hostile click invoke with no selected targeting action? | Reviewed | `ORIGIN-UX-01-16` | no | `DND-03` |
| `ORIGIN-UX-01-18` | Is smart fallback prohibited when canonical Main Hand default is unavailable? | Reviewed | `ORIGIN-UX-01-17` | no | `DND-03` |
| `ORIGIN-UX-01-19` | How are valid/invalid targets presented and who computes eligibility? | Reviewed | `UX-01-05` | no | `DND-03` |
| `ORIGIN-UX-01-20` | How do single-target and multi-target actions execute? | Reviewed | `ORIGIN-UX-01-19` | no | `DND-03`, `INT-03` |
| `ORIGIN-UX-01-21` | Does resolution keep Command Center visible and lock only conflicting interactions? | Reviewed | `UX-01-07` | no | `DND-03`, `INT-02` |
| `DND-03-01` | What exact capability grouping/page contents appear? | Draft | `ORIGIN-UX-01-07` | no | `DND-03`, `R7-HOTBAR-TABS` |
| `DND-03-02` | What Hotbar customization operations are supported and what may discovery never overwrite? | Draft | `UX-01-06`, `ORIGIN-UX-01-07` | no | `DND-03`, `R7-HOTBAR-SLOT` |
| `DND-03-03` | What information is visible on Hotbar Slot vs hover/focus/detail? | Draft | `UX-01-04`, `UX-03-06` | no | `DND-03`, `CMP-01` |
| `DND-03-04` | How are unavailable actions/resources/costs shown without hiding capability? | Draft | `ORIGIN-UX-01-08`, `ORIGIN-UX-01-18` | no | `DND-03`, `CONTENT-01` |
| `DND-03-05` | How does a user cancel selected capability/targeting without losing unrelated context? | Draft | `INT-01-04` | no | `DND-03`, `STATE-01` |
| `DND-03-06` | What target-selection feedback appears on Actor Cards? | Draft | `ORIGIN-UX-01-19`, `ORIGIN-UX-01-20` | no | `DND-03`, `R7-ACTOR-CARD` |
| `DND-03-07` | How are no-target/self-target actions executed? | Draft | `ORIGIN-UX-01-20` | no | `DND-03` |
| `DND-03-08` | What canonical relation provides Main Hand executable default action? | Draft | `ORIGIN-UX-01-17` | no | `DND-03`, `GAP-MAIN-HAND-CANONICAL-RELATION` |
| `DND-03-09` | Which interactions remain safe vs conflicting during resolution/interrupt stages? | Draft | `ORIGIN-UX-01-21` | no | `DND-03`, `GAP-RESOLUTION-SAFE-INTERACTIONS` |
| `DND-03-10` | Where is Rules/detail access available from action UI? | Draft | `UX-01-04`, `NAV-01-05` | no | `DND-03`, `CONTENT-02` |

---

# DND-04 — Combat UX

**Scope:** Initiative, turn/off-turn, end turn, interrupt/reaction, manual movement reaction, combat VFX, entry/exit.

**Non-scope:** initiative calculation, reaction legality, movement rules, authoritative turn engine.

**Exit Criteria:** Initiative seeds, turn presentation, reactions, combat transitions and VFX relationship are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-14` | Does Initiative preserve Actor Boards and add a top horizontal tracker? | Reviewed | `UX-01-07` | no | `DND-04` |
| `ORIGIN-UX-01-15` | What information belongs in compact Initiative Tracker entry? | Reviewed | `ORIGIN-UX-01-14` | no | `DND-04` |
| `DND-04-01` | How does user enter Initiative and what UI changes immediately? | Draft | `ORIGIN-UX-01-14` | no | `DND-04`, `SES-01` |
| `DND-04-02` | How are current turn, controlled Actor, order, round and off-turn state distinguished? | Draft | `ORIGIN-UX-01-15`, `UX-02-03` | no | `DND-04`, `UI-03` |
| `DND-04-03` | Where/when is End Turn / Next Turn available for Player and DM? | Draft | `UX-02-05` | no | `DND-04`, `SES-02` |
| `DND-04-04` | What interactions remain available when it is not user's turn? | Draft | `DND-03-09`, `UX-02-03` | no | `DND-04`, `DND-03` |
| `DND-04-05` | What is the UI model for Reaction/Interrupt prompt, response, timeout/no-timeout and return? | Draft | `R3-INTERRUPT`, `GAP-RESOLUTION-SAFE-INTERACTIONS` | no | `DND-04`, `R4-REACTION-PROMPT` |
| `DND-04-06` | Is manual movement-reaction input first-class and who may invoke it? | Draft | `UX-02-03`, `UX-02-05` | no | `DND-04`, `R4-MOVEMENT-REACTION-INPUT` |
| `DND-04-07` | What combat entry/round/turn transition feedback is shown? | Draft | `ORIGIN-UX-01-14` | no | `DND-04`, `R5-STATUS` |
| `DND-04-08` | How does combat VFX relate to Actor positions/cards, result reveal and reduced motion? | Draft | `DND-02-07`, `A11Y-01-06` | no | `DND-04`, `R9-COMBAT-VFX` |
| `DND-04-09` | How is Initiative exited, and does ending it require confirmation? | Draft | `INT-03-01` | no | `DND-04`, `INT-03` |

---

# SES-01 — Session UX

**Scope:** Host/Join, Character Select, lobby/readiness, Play composition, Command Center/Actor Boards, handouts, utilities, identity/status, leave/end/reconnect-visible continuity.

**Non-scope:** wire protocol, private-delivery schema, domain combat rules, final DM authority semantics.

**Exit Criteria:** lifecycle/task flows, Reviewed Play/Handout seeds, utility topology, identity, leave/end and reconnect-visible behavior are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-FLOW-02` | Does Join include Character Select before lobby/live Play without universal Character prerequisite? | Reviewed | `ORIGIN-FLOW-01` | no | `SES-01` |
| `ORIGIN-UX-01-09` | What content belongs in bottom Command Center? | Reviewed | `UX-01-07` | no | `SES-01`, `DND-03` |
| `ORIGIN-UX-01-10` | Does Freeform use lower Player/Allied Actor Board instead of permanent side portrait rail? | Reviewed | `UX-01-07` | no | `SES-01` |
| `ORIGIN-UX-01-11` | Does Freeform also use upper NPC/Neutral/Hostile Actor Board? | Reviewed | `ORIGIN-UX-01-10` | no | `SES-01` |
| `ORIGIN-UX-01-12` | What Handout presentation modes are supported and is mode shared/restored? | Reviewed | `UX-01-03` | no | `SES-01`, `SES-02` |
| `ORIGIN-UX-01-13` | Which Handout modes may Player dismiss/reopen locally? | Reviewed | `ORIGIN-UX-01-12` | no | `SES-01` |
| `SES-01-01` | What fields/actions belong in direct Host Setup? | Draft | `ORIGIN-FLOW-01` | no | `SES-01`, `R2-HOST` |
| `SES-01-02` | What participant/readiness conditions are required before Host starts Play? | Draft | `UX-02-03` | no | `SES-01`, `SES-02` |
| `SES-01-03` | What fields/actions belong in direct Join Setup and Character Select? | Draft | `ORIGIN-FLOW-02` | no | `SES-01`, `R2-JOIN` |
| `SES-01-04` | What happens when Join has no valid Character available? | Draft | `ORIGIN-FLOW-02` | no | `SES-01`, `GAP-JOIN-NO-CHARACTER` |
| `SES-01-05` | What information/actions belong in Player Lobby/Ready? | Draft | `SES-01-02`, `SES-01-03` | no | `SES-01` |
| `SES-01-06` | What is complete Play Workspace composition in Freeform and Initiative? | Draft | `ORIGIN-UX-01-09`, `ORIGIN-UX-01-10`, `ORIGIN-UX-01-11`, `ORIGIN-UX-01-14` | no | `SES-01`, `UI-01` |
| `SES-01-07` | Which Quick Sheet, Full Sheet, Rules, Activity, Encounter, Participants, Session Share and connection utilities exist and where launch? | Draft | `NAV-01-05`, `INT-02-05` | no | `SES-01`, `R7-SESSION-UTILITY-RAIL` |
| `SES-01-08` | What UI realizes Handout Overlay/Upper/Full including close/reopen/zoom/pan? | Draft | `ORIGIN-UX-01-12`, `ORIGIN-UX-01-13` | no | `SES-01`, `R4-DM-HANDOUT-PANE`, `R4-PLAYER-HANDOUT-VIEWER` |
| `SES-01-09` | How are Session identity, Character/Actor identity, connection state and current mode presented? | Draft | `UX-02-01`, `UX-02-03` | no | `SES-01`, `R7-SESSION-IDENTITY`, `R7-CONNECTION-STATUS` |
| `SES-01-10` | What is normal Freeform experience with no connected Players and/or no Combatants? | Draft | `SES-01-06` | no | `SES-01`, `STATE-01` |
| `SES-01-11` | What flow applies when Player leaves vs Host ends a session? | Draft | `INT-03-03`, `INT-03-04` | no | `SES-01`, `R2-LEAVE`, `R2-END-SESSION` |
| `SES-01-12` | What user-visible continuity must be restored after reconnect before interaction resumes? | Draft | `UX-01-03`, `STATE-02-04` | no | `SES-01`, `SES-02` |

---

# SES-02 — Multiplayer Authority UX

**Scope:** role-scoped visibility/delivery/control/disclosure, reconnect/reconciliation, compatibility, Handout shared state, DM-only delivery, authorization denial.

**Non-scope:** low-level transport implementation except where a required architecture contract is identified.

**Exit Criteria:** role dependencies, private delivery/disclosure, Handout/reconnect contracts and safe authorization UX are explicit or blocked by named contracts.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-26` | Does roll visibility include Public and DM Only with no secret details delivered to Player? | Reviewed | `UX-02-08` | no | `SES-02` |
| `ORIGIN-UX-01-29` | Does DM Only leave no Player-side existence metadata until disclosure? | Reviewed | `ORIGIN-UX-01-26` | no | `SES-02` |
| `SES-02-01` | How do Play Role and Connection Role combine into effective authority context? | Draft | `UX-02-01`, `UX-02-02` | no | `SES-02`, `M1` |
| `SES-02-02` | What commands/data may Player vs DM see, receive, control and mutate? | Draft | `UX-02-03`, `UX-02-04`, `UX-02-05` | no | `SES-02`, `M1` |
| `SES-02-03` | What event/projection contract implements DM-only roll/adjudication with zero Player leakage? | Draft | `ORIGIN-UX-01-26`, `ORIGIN-UX-01-29` | no | `SES-02`, `GAP-DM-ONLY-DELIVERY-PROTOCOL` |
| `SES-02-04` | What later-disclosure projection is emitted for full adjudication vs result-only reveal? | Draft | `ORIGIN-UX-01-28`, `SES-02-03` | no | `SES-02`, `DM-02` |
| `SES-02-05` | What shared Handout presentation state/projection/reconnect contract supports modes? | Draft | `ORIGIN-UX-01-12` | no | `SES-02`, `GAP-HANDOUT-NETWORK-CONTRACT` |
| `SES-02-06` | What session state/event cursor is restored on reconnect and how is stale state reconciled? | Draft | `UX-01-03`, `STATE-02-04`, `STATE-02-07` | no | `SES-02`, `M2`, `M3` |
| `SES-02-07` | How are incompatible versions detected and presented before unsafe Play? | Draft | `STATE-02-05` | no | `SES-02`, `R6-INCOMPATIBLE` |
| `SES-02-08` | How are unauthorized commands rejected without leaking private state? | Draft | `UX-02-08`, `STATE-02-06` | no | `SES-02`, `R6-PERMISSION` |
| `SES-02-09` | What participant connection/ready/identity information is role-visible/delivered? | Draft | `UX-02-07`, `UX-02-08` | no | `SES-02`, `R4-PARTICIPANTS` |
| `SES-02-10` | If live role switching is allowed, what reconciliation occurs at switch time? | Draft | `UX-02-06` | yes; only if allowed | `SES-02`, `M1`, `M3` |

---

# DM-01 — DM Controls

**Scope:** roll visibility, actor control, Encounter management, participants/session share, Handout, lifecycle controls, DM utility organization including current spatial relation evidence.

**Non-scope:** adjudication/Undo mechanics, delivery schema, rules calculations.

**Exit Criteria:** privacy toggle, Actor/Encounter/session/Handout controls, persistent indicators and utility organization are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-27` | Does DM Command Center expose persistent Public/DM Only control with strong indicator and no auto-switching? | Reviewed | `ORIGIN-UX-01-26` | no | `DM-01` |
| `DM-01-01` | What is initial Public/DM Only value and persistence lifetime? | Draft | `ORIGIN-UX-01-27` | no | `DM-01`, `GAP-DM-ROLL-VISIBILITY-PERSISTENCE` |
| `DM-01-02` | Where/how does DM switch selected/controlled Actor without confusing turn/target selection? | Draft | `UX-02-05`, `INT-01-01` | no | `DM-01`, `R4-ACTOR-CONTEXT` |
| `DM-01-03` | What Encounter management controls, including any explicit spatial-relation authoring, are available in preparation/Freeform/Initiative? | Draft | `UX-02-05`, `DND-04-01` | no | `DM-01`, `R4-ENCOUNTER`, `R4-DM-SPATIAL-RELATION` |
| `DM-01-04` | What participant/session-share controls belong in persistent vs contextual DM utilities? | Draft | `NAV-01-05`, `SES-01-07` | no | `DM-01`, `R4-PARTICIPANTS`, `R4-SESSION-SHARE` |
| `DM-01-05` | Where does Handout authoring/reveal/withdraw/mode control live? | Draft | `SES-01-08` | no | `DM-01`, `R4-DM-HANDOUT-PANE` |
| `DM-01-06` | Which lifecycle controls remain accessible during live Play and which require confirmation? | Draft | `SES-01-11` | no | `DM-01`, `INT-03` |
| `DM-01-07` | What DM-only persistent indicators remain visible while tools are closed? | Draft | `ORIGIN-UX-01-27`, `UX-02-07` | no | `DM-01`, `UI-03`, `UI-04` |
| `DM-01-08` | How is DM utility surface organized without becoming duplicate Command Center? | Draft | `UX-01-07`, `NAV-01-05` | no | `DM-01`, `UI-01`, `R4-DM-SPATIAL-RELATION` |

---

# DM-02 — Adjudication & Undo

**Scope:** adjudication/correction, Undo, private Activity, disclosure, audit/provenance, result detail.

**Non-scope:** rules calculations, low-level event schema, general DM navigation.

**Exit Criteria:** disclosure seed, private Activity, adjudication operations/scope/reason, Undo/correction and ordering are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `ORIGIN-UX-01-28` | May hidden roll later be disclosed as full adjudication or result-only without reroll? | Reviewed | `ORIGIN-UX-01-26` | no | `DM-02`, `SES-02` |
| `DM-02-01` | How does DM Activity present private rolls/adjudications before disclosure? | Draft | `ORIGIN-UX-01-26` | no | `DM-02`, `GAP-DM-PRIVATE-ACTIVITY-PRESENTATION`, `R4-ACTIVITY` |
| `DM-02-02` | Which adjudication operation categories are supported? | Draft | none | no | `DM-02`, `R4-ADJUDICATION` |
| `DM-02-03` | What scope/lifetime choices may adjudication have and how previewed? | Draft | `DM-02-02` | no | `DM-02`, `M3` |
| `DM-02-04` | Is reason/provenance required, optional or operation-dependent? | Draft | `DM-02-02` | no | `DM-02`, `CONTENT-01` |
| `DM-02-05` | What may Undo reverse, and what requires corrective adjudication? | Draft | `DM-02-02` | no | `DM-02`, `R2-DM-UNDO` |
| `DM-02-06` | What confirmation is required for adjudication/Undo by consequence/visibility? | Draft | `INT-03-06` | no | `DM-02`, `INT-03` |
| `DM-02-07` | Where/how does DM choose full-adjudication vs result-only disclosure? | Draft | `ORIGIN-UX-01-28`, `SES-02-04` | no | `DM-02`, `R2-DM-DISCLOSE` |
| `DM-02-08` | How is an already disclosed result corrected without erasing audit history? | Draft | `DM-02-05`, `DM-02-07` | no | `DM-02`, `R5-ACTIVITY-EVENT` |
| `DM-02-09` | What belongs in immediate result controls vs Activity detail for adjudicated/undone events? | Draft | `ORIGIN-UX-01-22` | no | `DM-02`, `R4-ACTIVITY-DETAIL`, `R4-ACTIVITY` |

---

# CONTENT-02 — Rules & Add-on UX

**Scope:** Rules Browser and Content/Add-on import/preview/validation/install/persistence/conflict/unsupported/update/remove/session-active behavior.

**Non-scope:** rules text, executable plugin architecture, domain semantics, general writing style.

**Exit Criteria:** rules lookup and content lifecycle/recovery/update/session policies are defined.

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `CONTENT-02-01` | What content categories/source metadata must Rules Browser expose/search? | Draft | none | no | `CONTENT-02`, `R1-RULES` |
| `CONTENT-02-02` | How do Search, Filter, no-results, Detail, related rules and return-to-results behave? | Draft | `CONTENT-02-01`, `STATE-01-04` | no | `CONTENT-02`, `R4-SESSION-RULES` |
| `CONTENT-02-03` | How is source/provenance/relationship information presented? | Draft | `CONTENT-02-01`, `UX-03-06` | no | `CONTENT-02`, `CONTENT-01` |
| `CONTENT-02-04` | What add-on import package/file types and support boundaries are productized? | Draft | none | no | `CONTENT-02`, `R7-FILE-INPUT` |
| `CONTENT-02-05` | What Preview/Validation information must be shown before install/activation? | Draft | `CONTENT-02-04`, `STATE-01-05` | no | `CONTENT-02`, `R4-IMPORT-REVIEW` |
| `CONTENT-02-06` | What validation severities block/warn/inform and how are conflicts represented? | Draft | `CONTENT-02-05` | no | `CONTENT-02`, `STATE-01`, `STATE-02` |
| `CONTENT-02-07` | What happens when imported content requests unsupported mechanics/extensions? | Draft | `STATE-02-03` | no | `CONTENT-02`, `R6-UNSUPPORTED` |
| `CONTENT-02-08` | What persistence/recovery applies after install or catalog-save failure? | Draft | `STATE-02-02`, `STATE-02-09` | no | `CONTENT-02`, `M3` |
| `CONTENT-02-09` | Does v1 support update/replace/remove/disable, and what happens to dependencies? | Draft | `CONTENT-02-08` | no | `CONTENT-02`, `INT-03` |
| `CONTENT-02-10` | How are Combatant imports unified with/distinguished from general Content import? | Draft | `CONTENT-02-04` | no | `CONTENT-02`, `R4-IMPORT-REVIEW` |
| `CONTENT-02-11` | How is active Session content shown, and which changes are allowed while live? | Draft | `SES-02-07` | no | `CONTENT-02`, `SES-01`, `R4-SESSION-SHARE` |

---

# Global Planning Gate — PASS

Route D preparation and audit are complete for the current planning/runtime snapshot.

```text
[x] R1-R9 Master UI Inventory cross-checked against active implementation entry graph, master-flow.md, made Decision Cards, generic non-route patterns, and active Planning Gaps.
[x] M1-M6 material coverage exists for every material Registry area; unresolved behavior is owned by a declared Draft Decision Map item or explicit Planning Gap rather than AI inference.
[x] All 27 governance sheets have complete predeclared T2 Decision Maps.
[x] Missing / Duplication / Coverage audit passes:
    [x] every Registry item has a governing sheet/contract owner;
    [x] every governance sheet has inventory/Decision-Map coverage;
    [x] no normative requirement has duplicate canonical authority;
    [x] material unresolved behavior is a declared Draft Decision Map item or explicit Planning Gap.
[x] Owner whole-product coverage checkpoint is prepared in the Dashboard and delivered with the gate-close update.
```

**Current sequential review: `UX-02`. Next decision: `UX-02-02`.**

Passing this gate does not Freeze any product decision and does not authorize implementation. It only means the planning corpus is sufficiently covered and internally routed to continue one-at-a-time owner review.

Do not append spontaneous questions. New material discoveries update the appropriate complete Decision Map or Planning Gap before they can become owner questions.