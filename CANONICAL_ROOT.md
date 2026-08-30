# SimpleVTT canonical development routing

This file defines branch roles. It does not replace the current-work pointer in [`docs/CURRENT.md`](docs/CURRENT.md).

```yaml
product_integration_target: work/v1-composite
active_working_branch: agent/codex-c9-gate-n-finalization
frozen_handoff_baseline: 5fadeced4304aa8ae51267c699a1abe053eb5152
upstream_reconciliation_lineage: agent/c9-gate-n-coverage-reconciliation
historical_or_reference_branches:
  - main
  - work/v1-latest
  - agent/resolver-foundation-convergence
```

## Rules

1. `work/v1-composite` remains the V1 product integration target. Do not route V1 product completion to `main` unless the owner explicitly changes the integration model.
2. `agent/codex-c9-gate-n-finalization` is the active working branch for C9 Gate N completion. It was cut from the exact baseline above so final verification can converge on stable SHAs.
3. `agent/c9-gate-n-coverage-reconciliation` is upstream history/evidence for this handoff, not the branch Codex should chase if it keeps moving independently.
4. Before editing, read `docs/CURRENT.md` and `docs/CODEX_C9_GATE_N_HANDOFF.md`, then reconcile them with live GitHub state and the Gate N ledger.
5. Do not repeat families already proven complete merely because an older PR or handoff describes them as open. Current ledger and source evidence win.
6. Do not use a self-publishing workflow that commits or pushes back to the active branch as the normal implementation loop. Final acceptance requires one exact verified HEAD after write-capable temporary automation is quiescent.
7. `main`, `work/v1-latest`, and `agent/resolver-foundation-convergence` are historical/landing/reference branches until deliberately promoted.
8. Historical files under `docs/archive/`, old PR bodies, and old ChatGPT Rerun state are evidence only, never current routing authority.

The `.chatgpt-rerun/` control set is not present on this current lineage. Do not recreate or follow it unless the owner explicitly re-enables that coordination mechanism. Product architecture, current status, and Codex handoff live under `docs/`.
