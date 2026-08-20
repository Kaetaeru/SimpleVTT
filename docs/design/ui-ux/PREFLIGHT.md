# SimpleVTT UI/UX Preflight

Status: canonical start-work consistency gate

Run this before substantive UI/UX planning, implementation preparation, implementation, or QA.

The goal is to catch document drift, wrong reading order, premature review, stale readiness, schema/reference errors, and accidental AI invention **before** work begins.

This file is the sole canonical owner of start-work checks. Templates and Work Orders reference this file instead of maintaining duplicate checklists.

---

# 1. Minimal preflight

An AI must be able to answer all applicable items:

```text
[ ] Task Route A-H identified from AI-READING-GUIDE.md
[ ] MANIFEST.yaml checked for document roles / canonical-vs-derived status / schema version
[ ] Correct route-specific entry documents read
[ ] Current review sheet OR exact Work Order identified
[ ] Relevant Planning Gaps checked
[ ] Referenced made Decision IDs actually exist in decisions.md
[ ] No undecided question body is duplicated into decisions.md
[ ] Registry Planning Maturity is not being mistaken for Contract Readiness
[ ] Master Flow is being treated as a derived owner view, not as a second decision store
[ ] Dashboard / Master Flow / Gap / Registry / Matrix summaries are not visibly stale
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

# 2. Schema and exact-reference check

Before substantive work, verify structured fields against `MANIFEST.yaml`.

```text
[ ] every Decision Card Status is exactly Draft / Selected / Reviewed / Frozen / Superseded
[ ] every governance-sheet Review Status is exactly Not Started / In Review / Reviewed
[ ] every Planning Gap Status is exactly Open / Deferred / Resolved
[ ] every Gap Type and Severity matches the declared enum
[ ] every Registry Planning value matches planning_maturity
[ ] every Registry Contract value matches contract_readiness
[ ] every M6 coverage cell is exactly REQ / N/A / TBD / a full contract-or-test ID
[ ] every structured reference uses a full resolvable ID/path
[ ] no reference range such as UX-01-04..06 exists
[ ] no omitted-prefix reference such as ORIGIN-UX-01-26, 28 exists
[ ] no prose substitute such as destination DM-01 appears in a structured reference field
[ ] every Decision Map labeled Complete satisfies T2 Scope / Non-scope / Exit Criteria / table schema
[ ] Surface/Component/Motion contracts do not invent an undefined independent lifecycle Status
```

A human-readable note may contain prose. A structured enum/reference field may not depend on contextual interpretation.

If exact resolution is impossible, fail Preflight rather than guessing the intended prefix/ID.

---

# 3. Derived-document drift check

Compare at minimum:

```text
README gate/current-next status
    <-> review-plan.md + MANIFEST.yaml

README open-gap/status summary
    <-> planning-gaps.md + decisions.md + master-flow.md + registry.md + matrices.md

review-plan.md Review Status
    <-> actual sequential review progress (not seed coverage or Decision Frozen status)

master-flow.md material behavior/topology
    <-> decisions.md + review-plan.md + planning-gaps.md

registry Planning Maturity
    <-> made decisions for the artifact as a whole

registry Contract Readiness
    <-> active Planning Gaps / required contracts

matrices source/ref IDs
    <-> decisions.md / review-plan.md / registry.md / planning-gaps.md / canonical paths

templates enums/reference syntax
    <-> MANIFEST.yaml / planning-gaps.md / this PREFLIGHT.md
```

Fail if a material UX rule exists **only** in `master-flow.md`, Registry, Matrix, or Dashboard with no canonical Decision/Map/Gap/contract source.

A reviewed sub-decision does not automatically promote an entire Registry artifact to `Reviewed` when material behavior/topology remains unresolved.

A stale derived artifact is a maintenance defect, not a new product decision.

AI MAY repair obvious derived drift when framework permissions allow it. AI MUST NOT alter canonical product decisions merely to make summaries agree.

---

# 4. Planning truth / implementation reliance / authority-domain check

First distinguish planning intent from implementation stability.

```text
[ ] applicable Selected / Reviewed / Frozen Product/UX Decision Cards are treated as canonical planning intent over current code
[ ] Draft decisions are not treated as made product intent
[ ] Superseded decisions are historical only
[ ] only Frozen Product/UX decisions are treated as stable implementation dependencies unless explicitly authorized otherwise
[ ] UI/product requirement is within Product/UX authority
[ ] rules legality/calculation remains domain authority
[ ] authoritative state/persistence/network/privacy/schema remains domain/architecture authority
[ ] no Frozen UI decision is being used to silently override a domain/architecture contract
[ ] any cross-domain contradiction is classified as PLANNING GAP: CONTRACT CONFLICT
```

Therefore a Reviewed decision may prove that current code is product-planning drift while still being insufficient to authorize implementation.

Current implementation is evidence only in both authority domains.

---

# 5. Global Planning Gate preflight

Until the current global planning reset is complete, **no individual governance question may resume, including `UX-02-01`**.

Before Route A may ask an individual question, verify all:

```text
[ ] R1-R9 complete Master UI Inventory cross-check is complete
[ ] M1-M6 material coverage is complete for all material Registry items
[ ] all 27 governance sheets have complete predeclared T2 Decision Maps:
    [ ] Scope
    [ ] Non-scope
    [ ] Exit Criteria
    [ ] full decision list
    [ ] Status
    [ ] full dependency IDs / conditional branches
    [ ] Destination
[ ] Missing / Duplication / Coverage audit passes:
    [ ] every Registry item has a governing owner
    [ ] every governance sheet has inventory / Decision-Map coverage
    [ ] no normative requirement has duplicate canonical authority
    [ ] every material unknown is explicitly represented by a Draft Decision Map item or Planning Gap rather than AI inference
[ ] owner has received a concise whole-product coverage checkpoint
```

If any box fails, Route A MUST NOT ask the next UX question. Continue Route D preparation instead.

Canonical gate detail: `review-plan.md`.

---

# 6. Planning-route preflight

For `A — Resume Planning`, `C — Change Decision`, or `D — Explore Whole Product`:

```text
[ ] review-plan.md contains the relevant sheet/map state
[ ] already-answered items are not being asked again
[ ] migrated prior decisions are checked before creating questions
[ ] new discoveries are routed to Planning Gaps/downstream maps instead of asked ad hoc
[ ] no product behavior is decided while merely filling Registry/Matrix/coverage
[ ] AI has not changed declared review order without owner approval
[ ] material owner flow changes are translated to canonical Decision/Map/Gap sources before refreshing master-flow.md
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

# 7. Decision-change preflight

Before changing a decision:

```text
[ ] Exact canonical Decision Card located
[ ] Current exact lifecycle Status known
[ ] Frozen status checked explicitly
[ ] Dependencies identified with full IDs
[ ] impact scope identified
[ ] derived master-flow impact checked when applicable
[ ] relevant gaps checked
[ ] domain/architecture contract checked when rules/authority/persistence/network semantics are involved
```

The owner may describe the change naturally; AI resolves the ID.

---

# 8. Implementation-readiness preflight

Before creating/approving a Work Order:

```text
[ ] Spec Tier selected (S0/S1/S2/S3)
[ ] applicable stable/Frozen dependencies identified with full IDs
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

# 9. Implementation preflight

Before code changes:

```text
[ ] Exact Work Order identified
[ ] IN SCOPE / ALLOWED SIDE EFFECT / OUT OF SCOPE / MUST NOT CHANGE understood
[ ] referenced Decision IDs loaded and exactly resolvable
[ ] referenced contracts loaded
[ ] applicable M1-M6 rows loaded
[ ] relevant canonical domain/architecture sources loaded
[ ] current source/tests inspected only after requirements are known
[ ] no adjacent cleanup is being smuggled into scope
[ ] Stop Conditions are known
```

Unexpected material dependency is not permission to expand scope.

---

# 10. QA preflight

Before verification:

```text
[ ] Exact Work Order / acceptance scope known
[ ] Decision and contract IDs known and exactly resolvable
[ ] M6 required coverage known
[ ] relevant M1-M5 constraints known
[ ] exact implementation revision/diff known
[ ] required automated evidence known
[ ] required visual evidence known
[ ] owner walkthrough requirement known
```

QA does not redesign: requirement gap -> planning; implementation mismatch -> implementation; stale derived document -> maintenance.

---

# 11. Anti-patterns that fail Preflight

Fail if AI is about to:

- read source first and infer the UX plan;
- let current code replace an applicable Selected/Reviewed planning decision merely because it is not Frozen;
- treat Reviewed as implementation-ready or as stable implementation reliance;
- store `Reviewed, not Frozen` as a lifecycle Status value;
- store seed-coverage prose inside governance-sheet Review Status;
- promote a Registry artifact to Reviewed merely because one sub-decision is Reviewed while material artifact behavior remains unresolved;
- use a Registry row or Master Flow statement instead of a Decision Card as product authority;
- choose behavior because a Matrix cell is `TBD`;
- accept a shorthand/ranged reference that requires prefix inference;
- mark a Decision Map Complete while required T2 fields are absent;
- invent an independent Surface/Component/Motion contract Status lifecycle not declared by the framework/Manifest;
- resolve a canonical conflict by choosing the newest document;
- use UI precedence to override a domain/network/privacy contract;
- store an undecided Decision Map in `decisions.md`;
- leave a resolved infrastructure gap marked Open;
- maintain a second preflight checklist in a template/Work Order;
- resume UX-02 or any individual sheet before the Global Planning Gate passes;
- change review order without owner approval;
- ask a spontaneous owner question before registering it in the map/gap queue;
- broaden implementation because nearby code looks wrong.

---

# 12. Completion token

AI may record:

```text
PREFLIGHT: PASS
Schema: PASS
References: PASS
Planning truth: PASS
Implementation reliance: PASS
Route: <A-H>
Scope: <sheet / decision / work-order ID>
Global Planning Gate: PASS / BLOCKED / N/A
Blocking gaps: none / <full IDs>
Contract readiness: N/A / Partial for planning / Ready for implementation
```

The token is evidence of a check, not a substitute for source documents.

---

# 13. Owner simplicity

The owner does not run this checklist.

AI runs it as infrastructure and only surfaces failures requiring a product/owner decision.

> The owner controls product intent; Preflight ensures AI keeps the planning system consistent around that intent.
