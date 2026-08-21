# SimpleVTT UI Reference Prototype

Status: **FINAL-SPEC REPLACEMENT REVIEW CANDIDATE — owner browser review pending**

This directory contains the non-production UI Reference Prototype that must be reviewed before broad runtime UI implementation.

The first prototype candidate was rejected during owner review because it drifted from already-reviewed Product/UX intent. It is no longer the active reference.

---

# Active review entry

Open:

```text
docs/design/ui-ux/prototype/app/final-spec.html
```

Do **not** use the historical `app/index.html` candidate as a product-reference or runtime implementation source.

Owner corrections that control the rebuild:

[`OWNER-CORRECTIONS.md`](OWNER-CORRECTIONS.md)

Final-Spec static verification:

[`FINAL-SPEC-VERIFICATION.md`](FINAL-SPEC-VERIFICATION.md)

---

# Why the first candidate was rejected

Two material drifts were identified:

1. Offline/Standalone dice were presented through a detached-looking roll layer/card instead of rolling naturally inside the current Character Sheet surface.
2. Connected Play approximated the intended HUD instead of strictly preserving the reviewed Dual-Anchor topology.

The replacement Final-Spec demo treats these as hard requirements rather than styling suggestions.

---

# Final-Spec hard structure

## Offline / Standalone

Every ordinary Character roll stays in the current Sheet:

```text
Current Character Sheet
  -> click Skill / Save / Attack / Damage / other roll
  -> dice animate inside the Sheet workspace
  -> die settles to fixture-authoritative face
  -> result is read inside the same Sheet
  -> Sheet never navigates away
```

No modal, drawer, detached result window, replacement route or separate Close/Back cycle is allowed for ordinary Standalone rolls.

## Connected Play

The core product skeleton is:

```text
Compact Play chrome / session status
────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
────────────────────────────────────
Central Scene / Table Context       [contextual side utility]
  └ Initiative Tracker overlays Scene top edge
  └ Dice roll on the Scene/Table plane
  └ NOTICE / immediate result stay scene-integrated
────────────────────────────────────
Lower Player / Allied Actor Board
────────────────────────────────────
Persistent BG3-family Command Center
  upper row: Action / Bonus / Reaction / Movement + Resource Rail
  lower-left: controlled Actor status
  lower/right: Hotbar / actions
  contextual: End Turn / Execute / Cancel as applicable
```

DM and Player share this skeleton. Role-specific tools/information may differ, but the workspace does not become two unrelated products.

---

# Final-Spec candidate capabilities

The active candidate demonstrates:

- prototype-only UI Lab clearly outside the intended product frame;
- Home and Character Library;
- Official-style and SimpleVTT Standalone Character Sheets;
- same-Sheet dice rolls for skill/save/attack/damage fixture examples;
- Session Host / Join / no-Character block references;
- Content / Rules / Settings reference surfaces;
- DM and Player Freeform;
- DM and Player Initiative using the same skeleton;
- upper opposing and lower allied Actor Boards with minimum card width + overflow;
- central Scene/Table with Actor tokens;
- persistent bottom Command Center;
- Hotbar pages / Economy / Resource Rail;
- valid / invalid / selected target states;
- single-target immediate submission and multi-target explicit Execute;
- canonical Main Hand fixture behavior with no smart fallback;
- resolution dice on the Scene/Table;
- scene-integrated result;
- Activity public/private filtering with no Player placeholder for DM-only fixture entries;
- Encounter / Participants / Session / advanced DM spatial side panes;
- Handout Overlay / Upper / Full examples inside Play;
- Actor right-click context menu limited to UI/context management;
- rich hover/focus explanations;
- NOTICE/reconnect state examples;
- Wide / Normal / Narrow desktop presets;
- Reduced Motion;
- Component Gallery.

All game/network-looking values are synthetic fixtures. The demo does not calculate rules or implement real privacy/network semantics.

---

# Prototype runtime boundary

Active Final-Spec app files:

```text
app/final-spec.html
app/final-spec.css
app/final-spec.js
app/final-spec-fixtures.js
app/final-spec-stability.js
```

They MUST NOT:

- import or modify production `src/` UI;
- call a real backend/network/storage system;
- calculate D&D legality, target eligibility, authority or outcomes;
- invent missing privacy/reconnect/network contracts;
- become a production schema or hidden alternate runtime.

---

# Historical first candidate

These files remain only for traceability:

```text
app/index.html
app/prototype.css
app/prototype.js
app/fixtures.js
app/review-patch.css
app/review-patch.js
```

Status: **REJECTED / SUPERSEDED FOR REVIEW**

No future runtime Work Order may cite them as the intended product UI.

---

# Current phase

```text
P0 Prototype specification: PASS
First prototype candidate: REJECTED
P1 Final-Spec replacement: REVIEW CANDIDATE CREATED
Final-Spec static structural verification: PASS
P2 Owner visual/interaction review: READY
P3 Explicit Prototype Acceptance: NOT STARTED
P4 Runtime contract/Freeze preparation: BLOCKED
P5 Runtime UI implementation: NOT AUTHORIZED
Frozen Product Decisions: NONE
```

The current execution environment cannot perform a real browser run of the GitHub-hosted files, so browser interaction/visual acceptance is deliberately still pending.

---

# Technical gaps remain technical

The demo may visualize these through fixtures but does not solve them:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

They remain runtime blockers for affected scopes.

---

# Runtime gate

Even after prototype acceptance, runtime UI work still requires:

1. reconcile explicit owner corrections into applicable canonical runtime planning;
2. extract Surface / Component / Motion contracts;
3. resolve applicable Domain/Architecture gaps;
4. reconcile conflicting legacy UX docs;
5. Freeze only the implementation dependencies explicitly approved for the runtime scope;
6. prepare a scoped runtime Work Order;
7. obtain separate runtime implementation authorization.

Therefore the next step is **browser review of `app/final-spec.html`**, not production `src/` implementation.
