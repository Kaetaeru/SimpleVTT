# SimpleVTT UI Reference Prototype

Status: **CURRENT CANDIDATE INVALIDATED — SPEC RECONCILIATION / REBUILD REQUIRED**

The previously named Final-Spec prototype is **not** an active review candidate.

Repository-wide Product/UX reconciliation found that it interpreted `Scene/Table` as a battlemap-like field and introduced synthetic Actor `sceneX/sceneY` coordinates. This conflicts with the canonical mapless Core boundary in `docs/design/README.md` and `docs/design/movement-modules.md`.

It also demonstrated why broad prototype work must not read only the local prototype documents: direct Owner first-run Tutorial requirements and historical product decisions were spread across formal UI planning, owner-review provenance and non-canonical `.agents` working history.

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
First candidate app/index.html: REJECTED / HISTORICAL
Later candidate app/final-spec.html: INVALIDATED BY REPOSITORY-WIDE AUDIT
Active review entry: NONE
Prototype specification: NEEDS RECONCILIATION
Prototype rebuild: REQUIRED
Browser/Owner review: BLOCKED UNTIL NEW CANDIDATE EXISTS
Prototype Acceptance: NOT STARTED
Runtime preparation: BLOCKED
Runtime src implementation: NOT AUTHORIZED
```

Do not open either old candidate for product acceptance.

They may be inspected only as historical evidence of what failed.

---

# Why `final-spec.html` is invalid

Material violations:

1. Actor fixtures introduced `sceneX/sceneY` as if Core owned spatial positions.
2. The central Play area visually became a battlemap-like field.
3. `Scene/Table` wording was read without the higher-authority mapless Core contract.
4. The prototype process reacted to local feedback instead of first rebuilding from the whole repository plan.

The next candidate must be a new/rebased build, not incremental acceptance of this structure.

---

# Non-negotiable rebuild rules

## First launch

The first meaningful first-run panel is the dedicated Tutorial/Onboarding window.

It includes:

- Standalone vs Connected product explanation;
- initial Official-style vs SimpleVTT Character Sheet choice;
- basic Character / Host / Join orientation;
- later reopen path from Settings/Help.

## Mapless Core

Connected Play contains **no Core battlemap**.

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

Retain current Reviewed Product structure:

```text
Compact Play chrome/status
Upper NPC / Neutral / Hostile Actor Board
Mapless Play Context / Tabletop Stage      [contextual utility pane]
Lower Player / Allied Actor Board
Persistent Command Center
```

Initiative adds a compact tracker/economy to the same structure.

Freeform must not fake turn economy.

## Standalone dice

Any ordinary roll keeps the current Character Sheet visible and spatially stable.

Dice use a transient cinematic presentation over/within the current Sheet viewport; no detached dice/result route/window/panel and no required Close/Back just to return to the Sheet.

## Targeting

Target through Actor Cards/manual target lists supplied by authoritative/mock eligibility.

No map-position targeting or Core AoE template.

## Handout

Handout is shared presentation, not map state.

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

# Next sequence

```text
Integrated Product / UI / UX Plan          DONE
-> prototype catalog/default/layer/scenario reconciliation
-> new mapless Reference Prototype build
-> static + browser/visual QA
-> Owner iteration
-> explicit Prototype Acceptance
-> contract extraction / technical-gap resolution / legacy reconciliation
-> scoped Freeze/readiness
-> separate runtime Work Order + authorization
-> src implementation
```

Until a new candidate exists, `PROTOTYPE-ACCEPTANCE.md` is blocked rather than reviewable.
