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

Sequence 0 / `phase13-closeout-ui-dice-regression` remains complete and is not reset.

Preserved Phase 13 implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved exact-head workflow evidence:

- Contract validation `31955742556` — success
- Rules Domain `31955742577` — success
- Persistence `31955742563` — success
- UI `31955742530` — success
- Phase 11 Playable `31955742560` — success
- Phase 12 Connected Session `31955742539` — success
- Phase 13 SessionProjection `31955742524` — success

Preserved Phase 13 Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Do not rerun preserved Phase 13 gates unless a Phase 14 change touches those boundaries.

## Sequence 1 current work state

**Work branch/head:** `agent/108-production-play-session-ux` @ `e6386ea172dd3ce5ac89cdb1608964158ffbaf01`.

**Validated source head:** `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.

`e6386ea...` is documentation-only: it records checklist evidence on top of the validated source and does not change product/runtime code.

**Checklist focus completed in this slice:** first P14.7/P14.8 Host lifecycle/preparation slice. Next focus: P14.8 player persisted-Character entry and compatible lobby.

### Completed since previous checkpoint

1. Reconciled `.agents/PHASE14_CHECKLIST.md` at `650c6fa5728d982cd58fd1de8d96549c002f66da` so the release-blocking lifecycle explicitly includes:
   - actual Host bind/start/stop/restart;
   - DM preparation/lobby;
   - persisted Character selection/join;
   - Ready/start;
   - late join/disconnect/reconnect/idempotency;
   - session end/restart;
   - connected automation and Windows walkthrough coverage.
   Existing handshake/SessionProjection/Host-authority/ownership gates were retained.

2. Added `src/app/productionSessionLifecycleAdapter.ts` as an outer production lifecycle layer over the existing connected runtime:
   - successful Host setup enters explicit `preparing` state;
   - transport-returned Host address remains the shareable address;
   - Host startup/bind errors return actionable offline/incompatible snapshots instead of rejected/fake-success UI state;
   - `stopSession` stops the real transport, rejects unsafe pending/projection-resolution contexts, unmounts ephemeral reconstructed projection state, resets connected ledger/peer/transient state, and returns offline;
   - Host restart creates fresh authority/ledger state while preserving installed listener reuse.

3. Updated production composition and command path:
   - `src/app/AppProvider.tsx` exposes `stopSession` through the normal app context;
   - `src/main.tsx` installs the lifecycle adapter and visible bridge;
   - `src/ProductionSessionLifecycleBridge.tsx` shows `Host 준비 중`, actual server-open state, session name, shareable address, participant count, compatibility message, and `Host 중지` without reference/debug controls.

4. Added/expanded `tests/ui/productionSessionLifecycleAdapter.test.ts`:
   - Host start -> preparation;
   - transient peer/published/projection cleanup on stop while permanent Character library state survives;
   - clean Host restart with a fresh ledger;
   - no duplicated connected listeners across restart;
   - actionable Host bind failure snapshot;
   - visible preparation/address/Host-stop surface and no debug/reference control dependency.

5. Added the lifecycle regression to `.github/workflows/ui.yml` alongside the existing connected runtime test.

6. Recorded evidence-backed checklist credit at work head `e6386ea172dd3ce5ac89cdb1608964158ffbaf01` for the validated Host lifecycle/preparation items only. Unfinished player join/Ready/live/session-end items remain unchecked.

### Validation evidence

- PlaySessionDock boundary remains validated by UI run `31965607635` at `41db6832cc0a95f085f8161bfed665dbcc71090d`; it was not independently rerun as a separate task.
- Initial lifecycle UI run `31967233149` at `24f7b8a65a00b2533d0a3bbbde8390660c47634c` failed only the newly added lifecycle test. Root cause: the test unnecessarily invoked the already-proven Phase 13 SessionProjection builder while trying to seed cleanup state.
- The test was narrowed to seed an already-registered ephemeral projection and verify only the new lifecycle cleanup boundary.
- UI run `31967313740` succeeded at exact head `13b4bb3b40cdcb5338f95b00d08783b79a58377d`, proving the Host lifecycle runtime plus final TypeScript/production build.
- After adding the visible preparation/address/stop surface, UI run `31967444715` succeeded at exact source head `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.
- Run `31967444715` includes successful `Verify Phase 14 production Host lifecycle`, existing Phase09 mechanics regressions, and final `Typecheck and build`.
- No Phase 11/12/13 full workflow was rerun because this slice did not replace the connected protocol, SessionProjection authority, or durable write-back implementation.

### Evidence-backed checklist progress

Current checklist now credits, with exact workflow evidence:

- explicit DM preparation state before play;
- actual production Host transport start from visible UI;
- explicit successful Host/listen state with shareable address;
- visible safe Host stop;
- transient connected/projection cleanup on stop while permanent Character state survives;
- fresh Host authority on restart;
- listener reuse across restart;
- automated Host start/stop/restart regression;
- UI/TypeScript production frontend green for this lifecycle slice.

Bind failure runtime handling is implemented/tested but its dedicated visible error presentation is intentionally not credited yet.

## Authority boundaries preserved

The slice deliberately reuses rather than replaces:

- `tauriSessionTransport.startHost/connectClient/stop` and state/message listeners;
- `connectedSessionRuntimeAdapter` Host/client setup and handshake;
- Host ledger and shared-session authority;
- SessionProjection validation/reconstruction;
- reconnect/catch-up and event cursor behavior;
- ActionRequest/ResolutionEvent routing;
- owning-client durable Character write-back.

No tactical map/grid/token/path/LOS scope was added.

## Known failures / risks

1. Player connected entry is still incomplete as a product lifecycle: selected persisted Character identity, explicit connecting/handshake/lobby states, and no-valid-Character setup rejection are not yet evidence-backed.
2. Ready/unready, Host readiness display, and Host start gating into Freeform/Initiative are not implemented as lifecycle state yet.
3. Live session end semantics beyond Host transport stop are not yet proven for readiness/turn/pending Resolution cleanup because those lifecycle states do not exist yet.
4. Host bind failure is normalized into an actionable snapshot, but a dedicated visible failure/retry treatment is still uncredited.
5. Fresh non-fixture Character -> local Scene/actions and product-realistic connected gates remain incomplete.
6. `productionPlayRuntimeAdapter` still needs targeted protection against stale local Scene projection when switching between two non-fixture local Characters without disturbing remote ephemeral projections.
7. Windows two-instance human walkthrough and exact-head release artifact remain future release gates.
8. PR #109 remains draft; no merge is authorized.

## Files / architecture boundaries changed in this slice

- `.agents/PHASE14_CHECKLIST.md`
- `src/app/productionSessionLifecycleAdapter.ts`
- `src/app/AppProvider.tsx`
- `src/ProductionSessionLifecycleBridge.tsx`
- `src/main.tsx`
- `tests/ui/productionSessionLifecycleAdapter.test.ts`
- `.github/workflows/ui.yml`

No rules-domain, persistence format, connected wire protocol, SessionProjection schema, or durable ownership boundary was changed.

## Next Exact Action

On `agent/108-production-play-session-ux`, resume at P14.8 **Player Character selection, join, and lobby**. Do not rerun Host lifecycle run `31967444715` or PlaySessionDock run `31965607635` unless a new commit changes those validated boundaries.

Implement the smallest coherent player-lobby slice:

1. Require/select a valid persisted active Character for connected join and reject the no-valid-Character setup state without fixture fallback.
2. Represent connecting/compatibility-handshake/lobby distinctly enough that connected join is not an immediate presentation-only success.
3. On compatible `hello-ack`, move the client to explicit lobby state and expose selected Character identity, Host address, compatibility, and participant information through visible production UI.
4. Preserve the existing SessionProjection builder, Host canonical validation, Host authority, reconnect/catch-up, and owner-only persistence boundaries.
5. Add a focused runtime/UI regression for persisted Character -> join -> compatible lobby and invalid/no-Character setup rejection.
6. Run only the affected connected/UI/TypeScript production gate at the resulting exact head.

After that slice is evidence-backed, continue to Ready/unready and Host start gating into Freeform/Initiative.

## Dispatch recommendation

`continue`
