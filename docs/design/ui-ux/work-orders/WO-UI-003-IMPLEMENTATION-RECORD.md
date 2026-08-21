# WO-UI-003 — Implementation Record

Status: **OWNER HUMAN QA FAIL — ACCEPTED-REFERENCE REWORK IN PROGRESS**

Work Order:

`WO-UI-003-connected-play-actor-boards-command-center.md`

Scoped authorization:

`WO-UI-003-SCOPED-AUTHORIZATION.md`

Human QA:

`WO-UI-003-HUMAN-QA.md`

Accepted visual/interaction reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
accepted candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Concrete render reference used by this rework:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
docs/design/ui-ux/prototype/app/integrated-reference.js
docs/design/ui-ux/prototype/app/integrated-reference.css
docs/design/ui-ux/prototype/app/integrated-reference-fixtures.js
```

Semantic / authority guard:

`docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md` + `docs/design/ui-ux/contracts/*`.

---

# 1. Previous implementation — SUPERSEDED

The first WO-UI-003 implementation added the correct named regions but only approximated the accepted composition.

Its automated source of record was:

```text
fb007d809ab586ca8d2e135e5813e929772a7f2c
UI run_id: 32496754716
conclusion: SUCCESS
```

That automation is now **historical evidence only**.

Owner Human QA subsequently reported that the production Session scene was materially different from the pre-agreed accepted prototype. Therefore the old `PASS` does not count as WO-UI-003 acceptance.

The old structural gate was insufficient because it verified broad region presence/order without pinning the actual accepted Play scene geometry, chrome, utility relationship, Initiative anatomy, Command Center anatomy and density.

---

# 2. Human QA failure diagnosis

Material drift in the rejected implementation:

```text
rejected runtime                         accepted integrated reference
──────────────────────────────────────   ──────────────────────────────────────
52px separate identity/session header    41px compact Play chrome
vertical Session utility rail            chrome utilities + right contextual pane
Actor Board left label gutter            full-width 86px horizontal Actor bands
different ActorCard anatomy               ~164–258px cards, 73px high
large Freeform/Initiative center UI       restrained centered mapless Stage focus
large Initiative control strip            ~40px order tracker at Stage top edge
Initiative economy in tracker             economy in Command Center upper rail
2-column Command Center                   37px top rail + 240/flex/104 lower body
~132–142px Hotbar slots                   ~70px compact Hotbar slots
```

Human QA record contains the Owner's exact rejection and rework requirement.

---

# 3. Rework principle

For this rework, prose contracts are **not** treated as permission to create a different visual composition.

The accepted prototype render itself is the visual source of truth for the production Play scene, subject to canonical runtime/domain authority.

Primary visual scenarios:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

Initiative is the same scene with the accepted compact tracker/economy additions.

Production data remains real runtime data; prototype fixture values are never copied into production as authority.

---

# 4. Accepted geometry now pinned in production

Wide/normal desktop baseline:

```text
Play chrome             41px
Upper Actor Board       86px
Mapless Stage           flexible remainder
Lower Actor Board       86px
Command Center          174px
Initiative tracker      ~40px, Stage top edge
Contextual utility      338px nominal / 288–455px bounds
Command body            240px / flexible Hotbar / 104px
Hotbar slot             ~70px
```

Constrained desktop follows the accepted prototype family:

```text
Actor Board             80px
Command Center          164px
Utility pane            308px overlay, max 42%
Actor Card              ~150px minimum/basis
Command body            190px / flexible / 90px
Hotbar slot             ~62px
```

---

# 5. Rework runtime changes

## `src/ProductRoot.tsx`

- removed the separate floating `SimpleVTT 메뉴` visual from Connected Play;
- Product exit now comes from the accepted compact Play chrome as `← Product`;
- local `product | play` presentation state and live-session authority separation remain unchanged;
- Return-to-Play still reuses the same `SessionModeRoot`.

## `src/SessionModeRoot.tsx`

Production Connected Play now mirrors the accepted render composition:

```text
Play chrome
└─ Product / session identity / connection / contextual utility launchers

Play main
├─ Play core
│  ├─ Upper Actor Board
│  ├─ Mapless Stage
│  │  ├─ Stage label
│  │  ├─ compact Initiative tracker when active
│  │  └─ centered live focus / result context
│  └─ Lower Actor Board
└─ contextual right utility pane when open

Persistent Command Center
```

The old permanent vertical utility rail and the separate 52px identity header are no longer part of the production Connected Play composition.

Existing Quick Sheet, Full Sheet, Rules, Activity, Encounter, Participants, Handout, reconnect and resolution owners are preserved rather than reimplemented.

## `src/SessionInitiativeStrip.tsx`

- reduced to a compact authoritative order projection;
- renders initiative order/current turn only;
- no longer owns economy, End Turn or End Initiative controls;
- economy/End Turn remain in the persistent Command Center, matching the accepted scene relationship.

## `src/SessionActionDock.tsx`

Rebuilt to the accepted Command Center anatomy:

```text
37px upper rail
├─ Initiative economy OR Freeform no-economy state
└─ Resource Rail

lower body
├─ controlled Actor summary
├─ direct Hotbar: Mixed / Action / Spell / Item
└─ contextual Cancel / Execute / End Turn / Context
```

Canonical runtime sources remain:

- `SceneVm.actionsByActor`;
- `SceneVm.economyByActor`;
- `ActionVm.available` / `disabledReason`;
- `eligibleTargetIds` / `maxTargets`;
- active Character resources only when that Character is the actual action Actor;
- existing `resolveAction` and `endTurn` commands.

No visual position becomes gameplay authority.

## `src/session-integrated-reference-play.css`

New last-loaded Connected Play visual contract derived directly from `integrated-reference.css`.

It pins the accepted scene proportions, compact chrome, Actor bands/cards, Stage treatment, Initiative tracker, right utility pane, Command Center anatomy, Hotbar density and constrained-desktop behavior.

Legacy CSS remains for existing reused components but is overridden at the Connected Play composition boundary.

---

# 6. Verification gate strengthened

`tests/ui/connectedPlayAcceptedTopology.test.ts` no longer checks only that named regions exist.

It now reads both production source and the accepted prototype source and pins:

- `renderPlay()` relationship: chrome -> play-main -> upper board -> Stage -> lower board -> Command Center;
- accepted `41 / 86 / flexible / 86 / 174` geometry;
- no vertical utility rail;
- accepted Actor Card band dimensions;
- accepted Stage label/visual role;
- compact ~40px Initiative tracker;
- Command Center `37px + 240/flex/104` anatomy;
- compact ~70px Hotbar slots;
- 338px contextual right pane and narrow overlay behavior;
- canonical mapless/authority boundaries.

Related continuity, Initiative, Command Center and responsive tests were updated to the same accepted-reference model.

---

# 7. Authority preservation

The rework changes presentation/composition, not the authoritative session model.

Still authoritative outside the visual components:

```text
AppProvider snapshot
Session identity / role / lifecycle / connection
Scene entities
Scene actions/economy/current actor/selected actor
Action availability / disabled reason / target eligibility
resolveAction / selectDmActor / endTurn
existing transport, persistence and rules services
```

The rework does not add:

- battlemap / grid / Actor coordinates;
- UI-derived target legality, range or LoS;
- Main Hand smart fallback;
- privacy entitlement logic;
- reconnect truth;
- new Handout networking;
- new Character rules.

---

# 8. Still not claimed

This rework does not silently resolve known open contracts:

- full production ActorCard target-valid / invalid / selected projection semantics;
- canonical default hostile Main Hand path;
- selective safe-interaction locking during PendingResolution;
- DM-only/private delivery protocol;
- Handout network/reconnect architecture.

Target selection currently continues through the existing authoritative target-selection path; it must not be mistaken for completion of every accepted prototype targeting interaction.

---

# 9. Current verification state

Current rework source candidate before documentation-only status updates:

```text
f71813de7fa71e09eeb6422915e1e5d2865cd50f
```

Exact-head automation is running/queued and is **not yet recorded as PASS** here.

Current state:

```text
OWNER HUMAN QA: FAIL (previous visual implementation)
ACCEPTED-REFERENCE REWORK: IMPLEMENTED SOURCE CANDIDATE
REWORK AUTOMATION: PENDING
REWORK OWNER HUMAN QA: NOT YET RE-RUN
```

Do not close WO-UI-003 until both the strengthened exact-head automation and a new Owner visual QA pass are recorded.
