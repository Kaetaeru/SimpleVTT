# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

This is the same active V1-completion run. Do not reset run identity, repeat source-connected work for validation, route implementation to `main`, or start the comprehensive Codex audit before the pre-release boundary.

## Preserved foundation

Do not reimplement:

- Phase 13 connected Character SessionProjection, host authority, reconnect/event-cursor replay, owning-client Character write-back;
- Ready lifecycle;
- V1-11 Campaign lifecycle and connected roster reference behavior;
- declarative Calendar/Ration providers;
- canonical `resolveLongRest()` / `projectCharacterLongRest()`;
- local active-Character Long Rest preview/compound commit/SessionCampaignPane UI;
- Memory/Tauri Character+Campaign compound persistence/recovery;
- `connectedLongRestPreflight.ts` exact owner/Character/Campaign revision gate;
- `connectedLongRestTransactionState.ts` approved -> owner-prepared -> committed -> complete/aborted recovery model;
- connected Long Rest transport envelope/codec added in the prior execution.

## Scope decision

`docs/design/campaign-systems.md` requires connected Long Rest in V1: Character-by-Character preview, DM/owner decision, exact validation, and no Character-only/Campaign-only durable partial success.

Remote Character ownership remains with the owning Player store. Host-unknown remote Characters may be projected/mounted and roster-referenced but must not be copied into the Host Character library.

## Completed in this execution

### Focused transport regression

- `0521cd0` — `connectedSessionWire.test.ts` now round-trips canonical Long Rest offer/global-commit envelopes and rejects malformed Long Rest Character revisions.
- `1552416` — `connectedLongRestWire.test.ts` added to `npm run test:campaign-rest`.

### Owner Character durable preparation boundary

Source inspection established that existing `prepareCharacterLibraryGeneration()` only creates an immutable candidate payload; normal `generation_store::write_generation_at()` fsyncs a temp file and immediately renames it to a visible committed generation. There was no existing durable no-visibility staging primitive suitable for a remote owner in a distributed compound transaction.

Implemented the missing boundary:

- `a8ce526` — `src-tauri/src/connected_long_rest_character.rs`
  - durable transaction/preparation marker stored separately from committed Character generations;
  - `prepare_at`: validates current physical generation, fsyncs the exact candidate marker, leaves Character generations unchanged;
  - `materialize_at`: only after global commit, writes the exact prepared immutable generation;
  - post-write interruption recovery: if generation already advanced, exact payload equality is required before marking materialized;
  - `abort_at`: precommit abort remains durable/idempotent and refuses post-materialization compensation;
  - authored Rust tests for invisible prepare/materialize retry and abort.
- `1e1f0f6` — Tauri commands registered under the existing shared Character/Campaign persistence mutex and compound-recovery fence:
  - `prepare_connected_long_rest_character_generation`;
  - `materialize_connected_long_rest_character_generation`;
  - `abort_connected_long_rest_character_generation`.
- `73fd8f0` — `connectedLongRestOwnerPreparationStore.ts`
  - common preparation-store port;
  - Memory reference implementation;
  - Tauri command implementation.
- `b8c81a3` — Memory store deterministic tests for invisible prepare, idempotent retries, conflicting/stale rejection, and abort.
- `ffb26c7` — `connectedLongRestOwnerPersistence.ts`
  - validates exact owner Character revision;
  - projects canonical Long Rest candidate;
  - prepares the next immutable Character-library generation;
  - stages it through the preparation store;
  - exposes explicit materialize/abort operations.
- `e4c0c12` — deterministic owner persistence tests for canonical HP/temp-HP Rest candidate, stale revision rejection, invisible stage, materialization, and abort.
- `49271f7` — both new owner preparation/persistence tests wired into `npm run test:campaign-rest`.

Exact product-code head before checkpoint documents: `49271f768f51bee12caa0f30a7a33f63c716bdcb`.

## Validation status

**NO GREEN CLAIM.**

At dispatch preflight, canonical branch HEAD `0ea292b` returned no combined commit statuses and no commit-associated workflow runs. No observed `tsx`, `tsc`, `npm run build`, `cargo test`, Tauri build, or Windows result exists for the new owner-staging head.

`serde_json` is already an explicit Tauri dependency, so the new marker serialization does not require a Cargo dependency change. Source inspection only is not execution evidence.

## Remaining V1-12 gap

The distributed transaction now has:

1. exact Host ownership/revision preflight;
2. explicit transaction phase model;
3. Session transport envelope types;
4. owner canonical Character candidate generation;
5. durable owner no-visibility prepare/materialize/abort storage.

Still missing production orchestration:

1. Host sends an offer from the currently mounted remote SessionProjection plus exact Campaign revision/options.
2. Owning Client renders canonical Rest preview and accepts/declines the exact offer.
3. Host revalidates decision/current authority and authorizes owner prepare.
4. Owner calls the new durable preparation port and returns the exact preparation ID.
5. Host commits Campaign optional effects/idempotency only after owner-prepared state.
6. Host sends global commit identity; owner materializes the already-prepared Character generation and rehydrates its local Character/Scene projection.
7. Reconnect/retry resumes from transaction state/markers without duplicate Rest or compensation.
8. Session-only Rest-expired effects remain transient.

## Current Next Exact Action contract

On the next Rerun dispatch:

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` head.
2. Check exact-head validation evidence. If unavailable, do not redo the new staging slice.
3. Source-review the new Rust/TS preparation boundary for compile/structure regressions; if exact-head tests become observable, prioritize `npm run test:campaign-rest`, `tsc --noEmit`/`npm run build`, and Rust tests covering `connected_long_rest_character`.
4. Add an explicit Host -> owner prepare authorization envelope if needed so `preflightConnectedLongRest` occurs before owner durable staging; do not rely on implicit timing between owner decision and `owner-prepared`.
5. Implement a connected Long Rest runtime port around existing `connectedSessionRuntimeAdapter` seams:
   - Client preview/decision;
   - owner prepare/materialize/abort via `connectedLongRestOwnerPersistence`;
   - Host transaction state via `connectedLongRestTransactionState`;
   - Host Campaign commit/idempotency using the existing Campaign/compound preparation authority without Host-owned remote Character persistence.
6. Rehydrate/publish owner Character + Scene only after materialization; Campaign projection only after Host global commit.
7. Add deterministic reconnect/retry/failure tests before adding UI beyond the minimum decision/progress state.
8. Keep V1-13 and comprehensive Codex audit deferred until this V1-12 distributed runtime path is source-connected and checkpointed.
