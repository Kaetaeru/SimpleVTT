# Rerun Status

**Connection:** `work/v1-composite` · existing run · Common Play / D&D Rules Resolver

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `2`
- Task: `common-play-foundation-convergence`
- Control to publish: `continue`
- Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- Product plan: `docs/rules/resolver-execution-checklist-v2.md`
- Reconciled at: `2026-08-28 Asia/Seoul`

## Current result

The stale GitHub Actions queue blocker has been removed. PR #159's old exact-head runs completed and exposed one bounded TypeScript typing failure plus an unrelated stale persistence catalog-total assertion.

Corrections are published:
- child `agent/m1-rulemodule-portable-activation` at `87945628c31a751c697a8c67b4096fae7c374e0c` preserves the parsed Common Play invocation literal type;
- parent persistence test now checks the intended builtin-only initial-catalog invariant instead of hard-coding `496`;
- the architecture charter locks the owner intent that Common Play is a portable D&D execution language, A-M are expressive coverage, F-M require explicit disposition before Gate N, and legacy deletion is a migration consequence rather than the product goal;
- Rerun PLAN routes to checklist v2;
- PR #159 description is refreshed to the current architecture/evidence and still reports a bounded seven-file product diff.

Latest observed child CI:
- M1 Resource/Economy: SUCCESS;
- Contract validation: SUCCESS;
- Rules Domain: SUCCESS;
- UI: SUCCESS;
- Persistence: FAILURE only on the stale `501 !== 496` parent baseline that has already been corrected independently on the parent;
- Phase 11: in progress;
- Phase 12: in progress.

PR #159 is currently open and mergeable. In-progress verification and the already-corrected parent baseline are not reasons to return Rerun to `blocked`. Rerun is authorized to continue from current evidence without repeating old Gate E/M0 work or stale `60c5...` runs.

## Next

Re-fetch live parent/child, inspect only current exact-head verification, reconcile parent ancestry so the independent baseline correction participates in merge verification without entering the seven-file PR product diff, resolve only real new failures, then follow the existing merge-approval policy. After #159 integration, move directly to installed portable mechanics -> real production/session generic dispatch before removing the named Fighter Action Surge seam.

`STATUS.md` is human-facing only. Authoritative state is STATE plus `control.json`, with control written last.
