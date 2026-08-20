# SimpleVTT UI/UX Planning Templates

These templates are designed for **copy-safe AI use**. Use only the lightest template required by the framework's specification tier.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Preflight: [`PREFLIGHT.md`](PREFLIGHT.md)

## T1 — Decision Card

Default owner-facing canonical unit.

```text
Decision ID:
Title:
Status: Draft / Selected / Reviewed / Frozen / Superseded
Applies To:
Decision:
Why:
Depends On:
Affects:
Planning Gap: none / <Gap ID>
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
- Keep `Decision` concise.
- Do not include implementation instructions unless the implementation constraint is itself the product decision.
- Do not copy the same normative text into Registry, Matrix, Dashboard, or Work Order files.

---

## T2 — Decision Map

Must exist in `review-plan.md` before individual questions for that governance sheet begin.

```markdown
# <Sheet ID> — <Sheet Name>

Scope:
Non-scope:
Exit Criteria:

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| ... | ... | Draft | ... | no | ... |
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
Status: Open
```

Use this instead of inventing a fallback.

---

## T4 — Surface Contract

Use for S1-S3 only as needed.

```text
Surface ID:
Name / Type:
Spec Tier: S1 / S2 / S3
Status:
Purpose:
Parent / Entry:
Applicable Roles / Contexts:
Decision IDs:

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

---

## T5 — Component Contract

```text
Component ID:
Name:
Status:
Purpose:
Non-purpose:
Decision IDs:
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
Decision IDs:
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
Decision IDs:
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

APPLICABLE DECISION IDS:
FROZEN DEPENDENCIES:

AUTHORITATIVE SOURCES:
LOCAL PRESENTATION STATE:

ENTRY STATE:
ALLOWED TRANSITIONS:
EXIT / RETURN:

REQUIRED SURFACES / COMPONENTS:
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
Frozen changes: none / <IDs>
```

Do not expose internal Registry/Matrix maintenance unless it changes a product decision or blocks progress.

---

## T10 — Change impact report

When one existing decision changes:

```text
Changed Decision:
Old -> New:

Material owner impact:
- ...

Derived impact:
- No Change: <IDs>
- Review Required: <IDs>
- Contract Update Required: <IDs>
- Implementation Update Required: <IDs>
- Regression Required: <IDs>

New Planning Gaps:
- none / <IDs>
```

Keep the report consequence-focused; AI maintains derived artifacts.
