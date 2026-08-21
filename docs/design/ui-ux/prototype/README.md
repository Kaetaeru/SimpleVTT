# SimpleVTT UI Reference Prototype

Status: **INTEGRATED REFERENCE STATIC REVIEW CANDIDATE — browser / Owner review pending**

The prior prototype candidates are historical only:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED BY REPOSITORY-WIDE AUDIT
```

Current active review candidate:

```text
app/integrated-reference.html
```

Static verification:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Browser visual/interaction review and explicit Owner acceptance remain pending. Runtime `src/` implementation is not authorized.

---

# Mandatory baseline before any prototype work

Read first:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
```

Then read exact applicable Domain/Architecture contracts and Product Decisions before the prototype catalogs.

The integrated plan is the cross-source interpretation baseline. It does not replace Domain/Architecture truth or `decisions.md`.

---

# Current prototype state

```text
Integrated product/UI audit: DONE
Prototype specification reconciliation: DONE
Active review entry: app/integrated-reference.html
Static mapless verification: PASS
Browser/visual interaction QA: PENDING
Prototype Acceptance: PENDING
Runtime preparation: BLOCKED
Runtime src implementation: NOT AUTHORIZED
```

Do not open either historical candidate for product acceptance.

---

# Why the old `final-spec.html` is invalid

Material violations:

1. Actor fixtures introduced `sceneX/sceneY` as if Core owned spatial positions.
2. The central Play area visually became a battlemap-like field.
3. `Scene/Table` wording was read without the higher-authority mapless Core contract.
4. The prototype process reacted to local feedback instead of first rebuilding from the whole repository plan.

The active candidate was rebuilt instead of patching this structure toward acceptance.

---

# Current candidate invariants

## First launch

The first meaningful first-run panel is the dedicated Tutorial/Onboarding window.

It includes:

- Standalone vs Connected orientation;
- initial Official-style vs SimpleVTT Character Sheet choice;
- Character / Host / Join orientation;
- later reopen path from Settings/Help.

## Mapless Core

Connected Play contains no Core battlemap.

Forbidden:

- Actor x/y coordinates;
- draggable map tokens;
- square/hex grid;
- movement paths/traces;
- range rings/templates derived from a map;
- Fog of War;
- LoS rays/geometry;
- collision/pathfinding UI;
- Handout used as a tactical map.

`Scene`, `Tabletop Stage` and `Roll Area` are presentation/context terms only.

## Connected Play skeleton

```text
Compact Play chrome/status
Upper NPC / Neutral / Hostile Actor Board
Play Context / Tabletop Stage              [contextual utility pane]
Lower Player / Allied Actor Board
Persistent Command Center
```

Initiative adds compact tracker/economy to the same structure.

Freeform does not fake turn economy.

## Standalone dice

Any ordinary roll keeps the current Character Sheet visible and spatially stable.

Dice use transient presentation over/within the current Sheet viewport; no detached dice/result route/window/panel and no required Close/Back merely to resume the Sheet.

## Targeting

Target through Actor Cards/manual target sets supplied by authoritative/mock eligibility.

No map-position targeting or Core AoE template.

## DM control / role continuity

- selected-action targeting keeps priority;
- explicit DM control mode outranks ordinary hostile-click behavior when no action is targeting;
- Command Center controlled-Actor identity follows the DM-controlled Actor;
- safe Product-shell navigation restores the prior Host/DM or Client/Player connected identity on Return to Play.

## Handout / spatial

Handout is shared presentation, not map state.

Advanced spatial UI is a contextual Actor-pair fact editor; it is not a map editor and is not promoted as a routine primary Play control.

---

# Prototype scope boundary

Prototype work remains confined to:

```text
docs/design/ui-ux/prototype/app/
docs/design/ui-ux/prototype/
```

plus bounded routing/derived-doc maintenance under `docs/design/ui-ux/`.

It MUST NOT:

- modify production `src/` UI;
- call real backend/network/storage;
- implement rules/authority/privacy semantics;
- copy fixture data models into production contracts;
- treat `.agents`, old demos or current tests as higher authority than formal Product/Domain sources.

---

# Verification and review sequence

```text
Integrated Product / UI / UX Plan          DONE
Prototype catalog/default/layer reconcile  DONE
Integrated Reference build                 DONE
Static mapless verification                PASS
-> Browser / visual interaction review     PENDING
-> Owner natural-language iteration
-> Explicit Prototype Acceptance
-> contract extraction / technical-gap resolution / legacy reconciliation
-> scoped Freeze/readiness
-> separate runtime Work Order + authorization
-> src implementation
```

Acceptance gate:

```text
PROTOTYPE-ACCEPTANCE.md
```

Current verification:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
```
