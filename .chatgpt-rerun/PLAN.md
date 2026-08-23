# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve all already source-connected V1-12/V1-13 durability, recovery, Campaign authority, DM Library materialization/privacy/provenance, Party Stash policy/approval/owner compensation flow, terminal Player outcome transport/FIFO UI, Session cleanup, and connected transfer tests. Do not repeat source-complete work or begin the comprehensive Codex audit before implementation freeze.

## Reconciled source boundary

This watcher execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, `docs/design/campaign-systems.md`, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md`.

The stale V1-13 selector/approval TODO wording in the handoff/checklist was not replayed. GitHub actual state and current Rerun STATE remain authoritative.

Before new product writes, `work/v1-composite` was exactly 15 commits ahead of prior base `d2c000e4530b375c6610ebc1bb1cb9663bbf1ff0`, matching the prior 12 Party Stash outcome source/test writes plus 3 coordination writes. Immediately before this checkpoint it was exactly 20 commits ahead, matching those 15 plus this execution's 5 ration-conversion source/test writes. No divergent concurrent writer was observed.

Latest product/test write boundary: `8339b2a2617542b170d2554ba61eadd466ad222f`.

## Completed in this execution — ration conversion domain slice

Canonical `campaign-systems.md` requires compatible Party Stash `ItemInstance` -> integer ration conversion where the Stash debit and SupplyLedger credit commit atomically, and eligibility comes from provider-declared capability/tag rather than display-name heuristics.

This execution implemented the domain/data portion:

- `b5790e5c9201f2d6c336b1a2dc38b18660852e39` — Campaign persistence contracts now preserve optional item capability snapshots and conversion provenance fields on Supply history.
- `ee9c76467febcac3671f7866e2e7e218b0636293` — ration profiles gained data-only `itemConversions[]` rules `{ requiredCapability, rationUnitsPerItem }`.
- `1fd7e221015f29c1bdb8638d9418393bd8904314` — provider parser strictly validates conversion fields, integer ratios, supported keys, and duplicate capabilities.
- `62109736858acb34bd2321c0afca1bbacfc40f7c` — added `campaignRationConversion.ts` with preview plus an authoritative conversion helper built on the existing `CampaignApplicationService.mutateCampaign` boundary. One commit decrements/removes the exact Stash instance, increments Stash revision, increments ration balance/ledger revision, and appends `kind:"convert"` provenance/history. Existing `requestId` handling provides idempotent retry behavior.
- Builtin `tracking-only` recognizes only declared `campaign.ration-source` capability at 1 ration unit/item. Module ration profiles may declare their own capability and integer ratio.
- `8339b2a2617542b170d2554ba61eadd466ad222f` — authored deterministic source tests for atomic success, same-request retry, ineligible item rejection, insufficient quantity rejection, module conversion ratio, and parser validation.

No item-name `food`/ration heuristic was introduced.

## Important production gap discovered

The domain helper is not yet a user-reachable production conversion path.

Current `sessionInventoryRuntimeAdapter.materializeItem()` does not project `CatalogEntry.capabilities` into `ItemInstanceVm`, and `SessionInventoryPane.stashTemplateFromItem()` / catalog fallback do not currently populate the new Stash template capability snapshot. Therefore ordinary catalog-derived Stash items do not yet carry eligibility metadata into the authoritative Stash state.

The conversion helper is also not yet exposed through the existing MockAdapter/Campaign runtime service context and no DM preview/action is wired yet. Do not call the ration conversion slice source-complete until these paths are connected and tested.

## Validation status

**NO GREEN CLAIM.** `fetch_commit_workflow_runs` returned no workflow runs for the canonical branch. Exact-branch local execution could not start because the environment still fails GitHub DNS resolution with `Could not resolve host: github.com`.

Therefore no Node test, TypeScript compile, npm regression, UI build, Tauri, Rust, or Windows two-instance result is claimed for this source. Authored tests and static GitHub reconciliation are not executable evidence.

## Remaining work

1. Preserve Party Stash approval/outcome work and ration domain commits through `8339b2a2617542b170d2554ba61eadd466ad222f`.
2. Propagate trusted `CatalogEntry.capabilities` into the actual item/Stash template path. Eligibility must derive from content data, never item names.
3. Expose ration conversion through the **same CampaignApplicationService/repository context** used by `campaignRuntimeAdapter`; do not instantiate a parallel Campaign store or second asset mutation path.
4. Add DM-facing preview/action showing source quantity, conversion ratio, ration gain, and resulting balance before commit.
5. Ensure connected Campaign projection refreshes after conversion using the existing Campaign systems projection/broadcast path rather than a new transport.
6. Add deterministic production-path tests covering catalog capability preservation, runtime API idempotency/provider pinning, UI eligibility/preview, and connected projection refresh where applicable.
7. If a runner becomes available, execute focused approval + ration conversion tests and TypeScript/build against one exact head before any green claim.
8. Re-audit remaining V1-13 Party Stash/DM Library requirements after this path is source-connected.
9. Windows two-instance acceptance and comprehensive Codex audit remain later release gates.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`.
2. Preserve all current source through product/test boundary `8339b2a2617542b170d2554ba61eadd466ad222f` unless GitHub advanced.
3. If executable exact-head validation becomes available, run it first and fix real failures.
4. Otherwise wire trusted catalog item capability metadata into `ItemInstanceVm` / Party Stash templates, then expose the existing atomic conversion helper through the current Campaign runtime service context.
5. Wire the DM conversion preview/action and deterministic production-path tests; then re-audit V1-13.
6. Keep comprehensive Codex audit deferred until implementation freeze.
