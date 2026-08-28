# Current roadmap

This page routes to the one active execution plan. It does not duplicate that checklist.

## Active plan

[`../rules/resolver-execution-checklist-v2.md`](../rules/resolver-execution-checklist-v2.md)

The older `resolver-execution-checklist.md` is historical and archived.

## Current boundary

Resource/Economy maturity:

```text
SPEC -> KERNEL -> PORTABLE -> [PRODUCTION] -> MIGRATED -> ACCEPTED
```

The active task is `PRODUCTION -> MIGRATED` through PR #171, `rules: migrate built-in Action Surge to generic Common Play`.

PR #168 already established `PRODUCTION` for arbitrary installed, data-only Common Play Resource/Economy mechanics through the real production/session authority. Do not repeat that bridge or treat `PORTABLE -> PRODUCTION` as unfinished.

PR #171 is the bounded migration candidate. Its acceptance contract is:

1. built-in Fighter Action Surge resolves through the same generic Common Play production path rather than a content-identity algorithm branch;
2. both Action Surge resources are spent atomically;
3. the extra Action preserves the RulesProfile-owned non-Magic-Action restriction;
4. authoritative Character/session writeback and Undo remain correct;
5. connected host/client convergence preserves resources and the exact extra-Action grant;
6. action/content/definition/display-name renaming changes provenance/presentation only, not mechanics;
7. the named Fighter Action Surge production adapter is removed only with the parity evidence intact;
8. the legacy execution boundary shrinks and no replacement named fallback, evaluator, store, or transport is introduced.

The convergence parent remains at `PRODUCTION` until the bounded candidate is accepted and merged. Live CI/merge readiness belongs to `.chatgpt-rerun/STATE.md` plus GitHub and must be re-fetched before merge adjudication.

## What not to do

- Do not add a content-name/id algorithm switch.
- Do not add another evaluator, state store, network transport, or fallback execution engine.
- Do not repeat Gate A-E, M0, PR #159, or PR #168 validation without new affected-surface evidence.
- Do not revive the rejected broader Action Surge parity experiment while PR #171 remains the bounded candidate.
- Do not select work from archived Phase/V0.9/V1 agent checklists.
- Do not route product integration to `main`.

## After this boundary

After an approved PR #171 merge, reconcile Resource/Economy to `MIGRATED`, remove the absorbed Action Surge entry from the canonical legacy inventory/baseline evidence, and continue by mechanism family and capability maturity using the active checklist as authority.

Gates F-M are capability questions, not a requirement to implement speculative machinery. Each must eventually be `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` before final external RuleModule acceptance.
