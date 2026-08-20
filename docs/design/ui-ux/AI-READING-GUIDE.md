# SimpleVTT UI/UX AI Reading Guide

Status: canonical reading-order and task-routing guide for UI/UX planning and implementation agents

This file answers four questions:

1. **What kind of task am I doing?**
2. **Which documents are authoritative for that task?**
3. **What order do I read them in?**
4. **When do I stop reading and start working?**

Reading order is part of the specification.

---

# 0. Mandatory AI entry sequence

If you are an AI working on SimpleVTT UI/UX, start here unless an external higher-priority instruction explicitly says otherwise.

```text
1. AI-READING-GUIDE.md        -> classify task Route A-H
2. MANIFEST.yaml              -> confirm document roles, authority, derived/canonical status
3. PREFLIGHT.md               -> verify consistency/readiness for that route
4. route-specific documents   -> read only what the route requires
5. perform work
```

Do not start by scanning source code.
Do not start from `.agents/`.
Do not start from `registry.md` or `matrices.md`.
Do not reconstruct product truth from Git history or current behavior.

If `MANIFEST.yaml` and actual files disagree, treat that as document drift and repair/report it before substantive work.

---

# 1. Document roles

The files are not peers.

| Priority | Document | Role | Authority type |
| --- | --- | --- | --- |
| `P0` | `AI-READING-GUIDE.md` | AI task router and reading-order rules | canonical process |
| `P0` | `MANIFEST.yaml` | machine-readable document map and entrypoints | canonical process map |
| `P0` | `PREFLIGHT.md` | start-work drift/readiness gate | canonical process |
| `P0` | `../ui-ux-planning-framework.md` | governance, status, no-invention, spec tiers, Work Orders | canonical framework |
| `P0` | `README.md` | current dashboard / next work | **derived summary** |
| `P0` | `review-plan.md` | review order + undecided Decision Maps | canonical for question order |
| `P1` | `decisions.md` | made owner/product Decision Cards | canonical for made UI/UX decisions |
| `P1` | `master-flow.md` | product flow / surface topology | canonical planning baseline; currently Draft |
| `P1` | `planning-gaps.md` | known material unknowns AI must not invent | canonical gap queue |
| `P2` | `registry.md` | R1-R9 inventory; Planning + Contract readiness | derived inventory |
| `P2` | `matrices.md` | M1-M6 cross-cutting coverage | derived coverage |
| `P2` | `templates.md` | artifact templates | canonical process template |
| `P2` | `surfaces/*`, `components/*`, `motion/*` | detailed contracts | canonical within referenced scope when materialized/approved |
| `P2` | `work-orders/*` | exact implementation handoff | scoped execution contract |
| `P3` | other `docs/design/*`, `docs/rules/*`, schemas | domain/architecture constraints | canonical according to their scope |
| `P4` | current source/tests | implementation evidence | evidence only unless another contract says otherwise |
| `P5` | `.agents/*`, historical PRs/issues | working/history evidence | non-canonical by default |

Priority means **read before lower-priority sources when applicable**, not “read every file.”

---

# 2. Mandatory task router

Classify the user request into one primary route before broad reading.

| Route | Task |
| --- | --- |
| `A — Resume Planning` | continue planned UX review / ask next decision |
| `B — Show Status` | show current progress, remaining gaps, next work |
| `C — Change a Decision` | alter/reverse an existing UX choice |
| `D — Explore Whole Product` | inventory/cross-check all screens, UI types, flows, gaps |
| `E — Prepare Implementation` | assess readiness / create scoped Work Order |
| `F — Implement` | modify code from approved planning/work order |
| `G — Verify / QA` | validate implementation against decisions/contracts |
| `H — Resolve Conflict / History` | determine which conflicting source governs |

For mixed requests, resolve authority first.

Example:

```text
"이 결정을 바꾸고 바로 구현해"
= Route C first
-> then Route E
-> then Route F only if ready and authorized
```

After route classification, run the applicable preflight in `PREFLIGHT.md`.

---

# 3. Route A — Resume Planning

Read:

```text
1. README.md
2. review-plan.md
3. relevant made Decision Cards in decisions.md
4. planning-gaps.md entries linked to current sheet
5. master-flow.md only if topology/flow matters
6. relevant registry/matrix rows only if they explain consequences
7. relevant domain/code evidence only if grounding is required
```

Before asking anything, confirm:

- current sheet;
- complete Decision Map exists;
- next ID is predeclared;
- dependencies are known;
- migrated prior decisions do not already answer it;
- no gap requires routing elsewhere.

Ask **one** predeclared decision.

Do not store unanswered questions in `decisions.md`; they belong to `review-plan.md`.

---

# 4. Route B — Show Status

Default minimal read:

```text
1. README.md
2. planning-gaps.md
3. review-plan.md only if next review work is requested
```

For status on one surface, then add:

```text
4. relevant registry row
5. linked Decision Cards
6. relevant M6 coverage row if present
```

Do not load all decisions, all matrices, or source code just to answer status.

Remember: Dashboard is derived. If it conflicts with canonical sources, repair/report the dashboard rather than treating it as authority.

---

# 5. Route C — Change an Existing Decision

Read:

```text
1. README.md
2. decisions.md -> exact canonical Decision Card
3. review-plan.md -> owner sheet/order
4. master-flow.md if topology/flow changes
5. linked registry/matrix rows
6. planning-gaps.md
7. domain/architecture contract if rules/authority/persistence/network semantics are involved
```

Then:

1. update one canonical Decision Card;
2. preserve supersession/history if needed;
3. calculate impact automatically;
4. update derived Registry/Matrix/Dashboard references/readiness;
5. create/reopen Planning Gaps when required;
6. show owner only material consequences;
7. do not Freeze automatically;
8. do not implement unless separately authorized and ready.

Never “change a decision” by editing only code, Registry, Matrix, or Dashboard.

---

# 6. Route D — Explore / Inventory Whole Product

Use three phases.

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
8. relevant canonical design/domain docs
9. current route/screen/component implementation
10. historical notes only when needed
```

Rules:

- AI MAY add inventory/coverage rows from evidence.
- AI MAY update derived Contract Readiness when gaps/contracts clearly change.
- AI MUST NOT create new product behavior while filling inventory/matrices.
- Conflicting implementation becomes drift/gap evidence, not automatic plan replacement.
- Do not ask new owner questions during the coverage pass unless the owner changes the task to review.

---

# 7. Route E — Prepare Implementation

Read:

```text
1. ../ui-ux-planning-framework.md
2. README.md
3. exact applicable Decision Cards
4. planning-gaps.md
5. relevant Surface/Component/Motion contracts
6. applicable M1-M6 rows
7. relevant canonical domain/architecture contracts
8. current implementation/tests
9. templates.md for Work Order shape
```

Readiness requires at minimum:

- correct Spec Tier;
- applicable stable/Frozen dependencies;
- no material blocking gap;
- required contracts for the tier;
- S2/S3 state transitions;
- S3 authority/visibility/persistence source-of-truth;
- accessibility/responsive/temporal detail as applicable;
- known legacy status;
- Registry Contract Readiness compatible with implementation.

If not ready, return `PLANNING GAP` or `NOT IMPLEMENTATION-READY`.

Do not manufacture missing product decisions inside a Work Order.

---

# 8. Route F — Implement

When a Work Order exists, it becomes the scoped implementation entrypoint after Guide/Manifest/Preflight/framework bootstrap.

Read exactly:

```text
1. ../ui-ux-planning-framework.md
2. exact work-orders/<ID>.md
3. every referenced Decision ID
4. every referenced Surface/Component/Motion contract
5. only applicable M1-M6 rows
6. domain/architecture sources listed by Work Order
7. current source/tests inside scope
```

Implementation MUST NOT:

- treat Reviewed as Frozen;
- treat Planning Maturity as Contract Readiness;
- broaden scope because adjacent code is old;
- invent fallback/authority/rules behavior;
- let current code overrule referenced canonical decisions;
- repair unrelated UX inside one Work Order.

Unexpected material dependency -> stop and route back through Preflight/Planning Gap.

---

# 9. Route G — Verify / QA

Read:

```text
1. exact Work Order / verification scope
2. applicable Decision IDs
3. applicable Surface/Component/Motion contracts
4. M6 acceptance rows
5. relevant M1-M5 rows
6. implementation diff/source
7. automated + visual evidence
```

QA compares implementation to requirements; it does not redesign.

- requirement gap -> planning;
- implementation mismatch -> implementation;
- stale derived doc -> maintenance.

Keep those classes separate.

---

# 10. Route H — Resolve Conflict / History

Read highest authority downward:

```text
1. framework precedence rules
2. relevant Frozen Decision Card(s)
3. relevant canonical domain/architecture contract
4. applicable detailed contract
5. current Work Order
6. current implementation
7. historical docs / .agents / PR history only to explain origin
```

Return one of:

- `NO CONFLICT — scopes differ`
- `SUPERSEDED — lower source is historical`
- `IMPLEMENTATION DRIFT — code differs from canonical plan`
- `DERIVED DOCUMENT DRIFT — summary/inventory/coverage is stale`
- `PLANNING GAP: CONTRACT CONFLICT — applicable high-level sources conflict`

Never choose a winner merely because one file is newer or current code runs that way.

---

# 11. Reading stop rules

More context is not automatically better.

Stop expanding the document set when all applicable items are known:

- route/task;
- current sheet or Work Order;
- applicable Decision IDs;
- authority/source-of-truth constraints;
- required surface/state/transition constraints for the tier;
- relevant gaps;
- enough implementation evidence for the requested task.

Do not continue reading “just to be exhaustive.”

Read more only for a concrete unresolved dependency.

---

# 12. Authority anti-signals

None of these make a source authoritative by themselves:

- official-sounding filename;
- newer timestamp;
- longer/more detailed prose;
- presence in `.agents/`;
- current implementation behavior;
- merged historical PR;
- the word `final` in prose;
- existence of a Registry row;
- `Reviewed` status without Frozen/contract readiness.

Use framework precedence, `MANIFEST.yaml`, stable IDs, and explicit scope.

---

# 13. Cross-document ownership rules

```text
review-plan.md
  owns: undecided question maps and review order

decisions.md
  owns: made product/UX decision bodies

planning-gaps.md
  owns: known material unknowns / blockers

master-flow.md
  owns: owner-friendly product flow/topology baseline

registry.md
  owns: derived R1-R9 inventory + Planning/Contract status

matrices.md
  owns: derived M1-M6 cross-cutting coverage

README.md
  owns: derived current-state summary only

MANIFEST.yaml
  owns: machine-readable document roles/entrypoints
```

Do not copy one file's owned fact into another as a second canonical body.

---

# 14. Missing-file / missing-ID behavior

If a referenced file/ID does not exist:

1. do not substitute a similarly named file;
2. do not reconstruct it from code;
3. check `MANIFEST.yaml`, dashboard, and review plan for intentional non-materialization;
4. if required, report/repair a maintenance defect or Planning Gap according to framework permissions;
5. do not proceed on an invented replacement.

---

# 15. New AI self-check

Before substantive work, the AI should be able to answer:

```text
What Route A-H am I on?
Did PREFLIGHT pass?
What is the current sheet or Work Order?
What is the next authorized action?
Which Decision IDs govern it?
Which file owns undecided questions vs made decisions?
Which sources are canonical vs derived vs evidence?
What is Planning Maturity vs Contract Readiness for affected artifacts?
Which open gaps touch the scope?
What documents do I NOT need to read?
What would make me stop?
```

If materially unknown, follow this guide rather than guessing.

---

# 16. Owner simplicity rule

This routing system is AI infrastructure, not owner homework.

The owner may say naturally:

> "그 전투 타겟팅 결정 바꾸자."

AI must locate the decision, read the minimum dependency set, run impact checks, update derived structure, and surface only material consequences.

The owner should never need to manually route the AI through matrices, manifests, or IDs.

---

# 17. Final principle

> **Route first. Verify document roles. Pass preflight. Read from canonical intent toward implementation evidence. Stop when enough is known. Never infer product truth backward from code.**
