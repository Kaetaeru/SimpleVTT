# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order and task-routing guide for UI/UX planning and implementation agents

This file owns AI routing. The owner should not need to read it.

---

# 0. Mandatory AI entry

```text
1. AI-READING-GUIDE.md
2. MANIFEST.yaml
3. PREFLIGHT.md
4. route-specific bounded context
5. work
```

Before turning a detail into an owner question, read [`OWNER-CONTROL-POLICY.md`](OWNER-CONTROL-POLICY.md).

Do not reconstruct product intent from current code when a canonical Decision exists.

---

# 1. Source roles

| Source | Role |
| --- | --- |
| `../ui-ux-planning-framework.md` | governance / lifecycle / authority domains |
| `OWNER-CONTROL-POLICY.md` | **what the owner must decide vs what AI may design** |
| `MANIFEST.yaml` | machine-readable roles/enums/reference rules |
| `PREFLIGHT.md` | consistency/readiness checks |
| `README.md` | owner-facing current status |
| `review-plan.md` | detailed coverage maps; **not owner homework** |
| `owner-review/02-key-decisions.md` | current lightweight Owner Checkpoints |
| `decisions.md` | canonical made Product/UX decisions |
| `planning-gaps.md` | material no-invention gaps |
| `master-flow.md` | derived owner-friendly flow view |
| `registry.md` | derived UI inventory |
| `matrices.md` | derived cross-cutting coverage |

Historical detailed worksheets under `owner-review/` may be used as planning reference, but AI MUST NOT ask the owner to complete them merely because they exist.

---

# 2. Task routes

| Route | Task |
| --- | --- |
| `A — Resume Planning` | process lightweight owner checkpoints / continue product decisions |
| `B — Show Status` | summarize planning state |
| `C — Change a Decision` | alter/reopen an existing choice |
| `D — Explore Whole Product` | inventory/coverage audit |
| `E — Prepare Implementation` | readiness + Work Order |
| `F — Implement` | code from approved scope |
| `G — Verify / QA` | validate implementation |
| `H — Resolve Conflict` | determine authority / drift / contract conflict |

Mixed work resolves authority before implementation.

---

# 3. Route A — Resume Planning

Read:

```text
1. README.md
2. OWNER-CONTROL-POLICY.md
3. owner-review/02-key-decisions.md
4. relevant Decision Cards
5. relevant Planning Gaps
6. detailed review-plan rows only when needed for coverage/dependency
7. Registry/Matrix/domain/code only for concrete grounding
```

## Owner workload rule

**Do not walk the owner through every row of `review-plan.md`.**

Classify unresolved items using `OWNER-CONTROL-POLICY.md`:

- `Owner Checkpoint` -> may appear in the lightweight worksheet;
- `AI Design Default` -> resolve later in design/contracts without owner questioning;
- `Domain / Architecture Contract` -> create/use the proper gap/contract, never ask the owner to guess technical truth.

## Lightweight worksheet processing

`owner-review/02-key-decisions.md` supports two forms of explicit input:

1. `OWNER SELECT: A/B/C/CUSTOM` on an individual question;
2. `전체 추천안 사용: YES` — every otherwise-unanswered checkpoint accepts its stated `AI 추천`.

Per-question explicit selections override the bundle recommendation.

`CUSTOM` uses `OWNER NOTE` as the controlling instruction.

Before canonicalizing:

- preserve owner intent;
- check dependency/conflict/authority boundaries;
- never silently substitute AI preference;
- if an answer conflicts with a domain/architecture contract, create/report a contract conflict instead of overriding it.

After successful reconciliation:

- write the resulting Decision Card(s) in `decisions.md`;
- resolve/update applicable Planning Gaps;
- refresh only affected derived docs;
- do not Freeze unless explicitly authorized;
- do not implement unless separately authorized and ready.

## When no Owner Checkpoint is pending

Continue with AI-managed design/default preparation. Ask the owner only if a detail meets the escalation rule in `OWNER-CONTROL-POLICY.md`.

---

# 4. Route B — Show Status

Read only:

```text
README.md
owner-review/02-key-decisions.md when owner-input status matters
planning-gaps.md
exact Decision Cards relevant to the question
```

Do not load source code for a normal status answer.

---

# 5. Route C — Change a Decision

Read the exact Decision Card and affected sources only.

If the owner changes something in plain language:

1. locate the canonical Decision/default/contract;
2. preserve/supersede history when needed;
3. check Product/UX vs Domain/Architecture authority;
4. update the smallest canonical source;
5. refresh affected derived views;
6. surface only material consequences.

An AI-managed detail may be promoted to a Product Decision when the owner explicitly changes it.

No automatic Freeze or implementation.

---

# 6. Route D — Explore Whole Product

Use for explicit inventory/coverage audits or material drift.

Read in layers:

```text
Canonical planning: decisions -> gaps -> review-plan
Derived visibility: master-flow -> registry -> matrices
Evidence: domain docs -> current implementation -> history only if needed
```

Detailed Decision Maps remain coverage scaffolding. Their existence does not imply one owner question per row.

AI may add inventory/coverage, classify details, and propose contracts. AI must not invent material owner behavior or domain/architecture truth.

---

# 7. Route E — Prepare Implementation

Read:

```text
framework
OWNER-CONTROL-POLICY.md
exact applicable Frozen decisions
planning-gaps
required Surface/Component/Motion contracts
affected M1-M6 rows
domain/architecture contracts
current implementation/tests
```

Use `PREFLIGHT.md` for readiness.

`Reviewed` is planning truth but not a stable implementation dependency. Applicable implementation dependencies must meet the framework's Freeze/readiness rules.

If a required detail is an AI Design Default, materialize it in the appropriate contract/design system before implementation; do not create unnecessary owner questions.

If a required fact belongs to Domain/Architecture and is missing, return a Planning Gap/contract blocker.

---

# 8. Route F — Implement

Implementation starts from an approved scoped Work Order.

Read exactly the referenced decisions/contracts/domain sources and in-scope source/tests.

Do not:

- broaden scope;
- infer D&D rules or authority;
- treat current implementation as product truth;
- treat an AI recommendation as owner approval;
- use a detailed old worksheet as canonical Product Decision;
- turn a convenience default into a privacy/network/rules contract.

Unexpected material dependency -> stop and route correctly.

---

# 9. Route G — Verify / QA

Compare implementation against:

- applicable decisions;
- detailed contracts/design defaults;
- authority/domain contracts;
- M6 acceptance coverage;
- scoped Work Order.

Requirement gap -> planning/contract.
Implementation mismatch -> implementation drift.
Stale derived doc -> maintenance.

QA does not redesign.

---

# 10. Route H — Resolve Conflict

Classify the conflict first:

- `OWNER INPUT CONFLICT`
- `IMPLEMENTATION DRIFT`
- `DERIVED DOCUMENT DRIFT`
- `SCHEMA / REFERENCE DRIFT`
- `PLANNING GAP: CONTRACT CONFLICT`
- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`

Product/UX decisions do not silently override rules/network/persistence/privacy contracts.

---

# 11. Owner-control stop rule

Before asking the owner a new question, AI MUST be able to state which escalation criterion from `OWNER-CONTROL-POLICY.md` makes it material.

If it cannot, **do not ask**. Resolve it as an AI Design Default or proper technical contract instead.

This is intentional: owner control means the owner controls meaningful choices, not that the owner manually specifies every UI state.

---

# 12. Final principle

> **Keep owner decisions few, meaningful, and reversible. Keep detailed coverage exhaustive inside AI-maintained planning. Never trade away authority, privacy, rules correctness, or explicit owner intent for convenience.**
