# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This is the same V1-completion run. Preserve current Session UI, Character ownership, connected authority/replay, Campaign persistence, and all source-connected Long Rest work. Do not route to `main`, redo implementation solely for validation, or begin the comprehensive Codex audit before the V1 implementation freeze.

## V1-12 contract result

Connected Long Rest normal durable-storage behavior remains source-complete / validation pending. Do not repeat it. Its source boundary includes owner invisible prepare, Host durable coordinator, stable Campaign commit identity, Host/Player restart recovery, pre-global abort cleanup, owner acknowledgement cleanup, fresh SessionProjection refresh, and the Tauri prepared-generation write barrier.

## V1-13 source audit result

The V1-13 checklist label is stale relative to existing code. Current canonical source already had:

- Campaign-owned Party Stash item/wallet state and Campaign persistence;
- local Character <-> Stash transfer with compensating rollback;
- connected Player self-service Stash requests sequenced through Host Campaign authority;
- Campaign DM Library custom-item grants to Character or Stash;
- local deterministic Stash/DM Library tests.

The first real connected gap was Host-originated mutation of a mounted remote Player Character. `sessionInventoryRuntimeAdapter.adjustDmInventory()` durably wrote only the local active Character; non-active Characters were Host/session shadow state. That meant Host-side Party Stash, currency, and DM Library Character actions could bypass the Player-owned durable Character library.

Source connected through exact product-code head `05eb6790404ed617b8b15702b0372bd6a4bef8ee` now adds:

- request-scoped inventory undo/compensation rather than relying only on a global last-undo slot;
- delta-based compensation that preserves later unrelated item/GP changes when safe and rejects stale/unsafe compensation;
- Host -> owner Client `campaign-owner-inventory` apply/undo request/result routing;
- owner Client durable active-Character mutation through the existing Character library writer;
- fresh owner `CharacterSessionProjectionV1` acknowledgement after apply/undo;
- Host reconstruction + `refreshReconstructedCharacterSessionProjection()` so durable Character facts refresh without copying ownership into Host Character storage;
- Host session inventory projection refresh and accepted peer-manifest revision refresh;
- connected Player Stash rollback changed to exact request-id undo;
- wire validation coverage plus source-structure coverage for the remote-owner path.

Relevant commits in this slice:

- `c282b8a08e2245d3da8ab8746f7d2ef10f3d59bb` — correct request-scoped compensation test semantics;
- `9f123cdde3056e253a8584e76ffff36e54624e7c` — request-scoped delta compensation/runtime projection helper;
- `706fc1a8a55e2d9b9e6c58a09a3849fa882161a0` — Host-to-owner durable inventory routing and fresh projection refresh;
- `9bf0425910f03f37c084c3e283a2d3bca9c7c077` — aligned connected structure contract;
- `05eb6790404ed617b8b15702b0372bd6a4bef8ee` — owner inventory wire validation tests.

## Remaining V1-13 durability gap

Do **not** call V1-13 connected transfer release-complete yet.

The current request-id set and exact undo journal in `sessionInventoryRuntimeAdapter` are process memory. If the owner Client durably applies an inventory mutation and then restarts before its acknowledgement reaches Host, a later Host compensation request cannot reconstruct the exact pre-mutation state from the in-memory undo record. A blind inverse is unsafe because Host cannot know whether the original owner write committed before the lost acknowledgement.

This is the next highest-dependency correctness gap. It needs a durable owner-side inventory transaction journal/sidecar analogous in safety properties to the connected Long Rest owner preparation flow:

1. persist exact request identity + enough before/after/inverse information before/with owner Character commit;
2. make apply replay idempotent across owner process restart;
3. make abort/undo after lost acknowledgement restart-safe without guessing whether apply happened;
4. close/delete the durable journal only when the Host-side operation no longer needs compensation;
5. preserve Character ownership on Player and never copy remote Character durable storage to Host;
6. add deterministic restart/replay tests before claiming cross-store atomicity.

Also source-review the Host `character-to-stash` compensation path: the underlying Campaign runtime still calls `undoLastDmInventoryAdjustment()` on Campaign failure. The connected wrapper currently routes the last remote mutation correctly in ordinary serialized UI use, but exact request-scoped compensation should replace this dependency before concurrency/restart acceptance is considered closed.

## Validation status

**NO GREEN CLAIM.** Exact product head `05eb679` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the newly added V1-13 tests, `tsc --noEmit`, `npm run build`, Rust, Tauri build, or Windows two-instance acceptance. V1-12 remains `PARTIAL` for release evidence and V1-13 remains implementation-in-progress.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. If no exact-head executable evidence has appeared, do not redo V1-12 or the source-connected V1-13 owner routing.
3. Design and implement a durable owner inventory transaction journal/sidecar for `campaign-owner-inventory` apply/undo/finalize so replay and compensation survive owner restart.
4. Replace the remaining Host Stash compensation dependency on global `undoLastDmInventoryAdjustment()` with exact request identity, either in the Campaign runtime boundary or a transaction-specific connected coordinator.
5. Add deterministic tests for: apply replay after owner restart; lost apply acknowledgement then restart-safe undo; duplicate undo/finalize; Character/Party Stash no-partial-success behavior; fresh Host projection after recovered completion.
6. After that boundary is source-connected, continue the remaining V1-13 DM Library/privacy/UI/isolation acceptance audit instead of starting V1-14 early.
7. Keep comprehensive Codex audit deferred until implementation freeze; final evidence still requires exact-head regression and Windows two-instance acceptance.
