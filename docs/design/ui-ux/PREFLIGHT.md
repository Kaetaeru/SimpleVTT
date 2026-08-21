# SimpleVTT UI/UX Preflight

Status: canonical start-work consistency/readiness gate

The owner does not run this checklist. AI runs it before substantive planning, implementation preparation, implementation, or QA.

---

# 1. Minimal preflight

```text
[ ] Task Route A-H identified from AI-READING-GUIDE.md
[ ] MANIFEST.yaml checked
[ ] correct bounded sources loaded
[ ] relevant Planning Gaps checked
[ ] made Decision IDs actually exist
[ ] current code is evidence, not product truth
[ ] Master Flow / Registry / Matrix are not being used as independent product authority
[ ] no missing rules/authority/privacy behavior is being inferred
```

If a material item fails:

```text
PREFLIGHT FAILED
Route:
Failure:
Affected IDs/files:
Smallest repair:
```

---

# 2. Owner-control preflight

Before asking the owner **any new question**, AI MUST read `OWNER-CONTROL-POLICY.md` and classify the unresolved item.

```text
[ ] Is this actually an Owner Checkpoint?
[ ] Can AI state which escalation criterion makes it material?
[ ] Is the question already covered by an existing Decision?
[ ] Can it instead be handled as an AI Design Default?
[ ] Does it actually belong to Domain/Architecture rather than owner preference?
[ ] Is it already one of the lightweight checkpoints in owner-review/02-key-decisions.md?
```

If AI cannot name a material escalation reason, **do not ask the owner**.

Detailed rows in `review-plan.md` are internal coverage, not automatic owner homework.

They may be resolved by:

- canonical Decision Card;
- lightweight Owner Checkpoint;
- AI Design Default in a Surface/Component/Motion/design-system contract;
- Domain/Architecture contract;
- declared `N/A` condition.

---

# 3. Lightweight Route A preflight

For normal owner planning:

```text
[ ] Global Planning Gate = PASS
[ ] README.md read
[ ] OWNER-CONTROL-POLICY.md read
[ ] owner-review/02-key-decisions.md checked
[ ] explicit per-question owner overrides preserved
[ ] if `전체 추천안 사용: YES`, unanswered checkpoints use their stated AI recommendation
[ ] no recommendation is treated as owner approval without explicit bundle/per-question acceptance
[ ] conflicts checked before canonicalization
```

Do not send the owner back to the historical long worksheets unless they explicitly ask to inspect them.

---

# 4. Schema / reference preflight

```text
[ ] Decision Status is exactly Draft / Selected / Reviewed / Frozen / Superseded
[ ] Gap Status is exactly Open / Deferred / Resolved
[ ] Gap Type and Severity match MANIFEST enums
[ ] Registry Planning/Contract values use declared enums
[ ] M6 coverage cells are REQ / N/A / TBD / exact contract-or-test ID
[ ] structured references use complete resolvable IDs/paths
[ ] no ranged/omitted-prefix/prose-substitute reference is used in structured fields
[ ] Complete Decision Maps still satisfy required T2 structure
```

Do not guess an abbreviated reference.

---

# 5. Planning truth / implementation reliance

```text
[ ] Selected / Reviewed / Frozen Product decisions outrank current code as planning intent
[ ] Draft is not made product intent
[ ] Superseded is historical only
[ ] only Frozen decisions are stable implementation dependencies by default
[ ] AI Design Defaults do not override explicit owner Decisions
[ ] AI Design Defaults stay inside approved Product/UX authority
[ ] rules legality/calculation remains Domain authority
[ ] persistence/network/privacy/schema/security remains Domain/Architecture authority
[ ] cross-domain contradiction becomes PLANNING GAP: CONTRACT CONFLICT
```

A lighter owner workflow never weakens authority boundaries.

---

# 6. Global Planning Gate

The whole-product preparation gate is already defined by `review-plan.md` and `MANIFEST.yaml`.

Route A may run only when:

```text
[ ] R1-R9 inventory cross-check passed
[ ] M1-M6 material coverage passed
[ ] all governance sheets have complete detailed maps for internal coverage
[ ] Missing / Duplication / Coverage audit passed
[ ] owner whole-product checkpoint delivered
```

**Passing this gate does not mean every detailed row must be answered by the owner.**

---

# 7. Decision change / reconciliation

Before changing a made decision:

```text
[ ] exact Decision Card located
[ ] lifecycle status known
[ ] dependencies/impact known
[ ] related gaps checked
[ ] authority-domain contract checked when applicable
```

Owner plain-language changes are valid input. AI resolves the exact source and updates the smallest canonical scope.

---

# 8. AI Design Default preflight

Before resolving a detail without asking the owner:

```text
[ ] detail is explicitly permitted by OWNER-CONTROL-POLICY.md
[ ] it does not add/remove a material capability
[ ] it does not materially alter workflow/mental model
[ ] it does not change DM/Player authority/privacy/disclosure
[ ] it does not create destructive/data-loss behavior
[ ] it does not contradict an existing Decision
[ ] it does not require guessing rules/network/domain truth
[ ] chosen default follows accepted UI direction + good UX/accessibility practice
[ ] default will be recorded in the appropriate design/contract artifact when implementation needs it
```

If any item fails, escalate to Owner Checkpoint or technical contract as appropriate.

---

# 9. Implementation readiness

Before a Work Order or code change:

```text
[ ] Spec Tier selected
[ ] applicable Frozen dependencies identified
[ ] no material blocking gap remains
[ ] required detailed contracts/defaults are materialized
[ ] authority/visibility/persistence source of truth is explicit for S3 work
[ ] accessibility/responsive/temporal requirements are explicit when applicable
[ ] legacy status known for touched paths
[ ] implementation explicitly authorized
```

If not ready:

```text
NOT IMPLEMENTATION-READY
Blocked by:
Smallest action needed:
```

Planning or owner-checkpoint completion alone never authorizes implementation.

---

# 10. Implementation preflight

```text
[ ] exact Work Order identified
[ ] IN SCOPE / ALLOWED SIDE EFFECTS / OUT OF SCOPE / MUST NOT CHANGE understood
[ ] exact referenced Decisions/contracts loaded
[ ] applicable Matrix/domain sources loaded
[ ] source/tests inspected only after requirements are known
[ ] Stop Conditions known
[ ] no adjacent cleanup is being smuggled into scope
```

Unexpected material dependency is not permission to broaden scope.

---

# 11. QA preflight

```text
[ ] acceptance scope known
[ ] Decision/default/contract IDs known
[ ] M6 coverage known
[ ] authority/domain constraints known
[ ] exact implementation revision/diff known
[ ] automated/visual/owner walkthrough evidence known as applicable
```

QA does not redesign.

---

# 12. Anti-patterns

Fail Preflight if AI is about to:

- ask the owner a low-risk typography/spacing/icon/component-detail question;
- ask the owner to decide rules/network/privacy truth;
- make the owner complete every detailed Decision Map row;
- silently treat an unaccepted AI recommendation as owner approval;
- let current code replace a Reviewed product decision;
- treat Reviewed as implementation-ready/Frozen;
- use a derived doc as product authority;
- infer a shorthand reference;
- use UI precedence to override Domain/Architecture;
- invent behavior because a Matrix cell is TBD;
- broaden implementation scope because nearby code looks wrong.

---

# 13. Completion token

```text
PREFLIGHT: PASS
Route: <A-H>
Owner-control classification: Owner Checkpoint / AI Design Default / Domain-Architecture / N/A
Schema: PASS
References: PASS
Planning truth: PASS
Global Planning Gate: PASS / BLOCKED / N/A
Blocking gaps: none / <full IDs>
Implementation readiness: N/A / NOT READY / READY
```

The token is evidence of a check, not a substitute for source documents.

---

# 14. Owner simplicity

> **The owner controls meaningful product intent. AI carries the exhaustive detail burden.**
