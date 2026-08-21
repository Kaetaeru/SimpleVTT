# UI Reference Prototype — Owner Corrections

Status: **ACTIVE OWNER INPUT FOR PROTOTYPE REBUILD**

This file records explicit owner corrections discovered during prototype review. It exists to prevent the replacement prototype from repeating a known interaction mistake. It does not supersede the canonical Product/UX Decision Ledger; where a correction represents a durable product behavior, it must be reconciled into the canonical planning corpus before runtime implementation.

---

## OC-01 — Offline / Standalone dice never open a detached roll surface

**Owner correction:** In Offline/Standalone Character use, **every dice roll stays inside the current Character Sheet surface**.

Required behavior:

- Ability checks, saves, attacks, damage, skill checks, feature rolls, and any other Standalone roll use the same rule.
- Starting a roll MUST NOT open a modal, dialog, drawer, detached result card, separate route, separate window, or replacement screen.
- The current Character Sheet remains visibly present and spatially stable while dice animate.
- Dice use an in-surface Roll Plane layered over/reserved within the current Sheet workspace. It may temporarily float above sheet content, but it is still part of the same Sheet surface.
- The die originates from the far/back portion of the available roll plane, travels toward the viewer, impacts/rolls, and settles to the fixture-authoritative final face.
- Immediate result feedback is integrated into the current Sheet near the roll context and may collapse/fade after the result becomes readable.
- The user does not need a separate close/back action just to return from a Standalone roll because the user never left the Sheet.
- Reduced Motion may replace the physical travel with a simpler in-place reveal, but the Sheet and result order remain the same.

Forbidden:

- Standalone roll modal.
- Standalone roll full-screen layer.
- Detached `standalone-roll-card` that visually reads as a new window.
- Navigation to a Resolution page/route for ordinary Standalone rolls.

This correction is consistent with the existing principles that Standalone Character use is first-class, immediate results stay near the current task, and dice/result presentation is not a detached full-screen experience.

---

## OC-02 — Connected Play must use the reviewed Dual-Anchor topology exactly

The prior prototype approximated the Play HUD too loosely. The replacement demo must treat the reviewed topology as structural, not inspirational.

Required vertical composition:

```text
Compact Play chrome / return / session status
────────────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
────────────────────────────────────────────
Central Scene / Table Context       [side utility pane when open]
  └ Initiative Tracker overlays Scene top edge in Initiative
  └ Dice Roll Plane is the broad central Scene/Table itself
  └ NOTICE / immediate result stay scene-integrated
────────────────────────────────────────────
Lower Player / Allied Actor Board
────────────────────────────────────────────
Persistent BG3-family Command Center
  small upper row: economy + Resource Rail
  lower-left: controlled Actor status
  larger lower-right: Hotbar/action controls
  contextual End Turn / Execute / Confirm / Cancel where applicable
```

Structural rules:

- Scene/Actor Context and Command Center are co-primary.
- Command Center remains fixed/persistent during targeting, resolving, dice, result, and Initiative.
- Opposing Actor Board stays above the Scene and allied Player Board stays below it; neither becomes a permanent side portrait rail.
- Actor Cards stop shrinking at the minimum usable width and then use horizontal scrolling/paging.
- Initiative adds a compact horizontal tracker at the Scene top edge and does not replace Actor Boards or create a separate combat screen.
- Activity, Encounter, Participants, Session Share, Player Session, adjudication, and advanced DM spatial tools are contextual side panes/layers. They do not replace the core Play skeleton.
- DM and Player share this same skeleton. DM gets additional role-appropriate controls/information; Player does not get DM-only tools.
- Targeting keeps all Actor Cards visible and expresses valid/invalid/selected target states on those cards.
- Selected-action targeting has click priority. Without a selected targeting action, canonical Main Hand default behavior may apply only when the fixture supplies that relation; no smart fallback is allowed.
- Single-target valid click submits immediately. Multi-target shows an explicit Execute control.
- Resolution locks only fixture-declared conflicting interactions and preserves the Command Center skeleton.
- Physical dice roll on the central Scene/Table plane; result feedback stays inside Play rather than opening a detached result screen.
- DM-only Activity/event examples leave no Player placeholder or existence marker.

---

## OC-03 — Final-spec demo quality bar

The replacement demo is not a loose wireframe.

It must be polished enough to judge the intended final product:

- realistic density and region proportions;
- complete button and state treatment;
- representative long names, many resources, multiple Actors, and utility-pane coexistence;
- role differences;
- targeting/resolution/dice/result transitions;
- wide / normal / narrow desktop behavior;
- hover/focus explanations;
- clear layer priority;
- no placeholder layout that contradicts reviewed structure.

Prototype-only harness controls remain visually outside the product frame.

---

## Superseded prototype candidate

The previous review candidate based on:

```text
app/index.html
app/prototype.css
app/prototype.js
app/fixtures.js
app/review-patch.css
app/review-patch.js
```

is **not an acceptable product-reference candidate** after these corrections. It may remain in the repository as historical prototype evidence, but it must not be used as the review entry or implementation reference.

The replacement Final-Spec Demo becomes the only active review entry after its files and verification record are complete.
