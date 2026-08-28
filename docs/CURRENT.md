# Current — SimpleVTT

Updated: 2026-08-29 Asia/Seoul

This is the human/agent entry point for **what is current now**. If an older phase checklist, handoff, PR body, or archive file conflicts with this page and live GitHub state, this page plus live GitHub wins.

## Current branch roles

- Product integration target: `work/v1-composite`
- Active convergence parent: `agent/resolver-foundation-convergence`
- Latest integrated implementation: PR #172, `rules: add generic Common Play d20 production bridge`
- Current boundary: Resource/Economy is `MIGRATED`; Tests/Rolls/Outcomes is `PRODUCTION`; select the next smallest coherent mechanism-family slice from the canonical product plan and current legacy evidence
- `main`: historical/landing reference, not the current V1 integration target

The convergence parent is intentionally ahead of `work/v1-composite` while the Resolver program is integrated in bounded slices. Live GitHub state remains authoritative for exact branch ancestry and active PR status.

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
- PR #171 merged as `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f` from validated candidate `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`, advancing Resource/Economy to `MIGRATED`
- PR #172 merged as `ff523a4b8b83f29b781720dcd174f0245e7c16ca` from validated candidate `350224dc10fe747ff52e8a8f2c428208edb9af2e`, establishing Tests/Rolls/Outcomes `PRODUCTION`

PR #171 proved built-in Fighter Action Surge through the same generic Common Play production path with its two-resource spend, RulesProfile-owned restricted extra Action, authoritative Character/session writeback, Undo, connected convergence, and ID/name-only rename invariance. The named `fighterActionSurgeRuntimeAdapter.ts` production path and its legacy baseline entry are removed.

PR #172 proved authored actor `ability-check`, `saving-throw`, and `attack-roll` Common Play tests through the existing generic Resolver `d20` semantics, installed persistence/rehydration, production authority, connected result presentation, and ID/name rename invariance. It did not remove Tactical Mind, Indomitable, Cutting Words, Peerless Skill, Dark One's Own Luck, property-backed modifier/DC, target/every-target authoring, or other named post-roll seams.

`MIGRATED` and `PRODUCTION` are not the same as `ACCEPTED`. Do not promote either family beyond its recorded maturity without explicit remaining evidence.

The next Phase 2 slice must be selected by mechanism family from `resolver-execution-checklist-v2.md` and current legacy evidence. Do not revive a named class/spell/feat queue, reopen validated Resource/Economy or d20 production work without affected-surface evidence, or speculatively activate Gates F-M.

For transient exact-head CI and execution state, `.chatgpt-rerun/STATE.md` plus live GitHub is authoritative; this page intentionally records the durable product boundary.

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
