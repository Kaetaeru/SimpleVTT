# SimpleVTT UI/UX Preflight

Status: canonical start-work consistency gate

Run this preflight before substantive UI/UX planning, implementation preparation, implementation, or QA.

The purpose is not bureaucracy. It is to catch document drift, wrong reading order, stale status, and accidental AI invention **before** work begins.

---

# 1. Minimal preflight

An AI must be able to answer all items below before proceeding:

```text
[ ] Task route A-H identified from AI-READING-GUIDE.md
[ ] Correct entrypoint documents read for that route
[ ] Current review sheet OR exact Work Order identified
[ ] Next planning Decision ID agrees with review-plan.md, when planning
[ ] Referenced Decision IDs exist in decisions.md, when they are supposed to be decided
[ ] No undecided question body is duplicated into decisions.md
[ ] Relevant Planning Gaps checked
[ ] Registry Planning Maturity is not being mistaken for Contract Readiness
[ ] Dashboard / Gap / Registry / Matrix summaries are not visibly stale against their canonical sources
[ ] Current code is being used as evidence only
[ ] No missing authority / product behavior / fallback is being inferred
```

If every applicable item passes, continue.

If any material item fails, stop with:

```text
PREFLIGHT FAILED
Task route:
Failure:
Affected files / IDs:
Required maintenance or planning action:
```

---

# 2. Derived-document drift check

Because `README.md`, `registry.md`, and `matrices.md` are derived or summary artifacts, explicitly check for stale statements.

At minimum compare:

```text
README current-next status
    <-> review-plan.md

README open-gap summary
    <-> planning-gaps.md

registry Planning maturity
    <-> decisions.md

registry Contract readiness
    <-> open Planning Gaps / required contracts

matrices source IDs
    <-> decisions.md / registry.md / planning-gaps.md
```

A stale derived artifact is a maintenance defect, not a new product decision.

AI MAY repair obvious derived drift when the framework allows maintenance without owner approval.
AI MUST NOT alter canonical product decisions merely to make derived documents agree.

---

# 3. Planning-route preflight

For routes `A Resume Planning`, `C Change Decision`, or `D Explore Whole Product`:

```text
[ ] review-plan.md contains the current sheet and declared map
[ ] already-answered items are not being asked again
[ ] migrated prior decisions are checked before creating new questions
[ ] current question belongs to the declared sheet/scope
[ ] new discoveries are routed to Planning Gaps/downstream map instead of asked ad hoc
[ ] no product behavior will be decided while merely filling Registry/Matrix coverage
```

For a normal next-question turn, the AI should be able to name exactly:

```text
Current sheet:
Current Decision ID:
Dependencies:
Known related gaps:
Next predeclared ID:
```

---

# 4. Decision-change preflight

Before changing a decision:

```text
[ ] Exact canonical Decision Card located
[ ] Current status known
[ ] Frozen status checked explicitly
[ ] Dependencies and Affects references identified
[ ] Relevant master-flow impact checked
[ ] Relevant gap(s) checked
[ ] Domain/architecture contract checked if authority/rules/persistence/network semantics are involved
```

If the user changed the idea in plain language, AI is responsible for resolving the affected ID. The owner does not need to provide it.

---

# 5. Implementation-readiness preflight

Before creating or approving a Work Order:

```text
[ ] Spec Tier selected (S0/S1/S2/S3)
[ ] Applicable stable/Frozen dependencies identified
[ ] No material blocking Planning Gap remains
[ ] Required Surface/Component/Motion contracts exist for the tier
[ ] S2/S3 state transitions are explicit
[ ] S3 authority / visibility / persistence source-of-truth is explicit
[ ] Required accessibility states are explicit
[ ] Required responsive states are explicit
[ ] Required temporal/reduced-motion behavior is explicit when applicable
[ ] Legacy status is known for touched paths
[ ] Contract Readiness is Ready for the implementation scope, or the Work Order explicitly contains the remaining approved contract detail
[ ] Implementation is explicitly authorized; planning status alone is not authorization
```

If not ready, report:

```text
NOT IMPLEMENTATION-READY
Blocked by:
Smallest action needed:
```

Do not create missing product decisions inside a Work Order.

---

# 6. Implementation preflight

Before modifying code:

```text
[ ] Exact Work Order identified
[ ] IN SCOPE / OUT OF SCOPE / MUST NOT CHANGE understood
[ ] Referenced Decision IDs loaded
[ ] Referenced contracts loaded
[ ] Applicable M1-M6 rows loaded
[ ] Relevant canonical domain/architecture sources loaded
[ ] Current source/tests inspected only after requirements are known
[ ] No adjacent cleanup is being smuggled into scope
[ ] Stop Conditions are known
```

A surprising dependency discovered during implementation is not permission to expand scope. Stop and route it correctly.

---

# 7. QA preflight

Before verification:

```text
[ ] Exact Work Order / acceptance scope known
[ ] Decision IDs and contract IDs known
[ ] M6 required coverage known
[ ] Relevant M1-M5 constraints known
[ ] Exact implementation revision/diff known
[ ] Required automated evidence known
[ ] Required visual evidence known
[ ] Owner walkthrough requirement known
```

QA does not redesign. A requirement gap returns to planning; an implementation mismatch returns to implementation.

---

# 8. Preflight anti-patterns

Fail preflight if the AI is about to do any of these:

- read source code first and infer the UX plan from it;
- treat `Reviewed` as equivalent to implementation-ready;
- use a Registry row as a substitute for a Decision Card;
- choose a behavior because a matrix cell is `TBD`;
- silently fix a canonical conflict by selecting the newest document;
- copy an undecided Decision Map into the Decision Ledger;
- leave a resolved infrastructure gap marked Open;
- create a Work Order from Selected/Reviewed planning without checking stability and gaps;
- ask a spontaneous new owner question before adding it to the declared map/gap queue;
- expand implementation scope because nearby code looks wrong.

---

# 9. Preflight completion token

For internal planning notes or Work Orders, AI may record this compact checkpoint:

```text
PREFLIGHT: PASS
Route: <A-H>
Scope: <sheet / decision / work-order ID>
Blocking gaps: none / <IDs>
Contract readiness: N/A / Partial for planning / Ready for implementation
```

This is evidence of a check, not a substitute for the underlying documents.

---

# 10. Owner simplicity rule

The owner does not need to run or understand this checklist.

AI runs it silently as part of its workflow and only surfaces failures that require an owner/product decision.

> The owner controls product intent; preflight exists so AI reliably maintains the planning system around that intent.
