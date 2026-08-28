# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:01:55+09:00`

## Durable checkpoint

Mandatory preflight for this dispatch was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain the routing/product-plan authorities. PLAN routing did not change.

Repeated watcher invocations advanced GitHub concurrently during this dispatch. Stale assumptions were discarded and live refs were re-fetched before coordination writes. Gate E and M0 evidence were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054` with its previously recorded focused, Contract, Rules Domain, UI, Phase 11, Phase 12, and Windows evidence.

M0 remains `DONE`; `docs/rules/legacy-execution-inventory.md` and the no-new-named-execution boundary remain authoritative. Do not reopen M0.

## M1 / Probe S — retained green generic harness

The first M1 probe remains Fighter Action Surge, bounded by `docs/rules/m1-action-surge-migration-packet.md`. Fighter Action Surge remains only a golden oracle; no new Resolver primitive or Gate F-M capability is justified.

The validated generic candidate remains exact SHA:

`2cf56f12778f533b03546df021afae5d5081e03d`

Retained evidence on that exact SHA:

- Rules Domain run `33134121916`: SUCCESS;
- generic `src/domain/commonPlayOperationRuntime.ts` is the single operation lowerer;
- RulesProfile economy grant-bucket semantics are persisted;
- resource costs are Common Play payments and lower atomically into the existing Resolver;
- payment/effect separation, unknown external identity, ID/name rename invariance, restricted extra-Action semantics, and Action Surge golden parity are covered.

Do not repeat that exact-SHA Rules Domain run while those product files are unchanged.

## Live-ref reconciliation

The original bounded branch `agent/m1-action-surge-common-play` no longer points at the green candidate. It was moved to parent coordination history and its transient PRs are not authoritative evidence.

The validated product tree remains preserved at:

`agent/m1-action-surge-common-play-green` -> `2cf56f12778f533b03546df021afae5d5081e03d`

Current working parent at this checkpoint:

`6a31e7ffe635f970cef2a69c296c4544918f8bf0`

The green tree is not yet integrated into the parent. Do not advance to the RuleModule production gap as though it were already landed.

Superseded/conflicted M1 PRs remain non-authoritative and must not be revived: #144, #147, and zero-diff #148.

## Clean integration input fixed at hard-stop

This dispatch re-read the latest parent and exact green tree and fixed the smallest clean-integration boundary before the 20-minute hard stop.

A clean integration branch already exists from the exact current parent and is still untouched:

`agent/m1-common-play-harness-integration-r4-20260828` -> `6a31e7ffe635f970cef2a69c296c4544918f8bf0`

Use that branch rather than creating another duplicate integration branch.

The parent currently contains the temporary mechanism-specific evaluator:

- `src/domain/commonPlayActionEconomyRuntime.ts` blob `a1f239b94bbb94da6d7f06955edc4b1bd811af65` — DELETE in the clean integration.

The exact green candidate intentionally has no file at that path and uses the single generic lowerer:

- `src/domain/commonPlayOperationRuntime.ts` blob `2e08d8e380b92bf7035512d9ef8a38280d003396`.

Exact green semantics/blobs already inspected and safe to transplant onto the integration branch:

- `src/domain/profileEngine.ts` blob `15abcfaaa532e19ab4863ec1b306665d407ce774` — `RulesProfileLike.economy.grantBuckets`;
- `schemas/rules-profile.schema.json` blob `818df91aa2960d8ded0ebc562c8dca70d3c6b3e9` — persisted `economy.grantBuckets` / `economyGrantBucket` schema parity;
- `rules/profiles/dnd.srd-5.2.1.profile.json` blob `32d8b73009526ce4970a2f05159a7fe08ffabe13` — registered `action.extra.non-magic` policy;
- `tests/domain/commonPlayActionEconomyRuntime.test.ts` blob `0788b96807476e1f19605eb682403797b4943df4` — generic lowerer parity/identity/rollback/profile-policy coverage despite the historical filename;
- `tests/domain/commonPlayResourceEconomyRuntime.test.ts` blob `aa013521a41377853183e2a9415fb6d6db42fe85` — persisted payment/effect separation and atomicity coverage;
- `tests/fixtures/play-contract/resource-economy-action.json` blob `cc9a4a74fff422165015140402b62d1e2edb1704` — canonical persisted probe using `payments` plus `economy.modify`;
- `.github/workflows/rules-domain.yml` blob `a827825ac3b716f5fd4b7c1e14e43b774082db91` — includes both generic M1 domain tests;
- `.github/workflows/m1-common-play-resource-economy.yml` blob `fd13aad9c9b8385456aaef8cb9779b8dc1762fdb` — focused M1 validation.

Do not transplant the obsolete negative-effect duplicate fixture `tests/fixtures/play-contract/action-economy-restricted-extra-action.json`; the retained `resource-economy-action.json` owns the payment/effect model. Delete the parent duplicate `tests/fixtures/play-contract/action-resource-economy.json` when creating the clean integration tree.

The exact green `commonPlayOperationRuntime.ts` lowers supported Common Play `payments` and `resource.change` / `economy.modify` into existing Resolver operations without Fighter/Action-Surge identity branches. The parent temporary evaluator must not survive beside it.

## Remaining authoritative gap

M1 is not complete. The named Fighter Action Surge execution seam is not removable yet.

First integrate the clean generic harness above and verify the resulting tree. Only after that merge is the next product boundary:

`RuleModule/content JSON -> structural validation -> normalization/Common Play IR -> installed portable content persistence/lookup -> generic production/session dispatch -> commonPlayOperationRuntime -> Resolver -> authoritative commit`

Repository evidence already retained for the later bridge:

- `src/app/ruleModulePackageImport.ts` explicitly rejects non-empty `content[].mechanics`;
- `InstalledCatalogEntryV1` does not yet retain executable Common Play mechanics;
- installed-content persistence/session sync already serializes whole installed entries, so the next bridge should remain data-only and reuse that path rather than add another transport/evaluator;
- existing `tests/ui/ruleModulePackageImport.test.ts` has a blocking unsupported-mechanics case that can become the deterministic red boundary while continuing to reject arbitrary custom mechanics.

Gate F-M remain dormant.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN;
2. re-fetch parent and `agent/m1-common-play-harness-integration-r4-20260828`; if the integration branch still equals the recorded parent, use it rather than creating a new branch;
3. build one atomic integration commit/tree from the exact green blobs listed above, delete `src/domain/commonPlayActionEconomyRuntime.ts` and `tests/fixtures/play-contract/action-resource-economy.json`, and do not add the obsolete negative-effect duplicate fixture;
4. verify the resulting integration tree with focused M1 + Contract first, then Rules Domain and Legacy Execution Boundary; reuse `33134121916` only for files that remain byte-equivalent to exact green candidate `2cf56f1...`;
5. open one mergeable PR against `agent/resolver-foundation-convergence`; do not revive #144/#147/#148;
6. once the clean generic harness is actually integrated, capture the deterministic RuleModule/content mechanics import/persistence/production-dispatch red and implement the smallest data-only bridge reusing `commonPlayOperationRuntime` and the Resolver;
7. do not delete the named Fighter Action Surge seam until end-to-end production parity is authoritative;
8. do not activate Gate F-M, reopen M0, repeat unchanged Gate E validation, or route product work to `main`.
