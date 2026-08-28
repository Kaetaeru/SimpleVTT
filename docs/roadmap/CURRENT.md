# Current roadmap

This page routes to the one active execution plan. It does not duplicate that checklist.

## Active plan

[`../rules/resolver-execution-checklist-v2.md`](../rules/resolver-execution-checklist-v2.md)

The older `resolver-execution-checklist.md` is historical and archived.

## Current boundary

Resource/Economy maturity:

```text
SPEC -> KERNEL -> PORTABLE -> PRODUCTION -> [MIGRATED] -> ACCEPTED
```

Tests/Rolls/Outcomes maturity:

```text
SPEC -> KERNEL -> PORTABLE -> [PRODUCTION] -> MIGRATED -> ACCEPTED
```

PR #168 established `PRODUCTION` for arbitrary installed, data-only Common Play Resource/Economy mechanics through the real production/session authority.

PR #171, `rules: migrate built-in Action Surge to generic Common Play`, is integrated as merge commit `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f` from validated candidate `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`. It completed the bounded `PRODUCTION -> MIGRATED` boundary by proving built-in Action Surge through the same generic path and removing its named production seam.

PR #172, `rules: add generic Common Play d20 production bridge`, is integrated as merge commit `ff523a4b8b83f29b781720dcd174f0245e7c16ca` from validated candidate `350224dc10fe747ff52e8a8f2c428208edb9af2e`. It established Tests/Rolls/Outcomes `PRODUCTION` for authored actor ability checks, saving throws, and attack rolls by reusing the existing generic Resolver `d20` semantics through validation, persistence/rehydration, production authority, connected result presentation, and rename invariance.

The Resource/Economy migration evidence includes two-resource atomic spend, the RulesProfile-owned non-Magic extra Action restriction, authoritative Character/session writeback, Undo, connected convergence, ID/name-only rename invariance, preservation of arbitrary installed Common Play production coverage, and legacy boundary shrinkage.

The Tests/Rolls/Outcomes production bridge deliberately does not claim migration: Tactical Mind, Indomitable, Cutting Words, Peerless Skill, Dark One's Own Luck, other named post-roll seams, property-backed modifier/DC, and target/every-target authoring remain outside the absorbed boundary.

`MIGRATED` or `PRODUCTION` does not automatically imply `ACCEPTED`; remaining universal acceptance obligations must be proven explicitly before that status is claimed.

The active task is to select the next smallest coherent Phase 2 mechanism-family slice from the capability maturity board and current legacy inventory. Selection must be mechanism-first, not a named class/spell/feat queue.

## What not to do

- Do not add a content-name/id algorithm switch.
- Do not add another evaluator, state store, network transport, or fallback execution engine.
- Do not repeat Gate A-E, M0, PR #159, PR #168, PR #171, or PR #172 validation without new affected-surface evidence.
- Do not revive the rejected broader Action Surge parity experiment.
- Do not treat Resource/Economy as `ACCEPTED` solely because its named Action Surge production seam is gone.
- Do not treat Tests/Rolls/Outcomes as `MIGRATED` or `ACCEPTED` solely because generic d20 production is established.
- Do not speculatively activate Gates F-M; use the canonical probe/disposition rules.
- Do not select work from archived Phase/V0.9/V1 agent checklists.
- Do not route product integration to `main`.

## Next selection

Use `resolver-execution-checklist-v2.md` plus `legacy-execution-inventory.md` to choose the smallest coherent mechanism family that can retire real legacy execution while strengthening the portable generic language. Freeze that slice's behavior oracle and acceptance contract before handing repository-dependent implementation to Codex.

Gates F-M are capability questions, not a requirement to implement speculative machinery. Each must eventually be `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` before final external RuleModule acceptance.
