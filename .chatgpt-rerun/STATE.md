# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T05:02:00+09:00`

## Run continuity / preflight

This is the same active Rerun run. Do not create a new run_id, reset sequence/task identity, discard prior exact-head evidence, or route work away from `work/v1-composite`.

This dispatch:

- read README -> control -> STATE -> PLAN in the required order;
- reconciled `continue`, sequence `1`, task `phase14-production-play-session-ux`;
- confirmed `work/v1-composite` remains canonical;
- re-read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and `docs/design/campaign-systems.md`;
- resumed exactly from the prior Long Rest production coordinator gap;
- did not reimplement the Tauri compound persistence foundation, declarative providers, Ready lifecycle, or Campaign lifecycle work.

## Preserved foundation

Keep all prior Long Rest/Tauri foundation:

- canonical `resolveLongRest()` domain authority and `characterLongRestProjection.ts`;
- prepared Character/Campaign immutable generation helpers;
- Memory two-participant preflight/apply;
- Tauri dual staging/fsync, `character-campaign-compound.commit.json` commit point, committed interruption recovery;
- shared Character/Campaign persistence mutex and recovery-before-normal-I/O fence;
- `write_character_campaign_compound` Tauri command and TS writer.

No execution result for those Rust changes was newly observed here.

## Completed in this dispatch — local production Long Rest orchestration

### 1. Compound coordinator

- `8ed90d2` — effective Session Calendar/Ration capability overrides added to the Long Rest input so a durable Campaign capability cannot accidentally override a Session-level OFF state.
- `c1664db` — `previewLongRestCompound()` added and `executeLongRestCompound()` refactored to commit the exact same candidate that preview computes.

Coordinator behavior now is:

1. normalize/validate transaction, Campaign, and active Character IDs;
2. reject duplicate master transaction IDs before Character Rest projection;
3. project Character recovery only through `projectCharacterLongRest` / domain `resolveLongRest`;
4. seed an isolated Memory Campaign repository with the current Campaign document;
5. use `CampaignApplicationService.advanceCalendar()` and/or `consumeDailyRations()` only when the corresponding user option is requested and the effective capability/provider is usable;
6. stamp the master transaction ID into Campaign `recentRequestIds` as the durable compound idempotency ledger;
7. prepare one next Character generation and one next Campaign generation without mutating production repositories;
8. invoke exactly one `CharacterCampaignCompoundWriter`;
9. return committed candidates only after the writer resolves.

Rest-only still creates the Campaign participant generation so the master compound transaction ID is durable; it does not implicitly advance Calendar or consume Rations.

### 2. Idempotency and optional-provider behavior

A retried compound transaction whose master ID already exists is a `duplicate` no-write result. This prevents repeated Character-side Rest effects such as Exhaustion reduction from being applied twice.

Calendar/Ration optional effects:

- default to not requested;
- honor effective Session OFF state;
- built-in providers require no Catalog profile;
- custom providers use exact pinned Catalog profiles;
- unavailable custom provider returns a warning and skips only that optional effect;
- optional-effect failure/absence does not invent Rest failure when Rest itself is otherwise valid.

### 3. Deterministic coordinator contracts authored

- `79bd7d7` — `tests/ui/longRestCompoundCoordinator.test.ts`
  - Rest-only;
  - Calendar-only;
  - Ration-only;
  - both selected;
  - Session-disabled optional effects;
  - unavailable custom providers;
  - master request duplicate/no-write;
  - writer rejection leaves Character/Campaign durable stores unchanged.
- `12cd4f3` — `tests/ui/longRestCompoundPreview.test.ts`
  - preview performs no production writes;
  - preview Character/Campaign candidate matches the subsequent committed candidate.

These are authored contracts, not observed passes yet.

## Completed in this dispatch — production runtime bridge

### Runtime path

- `1fd3071` — initial `longRestCompoundRuntimeAdapter.ts` production bridge.
- `2f97b01` — explicit store/writer boundary types.
- `7e0e5ce` — production authoritative preview bridge added.

Production bridge behavior:

- reads the actual `MockAdapter` snapshot and full Campaign records;
- obtains the hydrated durable Character document from the existing Character persistence runtime context;
- resolves exact custom Calendar/Ration profiles with `pinnedCampaignProviderDescriptorFromCatalog`;
- passes effective `campaignSessionSystems` capability flags to the coordinator;
- on Tauri, prepares against new handles to the actual platform Character/Campaign stores and commits with `TauriCharacterCampaignCompoundWriter`;
- in volatile browser/test mode, seeds paired Memory stores from the current Character/Campaign state and uses `MemoryCharacterCampaignCompoundWriter`;
- does **not** call existing public Character commit followed by Campaign commit;
- does **not** mutate current runtime projection before the compound writer succeeds;
- after success only, replaces the runtime persistence contexts with the committed stores and calls `adapter.getSnapshot()` to rehydrate Character/Campaign state and refresh the existing Scene Character projection;
- publishes that post-commit snapshot through the existing external snapshot event channel.

The bridge currently reuses the existing context store-injection/reset helpers that were historically named `...ForTests`; it does not change their semantics. This is source-functional but should be renamed/refactored into an explicitly production-named port before freeze if later audit/maintainability work requires it. Do not replace it with sequential commits.

### Runtime contracts authored

- `c5d2bf7` — `tests/ui/longRestCompoundRuntimeAdapter.test.ts`
  - production volatile bridge: damaged Character + Calendar + Rations -> compound commit -> rehydrated Character + Scene HP + Campaign time/ration projection;
  - production Rest with no options leaves Calendar/Rations unchanged.

No test execution result was observed.

## Completed in this dispatch — existing UI integration

- `1455b1b` — initial Long Rest block added to existing `SessionCampaignPane` without moving/replacing Party, Calendar, Ration, or Advancement surfaces.
- `b99bb4c` — the block now consumes the authoritative production preview rather than displaying only option labels.

DM-facing block behavior:

- active Character name shown;
- preview shows HP before -> after and Temporary HP before -> after;
- `캠페인 시간 +8시간` checkbox is default OFF and disabled when effective Session Calendar is OFF;
- `하루치 식량 소비` checkbox is default OFF and disabled when effective Session Rations are OFF;
- selected Calendar preview shows the authoritative resulting Campaign date/time;
- selected Ration preview shows authoritative balance before -> after;
- provider/capability warnings are surfaced;
- dead/0 HP or preview failure disables commit;
- one `장기 휴식 적용` action calls the production compound bridge.

No broad visual redesign or CSS-system change was made; the block reuses the existing `session-campaign-block`, `session-campaign-editor`, note/warning, and button language.

UI-rule boundary source inspection found that the repository guard prohibits direct domain rule ownership/arithmetic in TSX. The new pane imports only the application runtime preview/command and therefore does not add a prohibited domain value import.

## Validation wiring

- `7e85dc1` — added `npm run test:campaign-rest` with:
  - `characterLongRestProjection.test.ts`;
  - `characterCampaignCompoundPersistence.test.ts`;
  - `longRestCompoundCoordinator.test.ts`;
  - `longRestCompoundPreview.test.ts`;
  - `longRestCompoundRuntimeAdapter.test.ts`.
- `npm run build` now invokes `test:campaign-rest` after TypeScript / existing creation and rules suites and before Vite build.

This ensures future exact-head build validation cannot silently omit the new Long Rest contracts.

## Validation status

**NO GREEN CLAIM.**

Observed via GitHub connector for latest implementation commits:

- combined commit status: no statuses returned;
- commit-associated workflow runs: none returned;
- attempted direct Actions run listing endpoint was not supported by the connector.

No local/container checkout of GitHub was available in this environment, so no `tsx`, `tsc`, `cargo test`, Tauri build, or Windows execution result was observed.

Therefore:

- local active-Character Long Rest user path: **SOURCE-CONNECTED / VALIDATION PENDING**;
- Tauri cross-store transaction: **SOURCE-CONNECTED / VALIDATION PENDING**;
- V1-12 overall: still **PARTIAL**, not DONE;
- comprehensive Codex audit: not started.

## Remaining functional boundary

The local/host runtime now has a real active persisted Character -> authoritative preview -> optional Campaign effects -> one compound durable commit -> rehydrate -> existing SessionCampaignPane path.

Before V1-12 can be called functionally complete, the design contract must be reconciled with connected play. `docs/design/campaign-systems.md` describes Character-by-Character Rest preview and DM/owner decisions. The new local bridge intentionally does not copy a host-unknown remote Character into the host durable Character library.

Potential next gap:

- determine whether connected remote/host-unknown Character Rest is required in V1-12;
- if required, reuse existing connected Session Character projection, host authority, reconnect replay/write-back, and owner decision boundaries;
- Session-only Rest effect expiry must remain transient; current Scene projection has no generic durable effect collection, so do not invent one casually.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and current `work/v1-composite` head.
2. Check for newly observable validation evidence. Preferred focused commands/evidence: `npm run test:campaign-rest`, `tsc --noEmit` / `npm run build`, and Rust tests for `character_campaign_compound`. If unavailable, do not redo source-connected Long Rest work.
3. Audit existing connected Session Character authority/reconnect/write-back source against the Campaign Rest contract and decide whether remote/host-unknown Character participation/owner confirmation is an actual V1-12 requirement.
4. If required, implement connected Long Rest via the existing host-authoritative Session projection/write-back path and the compound boundary; do not persist remote Characters as host-owned Characters.
5. If not required, document the source-backed scope decision and reconcile V1-12 status.
6. After that, reconcile V1-13 Party Stash / DM Library against current source before editing: the release checklist is stale and existing runtime/UI already contains substantial stash/library behavior.
7. Preserve UI structure and keep final Codex audit deferred.
