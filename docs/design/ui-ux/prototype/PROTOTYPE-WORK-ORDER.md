# UI Reference Prototype — Work Order

Status: **EXECUTED TO REVIEW CANDIDATE — OWNER ACCEPTANCE PENDING**

**ID:** `PROTO-WO-001`

**Objective:** Build a complete interactive standalone HTML/CSS/JS UI reference so the owner can judge SimpleVTT's screens, Scene/Actor composition, Command Center, controls, layers, states and desktop reflow before production UI implementation.

This Work Order was explicitly authorized by the owner. It authorizes the **Reference Prototype only**, not runtime `src/` UI.

---

# Scope executed

Created under:

```text
docs/design/ui-ux/prototype/app/
```

Current candidate files:

```text
index.html
prototype.css
prototype.js
fixtures.js
review-patch.css
review-patch.js
README.md
```

No production `src/` file was changed by this prototype execution.

---

# Candidate coverage

The current prototype candidate includes:

- Prototype Controls isolated from product UI;
- direct Surface and 34 Scenario selection;
- Host/DM, Client/Player and Offline views;
- Freeform / Initiative;
- Wide / Normal / Narrow desktop presets;
- First Run / Home / Character Library;
- Official-style and SimpleVTT Character Sheets;
- accepted Character Builder / Level Up reference shells;
- Host Setup -> immediately live Freeform;
- Join + Character Select + no-Character blocked recovery;
- Content lifecycle / package import / Rules / Settings;
- upper opposing and lower allied Actor Boards;
- Scene/Table and persistent bottom Command Center;
- Hotbar / Action economy / Resource Rail;
- compact Initiative Tracker;
- targeting, invalid reason, single/multi target examples;
- Main Hand unavailable fixture with no smart fallback;
- resolving, interrupt, concentration, dice and result examples;
- Activity public/private filtering and correction chain;
- Encounter, Participants, Session Share, Player Session utilities;
- advanced DM distance/visibility/cover tool;
- Handout Overlay / Upper / Full modes;
- Full Sheet layer;
- Actor context menu, hover explanation, NOTICE/error/reconnect states;
- panel resizing / Reset Layout;
- Component Gallery and Reduced Motion.

---

# Hard boundaries preserved

The prototype MUST NOT and currently intentionally does not implement:

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

Those values are represented by fixtures only.

---

# Static verification

Recorded in [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md).

Current result:

```text
Candidate file inventory: PASS
34 scenario fixtures present: PASS
Prototype controls/surface selector present: PASS
Main prototype JS static search for fetch(: none
Main prototype JS static search for WebSocket: none
Main prototype JS static search for src/: none
Production src writes from this work: none
Browser visual/runtime verification: PENDING
```

The execution container could not resolve `raw.githubusercontent.com`, so it was not possible to download and execute the branch there for browser/Node runtime verification. This limitation is explicitly retained rather than presenting static review as browser acceptance.

---

# Remaining work under this Work Order

The code-authoring portion is complete enough for Owner review, but the Work Order is **not accepted/closed** yet.

Next:

1. owner opens `app/index.html` in a browser;
2. owner checks the whole experience using Prototype Controls/scenarios;
3. defects and design feedback are fixed inside the prototype;
4. AI runs `PROTOTYPE-ACCEPTANCE.md` against the reviewed candidate;
5. owner explicitly accepts a specific reference commit.

---

# Stop boundary

Do not move to runtime implementation during this review.

If prototype review exposes:

- ordinary spacing/density/layer/presentation feedback -> update prototype Design Defaults/catalog directly;
- a material workflow/capability/authority change -> reconcile the appropriate Product Decision first;
- a rules/network/privacy/persistence question -> route to Domain/Architecture contract.

---

# Runtime gate

Even after this prototype is accepted, production UI still requires a separate preparation phase:

```text
accepted prototype
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
PROTO-WO-001: REVIEW CANDIDATE BUILT
PROTOTYPE OWNER ACCEPTANCE: PENDING
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```