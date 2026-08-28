# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T10:52:30+09:00`

## Durable checkpoint

Mandatory preflight was completed in the required order on `agent/resolver-foundation-convergence`:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain the routing/product-plan authorities. PLAN routing did not change and was not rewritten.

Repeated watcher invocations advanced GitHub concurrently during this dispatch. Parent and child branches were re-fetched before writes, completed exact-SHA evidence was reused, and stale file-SHA writes were not forced.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`; its previously recorded focused, Contract, Rules Domain, UI, Phase 11, Phase 12, and Windows evidence remains authoritative and was not repeated.

M0 remains `DONE`. Inventory authority is `docs/rules/legacy-execution-inventory.md`; the no-new-named-execution boundary remains in force. Do not reopen M0.

## M1 / Probe S — Fighter Action Surge

The first M1 probe remains bounded by `docs/rules/m1-action-surge-migration-packet.md`.

Behavior oracle remains `tests/domain/fighterActionSurge.test.ts`, with legacy execution in `src/domain/fighterActionSurge.ts` and `src/app/fighterActionSurgeRuntimeAdapter.ts`.

No new Resolver primitive or Gate F-M capability is justified. Existing generic Resolver/turn-economy semantics already provide resource spend/gain and `grant-extra-action { allowsMagicAction }`; the M1 work is Common Play / RulesProfile / RuleModule wiring.

## Concurrent child convergence reconciled

Bounded child branch:

`agent/m1-action-surge-common-play`

Latest observed child head at this checkpoint:

`2cf56f12778f533b03546df021afae5d5081e03d` — `test: enforce Common Play payment and effect separation`.

The child has converged away from the temporary mechanism-specific `commonPlayActionEconomyRuntime` implementation. Commit `343feac90f9129d0a3425bc38cc903a7eb9da6d8` removed that duplicate wrapper so the surviving execution lowerer is the generic `src/domain/commonPlayOperationRuntime.ts`.

Subsequent child commits observed and retained:

- `e85bf01ace93f2b557498098ddde75ac52e5b12a` — models M1 resource costs as Common Play `payments` rather than negative effect operations;
- `a6167c1019a2340f46c8e98c5f51b489b84bad15` — persists RulesProfile economy grant-bucket semantics;
- `5b5bc4179f36b3c4d84b204c2f07be8833f2e94a` — registers restricted-extra-action policy without Fighter/Action-Surge identity branching;
- `bca93a2cb6883e116cc910f6c8e47b630c2832e2` — wires the generic Common Play operation harness into CI;
- `ea642b696a02bf4bcbbca379b7cc5448ffb62181` — lowers Common Play resource payments atomically into the existing Resolver path;
- `2cf56f12778f533b03546df021afae5d5081e03d` — enforces payment/effect separation in the probe tests.

The generic runtime remains identity-independent: Common Play definition/entry-point IDs do not select the execution algorithm, economy semantics are profile-registered, and unsupported operations/buckets fail explicitly.

## Validation evidence retained

Earlier exact head `343feac90f9129d0a3425bc38cc903a7eb9da6d8`:

- Rules Domain run `33133953533`: SUCCESS;
- UI run `33133953506`: SUCCESS.

Latest exact child head `2cf56f12778f533b03546df021afae5d5081e03d`:

- Rules Domain run `33134121916`: SUCCESS.

That latest run includes both `tests/domain/commonPlayActionEconomyRuntime.test.ts` and `tests/domain/commonPlayResourceEconomyRuntime.test.ts`, so the generic lowerer, persisted JSON probe, payment/effect separation, atomicity, Action Surge golden parity, and unknown-ID/rename coverage are exercised together.

Do not repeat these exact-SHA Rules Domain runs. Because schema/profile/product files changed after `343feac...`, the next dispatch must read any already-produced Contract/UI/boundary conclusions for the latest product candidate before deciding whether more validation is needed; do not infer them from the older green SHA.

The latest Rules Domain run associates this child with PR #148. Re-fetch the live PR before relying on its state/head/base because concurrent watcher activity has been observed.

## Remaining authoritative gap

M1 is **not complete** and the named Fighter Action Surge execution seam is **not yet removable**.

The remaining material boundary is still end-to-end portable activation:

`RuleModule/content JSON -> structural validation -> normalization/Common Play IR -> installed portable content persistence/lookup -> generic production/session dispatch -> commonPlayOperationRuntime -> Resolver -> authoritative commit`

Prior repository inspection showed `src/app/ruleModulePackageImport.ts` rejects non-empty `content[].mechanics` and installed catalog entries do not yet retain executable Common Play mechanics. The current green child proves the generic operation/economy harness, not yet RuleModule import/persistence or production/session activation.

Do not activate Gate F-M for this: it is a wiring/persistence gap over already-supported Common Play semantics.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN;
2. re-fetch both `agent/resolver-foundation-convergence` and `agent/m1-action-surge-common-play` plus the live PR associated with the child;
3. read already-produced exact-head CI conclusions for the latest child before running anything new; retain the Rules Domain success on `2cf56f1...`;
4. re-read only the current `ruleModulePackageImport` / installed-content schemas, persistence model, and generic action-dispatch seams needed to capture the next deterministic red;
5. capture the red at the actual remaining boundary: supported Common Play mechanics in RuleModule/content JSON cannot yet survive import/installation and reach generic production/session execution;
6. implement the smallest data-only validation/normalization/persistence/lookup bridge that reuses `commonPlayOperationRuntime` and the existing Resolver; do not add a second evaluator or feature-specific runtime;
7. prove unknown external ID plus ID/name-only rename invariance through the installed production/session path and preserve atomic payments/effects/authority semantics;
8. only after the generic production/session route is authoritative and focused regressions are green may `fighterActionSurgeRuntimeAdapter.ts` / named execution symbols be removed and the M0 baseline shrink;
9. keep Gate F-M dormant unless a new deterministic migration failure proves a genuinely new reusable capability;
10. do not route product work to `main`.
