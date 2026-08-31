# Common Play Contract v0.2

Status: `0.2-draft`

This document is the persisted executable-content bridge between the existing Common Rule Definition Specification and the runtime resolver. It does not replace `docs/rules/README.md`; it narrows the first executable subset enough that JSON can be structurally validated and normalized without named spell, feat, class, item, or monster branches.

Machine-readable source of truth: `schemas/common-play-contract.schema.json`.

## 1. Invariant

A content name is presentation. Runtime behavior comes only from validated common primitives.

If adding a new spell, feat, class feature, subclass, item, condition, or monster ability requires TypeScript because of its **name**, the architecture has failed. Core code may change only when a concrete failing scenario proves that a genuinely general primitive is missing.

Imported content remains declarative. No JavaScript, `eval`, shell/native code, prose parsing, arbitrary function body, or user-defined evaluator may enter the trusted execution core.

## 2. Authoring, normalized IR, runtime

The three layers are intentionally distinct:

```text
human-friendly authoring JSON
        ↓ AuthoringMacroRegistry
normalized Common Play Contract IR
        ↓ schema + semantic/capability validation
trusted MechanicRegistry / RulesProfile
        ↓
PendingResolution → typed StateChange[] → ResolutionEvent
```

Existing authoring conveniences such as `spell-attack` or `saving-throw-damage` may remain as macros. The runtime must not execute those macro names directly. A normalizer expands them into `EntryPoint`, `Test`, `Rule`, `Interceptor`, `ArtifactTemplate`, and atomic operations.

The legacy `ContentEntry.mechanics[].config` envelope remains an authoring compatibility surface while migration is incremental. New executable content should normalize to this v0.2 contract before runtime execution.

## 3. Closed primitive surface

The v0.2 schema defines an intentionally closed initial operation set:

- `property.modify`
- `roll.modify`
- `damage.apply`
- `healing.apply`
- `temp-hp.grant`
- `resource.change`
- `effect.apply`
- `effect.remove`
- `condition.apply`
- `condition.remove`
- `economy.modify`
- `content.grant`
- `movement.relocate`
- `adjudication.request`

There is no `fireball`, `rage`, `battle-master`, `shield-spell`, or other named-content primitive.

Unknown operation kinds are `unsupported`; they are never ignored and never silently converted into DM adjudication.

## 4. CastProcess

An entry point is not enough to model a long cast or ritual. `CastProcess` represents the activity required before an entry point resolves.

It records:

- duration;
- activity identity;
- whether interruption is possible;
- interruption policy;
- completion entry point;
- ritual flag.

A long cast is runtime activity state, not a special spell branch.

## 5. PaymentContract

Costs are part of the same transaction as their result. v0.2 supports resource, item, and economy payments.

A payment states when it is staged/consumed and whether cancellation refunds it. Item requirements distinguish `consumed: true` from a required but non-consumed component.

Required execution rule:

```text
validate eligibility
→ reserve/stage payment
→ resolve interactions/tests
→ revalidate
→ commit payment + resulting StateChanges atomically
```

Opening a reaction or DM prompt must not by itself consume a resource.

## 6. Selector and AllocationPlan

`Selector` is the common query surface for targets, content, artifacts, items, actors, and effects. Selection may be filtered by the common Predicate language.

`AllocationPlan` represents distributing a fixed number of units across selected targets. It exists so projectile allocation, charge distribution, or similar mechanics do not create named resolvers.

Selectors are declarative queries. They do not introduce arbitrary database/query code supplied by content.

## 7. Typed bindings and captures

Deferred, persistent, or multi-step rules need references to values created earlier in a resolution.

Bindings therefore declare both a value type and capture policy. Supported handle/value families include entity, artifact, content, roll result, outcome, selection, resolution, and scalar values.

`capture: snapshot` freezes the value at binding time. `capture: live` explicitly requests reevaluation from current authoritative state.

Arbitrary variable paths are not an extension language. Semantic validation must reject references that are not available in the current evaluation context.

## 8. Facts, consent, and unknown knowledge

A `FactQuery` asks for information that may be owned by the host, an entity owner, the DM, or a RulesProfile policy. It carries authority, visibility, and an explicit unknown policy.

Examples include whether a destination is legal, whether two entities share a relation, whether a target meets a hidden world condition, or whether a corpse/history requirement is satisfied.

Consent is not a factual predicate. A willing target should use an `Interaction` with `kind: consent` after eligibility facts are checked.

A spatial-capability adapter may answer spatial facts. Without one, the mapless core may request authoritative input or report unsupported according to the declared policy; it must not invent coordinates, pathfinding, line of sight, or target membership.

Interceptor fact subjects are scoped references: `interceptor.source`, `intercepted.actor`, and `intercepted.target`. Spatial and sensory facts are evaluated from the interceptor source toward the resolved subject. Unknown subject references are unsupported rather than interpreted as entity IDs.

## 9. Interactions and DM-assisted adjudication

`Interaction` is a first-class pause/input contract for choices, consent, and adjudication.

Each interaction has:

- stable identity;
- responder/authority;
- notice/input/blocking mode;
- bounded input type;
- visibility;
- revalidation policy;
- stale-response policy;
- idempotency key.

`adjudication.request` is a **supported DM-assisted primitive**. It is appropriate when arithmetic/state transitions are representable but the result depends on narrative or hidden-world judgment, such as open-ended divination or illusion interpretation.

Support levels are therefore:

1. supported + automated;
2. supported + DM-assisted;
3. unsupported.

Level 3 must never be disguised as level 2.

## 10. Semantic Resolution Slots and interceptors

A reaction or pending effect must not patch arbitrary resolver internals. Interceptors can modify only registered semantic slots:

- `declaration`
- `targets`
- `attack.roll`
- `attack.outcome`
- `primary.damage`
- `secondary.damage`
- `effects`
- `movement`
- `stateChanges`

Allowed interceptor operations are `append`, `replace`, `prevent`, `modify`, `redirect`, and `recalculate`.

This makes reaction defenses, damage replacement, extra damage, and outcome recalculation generic without turning JSON into unrestricted JSON Patch.

## 11. RuntimeArtifact and lifetime graph

Persistent spell/feature output is represented by an `ArtifactTemplate`, not by keeping a named spell resolver alive.

Initial artifact kinds:

- effect;
- zone;
- object;
- actor;
- link;
- form;
- stored invocation;
- item.

Artifacts may contain rules and grant entry points. Lifetime policy is explicit and can depend on parent lifetime, duration, consumption, destruction, state, an event, source recast, durable ownership, or world persistence.

Parent/source termination does not implicitly delete every child. Cleanup behavior is data.

## 12. Rules and frequency

A `Rule` is:

```text
Event + optional Predicate + optional Interaction + Operations
```

Frequency is explicit (`once`, `once-per-turn`, `once-per-round`, `once-per-resolution`, etc.) so persistent artifacts and automatic triggers do not depend on UI timing or accidental duplicate delivery.

## 13. PendingResolution revalidation and idempotency

A user/DM response may arrive after authoritative state changes. Resuming an interaction therefore requires:

```text
InteractionResponse
→ locate stable PendingResolution/interaction identity
→ verify authoritative revision
→ re-evaluate legality/facts/payment availability
→ apply stale policy if invalid
→ stage result
→ atomic commit
```

Network retry of the same interaction response or trigger activation must not spend a cost or apply an effect twice. Runtime protocol/event code must preserve stable IDs and exactly-once application.

## 14. RulesProfile ownership

The common contract names generic structures; the RulesProfile still owns edition-specific semantics such as:

- registered property names;
- Predicate operators and relation meaning;
- TimingPoint registry;
- action economy buckets;
- damage/critical policy;
- concentration/maintained-effect policy;
- legal ranges and spatial capability interpretation;
- progression/rest behavior.

Content cannot register executable semantics by itself.

## 15. Validation requirements

Structural validation is not enough. Activation/runtime normalization must also validate:

- every operation kind has one trusted evaluator;
- every semantic resolution slot is registered;
- every property, timing point, predicate operator, capability, and reference is supported;
- bindings reference values available in their scope;
- selector targets/categories are compatible;
- artifact/template references exist;
- payment targets/resources exist and are payable;
- unsupported features remain explicit.

A required implementation invariant is:

```text
persisted operation kinds in schema == trusted evaluator kinds in MechanicRegistry
```

Any drift is a failing contract test.

## 16. Initial golden coverage

Before broad content import, the contract should be exercised by mechanism families rather than content names. Initial structural fixtures cover:

- reaction pause + semantic `attack.outcome` recalculation;
- long cast + non-consumed item requirement + committed resource payment;
- DM-assisted information result with stable blocking interaction.

Runtime golden scenarios should then add attack/damage, save/half-damage, healing, temporary HP, persistent effects, repeated saves, concentration, resource-powered effects, allocation, artifact lifetime, summon/form projection, stored invocation, suppression/removal, reconnect/retry, and explicit unsupported behavior.

## 17. Change policy

Do not expand this language from imagination. For each missing behavior:

1. capture a concrete failing scenario;
2. attempt composition with existing primitives;
3. add the smallest reusable primitive only if composition is not clean or safe;
4. version persisted schema/capability data when needed;
5. add structural and runtime regression coverage;
6. rerun existing scenarios.

This contract is deliberately not a general programming language. Its usefulness comes from a small, inspectable, testable executable core and open declarative content on top.
