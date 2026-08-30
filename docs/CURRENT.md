# Current — SimpleVTT

Updated: 2026-08-31 Asia/Seoul

This is the human/agent entry point for **what is current now**. If an older checklist, handoff, PR body, archived file, or deleted Rerun state conflicts with this page and live GitHub state, **this page plus live GitHub wins**.

## Current branch roles

- Product integration target: `work/v1-composite`
- Active working branch: `agent/codex-c9-gate-n-finalization`
- Frozen handoff baseline: `5fadeced4304aa8ae51267c699a1abe053eb5152`
- Upstream reconciliation lineage: `agent/c9-gate-n-coverage-reconciliation`
- `main`: historical/landing reference, not the V1 integration target
- `agent/resolver-foundation-convergence`: historical convergence parent for earlier V1 slices, not the current work pointer

Do not move active work back to the upstream C9 branch merely because it has newer commits. The Codex finalization branch was intentionally cut from the stated baseline to stop exact-head verification from being invalidated by self-publishing one-shot workflows.

## Current objective

Publish and integrate the completed **C9 Gate N local candidate** without repeating mechanism-family work.

The reusable execution model remains:

```text
RuleModule/content JSON
  -> structural + semantic + capability validation
  -> normalization
  -> Common Play operations / IR
  -> RulesProfile-owned semantics
  -> PendingResolution
  -> generic Resolver
  -> typed state changes / ResolutionEvent
  -> atomic authoritative commit
  -> Character/session persistence and UI projection
```

Identity such as spell/feat/class/item IDs is for lookup, provenance, and presentation. It must not select bespoke algorithms.

## Immediate blocker

All 36 mechanism families are `IMPLEMENTED` in the checked-in ledger and the local exact-SHA acceptance is green. The remaining blocker is external publication: this environment cannot push because Windows Git credentials are unavailable (`SEC_E_NO_CREDENTIALS`), and `gh` is not installed to inspect queued/running Actions.

Do not reopen a mechanism family. Authenticate Git, push the exact current candidate branch, verify normal read-only CI and absence of a branch-writing job, then integrate that exact verified SHA into `work/v1-composite`.

## Local Gate N candidate

- Candidate before this documentation update: `489c8dfb8ba300bae76ef3d4ffc85480e80aa1a1` (tree `899cc171366bbc788f2410a34f2154b24784740a`).
- Ledger: 36 `IMPLEMENTED`, 0 `INCOMPLETE`, 0 Gate-N-blocking named fallbacks.
- `npm run build`, focused Family N 12/12, Family AJ aggregate 44/44, coverage contract, Gate N classifier, legacy boundary, and `git diff --check`: PASS.
- All 46 temporary `.github/workflows/c9-*` one-shot workflows were removed.
- Push attempt: blocked only by missing local Git credentials; remote CI state therefore remains unverified.

## Gate N completion rule

`docs/rules/v1-mechanism-coverage-ledger.json` is the mechanism-family source of truth. Re-read it and `scripts/check-v1-mechanism-coverage.mjs --gate-n` before choosing each next slice; do not rely on an older remembered list of incomplete families.

Gate N is complete only when all of the following are true on **one exact branch HEAD SHA**:

1. all 36 ledger rows have a valid final disposition (`IMPLEMENTED` or evidence-backed `PROVEN_UNNEEDED`);
2. no Gate-N-blocking named fallback remains;
3. unknown/renamed external Common Play production evidence remains green for affected families;
4. connected/retry/reconnect/Undo and persistence evidence required by the ledger is green;
5. `node scripts/check-v1-mechanism-coverage.mjs --gate-n` passes;
6. `node scripts/check-legacy-execution-boundary.mjs` passes;
7. `npm run build` passes;
8. contract validation passes on that same SHA;
9. no queued/running workflow can subsequently write a different SHA to the branch;
10. that exact verified SHA is then integrated into `work/v1-composite`.

## Workflow discipline

Do **not** add another self-publishing GitHub Actions loop. The accumulated `c9-*` one-shot workflows have been removed; use normal read-only CI only and do not recreate branch-writing automation.

## Known cleanup

PRs #181 and #182 are stale Family J alternatives. Family J is already `IMPLEMENTED` on the current lineage through structural save-condition/Common Play execution and arbitrary identity invariance. Do not merge those divergent PRs into this branch; close them as superseded.

## Source of truth

- Current routing: [`CANONICAL_ROOT.md`](../CANONICAL_ROOT.md)
- Codex handoff: [`CODEX_C9_GATE_N_HANDOFF.md`](CODEX_C9_GATE_N_HANDOFF.md)
- Gate N ledger: [`docs/rules/v1-mechanism-coverage-ledger.json`](rules/v1-mechanism-coverage-ledger.json)
- Architecture intent: [`docs/rules/common-play-resolver-architecture-charter.md`](rules/common-play-resolver-architecture-charter.md)
- Execution checklist: [`docs/rules/resolver-execution-checklist-v2.md`](rules/resolver-execution-checklist-v2.md)
- Legacy execution evidence: [`docs/rules/legacy-execution-inventory.md`](rules/legacy-execution-inventory.md)

The old `.chatgpt-rerun/` files are not present on this current lineage and are **not** the current execution authority.

## Reading rule for future work

Read this page, `CANONICAL_ROOT.md`, `CODEX_C9_GATE_N_HANDOFF.md`, the Gate N ledger, and only the implementation/tests needed by the active incomplete family. Historical Phase/V0.9/V1 agent documents are evidence only and must not become a competing `NEXT` pointer.
