# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T10:38:10+09:00`

## Durable checkpoint

Mandatory preflight for this dispatch was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain the routing/product-plan authorities. PLAN routing did not change.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`; validated candidate `12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba` retains the previously recorded focused, Contract, Rules Domain, UI, Phase 11, Phase 12, and Windows evidence. Gate E validation was not repeated.

M0 remains `DONE`. Inventory authority is `docs/rules/legacy-execution-inventory.md`; freeze authority is the composition root `src/app/offlineRuntimeAdapters.ts`, `.agents/LEGACY_EXECUTION_BASELINE.json`, `scripts/check-legacy-execution-boundary.mjs`, `tests/ui/legacyExecutionBoundary.test.mjs`, and `.github/workflows/legacy-execution-boundary.yml`. No canonical offline composition entry remains `UNCLEAR`.

Retained M0 closure/hardening evidence includes:

- checklist transition `daf53c1adbeec43979ea1da6a9e1b0fb1c9f4118`, Legacy Execution Boundary run `33132952951`: SUCCESS;
- transitive-adapter hardening through exact head `0f22b912397f88d5fbbdc0043c62a0c68c615931`, Legacy Execution Boundary run `33133249139`, job `98727324296`: SUCCESS;
- later Rerun reconciliation continued M1 authorization without changing Gate E runtime behavior.

Do not reopen M0 or rerun unchanged Gate E validation.

## M1 first probe bounded — Fighter Action Surge

The smallest current action/resource/economy legacy probe selected from the inventory is Fighter Action Surge.

Existing golden oracle:

- `tests/domain/fighterActionSurge.test.ts`;
- legacy compiler/runtime: `src/domain/fighterActionSurge.ts`;
- legacy app seam: `src/app/fighterActionSurgeRuntimeAdapter.ts`.

Observed golden semantics that must survive generic migration:

- two atomic resource spends: the normal Action Surge pool and the same-turn gate;
- the normal Action remains available;
- one extra Action credit is granted with `allowsMagicAction:false`;
- a non-Magic action spends the restricted extra credit before the normal Action;
- Magic Action cannot consume that restricted credit;
- a second same-turn use rejects atomically;
- out-of-turn use rejects;
- turn start clears stale extra-action grants and recovers the turn gate.

The named domain compiler already lowers the effect to generic Resolver operations: two `spend-resource` operations plus `grant-extra-action { allowsMagicAction:false }`. This confirms the missing behavior is not an Action-Surge-specific resolver primitive.

## Concrete Common Play parity gap

Current persisted Common Play v0.2 has `resource.change` and `economy.modify`, but `economy.modify` persists only `bucket + amount`. `RulesProfileLike` currently has no registered economy-bucket semantics, and the existing Common Play runtimes do not provide a generic arbitrary-entry-point lowering from `resource.change/economy.modify` to the Resolver's `spend-resource/gain-resource/grant-extra-action` operations.

The generic Resolver already supports `grant-extra-action` with `allowsMagicAction:boolean`, and `turnEconomy.ts` already enforces the restricted-credit spend behavior. Therefore the migration failure is currently classified as a **schema/evaluator/profile-semantics parity gap inside the existing Common Play economy primitive**, not evidence for activating Gate F-M and not justification for a named Action Surge branch.

No new primitive or Gate F-M activation has been authorized or implemented.

## Bounded implementation branch

Created from parent head `0f22b912397f88d5fbbdc0043c62a0c68c615931`:

`agent/m1-action-surge-common-play`

No product/runtime/test commit has yet been added to that child branch. It exists to isolate the first M1 red->green parity slice from concurrent Rerun/M0 coordination commits on the parent.

## Next Exact Action

On the next continuation of this sequence:

1. perform mandatory preflight in exact order: README -> control -> STATE -> PLAN;
2. reconcile the live parent branch and `agent/m1-action-surge-common-play`; do not repeat the Action Surge/Common Play analysis above while the referenced files are unchanged;
3. on the child branch, add the first deterministic red RuleModule/Common Play fixture + focused domain test for an unknown external action that spends two resources and requests a profile-registered restricted extra-action economy bucket;
4. prove the red is specifically the missing generic Common Play economy lowering/profile semantics, not a named-content condition;
5. implement the smallest reusable generic lowering using the existing `resource.change`, `economy.modify`, and Resolver `grant-extra-action` semantics; do not add an Action Surge ID/name branch;
6. prove arbitrary external ID and ID/name-only rename invariance plus the relevant Action Surge golden state/economy parity before deleting any legacy code;
7. only after that generic path is authoritative and regressions are green should the named Action Surge compiler/app execution seam be removed in the same migration slice;
8. keep Gate F-M dormant unless this bounded red proves a genuinely new reusable capability beyond the existing Common Play economy primitive;
9. do not route product work to `main`.
