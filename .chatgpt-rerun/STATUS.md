# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product-code checkpoint: `05eb6790404ed617b8b15702b0372bd6a4bef8ee`

## Current result

V1-12 Connected Long Rest remains source-complete / validation pending and was not repeated.

V1-13 source audit found that Party Stash and Campaign DM Library already had substantial local/connected foundations. The first real connected ownership gap was Host-side inventory mutation of a mounted remote Player Character: it could change Host/session shadow state without durably updating the Player-owned Character library.

This dispatch source-connected:

- request-id scoped item/GP compensation with delta-based undo;
- connected Host -> owner Client inventory apply/undo request/result routing;
- owner Client durable Character-library mutation;
- fresh owner Character SessionProjection acknowledgement;
- Host remote durable projection + session inventory + peer-manifest revision refresh;
- exact request-id rollback for connected Player Stash rejection/timeout;
- focused owner-routing and wire validation tests.

Host still does **not** own or persist a remote Player Character in its Character library.

## Remaining correctness gap

Connected V1-13 is not release-complete. The owner inventory request/undo journal is currently process memory. If owner Character persistence succeeds but the owner process/ack dies before Host observes success, restarted-owner compensation cannot yet prove whether/how the original apply committed.

Next slice: durable owner inventory transaction journal/sidecar with replay-safe apply/undo/finalize, plus exact request-specific Host Stash compensation instead of the remaining underlying global last-undo dependency.

## Validation

**NO GREEN CLAIM.** Exact product head `05eb679` has no combined statuses and no commit-associated workflow runs. No observed execution exists for the new V1-13 tests, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library scenarios.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
