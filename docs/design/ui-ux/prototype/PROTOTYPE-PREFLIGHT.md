# UI Reference Prototype — Preflight

Status: **Prototype build preflight**

Run this before executing `PROTO-WO-001`.

This preflight answers: **is the standalone HTML prototype sufficiently specified to build without inventing product behavior or touching runtime UI?**

---

# 1. Read order

Before prototype HTML work, read:

```text
1. ../AI-READING-GUIDE.md
2. ../OWNER-CONTROL-POLICY.md
3. ../decisions.md
4. ../planning-gaps.md
5. ../master-flow.md
6. README.md
7. MANIFEST.yaml
8. DESIGN-DEFAULTS.md
9. SURFACE-CATALOG.md
10. COMPONENT-CATALOG.md
11. LAYER-MODEL.md
12. STATE-MODEL.md
13. SCENARIO-CATALOG.md
14. MOCK-DATA-CONTRACT.md
15. PROTOTYPE-ACCEPTANCE.md
16. PROTOTYPE-WORK-ORDER.md
```

Load Registry/Matrix/detail maps only as needed for exact coverage or conflict resolution.

---

# 2. Product decision checks

```text
[x] Owner-required UI/UX checkpoints are currently complete.
[x] Reviewed Product/UX decisions are available as planning truth.
[x] Immediate-live Host flow is canonical.
[x] No-Character Join behavior is canonical.
[x] Host=DM / Client=Player role model is canonical.
[x] Play Dual Anchor / Actor Boards / Command Center direction is canonical.
[x] Handout three-mode direction is canonical.
[x] DM privacy/Activity/correction product intent is canonical.
[x] Add-on package/lifecycle/live-snapshot product intent is canonical.
```

No Product Decision is Frozen yet. That is acceptable for a non-production reference prototype because prototype HTML is not an implementation dependency.

Runtime implementation still requires later Freeze/readiness.

---

# 3. Catalog checks

```text
[x] Surface Catalog exists.
[x] Component Catalog exists.
[x] Layer Model exists.
[x] State Model exists.
[x] Scenario Catalog exists.
[x] Mock Data Contract exists.
[x] Acceptance checklist exists.
[x] Prototype Work Order exists.
[x] app/ boundary is reserved and explicitly separated from src/.
```

All `PROTO-*` IDs used by HTML should resolve to one catalog/state/scenario entry.

---

# 4. Technical-gap checks

Current open technical gaps may remain open for prototype presentation only:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

For each:

```text
[x] prototype has an explicit fixture/mock strategy;
[x] prototype is forbidden from calculating/inventing production semantics;
[x] runtime implementation remains blocked until real contract exists.
```

If a new unresolved Product/UX behavior is discovered that materially changes workflow/capability/authority, this preflight becomes blocked until it is routed through Owner Control Policy.

---

# 5. Scope checks

Prototype build is permitted only inside:

```text
docs/design/ui-ux/prototype/app/
```

and bounded prototype-document maintenance.

Preflight fails if proposed prototype execution requires:

- `src/` edits;
- production dependency changes;
- backend/network/storage calls;
- production schema changes;
- actual D&D/rules calculation.

---

# 6. Review-harness checks

Future HTML must include Prototype Controls for:

```text
[x] surface switching
[x] scenario switching
[x] Host/DM vs Client/Player vs Offline view
[x] Freeform vs Initiative
[x] Wide / Normal / Narrow desktop presets
[x] loading/error/reconnect fixture states
[x] Handout mode switching
[x] DM Public / DM Only presentation fixture
[x] Reduced Motion
[x] Component Gallery
[x] Reset Layout
```

---

# 7. Current preflight result

```text
PROTOTYPE SPECIFICATION: PASS
OWNER PRODUCT CHECKPOINTS: COMPLETE
OPEN TECHNICAL GAPS: ALLOWED AS EXPLICIT MOCK-ONLY INPUTS
RUNTIME SRC SCOPE: FORBIDDEN
HTML PROTOTYPE EXECUTION: BLOCKED ONLY UNTIL EXPLICIT OWNER AUTHORIZATION
```

This result does not itself authorize execution. The owner must explicitly request the Reference Prototype build.