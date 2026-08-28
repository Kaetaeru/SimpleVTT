# Current — SimpleVTT

Updated: 2026-08-28 Asia/Seoul

This is the human/agent entry point for **what is current now**. If an older phase checklist, handoff, PR body, or archive file conflicts with this page and live GitHub state, this page plus live GitHub wins.

## Current branch roles

- Product integration target: `work/v1-composite`
- Active convergence parent: `agent/resolver-foundation-convergence`
- Active implementation PR: none at this checkpoint; PR #168 is merged
- Next implementation boundary: built-in Fighter Action Surge generic Common Play parity
- `main`: historical/landing reference, not the current V1 integration target

At this checkpoint the convergence parent is ahead of `work/v1-composite`; that is intentional while the Resolver program is being integrated in bounded slices.

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

> `PRODUCTION -> MIGRATED` for Resource/Economy by proving built-in Fighter Action Surge through the same generic path and then removing only its absorbed named execution seam.

The named Fighter Action Surge path remains only as a parity oracle until the generic path proves its two-resource spend, restricted extra Action semantics, authoritative commit/writeback, Undo, connected convergence, and ID/name-only rename invariance. Do not introduce a new Action Surge-specific dispatch key while doing this work.

Do not reopen older Gate E/M0 work, revive stale named-content queues, or add a second evaluator/transport/store to solve this boundary.

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
