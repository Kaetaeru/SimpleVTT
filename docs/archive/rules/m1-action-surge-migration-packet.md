# M1 Action Surge Generic Migration Packet

Status: **BOUNDED — implementation may proceed red-first**

Working branch: `agent/resolver-foundation-convergence`

Product-plan authority remains `docs/rules/resolver-execution-checklist.md`. This packet only bounds the first M1 / Probe S migration slice.

## Why this probe

Fighter Action Surge is the smallest current `LEGACY_EXECUTION` action/resource/economy path with a deterministic domain oracle. Its named compiler already lowers the rule to generic Resolution operations, so it is a useful test of whether Common Play can replace a named mini-compiler without inventing a content-specific primitive.

This probe does **not** activate Gate F-M.

## Existing behavior oracle

Current named path:

- `src/app/fighterActionSurgeRuntimeAdapter.ts`
- `src/domain/fighterActionSurge.ts`
- `tests/domain/fighterActionSurge.test.ts`

The existing domain test is the golden behavior oracle. Do not rewrite it merely to make the migration easier.

Required semantic parity:

1. consume one Action Surge use resource;
2. consume the once-per-turn Action Surge gate resource;
3. do not consume the actor's ordinary Action when Action Surge is activated;
4. grant exactly one ExtraAction credit;
5. that ExtraAction credit must not satisfy a Magic Action;
6. a non-Magic Action consumes the restricted extra credit before the ordinary Action;
7. a second Action Surge in the same turn rejects atomically, including rollback of staged resource spends;
8. off-turn activation rejects;
9. turn start clears the extra Action credit and recovers the turn gate according to existing resource lifetime semantics.

Fighter level/resource-max materialization remains a separate progression concern. This first migration harness may start from an authoritative snapshot where the relevant resources already exist with their correct maxima.

## Existing generic Core capability

No new Resolver primitive is currently justified.

`src/domain/fighterActionSurge.ts` already compiles Action Surge into generic Resolution operations:

- `spend-resource` for the feature-use resource;
- `spend-resource` for the turn gate;
- `grant-extra-action` with `allowsMagicAction: false`.

`src/domain/turnEconomy.ts` already owns the generic extra-Action semantics, including restricted extra credits and their consumption order.

Therefore the migration problem is **Common Play contract/evaluator parity**, not missing Action Surge mechanics in Core.

## Current Common Play composition

Use existing portable semantics wherever possible:

- resource costs belong in Common Play `payments` with `kind: "resource"`, `consumeAt: "commit"`, and literal amount `1`;
- activation enters through a manual entry point;
- resource availability belongs in generic legality/payment validation, not a Fighter-ID branch;
- the resulting extra Action belongs in generic `economy.modify` / RulesProfile-owned economy semantics;
- content ID and display name are presentation/identity only.

### Concrete contract gap

Current `economy.modify` schema contains only:

- `bucket`
- `amount`

Current `RulesProfileLike` has no economy-bucket registry/policy that can turn an opaque bucket into the existing Core operation `grant-extra-action { allowsMagicAction: false }`.

Consequently, a portable RuleModule cannot yet state the Action Surge result precisely without either:

- losing the `Magic Action` restriction, or
- smuggling Action-Surge-specific meaning into a bucket string or named evaluator.

Both are forbidden.

This is **not** evidence for Gate F-M. It is a bounded schema/evaluator-parity gap inside the already-declared Common Play `economy.modify` capability.

## Red-first implementation boundary

Before changing the schema or runtime, add a deterministic Common Play test/fixture that attempts to represent the rule using an arbitrary external content ID.

The red scenario must prove all of the following:

1. a RuleModule/Common Play definition can declare two commit-time resource payments of `1`;
2. a manual self activation can reach a trusted generic compiler/evaluator without importing Fighter/Action-Surge constants;
3. the compiler is expected to produce the same generic Resolution operations as the current named compiler;
4. the extra Action result preserves `allowsMagicAction: false`;
5. arbitrary external ID and ID/name-only rename yield the same operations/state semantics;
6. no named fallback is used.

The first red should identify the smallest real missing generic contract/evaluator concept. Do not add a broader action-economy DSL.

## Smallest acceptable correction

Preferred correction order:

1. reuse an existing registered RulesProfile economy policy if repository evidence reveals one;
2. otherwise extend `economy.modify` with the smallest typed, reusable extra-action grant semantics needed to lower to the existing `grant-extra-action` Core operation;
3. implement one trusted generic evaluator/lowering path for the schema shape;
4. keep edition-specific interpretation in RulesProfile only if the semantics are genuinely edition policy rather than the portable operation itself.

A correction is acceptable only if it is reusable for unknown external content that grants the same type of restricted extra Action. It must not mention Fighter, Action Surge, class IDs, feature IDs, or display names.

## Harness acceptance criteria

The first generic harness is green only when:

- equivalent external RuleModule/Common Play fixture validates;
- normalization preserves the portable semantics;
- trusted generic lowering produces transactional resource spends plus the restricted extra-Action grant;
- generic Resolver execution matches the existing golden Action Surge state changes and rejection behavior for the bounded scenario;
- arbitrary external ID executes;
- changing only ID/name preserves semantic output;
- unsupported expressions/policies fail explicitly;
- schema and evaluator remain in parity;
- no new named execution adapter/branch is introduced;
- Legacy Execution Boundary remains non-increasing.

## Deletion gate

Do **not** delete `fighterActionSurgeRuntimeAdapter.ts` or `fighterActionSurge.ts` merely because a compiler unit test passes.

Delete/bypass the named execution path only after the generic path is authoritative for the production/session activation route and the relevant golden behavior remains green. When that happens:

1. remove only the absorbed named execution symbols/files;
2. shrink `.agents/LEGACY_EXECUTION_BASELINE.json` and the offline composition together;
3. update `docs/rules/legacy-execution-inventory.md`;
4. run the narrow migration parity tests, Contract/Rules Domain/typecheck as affected, and Legacy Execution Boundary;
5. record exact-SHA evidence in the product checklist before moving to the next migration probe.

## Stop conditions

Return to architecture review instead of improvising if implementation discovers:

- a requirement for content-name/ID branching;
- an authority or lifetime decision not owned by an existing contract;
- a need to change unrelated action-economy semantics;
- a deterministic failure that appears to require a genuinely new reusable capability rather than evaluator parity.

Gate F-M remains dormant unless the product-plan activation rule is independently satisfied.