# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order and task-routing guide for UI/UX planning, prototype and implementation agents

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

**Broad UI runtime implementation must not skip the Reference Prototype phase.**

---

# 1. Source roles

| Source | Role |
| --- | --- |
| `../ui-ux-planning-framework.md` | governance / lifecycle / authority domains |
| `OWNER-CONTROL-POLICY.md` | **what the owner must decide vs what AI may design** |
| `MANIFEST.yaml` | machine-readable global roles/enums/reference rules |
| `PREFLIGHT.md` | global consistency/readiness checks |
| `README.md` | owner-facing current status |
| `review-plan.md` | detailed coverage maps; **not owner homework** |
| `owner-review/02-key-decisions.md` | completed lightweight Owner Checkpoints |
| `decisions.md` | canonical made Product/UX decisions |
| `planning-gaps.md` | material no-invention gaps |
| `master-flow.md` | derived owner-friendly flow view |
| `registry.md` | derived UI inventory |
| `matrices.md` | derived cross-cutting coverage |
| `prototype/README.md` | Reference Prototype phase governance |
| `prototype/MANIFEST.yaml` | machine-readable prototype gates |
| `prototype/*-CATALOG.md` / models | complete visual/interaction reference specification |
| `prototype/PROTOTYPE-PREFLIGHT.md` | HTML prototype build gate |
| `prototype/PROTOTYPE-ACCEPTANCE.md` | owner-facing prototype acceptance gate |
| `prototype/PROTOTYPE-WORK-ORDER.md` | prepared standalone HTML prototype scope |

Historical detailed worksheets under `owner-review/` may be used as planning reference, but AI MUST NOT ask the owner to complete them merely because they exist.

---

# 2. Task routes

| Route | Task |
| --- | --- |
| `A — Resume Planning` | process material owner checkpoints / AI design-default planning |
| `B — Show Status` | summarize planning/prototype/runtime state |
| `C — Change a Decision` | alter/reopen an existing choice |
| `D — Explore Whole Product` | inventory/coverage audit |
| `P — Reference Prototype` | build/review/iterate the standalone complete UI example |
| `E — Prepare Runtime Implementation` | after accepted prototype: contracts + Freeze/readiness + runtime Work Order |
| `F — Implement Runtime` | production code from approved runtime scope |
| `G — Verify / QA` | validate prototype or runtime against the relevant contract/gate |
| `H — Resolve Conflict` | determine authority / drift / contract conflict |

Mixed work resolves authority before implementation.

---

# 3. Route A — Resume Planning

Read:

```text
1. README.md
2. OWNER-CONTROL-POLICY.md
3. owner-review/02-key-decisions.md when historical owner inputs matter
4. relevant Decision Cards
5. relevant Planning Gaps
6. detailed review-plan rows only when needed for coverage/dependency
7. Registry/Matrix/domain/code only for concrete grounding
```

## Owner workload rule

**Do not walk the owner through every row of `review-plan.md`.**

Classify unresolved items using `OWNER-CONTROL-POLICY.md`:

- `Owner Checkpoint` -> ask only when material;
- `AI Design Default` -> resolve in design/prototype/contracts without owner questioning;
- `Domain / Architecture Contract` -> create/use the proper gap/contract, never ask the owner to guess technical truth.

## Lightweight worksheet processing

Historical/current lightweight worksheets may contain explicit owner input. Preserve it exactly and reconcile into `decisions.md`.

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
- do not implement runtime UI unless separately authorized and the prototype/runtime gates pass.

## When no Owner Checkpoint is pending

Continue with AI-managed design/default preparation or Route P prototype work. Ask the owner only if a detail meets the escalation rule in `OWNER-CONTROL-POLICY.md`.

---

# 4. Route B — Show Status

Read only what is needed:

```text
README.md
prototype/MANIFEST.yaml when prototype status matters
prototype/PROTOTYPE-ACCEPTANCE.md when owner prototype acceptance matters
planning-gaps.md
exact Decision Cards relevant to the question
```

Do not load source code for a normal status answer.

Always distinguish:

- Product/UX planning status;
- Reference Prototype status;
- Prototype owner acceptance;
- runtime implementation readiness/authorization.

---

# 5. Route C — Change a Decision

Read the exact Decision Card/default/catalog and affected sources only.

If the owner changes something in plain language:

1. locate the canonical Decision/default/prototype catalog/contract;
2. preserve/supersede history when needed;
3. check Product/UX vs Domain/Architecture authority;
4. update the smallest canonical source;
5. refresh affected derived/prototype views;
6. surface only material consequences.

An AI-managed detail may be promoted to a Product Decision when the owner explicitly changes it.

If a Reference Prototype exists, material accepted visual changes should also update it before runtime preparation.

No automatic Freeze or runtime implementation.

---

# 6. Route D — Explore Whole Product

Use for explicit inventory/coverage audits or material drift.

Read in layers:

```text
Canonical planning: decisions -> gaps -> review-plan
Derived visibility: master-flow -> registry -> matrices
Prototype visibility: prototype catalogs/models if present
Evidence: domain docs -> current implementation -> history only if needed
```

Detailed Decision Maps remain coverage scaffolding. Their existence does not imply one owner question per row.

AI may add inventory/coverage, classify details, and propose contracts. AI must not invent material owner behavior or domain/architecture truth.

---

# 7. Route P — Reference Prototype

Use this route for any request to **visually define, mock, prototype, preview, redesign, or broadly rebuild SimpleVTT UI before runtime implementation**.

## Mandatory read order

```text
1. prototype/README.md
2. prototype/MANIFEST.yaml
3. prototype/PROTOTYPE-PREFLIGHT.md
4. exact Product/UX decisions referenced by the prototype scope
5. prototype/DESIGN-DEFAULTS.md
6. prototype/SURFACE-CATALOG.md
7. prototype/COMPONENT-CATALOG.md
8. prototype/LAYER-MODEL.md
9. prototype/STATE-MODEL.md
10. prototype/SCENARIO-CATALOG.md
11. prototype/MOCK-DATA-CONTRACT.md
12. prototype/PROTOTYPE-ACCEPTANCE.md
13. prototype/PROTOTYPE-WORK-ORDER.md
```

## Prototype build rules

The standalone prototype may be built only under:

```text
docs/design/ui-ux/prototype/app/
```

It MUST NOT:

- modify/import production `src/` UI;
- call real backend/network/storage;
- calculate rules/authority/privacy;
- treat fixtures as production schemas;
- silently resolve technical gaps.

Use explicit fixtures for unresolved Domain/Architecture semantics.

## Prototype review rules

The owner reviews the prototype as a complete product experience, not by editing design tokens or matrix rows.

Translate owner comments into the smallest applicable:

- Product Decision;
- AI Design Default;
- Surface/Component/Layer/State catalog;
- Planning Gap/technical contract.

Keep the prototype synchronized after material owner feedback.

## Prototype acceptance

Do not mark accepted without explicit owner acceptance recorded in `prototype/PROTOTYPE-ACCEPTANCE.md` against a specific commit.

Prototype acceptance does not authorize runtime code.

---

# 8. Route E — Prepare Runtime Implementation

**Do not enter this route for broad UI work unless the Reference Prototype is accepted.**

Read:

```text
framework
OWNER-CONTROL-POLICY.md
prototype/MANIFEST.yaml
prototype/PROTOTYPE-ACCEPTANCE.md
accepted prototype reference commit
exact applicable Frozen decisions
planning-gaps
required Surface/Component/Motion contracts
affected M1-M6 rows
domain/architecture contracts
current implementation/tests
```

Runtime preparation is blocked if:

- prototype is not explicitly accepted for the relevant broad UI scope;
- applicable Product/UX dependencies are not Frozen as required;
- a material Domain/Architecture Gap blocks the runtime scope;
- legacy conflicting UX guidance is not reconciled for the scope;
- required Surface/Component/Motion contracts are absent;
- no scoped runtime Work Order exists.

`Reviewed` is planning truth but not a stable runtime implementation dependency.

If a required detail is an AI Design Default, extract/materialize it from the accepted prototype into the appropriate contract/design system; do not create unnecessary owner questions.

---

# 9. Route F — Implement Runtime

Runtime implementation starts only from an approved scoped runtime Work Order after Route E readiness.

Read exactly the referenced:

- accepted Prototype reference/contract;
- Frozen Product/UX decisions;
- Surface/Component/Motion contracts;
- Domain/Architecture contracts;
- in-scope source/tests.

Do not:

- broaden scope;
- infer D&D rules or authority;
- treat current implementation as product truth;
- treat the prototype's mock JS as production logic;
- copy Prototype Controls into product UI;
- treat fixtures as production schemas;
- treat an AI recommendation as owner approval;
- use a detailed old worksheet as canonical Product Decision;
- turn a convenience default into a privacy/network/rules contract.

Unexpected material dependency -> stop and route correctly.

For broad UI implementation, if no accepted Reference Prototype exists, return to Route P instead of improvising production UI.

---

# 10. Route G — Verify / QA

## Prototype QA

Compare prototype against:

- Product/UX decisions;
- prototype catalogs/models/defaults;
- scenario coverage;
- `PROTOTYPE-ACCEPTANCE.md`;
- no-invention/runtime-isolation boundary.

## Runtime QA

Compare implementation against:

- accepted prototype reference where applicable;
- applicable Frozen decisions;
- detailed contracts/design defaults extracted from the prototype;
- authority/domain contracts;
- M6 acceptance coverage;
- scoped runtime Work Order.

Requirement gap -> planning/contract.
Prototype mismatch -> prototype drift.
Implementation mismatch -> implementation drift.
Stale derived doc -> maintenance.

QA does not redesign silently.

---

# 11. Route H — Resolve Conflict

Classify the conflict first:

- `OWNER INPUT CONFLICT`
- `PROTOTYPE DRIFT`
- `IMPLEMENTATION DRIFT`
- `DERIVED DOCUMENT DRIFT`
- `SCHEMA / REFERENCE DRIFT`
- `PLANNING GAP: CONTRACT CONFLICT`
- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`

Product/UX decisions do not silently override rules/network/persistence/privacy contracts.

An accepted prototype does not silently override a canonical Product Decision; fix the prototype or explicitly change the Decision.

---

# 12. Owner-control stop rule

Before asking the owner a new question, AI MUST be able to state which escalation criterion from `OWNER-CONTROL-POLICY.md` makes it material.

If it cannot, **do not ask**. Resolve it as an AI Design Default or proper technical contract instead.

During prototype review, ordinary feedback such as spacing, density, pane placement or styling should normally be applied directly without turning each change into a new Owner Checkpoint.

This is intentional: owner control means the owner controls meaningful choices, not that the owner manually specifies every UI state.

---

# 13. Broad UI lifecycle

```text
Owner Decisions / AI Design Defaults
        |
        v
Reference Prototype specification
        |
        v
Standalone interactive HTML prototype
        |
        v
Owner visual/interaction review + iteration
        |
        v
Explicit Prototype Acceptance
        |
        v
Surface / Component / Motion contract extraction
+ Domain/Architecture gap resolution
+ legacy UX reconciliation
+ scoped Freeze/readiness
        |
        v
Runtime UI Work Order
        |
        v
src/ implementation
        |
        v
QA against accepted prototype + contracts
```

Skipping from Reviewed planning directly to broad runtime UI implementation is not allowed.

---

# 14. Final principle

> **Keep owner decisions few, meaningful, and reversible. Use the Reference Prototype to make the whole UI visible before production code. Keep detailed coverage exhaustive inside AI-maintained planning. Never trade away authority, privacy, rules correctness, explicit owner intent, or the prototype-before-runtime gate for convenience.**
