# UI Reference Prototype — Work Order

Status: **RE-EXECUTED TO FINAL-SPEC REPLACEMENT CANDIDATE — OWNER ACCEPTANCE PENDING**

**ID:** `PROTO-WO-001`

**Objective:** Build and iterate a complete interactive standalone HTML/CSS/JS UI reference so the owner can judge SimpleVTT's intended final Product/Play experience before production UI implementation.

This Work Order is limited to Reference Prototype artifacts. It does not authorize runtime `src/` UI.

---

# Execution history

## First candidate

Files:

```text
app/index.html
app/prototype.css
app/prototype.js
app/fixtures.js
app/review-patch.css
app/review-patch.js
```

Result: **REJECTED / SUPERSEDED BY OWNER REVIEW**

Material failures:

- Standalone dice did not read as an in-Character-Sheet interaction.
- Connected Play did not strictly implement the reviewed Actor Board / Scene / Command Center topology.

These files are historical only and may not be used as runtime reference.

## Final-Spec replacement

Active candidate:

```text
app/final-spec.html
app/final-spec.css
app/final-spec-coverage.css
app/final-spec.js
app/final-spec-fixtures.js
app/final-spec-stability.js
app/final-spec-coverage.js
```

Controlling explicit owner corrections:

```text
OWNER-CORRECTIONS.md
```

---

# Replacement scope

The Final-Spec candidate must behave as a near-final product reference rather than a loose wireframe.

## Standalone Character

- Official-style and SimpleVTT layouts remain first-class.
- Every ordinary Standalone roll remains inside the currently mounted Character Sheet surface.
- Skill / save / attack / damage / feature-style examples use the same in-Sheet Roll Plane pattern.
- No detached modal/dialog/drawer/result route/window for ordinary Standalone dice.
- Starting an ordinary roll must not remount/navigate the Character Sheet merely to show dice.
- Fixture-authoritative dice value; no rules calculation.

## Connected Play

Exact core skeleton:

```text
Play chrome/status
Upper NPC/Neutral/Hostile Actor Board
Central Scene/Table (+ contextual side utility)
Lower Player/Allied Actor Board
Persistent BG3-family Command Center
```

Required:

- Initiative Tracker overlays Scene top edge.
- Dice roll on Scene/Table.
- Result stays Scene-integrated.
- Command Center persists through targeting/resolution/dice/result.
- Hotbar remains directly discoverable.
- Actor Boards remain visible during targeting.
- valid/invalid/selected target states come from fixtures.
- single-target valid click submits directly.
- multi-target requires Execute.
- no smart fallback for unavailable Main Hand.
- DM/Player share core skeleton.
- contextual DM/Session tools use side panes.
- Player gets no DM-only Activity placeholder.

---

# Supporting Final-Spec reference coverage

The replacement candidate also provides reference UI for:

- First Run / Sheet-style choice;
- Home / Character Library;
- Character Builder / Level Up;
- Session Host / Join / no-Character block;
- Content / Package Import Review / Rules / Settings;
- Reaction/Interrupt and Concentration response;
- Quick Sheet / Full Sheet live-session layers;
- Activity / Encounter / Participants / Session Share;
- advanced DM spatial authoring;
- Handout Overlay / Upper / Full;
- Actor right-click context menu;
- rich hover/focus explanation;
- NOTICE / reconnect / confirmation examples;
- bounded utility panel resize;
- Wide / Normal / Narrow desktop;
- Reduced Motion;
- Component Gallery.

The `final-spec-coverage.*` files extend review coverage without changing the core structural rules in `final-spec.*` or reusing the rejected prototype architecture.

---

# Hard boundaries

The prototype MUST NOT implement:

- production UI changes;
- real backend/session networking;
- persistence/storage mutation;
- D&D/rules authority;
- target eligibility calculation;
- real default Main Hand relation;
- safe-command conflict calculation;
- DM-only delivery protocol;
- real Handout network/reconnect contract;
- production schemas.

Those values are represented by explicit fixtures only.

No production `src/` file may be changed under this Work Order.

---

# Verification

Active replacement static verification:

[`FINAL-SPEC-VERIFICATION.md`](FINAL-SPEC-VERIFICATION.md)

Current state:

```text
Final-Spec candidate file inventory: PASS
Owner corrections structurally represented: PASS
Extended review-state coverage: PRESENT
Prototype/runtime boundary static inspection: PASS
Browser visual/runtime execution: PENDING
Owner acceptance: PENDING
```

The current execution container cannot resolve GitHub/raw GitHub hosts for local browser/Node execution, so static structural verification is not presented as browser acceptance.

---

# Next step under this Work Order

1. Owner opens `app/final-spec.html`.
2. Owner reviews Standalone Sheet rolls and Connected Play first.
3. Owner spot-checks the extended scenarios in `PROTOTYPE-ACCEPTANCE.md`.
4. Owner gives natural-language UI feedback.
5. AI updates the Final-Spec candidate and the smallest applicable prototype design source.
6. AI runs `PROTOTYPE-ACCEPTANCE.md`.
7. Owner explicitly accepts a specific replacement reference revision.

---

# Stop boundary

Do not move to runtime implementation during prototype review.

If review exposes:

- ordinary layout/density/layer/presentation feedback -> update prototype defaults/catalog/candidate;
- material workflow/capability/authority change -> reconcile Product Decision / explicit owner correction;
- rules/network/privacy/persistence truth -> route to Domain/Architecture contract.

---

# Runtime gate

After Final-Spec acceptance:

```text
accepted Final-Spec prototype
-> reconcile owner corrections into canonical runtime planning
-> Surface / Component / Motion contract extraction
-> applicable technical gap resolution
-> legacy UX reconciliation
-> scoped Freeze/readiness
-> runtime Work Order
-> separate runtime authorization
-> src/ implementation
```

Therefore:

```text
PROTO-WO-001: FINAL-SPEC REPLACEMENT REVIEW CANDIDATE BUILT
PROTOTYPE OWNER ACCEPTANCE: PENDING
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```
