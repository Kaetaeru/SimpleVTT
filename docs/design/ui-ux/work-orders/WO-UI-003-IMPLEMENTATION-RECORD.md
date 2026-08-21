# WO-UI-003 — Implementation Record

Status: **IMPLEMENTED — AUTOMATED VERIFICATION PASS — OWNER HUMAN QA PENDING**

Work Order:

`WO-UI-003-connected-play-actor-boards-command-center.md`

Scoped authorization:

`WO-UI-003-SCOPED-AUTHORIZATION.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

---

# Implemented runtime slice

**Connected Play Actor Boards / Tabletop Stage / Persistent Command Center**

Production Connected Play now composes:

```text
Compact Play chrome / connection status
Upper opposing Actor Board
Shared mapless Play Context / Tabletop Stage
Lower allied Actor Board
Persistent Command Center
```

Initiative remains an extension of the same skeleton and mounts its compact tracker at the top of the Stage.

---

# Runtime implementation

## `src/SessionActorBoards.tsx`

- reads canonical `snapshot.scene.entities` only;
- Upper Board presents current `enemy` projections;
- Lower Board presents current `ally` projections;
- current runtime schema has no neutral relation, so no fake neutral model was invented;
- renders identity, relation, HP/Temp HP, AC, compact status, current-turn and controlled context;
- DM Actor selection delegates to existing `selectDmActor`;
- empty board is an intentional valid state;
- no map coordinates, grid, range, LoS, path or Main Hand authority is introduced.

## `src/session-actor-boards.css`

- preserves useful ActorCard minimum width;
- uses horizontal overflow before compression;
- responsive board height/card width for constrained desktop;
- visually distinguishes controlled/current-turn state without making cards tactical tokens.

## `src/SessionModeRoot.tsx`

Recomposed the canonical connected workspace to:

```text
header
-> upper Actor Board
-> Stage (Initiative Strip + current Session context + contextual utility launcher)
-> lower Actor Board
-> Command Center
```

Existing Quick Sheet, Full Sheet, Rules, Activity, Encounter, Participants, Handout, reconnect and resolution layers remain mounted through their existing runtime owners.

## `src/session-connected-layout.css`

- command anchor is approximately the accepted reference height (`176px` wide desktop);
- Actor Boards use approximately the accepted compact band height;
- central Stage retains nonzero flexible space;
- Initiative uses the same root rows rather than reintroducing a separate combat layout;
- final specificity guard prevents historical Initiative root-row CSS from overriding the accepted three-anchor composition.

## `src/SessionActionDock.tsx`

Historical intent-first primary navigation was removed from the connected Command Center.

Direct Hotbar pages now expose authoritative `ActionVm[]` immediately:

```text
Mixed / Action / Spell / Item
```

The Command Center projects:

- actual current action/controlled Actor;
- HP / Temp HP / status where supplied;
- owning Player Character resources only when that Character is the real action Actor;
- honest `resource projection unavailable` state for Actors without resource projection;
- Initiative economy only during Initiative;
- direct available/unavailable capabilities;
- `ActionVm.disabledReason` where supplied;
- existing `resolveAction` target submission path.

Targeting still consumes canonical `eligibleTargetIds` and `maxTargets` rather than calculating legality from board position.

Single target submits immediately; multi-target retains explicit Execute.

## `src/session-action-dock.css`

- persistent controlled-Actor summary + Hotbar layout;
- horizontally scrollable capability slots;
- target selection expands above the persistent Command Center rather than replacing it;
- constrained desktop fallbacks preserve reachability.

---

# Tests / CI

Updated:

- `tests/ui/sessionActionDockStructure.test.ts`;
- `tests/ui/sessionInitiativeExpansionStructure.test.ts`;
- `tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts`.

Added:

- `tests/ui/connectedPlayAcceptedTopology.test.ts`.

The dedicated gate asserts:

- accepted upper-board -> Stage -> lower-board -> Command Center order;
- Scene entity projection without tactical coordinates;
- board empty/density/overflow handling;
- Initiative extending the same skeleton;
- direct canonical Hotbar discovery;
- no return to intent-first primary interaction;
- no blocked Main Hand/spatial authority implementation.

`.github/workflows/ui.yml` includes this gate in the primary Session UI verification step.

---

# Authority preservation

This slice did not create a new Session or gameplay store.

Authoritative state remains in existing projections/commands:

```text
AppProvider snapshot
Session role/lifecycle/connection
SceneVm.entities
SceneVm.actionsByActor
SceneVm.economyByActor
SceneVm.currentActorId / selectedActorId
ActionVm.available / disabledReason / eligibleTargetIds / maxTargets
resolveAction
selectDmActor
existing Initiative operations
```

No UI-owned D&D legality, target distance, LoS, map geometry, Main Hand substitution, reconnect truth, privacy entitlement or resource fabrication was added.

---

# Explicitly not claimed

This slice does not claim completion for:

- full ActorCard valid/invalid/selected targeting-state semantics (`QA-ACTOR-01/03/04`);
- canonical default hostile Main Hand path (`QA-CLICK-04`, `QA-TGT-05`);
- selective safe interaction locking during PendingResolution (`QA-RES-02/03`);
- DM-only/private delivery protocol;
- Handout network/reconnect architecture;
- map module behavior.

Relevant open gaps remain unchanged.

---

# Automated verification — PASS

Final verified source candidate:

```text
fb007d809ab586ca8d2e135e5813e929772a7f2c
```

Exact-head UI workflow:

```text
run_id: 32496754716
job: frontend
conclusion: SUCCESS
```

This exact run passed:

- UI named-rule boundary;
- **accepted Connected Play topology gate**;
- Product Shell / Return-to-Play continuity;
- Session utility / Freeform / Command Center / Initiative / Handout / responsive regressions;
- broad Phase 14 UI/runtime regressions;
- connected lifecycle / late-join / ownership / inventory / spellcasting regressions;
- creation/progression regressions;
- authoritative spellcasting and Phase 09 mechanics regressions;
- **TypeScript + production build**.

An earlier full source candidate also passed the same broad UI gate (`run_id: 32496223736`), and an intermediate runtime source passed Connected Session authority, the Phase 11 offline walkthrough, and the production frontend gate. The final exact-head run above is the acceptance automation source of record.

---

# Human QA pending

Owner should now test Tauri Connected Play:

1. Host Open enters live Freeform immediately;
2. Upper opposing Actor Board is visibly present;
3. Lower allied Actor Board is visibly present;
4. central Stage is broad and mapless;
5. Command Center remains visible and shows direct Hotbar capabilities;
6. adding/selecting a DM Combatant updates the actual Actor/Command Center context;
7. Initiative adds tracker/economy without replacing Actor Boards or Command Center;
8. constrained desktop remains usable;
9. `SimpleVTT 메뉴 -> Product destination -> 플레이로 돌아가기` preserves the exact Session.

WO-UI-003 remains open until Owner Human QA is recorded.
