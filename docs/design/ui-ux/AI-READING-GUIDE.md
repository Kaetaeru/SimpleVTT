# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order and task-routing guide for UI/UX planning, prototype and implementation agents

This file owns AI routing. The owner should not need to read it.

---

# 0. Mandatory AI entry

```text
1. AI-READING-GUIDE.md
2. MANIFEST.yaml
3. PREFLIGHT.md
4. INTEGRATED-PRODUCT-UX-PLAN.md for any broad Product/UI/Prototype/QA/Runtime-preparation work
5. route-specific bounded context
6. work
```

Before turning a detail into an owner question, read [`OWNER-CONTROL-POLICY.md`](OWNER-CONTROL-POLICY.md).

Do not reconstruct product intent from current code, old tests, historical demos or `.agents/` working documents when a canonical Decision/Domain contract exists.

**Broad UI runtime implementation must not skip the Reference Prototype phase.**

**Broad UI/prototype work must not skip the integrated cross-source baseline.**

---

# 1. Source roles

| Source | Role |
| --- | --- |
| `../ui-ux-planning-framework.md` | governance / lifecycle / authority domains |
| `OWNER-CONTROL-POLICY.md` | **what the owner must decide vs what AI may design** |
| `MANIFEST.yaml` | machine-readable global roles/enums/reference rules |
| `PREFLIGHT.md` | global consistency/readiness checks |
| `INTEGRATED-PRODUCT-UX-PLAN.md` | **mandatory cross-source Product/UI interpretation for broad work; mapless/product-history reconciliation baseline** |
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
| `prototype/PROTOTYPE-WORK-ORDER.md` | standalone HTML prototype scope |
| `.agents/*` | **non-canonical historical/working context only**; never outranks formal docs/decisions |
| `src/*`, `tests/*` | implementation/test evidence only unless a canonical contract explicitly delegates truth there |

Historical detailed worksheets under `owner-review/` may be used as provenance, but AI MUST NOT ask the owner to complete them merely because they exist.

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
3. INTEGRATED-PRODUCT-UX-PLAN.md when the question affects broad Product/UI flow or terminology
4. owner-review/02-key-decisions.md when historical owner inputs matter
5. relevant Decision Cards
6. relevant Planning Gaps
7. detailed review-plan rows only when needed for coverage/dependency
8. Registry/Matrix/domain/code only for concrete grounding
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
- refresh `INTEGRATED-PRODUCT-UX-PLAN.md` if the broad cross-source interpretation changes;
- do not Freeze unless explicitly authorized;
- do not implement runtime UI unless separately authorized and the prototype/runtime gates pass.

## When no Owner Checkpoint is pending

Continue with AI-managed design/default preparation or Route P prototype work. Ask the owner only if a detail meets the escalation rule in `OWNER-CONTROL-POLICY.md`.

---

# 4. Route B — Show Status

Read only what is needed:

```text
README.md
INTEGRATED-PRODUCT-UX-PLAN.md when broad UI/prototype status is involved
prototype/MANIFEST.yaml when prototype status matters
prototype/PROTOTYPE-ACCEPTANCE.md when owner prototype acceptance matters
planning-gaps.md
exact Decision Cards relevant to the question
```

Do not load source code for a normal status answer.

Always distinguish:

- Product/UX planning status;
- integrated cross-source baseline status;
- Reference Prototype status;
- Prototype owner acceptance;
- runtime implementation readiness/authorization.

---

# 5. Route C — Change a Decision

Read the exact Decision Card/default/catalog and affected sources only. Read `INTEGRATED-PRODUCT-UX-PLAN.md` when the requested change affects product-wide flow, mapless terminology, first-run/session/Play structure or another cross-source rule.

If the owner changes something in plain language:

1. locate the canonical Decision/default/prototype catalog/contract;
2. preserve/supersede history when needed;
3. check Product/UX vs Domain/Architecture authority;
4. update the smallest canonical source;
5. refresh the integrated plan if its interpretation changes;
6. refresh affected derived/prototype views;
7. surface only material consequences.

An AI-managed detail may be promoted to a Product Decision when the owner explicitly changes it.

If a Reference Prototype exists, material accepted visual changes should also update it before runtime preparation.

No automatic Freeze or runtime implementation.

---

# 6. Route D — Explore Whole Product

Use for explicit inventory/coverage audits or material drift.

Read in layers:

```text
Canonical domain/product boundary: docs/design + docs/rules applicable contracts
Canonical planning: decisions -> gaps -> review-plan
Cross-source baseline: INTEGRATED-PRODUCT-UX-PLAN.md
Direct Owner provenance when needed: owner-review/*
Derived visibility: master-flow -> registry -> matrices
Prototype visibility: prototype catalogs/models if present
Historical/evidence: .agents -> old demos -> current implementation/tests
```

Detailed Decision Maps remain coverage scaffolding. Their existence does not imply one owner question per row.

`.agents/*` is explicitly non-canonical working context. It may reveal historical owner intent or useful constraints, but it never overrides formal Domain/Product authority by itself.

AI may add inventory/coverage, classify details, and propose contracts. AI must not invent material owner behavior or domain/architecture truth.

---

# 7. Route P — Reference Prototype

Use this route for any request to **visually define, mock, prototype, preview, redesign, or broadly rebuild SimpleVTT UI before runtime implementation**.

## Mandatory read order

```text
1. INTEGRATED-PRODUCT-UX-PLAN.md
2. exact applicable Domain/Architecture contracts, especially mapless/session/character/rules boundaries
3. exact Product/UX Decision Cards referenced by the prototype scope
4. planning-gaps.md for affected unresolved contracts
5. prototype/README.md
6. prototype/MANIFEST.yaml
7. prototype/PROTOTYPE-PREFLIGHT.md
8. prototype/DESIGN-DEFAULTS.md
9. prototype/SURFACE-CATALOG.md
10. prototype/COMPONENT-CATALOG.md
11. prototype/LAYER-MODEL.md
12. prototype/STATE-MODEL.md
13. prototype/SCENARIO-CATALOG.md
14. prototype/MOCK-DATA-CONTRACT.md
15. prototype/PROTOTYPE-ACCEPTANCE.md
16. prototype/PROTOTYPE-WORK-ORDER.md
```

If the prototype Manifest says the current candidate is invalidated/rebuild-required, **do not patch or review it as the active reference**. Build a replacement from the integrated baseline and corrected catalogs.

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
- silently resolve technical gaps;
- infer tactical-map semantics from the words `Scene`, `Table`, `Stage` or `Canvas`;
- add Core Actor coordinates/tokens/grid/path/LoS/fog when the mapless Domain contract forbids them.

Use explicit fixtures for unresolved Domain/Architecture semantics.

## Prototype review rules

The owner reviews the prototype as a complete product experience, not by editing design tokens or matrix rows.

Translate owner comments into the smallest applicable:

- Product Decision;
- AI Design Default;
- Surface/Component/Layer/State catalog;
- Planning Gap/technical contract;
- integrated-plan interpretation update when the comment exposes cross-source drift.

Keep the prototype synchronized after material owner feedback.

## Prototype acceptance

Do not mark accepted without explicit owner acceptance recorded in `prototype/PROTOTYPE-ACCEPTANCE.md` against a specific commit.

An invalidated candidate cannot be accepted.

Prototype acceptance does not authorize runtime code.

---

# 8. Route E — Prepare Runtime Implementation

**Do not enter this route for broad UI work unless the Reference Prototype is accepted.**

Read:

```text
framework
OWNER-CONTROL-POLICY.md
INTEGRATED-PRODUCT-UX-PLAN.md
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

- the integrated baseline is stale relative to a material Product/Domain change;
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

- `INTEGRATED-PRODUCT-UX-PLAN.md` for broad product interpretation;
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
- use `.agents`, an old worksheet, historical demo or stale test as canonical Product Decision;
- turn a convenience default into a privacy/network/rules contract;
- restore tactical-map UI to Core without an explicit compatible Domain/Product change.

Unexpected material dependency -> stop and route correctly.

For broad UI implementation, if no accepted Reference Prototype exists, return to Route P instead of improvising production UI.

---

# 10. Route G — Verify / QA

## Prototype QA

Compare prototype against:

- applicable Domain/Architecture boundaries;
- Product/UX decisions;
- `INTEGRATED-PRODUCT-UX-PLAN.md`;
- prototype catalogs/models/defaults;
- scenario coverage;
- `PROTOTYPE-ACCEPTANCE.md`;
- no-invention/runtime-isolation boundary.

A tactical-map interpretation in Core, missing first-run tutorial, detached Standalone roll surface, Lobby/Ready regression or historical intent-funnel restoration is a material prototype mismatch even if the HTML works.

## Runtime QA

Compare implementation against:

- `INTEGRATED-PRODUCT-UX-PLAN.md`;
- accepted prototype reference where applicable;
- applicable Frozen decisions;
- detailed contracts/design defaults extracted from the prototype;
- authority/domain contracts;
- M6 acceptance coverage;
- scoped runtime Work Order.

Requirement gap -> planning/contract.
Prototype mismatch -> prototype drift.
Implementation mismatch -> implementation drift.
Stale derived doc/test -> maintenance.

QA does not redesign silently.

---

# 11. Route H — Resolve Conflict

Read `INTEGRATED-PRODUCT-UX-PLAN.md` first for broad UI conflicts, then inspect the exact competing authority sources.

Classify the conflict first:

- `OWNER INPUT CONFLICT`
- `PROTOTYPE DRIFT`
- `IMPLEMENTATION DRIFT`
- `DERIVED DOCUMENT DRIFT`
- `STALE TEST / HISTORICAL CONTRACT`
- `SCHEMA / REFERENCE DRIFT`
- `PLANNING GAP: CONTRACT CONFLICT`
- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`

Product/UX decisions do not silently override rules/network/persistence/privacy contracts.

An accepted prototype does not silently override a canonical Product Decision; fix the prototype or explicitly change the Decision.

A historical `.agents` plan or current UI test does not override a newer formal Decision/Domain contract merely because implementation still follows it.

---

# 12. Owner-control stop rule

Before asking the owner a new question, AI MUST be able to state which escalation criterion from `OWNER-CONTROL-POLICY.md` makes it material.

If it cannot, **do not ask**. Resolve it as an AI Design Default or proper technical contract instead.

During prototype review, ordinary feedback such as spacing, density, pane placement or styling should normally be applied directly without turning each change into a new Owner Checkpoint.

This is intentional: owner control means the owner controls meaningful choices, not that the owner manually specifies every UI state.

---

# 13. Broad UI lifecycle

```text
Canonical Domain boundaries + Owner/Product Decisions
        |
        v
Integrated Product / UI / UX baseline
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
QA against integrated baseline + accepted prototype + contracts
```

Skipping the integrated cross-source baseline or jumping from Reviewed planning directly to broad runtime UI implementation is not allowed.

---

# 14. Final principle

> **Keep owner decisions few, meaningful, and reversible. Read the whole product through its Domain boundaries and integrated cross-source baseline before drawing UI. Use the Reference Prototype to make the whole experience visible before production code. Never let current code, stale tests, historical agent notes, or visual words like Scene/Table smuggle in product behavior that the canonical contracts do not own.**
