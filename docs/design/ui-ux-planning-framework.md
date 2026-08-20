# SimpleVTT UI/UX Planning and AI Implementation Framework

Status: canonical planning framework for pre-implementation UI/UX work

This document defines **how** SimpleVTT UI/UX is planned, changed, handed to AI, and verified. It does not freeze any product UI decision by itself.

# 0. Read this first

## The two primary goals

This framework exists to optimize two things above everything else:

1. **Owner control must be easy.** The owner should normally change one decision, not maintain a web of documents by hand.
2. **AI interpretation must be easy and unambiguous.** The AI should normally read a small referenced set of IDs, not infer policy from a large prose corpus.

If a process makes either side harder, simplify the process before adding more documentation.

## Golden rule

> **The owner decides product behavior. The AI maintains structure, references, impact analysis, derived contracts, and implementation evidence.**

The owner must not be required to manually synchronize registries, matrices, contracts, tests, and traceability links after changing a decision.

## Daily workflow in one line

```text
Decision Map -> one owner decision -> AI records Decision Card -> AI updates affected references/contracts -> later generate scoped Work Order -> implement -> verify -> owner accepts
```

## What the owner normally edits

The owner should usually interact with only three things:

- **Decision Map** — what questions remain and in what order.
- **Decision Card** — the canonical answer to one product/UX question.
- **Master User Flow / Surface Map** — how the product is navigated and used.

Everything else is supporting structure maintained by AI unless the owner explicitly wants to edit it.

---

# 1. Human-first control model

## 1.1 Decision Map

Before reviewing a governance sheet, AI MUST show the complete planned question map.

Minimum columns:

| ID | Question | Status | Depends On | Destination |
| --- | --- | --- | --- | --- |
| `DND-03-014` | What happens on valid single-target click? | Reviewed | `INT-01-006` | `PLY-TARGETING` |

Rules:

- Ask one decision at a time in the declared order.
- Do not invent the next question from the previous answer.
- A newly discovered issue becomes a visible `Planning Gap` or a downstream-sheet item before it is asked.
- Conditional questions must be declared in the map before entering the branch.

## 1.2 Decision Card — the canonical unit the owner changes

A decision is stored once using this compact shape:

```text
Decision ID: DND-03-014
Title: Single-target execution
Status: Reviewed
Applies To: Play > Targeting
Decision: Clicking one valid target immediately executes the selected single-target action.
Why: Reduces confirmation friction while preserving explicit targeting.
Depends On: UX-01-04, INT-01-006
Affects: PLY-TARGETING, CMP-ACTOR-CARD
Planning Gap: none
```

Only add advanced fields when they are actually needed:

- `Role / Connection Applicability`
- `Supersedes / Superseded By`
- `Legacy Status`
- `Authority / Visibility Note`
- `Change Note`

The canonical rule body lives here. Other artifacts reference the Decision ID instead of copying the rule text.

## 1.3 Plain-language owner changes

The owner does not need to know IDs to make a change.

Examples that AI must support:

```text
"단일 타겟도 확인 버튼 넣자"
"DM Only 판정은 플레이어 Activity에 아무 흔적도 남기지 마"
"PLY-02는 그대로 두고 결과 표시만 바꿔"
```

AI MUST:

1. resolve the most likely affected Decision/Surface IDs;
2. show the exact item being changed if ambiguity is material;
3. update the single canonical Decision Card;
4. identify downstream impact automatically;
5. mark affected derived contracts as requiring review/update;
6. never require the owner to repair cross-references manually.

---

# 2. Decision status and authority

## 2.1 Lifecycle

- `Draft` — candidate only; MUST NOT drive implementation.
- `Selected` — owner chose it; downstream review may still revise it.
- `Reviewed` — reviewed in its governance context; still not immutable.
- `Frozen` — implementation may rely on it as stable.
- `Superseded` — retained only for history/traceability.

AI MUST NOT freeze a decision unless the owner explicitly requests or approves freezing the applicable scope.

## 2.2 Canonical precedence

Within the same explicit scope:

1. Frozen owner decision in canonical planning artifacts.
2. Existing canonical product/domain/architecture contract not validly superseded by a compatible Frozen decision.
3. Approved Surface / Component / Motion contract derived from applicable Frozen decisions.
4. Approved scoped AI Work Order.
5. Current implementation.
6. Historical or non-canonical working notes, including `.agents/`.
7. AI inference.

If two high-level contracts conflict across scopes, AI MUST stop with `PLANNING GAP: CONTRACT CONFLICT`. UI planning is not permission to silently override a domain or network contract.

## 2.3 Normative language

- `MUST` — required.
- `MUST NOT` — prohibited.
- `SHOULD` — expected unless an explicit exception exists.
- `SHOULD NOT` — avoid unless an explicit exception exists.
- `MAY` — optional.

---

# 3. Progressive specification: document only as deeply as risk requires

Do not require a full Surface Contract, state machine, authority matrix, and Work Order for every small visual choice. Use the lightest specification tier that safely removes ambiguity.

| Tier | Use when | Required planning |
| --- | --- | --- |
| `S0 — Cosmetic` | token, spacing, icon, non-semantic visual polish | Decision/reference + design token only |
| `S1 — Standard UI` | ordinary component or local interaction | Decision + Component/Surface reference + required states/accessibility |
| `S2 — Stateful Flow` | multi-step flow, modal, targeting, builder, reconnectable UI | Decision + Surface Contract + applicable state transitions + responsive/accessibility |
| `S3 — Authority Critical` | multiplayer authority, privacy, destructive action, rules boundary, durable mutation, Undo | Decision + Surface Contract + M1/M2/M3 + explicit invariants + scoped Work Order + regression + owner walkthrough |

AI SHOULD choose the lowest safe tier. Over-documentation that makes owner changes expensive is a framework failure.

---

# 4. The product model

## 4.1 27 governance sheets are review lenses

They organize owner review; they are not duplicate stores of product truth.

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

A sheet produces or reviews Decision Cards. It does not own a second copy of the requirement.

## 4.2 R1-R9 UI Registries — what exists

| Registry | Question it answers |
| --- | --- |
| `R1` IA & Destination | Where can the user be? |
| `R2` Task Flow | How does the user accomplish a goal? |
| `R3` Workspace Mode & Interaction State | What major mode/state is the current workspace in? |
| `R4` Overlay & Interruptive Surface | What appears over/inside the current context? |
| `R5` Feedback & Notification | How is status/result communicated? |
| `R6` System & Edge State | What non-happy-path state exists? |
| `R7` Component & Control | What reusable controls/objects exist? |
| `R8` Content & Messaging | What wording/terminology patterns exist? |
| `R9` Motion & Temporal Behavior | What time-based behavior exists? |

Do not add accessibility, authority, persistence, or responsive as new registries; those are orthogonal constraints below.

## 4.3 M1-M6 cross-cutting matrices — how it is constrained

| Matrix | Question it answers |
| --- | --- |
| `M1` Role / Authority / Visibility / Disclosure | Who may see, receive, control, disclose, or mutate it? |
| `M2` State Machine & Transition | From which state, on what event/guard, to which state? |
| `M3` Persistence / Ownership / Source of Truth | Who owns the data and how long does it live? |
| `M4` Accessibility / Input | How does keyboard/focus/pointer/assistive access work? |
| `M5` Responsive / Layout | What changes at wide/normal/narrow sizes, and what MUST remain? |
| `M6` Coverage / Acceptance | Which states/roles/devices must be verified? |

Matrices contain structured cross-cutting facts. They reference Decision IDs instead of restating product decisions.

---

# 5. Master user flow rules

Master flows are separate from screen/component definitions and MUST show all first-class entry paths.

At minimum, Home treats these as parallel paths when applicable:

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

Every important flow should show:

```text
Entry -> main happy path -> branch/guard -> failure/recovery -> exit/return
```

For state-heavy flows, use M2 rather than trying to encode every state transition only in a diagram.

---

# 6. Contracts — generated detail, not owner busywork

## 6.1 Surface Contract

Use for `S1-S3` surfaces as needed.

Core fields:

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

Add only when applicable:

```text
Information Priority P0/P1/P2:
Secondary Actions:
Blocking / Modality:
Feedback:
Keyboard / Focus:
Responsive:
Motion / Timing:
Persistence:
Required Evidence:
```

## 6.2 Component Contract

Reusable components define only behavior that truly belongs to the component:

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

Do not move page/business rules into a component contract merely because the component displays them.

## 6.3 Motion / Temporal Contract

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

## 6.4 Design tokens

Use named tokens for recurring visual values. AI MUST reuse an existing appropriate token before creating a new one.

Token categories include:

- spacing / density;
- typography;
- semantic color;
- borders / radius / elevation;
- focus treatment;
- motion duration/easing.

Do not create a new token to avoid using an existing equivalent token.

---

# 7. AI reading protocol — keep context small and deterministic

AI MUST NOT read or reinterpret the entire UX corpus for every implementation task.

## Planning task reading order

1. Current governance sheet Decision Map.
2. Referenced dependency Decision Cards.
3. Relevant existing canonical domain/design contract only when it materially constrains the decision.
4. Relevant current implementation only as evidence, never as automatic product truth.

## Implementation task reading order

1. `C0` framework rules in this document.
2. The exact scoped Work Order.
3. Every Decision ID referenced by the Work Order.
4. Only the Surface/Component/Motion contracts referenced by those decisions/work order.
5. Only applicable M1-M6 rows.
6. Relevant canonical domain/architecture contracts.
7. Current source code and tests.

If a required reference cannot be found, AI MUST stop rather than substitute a similarly named rule.

## AI output discipline during planning

For each owner decision turn, keep the visible interaction compact:

```text
Current: <ID — question>
Status: <status>
Why this matters: <one short paragraph>
Options: A / B / C (or a direct editable proposal)
Recommendation: <one option + brief reason>
```

After the owner answers:

```text
Recorded: <ID> = <decision summary> — Selected/Reviewed, not Frozen.
Next: <predeclared next ID>
```

Do not bury the owner in registry/matrix maintenance details unless they affect the product choice.

---

# 8. Planning Gap and Stop protocol

AI MUST return a Planning Gap instead of inventing behavior when:

- a required decision is missing or still `Draft`;
- two applicable canonical contracts conflict;
- the authoritative data source does not expose required information;
- UI implementation would require new named-rule calculations;
- target eligibility, DC, resource legality, authority, disclosure, fallback, or persistence semantics would have to be guessed;
- legacy-path status is unknown;
- a required role/error/focus/responsive/transition behavior is materially unspecified at the chosen specification tier;
- implementation would violate a Frozen dependency.

Use this exact compact form:

```text
PLANNING GAP
Affected IDs:
Gap:
Why AI cannot safely infer it:
Smallest owner/domain decision needed:
```

Do not turn a planning gap into an improvised UX question in the middle of another sheet. Put it into the visible backlog / destination sheet first.

---

# 9. AI Work Order — implementation handoff

AI implementation is performed from a scoped Work Order, not from the whole planning corpus.

```text
WORK ORDER
ID:
Objective:
Spec Tier: S0 / S1 / S2 / S3

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

### Work Order rule

The Work Order SHOULD reference canonical Decision IDs rather than duplicate their normative text. Short summaries may be included for convenience but are non-canonical.

### Scope lock

Every Work Order classifies:

- `IN SCOPE`
- `ALLOWED SIDE EFFECT`
- `OUT OF SCOPE`
- `MUST NOT CHANGE`

AI MUST NOT expand scope because adjacent code appears outdated.

### Legacy containment

Touched legacy paths are labeled:

- `ACTIVE`
- `COMPATIBILITY ONLY`
- `MIGRATION ONLY`
- `FORBIDDEN`
- `DELETE`

Ambiguous parallel authority is a Planning Gap.

---

# 10. Change impact — changing one owner decision must stay cheap

When the owner changes a Frozen decision, AI performs the maintenance work.

1. Update the canonical Decision Card and preserve the old decision as superseded/history where needed.
2. Find references/dependencies automatically.
3. Classify each affected artifact:
   - `No Change`
   - `Review Required`
   - `Contract Update Required`
   - `Implementation Update Required`
   - `Regression Required`
4. Update derived contracts/references.
5. Present the owner only the material product consequences and any new decision required.
6. Re-run the smallest safe set of verification gates.

The owner should not have to manually hunt through multiple documents to make one UX change.

---

# 11. Verification and completion

Quality gates are applied by risk/spec tier:

- `Q1` Accessibility
- `Q2` Performance / Responsiveness
- `Q3` Visual Regression
- `Q4` Interaction Regression
- `Q5` Domain / Authority Regression
- `Q6` Owner Walkthrough

AI MUST NOT invent arbitrary FPS, latency, timeout, breakpoint, or animation-duration budgets. Numeric budgets require an explicit design/engineering requirement or measured baseline.

Implementation is complete only when:

1. applicable Frozen decisions are satisfied;
2. no applicable Stop Condition remains;
3. required contracts for the selected Spec Tier are satisfied;
4. required M1-M6 coverage exists;
5. automated evidence passes;
6. required visual evidence is reproducible;
7. required owner walkthrough passes;
8. the exact accepted source revision is recorded.

Green automation alone never equals owner UX acceptance.

---

# 12. Source-of-truth and UI boundary rules

These constraints are always applicable unless a canonical architecture decision explicitly changes them:

- UI renders canonical/domain/application state and collects user decisions.
- UI may own local presentation state such as open/closed, selected tab, zoom, hover, or custom layout preferences when explicitly allowed.
- UI MUST NOT own hidden named-rule calculations, attack legality, target eligibility, AC/DC, proficiency, action outcome, turn semantics, resource legality, multiplayer authority, or secret-data disclosure policy.
- Visibility is not the same as delivery. Data that a Player is not authorized to receive MUST NOT be sent and merely hidden in UI.
- Unknown or unsupported mechanics are explicit blockers, not approximate fallbacks.
- Current implementation is evidence, not automatic product truth.

---

# 13. Recommended canonical file layout when the plan is materialized

Keep the human entry point shallow and the detailed artifacts separated.

```text
docs/design/
  ui-ux-planning-framework.md        # this framework
  ui-ux/
    README.md                        # owner/AI dashboard + current next item
    decisions.md                     # Decision Ledger; canonical decision bodies
    master-flow.md                   # product flows / surface map
    planning-gaps.md                 # explicit unresolved gaps
    registry.md                      # R1-R9 inventory, references only
    matrices.md                      # M1-M6 structured rows
    surfaces/                        # S1-S3 Surface Contracts
    components/                      # reusable component contracts
    motion/                          # material temporal contracts
    work-orders/                     # scoped implementation handoffs
```

The owner normally starts at `ui-ux/README.md`, not by reading every file.

The dashboard should show only:

```text
Current review sheet:
Current decision:
Reviewed / Frozen counts:
Open Planning Gaps:
Next owner decision:
Implementation-ready scopes:
```

AI maintains this dashboard as planning changes.

---

# 14. Framework success criteria

This framework is successful only if both sides remain easy.

## Owner control test

The owner can:

- understand the current UI plan without reading source code;
- see the full upcoming question map before review starts;
- change one decision in plain language;
- immediately see only the material consequences of that change;
- avoid manually updating traceability, matrices, or derived contracts;
- know what is Selected, Reviewed, Frozen, Superseded, or still a Planning Gap.

## AI interpretation test

A new AI agent can:

- find the current task and exact applicable IDs quickly;
- read only a bounded set of referenced documents;
- distinguish owner product decisions, domain authority, and local presentation state;
- identify allowed transitions, role/visibility constraints, edge states, accessibility, responsive, and timing requirements when applicable;
- know what it MUST NOT change;
- know exactly when to stop with a Planning Gap;
- produce implementation evidence traceable back to the relevant Decision IDs.

## Final simplicity rule

> If adding a new category, field, matrix, or contract does not materially improve owner control or AI certainty, do not add it.

The framework is intentionally complete enough for high-risk VTT UI work but progressively lightweight for ordinary UI decisions.
