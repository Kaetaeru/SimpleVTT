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

The active implementation candidate is PR #171, `rules: migrate built-in Action Surge to generic Common Play`, from `agent/m1-action-surge-generic-production` into `agent/resolver-foundation-convergence`. The PR is open and mergeable. Its implementation is bounded to the Resource/Economy migration slice: built-in Common Play data/catalog projection, the existing generic Common Play production adapter, Action Surge parity coverage, named Action Surge adapter removal, legacy-boundary shrink, and the focused workflow.

A separate experimental branch, `agent/m1-action-surge-generic-parity`, was inspected and rejected as the integration candidate because its final `2040179c83e9ae047a9fb08627ccdb664a40ee01` commit mixed the Action Surge dispatch change with a large unrelated `productionPlayRuntimeAdapter.ts` rewrite. Do not revive or merge that broader diff while PR #171 remains the bounded candidate.

PR #171 exact-head history advanced during this checkpoint as CI exposed two narrow issues:

- candidate `4cc3b062fd31da8632af9634c56d3d3009eaaf33` passed the focused Common Play/Action Surge behavior harness 8/8, including two-resource spend, restricted extra Action semantics, Undo, connected convergence, arbitrary installed Common Play production coverage, and action/content/definition/display-name rename invariance;
- its M1 workflow then failed only because `./installedCommonPlayRuntimeAdapter` was not yet classified in the legacy execution baseline;
- commit `90a45e56de3ca1236ffb6e714999896b23b7914a` classified that generic production adapter as `GENERIC_ENGINE` while keeping the removed named Fighter Action Surge adapter out of the baseline;
- the same earlier candidate's Contract validation exposed a canonical module dependency typo (`dnd-srd-5.2.1.classes` instead of the live module id `dnd.srd-5.2.1.classes`);
- commit `8c9978a8d3a30bf08ab492cc8d805c2d77d63094` corrected that dependency identity.

At the end of this checkpoint, `8c9978a8d3a30bf08ab492cc8d805c2d77d63094` is the latest observed PR #171 head and its new exact-head workflows are queued. Do not treat the earlier `4cc3...` failures as current candidate failures, and do not manually repeat the already-passing focused 8-test harness unless a later diff touches its semantics.

Repository routing remains unchanged:

- Rerun control/state/plan owner branch: `agent/resolver-foundation-convergence`;
- product integration target: `work/v1-composite`;
- product work and Rerun control must not be routed to `main`.

## Waiting condition

No user decision or merge approval is requested yet. PR #171 exact-head CI is still in flight, so control remains `continue` for validation/fix continuation. This is not permission to merge a newly-created or materially-changed PR without a later Rerun approval adjudication.

## Next Exact Action

1. Perform the mandatory Rerun preflight and re-fetch both the convergence parent and PR #171 head because the child advanced concurrently during this checkpoint.
2. Continue from PR #171's latest exact head rather than any older candidate. Reuse the already-passing focused 8-test evidence unless the latest diff invalidates it.
3. Inspect only failing exact-head workflows. If a new failure exists, fix the narrow cause on the existing PR #171 branch; do not reopen completed Gates A-E, M0, PR #159, or PR #168 validation.
4. If all required exact-head workflows pass and the live PR remains bounded, mergeable, based on the convergence parent, and architecturally consistent, checkpoint the verified candidate and publish the protocol-defined merge-approval waiting state. Do not merge PR #171 in the same dispatch merely because it was created after that dispatch began.
5. After an approved merge, reconcile canonical Resource/Economy evidence to `MIGRATED`, shrink only the absorbed named execution boundary, and continue toward the next product-plan boundary. Eventual product integration remains `work/v1-composite`, never `main`.
