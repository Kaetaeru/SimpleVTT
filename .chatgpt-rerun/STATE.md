# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — open/draft, not merged
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved completion history

Sequence 0 / Phase 13 remains complete and is not reset.

- Preserved Phase 13 implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.
- Preserved exact-head success: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Do not rerun preserved Phase 13 history merely because the current Phase14 branch has unfinished production-composition work.

## Sequence 1 current work state

**Work branch/head:** `agent/108-production-play-session-ux` @ `a01221ac78827e3075c678c6e727a3ca4af695b5`.

**Current validated source boundary:** player Character selection / Join / compatible lobby at `a01221ac78827e3075c678c6e727a3ca4af695b5`.

The previous Host lifecycle source boundary remains `7d83f263609b5dc2cf18ec43ed617568fedff9ba`; do not repeat its focused Host test unless that boundary changes.

### Completed in this continuation

1. Re-read coordination from `main` in required order and reconciled the same run_id / sequence / task before writing.
2. Confirmed repo state before work: `main=1fe13d9968052618f74e621d9c3d62c4346bd917`, work branch `e6386ea172dd3ce5ac89cdb1608964158ffbaf01`, PR #109 open/draft/unmerged.
3. Inspected existing connected runtime and preserved its authority boundary:
   - transport connect/hello remains in `connectedSessionRuntimeAdapter` / `tauriSessionTransport`;
   - compatible session identity is still established only by accepted `hello-ack`;
   - SessionProjection, Host validation/authority, reconnect, and owning-client write-back were not replaced.
4. Extended `src/app/productionSessionLifecycleAdapter.ts`:
   - lifecycle now distinguishes `connecting` and compatible `lobby`;
   - client reaches lobby only after connected state has a real session id from handshake;
   - production Join requires the active Character to be saved and non-reference;
   - `char.aelar` / `char.mira` cannot be used as silent product Join fallbacks;
   - no-valid-Character Join returns explicit offline/incompatible setup guidance without invoking transport.
5. Added `src/ProductionPlayerLobbyBridge.tsx` and `src/production-player-lobby.css`:
   - saved Character selector;
   - Host address input;
   - connecting/lobby state display;
   - compatibility result and selected identity;
   - old reference Join card/reference Session explanation hidden on the production Session route.
6. Mounted the player-lobby bridge in `src/main.tsx`.
7. Expanded `tests/ui/productionSessionLifecycleAdapter.test.ts`:
   - reference Character Join is rejected before transport;
   - saved non-fixture Character enters `connecting`;
   - simulated accepted `hello-ack` advances to compatible `lobby` and participant projection;
   - visible Session UI exposes saved Character selection/address/lifecycle and does not depend on debug/reference controls.
8. The first test version at `97771a2909a94c5f24be4deba4c84480e621be11` over-coupled the focused lifecycle test to Character-library repository setup and failed the new lifecycle step. The test was narrowed to the lifecycle boundary at `a01221ac...`; the production gate itself was not weakened.

### Validation evidence

- UI push run `31967966233` — `success` at exact source head `a01221ac78827e3075c678c6e727a3ca4af695b5`.
  - Phase14 PlaySessionDock gate: success.
  - Phase14 production lifecycle gate including the new player Join/lobby tests: success.
  - existing UI mechanics regressions: success.
  - final `Typecheck and build`: success.
- PR-triggered UI at the same head also succeeded.
- Contract validation at the same head succeeded.
- Persistence run `31967968226` at the same head completed `success` for both:
  - application persistence contracts + production build;
  - Windows Tauri immutable stores / atomic Character recovery.

### Existing PR-matrix failures — not introduced by this slice

At exact head `a01221ac...`:

- Phase 11 Playable `31967968197` — failure in `Verify production-composed offline walkthrough`.
- Phase 12 Connected Session `31967968193` — failure in `Verify connected-session authority protocol`.
- Main Playable `31967968255` — frontend/UI/rules/build step succeeds, then Phase11 complete offline walkthrough fails and later Phase12/13 steps are skipped.

Comparison with the preceding source head `7d83f263609b5dc2cf18ec43ed617568fedff9ba` proves Phase11, Phase12, and Main Playable were already failing before the player-lobby changes. They are therefore pre-existing Phase14 regression-matrix debt, not a regression caused by the current Join/lobby slice.

These failures remain release blockers and must not be silenced. Their shared issue is the legacy fixture-based acceptance surface being run through `offlineRuntimeAdapters`, which now intentionally installs `productionPlayRuntimeAdapter` and removes the assumption that Aelar/Mira/fixed fixture actions are the production actor model.

### Current architecture boundaries

Preserved unchanged:

- connected wire protocol;
- Tauri transport implementation;
- Host ledger/shared authority;
- SessionProjection schema and Host reconstruction;
- reconnect/catch-up and event cursor semantics;
- authoritative ActionRequest -> ResolutionEvent routing;
- owning-client-only durable Character write-back;
- rules-domain and persistence formats.

No tactical map/grid/token/path/LOS scope was added.

### Known failures / risks

1. Phase11/12/Main Playable PR workflows are red from pre-existing Phase14 fixture-vs-production-composition mismatch; they block final release even though this player-lobby slice itself is exact-head green.
2. The focused Join test proves a saved non-fixture Character lifecycle boundary; full create/persist/restart -> select -> Join product-realistic walkthrough is still not complete.
3. Ready/unready state, Host readiness display, and Host start gating into Freeform/Initiative remain unimplemented.
4. Player lobby does not yet expose readiness because that lifecycle state does not exist.
5. Host bind failure has runtime normalization but dedicated visible retry/error treatment remains uncredited.
6. Fresh non-fixture local play and the full four-tab action/skill/spell/inventory product walk remain incomplete.
7. `productionPlayRuntimeAdapter` still needs targeted active-Character-switch cleanup protection for two non-fixture local Characters without disturbing remote ephemeral projections.
8. Two-instance Windows human acceptance and exact-head release artifact remain future gates.
9. PR #109 remains draft; no merge is authorized.

## Next Exact Action

Do **not** proceed directly to Ready/start while the newly exposed regression matrix is red.

On `agent/108-production-play-session-ux`:

1. Locate the first Phase11 production-composed failure under the current `offlineRuntimeAdapters` chain, starting with `tests/ui/phase11OfflineWalkthrough.test.ts`.
2. Preserve fixture-specific lower-level tests where they still validate subsystem mechanics, but migrate/split the production-composed acceptance path so it creates/uses a fresh saved non-fixture Character and derives actor/action ids from live Character state instead of hard-coded Aelar/Mira assumptions.
3. Do not disable or weaken Phase11/12/Main workflows and do not reintroduce fixture fallback into production code.
4. Run the smallest Phase11 gate first. If it becomes green, re-check Phase12 and Main Playable to determine which remaining failures are independent versus cascading from the same composition mismatch.
5. Preserve `a01221ac...` player-lobby evidence; rerun its focused UI gate only if code touching lifecycle/Join/UI selection changes.
6. Once the regression matrix is green for the relevant production composition, resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.

## Dispatch recommendation

`continue`
