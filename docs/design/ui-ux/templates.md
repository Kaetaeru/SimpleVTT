# SimpleVTT UI/UX Planning Templates

These templates are designed for **copy-safe AI use**. Use only the lightest template required by the framework's specification tier.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Preflight: [`PREFLIGHT.md`](PREFLIGHT.md)

## Reference rule for all templates

Any field whose purpose is to reference another artifact MUST use complete resolvable IDs/paths as defined in `MANIFEST.yaml`.

Valid: `UX-01-04, UX-01-05, UX-01-06`

Invalid: `UX-01-04..06`, `ORIGIN-UX-01-26, 28`, `destination DM-01`

Do not rely on omitted prefixes, ID ranges, or contextual prose to reconstruct a reference.

---

## T1 — Decision Card

Default owner-facing canonical unit.

```text
Decision ID:
Title:
Status: Draft / Selected / Reviewed / Frozen / Superseded
Applies To:
Decision:
Why:
Depends On: none / <full IDs>
Affects:
Planning Gap: none / <full Gap IDs>
```

Optional only when needed:

```text
Role / Connection Applicability:
Supersedes / Superseded By:
Legacy Status:
Authority / Visibility Note:
Change Note:
```

### Decision Card constraints

- One material product decision per card.
- `Status` contains exactly one enum value; explanatory text belongs in another field/paragraph.
- Keep `Decision` concise.
- Do not include implementation instructions unless the implementation constraint is itself the product decision.
- Do not copy the same normative text into Registry, Matrix, Master Flow, Dashboard, or Work Order files.

---

## T2 — Decision Map

Must exist in `review-plan.md` before individual questions for that governance sheet begin.

A map may be labeled `Complete` only when every required field below is present.

```markdown
# <Sheet ID> — <Sheet Name>

Scope:
Non-scope:
Exit Criteria:

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| ... | ... | Draft | none / <full IDs> | no | <full sheet/artifact IDs> |
```

Conditional branch example:

```text
If UX-02-09 = include extra roles:
  ask UX-02-09A
Else:
  skip UX-02-09A
```

Never add an untracked question between declared IDs.

---

## T3 — Planning Gap

Use the canonical enums declared in `MANIFEST.yaml` / `planning-gaps.md`.

```text
PLANNING GAP
Gap ID:
Gap Type: OWNER_DECISION / DOMAIN_CONTRACT / ARCHITECTURE_CONTRACT / IMPLEMENTATION_BLOCKER / DOCUMENT_RECONCILIATION / COVERAGE
Severity: Critical / Major / Normal
Owner Sheet / Destination:
Affected IDs / Surfaces:
Gap:
Why AI cannot safely infer it:
Smallest owner/domain/contract decision needed:
Status: Open / Deferred / Resolved
Note: optional free-form timing/context note
```

`Status` contains exactly one enum value. Use `Note` for text such as “deferred to DM-02” rather than embedding it in Status.

Use this template instead of inventing a fallback.

---

## T4 — Surface Contract

Use for S1-S3 only as needed.

```text
Surface ID:
Name / Type:
Spec Tier: S1 / S2 / S3
Purpose:
Parent / Entry:
Applicable Roles / Contexts:
Decision IDs: <full IDs>

Primary Action:
Exit / Return:
Required States:
Authority / Source of Truth:
Invariants:
Forbidden Behavior:
```

Optional when applicable:

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

Surface Contracts do not maintain an independent lifecycle `Status` field. Their applicability/readiness is established by referenced decisions, selected Spec Tier, required contracts, Work Order scope, and Preflight.

---

## T5 — Component Contract

```text
Component ID:
Name:
Purpose:
Non-purpose:
Decision IDs: <full IDs>
Semantic role:
Projected state:
Local presentation state:
Required interaction states:
Keyboard / pointer:
Responsive behavior:
Content limits:
Design tokens:
Forbidden domain calculations:
Required evidence:
```

Component Contracts do not maintain an independent lifecycle `Status` field. Use governing Decision status and implementation-readiness checks rather than inventing a second contract lifecycle.

---

## T6 — M2 Transition Row

```text
Transition ID:
Current State:
Event:
Guard:
Authority:
Next State:
Side Effect:
Failure:
Recovery / Rollback:
Decision IDs: <full IDs>
```

Do not merge UI animation timing into authoritative transition semantics unless timing is actually a canonical guard.

---

## T7 — Motion / Temporal Contract

```text
Motion ID:
Trigger:
Start condition:
Sequence:
Authoritative-state relationship:
Interaction allowed during motion:
Reveal point:
Completion:
Cancellation:
Timeout / auto-dismiss:
Reduced-motion equivalent:
Failure fallback:
Decision IDs: <full IDs>
```

Never invent numeric timing simply to fill a field. Use `TBD` / Planning Gap when a number is materially required.

---

## T8 — AI Work Order

```text
WORK ORDER
ID:
Objective:
Spec Tier: S0 / S1 / S2 / S3

IN SCOPE:
ALLOWED SIDE EFFECTS:
OUT OF SCOPE:
MUST NOT CHANGE:

APPLICABLE DECISION IDS: <full IDs>
FROZEN DEPENDENCIES: <full IDs>

AUTHORITATIVE SOURCES: <full IDs/paths>
LOCAL PRESENTATION STATE:

ENTRY STATE:
ALLOWED TRANSITIONS: <full transition IDs where materialized>
EXIT / RETURN:

REQUIRED SURFACES / COMPONENTS: <full IDs>
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

### Work Order preflight authority

Do **not** maintain a second Work Order checklist here.

Before preparing or executing a Work Order, run the applicable Route `E` / `F` checks in [`PREFLIGHT.md`](PREFLIGHT.md). `PREFLIGHT.md` is the sole canonical owner of implementation-readiness and implementation-start checks.

If Preflight fails, do not code or invent missing product decisions inside the Work Order.

---

## T9 — Owner checkpoint

Use after a meaningful planning update.

```text
Changed:
Current status:
Open material gaps:
Next planned work:
Frozen changes: none / <full IDs>
```

Do not expose internal Registry/Matrix maintenance unless it changes a product decision or blocks progress.

---

## T10 — Change impact report

When one existing decision changes:

```text
Changed Decision: <full ID>
Old -> New:

Material owner impact:
- ...

Derived impact:
- No Change: <full IDs>
- Review Required: <full IDs>
- Contract Update Required: <full IDs>
- Implementation Update Required: <full IDs>
- Regression Required: <full IDs>

New Planning Gaps:
- none / <full Gap IDs>
```

Keep the report consequence-focused; AI maintains derived artifacts.
