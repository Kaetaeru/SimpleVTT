# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order guide for UI/UX planning and implementation agents

This file exists for one purpose:

> **Make it obvious which document an AI reads first, which documents it reads next, and when it must stop reading and start working.**

A good UI/UX document system can still fail if an AI reads the right files in the wrong order. This guide therefore treats **reading order as part of the specification**.

---

# 0. AI ENTRYPOINT

If you are an AI working on SimpleVTT UI/UX and do not already have an explicit scoped Work Order, **start here**.

Do not start by scanning source code.
Do not start with `.agents/` notes.
Do not start with `registry.md` or `matrices.md`.
Do not reconstruct the current plan from Git history or implementation behavior.

First classify the task, then follow exactly one reading route below.

---

# 1. Document roles and priority

The files are not peers. They have different jobs.

| Priority | Document | Role | Read when |
| --- | --- | --- | --- |
| `P0` | `../ui-ux-planning-framework.md` | Governing rules: status, authority, no-invention, spec tiers, Work Orders | First UI/UX session, framework/version change, or whenever governance is unclear |
| `P0` | `README.md` | Current dashboard: where planning is now and what happens next | Every resumed planning session |
| `P0` | `review-plan.md` | Fixed review order + predeclared Decision Maps | Whenever asking or resuming owner UX questions |
| `P1` | `decisions.md` | Canonical Decision Cards: actual owner-approved product decisions | Whenever behavior/UX meaning is relevant |
| `P1` | `master-flow.md` | Canonical planning flow/surface topology | Navigation, flow, session/play structure, screen/surface questions |
| `P1` | `planning-gaps.md` | Explicit unknowns AI must not invent | Before proposing/implementing behavior that may touch unresolved policy |
| `P2` | `registry.md` | R1-R9 structured UI inventory | Inventory/coverage/surface discovery tasks |
| `P2` | `matrices.md` | M1-M6 cross-cutting constraints | Authority/state/accessibility/responsive/coverage tasks |
| `P2` | `templates.md` | Canonical shapes for new Decision/Surface/Transition/Work Order artifacts | When creating structured planning artifacts |
| `P2` | `surfaces/*`, `components/*`, `motion/*` | Detailed contracts | Only when referenced or required by spec tier |
| `P2` | `work-orders/*` | Exact implementation scope | First implementation document after governance bootstrap |
| `P3` | other `docs/design/*`, `docs/rules/*`, schemas | Domain/architecture evidence and canonical non-UI constraints | Only when referenced or materially constraining current task |
| `P4` | current source/tests | Implementation evidence | After planning sources for planning tasks; after Work Order/contracts for implementation tasks |
| `P5` | `.agents/*`, historical PRs/issues | Working/history evidence | Only if needed to resolve history; never product truth by itself |

**Priority means reading precedence, not that every file must be read.**

---

# 2. The mandatory task router

Before reading beyond this guide, classify the request into exactly one primary route.

| Route | Use when user asks to... |
| --- | --- |
| `A — Resume Planning` | continue UI/UX planning, ask next question, continue prior review |
| `B — Show Status` | show current state, what remains, what is next |
| `C — Change a Decision` | change/reverse/adjust an existing UX choice |
| `D — Explore Whole Product` | inventory all screens, flows, UI types, gaps, coverage |
| `E — Prepare Implementation` | determine whether a scope is implementation-ready; create Work Order |
| `F — Implement` | modify code according to approved planning |
| `G — Verify / QA` | inspect implementation against UX decisions/contracts |
| `H — Resolve Conflict / History` | explain conflicting docs/code or determine which source wins |

If the request contains multiple routes, select the one that determines authority first. Example: "change this decision and implement it" = `C` first, then `E/F` only after the change is valid for implementation.

---

# 3. Route A — Resume Planning

Read in this order:

```text
1. README.md
2. review-plan.md
3. only the relevant Decision Cards in decisions.md
4. planning-gaps.md entries linked to the current sheet
5. master-flow.md only if the decision affects topology/flow
6. relevant registry/matrix rows only if needed to explain consequences
7. relevant domain/code evidence only if the decision needs grounding
```

Before asking a question, verify:

- current review sheet;
- the complete Decision Map for that sheet exists;
- the next ID is predeclared;
- dependencies are known;
- the question is not already answered by a migrated prior decision;
- no Planning Gap requires routing the issue elsewhere first.

Then ask **one** predeclared decision.

Do not read every Decision Card. Use the current sheet and dependency IDs to bound retrieval.

---

# 4. Route B — Show Status

Default minimal read:

```text
1. README.md
2. planning-gaps.md
3. review-plan.md only if the user asks what comes next
```

Do not load `registry.md`, `matrices.md`, source code, or all decisions merely to answer a status question.

If the user asks status for one screen/surface, then add:

```text
4. relevant registry row
5. linked Decision IDs
6. relevant M6 coverage row if present
```

---

# 5. Route C — Change an Existing Decision

Read in this order:

```text
1. README.md
2. decisions.md -> locate the exact canonical Decision Card
3. review-plan.md -> identify owner sheet and downstream ordering
4. master-flow.md only if flow/topology is affected
5. registry.md / matrices.md only for linked affected IDs
6. planning-gaps.md -> check for newly opened gaps
7. domain/architecture contract only if authority/rules/persistence/network semantics are involved
```

Then:

1. update **one canonical Decision Card**;
2. preserve traceability/supersession where appropriate;
3. calculate downstream impact;
4. update derived references/contracts;
5. show the owner only material consequences;
6. do not automatically Freeze;
7. do not implement unless implementation is separately authorized and the resulting scope is implementation-ready.

Never fix a decision by editing only `registry.md`, `matrices.md`, or code.

---

# 6. Route D — Explore / Inventory the Whole Product

This is the one planning route where broader reading is expected, but still use layers.

```text
Phase 1 — Product truth
1. README.md
2. decisions.md
3. master-flow.md
4. planning-gaps.md
5. review-plan.md

Phase 2 — Structured coverage
6. registry.md
7. matrices.md

Phase 3 — Evidence cross-check
8. relevant canonical design/domain documents
9. current route/screen/component implementation
10. historical notes only if needed
```

Rules:

- Inventory rows MAY be added from evidence.
- New product behavior MUST NOT be invented while filling inventory.
- Evidence that conflicts with planning becomes a conflict/gap, not automatic plan replacement.
- Do not ask new owner questions during the inventory pass unless the owner explicitly changes the task to decision review.

---

# 7. Route E — Prepare Implementation

Read in this order:

```text
1. ../ui-ux-planning-framework.md
2. README.md
3. exact applicable Decision Cards
4. planning-gaps.md
5. relevant Surface/Component/Motion contracts
6. applicable M1-M6 rows
7. relevant canonical domain/architecture contracts
8. current implementation/tests
9. templates.md -> Work Order template
```

Implementation readiness requires:

- required decisions are Frozen where the implementation depends on stable behavior;
- no material Planning Gap blocks the scope;
- correct specification tier is selected;
- S2/S3 state transitions are explicit;
- S3 authority/source-of-truth constraints are explicit;
- required states/accessibility/responsive/timing are sufficiently specified;
- legacy status is known for touched paths.

If not ready, return `PLANNING GAP` or `NOT IMPLEMENTATION-READY` instead of silently filling missing requirements.

---

# 8. Route F — Implement

When a Work Order exists, **the Work Order becomes the implementation entrypoint after this guide/framework bootstrap**.

Read exactly:

```text
1. ../ui-ux-planning-framework.md
2. exact work-orders/<ID>.md
3. every Decision ID referenced by the Work Order
4. every Surface/Component/Motion contract referenced by the Work Order
5. only applicable M1-M6 rows
6. relevant domain/architecture contracts listed by the Work Order
7. current source and tests inside the scoped area
```

Do not read unrelated UX sheets in case they "might matter". If an unexpected dependency appears, stop and resolve it explicitly.

Implementation MUST NOT:

- reinterpret Reviewed/Draft planning as Frozen authority;
- broaden scope because adjacent code is old;
- invent missing fallback behavior;
- use current code to overrule a referenced canonical decision;
- repair unrelated UX while implementing one Work Order.

---

# 9. Route G — Verify / QA

Read in this order:

```text
1. exact Work Order or verification scope
2. applicable Decision IDs
3. applicable Surface/Component/Motion contracts
4. M6 Coverage / Acceptance rows
5. M1-M5 rows required by the scope
6. implementation diff/source
7. automated + visual evidence
```

QA compares implementation to canonical requirements; it does not redesign the product during verification.

A discovered requirement gap returns to planning.
A discovered implementation defect returns to implementation.
Do not blur the two.

---

# 10. Route H — Resolve Conflict / History

Read from highest authority downward:

```text
1. framework precedence rules
2. relevant Frozen Decision Card(s)
3. relevant canonical domain/architecture contract
4. applicable Surface/Component/Motion contract
5. current Work Order if any
6. current implementation
7. historical docs / .agents / PR history only to explain origin
```

Return one of:

- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`
- `IMPLEMENTATION DRIFT — code differs from canonical plan`
- `PLANNING GAP: CONTRACT CONFLICT — two applicable high-level sources conflict`

Do not resolve a real high-level conflict by choosing whichever file is newer or whichever behavior currently runs.

---

# 11. Reading stop rules

AI quality decreases when unnecessary documents are loaded into one reasoning context. Therefore, **knowing when to stop reading is mandatory**.

Stop expanding document scope when all are true:

- current task/route is identified;
- applicable Decision IDs are known;
- required authority/source-of-truth constraints are known;
- required surface/state/transition constraints are known for the selected spec tier;
- no unresolved material Planning Gap blocks the task;
- enough current implementation evidence is available for the requested work.

Do not continue reading merely to be exhaustive.

Read more only when a concrete unresolved dependency requires it.

---

# 12. Never infer document authority from these signals

The following do **not** make a document authoritative:

- filename sounds official;
- it is newer than another file;
- it is longer or more detailed;
- it appears in `.agents/`;
- code currently implements it;
- an old PR was merged;
- a comment says "final" without canonical status/Decision linkage;
- a registry row exists without a Decision ID.

Use the framework's canonical precedence and stable IDs.

---

# 13. Required cross-document references

To make reading order robust, important files should point forward rather than forcing search.

Expected links:

```text
Design Canon README
  -> AI-READING-GUIDE.md
  -> ui-ux-planning-framework.md

AI-READING-GUIDE.md
  -> README.md dashboard
  -> route-specific files

README.md dashboard
  -> review-plan.md
  -> decisions.md
  -> master-flow.md
  -> planning-gaps.md
  -> registry.md / matrices.md when needed

Decision Card
  -> Depends On IDs
  -> Affects IDs

Work Order
  -> Decision IDs
  -> contract IDs
  -> canonical domain sources
```

A new AI should not need filename guessing or repository-wide search to discover the next required planning document.

---

# 14. Missing-file behavior

If a referenced file/ID does not exist:

1. do not substitute a similarly named file;
2. do not reconstruct the requirement from code;
3. check whether the dashboard/review plan says the artifact is intentionally not materialized yet;
4. if required for the current task, report a Planning Gap or maintenance defect;
5. create/repair derived structure only when allowed by the framework and current task.

---

# 15. New AI self-check

Before doing substantive UI/UX work, a new AI should be able to answer these questions:

```text
What type of task am I doing (A-H)?
What is the current planning sheet or Work Order?
What is the next authorized planning action?
Which Decision IDs govern this task?
Which documents are canonical vs evidence only?
Are any relevant decisions merely Selected/Reviewed rather than Frozen?
Which Planning Gaps touch the scope?
What documents do I NOT need to read?
What condition would make me stop and return PLANNING GAP?
```

If any answer is materially unknown, follow the applicable route above before proceeding.

---

# 16. Owner simplicity rule

This guide is for AI, not a burden for the owner.

The owner may continue speaking naturally. The AI is responsible for routing the request to the correct reading path and maintaining document references.

The owner should never have to say:

> "Open matrices.md, then M2, then surface X, then Decision Y."

The owner should be able to say:

> "그 전투 타겟팅 결정 바꾸자."

and the AI should locate the canonical decision, read the minimum required dependency set, explain the material impact, and maintain the rest of the structure.

---

# 17. Final reading-order principle

> **Read from control -> current state -> canonical decisions -> task-specific structure -> domain constraints -> implementation evidence. Never read backward and infer product truth from code.**

This rule is the default whenever a more specific route above does not apply.
