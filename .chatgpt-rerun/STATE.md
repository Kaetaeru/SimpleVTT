# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T09:58:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order. All records reconciled to run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md` and the current V1 handoff reconfirmed `work/v1-composite`. The starting coordination head was `4b6f737a359d9dcbe6f777173a2b3ec6b59466a8`. Exact prior product head `05eb679` still had no combined statuses or workflow runs, so V1-12 and the already source-connected normal V1-13 owner routing were preserved rather than repeated.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durable storage and Host SessionProjection refresh;
- Campaign-owned Party Stash persistence and current local/connected runtime/UI;
- request-scoped/delta-safe inventory compensation from the prior V1-13 slice;
- Host -> owner Client `campaign-owner-inventory` apply/undo and fresh projection acknowledgement;
- no Host durable copy of remote Player Character;
- comprehensive Codex audit remains deferred until implementation freeze.

## Completed in this dispatch

### 1. Durable owner inventory journal

- `2363b542f55010031b949462924ac4e021a7dddf` — Rust append-only owner journal in the Character library directory.
- `d88e1cddc99356e4a8f52070167abfd2e22916c0` — Memory/Tauri journal store abstraction.
- `20b6f54a21752825d9d58355fbbead48c0fafab5` — connected owner journal runtime/restart reconciliation.
- `cde391eb9ae52b6e56e71923d06eb14cebbd2cb6` — Tauri journal commands registered under the existing Character/Campaign persistence mutex.
- `727cddcd686a3358c8fc5d4e31358cd6b0873893` — production installs owner journal after connected Campaign systems.

Durable files:

- base `connected-owner-inventory.<hex(requestId)>.json` with request/actor/command/before state;
- immutable `.applied` with exact after state;
- immutable `.undoing` with exact beforeUndo + afterUndo;
- immutable `.undone`;
- immutable `.finalized` with final outcome `applied` or `undone`.

The owner writes the base marker before its normal durable Character mutation. If process death occurs after Character commit but before `.applied`, replay compares durable current inventory with the before state and exact command delta, then records applied without reapplying.

Undo writes the exact before/after compensation target to `.undoing` before changing Character durability. On restart:

- current == afterUndo => compensation already committed; only mark undone;
- current == beforeUndo => perform the stored compensation target, then mark undone;
- divergent current state => reject rather than blind overwrite.

### 2. Compound finalization

The journal adapter wraps the existing normal owner wire rather than replacing ownership semantics.

- Host direct remote inventory changes finalize immediately after owner acknowledgement.
- Party Stash and DM Library Character operations defer finalize while the Campaign-side operation is unresolved.
- Stash success finalizes owner journal `applied`.
- Stash compensation finalizes `undone`.
- DM Library Character grant compensates the remote owner request if the later Campaign recent-entry mutation rejects, then finalizes `undone`.
- finalize request/result is explicit and duplicate finalize is journal-idempotent.

### 3. Exact Host Stash compensation identity

- `4cdeb0c6696e4cf939c52094f38afdba0462344f` — connected Host Stash binds the active `command.requestId` around the existing Campaign runtime.
- `54e8c7e33f97671afc29075b927f6270571ec286` — exact compensation adapter installed after the journal adapter.

When the underlying Campaign runtime invokes its compatibility `undoLastDmInventoryAdjustment()`, connected Host Stash now routes it to `undoDmInventoryAdjustment(activeRequestId)`. This removes the normal connected Host dependency on whichever unrelated inventory change happened to be globally “last”. Concurrent nested Stash compensation with another requestId is explicitly rejected.

### 4. Deterministic source contracts

- `46281f7d4a37faff2e64233b2d4c9bb0641fb1b0` — journal phase/idempotency tests.
- `3e72fcf43d1f3ea7e3fd4da065b1d00e895c3544` — production/Tauri structure coverage.
- `99bb17663962d741fa73502c5e6b0074c70cd3b5` — Memory Character store restart scenarios:
  - apply committed before lost ack / no double apply;
  - owner restart then undo with no prior in-memory undo record;
  - undo committed before `.undone` sidecar / no double undo.
- `73a7302377a215b70a8ed135e3c1fe5c9c29d556` — owner journal tests wired through existing focused restart suite.
- `819647214a34c427725848b18331a12897151798` — exact Host compensation structure contract.
- `45c6dae19f2f6721e0fe012079cb6436f80b0938` — exact compensation contract wired into the focused suite.

Exact product-code/test head before Rerun coordination docs: `45c6dae19f2f6721e0fe012079cb6436f80b0938`.

## Current V1-13 assessment

V1-13 remains **IMPLEMENTATION IN PROGRESS / VALIDATION PENDING**.

Owner process restart and lost owner acknowledgement are now source-covered by durable journal state, but full distributed Stash atomicity is **not** source-complete because Host restart recovery is still missing.

### Remaining Host restart window

Failure case still open:

1. owner durable journal/Character apply succeeds;
2. Host has not yet durably committed the matching Party Stash request, or has committed it but has not finalized owner state;
3. Host process dies;
4. restarted Host has no durable coordinator telling it which owner request must be finalized versus undone.

This can leave Character-only durable success if Campaign request did not commit. Owner journal contains enough durable truth to reconcile, but there is not yet reconnect synchronization / Host coordinator logic to consume it.

A finalize request/ack loss after both sides committed is retry-idempotent. Current owner journal does not act as a global Character write lock, so a stale finalized-needed record is cleanup debt rather than an orphan write barrier. If same inventory state diverges before a needed compensation, the delta-safe recovery rejects instead of corrupting later state; therefore Host reconciliation should occur promptly.

## Validation status

**NO GREEN CLAIM.** Exact product head `45c6dae19f2f6721e0fe012079cb6436f80b0938` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the new owner journal/restart contracts, `npm run test:campaign-rest`, `tsc --noEmit`, `npm run build`, Rust/Tauri build, or Windows two-instance Stash/DM Library acceptance.

Source-authored tests are not execution evidence.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head executable evidence; if none, do not repeat V1-12 or the owner journal/restart implementation.
3. Close the connected Party Stash **Host process restart** window using durable Host coordinator state or owner-journal reconnect synchronization.
4. On recovery, use Campaign idempotency to distinguish:
   - matching Campaign request committed => finalize owner `applied`;
   - matching Campaign request absent => owner undo + finalize `undone`.
5. Add deterministic Host-restart/reconnect tests, including duplicate recovery/finalize delivery and finalize-ack loss.
6. Then continue remaining V1-13 DM Library privacy/isolation/user-reachable UI audit.
7. Keep comprehensive Codex audit deferred until implementation freeze.
