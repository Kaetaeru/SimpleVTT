# UI Reference Prototype — Prepared Work Order

Status: **PREPARED — NOT EXECUTED**

This Work Order defines the future standalone HTML Reference Prototype build. It does not authorize production UI work.

Execution starts only after explicit owner authorization to build the prototype.

---

# WORK ORDER

**ID:** `PROTO-WO-001`

**Objective:** Build a complete interactive standalone HTML/CSS/JS UI reference for SimpleVTT so the owner can validate visual hierarchy, controls, Scene/Actor composition, layers, states and desktop reflow before runtime UI implementation.

**Spec Tier:** prototype-only reference artifact; not production runtime.

---

# IN SCOPE

Only:

```text
docs/design/ui-ux/prototype/app/index.html
docs/design/ui-ux/prototype/app/prototype.css
docs/design/ui-ux/prototype/app/prototype.js
docs/design/ui-ux/prototype/app/fixtures.js
docs/design/ui-ux/prototype/app/assets/*   # prototype-created safe assets only if needed
```

Bounded corrections to prototype docs are allowed if implementation exposes a clear internal inconsistency.

---

# ALLOWED SIDE EFFECTS

- add/update prototype-only HTML/CSS/JS/assets;
- add prototype-only helper data/functions;
- update prototype acceptance status during review;
- update AI Design Defaults/catalogs when visual iteration requires a low-risk design correction;
- record an Owner Checkpoint only if `OWNER-CONTROL-POLICY.md` escalation criteria are genuinely triggered.

---

# OUT OF SCOPE

- production UI implementation;
- `src/` changes;
- backend/server changes;
- database/persistence changes;
- real session networking;
- production schemas;
- D&D rules implementation;
- target eligibility/rules calculation;
- real dice authority/RNG;
- security/privacy protocol implementation;
- production asset pipeline;
- migration/removal of legacy runtime UI.

---

# MUST NOT CHANGE

Without separate authorization:

- Product Decision semantics in `../decisions.md`;
- Domain/Architecture truth;
- current production code under `src/`;
- package/runtime dependencies;
- branch/PR structure outside the prototype documentation scope.

If the prototype exposes a material Product Decision conflict, stop that part and route through owner-control policy instead of choosing silently.

---

# APPLICABLE PRODUCT / UX SOURCES

Primary:

- `../decisions.md`
- `../master-flow.md`
- `../registry.md`
- `../matrices.md`
- `../OWNER-CONTROL-POLICY.md`

Important reviewed Decision families include:

- `UX-01-*`
- `UX-02-*`
- `UX-03-*`
- `NAV-01-*`
- `UI-01-*`
- `INT-01-*`
- `ORIGIN-FLOW-01`
- `ORIGIN-FLOW-02`
- `ORIGIN-UX-01-07` through `ORIGIN-UX-01-29` as applicable
- `PLATFORM-01-01`
- `SES-01-02`
- `SES-01-04`
- `SES-01-05`
- `DM-01-01`
- `DM-01-03`
- `DM-02-01`
- `DM-02-05`
- `CONTENT-02-04`
- `CONTENT-02-09`
- `CONTENT-02-11`

Prototype-detail sources:

- `DESIGN-DEFAULTS.md`
- `SURFACE-CATALOG.md`
- `COMPONENT-CATALOG.md`
- `LAYER-MODEL.md`
- `STATE-MODEL.md`
- `SCENARIO-CATALOG.md`
- `MOCK-DATA-CONTRACT.md`
- `PROTOTYPE-ACCEPTANCE.md`

---

# KNOWN TECHNICAL GAPS

The prototype may visualize these only through fixtures:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

The prototype MUST visibly avoid implying that these production contracts have been solved.

---

# REQUIRED PROTOTYPE STRUCTURE

## index.html

Contains:

- one root prototype harness;
- one product-frame root;
- semantic regions for global navigation, product content and Play workspace;
- surfaces/components rendered or switched by prototype JS.

Avoid a build step if possible. The prototype should open locally in a normal browser.

## prototype.css

Contains:

- design tokens;
- responsive desktop presets;
- component styles;
- layer stack;
- state styles;
- reduced-motion rules;
- no production CSS imports.

## fixtures.js

Contains synthetic fixtures from `MOCK-DATA-CONTRACT.md`.

No rules calculations.

## prototype.js

Contains:

- scene switching;
- role/view switching;
- explicit fixture-state switching;
- layer open/close;
- mock panel resizing;
- mock target selection;
- scenario loading;
- prototype-only viewport/state controls.

It MUST NOT derive gameplay legality/authority.

---

# PROTOTYPE CONTROLS

Required controls:

- Surface dropdown;
- Scenario dropdown;
- View: `Host / DM` | `Client / Player` | `Offline`;
- Mode: `Freeform` | `Initiative`;
- Viewport preset: `Wide` | `Normal` | `Narrow`;
- State toggles for loading/error/reconnecting;
- Handout mode selector;
- Public / DM Only mock selector for DM scenarios;
- Reduced Motion toggle;
- Reset Layout;
- Component Gallery entry.

The controls must be clearly marked prototype-only.

---

# REQUIRED UI SURFACES

Implement every required surface in `SURFACE-CATALOG.md`, including:

- Home;
- Character Library;
- both Character Sheet styles;
- accepted Builder / Level Up shell examples;
- Host Setup;
- Join + Character Select + no-Character block;
- Content / import;
- Rules;
- Settings;
- DM/Player Freeform;
- DM/Player Initiative;
- targeting/resolution/result variants;
- Activity;
- Encounter;
- advanced spatial relation tool;
- Participants;
- Session Share;
- Player Session utility;
- Handout Overlay/Upper/Full;
- Full/Quick Sheet;
- relevant confirmation/notice/error/hover examples.

---

# REQUIRED COMPONENTS

Implement and state-test the catalog in `COMPONENT-CATALOG.md`.

At minimum Component Gallery must include:

- Buttons;
- Tabs;
- Inputs;
- Character Card;
- Actor Card;
- Hotbar Slot;
- Command Center subregions;
- Initiative Entry;
- Status Badge;
- NOTICE;
- Banner;
- Toast;
- Utility Pane;
- Tooltip/Hover Frame;
- Modal;
- Activity Item.

---

# REQUIRED SCENARIOS

All scenarios in `SCENARIO-CATALOG.md` must be reachable through the prototype harness.

No scenario may require real network/backend state.

---

# RESPONSIVE / ACCESSIBILITY

Prototype must demonstrate:

- Wide 1600×1000;
- Normal 1366×768;
- Narrow 960×700;
- visible focus;
- keyboard access for common controls;
- reduced motion;
- non-color-only semantic states;
- panel/Actor Board overflow behavior;
- modal focus presentation.

The prototype need not be a fully audited production accessibility implementation, but it must be good enough to reveal design flaws before implementation.

---

# NO-INVENTION RULES

Prototype code MUST NOT calculate or infer:

- D&D mechanics;
- attack legality;
- target eligibility;
- default attack relation;
- safe concurrent commands;
- private data entitlement;
- authoritative result;
- reconnect correctness;
- content dependency semantics.

Use fixtures.

---

# FORBIDDEN FALLBACKS

- do not copy current runtime UI just because it exists;
- do not recreate the current intent-first Action Dock as product truth;
- do not add a Lobby/Ready flow;
- do not hide core action capability behind a generic drawer;
- do not put normal Attack/Spell/Item actions in Actor Context Menu;
- do not show a Player placeholder for DM-only events;
- do not replace Command Center during resolution;
- do not smart-fallback from unavailable Main Hand default action;
- do not let prototype-only harness controls appear as intended product controls.

---

# REQUIRED EVIDENCE

Before owner review:

```text
[ ] Prototype loads without production app/runtime.
[ ] All required scenario IDs are reachable.
[ ] Component Gallery exists.
[ ] Wide/Normal/Narrow presets work.
[ ] Host/DM and Client/Player views work.
[ ] Handout three modes are demonstrable.
[ ] Targeting/Resolving/Interrupt/Result are demonstrable.
[ ] Public vs DM Only split-view privacy example is demonstrable.
[ ] Activity correction chain is demonstrable.
[ ] Content live-snapshot example is demonstrable.
[ ] No src/ file changed as part of prototype execution.
```

Then run `PROTOTYPE-ACCEPTANCE.md`.

---

# STOP CONDITIONS

Stop prototype implementation and report rather than guess if:

- a requested UI requires a new material product capability not covered by Reviewed intent;
- a requested view would contradict an explicit owner Decision;
- a visual choice would silently define privacy/network/rules semantics;
- a prototype requirement cannot be represented without importing/changing `src/`;
- the owner changes a material product workflow during review and canonical Decision needs reconciliation first.

---

# COMPLETION

Prototype Work Order is complete only when:

1. required HTML/CSS/JS prototype exists;
2. scenario/catalog coverage is complete;
3. prototype acceptance checklist has been run;
4. owner has reviewed the complete prototype;
5. `PROTOTYPE-ACCEPTANCE.md` records explicit acceptance of a specific commit.

Even then, runtime UI implementation remains a separate Work Order after contract extraction/Freeze/readiness.