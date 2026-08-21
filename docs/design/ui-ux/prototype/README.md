# SimpleVTT UI Reference Prototype

Status: **Prototype specification prepared; HTML prototype not started**

This directory defines the non-production **UI Reference Prototype** phase that must happen before any broad runtime UI rebuild.

The prototype exists so the owner can inspect and change the product **as a complete visual/interactive system before `src/` UI implementation begins**.

---

# 1. What this prototype is

The Reference Prototype is a standalone HTML/CSS/JS representation of the intended SimpleVTT experience.

It should look and behave close enough to the intended product that the owner can judge:

- screen composition;
- information hierarchy;
- button/control placement;
- Scene and Actor-board balance;
- Command Center density;
- DM vs Player presentation;
- overlay/pane/modal behavior;
- targeting and result states;
- responsive desktop reflow;
- hover/focus/disabled/pending/error presentation;
- whether a flow feels understandable before production code is touched.

It is **not** a production implementation and is **not** an authority/rules/network implementation.

---

# 2. Hard boundary from runtime code

Prototype application files, when authorized later, live only under:

```text
docs/design/ui-ux/prototype/app/
```

The prototype MUST NOT modify or import production UI from:

```text
src/
```

The prototype MUST NOT:

- call the real SimpleVTT backend/runtime;
- use real session networking;
- mutate real Character/content/session data;
- calculate D&D rules, legality, target eligibility, AC/DC, resource legality, or authoritative outcomes;
- invent missing network/privacy/persistence contracts;
- treat mock state as proof that a production contract exists;
- become a hidden alternate product implementation.

All gameplay-looking state is mock presentation data unless an applicable canonical contract explicitly supplies the semantics.

---

# 3. Authority order

When prototype material conflicts, use this order within Product/UX scope:

1. canonical Product/UX Decision Cards in `../decisions.md`;
2. applicable explicit owner changes;
3. this prototype package's AI Design Defaults and catalogs;
4. current production implementation only as evidence;
5. prototype convenience code.

Domain/Architecture truth remains separately authoritative for rules, networking, privacy, persistence, schemas, and game state.

A prototype is never allowed to silently resolve a Domain/Architecture Gap.

---

# 4. Prototype package

| File | Purpose |
| --- | --- |
| `MANIFEST.yaml` | machine-readable prototype phase and gate |
| `DESIGN-DEFAULTS.md` | AI-managed visual/interaction defaults |
| `SURFACE-CATALOG.md` | screens, scenes, contextual surfaces and modes that must exist |
| `COMPONENT-CATALOG.md` | buttons, cards, controls and reusable UI states |
| `LAYER-MODEL.md` | pane/popover/modal/handout/resolution stack and coexistence rules |
| `STATE-MODEL.md` | user-visible state vocabulary and presentation priorities |
| `SCENARIO-CATALOG.md` | exact review scenarios the HTML must be able to demonstrate |
| `MOCK-DATA-CONTRACT.md` | safe synthetic data model for the prototype |
| `PROTOTYPE-ACCEPTANCE.md` | visual/interaction acceptance checklist |
| `PROTOTYPE-WORK-ORDER.md` | prepared but not-yet-executed HTML prototype work order |
| `app/README.md` | boundary for the future standalone HTML application |

The catalogs use stable `PROTO-*` IDs so later HTML elements/scenes can be traced back without copying full requirement prose into JavaScript.

---

# 5. Phase gates

## P0 — Prototype specification

Required:

- canonical owner decisions reconciled;
- prototype Surface/Component/Layer/State catalogs exist;
- mock-data boundary exists;
- review scenarios exist;
- acceptance criteria exist;
- prototype Work Order exists.

**Current status: PASS after this package is fully materialized.**

## P1 — HTML prototype build

Starts only when the owner explicitly authorizes building the Reference Prototype.

Allowed scope is only `docs/design/ui-ux/prototype/app/` plus bounded updates to prototype documentation.

Runtime `src/` UI remains untouched.

## P2 — Prototype review and iteration

The owner reviews the complete interactive prototype and may change any Product/UX detail in plain language.

AI updates the smallest applicable Decision/default/catalog and refreshes the prototype. The owner does not manually repair cross-references.

## P3 — Prototype acceptance

Prototype acceptance requires explicit owner acceptance of the overall reference experience.

Acceptance does **not** by itself:

- Freeze Product Decisions;
- resolve Domain/Architecture Gaps;
- authorize runtime UI implementation.

## P4 — Contract extraction / implementation preparation

After prototype acceptance:

- extract needed Surface/Component/Motion contracts;
- resolve applicable Domain/Architecture blockers;
- reconcile conflicting legacy UX docs;
- Freeze only the implementation dependencies explicitly approved for the runtime scope;
- prepare a scoped runtime Work Order.

## P5 — Runtime UI implementation

Only after P4 readiness may broad UI work under `src/` begin.

---

# 6. Prototype-only review harness

The eventual HTML prototype SHOULD include a clearly labeled **Prototype Controls** panel that is not part of the intended product UI.

It exists only to let the owner instantly switch:

- Home / Character / Content / Rules / Settings / Session surfaces;
- Host-DM vs Client-Player view;
- Freeform vs Initiative;
- normal / targeting / resolving / interrupt / result state;
- Public vs DM Only examples;
- Handout Overlay / Upper / Full modes;
- connected / reconnecting / disconnected examples;
- wide / normal / narrow desktop viewport presets;
- normal / empty / loading / disabled / error variants.

Prototype Controls MUST be visually separated from the product frame and MUST NOT be copied into production UI.

---

# 7. Open technical gaps and prototype behavior

The following current gaps do **not** prevent visual prototyping, but the prototype may represent them only with explicit mock flags/data:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

For example, a prototype may show a target as `Available` or `Unavailable`, but the prototype must not contain gameplay code that decides why.

These gaps still block corresponding runtime implementation until their real contracts exist.

---

# 8. Owner-control rule

The owner should review the prototype as a product, not as a design-system operator.

The owner may say things such as:

- "Command Center is too tall."
- "This DM pane should open from the right."
- "I want this information visible without hover."
- "The Actor cards feel too cramped."
- "This scene should keep more space when Activity opens."

AI translates that feedback into the relevant catalog/default/Decision and keeps the package synchronized.

The owner does not need to edit component IDs, layer tables, state matrices, or CSS tokens manually.

---

# 9. Current status

```text
OWNER PRODUCT CHECKPOINTS: COMPLETE
REFERENCE PROTOTYPE SPEC: BEING MATERIALIZED
HTML PROTOTYPE: NOT STARTED
PROTOTYPE OWNER ACCEPTANCE: NOT STARTED
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
FROZEN PRODUCT DECISIONS: NONE
```

The next implementation-looking artifact is therefore the **standalone Reference Prototype**, not the SimpleVTT runtime UI.