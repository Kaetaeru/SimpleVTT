# SimpleVTT UI Reference Prototype

Status: **REVIEW CANDIDATE — owner browser review pending**

This directory contains the non-production **UI Reference Prototype** that must be reviewed before broad runtime UI implementation.

The goal is simple: **see and change the whole UI as an interactive example before touching production `src/` UI.**

---

# Current phase

```text
P0 Prototype specification: PASS
P1 Standalone HTML authoring: REVIEW CANDIDATE CREATED
Static boundary/coverage verification: PASS
P2 Owner visual/interaction review: READY
P3 Explicit Prototype Acceptance: NOT STARTED
P4 Runtime contract/Freeze preparation: BLOCKED
P5 Runtime UI implementation: NOT AUTHORIZED
Frozen Product Decisions: NONE
```

The current review entry is:

```text
docs/design/ui-ux/prototype/app/index.html
```

---

# What is already in the prototype

The standalone HTML candidate includes:

- prototype-only controls separated from product UI;
- direct Surface selection;
- 34 named review scenarios;
- Host/DM, Client/Player and Offline views;
- Freeform and Initiative;
- Wide / Normal / Narrow desktop presets;
- Home / Characters / both Sheet styles / Builder / Level Up;
- immediate-live Host Setup;
- Join + Character Select + no-Character blocked flow;
- Content / package import / Rules / Settings;
- upper opposing and lower allied Actor Boards;
- central Scene/Table;
- persistent bottom Command Center;
- Hotbar, economy and Resource Rail examples;
- Initiative Tracker;
- targeting / invalid target / multi-target states;
- Main Hand unavailable example with no smart fallback;
- resolving / reaction / concentration / dice / result examples;
- Activity including public/private filtering and correction history;
- Encounter / Participants / Session Share / Player Session utilities;
- advanced DM distance/visibility/cover tool;
- Handout Overlay / Upper Scene / Full Scene;
- Full Sheet layer;
- Actor right-click context menu;
- rich hover explanation frames;
- NOTICE / banner / toast / error / reconnect examples;
- panel resize and Reset Layout;
- Component Gallery;
- Reduced Motion review switch.

All gameplay/network-looking values are synthetic fixtures.

---

# Hard runtime boundary

Prototype app files live only under:

```text
docs/design/ui-ux/prototype/app/
```

The prototype MUST NOT:

- import or modify production `src/` UI;
- call the real backend/network/storage;
- calculate D&D rules, target eligibility, authority or outcomes;
- invent missing privacy/reconnect/network contracts;
- become a production schema or hidden alternate runtime.

Current static verification found no `fetch(`, WebSocket or `src/` reference in the main prototype JavaScript. See [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md).

---

# Review harness

The left-side **PROTOTYPE CONTROLS** rail is not intended product UI.

It exists to switch:

- named Scenario;
- Surface;
- Host/DM vs Client/Player vs Offline;
- Freeform vs Initiative;
- Wide/Normal/Narrow viewport;
- connection state;
- Handout mode;
- Public / DM Only example;
- Reduced Motion;
- error/pending examples;
- Component Gallery;
- Reset Layout.

---

# Specification package

| File | Purpose |
| --- | --- |
| `MANIFEST.yaml` | machine-readable phase/gates |
| `DESIGN-DEFAULTS.md` | AI-managed visual defaults |
| `SURFACE-CATALOG.md` | required screens/scenes/surfaces |
| `COMPONENT-CATALOG.md` | required components/states |
| `LAYER-MODEL.md` | pane/popover/modal/handout/resolution stacking |
| `STATE-MODEL.md` | visible state vocabulary |
| `SCENARIO-CATALOG.md` | 34 review scenarios |
| `MOCK-DATA-CONTRACT.md` | safe synthetic fixture boundary |
| `PROTOTYPE-PREFLIGHT.md` | prototype-build preflight |
| `PROTOTYPE-WORK-ORDER.md` | authorized prototype scope/execution record |
| `BUILD-VERIFICATION.md` | static candidate verification |
| `PROTOTYPE-ACCEPTANCE.md` | owner acceptance gate |

---

# Technical gaps remain technical

The HTML may visually represent these through fixtures, but does not solve them:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

They remain runtime blockers for affected scopes.

---

# Owner review rule

The owner should not edit token tables or state matrices.

Open the prototype and give normal feedback such as:

- "Command Center가 너무 높아."
- "Actor 카드가 너무 작아."
- "이 DM 패널은 오른쪽에서 열자."
- "이 상태는 NOTICE에 항상 보여줘."
- "이 버튼은 hover가 아니라 항상 보이게 하자."

AI translates that feedback into the smallest Design Default/catalog/Decision and refreshes the prototype.

---

# Acceptance boundary

The prototype is **not accepted yet**.

Only explicit owner acceptance recorded in `PROTOTYPE-ACCEPTANCE.md` can finish P3.

Even after prototype acceptance, runtime UI work still requires:

1. Surface / Component / Motion contract extraction;
2. applicable Domain/Architecture gap resolution;
3. conflicting legacy UX document reconciliation;
4. scoped Product Decision Freeze where required;
5. scoped runtime Work Order;
6. separate runtime implementation authorization.

Therefore the next step is **browser review of this Reference Prototype**, not `src/` implementation.