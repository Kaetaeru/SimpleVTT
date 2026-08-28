# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:04:41+09:00`

## Durable checkpoint

Mandatory preflight was repeatedly reconciled in the required order on the live Rerun parent because concurrent watcher activity advanced GitHub during this dispatch:

1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. PLAN routing did not change. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain authoritative. Gate E and M0 evidence were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054` with its previously recorded validation.

M0 remains `DONE`; `docs/rules/legacy-execution-inventory.md` and the no-new-named-execution boundary remain authoritative. Do not reopen M0.

## M1 / Probe S — Fighter Action Surge generic harness

The validated generic source candidate remains exact SHA:

`2cf56f12778f533b03546df021afae5d5081e03d`

Retained exact-SHA evidence:

- Rules Domain run `33134121916`: SUCCESS;
- one generic `src/domain/commonPlayOperationRuntime.ts` lowerer;
- resource costs represented as Common Play payments and committed atomically through the existing Resolver;
- RulesProfile-persisted generic economy grant bucket;
- payment/effect separation, unknown external identity, ID/name rename invariance, restricted extra-Action semantics, and Action Surge golden parity.

Do not repeat this exact-SHA evidence while byte-equivalent files are unchanged.

## Clean integration branch now contains the harness

The repository-authoritative clean integration branch from the previous checkpoint is:

`agent/m1-common-play-harness-integration-r4-20260828`

It has advanced to:

`1178f3edea577c50f3035158401731f653249a46` — `rules: integrate generic Common Play operation harness`

Its tree is the intended clean harness tree. It removes the parent temporary `src/domain/commonPlayActionEconomyRuntime.ts`, installs the single generic `src/domain/commonPlayOperationRuntime.ts`, carries the persisted RulesProfile economy policy and Common Play payment/effect fixtures/tests, and does not retain the obsolete negative-effect duplicate fixture.

The r4 exact-head workflows are already registered and must be read rather than duplicated:

- Contract validation run `33134686605` — queued at checkpoint;
- Rules Domain run `33134686671` — queued;
- M1 Common Play Resource Economy run `33134686717` — queued;
- UI run `33134686655` — in progress;
- Phase 11 Playable run `33134686667` — queued;
- Phase 12 Connected Session run `33134686691` — queued;
- Persistence run `33134686676` — queued.

A separate exploratory integration PR #151 was opened on the same intended product tree while concurrent parent coordination was moving. The latest STATE subsequently fixed r4 as the authoritative integration path. PR #151 became duplicate/non-authoritative and was closed unmerged as superseded. Do not revive it.

## Live parent reconciliation

Current parent observed immediately before this checkpoint:

`98b1be2e53cd04724d63d66c96ec0fb0b6f14ad9` — `rerun: continue from fixed clean harness integration inputs`

The r4 product commit was created from earlier parent `6a31e7ffe635f970cef2a69c296c4544918f8bf0`; the parent has since advanced through Rerun coordination. Do not force-update either branch. Before opening the final integration PR, reconcile only the latest coordination ancestry while preserving the r4 product tree, then confirm the PR diff contains only the intended harness changes and no stale `.chatgpt-rerun` rollback.

## Remaining authoritative product gap

M1 is not complete and the named Fighter Action Surge execution seam is not removable yet.

After the clean harness is integrated, the next deterministic red boundary remains:

`RuleModule/content JSON -> structural validation -> normalization/Common Play IR -> installed portable content persistence/lookup -> generic production/session dispatch -> commonPlayOperationRuntime -> Resolver -> authoritative commit`

Current repository evidence already confirms:

- `src/app/ruleModulePackageImport.ts` rejects non-empty `content[].mechanics` with `mechanics cannot be activated by the generic Catalog yet`;
- `InstalledCatalogEntryV1` has no executable Common Play mechanics field;
- installed-content persistence/session synchronization already serializes whole installed entries and should be reused rather than adding another transport/evaluator;
- arbitrary/custom executable mechanics must remain rejected;
- Gate F-M are not justified by this wiring/persistence gap.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN;
2. re-fetch parent and `agent/m1-common-play-harness-integration-r4-20260828`;
3. read the already-running exact-head CI conclusions for `1178f3edea577c50f3035158401731f653249a46`; do not rerun them;
4. if the clean harness checks are acceptable, reconcile the r4 branch onto the latest parent through coordination-only ancestry while preserving its product tree, then confirm no `.chatgpt-rerun` rollback appears in the product PR diff;
5. open one mergeable PR from r4 against `agent/resolver-foundation-convergence`; do not revive superseded #144/#147/#148/#151;
6. after the clean harness is actually integrated, capture the deterministic RuleModule mechanics import/persistence/production-dispatch red and implement the smallest data-only bridge reusing `commonPlayOperationRuntime` and the existing Resolver;
7. only after end-to-end installed production/session parity is authoritative may the named Fighter Action Surge adapter/compiler be removed and the M0 baseline shrink;
8. do not activate Gate F-M, reopen M0, repeat unchanged Gate E validation, or route product work to `main`.
