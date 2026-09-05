# SimpleVTT canonical development routing

This file defines branch and document authority. It does not duplicate the execution plan.

```yaml
product_integration_target: work/v1-composite
current_status_pointer: docs/CURRENT.md
current_execution_plan: docs/roadmap/V1_MASTER_ROADMAP.md
current_roadmap_pointer: docs/roadmap/CURRENT.md
roadmap_audit_baseline: a38b0f07ac012bc9e600a28b2630a365d1bd098b
working_branch_policy: one scoped agent/* branch from the latest live integration HEAD per Gate or coherent repair
permanent_global_active_branch: null
historical_or_reference_branches:
  - main
  - work/v1-latest
  - agent/codex-c9-gate-n-finalization
  - agent/c9-gate-n-coverage-reconciliation
  - agent/resolver-foundation-convergence
```

## V1 status

V1 is complete: 72/72 release gates PASS (100.0/100.0), 120/120 multiplayer scenarios PASS, on exact SHA `7429e2c77ee969aec1c3fe28c252a8ad07e4cd06` with the matching Windows release artifact (`SimpleVTT-V1-RELEASE-7429e2c77ee969aec1c3fe28c252a8ad07e4cd06`, `simplevtt.exe` sha256 `2b7394794e37924f707a749d00925e8818577d70bd582dfe499c01df11c843be`). Record: `docs/roadmap/evidence/W9-04.md`. `work/v1-composite` stays the integration target until the owner changes the integration model.

## Authority order

When sources conflict, use this order:

1. live GitHub state of `work/v1-composite`;
2. `docs/CURRENT.md`;
3. `docs/roadmap/V1_MASTER_ROADMAP.md`;
4. `docs/roadmap/V1_EVIDENCE_LEDGER.json` after it is created;
5. canonical product and scenario contracts under `docs/design/` and `docs/rules/`;
6. historical files under `docs/archive/`, old PR/issue text, and retired handoffs.

## Rules

1. `work/v1-composite` remains the V1 product integration target. Do not route V1 completion to `main` unless the owner explicitly changes the integration model.
2. Before editing, read the live integration HEAD, `docs/CURRENT.md`, and the V1 master roadmap.
3. Create a scoped working branch from the latest integration HEAD. Do not reuse an old branch merely because it contains related work.
4. Select the first unblocked non-`PASS` roadmap Gate. Do not select `NEXT` from C9, Phase, V0.9, archived V1, or old Rerun documents.
5. A `REUSE_LOCKED` or `VERIFY_ONLY` Gate cannot trigger product-code changes without a reproducible failure on the current exact HEAD.
6. Fill the eight-field Evidence Card before changing product code and prefer the smallest repair to the existing owner path.
7. Do not add a second shell, store, Resolver, network transport, authority path, presentation pipeline, Party Stash transaction system, Long Rest coordinator, DM Library, or E2E framework.
8. Do not use a self-publishing workflow that commits or pushes to the integration or active working branch as the normal implementation loop.
9. C9 Gate N is complete and integrated. Its branches, handoffs, and mechanism ledger remain evidence, not current routing authority.
10. V1 completion requires all numeric closure conditions in the master roadmap on one exact SHA and one matching Windows artifact.

The `.chatgpt-rerun/` control set is not present on this lineage. Do not recreate or follow it unless the owner explicitly re-enables that coordination mechanism.
