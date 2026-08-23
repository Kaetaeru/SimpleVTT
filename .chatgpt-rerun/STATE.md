# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T12:34:00+09:00`

## Preflight reconciliation

This execution read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order, then reconciled `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, and the relevant Campaign/ration/transfer design contracts.

At dispatch start `work/v1-composite` was identical to prior coordination head `e64d9d8ece4644f783c95f14007d3d06f574f8a7`. Run identity remained valid: same run_id, `sequence=1`, task, and `status=continue`. The handoff/checklist selector/approval TODO prose is stale relative to actual GitHub source and was not replayed.

Immediately before coordination writes the branch was exactly 14 commits ahead of `e64d9d8...`, all from this execution's ration conversion production/runtime/UI/test work. No divergent concurrent writer was observed.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest normal durable-storage source path / validation pending;
- Player-owned Character durability and Host/owner recovery/compensation;
- Campaign-authoritative Party Stash and existing durable transfer transaction;
- all three Stash policies, Player approval request, DM approve/reject/cancel/retry, authority ordering, duplicate/reconnect/current-owner/policy/permission revalidation;
- real remote owner transfer and compensation/retry tests;
- pending/approved Session cleanup;
- targeted Player committed/rejected/cancelled FIFO outcome delivery;
- Campaign DM Library materialization/privacy/provenance work;
- prior ration-conversion domain/data slice through `8339b2a2617542b170d2554ba61eadd466ad222f`;
- comprehensive Codex audit deferred until implementation freeze.

## Completed in this execution — ration conversion production connection

Latest product/test boundary: `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11`.

### Trusted Host capability authority

- `7f3528fd6a8095f4994de222d1e0b5e4999670d9` added `campaignPartyStashCapabilityRuntimeAdapter.ts`.
- Character -> Stash item capability metadata is normalized against the current Host/adapter Catalog by exact item definition identity. A unique matching Catalog item is required; missing/ambiguous matches produce no trusted capability.
- Player-supplied capability claims are replaced and cannot make an item ration-compatible.
- Both regular `transferPartyStash` and connected Host `commitConnectedPartyStashDeposit` pass through this normalization.
- `2dbef2844111bdb0bf4b4238aeceb0c3de657400` exposed the trusted resolver for conversion-time revalidation.

### Existing Campaign service and connected projection reused

- `3bdac7d71d286914f640e85d9e4a4ab38b9366b0` added `campaignRationConversionRuntimeAdapter.ts`.
- `aa6d99d469115f3c77f9aa1518aa8773ade0c89a` composes it after `campaignRuntimeAdapter` and the trusted Stash capability adapter.
- No parallel `CampaignLibraryRepository` is created. A private runtime payload travels through existing `MockAdapter.adjustCampaignRations`, and the same existing `CampaignApplicationService` instance delegates that special case into `convertPartyStashItemToRations`.
- Ordinary ration adjustments still delegate to the prior `adjustRations` behavior.
- Connected Campaign systems already wraps `adjustCampaignRations` with `broadcastAfter`; conversion therefore reuses the established projection/broadcast path and does not add a new network mutation route.
- `97992eb2ce5caab3e88135fa7bb9e4cf859100df` rejects Client preview/commit and revalidates provider ID/version before module profile resolution.
- `9afea500ab5f198df821fab7bdef8d289440696c` + `278922f668bf49d34deed8c1f2b8a2785ed46e26` make preview/commit re-resolve trusted item capabilities from the current Host Catalog. Stored Stash capability snapshots are not final authority.

This solves pre-feature Stash compatibility without a migration write: a legacy Stash item with no template/capabilities can still convert if its current unique Catalog definition declares the required capability. Missing/ambiguous definitions are rejected.

### DM user path

- `397f3d56af38d070723751086624d6d95b44b2f4` added `CampaignRationConversionPanel.tsx`.
- `762f3cae6433180151d5824689830d95018e37c4` mounts it on the Campaign dashboard.
- DM selects exact Stash item and quantity, obtains authoritative preview, sees item quantity before/after, integer ratio, ration gain, resulting balance, and pinned provider ID/version, then explicitly commits.
- UI states that name/description heuristics are not used.

### Authored source tests

- `9753335f744dc1bb37361f346af21c0f68f92375` — production runtime Host Catalog normalization, forged capability removal, preview/commit, idempotent retry.
- `dee3aff7aefc8fb3e16a20c12d676c8883f47ba1` — stale provider pin rejects before mutation and Campaign remains unchanged.
- `9d330333601a34e796c9a50dd57e05f04f4abc3d` / `cf32bcd32af719e4906d8b0e741631667f96cfc9` — production composition/authority/connected broadcast/UI structure contracts.
- `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11` — legacy Stash item lacking itemTemplate/capability snapshot is validated from trusted Catalog and converts successfully.

## Validation status

**NO GREEN CLAIM.** Latest product/test boundary `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11` has no combined GitHub statuses and no commit-associated workflow runs. Local exact-head execution still cannot start because this environment cannot resolve GitHub:

`Could not resolve host: github.com`

Therefore no Node, npm, TypeScript, build, Tauri/Rust, or Windows two-instance result is claimed. Static/source-authored tests are not executable evidence.

## Current V1-13 assessment

V1-13 remains **SOURCE-CONNECTED / VALIDATION PENDING**, not DONE.

The canonical compatible Party Stash ItemInstance -> ration transaction is now source-connected across:

- provider-declared capability/ratio contract;
- atomic/idempotent Campaign domain mutation;
- Host-trusted catalog eligibility;
- legacy Stash revalidation without migration;
- exact provider pinning;
- DM preview/explicit commit;
- reuse of existing connected Campaign systems broadcast;
- authored deterministic domain/runtime/structure tests.

Do not claim executable success until focused tests and TypeScript/build actually run.

## Selective V1-13 re-audit findings

1. A bundled out-of-box item declaring `campaign.ration-source` is not yet confirmed. The inspected SRD adventuring-core, starting-utility, and pack module files do not contain such a ration declaration. Do not infer it from names.
2. The next clear source gap is Campaign DM Library **PC preset + folder organization**. The persistence kind union includes `pc-preset`, but current `CampaignSystemsPanel` Library editor exposes only `custom-item | image | npc-definition`; folder data/UI is absent.
3. Existing tags/favorites/recents/search, custom item/image/NPC workflows, namespace isolation, private connected projection, materialization provenance, and definition-delete preservation should be retained rather than replayed.

## Next Exact Action

1. Re-read README -> control -> STATE -> PLAN and reconcile actual `work/v1-composite`; preserve source through product/test boundary `ff15e0b63667f6c14ea8979a1cbd183fb7ab7d11` unless GitHub advanced.
2. Prefer exact-head execution first if a runner becomes available: run ration domain/runtime/structure/legacy tests, approval tests, and TypeScript/build; fix actual failures before any green claim.
3. If execution remains unavailable, inspect canonical content-generation/module contracts to determine whether V1 should ship an explicit bundled ration-compatible item capability. Add it only as authoritative content data, never by name inference.
4. Then implement the next clear V1-13 source slice: DM Library PC preset + folder data/runtime/UI/tests, preserving Campaign namespace/privacy boundaries.
5. Re-audit remaining V1-13 quick actions/source distinction after that slice.
6. Keep Windows two-instance acceptance and comprehensive Codex audit for later release gates.
