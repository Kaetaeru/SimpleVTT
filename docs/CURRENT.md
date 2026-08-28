# Current — SimpleVTT

Updated: 2026-08-28 Asia/Seoul

This is the human/agent entry point for **what is current now**. If an older phase checklist, handoff, PR body, or archive file conflicts with this page and live GitHub state, this page plus live GitHub wins.

## Current branch roles

- Product integration target: `work/v1-composite`
- Active convergence parent: `agent/resolver-foundation-convergence`
- Active implementation PR: #171, `rules: migrate built-in Action Surge to generic Common Play`
- Active implementation branch: `agent/m1-action-surge-generic-production`
- Current boundary: validate the bounded PR #171 candidate and advance Resource/Economy from `PRODUCTION` to `MIGRATED` only after approved merge
- `main`: historical/landing reference, not the current V1 integration target

The convergence parent is intentionally ahead of `work/v1-composite` while the Resolver program is integrated in bounded slices. PR #171 may temporarily be behind the convergence parent because Rerun coordination/documentation commits continue there; live GitHub ancestry and CI must be re-fetched before merge adjudication.

## Current product objective

Build one reusable declarative D&D execution model instead of accumulating named content branches.

The intended normal runtime is:

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

## Current maturity

Already established and not to be repeated without new regression evidence:

- Common Play foundation/kernel gates A-E
- M0 legacy execution inventory/freeze
- portable Resource/Economy RuleModule import, validation, persistence, rehydration, and runtime compilation
- PR #159 integrated into the convergence parent
- PR #168 merged as `c372c09353de58dfcc12ad3adbe6fd118fe28106`, establishing Resource/Economy `PRODUCTION` for arbitrary installed data-only Common Play mechanics through the real production/session authority

Current unfinished boundary:

> `PRODUCTION -> MIGRATED` for Resource/Economy through the bounded PR #171 Fighter Action Surge migration candidate.

PR #171 must preserve the generic Common Play production path while proving built-in Fighter Action Surge parity for its two-resource spend, restricted extra Action semantics, authoritative commit/writeback, Undo, connected convergence, and ID/name-only rename invariance. Its candidate diff removes the named Fighter Action Surge production adapter and shrinks the legacy boundary; that removal is acceptable only with the parity evidence intact.

The convergence parent remains `PRODUCTION` until PR #171 is accepted and merged. Do not mark Resource/Economy `MIGRATED` from an unmerged candidate, and do not introduce a replacement Action Surge-specific dispatch key, evaluator, transport, state store, or hidden fallback.

Do not reopen older Gate E/M0 work, revive the rejected broader Action Surge parity experiment, or start a competing implementation while PR #171 remains the bounded live candidate unless new repository evidence invalidates it.

For transient exact-head CI and merge-readiness state, `.chatgpt-rerun/STATE.md` plus live GitHub is authoritative; this page intentionally records the durable product boundary rather than ephemeral queued/running workflow status.

## Source of truth

- Architecture intent: [`docs/rules/common-play-resolver-architecture-charter.md`](rules/common-play-resolver-architecture-charter.md)
- Current execution plan: [`docs/rules/resolver-execution-checklist-v2.md`](rules/resolver-execution-checklist-v2.md)
- Legacy execution debt/evidence: [`docs/rules/legacy-execution-inventory.md`](rules/legacy-execution-inventory.md)
- Architecture map: [`docs/architecture/README.md`](architecture/README.md)
- Roadmap router: [`docs/roadmap/CURRENT.md`](roadmap/CURRENT.md)
- Branch routing: [`CANONICAL_ROOT.md`](../CANONICAL_ROOT.md)
- Rerun automation only: [`.chatgpt-rerun/`](../.chatgpt-rerun/)

## Reading rule for future work

Read only this page, the architecture map, the current roadmap, and the files required by the active slice. Historical Phase/V0.9/V1 agent documents are archived and must not be used as a competing `NEXT` pointer.
