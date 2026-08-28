# SimpleVTT canonical development routing

This file defines branch roles. It does not replace the current-work pointer in [`docs/CURRENT.md`](docs/CURRENT.md).

```yaml
product_integration_target: work/v1-composite
current_convergence_parent: agent/resolver-foundation-convergence
historical_or_reference_branches:
  - main
  - work/v1-latest
```

## Rules

1. `work/v1-composite` is the V1 product integration target. Do not route V1 product merges to `main` unless the owner explicitly promotes the integration model.
2. An explicitly named active working/convergence branch may be ahead of `work/v1-composite`. That does not make the integration target obsolete; it means the current slice has not yet been integrated.
3. Before editing, read `docs/CURRENT.md`. It names the current parent, active child PR, and immediate boundary. Do not infer current work from commit recency or an old phase/handoff document.
4. Default new independent product work to the integration target. Work that belongs to an explicitly active convergence sequence must branch from the parent named in `docs/CURRENT.md` or its automation state.
5. `main` and `work/v1-latest` are historical/landing references until deliberately promoted.
6. Historical files under `docs/archive/` and old PR bodies are evidence only, never routing authority.

For ChatGPT Rerun, `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, and `PLAN.md` remain the automation source of truth and may name a temporary working parent. Product architecture and current human-readable status live under `docs/`.
