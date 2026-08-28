# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T10:47:17+09:00`

## Durable checkpoint

Mandatory preflight was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain the routing/product-plan authorities. PLAN routing did not change and was not rewritten.

Because repeated watcher invocations advanced GitHub concurrently during this dispatch, the working branch and the bounded child branch were re-fetched repeatedly before making this checkpoint. Completed work was reused rather than repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`; validated candidate `12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba` retains the previously recorded focused, Contract, Rules Domain, UI, Phase 11, Phase 12, and Windows evidence. Gate E validation was not repeated.

M0 remains `DONE`. Inventory authority is `docs/rules/legacy-execution-inventory.md`; freeze authority is `src/app/offlineRuntimeAdapters.ts`, `.agents/LEGACY_EXECUTION_BASELINE.json`, `scripts/check-legacy-execution-boundary.mjs`, `tests/ui/legacyExecutionBoundary.test.mjs`, and `.github/workflows/legacy-execution-boundary.yml`. No canonical offline composition entry remains `UNCLEAR`.

Retained M0 evidence includes checklist transition `daf53c1adbeec43979ea1da6a9e1b0fb1c9f4118`, Legacy Execution Boundary run `33132952951`, and transitive-adapter hardening through exact head `0f22b912397f88d5fbbdc0043c62a0c68c615931` with run `33133249139`, job `98727324296`, all SUCCESS. Do not reopen M0 or repeat unchanged Gate E validation.

## M1 first probe — Fighter Action Surge

The first M1 / Probe S slice remains Fighter Action Surge, bounded by:

`docs/rules/m1-action-surge-migration-packet.md`

Existing behavior oracle remains `tests/domain/fighterActionSurge.test.ts`, with legacy execution in `src/domain/fighterActionSurge.ts` and `src/app/fighterActionSurgeRuntimeAdapter.ts`.

The bounded conclusion remains that no new Resolver primitive or Gate F-M capability is justified. The named compiler already lowers the mechanic to generic resource spends plus `grant-extra-action { allowsMagicAction:false }`; the missing work is Common Play / RulesProfile / RuleModule wiring.

## Concurrent M1 progress reconciled

During this dispatch the parent branch advanced from the previous M1 checkpoint to product/test commits before the watcher could checkpoint them. Current observed parent product candidate before this STATE write was:

`40a10a0d87e70c73636e5a4d88669a81c91db3c0`

Observed parent changes leading to that candidate include:

- `f82a1eaf055538498bf85c46ad33c3b9784caebe` — adds a generic `RulesProfileLike.actionEconomy.buckets` registry with typed extra-action policy (`allowsMagicAction`, optional `activeTurnOnly`);
- `cffafd0b725bd59046d4c2181039f70d6162a1fd` — adds `src/domain/commonPlayActionEconomyRuntime.ts`, lowering literal `resource.change` and registered `economy.modify` operations to existing generic Resolver operations without Fighter/Action-Surge identity branches;
- `3940e068ab705f23fc1f9567a4e9756cb18d0a92` — adds persisted unknown-ID Common Play fixture `tests/fixtures/play-contract/action-resource-economy.json`;
- `40a10a0d87e70c73636e5a4d88669a81c91db3c0` — drives the action/economy domain test from that persisted fixture.

The focused domain test covers unknown external identity, ID/entry-point rename invariance, atomic rollback, explicit unregistered-bucket failure, active-turn policy, and state/economy parity against the existing Action Surge golden behavior. The named production adapter/compiler have not been deleted.

Exact parent evidence read rather than repeated:

- Rules Domain run `33133833124` on exact head `40a10a0d87e70c73636e5a4d88669a81c91db3c0`: `SUCCESS`;
- Legacy Execution Boundary run `33133833183` on the same head: `SUCCESS`.

This proves the persisted Common Play IR/lowering slice is green. It does **not** prove M1 complete or make the generic path authoritative for production/session activation.

## Remaining RuleModule / production gap

Repository inspection confirmed `src/app/ruleModulePackageImport.ts` still rejects non-empty `content[].mechanics` with `mechanics cannot be activated by the generic Catalog yet`. `InstalledCatalogEntryV1` also does not yet persist executable Common Play mechanics. Therefore the current persisted fixture is Common Play IR, not yet an end-to-end RuleModule/content JSON -> validation/normalization -> installed portable content -> production/session execution route.

M1 is not complete and Action Surge legacy deletion is not authorized yet.

## Child-branch reconciliation required

The bounded child branch created for this slice has also advanced concurrently:

`agent/m1-action-surge-common-play`

Latest observed child head before this checkpoint:

`343feac90f9129d0a3425bc38cc903a7eb9da6d8` — `refactor: keep one Common Play operation lowerer`.

The parent and child therefore both contain M1 work. Do not blindly continue editing either side or duplicate already-landed lowering/tests. The next execution must first compare the parent and child product diffs, retain the smallest non-duplicated generic implementation, and preserve already-green evidence where the resulting product files are unchanged.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN;
2. re-fetch both `agent/resolver-foundation-convergence` and `agent/m1-action-surge-common-play` because concurrent watcher activity has been observed;
3. compare the parent M1 candidate with child head `343feac90f9129d0a3425bc38cc903a7eb9da6d8`; do not repeat the already-green Common Play action/economy analysis or tests if the same product files/content are retained;
4. choose one canonical minimal generic lowering implementation and eliminate duplicate/parallel implementations before any further product expansion;
5. capture the next deterministic red at the actual remaining boundary: a RuleModule/content JSON entry carrying supported Common Play mechanics currently cannot survive `ruleModulePackageImport` / installed-content persistence into execution;
6. implement the smallest data-only RuleModule -> validated/normalized Common Play persistence/lookup bridge needed for this probe, without arbitrary executable code, content-name branches, or a second evaluator;
7. route that installed definition through the same generic lowering/Resolver path and prove external ID plus ID/name-only rename invariance and relevant authority/lifetime parity;
8. only after the generic production/session activation path is authoritative and focused regressions are green may the named Fighter Action Surge execution seam be removed and the M0 baseline shrink;
9. keep Gate F-M dormant unless a new deterministic failure proves a genuinely new reusable capability beyond existing Common Play semantics;
10. do not route product work to `main`.
