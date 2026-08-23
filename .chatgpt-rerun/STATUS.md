# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product-code checkpoint: `45c6dae19f2f6721e0fe012079cb6436f80b0938`

## Current result

V1-12 Connected Long Rest remains source-complete / validation pending and was not repeated.

V1-13 now has a durable owner inventory journal for connected remote Character mutations. The owner writes request/before state before Character persistence and append-only applied/undoing/undone/finalized sidecars afterward. This closes the owner-process restart windows where apply or undo committed but the acknowledgement/phase sidecar was lost.

Current source also includes:

- Host -> owner Client durable inventory write-back + fresh Character SessionProjection refresh;
- request-id scoped item/GP compensation;
- restart-safe compensation without prior process in-memory undo state;
- deferred owner finalization while Party Stash / DM Library Campaign work is unresolved;
- DM Library remote Character compensation if the later Campaign mutation fails;
- exact connected Host Stash requestId binding so compatibility `undoLast...` cannot select an unrelated inventory change;
- focused journal/restart/structure contracts wired into the existing campaign-rest focused suite.

Host still does not own or persist a remote Player Character in its Character library.

## Remaining correctness gap

V1-13 is not release-complete. The owner side is now restart-recoverable, but Host process restart between owner Character apply and Party Stash Campaign reconciliation still lacks durable coordinator/reconnect recovery.

Next slice: on Host restart/reconnect, use Campaign idempotency to decide whether an unfinalized owner request should be finalized `applied` or compensated and finalized `undone`.

## Validation

**NO GREEN CLAIM.** Exact product head `45c6dae19f2f6721e0fe012079cb6436f80b0938` has no combined statuses and no commit-associated workflow runs. No observed execution exists for the new focused tests, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library restart scenarios.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
