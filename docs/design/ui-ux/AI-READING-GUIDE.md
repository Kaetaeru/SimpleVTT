# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order and task-routing guide for UI/UX planning and implementation agents

This file is the **sole canonical owner of AI document routing and reading order** for SimpleVTT UI/UX work.

It answers four questions:

1. What kind of task am I doing?
2. Which documents govern that task?
3. In what order do I read them?
4. When do I stop reading and start working?

---

# 0. Mandatory AI entry sequence

```text
1. AI-READING-GUIDE.md      -> classify Route A-H
2. MANIFEST.yaml            -> confirm document roles / enums / reference rules / derived status
3. PREFLIGHT.md             -> pass consistency/readiness checks for that route
4. route-specific documents -> read only the bounded set required below
5. perform work
```

Do not start from source code, `.agents/`, Registry, Matrix, Git history, or current UI behavior.

If Manifest and actual files disagree, treat it as document drift and repair/report it before substantive work.

---

# 1. Document ownership summary

| Document | Owns |
| --- | --- |
| `../ui-ux-planning-framework.md` | governance, lifecycle, specification tiers, authority-domain rules |
| `AI-READING-GUIDE.md` | task routing + reading order |
| `MANIFEST.yaml` | machine-readable roles, enums, exact reference syntax, derived relationships |
| `PREFLIGHT.md` | start-work consistency/readiness/schema checks |
| `README.md` | derived current status/next work only |
| `review-plan.md` | review order, undecided Decision Maps, Global Planning Gate |
| `owner-review/README.md` + worksheet files | **owner-authored selection input** for predeclared questions; candidate options are scaffolding, not canonical product truth |
| `decisions.md` | made product/UX Decision Cards only |
| `master-flow.md` | **derived owner-friendly flow/topology view**; not a second decision store |
| `planning-gaps.md` | material unknowns AI must not invent |
| `registry.md` | derived R1-R9 inventory + Planning/Contract status |
| `matrices.md` | derived M1-M6 coverage |
| `templates.md` | copy-safe artifact shapes; no duplicate Preflight authority |

Other canonical domain/architecture documents govern their explicit rules/data/network/persistence/privacy scopes. Current source/tests are implementation evidence.

Structured references MUST be exact full IDs/paths per `MANIFEST.yaml`. Do not infer omitted prefixes or ranges.

---

# 2. Mandatory task router

Classify the request into one primary route before broad reading.

| Route | Task |
| --- | --- |
| `A — Resume Planning` | reconcile owner selections from the GitHub owner-review worksheets; only ask chat questions when explicitly requested or a real contradiction blocks processing |
| `B — Show Status` | report current planning/gate/gaps/next work |
| `C — Change a Decision` | alter or reverse a made UX choice, including a material change expressed through the Master Flow view |
| `D — Explore Whole Product` | inventory/cross-check all UI, flows, matrices, Decision Maps, coverage |
| `E — Prepare Implementation` | assess readiness / create scoped Work Order |
| `F — Implement` | modify code from approved Work Order |
| `G — Verify / QA` | validate implementation against canonical requirements |
| `H — Resolve Conflict / History` | determine which source/scope governs or whether a contract conflict exists |

For mixed requests, resolve authority first. Example: change + implement = `C -> E -> F` only if later gates pass and implementation is authorized.

---

# 3. Route A — Resume Planning

**First run Preflight.**

If `Global Planning Gate = BLOCKED`, Route A MUST NOT process/ask governance questions. Switch to Route D preparation until the gate passes.

Only after the Global Planning Gate passes, read:

```text
1. README.md
2. review-plan.md
3. owner-review/README.md
4. the worksheet file containing the current sheet
5. relevant made Decision Cards in decisions.md
6. planning-gaps.md entries linked to the current sheet
7. master-flow.md only as a derived visualization when topology/flow context helps
8. relevant Registry/Matrix rows only when needed to explain consequences
9. domain/code evidence only when concrete grounding is required
```

## Worksheet-first behavior

For the current sheet, scan every block for:

```text
OWNER SELECT: <non-empty>
AI STATUS: PENDING
```

A filled owner selection is **explicit owner input**. It is not yet a canonical Decision Card, but AI MUST preserve its intent while reconciling it.

Processing rules:

1. use only question IDs already declared in `review-plan.md`;
2. process filled selections in dependency order, even if the owner filled later sheets early;
3. `CUSTOM` means `OWNER NOTE` is the controlling owner instruction;
4. candidate option text is scaffolding only and has no authority unless selected;
5. never silently replace a selected option with AI's preferred option;
6. resolve a conditional question as `N/A` only when its declared parent condition is false;
7. if two explicit owner entries truly conflict, stop only on the conflicting IDs and report the contradiction;
8. if a selection conflicts with an existing applicable canonical decision or domain/architecture contract, route the conflict correctly instead of overriding it;
9. after successful reconciliation, write/update the canonical Decision Card in `decisions.md`, synchronize `review-plan.md` and derived artifacts, then change worksheet `AI STATUS` to `PROCESSED`;
10. a worksheet edit does not Freeze anything and does not authorize implementation.

## When there are no pending worksheet selections

Default behavior is **not** to invent or repeat the question set in chat. Point the owner to the current worksheet file and current sheet. Only present questions in chat if the owner explicitly asks to review them conversationally.

The owner may fill any later worksheet in advance. Those selections remain pending until their declared dependencies are processed.

---

# 4. Route B — Show Status

Minimal read:

```text
1. README.md
2. owner-review/README.md when pending owner-input status matters
3. planning-gaps.md
4. review-plan.md if next/gate work is requested
```

For one surface, then add its Registry row, linked Decision Cards, and relevant M6 coverage.

For owner flow/topology status, `master-flow.md` may be shown as a **derived view**. If it conflicts with canonical sources, report/repair drift rather than treating the view as authority.

Do not load the whole corpus or source code for a status answer.

---

# 5. Route C — Change a Decision / Material Flow Choice

If the owner changes a flow naturally through `master-flow.md`, first identify the canonical source that must change. Never edit only the derived flow view.

Read:

```text
1. README.md
2. exact Decision Card in decisions.md, OR exact unanswered item in review-plan.md, OR related Planning Gap
3. relevant owner-review worksheet block if the owner entered a new selection there
4. review-plan.md for owner sheet/order
5. master-flow.md as the derived before/after topology view when flow is affected
6. linked Registry/Matrix rows
7. planning-gaps.md
8. domain/architecture contract if authority/rules/persistence/network/privacy semantics are affected
```

Then update the canonical source first, preserve history/supersession when applicable, calculate impact, update derived artifacts including `master-flow.md`, create/reopen gaps if required, and show only material owner consequences.

Do not Freeze automatically. Do not implement unless separately authorized and ready.

Never change product intent by editing only Master Flow, Registry, Matrix, Dashboard, worksheet option text, or code.

---

# 6. Route D — Explore Whole Product / Global Gate preparation

Use Route D when the Global Planning Gate is blocked or when an explicit whole-product/delta inventory audit is requested.

Read in layers:

```text
Phase 1 — canonical planning truth
1. README.md for current status only
2. review-plan.md
3. decisions.md
4. planning-gaps.md

Phase 2 — derived product visibility
5. master-flow.md
6. registry.md
7. matrices.md

Phase 3 — evidence cross-check
8. relevant canonical design/domain docs
9. current route/screen/component implementation
10. historical notes only when needed
```

Route D completes or revalidates the Global Planning Gate defined in `review-plan.md`:

```text
R1-R9 complete cross-check
-> M1-M6 material coverage
-> complete T2 Decision Maps for all 27 governance sheets
-> Missing / Duplication / Coverage audit
-> concise owner whole-product checkpoint
```

Rules:

- AI MAY add inventory/coverage rows from evidence.
- AI MAY materialize planned Decision Maps without choosing their answers.
- AI MAY refresh derived Master Flow from canonical decisions/maps/gaps.
- AI MUST NOT decide new product behavior while filling Master Flow, Registry, Matrix, Decision Maps, or candidate worksheet options.
- New material choices become Planning Gaps or declared map items.
- Conflicting current implementation is evidence of drift/gap, not automatic plan replacement.
- Do not ask new owner questions during this preparation unless the user explicitly changes the task or a truly blocking ambiguity requires a decision.

---

# 7. Route E — Prepare Implementation

Read:

```text
1. ../ui-ux-planning-framework.md
2. README.md
3. exact applicable Frozen/stable Decision Cards
4. planning-gaps.md
5. relevant Surface/Component/Motion contracts
6. applicable M1-M6 rows
7. relevant canonical domain/architecture contracts
8. current implementation/tests
9. templates.md for Work Order shape
```

Use `PREFLIGHT.md` as the sole readiness checklist.

A Product/UX decision cannot override rules/network/persistence/privacy semantics. If the desired UX conflicts with a canonical domain/architecture contract, return `PLANNING GAP: CONTRACT CONFLICT` rather than choosing a winner.

If requirements are incomplete, return `PLANNING GAP` or `NOT IMPLEMENTATION-READY`. Do not manufacture decisions in a Work Order.

---

# 8. Route F — Implement

After Guide/Manifest/Preflight/framework bootstrap, the exact Work Order is the scoped implementation entrypoint.

Read exactly:

```text
1. exact Work Order
2. every referenced Decision ID
3. every referenced Surface/Component/Motion contract
4. only applicable M1-M6 rows
5. domain/architecture sources listed by Work Order
6. current source/tests inside scope
```

All structured references must resolve exactly before coding.

Implementation MUST NOT treat Reviewed as Frozen, confuse Planning Maturity with Contract Readiness, broaden scope, invent fallback/authority/rules behavior, use a derived view or owner-input worksheet as product authority, or let current code overrule canonical decisions/contracts.

Unexpected material dependency -> stop and route correctly.

---

# 9. Route G — Verify / QA

Read:

```text
1. exact Work Order / acceptance scope
2. applicable Decision IDs
3. applicable detailed contracts
4. M6 acceptance rows
5. relevant M1-M5 rows
6. exact implementation diff/source
7. automated + visual evidence
```

QA compares implementation to requirements; it does not redesign.

- requirement gap -> planning;
- implementation mismatch -> implementation;
- stale derived doc -> maintenance;
- schema/reference mismatch -> maintenance/preflight failure.

---

# 10. Route H — Resolve Conflict / History

First classify whether the apparent conflict is **within one authority domain** or **across Product/UX vs domain/architecture authority**.

Read:

```text
1. framework authority-domain rules
2. relevant Product/UX Decision Card(s)
3. relevant owner-review entry if it is newly filled but not yet canonicalized
4. relevant canonical domain/architecture contract(s)
5. applicable detailed contract
6. current Work Order
7. current implementation
8. historical docs / .agents / PR history only to explain origin
```

Return one of:

- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`
- `IMPLEMENTATION DRIFT — code differs from canonical requirement`
- `DERIVED DOCUMENT DRIFT — summary/flow/inventory/coverage is stale`
- `SCHEMA / REFERENCE DRIFT — structured value is not exactly valid`
- `OWNER INPUT CONFLICT — two explicit pending owner selections cannot coexist as written`
- `PLANNING GAP: CONTRACT CONFLICT — Product/UX intent and domain/architecture authority cannot both be satisfied as written`

Never choose a winner merely because a file is newer, a UI decision is Frozen, a candidate option exists, or code currently behaves that way.

---

# 11. Stop-reading rule

More context is not automatically better.

Stop expanding document scope when the following applicable facts are known:

- Route/task;
- current sheet, Global Gate work item, or Work Order;
- relevant pending owner-review selections;
- governing exact Decision/Gap/Contract IDs;
- authority domain and source-of-truth constraints;
- required state/transition/contract detail for the tier;
- relevant Planning Gaps;
- enough implementation evidence for the requested task.

Read more only for a concrete unresolved dependency.

---

# 12. Authority anti-signals

None of these creates canonical product authority by itself:

- an unselected worksheet option;
- worksheet candidate text;
- official-sounding filename;
- newer timestamp;
- longer prose;
- presence in `.agents/`;
- current implementation behavior;
- merged old PR;
- word `final` in prose;
- existence of a Registry/Matrix/Master Flow statement;
- Reviewed status without Frozen/Contract Readiness.

A filled worksheet selection is explicit **owner input** and must be processed faithfully, but canonical made-decision authority is established by the reconciled Decision Card in `decisions.md`.

---

# 13. Missing or ambiguous reference behavior

If a referenced file/ID does not exist or is abbreviated:

1. do not substitute a similarly named source;
2. do not infer an omitted prefix/range;
3. do not reconstruct it from code;
4. check Manifest/Dashboard/Review Plan for intentional non-materialization;
5. report/repair a schema/maintenance defect or Planning Gap according to permissions;
6. do not proceed on an invented replacement.

---

# 14. Owner simplicity

This routing system is AI infrastructure, not owner homework.

Preferred owner workflow:

> Edit `docs/design/ui-ux/owner-review/` in GitHub, fill `OWNER SELECT` / `OWNER NOTE`, then ask AI to process the worksheet.

The owner may still say naturally:

> "그 전투 타겟팅 결정 바꾸자."

AI locates the canonical decision/map/gap, checks owner worksheet input when relevant, reads the minimum dependency set, reconciles without changing explicit choices, updates derived views, and surfaces only material consequences.

---

# 15. Final principle

> **Route first. Verify schema and roles. Pass Preflight. Read pending owner worksheet input before asking questions. Respect authority domains and the Global Planning Gate. Read from canonical intent toward derived views and evidence. Stop when enough is known. Never infer product truth backward from code, a candidate option, or a derived document.**
