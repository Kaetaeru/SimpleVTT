# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `4`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/resolver-execution-checklist-v2.md`
- human current-work entrypoint: `docs/CURRENT.md`
- checkpointed_at: `2026-08-28 Asia/Seoul`

## Durable checkpoint

Resource/Economy remains `PRODUCTION` on the convergence parent. PR #168 and its already-validated evidence remain reusable and must not be repeated without affected-surface evidence.

The active bounded implementation candidate is PR #171, `rules: migrate built-in Action Surge to generic Common Play`, from `agent/m1-action-surge-generic-production` into `agent/resolver-foundation-convergence`. The separate `agent/m1-action-surge-generic-parity` experiment is rejected as an integration candidate because it accumulated unrelated `productionPlayRuntimeAdapter.ts` rewrite scope; do not revive or merge that broader diff while PR #171 remains the bounded candidate.

PR #171 latest observed exact head remains `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`. The implementation is bounded to built-in Common Play data/catalog projection, the existing generic Common Play production adapter, Action Surge parity coverage, named Action Surge adapter deletion, the legacy baseline, and the focused workflow.

Already-valid evidence on this candidate lineage:

- earlier candidate `4cc3b062fd31da8632af9634c56d3d3009eaaf33` passed the focused Common Play/Action Surge behavior harness 8/8, including two-resource spend, restricted extra Action semantics, authoritative writeback/Undo, connected convergence, arbitrary installed Common Play production coverage, and action/content/definition/display-name rename invariance;
- commit `90a45e56de3ca1236ffb6e714999896b23b7914a` corrected the only focused-workflow coordination failure by classifying `./installedCommonPlayRuntimeAdapter` as `GENERIC_ENGINE` while keeping the removed named Fighter Action Surge adapter out of the baseline;
- commit `8c9978a8d3a30bf08ab492cc8d805c2d77d63094` corrected the canonical class-module dependency identity exposed by Contract validation;
- exact-head Contract validation run `33174441211` is `SUCCESS`;
- exact-head M1 Common Play Resource Economy run `33174441198` is `SUCCESS`;
- exact-head Persistence run `33174441162` is `SUCCESS`;
- exact-head Rules Domain run `33174441191` is `SUCCESS`;
- exact-head UI run `33174441234` is `SUCCESS`;
- exact-head Phase 12 Connected Session run `33174441183` has a `SUCCESS` connected-protocol job; its Windows connected-playable job remains in progress, with no observed failure at this checkpoint;
- exact-head Phase 11 Playable run `33174441152` remains queued, with no observed failure.

No current exact-head workflow failure is known. Older intermediate-head failures are not current candidate failures. Do not manually repeat the already-passing focused harness or successful exact-head workflows unless a later product diff invalidates them.

Repository routing remains unchanged: Rerun state/control belongs on `agent/resolver-foundation-convergence`, product integration target remains `work/v1-composite`, and product work must not be routed to `main`.

## Waiting condition

None yet. PR #171 remains open while exact-head CI is still in flight. Control remains `continue` for autonomous exact-head validation/fix continuation. GitHub mergeability was still being recomputed against the advanced convergence parent at the latest observation; do not interpret an `unknown` mergeability result as a conflict. Do not publish merge approval or mark Resource/Economy `MIGRATED` before a stable green candidate is verified and the protocol-defined approval state is reached.

## Next Exact Action

1. Mandatory-preflight and re-fetch the convergence parent plus PR #171 live head before acting; if the head remains `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`, reuse the evidence above.
2. Inspect only the remaining exact-head Phase 12 Windows connected-playable job and Phase 11 Playable run. If there is no failure, do not rerun or redesign still-valid Gate A-E, M0, PR #159, PR #168, the focused 8-test harness, or the exact-head workflows already marked `SUCCESS` above.
3. If a current failure appears, fix only its narrow affected cause on the existing PR #171 branch.
4. When all required exact-head workflows are green, re-evaluate PR #171 mergeability/ancestry against the current convergence parent. If it remains bounded and architecturally consistent, checkpoint that exact candidate and publish the protocol-defined merge-approval waiting state. Do not merge PR #171 in this dispatch because it was not the named approval-wait candidate at dispatch preflight.
5. After an approved merge, reconcile canonical Resource/Economy evidence to `MIGRATED`, update the legacy inventory for the absorbed Action Surge execution path, and continue the product plan. Eventual integration remains `work/v1-composite`, never `main`.
