# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **Player reconnect/session utilities validated; Initiative expansion is next**
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
Validated exact source HEAD: `33b0049a482cbb65dda771f336dc591ba6d020d0`
- UI run `32215938914`
- frontend job `95957365219`
- conclusion **SUCCESS**

Validated scope:
- DM Session rail exposes Actor, Rules, Encounter, Participants, Activity, and Session share as on-demand panes inside the persistent Session Shell;
- no DM utility requires route replacement or `플레이로 돌아가기`;
- Actor switching reads `scene.selectedActorId` and delegates only to the existing `selectDmActor()` command; it does not mutate `currentActorId` or Initiative economy;
- Encounter pane reads existing Scene combatants and `combatantDefinitions`, and delegates to existing `instantiateCombatant()`, `removeCombatant()`, `startInitiative()`, and `endInitiative()` commands;
- Encounter editing works with zero Players and zero Combatants as normal active-session states;
- Combatant removal preserves historical preparing behavior and additionally works in live Freeform; Initiative removal remains blocked so turn-runtime state is not silently mutated;
- a pending resolution referencing a Combatant still blocks removal;
- Participants pane reads canonical participant connection/Character projection only and does not expose Ready/start gates;
- Session share pane reads canonical session name/address/connection/content and can copy the existing address as local presentation behavior;
- UI contains no visible lifecycle/preparing/Ready/start gate in these new DM panes;
- new DM panes are responsive right-side transient utilities, not permanent dashboards;
- existing lifecycle/network internals were not replaced and no second Scene/session/combatant authority was introduced;
- all prior UI/mechanics regressions, live DM continuity, lifecycle/connected regressions, Phase09 services, TypeScript and production build are green.

CI repair history for Slice 10:
- intermediate HEAD `3463488a6aea91ab3d04d1a64743871301fe127b` failed only two structure assertions: explanatory copy still used the retired word `Ready`, and the old Rules/Activity test assumed those two utility literals were adjacent in the union. The copy and stale test ownership assumption were corrected without mechanics changes.
- intermediate HEAD `d781f986d3d7bf82e49e90dcfc046494f9f85ff8` then reached lifecycle/mechanics and exposed a real regression: the first live-Freeform removal change accidentally required `sessionMode==="freeform"` during historical `preparing` removal too. The adapter was corrected to preserve `preparing` removal and extend removal only to `live && freeform`; Initiative remains blocked.
- `gh-fix-ci` was invoked before each new CI diagnosis; connector job logs were used as the available Actions log fallback.

### Slice 11 — Player reconnect / Session utilities
Validated exact source HEAD: `02c55b18a535b0f62bd0daabe0cb83e617324ffc`
- UI run `32218434349`
- frontend job `95964214046`
- conclusion **SUCCESS**
- Phase 12 connected run `32218434325`, connected-protocol job `95964214025`: connected-session authority protocol step **SUCCESS** (49/49 tests), including `productionClientReconnect.test.ts` accepted-cursor catch-up and idempotent replay.

Validated scope:
- Player Session utility is part of the persistent `SessionModeRoot`; Player can open it from the Session rail or header connection affordance without leaving play;
- healthy `connected` state remains visually quiet; reconnecting/disconnected states project an actionable recovery strip over the mounted Session Shell;
- Player connection pane shows only session identity, Character identity, Host address, connection state, leave, and explicit terminal rejoin choice;
- reconnecting never calls `joinSession()` from presentation; the existing automatic connected-session retry/cursor authority remains untouched;
- explicit rejoin is available only from terminal `disconnected` state with an existing Host address;
- Player leave delegates to existing `stopSession()`; no second lifecycle/session store/protocol exists;
- opening connection recovery does not replace/unmount Session, Sheet, Rules, Activity, or Action presentation state;
- connection pane/recovery strip remain responsive overlay layers and sit above Full Sheet/workspace when recovery is needed;
- UI structure regression is now part of the main UI workflow;
- TypeScript/production build and all UI/mechanics/Phase09 checks in the UI workflow are green.

Known pre-existing CI baseline unrelated to Slice 11:
- Phase 11 / Main Playable / Phase 12 workflows already failed at validated Slice 10 HEAD `33b0049a...` on the old `phase11OfflineWalkthrough.test.ts` targeting-provenance assertion after the no-spatial fallback work.
- The same unrelated assertion still fails at Slice 11 exact HEAD after the Phase 12 connected-authority step passes. It was not modified in this slice to avoid widening scope.

## Remaining approved implementation order
1. Initiative expansion;
2. Handout integration;
3. responsive/keyboard/focus pass;
4. final exact-head automated validation, including resolution of the known stale offline-provenance baseline;
5. Windows human usability acceptance A-J.

Each slice must replace/disconnect conflicting old normal-Session presentation it supersedes and must not add parallel mechanics authority.

## Next Exact Action
1. Reconcile actual PR head; expected validated source HEAD is `02c55b18a535b0f62bd0daabe0cb83e617324ffc`.
2. Implement only **Initiative expansion** as a denser variant of the same persistent Session Shell.
3. Reuse canonical `sessionMode`, `scene.round`, `scene.currentActorId`, Initiative order/turn/economy projections, `endTurn()`, `startInitiative()`, and `endInitiative()`; do not add a second combat/turn engine.
4. Freeform must remain quiet. Initiative may add compact round/current-turn/order/action-economy/end-turn/target/status information only while Initiative is active.
5. Starting/ending Initiative transforms the mounted Session Shell rather than navigating to another route; ending returns to quiet Freeform without resetting valid Session/utility context.
6. Do not implement Handout or the final responsive/focus sweep in this same slice.
7. Add focused Initiative structure/behavior regressions and exact-head UI validation before moving on.
8. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`continue`
