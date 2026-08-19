# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **Initiative expansion validated; Handout integration is next**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Authorization and planning authority
The user explicitly authorized this same sequence to continue through the consolidated V0.9 UI-first implementation plan in `.chatgpt-rerun/PLAN.md`.

Resume from this durable checkpoint. Do not redo validated slices solely because rerun restarts.

## Validated checkpoints — do not repeat unless touched

### Walking skeleton
Exact source HEAD: `fbf37144d2ed56272429287419393bf221d83f44`
- UI run `32211000260`
- frontend job `95943502788`
- conclusion **SUCCESS**

### Slice 4 — in-session Full Sheet reuse
Exact source HEAD: `d1641ae415f12e2b3604c42f34f65b3f0d947338`
- UI run `32212271658`
- frontend job `95947137481`
- conclusion **SUCCESS**

### Slice 5 — in-session Rules + Activity
Exact source HEAD: `139ebcffcc537572ff198dd0140017a75dc21e97`
- UI run `32212781137`
- frontend job `95948568396`
- conclusion **SUCCESS**

### Slice 6 — low-noise Freeform Main Focus
Exact source HEAD: `fe78030c1e705ff6de1e46124d9ef7eb78e60552`
- UI run `32213234658`
- frontend job `95949840012`
- conclusion **SUCCESS**

Validated: quiet Freeform center, at most one recent meaningful result, zero Player/empty Encounter as valid active Session states, no permanent Actor wall/Activity feed/economy/action catalog.

### Slice 7 — intent-first Action Dock
Exact source HEAD: `2765beb7069e82fdb5d4ddf6284d8a81b79a9d86`
- UI run `32213526027`
- frontend job `95950668674`
- conclusion **SUCCESS**

Validated: Resting -> Intent -> Detail flow over `OFFICIAL_PLAY_INTENTS`, `intentOptions()`, current Actor `ActionVm[]`, canonical availability/disabled reasons, existing `resolveAction()`, pending protection, preserved mounted context, no second resolver/economy/target engine.

### Slice 8 — Target flow + canonical no-spatial fallback
Exact source HEAD: `1b0b156b09a6a957f19701dc9a4c53199738f6bd`
- UI run `32214271391`
- frontend job `95952727155`
- conclusion **SUCCESS**

Validated: canonical `eligibleTargetIds` target flow, existing `resolveAction()`, no UI distance/LOS legality, explicit `module:` spatial facts constrain while missing optional spatial facts are unconstrained, domain targeting semantics unchanged.

### Slice 9 — cinematic dice/result convergence
Exact source HEAD: `bcb267705ad526e54e6ca70f1193e6f500e4d268`
- UI run `32215116582`
- frontend job `95955048447`
- conclusion **SUCCESS**

Validated: one global/body-level authoritative visual dice replay, approved deep/back -> toward-user physics motion, shared 1480ms/650ms presentation timing, Session waits for cinematic handoff, no second Session dice stage, compact post-roll result, no-roll actions do not fabricate dice, existing Activity/Undo authority preserved.

### Slice 10 — DM Encounter / Actor / Participants / Session tools
Exact source HEAD: `33b0049a482cbb65dda771f336dc591ba6d020d0`
- UI run `32215938914`
- frontend job `95957365219`
- conclusion **SUCCESS**

Validated: on-demand DM Actor/Encounter/Participants/Session panes inside the persistent Session Shell; existing Actor/Combatant/Initiative commands only; zero-Player/zero-Combatant active Freeform; preparing removal preserved and live Freeform removal added while Initiative/pending-resolution removal stays blocked; no visible Ready/start/preparing gates; no second Scene/session/combatant authority.

### Slice 11 — Player reconnect / Session utilities
Exact source HEAD: `02c55b18a535b0f62bd0daabe0cb83e617324ffc`
- UI run `32218434349`
- frontend job `95964214046`
- conclusion **SUCCESS**
- Phase 12 connected run `32218434325`, connected-protocol job `95964214025`: connected-session authority protocol step **SUCCESS** (49/49 tests), including accepted-cursor reconnect and idempotent replay.

Validated: Player Session utility/recovery strip inside persistent Session Shell; healthy connection quiet; reconnecting uses existing automatic cursor retry without presentation calling new Join; terminal disconnected state offers explicit rejoin only with retained Host address; leave uses existing `stopSession()`; no second connection/session protocol or durable store; Sheet/Rules/Activity/Action context stays mounted.

### Slice 12 — Initiative expansion
Validated exact source HEAD: `9739da95521206116e9638c0459f541de46fdc31`
- UI run `32219100733`
- frontend job `95966108635`
- conclusion **SUCCESS**

Validated scope:
- Initiative is a denser row/focus variant of the same mounted `SessionModeRoot`; no combat route/page replacement exists;
- `SessionInitiativeStrip` reads canonical `scene.round`, `scene.currentActorId`, `scene.entities[].initiative/status`, and `scene.economyByActor[currentActorId]` only;
- compact initiative order is presentation-sorted by canonical Initiative totals while preserving Scene order for ties, matching the existing runtime ordering shape without owning turn authority;
- current turn economy shows Action, Bonus Action, Reaction, and Movement only during Initiative;
- `endTurn()` remains the existing turn command; Player end-turn affordance is limited to the active Character turn, while DM can advance the canonical current turn;
- DM `이니셔티브 종료` delegates to existing `endInitiative()`; pending Resolution or non-connected state disables turn/Initiative transition controls;
- the Initiative order is display-only and does not call `selectDmActor()` or mutate `currentActorId`/economy;
- `SessionMainFocus` Initiative branch now shows only the current Actor's HP/AC/Initiative/movement/status and directs actions to the already-validated Action Dock;
- the Action Dock keeps its existing Initiative intent set (`Attack/Magic/Dash/Disengage/Dodge/Help`) and existing canonical action/target resolution;
- Freeform branch remains unchanged and low-noise;
- responsive Initiative order uses horizontal overflow instead of restoring a permanent Actor wall/dashboard;
- focused Initiative regressions, all prior Session/DM/reconnect/lifecycle regressions, Phase09 turn/runtime services, TypeScript and production build are green.

CI repair history for Slice 12:
- intermediate HEAD `67702da609ab9a357463a5932ae4a5c8d7796c8a` failed only the older `sessionFreeformMainFocusStructure.test.ts` assertion that forbade `economyByActor` anywhere in the whole `SessionMainFocus.tsx` file.
- the Freeform UI itself was unchanged; the test was scoped to the Freeform branch so Initiative can read canonical economy without weakening the Freeform low-noise contract. Product behavior was not reverted.
- `gh-fix-ci` was invoked before diagnosis and connector job logs identified the single stale ownership assertion.

## Known pre-existing CI baseline unrelated to Slices 11–12
- Phase 11 / Main Playable / Phase 12 workflows already failed at Slice 10 HEAD `33b0049a...` on the old `phase11OfflineWalkthrough.test.ts` targeting-provenance assertion after the no-spatial fallback work.
- Phase 12 connected-session authority itself passed at Slice 11. The stale offline provenance assertion remains deferred to final automated validation so later UI slices do not widen scope.

## Remaining approved implementation order
1. Handout integration;
2. responsive/keyboard/focus pass;
3. final exact-head automated validation, including resolution of the known stale offline-provenance baseline;
4. Windows human usability acceptance A-J.

Each slice must replace/disconnect conflicting old normal-Session presentation it supersedes and must not add parallel mechanics authority.

## Next Exact Action
1. Reconcile actual PR head; expected validated source HEAD is `9739da95521206116e9638c0459f541de46fdc31`.
2. Implement only **Handout integration** inside the persistent Session Shell.
3. Reuse existing `sessionImageHandoutRuntimeAdapter` / `SessionImageHandoutBridge` state and transfer semantics; do not create another image/session protocol or durable image store.
4. DM reveal/withdraw must be reachable from the Session utility rail without route replacement; Player dismiss/minimize/reopen and reconnect-restored active handout remain presentation behavior over existing state.
5. Handout viewer/control is transient/on-demand and must not become a permanent image manager or tactical map subsystem.
6. Preserve Session Shell, Action/Sheet/Rules/Initiative context underneath the handout layer.
7. Do not perform the final responsive/focus sweep in this same slice.
8. Add focused Handout integration regression coverage and exact-head UI validation before moving on.
9. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`continue`
