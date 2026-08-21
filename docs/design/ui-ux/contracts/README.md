# SimpleVTT Accepted UI/UX Contracts

Status: **RUNTIME PREPARATION CONTRACT SET — derived from accepted prototype; not Frozen**

Accepted visual/interaction reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
Owner acceptance: docs/design/ui-ux/prototype/PROTOTYPE-ACCEPTANCE.md
```

Cross-source Product baseline:

```text
docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md
```

This directory converts the accepted Reference Prototype into implementation-facing UI contracts.

It exists so runtime implementation agents do not have to infer requirements from prototype HTML/CSS/fixtures.

---

# 1. Authority

These contracts are **derived implementation requirements**.

They do not override:

1. applicable Domain/Architecture contracts under `docs/design/*` and `docs/rules/*`;
2. canonical made Product/UX Decisions in `../decisions.md`;
3. an explicit later Owner change.

They may resolve AI-managed presentation detail where the existing governance allows it.

They do not make a Product Decision `Frozen` merely by existing.

---

# 2. Required reading order for broad runtime UI preparation

```text
1. ../AI-READING-GUIDE.md
2. ../MANIFEST.yaml
3. ../PREFLIGHT.md
4. ../INTEGRATED-PRODUCT-UX-PLAN.md
5. applicable Domain/Architecture contracts
6. exact applicable Decision Cards in ../decisions.md
7. ../planning-gaps.md
8. prototype/PROTOTYPE-ACCEPTANCE.md
9. this README
10. SURFACE-CONTRACT.md
11. COMPONENT-CONTRACT.md
12. INTERACTION-STATE-MOTION-CONTRACT.md
13. IMPLEMENTATION-TRACEABILITY.md
```

Prototype source may then be inspected for visual comparison, never as gameplay/network authority.

---

# 3. Contract files

## `SURFACE-CONTRACT.md`

Defines:

- product destinations;
- first-run Tutorial;
- Character surfaces;
- Session entry;
- Connected Play composition;
- contextual utilities/layers;
- Handout presentation;
- responsive surface obligations.

## `COMPONENT-CONTRACT.md`

Defines reusable UI roles and state obligations for:

- navigation;
- Character/Actor cards;
- Actor Boards;
- Command Center/Hotbar;
- Initiative;
- notices/feedback;
- utility panes;
- Activity;
- dice/results;
- Handout;
- connection/session UI.

## `INTERACTION-STATE-MOTION-CONTRACT.md`

Defines:

- click/target priority;
- Standalone dice behavior;
- connected resolution continuity;
- layer priority/dismissal;
- state distinction;
- focus/keyboard behavior;
- animation and Reduced Motion behavior;
- desktop reflow requirements.

## `IMPLEMENTATION-TRACEABILITY.md`

Maps the accepted UI to:

- canonical Product Decision IDs;
- Domain/Architecture authority;
- open Planning Gaps;
- known stale/current implementation areas;
- runtime implementation gates.

---

# 4. What is contractually important vs implementation detail

## Must preserve

- first-run Tutorial before normal Home interaction;
- initial Official-style / SimpleVTT Sheet choice;
- Home top-level information architecture;
- distinct Host and Join flows;
- immediate-live Host/DM Freeform lifecycle;
- mapless Core;
- upper opposing Actor Board + central Play Context + lower allied Actor Board + persistent Command Center;
- same Play skeleton for DM and Player;
- Freeform vs Initiative semantic difference;
- Actor-card/manual targeting;
- no Main Hand smart fallback;
- same-Sheet Standalone dice;
- in-context connected dice/result;
- contextual Activity/DM/session utilities;
- DM-only non-delivery requirement at runtime;
- Handout as presentation rather than tactical map;
- desktop-first responsive/accessibility behavior.

## AI/implementation may tune unless it changes the above

- exact pixel dimensions;
- exact colors within the approved visual direction;
- minor spacing;
- icon choice;
- microcopy;
- specific easing values within the motion contract;
- ordinary card internals;
- exact responsive threshold values;
- low-risk visual polish.

If tuning changes the workflow, capability visibility, authority, privacy, major information hierarchy or product feel, it is no longer a low-risk implementation detail.

---

# 5. Mapless hard guard

Nothing in these contracts authorizes Core:

- battlemap;
- Actor x/y coordinates;
- draggable tactical tokens;
- grid/hex;
- pathfinding/collision;
- movement traces;
- Fog of War;
- LoS geometry;
- range rings/AoE map templates;
- Handout-as-map behavior.

`Play Context`, `Tabletop Stage`, `Scene`, `Roll Area` and similar terms mean presentation/context space only.

---

# 6. Prototype fixtures are not production models

Do not copy prototype fixture objects as runtime schemas.

Examples that require real authoritative sources:

- target eligibility;
- executable Main Hand relation;
- safe/conflicting interactions during resolution;
- rules/resource legality;
- DM-only delivery/projection;
- Handout shared/reconnect state;
- connection/session state;
- content validation.

The runtime UI must consume authoritative application/domain projections instead.

---

# 7. Current gate

```text
Accepted Reference Prototype: PASS
Contract extraction: IN PROGRESS / this directory
Frozen Product dependencies: NOT YET ESTABLISHED
Technical gaps: OPEN where listed in IMPLEMENTATION-TRACEABILITY.md
Runtime Work Order: NOT YET CREATED
Runtime implementation authorization: NO
```

This contract set moves the project from Prototype review into runtime preparation; it does not skip the remaining readiness gates.
