# SimpleVTT UI Reference Prototype

Status: **INTEGRATED REFERENCE OWNER ACCEPTED — runtime preparation handoff complete**

Historical candidates remain ineligible:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED / HISTORICAL
```

Accepted reference:

```text
app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
Accepted by Owner: 2026-08-21
```

Acceptance record:

```text
PROTOTYPE-ACCEPTANCE.md
```

Static verification:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
```

The accepted prototype is now the visual/interaction reference for runtime-preparation contracts. It does not authorize production `src/` implementation and does not Freeze Product Decisions by itself.

---

# Mandatory baseline

Broad UI work reads:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
```

before interpreting prototype detail.

Domain/Architecture contracts and `../decisions.md` remain higher authority for their respective domains.

---

# Accepted prototype invariants

## First launch

First meaningful fresh-run panel:

```text
Tutorial / Onboarding
-> Standalone vs Connected orientation
-> Official-style vs SimpleVTT Sheet choice
-> Character / Host / Join orientation
-> Home
```

Tutorial can be reopened later.

## Mapless Core

Connected Play has no Core:

- Actor x/y tactical coordinates;
- draggable map tokens;
- square/hex grid;
- tactical movement/path UI;
- Fog of War;
- LoS geometry;
- map range/AoE templates;
- Handout-as-map interaction.

## Connected Play skeleton

```text
Compact Play chrome/status
Upper NPC / Neutral / Hostile Actor Board
Shared Play Context / Tabletop Stage      [contextual utility]
Lower Player / Allied Actor Board
Persistent Command Center
```

Freeform uses no fake turn economy.

Initiative adds tracker/turn economy to the same skeleton.

## Standalone dice

Routine Character rolls stay on the current Sheet with transient dice/result presentation over/within the same viewport.

No detached dice/result route/window/panel and no mandatory Close/Back.

## Targeting

Actor Cards/manual target sets only.

Single valid target submits directly; multi-target uses Execute; no Core AoE map template.

## Role/control continuity

- Host remains DM; Client remains Player;
- selected-action targeting has priority;
- explicit DM control mode outranks default hostile-click behavior when no action is targeting;
- controlled-Actor summary follows actual controlled Actor;
- Return to Play restores the existing connected role/context.

## Handout / spatial facts

Handout is presentation, not tactical map state.

Advanced spatial UI is a contextual Actor-pair fact editor, not a coordinate editor.

---

# Runtime-preparation handoff

Accepted prototype requirements have been materialized into:

```text
../contracts/README.md
../contracts/SURFACE-CONTRACT.md
../contracts/COMPONENT-CONTRACT.md
../contracts/INTERACTION-STATE-MOTION-CONTRACT.md
../contracts/IMPLEMENTATION-TRACEABILITY.md
```

Implementation agents should use those contracts rather than reverse-engineering prototype HTML/CSS/fixtures.

Prototype fixture objects are review data, not production schemas.

---

# Remaining technical gaps

Runtime work still cannot guess:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

The accepted UI may demonstrate these with fixtures, but production implementation requires the owning Domain/Architecture contract.

---

# Current phase

```text
Integrated Product / UI / UX Plan          DONE
Prototype specification reconciliation    DONE
Integrated Reference build                 DONE
Static verification                        PASS
Owner visual/interaction review             PASS
Prototype Owner Acceptance                  PASS
Surface Contract                            DONE
Component Contract                          DONE
Interaction/State/Layer/Motion Contract     DONE
Implementation Traceability                 DONE
Runtime Preparation                         IN PROGRESS / NOT READY
Runtime src Implementation                  NOT AUTHORIZED
```

The next step is to choose a bounded runtime implementation slice, resolve only its blocking technical gaps, reconcile touched legacy code/tests, identify exact Product Decision dependencies, obtain scoped Freeze authorization where needed, and then write a separate runtime Work Order.
