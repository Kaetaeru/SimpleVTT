# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T04:43:00+09:00`

## Run continuity

This is the existing active Rerun run. Do not create a new run_id, reset sequence, or replace task_id. Preserve prior exact-head Phase 13 evidence, Ready/connected work, V1-11 Campaign lifecycle history, declarative provider implementation, and the previous Long Rest domain/Memory persistence foundation. Comprehensive Codex audit remains deferred until all V1 pre-release implementation is complete.

## Preflight for this dispatch

- Mandatory Rerun order read exactly: README -> control -> STATE -> PLAN.
- Reconciled `continue`, sequence `1`, task `phase14-production-play-session-ux`.
- Confirmed `work/v1-composite` remains canonical through `CANONICAL_ROOT.md` and current branch resolution.
- Re-read current V1 handoff, release checklist, and `docs/design/campaign-systems.md` Rest contract.
- Did not repeat provider UI/core, Ready lifecycle, Campaign lifecycle, Character Long Rest projection, or Memory compound preparation work.

## Preserved prior Long Rest foundation

- Canonical domain `resolveLongRest()` owns HP/Temporary HP/life/death-save/Hit Dice/resource/effect recovery behavior.
- `characterLongRestProjection.ts` delegates Character-owned recovery to that domain authority and intentionally does not mutate Campaign time/rations.
- Character and Campaign repositories can prepare next immutable generation payloads without writing.
- Memory Character/Campaign stores have two-participant preflight/apply support and the compound writer only applies after both participants preflight successfully.

## Completed in this dispatch — production Tauri Character+Campaign compound persistence

### Shared generation primitives

- `cec4030` — `src-tauri/src/generation_store.rs`
  - `WriteGenerationRequest` is now serializable as well as deserializable so it can be embedded in a durable transaction marker.
  - exposes latest physical generation lookup, generation final-path construction, and retention pruning for the compound coordinator.
  - existing single-store temp/fsync/rename semantics remain intact.
- `ce7e944` — Character library exposes its generation prefix/label to the compound transaction module without changing normal repository behavior.
- `fb8c609` — Campaign library exposes the same metadata.

### Recoverable transaction commit point

- `908d7e1` — added `src-tauri/src/character_campaign_compound.rs`.
- Protocol:
  1. recover an already committed pending transaction first;
  2. preflight Character and Campaign expected/next physical generations;
  3. write and `sync_all()` both payloads to filenames invisible to normal generation readers;
  4. re-preflight both participants;
  5. write+sync a transaction marker temp and rename it to `character-campaign-compound.commit.json`; this marker rename is the transaction commit point;
  6. materialize both staged generations by rename to their normal immutable generation filenames;
  7. verify materialized payloads match the committed marker payloads;
  8. prune normal generation history;
  9. remove the marker only after both participants are materialized.
- Before the marker exists, failures remove both staging files and leave both previous generations visible.
- After the marker exists, an interruption is treated as committed work that must be completed by recovery rather than compensated by guessing an inverse mutation.
- If recovery sees one participant already materialized, it verifies exact payload equality and completes the other participant. If it cannot prove/complete the committed transaction it returns an explicit blocker instead of silently exposing an inconsistent success.

### Deterministic Rust fault contracts authored

`character_campaign_compound.rs` contains injected fault points/tests for:

- failure before commit marker => neither next generation visible;
- interruption immediately after commit marker => recovery materializes both next generations;
- interruption after Character materialization but before Campaign materialization => marker remains and recovery completes Campaign before normal production I/O can resume.

These tests are source-authored only; their execution result has not been observed in this dispatch.

### Production Tauri command/recovery boundary

- `ae42e81` — `src-tauri/src/lib.rs`:
  - registers `character_campaign_compound` module;
  - adds a process-wide `CharacterCampaignPersistenceState(Mutex<()>)` for Character/Campaign persistence commands;
  - Character read/write and Campaign read/write acquire the same mutex and call compound `recover_at(root)` before normal access;
  - therefore normal production commands do not intentionally return one new participant and one old participant after a committed interruption;
  - exposes `write_character_campaign_compound` as a Tauri command.
- `fed7ed7` — makes the mutex guard lifetime explicit to avoid an ambiguous/elided Rust return-lifetime compile hazard.
- `88cc8a7` — added `TauriCharacterCampaignCompoundWriter`, invoking `write_character_campaign_compound` from TypeScript.
- `b931cdc` — updated the existing Campaign Tauri structure regression to assert the new compound module, recovery-before-read boundary, fault/recovery structure, and TS writer command rather than the obsolete direct `local_data_child("campaign-library")` shape.

## Production Long Rest wiring inspection

The current Session UI has no generic Long Rest surface in `PlaySessionDock`, `SessionActionDock`, `SessionDmTools`, or `SessionCampaignPane`.

The existing production authority path is:

`AppProvider -> MockAdapter patched by campaignRuntimeAdapter -> CampaignApplicationService -> CampaignLibraryRepository`.

- `AppProvider` already imports `campaignRuntimeAdapter` and exposes its Campaign commands directly.
- `CampaignApplicationService` owns provider-aware Calendar/Ration authoritative mutations and preview arithmetic; React must not duplicate those calculations.
- `characterLibraryRuntimeAdapter` owns Character hydration/persistence and has private repository context plus existing test-store injection/exported durable helpers.
- `campaignRuntimeAdapter` similarly owns a private `CampaignApplicationService` context and exports only test-store/session-snapshot helpers today.

This means the next coordinator needs a small runtime seam into both private contexts (or an equivalent registered port) so it can prepare both generation candidates and accept/rehydrate them only after the compound writer succeeds. Do not implement the compound flow by calling existing public Character commit followed by Campaign commit.

## Validation status

- No Rust/TypeScript test or build execution result was observed in this dispatch.
- The new deterministic tests and structure regression are source-authored but are not claimed green.
- No GitHub Actions green claim is made.
- Declarative-provider exact-head validation remains pending and was not reopened.
- Comprehensive Codex audit was not started.
- V1-12 Long Rest is not DONE: durable Tauri transaction foundation is code-connected, but the production coordinator/UI is still missing.

## Current functional boundary

The production persistence prerequisite that previously blocked Long Rest wiring is now implemented at source level: Character+Campaign writes have one recoverable Tauri commit point and normal Character/Campaign I/O performs pending transaction recovery first.

The remaining functional gap is to connect the existing Character Rest authority and Campaign Calendar/Ration authority to that writer without allowing either runtime adapter to independently commit first.

## Next Exact Action

Implement the production **Long Rest compound coordinator**, then expose it with a minimal Session Campaign pane control.

1. Add the smallest explicit runtime seam/port needed to access hydrated Character repository/state and hydrated Campaign service/repository from one coordinator. Preserve existing single-store command behavior.
2. Add coordinator preview/input contracts. Rest itself is mandatory; Calendar time advance and Ration consumption are independently optional user selections.
3. Resolve Character changes through `projectCharacterLongRest` / domain `resolveLongRest`; do not duplicate class/resource recovery in Campaign/UI code.
4. Produce Campaign candidate changes through `CampaignApplicationService` authority/provider resolution rather than React arithmetic. OFF or unavailable Calendar/Ration must disable only that optional effect and must not block Rest itself.
5. Prepare exactly one next Character generation and one next Campaign generation, invoke the platform `CharacterCampaignCompoundWriter`, then accept/rehydrate/project both adapter states only after writer success.
6. On writer rejection, leave Character/Campaign/Scene/Activity projections at their pre-command state and surface a clear failure.
7. Add deterministic coordinator tests for Rest-only, optional time, optional rations, both selected, unavailable provider, duplicate/idempotent request, and compound writer failure.
8. Add the smallest compatible Long Rest preview/options/action block inside the existing `SessionCampaignPane`; do not redesign surrounding Campaign/Session UI.
9. Observe focused TypeScript/Rust checks when available before claiming green.
