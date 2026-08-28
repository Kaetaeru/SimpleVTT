# Current — SimpleVTT

Updated: 2026-08-28 Asia/Seoul

This is the human/agent entry point for **what is current now**. If an older phase checklist, handoff, PR body, or archive file conflicts with this page and live GitHub state, this page plus live GitHub wins.

## Current branch roles

- Product integration target: `work/v1-composite`
- Active convergence parent: `agent/resolver-foundation-convergence`
- Active implementation PR: #168 — `rules: dispatch installed Common Play through production authority`
- Active child branch: `agent/m1-installed-common-play-production`
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
- PR #159 integrated into the convergence parent; Resource/Economy is `PORTABLE`

Current unfinished boundary:

> `PORTABLE -> PRODUCTION` for installed Resource/Economy mechanics.

PR #168 is proving that an arbitrary installed Common Play mechanic can enter the real production/session action authority, use the existing generic Resolver, and commit through the existing authoritative transaction path. The named Fighter Action Surge path remains only as a parity oracle until generic end-to-end behavior and arbitrary-ID invariance are proven.

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
