# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T12:20:00+09:00`

## Preflight reconciliation

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/campaign-systems.md`, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`.

Run identity remained valid: same `run_id`, `sequence=1`, `task_id=phase14-production-play-session-ux`, `status=continue`. The handoff/checklist V1-13 selector/approval TODO prose is stale relative to actual source and was not replayed.

Before product writes, comparing prior base `d2c000e4530b375c6610ebc1bb1cb9663bbf1ff0` to the branch showed 15 commits ahead, exactly the previously recorded 12 Party Stash outcome source/test commits plus 3 coordination commits. Immediately before this checkpoint it showed 20 commits ahead, exactly those 15 plus the 5 new ration-conversion source/test writes below. No divergent concurrent writer was observed.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest normal durable-storage path / validation pending;
- Player-owned Character durability and Host/owner recovery/compensation paths;
- Campaign-authoritative Party Stash and existing durable `transferPartyStash` transaction;
- Party Stash `shared | dm-approval | dm-managed` selector and guards;
- Player -> Host approval request transport with no pre-approval asset mutation;
- DM approve/reject/cancel/retry and `pending -> approved -> committed` authority ordering;
- duplicate/payload drift/reconnect identity and current-owner/policy/permission revalidation;
- real remote owner transfer/compensation/retry source tests;
- pending and approved-but-uncommitted Session cleanup;
- targeted Player terminal committed/rejected/cancelled outcomes with FIFO transient delivery;
- Campaign DM Library materialization/privacy/provenance work;
- comprehensive Codex audit deferred until implementation freeze.

## Findings in this execution

1. Canonical ration spec requires Party Stash ItemInstance -> ration conversion to atomically debit the Stash and credit `SupplyLedger` in one Campaign transaction.
2. Eligibility must be content/provider data. Item display names such as `food` or `ration` cannot be used as authority.
3. Existing `CampaignApplicationService.mutateCampaign` already supplies the correct single Campaign commit boundary plus `requestId` idempotency, so no second transaction/store should be created.
4. `InstalledCatalogEntryV1.capabilities` is preserved into runtime `CatalogEntry`, so the existing catalog capability channel is suitable for item eligibility metadata.
5. A production propagation gap remains: current `ItemInstanceVm` materialization and Party Stash template creation do not yet copy those catalog capabilities into the Stash template. Therefore the domain conversion implemented below is not yet user-reachable for ordinary catalog-derived items.

## Completed in this execution — ration conversion domain slice

Latest product/test write boundary: `8339b2a2617542b170d2554ba61eadd466ad222f`.

### Contracts and provider data

- `b5790e5c9201f2d6c336b1a2dc38b18660852e39` — `CampaignPartyStashItemTemplate` gained optional `capabilities:string[]`; Supply transaction summaries gained optional source item/definition/quantity/conversion-capability provenance fields. Existing schema version remains unchanged because these are optional backward-compatible fields.
- `ee9c76467febcac3671f7866e2e7e218b0636293` — added data-only ration `itemConversions?: Array<{requiredCapability:string;rationUnitsPerItem:number}>`.
- `1fd7e221015f29c1bdb8638d9418393bd8904314` — ration provider parser strictly validates `itemConversions`, unsupported fields, positive integer ratios, and duplicate capability rules.

### Atomic conversion core

- `62109736858acb34bd2321c0afca1bbacfc40f7c` — new `src/app/campaignRationConversion.ts`.
- Builtin `builtin.tracking-only` conversion rule is explicit data: `campaign.ration-source -> 1 ration/item`.
- Module profiles can supply different declared capability/ratio rules.
- Preview validates positive quantity, rations enabled, exact provider ID/version pin, exact Stash instance, available quantity, and declared item capability.
- Ambiguous multiple matching rules are rejected rather than chosen implicitly.
- Commit runs inside one existing `CampaignApplicationService.mutateCampaign` call:
  - exact Stash item quantity decremented or removed;
  - `partyStash.revision` incremented;
  - ration balance increased;
  - ration ledger revision incremented;
  - one `kind:"convert"` history record appended with participant/item/provider/capability provenance.
- Existing `mutateCampaign` `recentRequestIds` semantics make an identical committed request idempotent.
- No display-name heuristic and no new Party Stash/Character mutation path were introduced.

### Authored deterministic tests

- `8339b2a2617542b170d2554ba61eadd466ad222f` — new `tests/ui/campaignRationConversion.test.ts` covers:
  - atomic builtin success and all relevant revision/balance/quantity changes;
  - same-request retry without double conversion;
  - ineligible capability failure with unchanged Campaign state;
  - insufficient quantity failure with unchanged Campaign state;
  - module profile conversion ratio;
  - valid parser data plus duplicate/zero-ratio rejection.

These tests are source-authored only and have not executed in this environment.

## Validation status

**NO GREEN CLAIM.** Canonical branch workflow lookup returned no workflow runs. Exact-branch local execution could not start because the environment could not resolve GitHub:

`Could not resolve host: github.com`

Therefore no Node, npm, TypeScript, UI build, Tauri, Rust, or Windows two-instance result is claimed for the current product/test boundary. Static GitHub source inspection and authored tests are not executable evidence.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED / VALIDATION PENDING**, not DONE.

The new ration conversion work is **DOMAIN SLICE PARTIAL / RUNTIME-UI PENDING**.

The current domain contract has the required atomic/idempotent authority shape, but the production path is incomplete because:

- `sessionInventoryRuntimeAdapter.materializeItem()` does not yet project `CatalogEntry.capabilities` into Character item state;
- `SessionInventoryPane.stashTemplateFromItem()` and catalog fallback do not yet populate the Stash template capability snapshot;
- the conversion helper is not yet exposed through the existing Campaign runtime's same `CampaignApplicationService` context;
- no DM conversion preview/action is yet user-reachable;
- connected Campaign systems projection refresh for this mutation has not yet been proven;
- no executable TypeScript/test/build evidence exists.

Do not make ordinary items eligible by inspecting `name`, `nameEn`, description, tags that are not provider-authoritative, or regex/string heuristics.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve product/test source through `8339b2a2617542b170d2554ba61eadd466ad222f` unless GitHub advanced.
2. Prefer exact-head execution first if a runner exists; fix real failures before any green claim.
3. Otherwise propagate trusted catalog `capabilities` into the actual Character/Stash template path without relying on item names.
4. Expose the existing atomic ration conversion helper through the **same CampaignApplicationService/repository context** used by `campaignRuntimeAdapter`; do not instantiate a parallel Campaign repository.
5. Add DM-facing conversion preview/action with quantity, ratio, ration gain, and resulting balance before commit.
6. Use the existing connected Campaign systems broadcast/projection path for post-conversion refresh; do not invent another network asset path.
7. Add deterministic production-path tests for capability preservation, provider pin/eligibility/idempotency, DM preview/action, and connected refresh as applicable.
8. Re-audit remaining V1-13 Party Stash/DM Library items only after this source path is connected.
9. Keep Windows two-instance acceptance and comprehensive Codex audit for later release gates.
