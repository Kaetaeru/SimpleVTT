# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T08:56:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order before product work. All records reconciled to run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md` reconfirmed `work/v1-composite`. Pre-execution HEAD was `ef73d7f847b87324f3323defe351febe5364c66f`. No source-connected prior Long Rest slice was rebuilt.

`docs/design/campaign-systems.md` was rechecked. Its compound Long Rest contract forbids durable Campaign-only / Character-only success and explicitly places connected replay/idempotency/privacy before V1 acceptance. Host/owner process-restart recovery is therefore a V1-12 transaction requirement, not optional polish.

## Preserved foundation

Keep intact:

- canonical Character Long Rest rules/projection;
- local Character+Campaign compound Rest preview/commit and current DM UI;
- Memory/Tauri Character+Campaign compound persistence/recovery;
- connected SessionProjection ownership, Host authority, action/reconnect/event replay, roster references;
- connected Long Rest preflight, phase state machine, prepare-authorization wire, owner durable invisible staging, Host Campaign participant commit, distributed runtime/transport;
- remote Character ownership remains on Player; Host never creates a durable Character copy.

## Completed in this dispatch

### 1. Visible connected Long Rest user path

- `95a464d363b7810008bc4b4de67ac15a39423eae` — `ConnectedLongRestCampaignControls.tsx`.
  - live Host filters connected remote Player Character roster refs;
  - reuses existing DM `+8시간` / ration selections;
  - sends production `startConnectedLongRest` offer;
  - Player shows exact HP/temp-HP preview, options, accept/decline, and immutable progress phase.
- `00209e602c36a862631e99c84b2d97ba53c9f209` — controls mounted inside existing `SessionCampaignPane` REST section / Player Campaign pane; no new route or full-screen UX.
- `5f9b3a6a61565e56f9f1ae7192deae48e1d7c83f` — UI structure contract.
- `27040256d73524e80745149946fb6a0ec65d99da` — UI structure contract wired into `test:campaign-rest`.

### 2. Stable Campaign global commit identity

- `c7f346d64fc2331daad90bfb63ca599f83452ad3` — connected Campaign global commit id is now `<transactionId>:campaign-commit-v1`; later Campaign revisions cannot change recovery identity.
- `860052ff9c88d6c150038e7f386f214648a9ecfd` — authored retry-after-later-Campaign-mutation test proving duplicate converges to the same commit id.

### 3. Windows-safe owner Character preparation markers

Source review found the previous phase update used `fs::rename(temp, existing_marker)`; replacing an existing destination is not a safe Windows assumption.

- `454c16d7dea3c4d8263722355539cb108b6ba3d8` — owner preparation base marker is now immutable. `materialized` and `aborted` are separate immutable sidecars. A crash after Character generation write but before materialized sidecar remains recoverable by exact payload verification + sidecar creation.

### 4. Durable Host process-restart coordinator

- `fa4c4af20b27d17fae77b56e4907988141ce9484` was an immediately superseded first draft; do not restore it.
- `f0155bfbe05cb4ebc1f09ca0773dd80cdebec2e9` — current Host coordinator Rust store uses append-only immutable version files, avoiding Windows overwrite rename and retaining latest record per transaction.
- `a6ef94bcabfb341ccd87db23510e6eb18f2f187c` — Tauri read/write/delete coordinator commands under shared persistence mutex + compound recovery fence.
- `5c84a4e4f0bf95de4fc2e5b87278ac65539f947d` — Memory/Tauri TS coordinator store port.
- `f1afa9955830bf35732731d90dc5076905abcfee` — Host runtime persists `owner-prepared` before Campaign global commit, persists committed phase afterward, reconstructs `owner-prepared -> committed/aborted` from Campaign idempotency on restart, and binds recovered owner by participant identity rather than old peer socket.
- `10eb0b92e09f2e1ad314887b7a0363b99618efb6` — Host session hydrates durable coordinator state and async owner-materialization completion is awaited.
- `c4f2d66a0dedf5763486672848332d7b341b6e84` — deterministic Host restart contracts authored for both already-committed and never-committed Campaign cases.

### 5. Player process-restart post-global recovery

- `fb217de3c4e4c0f1c087c683958b0767eee3f2cd`, `316286e54362bd35c84cc77ecde04a8620ef6109` — global commit can carry owner/preparation identity and transaction abort state retains preparation identity when available.
- `3390e258e92dcc034438b1fab596ee63443a649e` — wire validator accepts restart recovery identity only as a complete owner+Character+preparation tuple.
- `308a26fb0f14bc1aa3739801987410a20cad48bd` — Tauri owner restart recovery materializes the durable staged Character without in-memory offer/decision state, rehydrates Character library, and rebuilds fresh SessionProjection.
- `71d405766687e109fe318866517de745f9024e3e` — normal global commit delivery includes owner/preparation identity; Host reconnect replay enriches committed messages from durable coordinator; Client falls back to restart materialization when ClientRecord is gone.
- `75d922204cb667d4fdadbc5ea61af74b89754b7c` — restart-safe global commit wire test authored.
- `be33707fbe8f553f35f2a97868001a004adedabc` — existing distributed runtime test corrected to await async Host materialization completion.

### 6. Prepared Character write barrier

A new atomicity hole was found: owner prepare was durable/invisible, but unrelated normal Character writes could still advance the generation before Campaign global commit, making owner materialization fail after Campaign commit.

- `bb240dfbae9f9f035b63752b115b1ac0b5dc6e3c`, corrected by `8c1e0b357d19954ed4320e239d8d6dcad0f8c656` — Rust guard detects a live prepared connected Long Rest base marker unless `.materialized` or `.aborted` sidecar exists.
- `45729f71a690ad7260c17209266f7bb5b0c61e11` — normal Tauri `write_character_library_generation` and `write_character_campaign_compound` now reject while prepared. Connected Rest materialize/abort intentionally bypass this guard so they can close the transaction.

Exact product-code HEAD before checkpoint docs: `8c1e0b357d19954ed4320e239d8d6dcad0f8c656`.

## Validation status

**NO GREEN CLAIM.**

Exact product head `8c1e0b3` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed `tsx`, `tsc --noEmit`, `npm run test:campaign-rest`, `npm run build`, `cargo test`, Tauri build, or Windows execution result exists for this head. Source-authored tests are not execution evidence.

## Current durability assessment

Source-connected now:

1. owner exact preview/decision;
2. Host exact preflight/prepare authorization;
3. durable owner no-visibility prepare;
4. prepared-generation normal-write fence in production Tauri;
5. durable Host owner-prepared record before Campaign global commit;
6. stable/idempotent Campaign global commit;
7. post-global Host restart recovery;
8. post-global Player restart materialization recovery;
9. owner materialized SessionProjection acknowledgement and Host remote projection refresh;
10. visible DM/Player control path in existing Campaign pane.

One smaller precommit restart cleanup gap remains: if Host and owner both restart after owner prepare but before Campaign global commit, Host reconstructs `aborted`, but the current abort wire has no durable preparation identity and a restarted owner has no ClientRecord. The prepared Character generation remains invisible and the write barrier remains active until explicitly cleaned, so this must be closed before implementation-complete status.

Also, `tests/ui/connectedLongRestHostRestartRecovery.test.ts` is authored but has not yet been added to `test:campaign-rest`.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head validation evidence; do not duplicate implementation above.
3. Close precommit double-restart cleanup:
   - replace the current durable Host aborted-record placeholder preparation id with the retained real `state.preparationId` when present;
   - extend/enrich abort recovery with exact owner/preparation identity;
   - on a restarted Tauri owner, abort the durable Character preparation directly when no ClientRecord exists;
   - verify no Character generation becomes visible and the write barrier clears.
4. Add `connectedLongRestHostRestartRecovery.test.ts` plus new abort/write-barrier structure contracts to `npm run test:campaign-rest`.
5. Source-review `connectedLongRestSessionAdapter.ts` / Host coordinator types for concrete TypeScript regressions only.
6. If executable evidence becomes available, run focused campaign-rest + TypeScript/build + Rust tests before adding further V1-12 scope.
7. Keep V1-13 and final comprehensive Codex audit deferred.
