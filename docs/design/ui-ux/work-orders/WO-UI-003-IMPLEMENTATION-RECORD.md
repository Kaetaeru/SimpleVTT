# WO-UI-003 — Implementation Record

Status: **CLOSED / ACCEPTED AFTER ACCEPTED-REFERENCE REWORK**

Work Order:

`WO-UI-003-connected-play-actor-boards-command-center.md`

Scoped authorization:

`WO-UI-003-SCOPED-AUTHORIZATION.md`

Human QA:

`WO-UI-003-HUMAN-QA.md`

Accepted visual source of truth:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
docs/design/ui-ux/prototype/app/integrated-reference.js
docs/design/ui-ux/prototype/app/integrated-reference.css
docs/design/ui-ux/prototype/app/integrated-reference-fixtures.js
accepted candidate ref: 4c12084bef603866b9b69f1bfd8f363146920184
```

Semantic/authority guards remain:

`INTEGRATED-PRODUCT-UX-PLAN.md` + `contracts/*` + canonical Domain/Architecture.

---

# 1. Previous implementation — SUPERSEDED

The first WO-UI-003 implementation reproduced only the broad named regions and was visually rejected by the Owner.

Historical source/run:

```text
source: fb007d809ab586ca8d2e135e5813e929772a7f2c
UI run: 32496754716
result: SUCCESS, but structurally insufficient
```

The earlier automation remains historical regression evidence only and is not visual acceptance.

---

# 2. Accepted-reference rework rule

When the accepted prototype already defines the Play scene, prose contracts do not authorize a visually different structural approximation.

Production follows the accepted scene composition while replacing prototype fixture values with real runtime projections.

Primary reference scenarios:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

---

# 3. Accepted geometry pinned in production

Wide/normal desktop:

```text
Play chrome             41px
Upper Actor Board       86px
Mapless Stage           flexible remainder
Lower Actor Board       86px
Command Center          174px
Initiative tracker      ~40px at Stage top
Contextual utility      338px nominal / 288–455px bounds
Command body            240px / flexible Hotbar / 104px
Hotbar slot             ~70px
ActorCard               ~164–258px, 73px high
```

Constrained desktop:

```text
Actor Board             80px
Command Center          164px
Utility pane            308px overlay / max 42%
ActorCard               ~150px
Command body            190px / flexible / 90px
Hotbar slot             ~62px
```

---

# 4. Runtime implementation

## `src/ProductRoot.tsx`

- removes the separate floating Connected Play product-menu visual;
- accepted Play chrome owns `← Product`;
- `product | play` remains presentation-only state;
- Return-to-Play reuses the same live `SessionModeRoot` and Session authority.

## `src/SessionModeRoot.tsx`

Production Connected Play follows the accepted render relationship:

```text
Play chrome
├─ Product
├─ session identity / role / connection
├─ Sheet
├─ Rules
├─ DM: Public / DM Only presentation
├─ Activity
├─ DM: Encounter
├─ DM: Participants
├─ Session
└─ DM: Spatial Facts unavailable state

Play main
├─ Upper Actor Board
├─ Mapless Stage
│  ├─ context label
│  ├─ compact Initiative tracker when active
│  └─ centered live focus / dice / result context
├─ Lower Actor Board
└─ contextual right utility pane when open

Persistent Command Center
```

There is no permanent vertical Session utility rail and no separate 52px identity header.

`Public / DM Only` preserves accepted presentation while real DM-only delivery remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

`Spatial Facts` is an explicit unavailable state rather than invented authority.

## `src/SessionDmTools.tsx`

- DM Handout is not a permanent top-chrome button;
- `Session` pane exposes the existing image/Handout path;
- existing Handout runtime/network owner remains unchanged.

## `src/SessionInitiativeStrip.tsx`

- compact authoritative order/current-turn tracker only;
- economy and End Turn remain in Command Center.

## `src/SessionMainFocus.tsx`

Freeform default:

```text
FREEFORM
Mapless shared play context
Actor context -> Boards
Dice / Result -> Center Stage
Spatial facts -> DM controlled/pane
```

Initiative default:

```text
INITIATIVE
Actor and action context, not a battlemap
```

## `src/SessionActionDock.tsx`

Accepted Command Center anatomy:

```text
37px upper rail
├─ Initiative economy OR Freeform no-turn-economy state
└─ Resource Rail

lower body
├─ controlled Actor summary
├─ direct Hotbar: Mixed / Action / Spell / Item / Custom
└─ contextual Cancel / Execute / End Turn / Context
```

Canonical runtime sources remain authoritative; visual position never becomes gameplay authority.

---

# 5. Verification gate strengthened

`tests/ui/connectedPlayAcceptedTopology.test.ts` reads production and accepted prototype source and verifies:

- accepted render region relationship;
- `41 / 86 / flexible / 86 / 174` geometry;
- no vertical utility rail;
- ActorCard band dimensions;
- Freeform/Initiative Stage relationship;
- compact ~40px Initiative tracker;
- DM chrome ordering;
- no permanent non-reference Handout chrome button;
- Command Center `37px + 240/flex/104` anatomy;
- `Mixed / Action / Spell / Item / Custom` family;
- compact ~70px Hotbar slots;
- contextual right pane bounds;
- mapless/authority boundaries.

The previous weak gate can no longer accept a visually unrelated scene simply because similarly named regions exist.

---

# 6. Exact source verification

Accepted-reference rework source SHA:

```text
acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f
```

Evidence:

```text
UI workflow: 32500827497
accepted-reference / Session structure gate: PASS
same gate on rerun: PASS

Main Playable: 32500827476
full UI / rules / TypeScript / production frontend: PASS

Connected Session: 32500827494
connected-session authority: PASS
production frontend gate: PASS
```

The UI workflow later remains globally red at `Verify Phase 09 real mechanics services` and therefore skips its own final build step.

Comparison from the prior green source to the rework shows WO-UI-003 changed Connected Play UI/CSS/UI structural tests/UI docs only; no Phase 09 mechanics service/test file changed. That separate aggregate regression was not speculatively patched inside this visual work order.

---

# 7. Authority preservation / open boundaries

The rework does not add or claim:

- battlemap / grid / Actor coordinates;
- UI-derived target legality, range or LoS;
- Main Hand smart fallback;
- selective safe-interaction locking during PendingResolution;
- DM-only delivery protocol;
- authoritative Spatial Facts projection;
- new Handout networking;
- new Character rules.

Open gaps remain open.

---

# 8. Owner acceptance

The first implementation failed Owner visual QA.

After the accepted-reference rework, the Owner performed the requested Session visual check and responded:

> 그래 잘 됐어.

This is recorded as the Human QA PASS for the reworked visual/composition slice.

---

# 9. Final acceptance state

```text
FIRST WO-UI-003 VISUAL IMPLEMENTATION: SUPERSEDED
FIRST OWNER HUMAN QA: FAIL
ACCEPTED-REFERENCE REWORK SOURCE: IMPLEMENTED
ACCEPTED-REFERENCE AUTOMATION: PASS
OWNER HUMAN RE-QA: PASS
WO-UI-003: CLOSED / ACCEPTED
```

Later product extensions, including DM Library, must preserve this accepted Connected Play scene unless the Owner explicitly revises it.
