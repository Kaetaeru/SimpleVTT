# SimpleVTT UI/UX Planning and AI Implementation Framework

Status: canonical planning framework for pre-implementation UI/UX work

This document defines how SimpleVTT UI/UX decisions are planned, reviewed, changed, translated into AI implementation work, and verified.

It does **not** freeze any product UI decision by itself. Product decisions remain `Draft`, `Selected`, `Reviewed`, or `Frozen` according to the decision lifecycle below.

## Primary objective

The planning system optimizes for two equally critical outcomes:

1. **Owner control must stay easy.** The owner must be able to find, understand, change, compare, approve, or revoke a UI decision without reconstructing implementation history.
2. **AI interpretation must stay unambiguous.** An implementation agent must be able to identify scope, applicable decisions, authority boundaries, required states, forbidden behavior, evidence, and stop conditions without inventing missing policy.

When these goals conflict, prefer explicit, traceable structure over prose volume. A shorter single-source contract is better than duplicated requirements across many documents.

## Core operating principles

### 1. One fact, one canonical home

A normative decision is written once in its canonical record. Other artifacts reference its ID instead of copying the rule text.

Do not duplicate the same requirement across review sheets, registries, surface contracts, and work orders. Duplication creates specification drift and conflicting AI instructions.

### 2. Review structure is not authority structure

The 27 governance sheets are **review lenses**. They help the owner inspect the product systematically, but they are not separate stores of duplicated product truth.

Approved decisions are recorded in the Decision Ledger and linked to the applicable Registry, Matrix, Flow, Surface Contract, Component Contract, or Motion Contract.

### 3. Scope and applicability beat global assumptions

SimpleVTT may intentionally have different valid paths for Player/DM, Offline/Host/Client, standalone Character use, and connected Play.

Do not force one global UI authority when multiple context-specific paths are valid. Every rule must state its scope, applicability, responsibility, precedence within that scope, and legacy status where relevant.

### 4. No invention

If a required product, rules, authority, visibility, interaction, or UX decision is missing, the AI must return `PLANNING GAP` rather than inventing a fallback, hidden default, fake rule, or replacement behavior.

### 5. UI never becomes rules or network authority

UI may present canonical data, collect user choices, format information, control local presentation state, and submit commands.

UI must not silently calculate or own named rules, attack legality, target eligibility, AC/DC, proficiency, initiative semantics, resource legality, authoritative outcomes, multiplayer authority, or secret-data disclosure policy.

### 6. State must be explicit

Every important surface must define its normal, empty, loading, pending, disabled, error, role, permission, responsive, focus, reconnect, and other applicable states. An unspecified edge state is not automatically delegated to the implementation agent.

### 7. Human acceptance remains mandatory

Green automation is evidence, not owner acceptance. UI work is complete only when required automated checks, visual evidence, and owner walkthrough gates pass for one exact source revision.

---

# A. Control Plane

The Control Plane prevents conflicting instructions and keeps the plan easy to modify.

## C0 — Canonical Manifest

The manifest identifies which artifacts are authoritative and how conflicts are handled.

### Precedence within the same explicit scope

1. Frozen owner decision recorded in canonical planning artifacts.
2. Existing canonical product/domain/architecture contract for areas not superseded by a compatible Frozen decision.
3. Approved Surface / Component / Motion contract derived from applicable Frozen decisions.
4. Approved AI Work Order.
5. Current implementation.
6. Historical or non-canonical working notes, including `.agents/` material.
7. AI interpretation.

This is not permission to silently override a domain contract with a UI decision. If two higher-level artifacts conflict across different scopes, stop and report `PLANNING GAP: CONTRACT CONFLICT` with both IDs/sources.

### Normative language

- `MUST` — required for acceptance.
- `MUST NOT` — prohibited; violation blocks acceptance.
- `SHOULD` — expected unless an explicit documented exception exists.
- `SHOULD NOT` — avoid unless an explicit documented exception exists.
- `MAY` — optional and non-authoritative.

## C1 — Decision Ledger

Every product/UX decision receives one stable ID and one canonical record.

Required fields:

- `Decision ID`
- `Title`
- `Owner Sheet`
- `Status`
- `Scope`
- `Applicability`
- `Decision`
- `Rationale`
- `Dependencies`
- `Supersedes / Superseded By`
- `Legacy Status`
- `Affected Registries / Matrices / Surfaces`
- `Known Planning Gaps`
- `Change Notes`

### Decision lifecycle

- `Draft` — candidate only. Must not drive implementation.
- `Selected` — owner selected an option; still open to downstream revision.
- `Reviewed` — reviewed in its governance context; still not immutable.
- `Frozen` — implementation may rely on it as a stable requirement. Changing it requires impact review.
- `Superseded` — retained for traceability but no longer applicable.

Only `Frozen` decisions may be treated as immutable implementation requirements. `Selected` and `Reviewed` decisions may inform planning but must not silently override Frozen dependencies.

## C2 — Dependency and Traceability Graph

Every implemented UI behavior must be traceable through IDs.

Expected chain:

```text
Product Principle / Decision
    -> Registry or Matrix entry
    -> Surface / Component / Motion Contract
    -> AI Work Order
    -> Code change
    -> Automated / visual evidence
    -> Owner acceptance
```

A missing critical link means the behavior is not fully governed.

## C3 — Change Impact Protocol

When the owner changes a `Frozen` decision:

1. Mark the decision as under change; do not silently edit history.
2. Identify dependent Registry, Matrix, Flow, Surface, Component, Motion, Work Order, test, and documentation IDs.
3. Classify impact: `No Change`, `Review Required`, `Contract Update Required`, `Implementation Update Required`, `Regression Required`.
4. Update the canonical decision and affected contracts.
5. Re-run only the affected review and verification gates plus any required regressions.
6. Record what was superseded.

The system should make change cheap for the owner without hiding its impact from AI.

## C4 — Planning Gap Protocol

AI must stop and report a planning gap when any of the following is true:

- a required decision is `Draft` or absent;
- two applicable canonical contracts conflict;
- an authoritative data source does not expose required information;
- implementation would require a new named-rule calculation in UI;
- implementation would require inventing target eligibility, DC, resource legality, authority, disclosure, or fallback semantics;
- a legacy path's status is unknown;
- required role, responsive, error, focus, or transition behavior is materially unspecified;
- implementation would violate a Frozen dependency.

Required response format:

```text
PLANNING GAP
Affected IDs:
Missing or conflicting decision:
Why implementation cannot safely infer it:
Smallest decision needed to continue:
```

---

# B. Product UX Model

## 27 governance review sheets

These are review lenses, not duplicate requirement stores.

1. `UX-01` Product Principles
2. `UX-02` User & Role Model
3. `UX-03` Information Hierarchy
4. `UI-01` Layout & Grid
5. `UI-02` Typography
6. `UI-03` Color & Semantic Color
7. `UI-04` Iconography
8. `UI-05` Density & Spacing
9. `NAV-01` Navigation
10. `INT-01` Interaction
11. `INT-02` Layering
12. `INT-03` Confirmation
13. `STATE-01` UI States
14. `STATE-02` System States
15. `CMP-01` Core Components
16. `CONTENT-01` UX Writing
17. `A11Y-01` Accessibility
18. `PLATFORM-01` Desktop / Responsive
19. `DND-01` Character Presentation
20. `DND-02` Roll & Dice UX
21. `DND-03` Action UX
22. `DND-04` Combat UX
23. `SES-01` Session UX
24. `SES-02` Multiplayer Authority UX
25. `DM-01` DM Controls
26. `DM-02` Adjudication & Undo
27. `CONTENT-02` Rules & Add-on UX

Each sheet must publish its complete Decision Map before asking individual questions. New questions discovered during review are either added visibly to the current Decision Map as a planning gap before continuing, or assigned to the correct downstream sheet. Do not improvise an untracked chain of questions.

## R1-R9 — UI Registries

Registries answer **what UI artifacts exist**.

| Registry | Purpose |
| --- | --- |
| `R1` IA & Destination | Where the user can be in the product. |
| `R2` Task Flow | Goal-oriented steps, branches, entry, exit, recovery. |
| `R3` Workspace Mode & Interaction State | Major modes/states inside a stable workspace. |
| `R4` Overlay & Interruptive Surface | Dialogs, alert dialogs, drawers, popovers, context menus, tooltips, lightboxes, prompts. |
| `R5` Feedback & Notification | Toasts, banners, inline alerts, status, progress, result feedback, durable activity notices. |
| `R6` System & Edge State | Loading, empty, error, unsupported, disconnected, reconnecting, incompatible, permission, stale data, reduced motion, narrow desktop. |
| `R7` Component & Control | Buttons, tabs, toggles, inputs, Actor Cards, Hotbar slots, resource indicators, list rows, search, media controls. |
| `R8` Content & Messaging | Labels, action wording, confirmation copy, disabled reasons, error anatomy, visibility wording, result terminology. |
| `R9` Motion & Temporal Behavior | Animation, transition, timeout, auto-dismiss, reveal timing, dice physics, reduced-motion equivalents. |

Do not create a new Registry for an orthogonal constraint such as accessibility or authority; use the matrices below.

## M1-M6 — Cross-cutting Matrices

Matrices answer **how every applicable UI artifact is constrained across another dimension**.

| Matrix | Purpose |
| --- | --- |
| `M1` Role / Authority / Visibility / Disclosure | Who may see, receive, control, disclose, or mutate each capability/data class. |
| `M2` State Machine & Transition Contract | Current state, event, guard, authority, next state, side effect, failure, rollback/recovery. |
| `M3` Persistence / Ownership / Source of Truth | Canonical owner, persistence lifetime, network projection, and whether UI may mutate local presentation only. |
| `M4` Accessibility / Input | Keyboard, focus, pointer alternative, semantics, screen-reader status, reduced-motion requirements. |
| `M5` Responsive / Layout | Wide/normal/narrow behavior, invariants, allowed collapse, prohibited hiding. |
| `M6` Coverage / Acceptance | Required normal/empty/error/role/keyboard/responsive/reconnect and other test coverage. |

## Master User Flows

Master flows are maintained separately from individual screens and must show all first-class entry paths.

At minimum the Home-level flow must treat these as parallel product paths when applicable:

```text
Home
  -> New Character
  -> My Characters
  -> Host Session
  -> Join Session
  -> Content
  -> Rules
  -> Settings
  -> Return to active Play when a live session exists
```

Character use must not be modeled as a universal prerequisite for entering Session unless a specific task flow explicitly requires Character selection.

---

# C. Design Contracts

## Surface Contract

Every meaningful surface or governed pattern has one contract.

Required fields:

- `Surface ID`
- `Name`
- `Surface Type`
- `Owner Sheet`
- `Parent Surface`
- `Applicable Roles / Connection Contexts`
- `Entry Trigger`
- `Purpose`
- `Information Priority (P0/P1/P2)`
- `Primary Action`
- `Secondary Actions`
- `Cancel / Exit / Return Behavior`
- `Blocking / Modality`
- `Persistence`
- `Authority / Source of Truth`
- `Required States`
- `Feedback Output`
- `Keyboard / Focus`
- `Responsive Contract`
- `Motion / Temporal Contract`
- `Invariants`
- `Forbidden Behavior`
- `Dependencies`
- `Required Evidence`
- `Status`

## Component Contract

Reusable components must define:

- purpose and non-purpose;
- semantic role;
- owned vs projected state;
- default / hover / pressed / selected / focus / disabled / loading / error states as applicable;
- keyboard and pointer behavior;
- responsive behavior;
- content limits;
- prohibited domain calculations;
- design-token references;
- acceptance evidence.

## Motion / Temporal Contract

Time-based behavior must be explicit where it affects comprehension, input, authority, or accessibility.

Required fields where applicable:

- trigger;
- start condition;
- sequence;
- authoritative state relationship;
- allowed interaction during motion;
- reveal point;
- completion behavior;
- timeout / auto-dismiss behavior;
- cancellation behavior;
- reduced-motion equivalent;
- failure fallback.

Presentation timing must never become gameplay authority unless a canonical domain contract explicitly says otherwise.

## Design Tokens

Layout, spacing, typography, color, radius, elevation, focus treatment, density, and motion values should use named tokens rather than repeated prose or arbitrary component-local values.

AI must reuse existing tokens when an appropriate token exists. Creating a new token requires an explicit design-system need, not ad hoc visual preference.

---

# D. AI Execution and Verification Plane

## AI Implementation Work Order

AI implementation must be scoped by a Work Order instead of being told to implement the entire planning corpus at once.

Required template:

```text
WORK ORDER
ID:
Objective:

IN SCOPE:
ALLOWED SIDE EFFECTS:
OUT OF SCOPE:
MUST NOT CHANGE:

APPLICABLE DECISION IDS:
FROZEN DEPENDENCIES:

SOURCE OF TRUTH:
AUTHORITATIVE DATA:
LOCAL PRESENTATION STATE:

ENTRY STATE:
ALLOWED TRANSITIONS:
EXIT STATE:

REQUIRED SURFACES:
REQUIRED COMPONENT STATES:
REQUIRED ROLE VARIANTS:
REQUIRED RESPONSIVE STATES:
REQUIRED ACCESSIBILITY:
REQUIRED MOTION / TEMPORAL BEHAVIOR:

NO-INVENTION RULES:
FORBIDDEN FALLBACKS:
LEGACY STATUS:

REQUIRED AUTOMATED EVIDENCE:
REQUIRED VISUAL EVIDENCE:
REQUIRED OWNER WALKTHROUGH:

STOP CONDITIONS:
```

## Scope lock

Every Work Order must explicitly classify:

- `IN SCOPE`
- `ALLOWED SIDE EFFECT`
- `OUT OF SCOPE`
- `MUST NOT CHANGE`

An AI agent must not expand scope merely because adjacent code looks outdated or inconsistent.

## Legacy containment

Every touched legacy path must be labeled as one of:

- `ACTIVE`
- `COMPATIBILITY ONLY`
- `MIGRATION ONLY`
- `FORBIDDEN`
- `DELETE`

Do not leave multiple paths with ambiguous authority.

## Quality gates

UI implementation quality is checked through these gates as applicable:

- `Q1` Accessibility
- `Q2` Performance / Responsiveness
- `Q3` Visual Regression
- `Q4` Interaction Regression
- `Q5` Domain / Authority Regression
- `Q6` Owner Walkthrough

Performance numbers must come from an explicit measured requirement. AI must not invent arbitrary FPS, latency, timeout, or duration budgets.

## Completion rule

Implementation is complete only when:

1. all applicable Frozen decisions are satisfied;
2. no applicable Stop Condition remains;
3. required Surface/Component/Motion contracts are implemented;
4. required Matrix coverage is represented;
5. required automated evidence passes;
6. required visual evidence is attached or reproducible;
7. required owner walkthrough is completed;
8. the exact accepted source revision is recorded.

---

# Owner-friendly review workflow

The process must remain easy to control manually.

For each review sheet:

1. Show the sheet purpose and boundaries.
2. Show the complete Decision Map before asking questions.
3. Mark already-decided items and their current status.
4. Ask one decision at a time in stable order.
5. Record the owner's choice immediately as `Selected` unless the owner explicitly requests another status.
6. Do not freeze automatically.
7. Route newly discovered detail to the correct downstream sheet or Planning Gap instead of derailing the current sequence.
8. At the end of the sheet, show a concise review summary and unresolved gaps.
9. Freeze only when the owner explicitly approves freezing the applicable scope.

The owner must be able to change one decision by ID without rewriting the entire plan. The traceability graph determines what downstream artifacts require re-review.

# AI readability rules

To keep instructions machine-readable and low-ambiguity:

- use stable IDs everywhere;
- use tables for inventories and matrices;
- use explicit enums for statuses and legacy state;
- use `MUST / MUST NOT / SHOULD / MAY` for normative requirements;
- keep one canonical rule body and reference it by ID elsewhere;
- distinguish canonical data from local presentation state;
- distinguish visibility from data delivery;
- distinguish route/destination, task-flow step, workspace mode, overlay, feedback, system state, component, content, and motion;
- specify entry, transition, exit, failure, and recovery for stateful interactions;
- specify role/authority and responsive/accessibility states instead of relying on inference;
- prefer named design tokens over prose values;
- preserve provenance from decision to code to evidence;
- stop on missing authority instead of inventing behavior.

# Framework acceptance criteria

This planning framework is considered correctly applied only when both primary objectives remain true:

### Owner control

- The owner can locate any meaningful UI decision by stable ID.
- The owner can see its status, scope, rationale, dependencies, and affected surfaces.
- The owner can change one decision without manually hunting through duplicated prose.
- The owner can understand the user flow and UI inventory without reading implementation code.

### AI interpretation

- The AI can identify exactly which decisions are applicable to a scoped task.
- The AI can distinguish product decisions from domain authority and local UI state.
- The AI can determine required states, transitions, role variants, accessibility, responsive behavior, and evidence.
- The AI has explicit forbidden behavior and stop conditions.
- The AI is never expected to fill a material planning gap by guessing.

If either side becomes difficult, simplify references and contracts before adding more categories or duplicated documentation.
