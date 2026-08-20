# SimpleVTT UI/UX Preflight

Status: canonical start-work consistency gate

Run this before substantive UI/UX planning, implementation preparation, implementation, or QA.

The goal is to catch document drift, wrong reading order, premature review, stale readiness, and accidental AI invention **before** work begins.

This file is the sole canonical owner of start-work checks. Templates and Work Orders reference this file instead of maintaining duplicate checklists.

---

# 1. Minimal preflight

An AI must be able to answer all applicable items:

```text
[ ] Task Route A-H identified from AI-READING-GUIDE.md
[ ] MANIFEST.yaml checked for document roles / canonical-vs-derived status
[ ] Correct route-specific entry documents read
[ ] Current review sheet OR exact Work Order identified
[ ] Relevant Planning Gaps checked
[ ] Referenced made Decision IDs actually exist in decisions.md
[ ] No undecided question body is duplicated into decisions.md
[ ] Registry Planning Maturity is not being mistaken for Contract Readiness
[ ] Dashboard / Gap / Registry / Matrix summaries are not visibly stale
[ ] Current code is being used as evidence only
[ ] No missing authority / behavior / fallback is being inferred
```

If a material item fails:

```text
PREFLIGHT FAILED
Task Route:
Failure:
Affected files / IDs:
Required maintenance or planning action:
```

---

# 2. Derived-document drift check

Compare at minimum:

```text
README gate/current-next status
    <-> review-plan.md + MANIFEST.yaml

README open-gap/status summary
    <-> planning-gaps.md + decisions.md + master-flow.md + registry.md + matrices.md

registry Planning Maturity
    <-> decisions.md

registry Contract Readiness
    <-> open Planning Gaps / required contracts

matrices source IDs
    <-> decisions.md / registry.md / planning-gaps.md

templates enums/check references
    <-> MANIFEST.yaml / planning-gaps.md / this PREFLIGHT.md
```

A stale derived artifact is a maintenance defect, not a new product decision.

AI MAY repair obvious derived drift when framework permissions allow it. AI MUST NOT alter canonical product decisions merely to make summaries agree.

---

# 3. Global Planning Gate preflight

Until the current global planning reset is complete, **no individual governance question may resume, including `UX-02-01`**.

Before Route A may ask an individual question, verify all:

```text
[ ] R1-R9 complete Master UI Inventory cross-check is complete
[ ] M1-M6 material coverage is complete for all material Registry items
[ ] all 27 governance sheets have complete predeclared Decision Maps:
    [ ] Scope
    [ ] Non-scope
    [ ] full decision list
    [ ] dependencies / conditional branches
    [ ] Exit Criteria
[ ] Missing / Duplication / Coverage audit passes:
    [ ] every Registry item has a governing owner
    [ ] every governance sheet has inventory / Decision-Map coverage
    [ ] no normative requirement has duplicate canonical authority
    [ ] all material unknowns are explicit Planning Gaps
[ ] owner has received a concise whole-product coverage checkpoint
```

If any box fails, Route A MUST NOT ask the next UX question. Continue Route D preparation instead.

Canonical gate detail: `review-plan.md`.

---

# 4. Planning-route preflight

For `A — Resume Planning`, `C — Change Decision`, or `D — Explore Whole Product`:

```text
[ ] review-plan.md contains the relevant sheet/map state
[ ] already-answered items are not being asked again
[ ] migrated prior decisions are checked before creating questions
[ ] new discoveries are routed to Planning Gaps/downstream maps instead of asked ad hoc
[ ] no product behavior is decided while merely filling Registry/Matrix/coverage
[ ] AI has not changed declared review order without owner approval
```

For Route A after Global Gate passes, AI can name exactly:

```text
Current sheet:
Current Decision ID:
Dependencies:
Known related gaps:
Next predeclared ID:
```

For Route D, the goal is coverage preparation, not decision review.

---

# 5. Decision-change preflight

Before changing a decision:

```text
[ ] Exact canonical Decision Card located
[ ] Current maturity/status known
[ ] Frozen status checked explicitly
[ ] Dependencies / Affects references identified
[ ] master-flow impact checked when applicable
[ ] relevant gaps checked
[ ] domain/architecture contract checked when rules/authority/persistence/network semantics are involved
```

The owner may describe the change naturally; AI resolves the ID.

---

# 6. Implementation-readiness preflight

Before creating/approving a Work Order:

```text
[ ] Spec Tier selected (S0/S1/S2/S3)
[ ] applicable stable/Frozen dependencies identified
[ ] no material blocking Planning Gap remains
[ ] required Surface/Component/Motion contracts exist for the tier
[ ] S2/S3 transitions are explicit
[ ] S3 authority / visibility / persistence source-of-truth is explicit
[ ] required accessibility states are explicit
[ ] required responsive states are explicit
[ ] required temporal/reduced-motion behavior is explicit when applicable
[ ] legacy status is known for touched paths
[ ] Contract Readiness is Ready for the scope, or approved Work Order contains the remaining permitted contract detail
[ ] implementation is explicitly authorized; planning status alone is not authorization
```

If not ready:

```text
NOT IMPLEMENTATION-READY
Blocked by:
Smallest action needed:
```

Do not create missing product decisions inside a Work Order.

---

# 7. Implementation preflight

Before code changes:

```text
[ ] Exact Work Order identified
[ ] IN SCOPE / ALLOWED SIDE EFFECT / OUT OF SCOPE / MUST NOT CHANGE understood
[ ] referenced Decision IDs loaded
[ ] referenced contracts loaded
[ ] applicable M1-M6 rows loaded
[ ] relevant canonical domain/architecture sources loaded
[ ] current source/tests inspected only after requirements are known
[ ] no adjacent cleanup is being smuggled into scope
[ ] Stop Conditions are known
```

Unexpected material dependency is not permission to expand scope.

---

# 8. QA preflight

Before verification:

```text
[ ] Exact Work Order / acceptance scope known
[ ] Decision and contract IDs known
[ ] M6 required coverage known
[ ] relevant M1-M5 constraints known
[ ] exact implementation revision/diff known
[ ] required automated evidence known
[ ] required visual evidence known
[ ] owner walkthrough requirement known
```

QA does not redesign: requirement gap -> planning; implementation mismatch -> implementation; stale derived document -> maintenance.

---

# 9. Anti-patterns that fail Preflight

Fail if AI is about to:

- read source first and infer the UX plan;
- treat Reviewed as implementation-ready;
- use a Registry row instead of a Decision Card;
- choose behavior because a Matrix cell is `TBD`;
- resolve a canonical conflict by choosing the newest document;
- store an undecided Decision Map in `decisions.md`;
- leave a resolved infrastructure gap marked Open;
- maintain a second preflight checklist in a template/Work Order;
- resume UX-02 or any individual sheet before the Global Planning Gate passes;
- change review order without owner approval;
- ask a spontaneous owner question before registering it in the map/gap queue;
- broaden implementation because nearby code looks wrong.

---

# 10. Completion token

AI may record:

```text
PREFLIGHT: PASS
Route: <A-H>
Scope: <sheet / decision / work-order ID>
Global Planning Gate: PASS / BLOCKED / N/A
Blocking gaps: none / <IDs>
Contract readiness: N/A / Partial for planning / Ready for implementation
```

The token is evidence of a check, not a substitute for source documents.

---

# 11. Owner simplicity

The owner does not run this checklist.

AI runs it as infrastructure and only surfaces failures requiring a product/owner decision.

> The owner controls product intent; Preflight ensures AI keeps the planning system consistent around that intent.
