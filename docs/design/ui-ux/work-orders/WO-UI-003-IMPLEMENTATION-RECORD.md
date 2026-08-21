# WO-UI-003 — Implementation Record

Status: **ACCEPTED-REFERENCE REWORK IMPLEMENTED — VISUAL/FRONTEND AUTOMATION PASS — OWNER RE-QA PENDING**

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

Owner Human QA then reported that the Session scene was materially different from the pre-agreed integrated reference. That result is recorded as **FAIL** in `WO-UI-003-HUMAN-QA.md`.

The earlier automation is historical regression evidence only and is not visual acceptance.

---

# 2. Rework rule

When the accepted prototype already defines the Play scene, prose contracts do not authorize a visually different structural approximation.

Production must follow the accepted scene composition while replacing prototype fixture values with real runtime projections.

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
- Return-to-Play still reuses the same live `SessionModeRoot` and Session authority.

## `src/SessionModeRoot.tsx`

Production Connected Play now follows the accepted render relationship:

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

`Public / DM Only` is visually represented because it exists in the accepted chrome, but DM-only delivery is not faked: production remains Public-only until `GAP-DM-ONLY-DELIVERY-PROTOCOL` is resolved.

`Spatial Facts` is present as an explicit unavailable control rather than inventing a missing authoritative projection.

## `src/SessionDmTools.tsx`

- DM Handout is no longer a permanent top-chrome button;
- `Session` pane exposes `이미지 보여주기`, which opens the existing Handout utility;
- existing Handout runtime/network owner remains unchanged.

## `src/SessionInitiativeStrip.tsx`

- compact authoritative order/current-turn tracker only;
- no economy, End Turn or End Initiative controls in the tracker;
- Initiative economy and End Turn stay in the Command Center.

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

The Stage is no longer a large participant/result dashboard.

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

`Custom` is retained as the accepted presentation page family but does not invent unsupported custom persistence/classification.

Canonical runtime sources remain:

- `SceneVm.actionsByActor`;
- `SceneVm.economyByActor`;
- `ActionVm.available` / `disabledReason`;
- `eligibleTargetIds` / `maxTargets`;
- active Character resources only for the actual controlled Character;
- `resolveAction`, `selectDmActor`, `endTurn`.

No visual position becomes gameplay authority.

## CSS

`src/session-integrated-reference-play.css` pins the accepted scene proportions, Actor bands/cards, Stage, Initiative tracker, contextual utility pane, Command Center anatomy, Hotbar density and constrained-desktop behavior.

`src/session-integrated-reference-chrome.css` styles the accepted visibility control family and honest unavailable Spatial Facts state.

---

# 5. Verification gate strengthened

The first structural gate allowed a visually different implementation to pass. That gate has been replaced.

`tests/ui/connectedPlayAcceptedTopology.test.ts` now reads both production source and the accepted prototype source and verifies:

- accepted `renderPlay()` region relationship;
- `41 / 86 / flexible / 86 / 174` geometry;
- no vertical utility rail;
- accepted ActorCard band dimensions;
- accepted Freeform/Initiative Stage copy and density;
- compact ~40px Initiative tracker;
- DM chrome ordering including Public/DM Only and Spatial Facts;
- no permanent DM Handout chrome button;
- Command Center `37px + 240/flex/104` anatomy;
- `Mixed / Action / Spell / Item / Custom` Hotbar family;
- compact ~70px Hotbar slots;
- 338px contextual right pane and constrained overlay behavior;
- mapless and authority boundaries.

Related Product continuity, Session utility, Initiative, Command Center, Full Sheet, reconnect, Handout and responsive tests were reconciled to the same reference.

---

# 6. Exact source verification

Rework source SHA:

```text
acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f
```

## Accepted-reference / Session UI gate

UI workflow:

```text
run_id: 32500827497
frontend first job: 96829845409
frontend rerun job: 96830475155
```

On both attempts, the following completed successfully before the later unrelated aggregate failure:

- UI named-rule boundary;
- **accepted-reference Connected Play / Product continuity / Session layer contracts**;
- PlaySessionDock regression;
- production Play structure/accessibility;
- production Session UX;
- tabletop Sheet / physics dice / historical scene regressions;
- non-Character UX;
- Host metadata;
- live DM mechanics continuity;
- connected lifecycle / late join / connection / inventory / spellcasting;
- creation/progression suites;
- authoritative spellcasting.

The accepted-reference Session gate therefore passes on the exact source SHA.

## Full UI / rules / TypeScript / production frontend

On the same source SHA, Main Playable workflow `32500827476` completed:

```text
Verify full UI, rules, TypeScript, and production frontend: SUCCESS
Verify Phase 11 offline walkthrough: SUCCESS
Verify Phase 12 connected-session authority: SUCCESS
Verify Phase 13 arbitrary Character SessionProjection: SUCCESS
Verify Phase 14 DM prepared Combatant flow: SUCCESS
Verify Phase 14 live DM adjudication and Undo: SUCCESS
Verify Phase 14 live Combatant theater-of-mind action: SUCCESS
Verify Phase 14 Host metadata/content: SUCCESS
Verify Phase 14 live DM mechanics continuity: SUCCESS
Verify Phase 14 production play accessibility structure: SUCCESS
```

Phase 12 Connected Session workflow `32500827494` also completed its `production frontend gate` successfully on the same source SHA.

## Separate Phase 09 aggregate failure

The UI workflow is **not globally green** because its later step:

```text
Verify Phase 09 real mechanics services
```

failed on both attempts; the workflow therefore skipped its own final build step.

This is recorded separately rather than mislabeled as a visual rework failure.

Comparison from the prior green source `fb007d809...` to `acb3f68a...` shows the rework changed only:

- Connected Play UI source/CSS;
- UI structural tests;
- UI/UX documentation.

No `src/app` Phase 09 mechanics/runtime service and no Phase 09 test file changed in this rework. The mechanics failure therefore must not be "fixed" speculatively inside WO-UI-003 without identifying its own cause.

Automated status for this work order is therefore:

```text
ACCEPTED-REFERENCE VISUAL/STRUCTURAL GATE: PASS
CONNECTED SESSION AUTHORITY: PASS
FULL UI / RULES / TYPESCRIPT / PRODUCTION FRONTEND: PASS
UI WORKFLOW GLOBAL RESULT: RED at unrelated Phase 09 aggregate step
```

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

# 8. Current acceptance state

```text
FIRST WO-UI-003 VISUAL IMPLEMENTATION: SUPERSEDED
OWNER HUMAN QA OF FIRST IMPLEMENTATION: FAIL
ACCEPTED-REFERENCE REWORK SOURCE: IMPLEMENTED
ACCEPTED-REFERENCE AUTOMATION: PASS
OWNER HUMAN RE-QA: PENDING
WO-UI-003: OPEN
```

Do not close WO-UI-003 until the Owner visually checks the reworked Tauri Connected Play against the integrated reference and explicitly accepts it.
