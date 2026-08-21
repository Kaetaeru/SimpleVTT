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

This slice establishes the production Actor Board/Card presentation anchor and directly covers:

- Actor identity;
- ally/enemy relation supplied by `SceneEntity.side`;
- HP / Temp HP;
- compact status;
- AC;
- Initiative current-turn emphasis when supplied;
- actual DM controlled Actor emphasis through `selectedActorId`;
- Player owning Character emphasis;
- intentional empty boards;
- useful minimum card width + horizontal overflow.

The current runtime relation schema contains `ally | enemy`; this slice does not invent a new `neutral` domain relation. The Upper Board therefore presents current opposing runtime Actors honestly from existing projections.

Full ActorCard target-valid / target-invalid / target-selected interaction styling is not invented here. Existing action targeting continues to use the already-authoritative manual eligible Actor set in the Command Center. A later targeting-specific slice may promote that projection onto ActorCard states once its exact interaction scope is selected.

## Command Center

Replace the historical intent-first primary funnel in `SessionActionDock` with persistent direct capability discovery over authoritative `ActionVm[]`.

Baseline page family:

- Mixed;
- Action;
- Spell;
- Item.

The Command Center includes:

- current controlled/action Actor summary;
- HP / Temp HP / important status where supplied;
- Resource Rail only from actual owning Character projection;
- honest empty resource presentation for Actors without projected resources;
- Initiative economy only while Initiative is active;
- direct Hotbar slots from canonical `actionsByActor[actorId]`;
- unavailable reasons from `ActionVm.disabledReason`;
- existing direct action/target submission path.

Automatic capability discovery is in scope. User-persisted Hotbar customization is not introduced because this slice has no canonical customization persistence contract.

---

# 3. Behavior scenarios

Primary:

- Scenario 10 — Connected Freeform baseline;
- Scenario 11 — Start Initiative;
- Scenario 19 — DM control changes Command Center;
- Scenario 20 — Resolving action, limited to persistent-anchor structure (selective locking remains blocked);
- Scenario 23 — Connected dice/result, limited to persistent-anchor structure;
- Scenario 37 — Narrow desktop;
- Scenario 43 — Empty Actor Board;
- Scenario 44 — Many Actors;
- Scenario 45 — Long names / many resources.

Preserved existing targeting flow regression:

- Scenario 12 — direct single-target action uses supplied eligible set;
- Scenario 13 — multi-target manual set + explicit Execute.

Adjacent regression:

- Scenario 31 — Rules lookup during live Session;
- Scenario 32 — Quick Sheet;
- Scenario 33 — Full Sheet in live Session;
- Scenario 34 — Product navigation during live Host Session;
- Scenario 35/36 — reconnect/disconnect context preservation.

Scenario 15 ActorCard invalid-state presentation and Scenario 16/17 Main Hand default hostile click are not claimed by this slice.

---

# 4. QA rows

Primary pass targets:

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
QA-ACTOR-02
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

Not claimed by this slice:

- `QA-ACTOR-01/03/04` full targeting-state semantics on ActorCard;
- `QA-CLICK-04` / `QA-TGT-05` default Main Hand relation;
- `QA-RES-02/03` selective resolution locking.

`QA-RES-02/03` remain BLOCKED by `GAP-RESOLUTION-SAFE-INTERACTIONS`.

`QA-CLICK-04` / `QA-TGT-05` remain blocked for exact runtime behavior by `GAP-MAIN-HAND-CANONICAL-RELATION`.

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
- owning local `activeCharacter` only when it is the actual Player action Actor;
- existing `resolveAction`, `selectDmActor`, Initiative/Session operations.

The UI must not calculate D&D legality, target range/LoS, resource truth, Main Hand substitution, reconnect truth, privacy delivery, or spatial geometry.

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
- invented Hotbar persistence/customization schema;
- full targeting-state promotion onto Actor Cards.

---

# 8. Touched runtime files

Primary:

- `src/SessionModeRoot.tsx`;
- `src/SessionActorBoards.tsx`;
- `src/session-actor-boards.css`;
- `src/session-connected-layout.css`;
- `src/SessionActionDock.tsx`;
- `src/session-action-dock.css`;
- Session UI structural tests;
- `.github/workflows/ui.yml`.

Existing utility, resolution, Quick Sheet, Full Sheet, reconnect and Handout components remain their existing authority owners; composition changes keep them inside the same live Session skeleton.

---

# 9. Definition of done

Automated:

- dedicated topology/Command Center structural checks PASS;
- stale intent-first structural expectations removed/reconciled;
- existing Session utility/Initiative/reconnect/Product continuity regressions PASS;
- TypeScript PASS;
- production build PASS;
- broad UI workflow PASS on one exact source head.

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
