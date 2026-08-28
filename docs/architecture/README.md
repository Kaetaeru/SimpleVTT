# Architecture map

This directory is the short navigation layer for current architecture. Detailed normative contracts remain in their existing domain-specific locations; this page prevents several old plans from competing as architecture authorities.

## Core rule-execution architecture

Normative intent: [`../rules/common-play-resolver-architecture-charter.md`](../rules/common-play-resolver-architecture-charter.md)

```text
Declarative RuleModule
  -> validate / normalize
  -> Common Play operations
  -> RulesProfile + registered generic mechanics
  -> PendingResolution
  -> generic Resolver
  -> StateChange[] + ResolutionEvent
  -> atomic authoritative commit
```

### Invariants

- No `if spell.id ...`, `if feature.id ...`, named compiler map, or equivalent content-ID algorithm dispatch in the target architecture.
- Content cannot supply arbitrary JavaScript/eval/native execution.
- RulesProfile owns edition/ruleset semantics such as economy policy.
- Manual/provider/network entry points converge on the same semantic Core rather than implementing parallel rule engines.
- Missing authoritative facts reject explicitly; the engine does not invent geometry, dice, DCs, stats, or unsupported mechanics.
- Existing primitives are preferred. Add a new capability only when a deterministic D&D mechanism proves a reusable gap.

## Transaction boundaries

“One declarative rule language” does not mean one fake transaction type.

- Runtime action: `PendingResolution -> ResolutionEvent/state commit`
- Progression: authoring/progression draft -> Character revision
- Module install: validation -> activation/persistence transaction
- Character durable state and session runtime state remain distinct authorities

## Related architecture areas

- Common Play contract: [`../rules/common-play-contract-v0.2.md`](../rules/common-play-contract-v0.2.md)
- Content relationships: [`../rules/content-relationships.md`](../rules/content-relationships.md)
- RulesProfile documentation: [`../rules/profiles/`](../rules/profiles/)
- Current execution plan: [`../rules/resolver-execution-checklist-v2.md`](../rules/resolver-execution-checklist-v2.md)
- Current project status: [`../CURRENT.md`](../CURRENT.md)

Detailed UI/product/persistence design documents remain under `docs/design/`. Historical architecture experiments and superseded execution packets belong under `docs/archive/`.
