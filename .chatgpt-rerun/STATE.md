# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T08:31:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the required order. All durable records still identified run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, with `continue` authorization.

Canonical branch resolved to `work/v1-composite`; pre-execution HEAD was `0ea292bc8ede75cb8045d50748e02062291ed3a8`. No combined commit statuses or commit-associated workflow runs were observable for that head.

No verified/source-connected slice was repeated.

## Preserved source-connected work

Keep intact:

- local canonical Long Rest projection and local Character+Campaign compound preview/commit/UI;
- Tauri Character+Campaign compound staging/commit-marker/recovery foundation;
- connected SessionProjection, Host authority, reconnect/event cursor, owning-client ResolutionEvent write-back;
- connected Campaign roster reference behavior;
- `connectedLongRestPreflight.ts` exact owner/Character/Campaign revision gate;
- `connectedLongRestTransactionState.ts` approved -> owner-prepared -> committed -> complete/aborted model;
- prior connected Long Rest transport types/codec.

Connected Long Rest is confirmed V1 scope from `docs/design/campaign-systems.md`; remote Character durable ownership remains on the owning Player store.

## Completed in this dispatch

### 1. Focused transport regression wiring

- `0521cd07a189dc6faf9e02d6461eac3cee0debd7`
  - `connectedSessionWire.test.ts` now covers valid Long Rest offer/global-commit envelopes and malformed Character revision rejection through the canonical Session wire codec.
- `1552416668f9a749ddf696844af53540e938b57a`
  - `connectedLongRestWire.test.ts` added to `npm run test:campaign-rest`.

### 2. Existing persistence gap identified

Source inspection found no true durable no-visibility owner prepare primitive:

- `prepareCharacterLibraryGeneration()` already builds an immutable next-generation payload without committing it;
- `MemoryCharacterLibraryStore.preflightCompoundWrite()` validates without exposure but is volatile-only;
- normal Rust `generation_store::write_generation_at()` writes+fsyncs temp and immediately renames to the visible committed generation.

Therefore a separate durable owner preparation marker is required for connected/distributed Long Rest. Committing then rolling back was not used.

### 3. Durable Tauri owner Character preparation

- `a8ce526aa463d2524c29ff42714c08c4a377168b` — added `src-tauri/src/connected_long_rest_character.rs`.

Behavior:

1. transaction/preparation identity is validated;
2. exact expected/next Character generation and candidate payload are recorded in a marker whose filename cannot be mistaken for a committed Character generation;
3. marker temp file is fsynced and renamed, but Character library generation does not advance during prepare;
4. repeated exact prepare returns the existing phase; conflicting payload/preparation is rejected;
5. materialize commits the exact prepared generation only after global commit authorization;
6. interruption after generation write but before marker phase update is recoverable: retry accepts only exact committed-payload equality;
7. prepared -> aborted is durable/idempotent while materialized state cannot be compensated/aborted;
8. authored Rust tests cover prepare invisibility, idempotent materialization, and abort.

- `1e1f0f69579c520c13aa72d7ac1413c2e49e67a6` — registered Tauri commands:
  - `prepare_connected_long_rest_character_generation`;
  - `materialize_connected_long_rest_character_generation`;
  - `abort_connected_long_rest_character_generation`.

All three run under the existing shared `CharacterCampaignPersistenceState` mutex and call `character_campaign_compound::recover_at()` before owner Character work.

### 4. TS preparation store/application ports

- `73fd8f02413a38788a70ccb0444c159b383e8aba` — `connectedLongRestOwnerPreparationStore.ts`
  - common `prepare/materialize/abort` port;
  - Memory implementation for deterministic browser/dev tests;
  - Tauri implementation invoking the new durable commands.
- `b8c81a3b9b9bde9c902438fc201962d6c80a8a3e` — deterministic preparation-store tests:
  - prepare invisible until materialize;
  - exact prepare/materialize retry idempotency;
  - conflicting retry rejection;
  - generation drift rejection;
  - abort remains invisible and blocks materialization.
- `ffb26c7e01bb1353e4cc4c606224e4f113f59f5c` — `connectedLongRestOwnerPersistence.ts`
  - verifies active Character identity/source/runtime revision against Host-approved preflight;
  - resolves Character recovery only through canonical `projectCharacterLongRest()`;
  - creates the immutable next Character-library generation via existing `prepareCharacterLibraryGeneration()`;
  - stages exact payload through owner preparation store;
  - provides explicit materialize/abort operations.
- `e4c0c12a8d0badf3f44c2e69092908b4a910295b` — deterministic owner persistence tests for canonical HP/temp-HP Rest projection, stale-revision rejection, invisible preparation, materialization, and abort.
- `49271f768f51bee12caa0f30a7a33f63c716bdcb` — both new owner preparation/persistence test files added to `npm run test:campaign-rest`.

Exact product-code head before STATUS/PLAN/STATE/control checkpoint documents: `49271f768f51bee12caa0f30a7a33f63c716bdcb`.

## Validation status

**NO GREEN CLAIM.**

Observed at dispatch preflight:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No local/container `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows execution result was observed in this dispatch. The source-authored TS/Rust tests therefore remain validation pending.

Dependency inspection confirmed `serde_json = "1"` already exists in `src-tauri/Cargo.toml`; no new Rust dependency was required.

## Remaining exact gap

Owner durable preparation now exists, but it is not yet routed through live connected Session production flow.

Still required:

1. Host builds exact Long Rest offer from mounted remote SessionProjection + Campaign revision/options.
2. Owner receives authoritative Character preview and accepts/declines exact offer.
3. Host revalidates owner decision/current authority before authorizing durable prepare.
4. Owner calls the new preparation port and returns `preparationId`.
5. Host enters owner-prepared state and commits Campaign optional effects/idempotency/global commit identity.
6. Owner receives global commit, materializes the prepared Character generation, rehydrates local Character + Scene, and returns owner-materialized.
7. Host marks complete only after exact owner materialization acknowledgement.
8. precommit failures abort; postcommit failures recover/replay rather than compensate.
9. reconnect/retry must resume idempotently from durable marker/transaction state.
10. Session-only Rest effect expiry remains transient.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` head.
2. Check for exact-head validation. If unavailable, preserve this source-connected staging boundary without rebuilding it.
3. Inspect compile/structure of `connected_long_rest_character.rs`, Tauri command registration, and TS owner preparation modules; prioritize focused/Rust execution if evidence becomes available.
4. Add an explicit Host -> owner prepare-authorization wire envelope carrying the exact approved preflight, unless current runtime routing can prove an equally explicit ordering. Owner durable staging must not race ahead of Host preflight validation.
5. Add a connected Long Rest runtime port without moving remote Character ownership:
   - Client preview/decision from current local Character;
   - Host `preflightConnectedLongRest` + `beginConnectedLongRestTransaction`;
   - owner prepare/materialize/abort through `connectedLongRestOwnerPersistence`;
   - Host Campaign commit/idempotency through existing Campaign preparation authority;
   - global-commit resend/recovery through the transaction state machine.
6. Rehydrate/publish owner Character and Scene only after owner materialization; publish Campaign effects only after Host global commit.
7. Add deterministic failure/retry/reconnect tests before adding more than the minimum owner decision/progress UI.
8. Keep V1-13 and comprehensive Codex audit deferred.
