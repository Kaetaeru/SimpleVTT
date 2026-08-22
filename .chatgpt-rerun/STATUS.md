# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product-code checkpoint: `8c1e0b357d19954ed4320e239d8d6dcad0f8c656`

## Current result

Connected Long Rest now has a visible DM/Player path in the existing Session Campaign pane and a source-connected process-restart recovery foundation.

- DM can offer the current Rest options to connected remote Character owners without copying those Characters into the Host library.
- Player sees exact HP/Temporary HP preview and accepts or declines from the same Campaign pane.
- Host persists owner-prepared/committed coordinator state as append-only Tauri records.
- Campaign global commit identity is stable across later Campaign revisions and Host restart.
- A restarted Host reconstructs committed vs precommit-aborted state from durable coordinator + Campaign idempotency.
- Global-commit wire messages can carry owner/preparation identity so a restarted Player can materialize the already-prepared Character generation directly from its durable marker.
- Owner Character preparation markers use immutable phase sidecars instead of overwrite rename, avoiding the Windows destination-replace problem.
- Tauri normal Character and Character+Campaign writes are blocked while a connected Long Rest Character generation is prepared, preventing generation drift before global commit.

This is still **not green**. Exact HEAD `8c1e0b3` has no combined statuses and no commit-associated workflow runs. No observed `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows two-instance result exists for this checkpoint.

Remaining source gap: precommit abort after both processes restart still needs an explicit owner-side durable abort cleanup path; the prepared Character remains invisible, so this is not a durable partial-success case, but the preparation marker should be closed deterministically. The new Host restart test also still needs to be wired into the focused `test:campaign-rest` command before validation.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
