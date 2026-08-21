# SimpleVTT UI/UX Preflight

Status: canonical start-work consistency/readiness gate

The owner does not run this checklist. AI runs it before substantive planning, Reference Prototype work, runtime implementation preparation, runtime implementation, or QA.

---

# 1. Minimal preflight

```text
[ ] Task Route A-H or P identified from AI-READING-GUIDE.md
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
```

If AI cannot name a material escalation reason, **do not ask the owner**.

Detailed rows in `review-plan.md` are internal coverage, not automatic owner homework.

---

# 3. Planning / owner checkpoint preflight

For normal owner planning:

```text
[ ] Global Planning Gate = PASS
[ ] README.md read
[ ] OWNER-CONTROL-POLICY.md read
[ ] explicit owner input preserved
[ ] no AI recommendation is treated as owner approval without explicit acceptance
[ ] conflicts checked before canonicalization
```

Current required owner-question count may be zero; that does not mean the next step is runtime implementation.

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
[ ] only Frozen decisions are stable runtime implementation dependencies by default
[ ] AI Design Defaults do not override explicit owner Decisions
[ ] rules legality/calculation remains Domain authority
[ ] persistence/network/privacy/schema/security remains Domain/Architecture authority
[ ] cross-domain contradiction becomes PLANNING GAP: CONTRACT CONFLICT
```

A lighter owner workflow never weakens authority boundaries.

---

# 6. Global Planning Gate

Route A / D / P planning may rely on the completed whole-product gate only when:

```text
[ ] R1-R9 inventory cross-check passed
[ ] M1-M6 material coverage passed
[ ] all governance sheets have complete detailed maps for internal coverage
[ ] Missing / Duplication / Coverage audit passed
[ ] owner whole-product checkpoint delivered
```

Passing this gate does **not** authorize runtime implementation.

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

Owner plain-language changes are valid input. AI updates the smallest canonical scope and refreshes affected prototype/derived material.

---

# 8. AI Design Default preflight

Before resolving a detail without asking the owner:

```text
[ ] detail is permitted by OWNER-CONTROL-POLICY.md
[ ] it does not add/remove a material capability
[ ] it does not materially alter workflow/mental model
[ ] it does not change DM/Player authority/privacy/disclosure
[ ] it does not create destructive/data-loss behavior
[ ] it does not contradict an existing Decision
[ ] it does not require guessing rules/network/domain truth
[ ] chosen default follows accepted UI direction + good UX/accessibility practice
[ ] default is recorded in prototype/design/contract material when needed
```

If any item fails, escalate to Owner Checkpoint or technical contract as appropriate.

---

# 9. Reference Prototype preflight — Route P

Broad UI visual definition/rebuild work MUST route through `prototype/` before production `src/` implementation.

Before building/editing the standalone Reference Prototype:

```text
[ ] prototype/README.md read
[ ] prototype/MANIFEST.yaml read
[ ] prototype/PROTOTYPE-PREFLIGHT.md passes for the requested prototype scope
[ ] prototype Work Order scope is authorized
[ ] writes stay under docs/design/ui-ux/prototype/ plus bounded prototype-doc maintenance
[ ] no src/ import/change is required
[ ] real backend/network/storage is not required
[ ] D&D/rules/authority/privacy truth is fixture-driven, not calculated
```

Before marking Prototype Accepted:

```text
[ ] browser/visual interaction review occurred
[ ] PROTOTYPE-ACCEPTANCE.md was checked
[ ] owner explicitly accepted a specific prototype reference
```

Static authoring alone is not Prototype Acceptance.

---

# 10. Runtime implementation readiness

For **broad UI runtime work**, first require:

```text
[ ] applicable Reference Prototype status = ACCEPTED
[ ] accepted prototype reference commit recorded
```

Then require normal runtime readiness:

```text
[ ] Spec Tier selected
[ ] applicable Frozen Product/UX dependencies identified
[ ] no material blocking technical gap remains for the scope
[ ] required Surface / Component / Motion contracts extracted/materialized
[ ] authority/visibility/persistence source of truth is explicit for S3 work
[ ] accessibility/responsive/temporal requirements are explicit when applicable
[ ] conflicting legacy UX guidance reconciled for touched scope
[ ] legacy status known for touched runtime paths
[ ] scoped runtime Work Order exists
[ ] runtime implementation explicitly authorized
```

If not ready:

```text
NOT IMPLEMENTATION-READY
Blocked by:
Smallest action needed:
```

Owner-checkpoint completion, Reviewed Decisions, or a prototype review candidate never authorize runtime implementation by themselves.

---

# 11. Runtime implementation preflight

```text
[ ] exact runtime Work Order identified
[ ] IN SCOPE / ALLOWED SIDE EFFECTS / OUT OF SCOPE / MUST NOT CHANGE understood
[ ] accepted prototype reference loaded where applicable
[ ] exact referenced Frozen Decisions/contracts loaded
[ ] applicable Matrix/domain sources loaded
[ ] source/tests inspected only after requirements are known
[ ] Stop Conditions known
[ ] prototype fixture/mock code will not be copied as production authority
[ ] Prototype Controls will not enter product UI
[ ] no adjacent cleanup is being smuggled into scope
```

Unexpected material dependency is not permission to broaden scope.

If broad UI work is requested without accepted prototype + P4 readiness, route back to `P — Reference Prototype` rather than improvising runtime UI.

---

# 12. QA preflight

For prototype QA:

```text
[ ] prototype decisions/defaults/catalogs known
[ ] scenario coverage known
[ ] prototype boundary known
[ ] PROTOTYPE-ACCEPTANCE.md status known
```

For runtime QA:

```text
[ ] accepted prototype reference known where applicable
[ ] applicable Frozen Decision/contract IDs known
[ ] M6 coverage known
[ ] authority/domain constraints known
[ ] exact runtime implementation revision/diff known
[ ] automated/visual/owner walkthrough evidence known as applicable
```

QA does not redesign silently.

---

# 13. Anti-patterns

Fail Preflight if AI is about to:

- ask the owner a low-risk typography/spacing/icon/component-detail question;
- ask the owner to decide rules/network/privacy truth;
- make the owner complete every detailed Decision Map row;
- silently treat an unaccepted AI recommendation as owner approval;
- let current code replace a Reviewed product decision;
- treat Reviewed as runtime-ready/Frozen;
- **skip from Reviewed planning directly to broad runtime UI implementation**;
- treat a prototype review candidate as accepted without owner review;
- copy prototype fixture/mock logic into production authority code;
- use a derived doc as product authority;
- infer a shorthand reference;
- use UI precedence to override Domain/Architecture;
- invent behavior because a Matrix cell is TBD;
- broaden implementation scope because nearby code looks wrong.

---

# 14. Completion token

```text
PREFLIGHT: PASS
Route: <A-H | P>
Owner-control classification: Owner Checkpoint / AI Design Default / Domain-Architecture / N/A
Schema: PASS
References: PASS
Planning truth: PASS
Global Planning Gate: PASS / BLOCKED / N/A
Prototype status: N/A / SPEC READY / REVIEW CANDIDATE / ACCEPTED / NEEDS CHANGE
Blocking gaps: none / <full IDs>
Runtime implementation readiness: N/A / NOT READY / READY
```

The token is evidence of a check, not a substitute for source documents.

---

# 15. Owner simplicity

> **The owner controls meaningful product intent and reviews the whole UI visually before runtime code. AI carries the exhaustive design/detail burden.**
