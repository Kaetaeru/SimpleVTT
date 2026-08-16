# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 execution checklist: `.agents/PHASE14_CHECKLIST.md` on the active implementation branch
- Rerun run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Rerun sequence: `1`
- Rerun task_id: `phase14-production-play-session-ux`

## Preserved Phase 13 completion

Phase 13 remains complete and must not be reset or rerun unless Phase 14 changes one of its validated boundaries.

- Preserved implementation head: `7c9440970753a370fec7830cfa691832552e1d05`
- Preserved exact-head workflows: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` — all success.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

## Phase 14 product direction

SimpleVTT must become a genuinely playable desktop application rather than a reference-fixture shell with production subsystems attached around it. A normal user must be able to create/persist a Character, enter a real local or connected session with that Character, and use visible production UI for Actions, Skills, Spells, Inventory, targeting, combat, authoritative dice, Activity/Undo, DM adjudication, reconnect, and durable ownership write-back.

The normal product path must not depend on `char.aelar`, `char.mira`, fixed goblin ids, Ctrl+Shift+D, or reference scenario loading. Reference fixtures may remain only for explicit tests/debug.

## Required connected-session lifecycle

Phase 14 includes the complete visible lifecycle:

1. **Host/server startup:** DM starts the actual transport from visible UI, sees bind/listen success and a shareable address/port, receives actionable startup failure, and can stop/restart safely.
2. **DM preparation/lobby:** DM can hold the session before live play, see compatibility/content/participants, prepare the Scene/Combatants, and choose the intended play mode.
3. **Player entry:** player selects their persisted Character, enters Host address, performs real transport + compatibility handshake, and reaches lobby without debug controls.
4. **Projection/ownership:** Host-unknown Character becomes ephemeral host-authoritative SessionProjection; permanent Character ownership remains only with the player.
5. **Ready/start:** readiness is visible and Host starts the prepared participant set into Freeform or Initiative.
6. **Live play:** Actions, Skills, Spells, Inventory, targeting, turns, Combatants, correction, reactions, conditions/concentration, Activity/Undo, and authoritative dice share the same session state.
7. **Participant lifecycle:** late join, disconnect/reconnect, duplicate/replayed traffic, incompatibility, and invalid projections fail/recover explicitly without corrupting authority.
8. **Session end:** transient lobby/projection/turn/resolution state clears; already committed owner-side durable Character changes remain persisted.
9. **Release walkthrough:** Windows acceptance covers Host start -> preparation -> Character selection/join -> Ready/start -> play -> disconnect/reconnect -> explicit end -> clean restart.

## Architecture constraints

- Reuse existing `tauriSessionTransport`, `connectedSessionRuntimeAdapter`, Host ledger, compatibility handshake, SessionProjection acceptance, reconnect/catch-up, ActionRequest/ResolutionEvent routing, and owning-client durable write-back.
- Do not create a replacement transport or move shared-session authority into presentation code.
- Persisted/new Characters must materialize into real Scene/actions from canonical source/runtime facts.
- Reconciliation must remain safe after hydration, create/edit/level-up, connected write-back, and active Character switching.
- No tactical map/grid/token/pathfinding/LOS expansion in Phase 14.

## Acceptance summary

Task 1 is complete only when all are true:

1. A Character created through production authoring immediately enters play as the actual Scene actor.
2. Restarted persisted Characters re-enter with their own durable HP/resources/items/actions.
3. `행동`, `기술`, `주문`, `인벤토리` are usable in-session without debug tools.
4. Skill/item/action/spell flows use authoritative runtime and correct durable ownership semantics.
5. DM can Host, prepare lobby/Scene/Combatants, inspect participants/readiness, start Freeform/Initiative, adjudicate, Undo, and end/restart from visible UI.
6. Player selects a real persisted Character, joins by actual Host address, passes compatibility/SessionProjection, becomes ready, and enters the started session.
7. Two production desktop instances converge through Host-authoritative actions, disconnect/reconnect, and lifecycle transitions.
8. Product-critical paths do not require fixtures/reference scenarios.
9. Full relevant regression matrix, local/connected human walkthroughs, and exact-head Windows artifact verification pass.
10. Accepted implementation is on canonical `main` before final Rerun `complete`.

## Sequence 1 validated history

### PlaySessionDock repair

- `eaac9d7de499433f8f6da8e04f16100326facd57` removed the hydration-time conditional Hook-order risk and stopped clearing pending action context on play-tab switches.
- `41db6832cc0a95f085f8161bfed665dbcc71090d` added the focused regression and UI workflow gate.
- UI run `31965607635` succeeded at exact head `41db6832cc0a95f085f8161bfed665dbcc71090d`, including TypeScript/production build.
- This narrow evidence is not to be repeated unless that boundary changes.

### Host lifecycle checklist reconciliation

- `.agents/PHASE14_CHECKLIST.md` was expanded at `650c6fa5728d982cd58fd1de8d96549c002f66da` to explicitly retain Host bind/start/stop/restart, DM preparation/lobby, persisted Character join, Ready/start, participant lifecycle, session end/restart, connected automation, and Windows walkthrough gates while preserving the existing handshake/projection/authority gates.

### Host lifecycle runtime and visible preparation surface

Validated source head: `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.

Implemented boundaries:

- `src/app/productionSessionLifecycleAdapter.ts` wraps the existing connected Host runtime instead of replacing it.
- Successful real Host setup enters explicit `preparing` lifecycle state and exposes the transport-returned address.
- Host startup/bind rejection is converted into an actionable offline/incompatible snapshot rather than a falsely open Host state.
- `stopSession` refuses unsafe pending/projection resolution contexts, invokes the real transport stop, unmounts ephemeral reconstructed projections, clears connected ledger/peer/transient state, and returns to offline.
- Host restart creates fresh authority/ledger state while reusing the already-installed listeners.
- `AppProvider` exposes `stopSession` through the normal visible UI command path.
- `ProductionSessionLifecycleBridge` provides a visible Korean-first preparation surface showing server-open state, session name, shareable address, participant count, compatibility, and `Host 중지` without debug controls.
- `src/main.tsx` installs/mounts the lifecycle adapter and visible bridge in production composition.
- `tests/ui/productionSessionLifecycleAdapter.test.ts` verifies Host start -> preparation -> transient state/projection cleanup -> stop -> fresh restart, listener reuse, startup error snapshot, and the visible preparation/address/stop surface.

Validation:

- Initial run `31967233149` failed only the new lifecycle test because the first test version unnecessarily re-invoked the already-proven Phase 13 SessionProjection builder. That test was narrowed to seed an already-registered ephemeral projection and test only the new lifecycle cleanup boundary.
- UI run `31967313740` then succeeded at exact source head `13b4bb3b40cdcb5338f95b00d08783b79a58377d` for runtime Host lifecycle and production build.
- After adding the visible preparation/stop surface, UI run `31967444715` succeeded at exact source head `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, including the focused Host lifecycle/UI regression, existing Phase09 mechanics regressions, and final `Typecheck and build`.

### Player Character selection / Join / compatible lobby

Validated source head: `a01221ac78827e3075c678c6e727a3ca4af695b5`.

Implemented boundaries:

- `productionSessionLifecycleAdapter` now models client `connecting` separately from compatible `lobby` and derives lobby only after the existing connected runtime has accepted a `hello-ack` and recorded a real session id.
- Production Join requires the active Character to be a saved non-reference Character; `char.aelar` / `char.mira` cannot silently enter the production Join path.
- Invalid/no-valid-Character Join returns an explicit offline/incompatible setup requirement without invoking the desktop transport.
- `ProductionPlayerLobbyBridge` replaces the visible reference Join card on the Session route with saved Character selection, Host address, lifecycle progress, compatibility result, and selected identity.
- Character selection reuses `selectProductionCharacter`; Join still delegates to the existing `connectedSessionRuntimeAdapter`, compatibility handshake, SessionProjection, Host authority, reconnect, and owner-write-back boundaries.
- Focused regression verifies reference Join rejection, saved non-fixture Join, `connecting -> hello-ack -> lobby`, and the visible selector/address/lobby surface.

Validation:

- First test attempt at `97771a2909a94c5f24be4deba4c84480e621be11` over-coupled this lifecycle regression to Character-library repository generation and failed the new Phase 14 lifecycle step; no completion credit is taken from that run.
- The regression was isolated to the Join/lifecycle boundary at `a01221ac78827e3075c678c6e727a3ca4af695b5` without weakening the production Join gate.
- UI run `31967966233` succeeded at exact head `a01221ac78827e3075c678c6e727a3ca4af695b5`, including the Phase 14 lifecycle regression and final TypeScript/production build.
- PR-triggered Contract validation and UI also succeeded at that exact head.
- Persistence run `31967968226` completed successfully at the same head for both application-contract/production build and Windows Tauri storage/atomic Character recovery.

### Existing regression debt discovered by PR matrix

The automatic PR matrix at `a01221ac...` still reports Phase 11 Playable, Phase 12 Connected Session, and Main Playable failures. Comparison against the immediately preceding validated source head `7d83f263...` shows those same workflows were already failing there. They therefore predate this player-lobby slice and are not evidence that the new Join/lobby changes regressed those boundaries.

The failures are nevertheless release blockers. Their common surface is the old fixture-based Phase11/12 acceptance suites being executed through `offlineRuntimeAdapters`, which now intentionally includes the Phase14 `productionPlayRuntimeAdapter`. They must be migrated or split so preserved subsystem assertions remain meaningful while the production-composed acceptance path uses fresh non-fixture Character state. Do not silence or disable these workflows.

Draft PR #109 remains open/draft and no merge is authorized or attempted.

## Next Exact Action

Before implementing Ready/unready or broader lifecycle state, repair the pre-existing Phase14 regression-matrix debt exposed by the PR runs:

1. Reproduce/locate the first failing assertion in Phase 11 `phase11OfflineWalkthrough.test.ts` under current Phase14 `offlineRuntimeAdapters` composition.
2. Separate fixture-specific subsystem regression from production-composed acceptance where necessary; do not weaken the production no-fixture path and do not disable Phase11/12/Main workflows.
3. Convert the production-composed Phase11 acceptance path to a fresh saved non-fixture Character and actual derived Scene/actions, preserving authoritative rule/economy/undo assertions with actor ids derived from that Character rather than hard-coded Aelar/Mira.
4. Re-run the smallest affected Phase11 gate first; once green, re-check Phase12/Main because their current failures predate the player-lobby slice and may cascade from the same production-composition mismatch.
5. Preserve the exact-head `a01221ac...` player-lobby evidence; do not repeat its focused UI gate unless code touching that boundary changes.

After the regression matrix is repaired, resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.
