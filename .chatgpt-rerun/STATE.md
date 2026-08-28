# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
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

The Resolver convergence run remains authorized at sequence 2. PR #159 is already integrated and the canonical checklist records Resource/Economy at `PORTABLE`; Gate A-E and M0 evidence remain valid and must not be repeated without new affected-surface evidence.

Repository cleanup was completed without changing product source, tests, schemas, machine-readable rules/content, the architecture charter, checklist v2, or Rerun PLAN identity:

- cleanup PR #169 exact head `68ab81fb2ade7b5b11800381f8d6cc6fd5d2c647` passed Contract validation, Persistence, Phase 11 Playable, and Phase 12 Connected Session;
- PR #169 merged into `agent/resolver-foundation-convergence` as `70bc9d1a27db6f418d7485baadd15da104b58784`;
- repository reading order is now `README.md -> docs/CURRENT.md -> docs/architecture/README.md -> docs/roadmap/CURRENT.md`;
- historical `.agents` planning/checkpoint material is preserved losslessly under `docs/archive/agent-workspace-2026-08-28/`;
- live `.agents/` contains only its routing README plus the two exact-path machine baselines required by structural gates;
- superseded Resolver packets/checklist are under `docs/archive/rules/`;
- old stacked Phase checkpoint PRs through Phase 12 and the parked Phase 14 mega-PR were closed without deleting branches, commits, comments, or history.

After cleanup, the only open product PR is #168, `rules: dispatch installed Common Play through production authority`.

## PR #168 — current product candidate

- child branch: `agent/m1-installed-common-play-production`;
- exact observed child head: `5e8f75dd9c5bafafa2b23ffcac5c7ffd7deabd80`;
- current parent after cleanup: `70bc9d1a27db6f418d7485baadd15da104b58784` before this Rerun checkpoint write;
- current compare is diverged only because the parent gained the repository-cleanup lineage; the child-side delta remains exactly seven files:
  - `.github/workflows/m1-common-play-resource-economy.yml`
  - `src/app/fighterActionSurgeRuntimeAdapter.ts`
  - `src/app/installedCommonPlayActionReference.ts`
  - `src/app/installedCommonPlayRuntimeAdapter.ts`
  - `src/app/offlineRuntimeAdapters.ts`
  - `src/app/runtimeResolutionCommit.ts`
  - `tests/ui/installedCommonPlayProductionRuntime.test.ts`
- exact-head triggered workflows on `5e8f75dd...` are all SUCCESS: M1 Common Play Resource Economy, UI, Contract validation, Phase 11 Playable, and Phase 12 Connected Session.

The repository cleanup does not authorize deleting the named Fighter Action Surge seam or treating #168 as accepted without the checklist's production/parity evidence. It remains the behavior oracle until generic end-to-end parity and arbitrary-ID invariance are established.

## Next Exact Action

1. On the next product dispatch, perform the mandatory Rerun preflight and re-fetch the current parent and PR #168 head.
2. Reuse the exact-head success evidence above if the child head is unchanged; do not rerun Gate A-E, M0, PR #159, or unrelated broad historical validation.
3. Review only any delta newer than `5e8f75dd...` plus the seven-file production bridge surface.
4. Because repository cleanup advanced the parent only in documentation/history, reconcile parent ancestry into #168 once if required for the real merge candidate; do not create a coordination-commit loop.
5. Verify the resulting exact merge candidate as required, then complete the checklist's production/parity decision: arbitrary installed content must use the generic Resolver/authoritative transaction and remain invariant under content/definition ID rename.
6. Remove named Fighter Action Surge execution only after that parity is proven.
7. Do not route product work to `main`.
