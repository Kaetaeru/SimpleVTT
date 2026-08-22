# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This remains the same V1-completion run. Preserve source-connected Long Rest, Campaign, SessionProjection, Ready/reconnect, Character ownership, and current Session UI work. Do not route to `main`, duplicate already implemented slices, or begin the comprehensive Codex audit before the pre-release boundary.

## Contract decision

`docs/design/campaign-systems.md` requires connected Long Rest to collect DM/owner decisions and prevent durable Character-only or Campaign-only partial success. Therefore process-restart recovery is part of this V1-12 transaction boundary; it is not safely excludable as later polish.

Remote Character durability remains owned by the Player Character store. Host stores only Session projection/reference plus its own Campaign state and transaction coordinator metadata.

## Completed in this execution

### Visible connected Rest path

- `95a464d` — new `ConnectedLongRestCampaignControls.tsx`.
  - live DM Host can offer the existing +8-hour / ration selections to connected remote roster Characters;
  - Player sees exact HP/Temporary HP preview, options, immutable accept/decline, and transaction phase.
- `00209e6` — controls integrated into the existing `SessionCampaignPane`; no new route/full-screen/layout redesign.
- `5f9b3a6` — visible-path structure test.
- `2704025` — UI structure test added to `test:campaign-rest`.

### Stable global commit / Windows-safe owner preparation

- `c7f346d` — Campaign global commit identity is now stable: `<transactionId>:campaign-commit-v1`, independent of later Campaign revision.
- `860052f` — deterministic duplicate-after-later-Campaign-mutation test authored.
- `454c16d` — owner Tauri preparation marker changed from overwrite rename to immutable base marker + `.materialized` / `.aborted` sidecars for Windows-safe phase persistence and crash recovery.

### Durable Host process-restart coordinator

- superseded draft `fa4c4af` was immediately replaced; do not restore it.
- `f0155bf` — current Rust Host coordinator store uses append-only immutable version files and reads latest record per transaction.
- `a6ef94b` — Tauri read/write/delete Host coordinator commands registered under existing Character/Campaign mutex and compound recovery fence.
- `5c84a4e` — TS Memory/Tauri Host coordinator store port.
- `f1afa99` — runtime Host durable owner-prepared/committed recovery integration.
- `10eb0b9` — Host session hydrates durable Long Rest coordinator state before replay; owner-materialized completion is awaited.
- `fb217de`, `316286e` — global commit recovery identity contract and preparation identity retention through precommit abort state.
- `3390e25`, `75d9222` — wire validation/test for restart recovery identity.
- `c4f2d66` — deterministic Host restart test authored: Campaign idempotency upgrades owner-prepared to committed, otherwise precommit restart becomes aborted.

### Player process-restart materialization

- `308a26f` — restarted Tauri owner can materialize the exact durable preparation from enriched global commit without an in-memory offer/decision record, then rehydrate Character and publish a fresh SessionProjection.
- `71d4057` — normal and reconnect global-commit delivery carries/enriches ownerParticipantId + Character revision + preparationId and falls back to the durable owner restart recovery path.

### Prepared-generation write barrier

A new atomicity gap was found during source review: after owner prepare, unrelated Character writes could otherwise advance the generation before Host global commit.

- `bb240df`, corrected by `8c1e0b3` — Rust write-barrier module detects live prepared connected Rest markers.
- `45729f7` — normal Tauri Character generation writes and Character+Campaign compound writes now reject while the connected Rest preparation owns the next Character generation. Materialize/abort commands bypass this guard intentionally and close the preparation.

Exact product-code head before checkpoint docs: `8c1e0b357d19954ed4320e239d8d6dcad0f8c656`.

## Validation status

**NO GREEN CLAIM.**

For exact product head `8c1e0b3`:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed `tsx`, `tsc --noEmit`, `npm run test:campaign-rest`, `npm run build`, `cargo test`, Tauri build, or Windows two-instance execution exists for this checkpoint. Rust/TS tests added here are source-authored validation contracts, not executed evidence.

## Remaining exact gap

The post-global-commit durable recovery path is now source-connected for Host and owner process restart, and Tauri Character writes are fenced while prepared.

Still required before V1-12 can be considered implementation-complete:

1. Precommit double-restart cleanup:
   - Host durable abort record must preserve/send the exact owner preparation identity;
   - a restarted owner receiving that abort must mark the durable prepared Character marker aborted even without an in-memory ClientRecord;
   - no Character generation may become visible.
2. Wire `tests/ui/connectedLongRestHostRestartRecovery.test.ts` into `npm run test:campaign-rest` (it is authored but not yet in the command).
3. Add source/deterministic coverage for the Tauri prepared-generation write barrier registration and restart owner recovery envelope.
4. Obtain executable evidence when an environment is available: focused TS tests, TypeScript/build, Rust tests, then Windows two-instance restart/reconnect acceptance.
5. Only after V1-12 distributed durability is closed, reconcile actual V1-13 Stash/DM Library gaps instead of following its stale TODO label.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head validation evidence; do not rebuild any slice above merely to obtain validation.
3. Fix the remaining precommit double-restart abort cleanup:
   - stop emitting placeholder preparation identity from durable Host aborted records;
   - enrich recovery abort with exact `preparationId`/owner identity;
   - add a restarted-owner Tauri abort path that closes the prepared sidecar without ClientRecord state.
4. Add `connectedLongRestHostRestartRecovery.test.ts` and any new abort/write-barrier structure test to `test:campaign-rest`.
5. Source-review TypeScript signatures around `connectedLongRestSessionAdapter`, global commit enrichment, and async Host completion; fix only concrete regressions.
6. If execution evidence becomes available, prioritize `npm run test:campaign-rest`, `tsc --noEmit` / `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml` before more feature work.
7. Keep V1-13 and comprehensive Codex audit deferred.
