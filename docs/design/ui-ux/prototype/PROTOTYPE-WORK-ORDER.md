# UI Reference Prototype — Work Order

Status: **PROTO-WO-002 COMPLETE — INTEGRATED REFERENCE OWNER ACCEPTED**

This file preserves prototype execution history and records the completed mapless integrated Reference Prototype work.

Runtime `src/` UI remains out of scope and is not authorized by this Work Order.

---

# 1. Historical execution

## PROTO-WO-001

First candidate:

```text
app/index.html
```

Result: **REJECTED / HISTORICAL**

Later `final-spec` candidate:

```text
app/final-spec.html
```

Result: **INVALIDATED / HISTORICAL**

Material reason:

- synthetic Actor `sceneX/sceneY` coordinates;
- battlemap-like interpretation of central Scene/Table;
- incomplete reading of repository-wide Product/Domain/Owner planning.

Neither historical candidate is eligible for runtime reference.

---

# 2. PROTO-WO-002 — Integrated Mapless Rebuild

Objective:

> Build a complete Reference Prototype from the repository-wide integrated baseline so the owner can approve the intended Product/Play experience before runtime implementation.

Mandatory baseline:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
applicable Domain/Architecture contracts
applicable ../decisions.md Decision Cards
../planning-gaps.md
PROTOTYPE-REBUILD-CONTRACT.md
reconciled prototype catalogs/models/defaults
```

---

# 3. Accepted result

Accepted entry:

```text
app/integrated-reference.html
```

Support files:

```text
app/integrated-reference.css
app/integrated-reference-fixtures.js
app/integrated-reference-qa-fixtures.js
app/integrated-reference.js
app/integrated-reference-qa-fixes.js
```

Accepted candidate code reference:

```text
4c12084bef603866b9b69f1bfd8f363146920184
```

Verification:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
```

Acceptance:

```text
PROTOTYPE-ACCEPTANCE.md
Accepted by Owner: 2026-08-21
```

---

# 4. Accepted behavior summary

## First launch

```text
Tutorial / Onboarding
-> Standalone / Connected explanation
-> Official-style / SimpleVTT initial Sheet choice
-> Character / Host / Join orientation
-> Home
```

## Standalone

```text
Current Character Sheet remains mounted
-> routine Roll
-> transient dice/result in same Sheet viewport
-> transient presentation clears
-> same Sheet continues
```

No detached routine dice/result workflow.

## Session lifecycle

```text
Host Setup -> Open -> immediately live Host/DM Freeform
Join Setup -> Character Select -> sync -> current live Client/Player state
```

No normal Lobby / Ready / Start gate.

## Connected Play

```text
Compact Play chrome/status
Upper NPC / Neutral / Hostile Actor Board
Shared Play Context / Tabletop Stage      [contextual utility]
Lower Player / Allied Actor Board
Persistent Command Center
```

Core remains mapless.

## Freeform / Initiative

Freeform does not fake turn economy.

Initiative adds tracker/turn economy to the same Play skeleton.

## Targeting

- Actor Cards/manual target sets;
- selected-action targeting priority;
- explicit DM control mode priority when applicable;
- single valid target immediate submit;
- multi-target Execute;
- no Core AoE map template;
- no Main Hand smart fallback.

## Resolution / dice

- Play skeleton preserved;
- selective locking is authority-supplied, not UI-inferred;
- reaction/concentration stay in current context;
- connected dice/result use Play Context presentation space;
- authoritative result is independent from animation.

## Handout / spatial

- Handout is image presentation, not tactical map;
- Overlay / Upper / Full modes retained;
- advanced DM spatial UI is Actor-pair fact editing, not coordinates.

---

# 5. Prototype boundary

PROTO-WO-002 never authorizes:

- production `src/` edits;
- production dependencies;
- real backend/network/storage;
- rules authority implementation;
- privacy/network schema invention;
- production schema creation;
- copying prototype fixtures as runtime authority.

---

# 6. Completion result

```text
Repository-wide integrated baseline: PASS
Prototype spec/catalog reconciliation: PASS
Integrated Reference build: PASS
Static verification: PASS
Owner visual/interaction review: PASS
Owner Prototype Acceptance: PASS
PROTO-WO-002: COMPLETE
```

---

# 7. Handoff after completion

Accepted prototype requirements have been extracted into:

```text
../contracts/README.md
../contracts/SURFACE-CONTRACT.md
../contracts/COMPONENT-CONTRACT.md
../contracts/INTERACTION-STATE-MOTION-CONTRACT.md
../contracts/IMPLEMENTATION-TRACEABILITY.md
```

Runtime preparation must use these contracts plus canonical Domain/Architecture and Product Decision sources.

Remaining material technical blockers include:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

Next phase is Route E runtime preparation for a bounded implementation slice.

Runtime implementation still requires:

1. exact slice selection;
2. current source/test inspection for that slice;
3. slice-blocking technical gap resolution;
4. touched legacy reconciliation;
5. exact Product Decision dependency identification;
6. explicit scoped Freeze authorization where required;
7. scoped Runtime Work Order;
8. separate runtime implementation authorization.

```text
P3 PROTOTYPE OWNER ACCEPTANCE: PASS
P4 RUNTIME PREPARATION: IN PROGRESS / NOT READY
P5 RUNTIME IMPLEMENTATION: NOT AUTHORIZED
```
