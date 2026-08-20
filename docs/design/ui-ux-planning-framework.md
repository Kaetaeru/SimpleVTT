# SimpleVTT UI/UX Planning and AI Implementation Framework

Status: canonical planning framework for pre-implementation UI/UX work

This document defines **how** SimpleVTT UI/UX decisions are governed, changed, handed to AI, and verified. It does not freeze any product UI decision by itself.

Document routing and reading order are owned exclusively by [`ui-ux/AI-READING-GUIDE.md`](ui-ux/AI-READING-GUIDE.md). Machine-readable document roles are owned by [`ui-ux/MANIFEST.yaml`](ui-ux/MANIFEST.yaml). Start-work consistency is owned by [`ui-ux/PREFLIGHT.md`](ui-ux/PREFLIGHT.md).

---

# 0. Primary goals

This framework optimizes two things above everything else:

1. **Owner control must stay easy.** The owner should normally change one decision, not maintain a web of documents by hand.
2. **AI interpretation must stay unambiguous.** AI should use stable IDs and bounded referenced context instead of reconstructing product intent from prose or code.

If a process makes either side harder, simplify before adding more structure.

## Golden rule

> **The owner decides product behavior. AI maintains structure, references, impact analysis, derived coverage, contracts, and implementation evidence.**

The owner is never responsible for manually synchronizing Registry, Matrix, Dashboard, contracts, tests, or traceability after changing one decision.

## Daily workflow

```text
complete Decision Map
    -> one owner decision
    -> Decision Card
    -> AI updates derived references / impact
    -> later scoped Work Order
    -> implementation
    -> verification
    -> owner acceptance
```

## What the owner normally controls

- **Decision Map** — what questions exist and in what order.
- **Decision Card** — the canonical answer to one product/UX question.
- **Master User Flow / Surface Map** — how the product is navigated and used.

Everything else is supporting structure maintained by AI unless the owner explicitly wants to edit it.

---

# 1. Single-source ownership

A normative fact has one canonical home.

| Fact type | Canonical owner |
| --- | --- |
| Undecided questions / review order | `ui-ux/review-plan.md` |
| Made product/UX decisions | `ui-ux/decisions.md` |
| Known material unknowns/blockers | `ui-ux/planning-gaps.md` |
| Product flow/topology baseline | `ui-ux/master-flow.md` |
| Document roles/entrypoints | `ui-ux/MANIFEST.yaml` |
| AI reading/task routing | `ui-ux/AI-READING-GUIDE.md` |
| Start-work consistency gate | `ui-ux/PREFLIGHT.md` |
| R1-R9 inventory | `ui-ux/registry.md` — derived |
| M1-M6 cross-cutting coverage | `ui-ux/matrices.md` — derived |
| Current-state summary | `ui-ux/README.md` — derived |

Do not copy a normative rule body into multiple files. Derived artifacts reference IDs instead.

---

# 2. Decision lifecycle and authority

## Lifecycle

- `Draft` — candidate only; MUST NOT drive implementation.
- `Selected` — owner selected it; downstream review may still revise it.
- `Reviewed` — reviewed in context; still not immutable.
- `Frozen` — implementation may rely on it as stable.
- `Superseded` — retained for traceability but no longer applicable.

AI MUST NOT Freeze a decision unless the owner explicitly requests or approves freezing the applicable scope.

## Canonical precedence within the same explicit scope

1. Frozen owner decision in canonical planning artifacts.
2. Existing canonical product/domain/architecture contract not validly superseded by a compatible Frozen decision.
3. Approved Surface / Component / Motion contract derived from applicable Frozen decisions.
4. Approved scoped AI Work Order.
5. Current implementation.
6. Historical/non-canonical working notes, including `.agents/`.
7. AI inference.

A UI decision is not permission to silently override a domain/network contract. If applicable high-level contracts conflict, return `PLANNING GAP: CONTRACT CONFLICT`.

## Normative language

- `MUST` — required.
- `MUST NOT` — prohibited.
- `SHOULD` — expected unless an explicit exception exists.
- `SHOULD NOT` — avoid unless an explicit exception exists.
- `MAY` — optional.

---

# 3. Human-first review model

## Decision Map

Before asking any question in a governance sheet, the **complete map for that sheet** must exist with:

- Scope
- Non-scope
- full decision list
- dependencies
- conditional branches
- Exit Criteria

Ask one declared decision at a time. Do not invent the next question from the previous answer.

New findings become a `Planning Gap` or a declared downstream-map item before they may become owner questions.

AI MAY propose changing review order when dependency analysis justifies it. AI MUST NOT change the declared review order without owner approval.

## Decision Card

The canonical made-decision unit is compact:

```text
Decision ID:
Title:
Status:
Applies To:
Decision:
Why:
Depends On:
Affects:
Planning Gap: none / <Gap ID>
```

Advanced fields are added only when needed:

```text
Role / Connection Applicability:
Supersedes / Superseded By:
Legacy Status:
Authority / Visibility Note:
Change Note:
```

The owner may change decisions in plain language. AI resolves the affected IDs and maintains downstream structure automatically.

---

# 4. Progressive specification tiers

Use the lightest specification depth that safely removes ambiguity.

| Tier | Use when | Required planning |
| --- | --- | --- |
| `S0 — Cosmetic` | token, spacing, icon, non-semantic polish | Decision/reference + design token |
| `S1 — Standard UI` | ordinary component/local interaction | Decision + Component/Surface reference + applicable states/accessibility |
| `S2 — Stateful Flow` | multi-step flow, modal, targeting, builder, reconnectable UI | Decision + Surface Contract + applicable transitions + responsive/accessibility |
| `S3 — Authority Critical` | multiplayer authority/privacy, destructive action, rules boundary, durable mutation, Undo | Decision + Surface Contract + M1/M2/M3 + invariants + scoped Work Order + regression + owner walkthrough |

AI SHOULD choose the lowest safe tier. Over-documentation that makes owner changes expensive is a framework failure.

---

# 5. Product UX model

## 27 governance sheets — review lenses

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

Sheets organize review; they do not own duplicate copies of the resulting requirements.

## R1-R9 Registries — what exists

| Registry | Question |
| --- | --- |
| `R1` IA & Destination | Where can the user be? |
| `R2` Task Flow | How is a goal accomplished? |
| `R3` Workspace Mode & Interaction State | What major mode/state is the workspace in? |
| `R4` Overlay & Interruptive Surface | What appears over/inside current context? |
| `R5` Feedback & Notification | How is status/result communicated? |
| `R6` System & Edge State | What non-happy-path state exists? |
| `R7` Component & Control | What reusable controls/objects exist? |
| `R8` Content & Messaging | What wording/terminology patterns exist? |
| `R9` Motion & Temporal Behavior | What time-based behavior exists? |

Do not add Accessibility, Authority, Persistence, or Responsive as new registries; those are cross-cutting constraints.

## M1-M6 Matrices — how it is constrained

| Matrix | Question |
| --- | --- |
| `M1` Role / Authority / Visibility / Disclosure | Who may see, receive, control, disclose, or mutate it? |
| `M2` State Machine & Transition | From which state/event/guard to which state? |
| `M3` Persistence / Ownership / Source of Truth | Who owns the data and how long does it live? |
| `M4` Accessibility / Input | How do keyboard/focus/pointer/assistive access work? |
| `M5` Responsive / Layout | What changes across wide/normal/narrow and what remains? |
| `M6` Coverage / Acceptance | Which states/roles/devices must be verified? |

Matrices reference Decision/Contract IDs instead of duplicating their normative prose.

---

# 6. Global Planning Gate

**Individual sheet review MUST NOT resume after the current planning reset until this gate passes. This includes `UX-02-01`.**

Required preparation:

```text
[ ] R1-R9 complete Master UI Inventory cross-checked against implementation evidence, master flow, made decisions, and generic non-route patterns.
[ ] M1-M6 required coverage materialized for every material Registry item.
[ ] All 27 governance sheets have complete predeclared Decision Maps: Scope, Non-scope, full decision list, dependencies/conditional branches, Exit Criteria.
[ ] Missing / Duplication / Coverage audit passes:
    [ ] every Registry item has a governing owner;
    [ ] every governance sheet has inventory/Decision-Map coverage;
    [ ] no normative requirement has duplicate canonical authority;
    [ ] every material unknown is an explicit Planning Gap.
[ ] Owner receives one concise whole-product coverage checkpoint.
```

Only after this gate passes may sequential owner review resume at the first declared unfinished decision, currently `UX-02-01` unless the owner approves a different review order.

Inventory/matrix preparation may identify artifacts and gaps, but MUST NOT silently decide new product behavior.

---

# 7. Master user flow rules

Master flows are separate from screen/component definitions and show all first-class entry paths.

At minimum Home treats these as parallel paths when applicable:

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

Character creation/use MUST NOT be modeled as a universal prerequisite for Session entry unless a specific flow explicitly requires Character selection.

Important flows should show:

```text
Entry -> happy path -> branch/guard -> failure/recovery -> exit/return
```

Use M2 for state-heavy transition detail rather than duplicating every transition in flow diagrams.

---

# 8. Contracts — generated detail, not owner busywork

## Surface Contract

Use for S1-S3 as needed.

Core:

```text
Surface ID:
Name / Type:
Purpose:
Parent / Entry:
Applicable Roles:
Primary Action:
Exit / Return:
Required States:
Authority / Source of Truth:
Invariants:
Forbidden Behavior:
Decision IDs:
```

Add when applicable: information priority, secondary actions, modality, feedback, keyboard/focus, responsive, motion/timing, persistence, evidence.

## Component Contract

```text
Component ID:
Purpose / Non-purpose:
Semantic role:
Projected vs local state:
Required interaction states:
Keyboard / pointer:
Responsive behavior:
Content limits:
Design tokens:
Forbidden domain calculations:
Decision IDs:
```

Do not move page/business rules into a component merely because it displays them.

## Motion / Temporal Contract

Use when timing affects comprehension, input, authority, accessibility, or result sequencing.

```text
Trigger:
Start condition:
Sequence:
Authoritative-state relationship:
Interaction allowed during motion:
Reveal point:
Completion / cancellation:
Timeout / auto-dismiss:
Reduced-motion equivalent:
Failure fallback:
```

Presentation timing MUST NOT become gameplay authority unless a canonical domain contract explicitly requires it.

## Design tokens

Use named tokens for recurring spacing/density, typography, semantic color, borders/radius/elevation, focus treatment, and motion values. Reuse an appropriate token before creating a new one.

---

# 9. AI routing and preflight authority

This framework deliberately does **not** define a second reading order.

- [`ui-ux/AI-READING-GUIDE.md`](ui-ux/AI-READING-GUIDE.md) is the **sole canonical owner of AI task routing and document reading order**.
- [`ui-ux/MANIFEST.yaml`](ui-ux/MANIFEST.yaml) is the machine-readable owner of document roles and derived/canonical relationships.
- [`ui-ux/PREFLIGHT.md`](ui-ux/PREFLIGHT.md) is the sole canonical owner of start-work consistency/readiness checks.

If another planning artifact contains a conflicting reading/preflight sequence, this section and those dedicated files govern; fix the duplicate drift rather than trying to merge both instructions.

---

# 10. Planning Gap and stop protocol

AI returns a Planning Gap instead of inventing behavior when a required decision/contract is missing, authority cannot be established, UI would need to calculate named rules, a legacy path has unknown authority, a material required state is unspecified for the chosen tier, or a Frozen dependency would be violated.

Canonical gap types and severities are declared in `ui-ux/MANIFEST.yaml` and `ui-ux/planning-gaps.md`.

Compact failure form:

```text
PLANNING GAP
Affected IDs:
Gap:
Why AI cannot safely infer it:
Smallest owner/domain decision needed:
```

Do not turn a gap into an improvised question in the middle of another sheet. Register it first.

---

# 11. AI Work Orders

Implementation is performed from a scoped Work Order, not the entire planning corpus.

Required categories:

```text
WORK ORDER
ID:
Objective:
Spec Tier:

IN SCOPE:
ALLOWED SIDE EFFECTS:
OUT OF SCOPE:
MUST NOT CHANGE:

APPLICABLE DECISION IDS:
FROZEN DEPENDENCIES:
AUTHORITATIVE SOURCES:
LOCAL PRESENTATION STATE:

ENTRY STATE:
ALLOWED TRANSITIONS:
EXIT / RETURN:

REQUIRED SURFACES / COMPONENTS:
REQUIRED STATES / ROLE VARIANTS:
REQUIRED ACCESSIBILITY / RESPONSIVE:
REQUIRED MOTION / TEMPORAL BEHAVIOR:

NO-INVENTION RULES:
FORBIDDEN FALLBACKS:
LEGACY STATUS:

REQUIRED AUTOMATED EVIDENCE:
REQUIRED VISUAL EVIDENCE:
REQUIRED OWNER WALKTHROUGH:
STOP CONDITIONS:
```

Work Orders reference canonical IDs instead of becoming a second requirement store.

Every Work Order locks `IN SCOPE`, `ALLOWED SIDE EFFECT`, `OUT OF SCOPE`, and `MUST NOT CHANGE`.

Touched legacy paths are classified as `ACTIVE`, `COMPATIBILITY ONLY`, `MIGRATION ONLY`, `FORBIDDEN`, or `DELETE`.

---

# 12. Change impact

Changing one owner decision must stay cheap.

When a decision changes, AI:

1. updates the canonical Decision Card and preserves history/supersession where needed;
2. finds references/dependencies;
3. classifies impact as `No Change`, `Review Required`, `Contract Update Required`, `Implementation Update Required`, or `Regression Required`;
4. updates derived artifacts;
5. surfaces only material product consequences/new decisions to the owner;
6. re-runs the smallest safe verification set.

The owner does not manually repair references.

---

# 13. Verification and completion

Quality gates as applicable:

- `Q1` Accessibility
- `Q2` Performance / Responsiveness
- `Q3` Visual Regression
- `Q4` Interaction Regression
- `Q5` Domain / Authority Regression
- `Q6` Owner Walkthrough

AI MUST NOT invent arbitrary FPS, latency, timeout, breakpoint, or animation-duration budgets.

Implementation is complete only when applicable Frozen decisions and contracts are satisfied, no Stop Condition remains, required Matrix coverage exists, required automated/visual evidence passes, owner walkthrough passes, and the exact accepted source revision is recorded.

Green automation alone is never owner UX acceptance.

---

# 14. Source-of-truth and UI boundary

Unless a canonical architecture decision explicitly changes them:

- UI renders canonical/domain/application state and collects user decisions.
- UI may own explicitly allowed local presentation state.
- UI MUST NOT own named-rule calculations, attack legality, target eligibility, AC/DC, proficiency, authoritative outcomes, turn semantics, resource legality, multiplayer authority, or secret-data disclosure policy.
- Visibility is not delivery. Data a Player is not authorized to receive MUST NOT be sent and merely hidden.
- Unknown/unsupported mechanics are explicit blockers, not approximations.
- Current implementation is evidence, not automatic product truth.

---

# 15. Canonical file layout

```text
docs/design/
  README.md                         # Design Canon index
  ui-ux-planning-framework.md       # governance framework
  ui-ux/
    AI-READING-GUIDE.md             # AI task router / reading order
    MANIFEST.yaml                   # machine-readable document map
    PREFLIGHT.md                    # consistency/readiness gate
    README.md                       # owner dashboard; derived summary
    review-plan.md                  # review order + undecided Decision Maps
    decisions.md                    # made Decision Cards only
    master-flow.md                  # product flows / topology baseline
    planning-gaps.md                # explicit material unknowns
    registry.md                     # R1-R9 derived inventory
    matrices.md                     # M1-M6 derived coverage
    templates.md                    # copy-safe artifact templates
    surfaces/                       # S1-S3 Surface Contracts when required
    components/                     # reusable Component Contracts when required
    motion/                         # temporal contracts when required
    work-orders/                    # scoped implementation handoffs when authorized/ready
```

The owner starts at `ui-ux/README.md`. AI starts at `ui-ux/AI-READING-GUIDE.md`.

---

# 16. Framework success criteria

## Owner control test

The owner can understand current planning without source code, see full question maps before review, change one decision in natural language, see material consequences only, avoid manual document synchronization, and distinguish Selected/Reviewed/Frozen/Gaps.

## AI interpretation test

A new AI can find the correct task route and IDs quickly, read only bounded context, distinguish owner decisions/domain authority/local presentation state, identify required states/authority/accessibility/responsive/timing, know what it MUST NOT change, and know exactly when to stop.

## Final simplicity rule

> If a new category, field, matrix, or contract does not materially improve owner control or AI certainty, do not add it.

This framework is intentionally complete enough for high-risk VTT UI work while remaining progressively lightweight for ordinary decisions.
