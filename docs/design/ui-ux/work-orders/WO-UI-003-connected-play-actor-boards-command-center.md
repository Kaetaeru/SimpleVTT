# WO-UI-003 — Connected Play Actor Boards / Tabletop Stage / Persistent Command Center

Status: **AUTHORIZED — IMPLEMENTATION IN PROGRESS**

Date: 2026-08-22

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

Authorization record:

`WO-UI-003-SCOPED-AUTHORIZATION.md`

---

# 1. Goal

Reconcile the production Connected Play workspace with the Owner-accepted mapless layout contract without changing Session authority, combat rules, transport, persistence, or Character rules.

Required stable production composition:

```text
Compact Play chrome / connection status
Upper opposing Actor Board
Shared Play Context / Tabletop Stage      [contextual utility]
Lower allied Actor Board
Persistent Command Center
```

Initiative extends this same skeleton; it does not replace it with a Combat route.

---

# 2. In scope

## Connected Play topology

- add an Upper Actor Board driven by canonical `SceneVm.entities`;
- retain a broad mapless Tabletop Stage / Play Context;
- add a Lower Actor Board driven by canonical `SceneVm.entities`;
- preserve contextual utilities as panes/layers rather than primary permanent workspace columns;
- keep a persistent bottom Command Center reachable in Freeform and Initiative.

## Actor Cards / Boards

Cards may render only already-supplied runtime facts such as:

- Actor identity;
- ally/enemy relation supplied by `SceneEntity.side`;
- HP / Temp HP;
- status;
- AC;
- Initiative/current-turn state when present;
- selected/controlled context where canonical state exists.

Board density must use horizontal scrolling before card collapse.

The current runtime relation schema contains `ally | enemy`; this slice does not invent a new `neutral` domain relation. The Upper Board therefore presents current opposing/non-allied runtime Actors honestly from existing projections.

## Command Center

Replace the historical intent-first primary funnel in `SessionActionDock` with persistent direct capability discovery over authoritative `ActionVm[]`.

Baseline page family:

- Mixed;
- Action;
- Spell;
- Item.

The Command Center must include:

- current controlled/action Actor summary;
- HP / Temp HP / important status where supplied;
- Resource Rail only from actual Actor/Character projection;
- Initiative economy only while Initiative is active;
- direct Hotbar slots from canonical `actionsByActor[actorId]`;
- unavailable reasons from `ActionVm.disabledReason`;
- existing direct action/target submission path.

Automatic capability discovery is in scope. User-persisted Hotbar customization is not introduced unless an existing canonical persistence contract is found during implementation.

---

# 3. Primary behavior scenarios

Directly touched:

- Scenario 10 — Connected Freeform baseline;
- Scenario 11 — Start Initiative;
- Scenario 12 — Select an action and target one Actor;
- Scenario 13 — Multi-target action;
- Scenario 15 — Invalid target;
- Scenario 19 — DM control changes Command Center;
- Scenario 20 — Resolving action;
- Scenario 23 — Connected dice and result;
- Scenario 37 — Narrow desktop;
- Scenario 43 — Empty Actor Board;
- Scenario 44 — Many Actors;
- Scenario 45 — Long names / many resources.

Adjacent regression:

- Scenario 31 — Rules lookup during live Session;
- Scenario 32 — Quick Sheet;
- Scenario 33 — Full Sheet in live Session;
- Scenario 34 — Product navigation during live Host Session;
- Scenario 35/36 — reconnect/disconnect context preservation.

---

# 4. QA rows

Primary:

```text
QA-ID-01
QA-ID-02
QA-PLAY-01
QA-PLAY-02
QA-PLAY-03
QA-PLAY-04
QA-PLAY-05
QA-PLAY-06
QA-MODE-01
QA-MODE-02
QA-MODE-03
QA-MODE-04
QA-MODE-05
QA-MODE-06
QA-ACTOR-01
QA-ACTOR-02
QA-ACTOR-03
QA-ACTOR-05
QA-ACTOR-06
QA-ACTOR-07
QA-CMD-01
QA-CMD-02
QA-CMD-03
QA-CMD-04
QA-CMD-05
QA-CMD-06
QA-TGT-01
QA-TGT-02
QA-TGT-03
QA-RES-01
QA-RES-07
```

`QA-RES-02` / `QA-RES-03` remain BLOCKED by `GAP-RESOLUTION-SAFE-INTERACTIONS`; this Work Order must not claim them PASS.

`QA-TGT-05` / default hostile Main Hand behavior remains outside this slice because `GAP-MAIN-HAND-CANONICAL-RELATION` is unresolved.

---

# 5. Product decision dependencies

Use the reviewed decisions as the implementation baseline for this bounded slice:

```text
UX-01-04
UX-01-05
UX-01-06
UX-01-07
UX-02-01
UX-02-07
UX-03-03
UX-03-04
UI-01-02
UI-01-03
UI-01-04
UI-01-05
UI-01-06
UI-01-09
ORIGIN-UX-01-09
ORIGIN-UX-01-10
ORIGIN-UX-01-11
ORIGIN-UX-01-15
```

This scoped authorization does not globally freeze unrelated decisions.

---

# 6. Authoritative state sources

UI reads, but does not replace, these existing sources:

- `AppProvider` snapshot/runtime operations;
- `AppSnapshot.session` and `connectionState`;
- `AppSnapshot.sessionMode`;
- `SceneVm.entities`;
- `SceneVm.actionsByActor`;
- `SceneVm.economyByActor`;
- `SceneVm.currentActorId` / `selectedActorId`;
- `ActionVm.available`, `disabledReason`, `eligibleTargetIds`, `maxTargets`, resource/item cost;
- owning local `activeCharacter` where that Character is the actual controlled Player Actor;
- existing `resolveAction`, `selectDmActor`, Initiative/Session operations.

The UI must not calculate D&D legality, target range/LoS, resource truth, Main Hand substitution, reconnect truth, or privacy delivery.

---

# 7. Explicit exclusions

Not authorized by this Work Order:

- battlemap, Actor x/y, grid, pathfinding, Fog of War, LoS geometry, AoE map templates;
- new transport/network protocol;
- Session lifecycle redesign beyond preserving current accepted behavior;
- default hostile click -> Main Hand implementation;
- smart action fallback;
- selective resolution-safe interaction calculation;
- new DM-only/private delivery protocol;
- Handout networking/reconnect architecture;
- Character rules/progression changes;
- invented neutral-relation domain schema;
- invented Hotbar persistence/customization schema.

---

# 8. Expected touched runtime files

Primary candidates:

- `src/SessionModeRoot.tsx`;
- `src/session-mode.css`;
- new/reused Actor Board presentation component(s);
- `src/SessionActionDock.tsx`;
- `src/session-action-dock.css`;
- Session UI structural tests;
- `.github/workflows/ui.yml` if a new dedicated gate is added.

Existing utility, resolution, Quick Sheet, Full Sheet, reconnect and Handout surfaces should be preserved unless minimal composition changes are necessary to keep the accepted skeleton visible.

---

# 9. Definition of done

Automated:

- dedicated topology/Command Center structural checks PASS;
- stale intent-first structural expectations removed or reconciled;
- existing Session utility/Initiative/reconnect/Product continuity regressions PASS;
- TypeScript PASS;
- production build PASS;
- broad UI workflow PASS on one exact head.

Human:

Owner verifies in Tauri Connected Play that:

1. the visual skeleton visibly matches the accepted reference direction;
2. upper opposing Actors and lower allied Actors are board/card regions;
3. central Stage remains mapless and broad;
4. Command Center is persistent and directly exposes capabilities;
5. Initiative adds tracker/economy without replacing the skeleton;
6. narrow desktop remains usable;
7. Product Shell Return-to-Play still preserves the same session.

Do not close WO-UI-003 until Owner Human QA is recorded.
