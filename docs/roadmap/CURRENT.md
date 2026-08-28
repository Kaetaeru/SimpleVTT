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

The active task is `PORTABLE -> PRODUCTION`.

PR #168 must prove that an arbitrary installed, data-only Common Play Resource/Economy mechanic:

1. is selected by installed content identity only for lookup;
2. reaches the existing `commonPlayOperationRuntime` / generic Resolver;
3. uses RulesProfile-owned economy semantics;
4. commits through the existing authoritative production/session transaction path;
5. behaves identically after arbitrary content/definition ID renaming;
6. matches the existing Action Surge behavior where that feature is used as a parity oracle.

Only after that parity is proven may the named Fighter Action Surge production execution seam be removed.

## What not to do

- Do not add a content-name/id algorithm switch.
- Do not add another evaluator, state store, network transport, or fallback execution engine.
- Do not repeat Gate A-E or M0 validation without new affected-surface evidence.
- Do not select work from archived Phase/V0.9/V1 agent checklists.
- Do not route product integration to `main`.

## After this boundary

Continue by mechanism family and capability maturity, using the active checklist as authority. Gates F-M are capability questions, not a requirement to implement speculative machinery. Each must eventually be `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` before final external RuleModule acceptance.
