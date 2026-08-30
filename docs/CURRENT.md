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

Finish **C9 Gate N finalization** without repeating already proven mechanism-family work.

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

At the frozen baseline, `C9 Family N Source Cleanup 71304` run `33319298002` proved the focused Family N lifecycle tests but failed at the repository-wide `npm run build`. Because the build failed, its ledger reconciliation and self-removal/publish step did **not** land. Family N therefore remains `INCOMPLETE` in the checked-in ledger.

Start by reproducing and fixing that exact build failure on this branch. Do not mark Family N `IMPLEMENTED` until the focused lifecycle proof, full build, coverage classification, legacy execution boundary, and ledger evidence all pass together.

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

Do **not** add another self-publishing GitHub Actions loop to finish this work. Existing `c9-*` one-shot workflows are historical evidence or cleanup candidates unless the current task specifically requires their read-only checks. Prefer local/Codex edits and normal CI. Before declaring final Gate N green, remove or disable remaining temporary workflows that can write/push to the active branch and confirm no write job is queued or running.

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
