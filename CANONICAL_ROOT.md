# SimpleVTT canonical development root

This file is the repository-level routing authority for humans and coding agents.

```yaml
canonical_branch: work/v1-composite
canonical_worktree_hint: work/SimpleVTT-v1
canonical_purpose: V1 implementation, build, preview, test, and release preparation
historical_branches:
  - main
  - work/v1-latest
last_declared_checkpoint: 266a6d5
declared_at: 2026-08-23 Asia/Seoul
```

Rules:

1. Start all new V1 product work from `work/v1-composite`.
2. Run the local preview and production build from the worktree checked out to `work/v1-composite`.
3. Do not identify `main`, `work/v1-latest`, or a newer commit timestamp alone as the latest playable V1.
4. Before changing code, verify `git branch --show-current` returns `work/v1-composite`.
5. `main` is a landing/reference branch until the V1 composite history is deliberately promoted; this declaration does not imply that its older code is canonical.

The checkpoint above records when this declaration was introduced. The branch head can advance beyond it; use `git log -1 --oneline work/v1-composite` to find the latest canonical commit.

For the exact active implementation slice, completed work, remaining checklist, and validation commands, read `.agents/V1_CURRENT_HANDOFF.md` before editing code.
