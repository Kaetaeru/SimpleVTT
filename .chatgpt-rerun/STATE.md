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

Resource/Economy is now `MIGRATED` on the convergence parent. Do not promote it to `ACCEPTED` without explicit remaining universal acceptance evidence, and do not repeat already-valid Resource/Economy validation without an affected-surface reason.

PR #171, `rules: migrate built-in Action Surge to generic Common Play`, was merged into `agent/resolver-foundation-convergence` as `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f` from validated exact head `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`.

Reusable evidence for that migration:

- focused Common Play / Action Surge behavior harness passed 8/8 on the candidate lineage, covering two-resource spend, restricted extra Action semantics, authoritative writeback/Undo, connected convergence, arbitrary installed Common Play production coverage, and action/content/definition/display-name rename invariance;
- Contract validation `33174441211` — `SUCCESS`;
- M1 Common Play Resource Economy `33174441198` — `SUCCESS`;
- Persistence `33174441162` — `SUCCESS`;
- Rules Domain `33174441191` — `SUCCESS`;
- UI `33174441234` — `SUCCESS`;
- Phase 12 Connected Session `33174441183` — `SUCCESS`, including Windows connected-playable;
- Phase 11 Playable `33174441152` — `SUCCESS`, including Windows playable;
- `src/app/fighterActionSurgeRuntimeAdapter.ts` is absent after the merge;
- `.agents/LEGACY_EXECUTION_BASELINE.json` no longer contains the removed Fighter Action Surge adapter;
- the canonical product checklist, current docs, roadmap, and legacy inventory have been reconciled to the merged `MIGRATED` boundary.

The rejected `agent/m1-action-surge-generic-parity` experiment remains rejected as an integration candidate and must not be revived merely because the bounded migration is complete.

Repository routing remains unchanged: Rerun state/control belongs on `agent/resolver-foundation-convergence`, product integration target remains `work/v1-composite`, and product work must not be routed to `main`.

## Waiting condition

None. The Action Surge merge gate is complete and there is no current external blocker. Control remains `continue` so the product plan may advance by mechanism family.

## Next Exact Action

1. Perform mandatory preflight and read the current canonical product-plan maturity board plus `docs/rules/legacy-execution-inventory.md`; reuse Gate A-E, M0, PR #159, PR #168, and PR #171 evidence unless new affected-surface evidence invalidates it.
2. Select the next smallest coherent Phase 2 mechanism-family slice from the product plan and current legacy debt. Do not select work by class/spell/feat name order.
3. Inspect only the source, behavior oracles, authority/lifetime boundaries, and existing generic primitives needed for that slice. Attempt existing Common Play composition before proposing a new primitive or activating Gates F-M.
4. Freeze a bounded behavior/acceptance contract before repository-dependent implementation. Use Codex for implementation once the contract is sufficiently fixed; return to architecture review if named-content branching, a speculative primitive, ambiguous authority/lifetime, or a conflicting contract appears necessary.
5. Eventual product integration remains `work/v1-composite`, never `main`.
