# SimpleVTT UI Reference Prototype

Status: **EXISTING INTEGRATED REFERENCE OWNER ACCEPTED / COMMON PLAY VISUAL REBASE REQUESTED**

The previously accepted integrated reference remains valid historical/implementation evidence until a new Common Play visual reference is explicitly approved and frozen by the Owner.

The current visual-design handoff is:

```text
../COMMON-PLAY-VISUAL-REFERENCE-PLAN.md
```

That handoff defines:

```text
5 BASE references
+ 10 REF bundles
= 15 target visual references
```

New generated images are `DRAFT` by default. They do not supersede the accepted reference, alter runtime authority, or authorize production UI implementation until Owner approval is recorded.

Historical candidates remain ineligible:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED / HISTORICAL
```

Existing accepted reference:

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

The accepted prototype remains the current runtime-preparation visual/interaction evidence until the new Common Play rebase reaches `FROZEN_REFERENCE`. It does not authorize production `src/` implementation and does not Freeze Product Decisions by itself.

---

# Mandatory baseline for new visual work

Any request to generate or revise the new Common Play UI references reads:

```text
../COMMON-PLAY-VISUAL-REFERENCE-PLAN.md
../INTEGRATED-PRODUCT-UX-PLAN.md
```

then the exact applicable Domain/Architecture/Common Play contract for the requested item.

Domain/Architecture contracts and `../decisions.md` remain higher authority for their respective domains.

Do not reverse the order and reconstruct product intent from the old prototype or current code.

---

# Current Common Play visual set

## BASE — always-visible compositions

```text
BASE-01 Home + Global Product Shell
BASE-02 Player Session / Freeform
BASE-03 Player Session / Initiative
BASE-04 DM Session / Freeform
BASE-05 DM Session / Initiative
```

## REF — contextual/transient bundles

```text
REF-01 Action Interaction
REF-02 Dynamic Choice
REF-03 Targeting + Multi-target + Allocation
REF-04 Pending Resolution + Reaction + Consent
REF-05 DM Common Play Adjudication
REF-06 Authoritative Dice + Immediate Result
REF-07 Explainability / Provenance
REF-08 Persistent Mechanics
REF-09 Session Utility Surfaces
REF-10 System Feedback / Recovery
```

All currently begin at `NOT_DRAWN`.

The BASE set must be established before transient REF layouts are finalized, because every REF needs a real spatial home in the persistent Play composition.

---

# Existing accepted prototype invariants that remain product constraints

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

Existing accepted prototype requirements were materialized into:

```text
../contracts/README.md
../contracts/SURFACE-CONTRACT.md
../contracts/COMPONENT-CONTRACT.md
../contracts/INTERACTION-STATE-MOTION-CONTRACT.md
../contracts/IMPLEMENTATION-TRACEABILITY.md
```

These remain implementation evidence. If the Owner approves a materially different Common Play visual reference, affected contracts must be reconciled before runtime implementation uses the new design.

Implementation agents should not reverse-engineer prototype fixtures as production schemas.

---

# Remaining technical gaps

Runtime work still cannot guess:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

Visual references may demonstrate these with explicit fixtures, but production implementation requires the owning Domain/Architecture contract.

---

# Current phase

```text
Integrated Product / UI / UX Plan          DONE
Existing Integrated Reference               OWNER ACCEPTED
Common Play Visual Rebase Plan              CREATED
BASE-01~05                                  NOT_DRAWN
REF-01~10                                   NOT_DRAWN
New Owner visual review                      PENDING
New Common Play FROZEN_REFERENCE             NOT SET
Runtime src Implementation                   NOT AUTHORIZED BY VISUAL WORK
```

Next visual action is `BASE-01` unless the Owner explicitly chooses another item.
