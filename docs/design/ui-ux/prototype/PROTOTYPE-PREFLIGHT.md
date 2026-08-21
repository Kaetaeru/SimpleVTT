# UI Reference Prototype — Preflight

Status: **Final-Spec prototype build / iteration preflight**

Run this before building or materially iterating the active Reference Prototype.

The first prototype candidate was rejected. This preflight therefore includes explicit anti-regression checks from `OWNER-CORRECTIONS.md`.

---

# 1. Mandatory read order

Before prototype HTML work, read:

```text
1. ../AI-READING-GUIDE.md
2. ../OWNER-CONTROL-POLICY.md
3. ../decisions.md
4. ../planning-gaps.md
5. ../master-flow.md
6. README.md
7. MANIFEST.yaml
8. OWNER-CORRECTIONS.md
9. DESIGN-DEFAULTS.md
10. SURFACE-CATALOG.md
11. COMPONENT-CATALOG.md
12. LAYER-MODEL.md
13. STATE-MODEL.md
14. SCENARIO-CATALOG.md
15. MOCK-DATA-CONTRACT.md
16. PROTOTYPE-ACCEPTANCE.md
17. PROTOTYPE-WORK-ORDER.md
```

`OWNER-CORRECTIONS.md` is explicit owner input for the prototype rebuild and must not be treated as optional styling advice.

---

# 2. Product / owner-correction checks

```text
[x] Owner-required UI/UX checkpoints are complete.
[x] Reviewed Product/UX decisions are available as planning truth.
[x] Host=DM / Client=Player is fixed.
[x] Play Dual Anchor / Actor Boards / Command Center direction is reviewed.
[x] Initiative preserves Actor Boards.
[x] Dice/result stay integrated into the current task/scene context.
[x] Owner correction requires all ordinary Standalone rolls to remain inside the current Character Sheet surface.
[x] Owner correction forbids a detached Standalone roll modal/dialog/drawer/result route/window.
[x] Owner correction requires Connected Play to preserve exact upper Actor Board -> Scene -> lower Actor Board -> persistent Command Center topology.
[x] First prototype candidate is rejected/superseded and cannot be used as design authority.
```

No Product Decision is Frozen yet. That is acceptable for the non-production prototype only. Runtime implementation still requires later canonical reconciliation + Freeze/readiness.

---

# 3. Fail-fast anti-regression checks

Prototype iteration fails preflight if it proposes any of the following:

```text
[ ] ordinary Standalone roll navigates away from current Character Sheet
[ ] ordinary Standalone roll opens detached modal/dialog/drawer/result window/card
[ ] Play removes/replaces the persistent bottom Command Center during normal action/resolution/dice/result
[ ] Play moves allied/opposing Actor Boards into a permanent side portrait rail
[ ] Initiative creates a separate combat screen that removes Actor Boards
[ ] utility pane replaces the core Play skeleton
[ ] Player receives a placeholder row for a DM-only mock event
[ ] unavailable Main Hand silently falls back to another action
[ ] prototype calculates target eligibility/rules/authority instead of reading fixtures
```

If any would occur, stop and repair the prototype before review.

---

# 4. Catalog / fixture checks

```text
[x] Surface Catalog exists.
[x] Component Catalog exists.
[x] Layer Model exists.
[x] State Model exists.
[x] Scenario Catalog exists.
[x] Mock Data Contract exists.
[x] Acceptance checklist exists.
[x] Prototype Work Order exists.
[x] explicit Owner Corrections exist.
[x] active Final-Spec fixture file supplies roll faces/totals, target validity and unavailable reasons.
[x] app/ remains separated from src/.
```

---

# 5. Technical gaps

The following may remain open only as explicit mock inputs during prototype review:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

For each:

```text
[x] fixture strategy is explicit;
[x] prototype is forbidden from calculating/inventing production semantics;
[x] runtime implementation remains blocked until the real contract exists.
```

---

# 6. Scope

Prototype work is permitted only inside:

```text
docs/design/ui-ux/prototype/app/
docs/design/ui-ux/prototype/
```

and bounded derived dashboard/routing maintenance needed to point to the active candidate.

Preflight fails if execution requires:

- production `src/` edits;
- production dependency changes;
- backend/network/storage calls;
- production schema changes;
- actual D&D/rules calculation.

---

# 7. Active candidate

```text
ACTIVE REVIEW ENTRY: app/final-spec.html
FIRST CANDIDATE app/index.html: REJECTED / HISTORICAL ONLY
```

Current Final-Spec candidate must expose:

- Standalone Character Sheet same-surface rolls;
- exact reviewed Connected Play topology;
- DM/Player shared skeleton;
- target/resolution/dice/result examples;
- contextual side utilities;
- privacy fixture split;
- Wide/Normal/Narrow presets;
- Reduced Motion;
- product reference surfaces sufficient for owner review.

---

# 8. Current preflight result

```text
FINAL-SPEC PROTOTYPE SPECIFICATION: PASS
OWNER CORRECTIONS: LOADED
FIRST CANDIDATE: REJECTED / DO NOT USE
RUNTIME SRC SCOPE: FORBIDDEN
FINAL-SPEC ITERATION: AUTHORIZED WITHIN PROTOTYPE SCOPE
BROWSER OWNER ACCEPTANCE: PENDING
```

This preflight never authorizes runtime `src/` implementation.
