# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T04:14:00+09:00`

## Run continuity

This is the existing active Rerun run. Do not create a new run_id, reset sequence, or replace task_id. Preserve prior exact-head Phase 13 evidence, Ready/connected work, V1-11 Campaign lifecycle history, and the V1-12 declarative provider core/runtime checkpoint.

## Preflight for this dispatch

- Mandatory Rerun order read: README -> control -> STATE -> PLAN.
- Reconciled `continue`, sequence `1`, task `phase14-production-play-session-ux`.
- Confirmed `work/v1-composite` remains canonical through `CANONICAL_ROOT.md`.
- Re-read current V1 handoff, release checklist, and Campaign systems provider/Rest contract.
- Did not repeat provider core/runtime or older Ready/Campaign lifecycle work.

## Completed in this dispatch — V1-12 declarative provider production UI

### Installed-provider selection

- `47de9a2` — added latest-per-providerId and exact-pinned descriptor helpers using the same numeric-aware version ordering as Campaign runtime.
- `de40e7b` — connected `CampaignSystemsPanel` to provider descriptors derived from the existing `snapshot.catalog`.
- Calendar/Ration selects retain their current visual/control structure.
- Compatible installed profiles are selectable; the latest installed version per providerId is the normal option.
- Selecting a custom provider submits both providerId and providerVersion so Campaign persistence pins the selected version.
- A still-installed older pinned version is shown as current while the latest version remains selectable.
- A removed/invalid pinned version is shown as explicitly unavailable without blocking the Campaign screen or unrelated play.

### Calendar / ration projection

- Custom Calendar uses the existing direct date editor with the selected profile's months and structured year/month/day display.
- Simple Day/Gregorian behavior remains intact.
- Custom Ration preview now calls the authoritative provider-aware `previewCampaignDailyRations` path.
- `shortageConsequences` render only as `DM 판정 제안`; no automatic damage, Exhaustion, or Character mutation was added.
- If the selected custom ration provider is missing, the UI does not silently fall back to builtin ration arithmetic.

### Focused contract / workflow

- `3284e93` / `b624a48` — added/aligned `campaignDeclarativeProviderUiStructure.test.ts` for latest-version dedupe, pinned lookup, UI Catalog projection, custom calendar months, unavailable state, and advisory ration consequences.
- `a285f2f` — canonical UI workflow Campaign step now includes:
  - `campaignDeclarativeProviderProfile.test.ts`
  - `campaignDeclarativeProviderImport.test.ts`
  - `campaignDeclarativeProviderRuntime.test.ts`
  - `campaignDeclarativeProviderUiStructure.test.ts`
- `.agents/V1_CURRENT_HANDOFF.md` updated at `8c79b9f`.

## Validation status

Current judgment: **provider production user path implementation complete; exact-head validation pending**.

- GitHub combined status for `a285f2f` exposed no status entries at this checkpoint.
- The available commit-workflow wrapper is PR-triggered only and returned no run for this direct canonical branch push.
- A separate read-only clone/test attempt could not start because the execution container could not resolve `github.com`; no repository files were cloned and no test command ran.
- Therefore the DNS failure is not a product test failure, but it also provides no pass evidence.
- Do not claim Actions green, build pass, or V1-12 DONE from this checkpoint.
- Comprehensive Codex audit remains intentionally deferred.

## Current functional boundary

The V1-12 Calendar/Ration **declarative provider core + production UI path is code-connected**. The remaining V1-12 implementation gap from the canonical checklist is the authoritative Long Rest compound transaction.

## Next Exact Action

Implement authoritative **Long Rest + optional Campaign time advance + optional ration consumption** without redesigning the existing Rest UI.

1. Read the current authoritative Long Rest command/runtime/write-back implementation before adding any new rest logic.
2. Reconcile it with `docs/design/campaign-systems.md` and Campaign repository transaction boundaries.
3. Add deterministic failing contracts for preview, optional side effects, idempotency, and failure atomicity.
4. Reuse existing Character rest authority; do not duplicate spell/resource recovery rules in Campaign code or UI.
5. Optional Calendar/Ration effects must be user-selected. OFF or missing providers must not block Long Rest itself.
6. If Character durable write-back or Campaign generation commit fails, no partial successful compound result may remain.
7. Time advance alone must not trigger Rest, and Rest alone must not force time/ration advancement.
8. If provider UI CI evidence becomes visible later, record it without reopening implemented provider work.
