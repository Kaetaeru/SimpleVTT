# Common Play Resolver Architecture Charter

Status: **NORMATIVE OWNER INTENT — DO NOT REINTERPRET DURING EXECUTION**  
Working program: Common Play / Rules Resolver convergence  
Integration target: `work/v1-composite`

This document records the architectural intent that must survive agent, chat, and implementation handoffs. It is not a duplicate execution checklist. `docs/rules/resolver-execution-checklist.md` remains the detailed queue, evidence ledger, gate checklist, and Definition of Done. This charter defines what that checklist means and what it is trying to accomplish.

If an older handoff, packet, checklist sentence, issue, PR, or implementation comment can be read in a way that conflicts with this charter, **do not invent a new philosophy and do not silently follow the conflicting reading**. Preserve the owner intent here, reconcile current GitHub evidence, and repair the stale planning text before proceeding.

---

## 1. Why this program exists

The goal is not merely to remove legacy adapters, and it is not merely to make a few existing SimpleVTT features share code.

The goal is to build a **declarative D&D rule-execution language and generic Resolver** so that spells, feats, class/subclass features, items, conditions, monster abilities, and homebrew content can be expressed as data and executed through common semantics.

The product promise is:

> If a previously unknown external RuleModule uses mechanics/capabilities that SimpleVTT already supports, it must execute without adding TypeScript/Rust/React/session code that recognizes that content's ID, name, class, spell, feat, item, monster, or other presentation identity.

Legacy deletion is evidence that this language has absorbed an old named path. Legacy deletion is **not** the architectural objective by itself.

---

## 2. Non-negotiable execution invariant

Named content is data. Generic rule meaning is code/profile policy.

Allowed trusted-engine knowledge includes:

- generic primitive/mechanic kinds;
- registered properties and expression/predicate semantics;
- timing/event points;
- targeting/selection contracts;
- RulesProfile policies;
- authority and lifetime contracts;
- typed runtime state and typed StateChanges;
- provider/manual semantic boundaries.

Forbidden execution selection includes:

```ts
if (spell.id === "fireball") { ... }
if (feature.id === "action-surge") { ... }
if (content.name === "Rage") { ... }
const compiler = namedCompilers[contentId]
```

A content ID/name may appear in provenance, catalog identity, localization, presentation, source references, or stable data relationships. It may not choose the execution algorithm.

---

## 3. Canonical execution model

The normal runtime rule path is:

```text
RuleModule / content JSON
        -> structural + semantic + capability validation
        -> authoring normalization / sugar expansion
        -> Common Play IR
        -> trusted generic lowering / MechanicRegistry + RulesProfile
        -> PendingResolution
        -> typed StateChange[]
        -> atomic authoritative commit
        -> ResolutionEvent
        -> session / persistence projection
        -> UI presentation
```

Common Play is the canonical portable execution language. Authoring macros may exist, but runtime must not execute named authoring macros directly.

Do not solve portability by allowing arbitrary JavaScript, eval, shell/native execution, user-defined evaluators, unrestricted patches, or content-supplied code.

---

## 4. One language does not mean one fake transaction type

The architecture shares declarative semantics and provenance across rules domains, but it must preserve the correct authority/lifetime transaction for each domain.

Examples:

- a spell/feature activation may resolve through `PendingResolution -> StateChange[] -> ResolutionEvent`;
- level-up and feat/class grants belong to the generic progression transaction (`ProgressionDraft -> Character revision commit`);
- RuleModule installation belongs to module/content activation and persistence authority;
- durable Character-owned state and session-authoritative runtime state remain distinct even when one resolution causes write-back.

Do **not** force progression, module installation, authoring, or other durable-source mutations into a fake combat Resolution merely to claim that there is one pipeline.

The unifying rule is: **one declarative rules model, one generic semantics vocabulary, and one authoritative mutation path per correctly-owned transaction domain — never a named-content side engine.**

---

## 5. Two axes must be tracked separately

The program has two independent dimensions. Future agents must not collapse one into the other.

### Axis A — capability pipeline maturity

For each rule-mechanism family, distinguish:

1. `SPEC` — representable in the persisted Common Play/profile contract;
2. `KERNEL` — generic trusted runtime semantics exist and are tested;
3. `PORTABLE` — an external RuleModule can import, validate, persist, rehydrate, and carry the semantics without loss;
4. `PRODUCTION` — the real application/session execution route invokes the generic semantics;
5. `MIGRATED` — corresponding obsolete named execution has been removed after parity;
6. `ACCEPTED` — unknown-ID/rename, authority, retry/reconnect, lifetime/persistence/Undo as applicable are proven end-to-end.

A Gate being `DONE` at the Kernel/foundation level does not automatically mean its semantics are fully portable or production-routed.

### Axis B — D&D expressive coverage

Gates A-M are a coverage map for mechanism classes that were identified because D&D contains difficult rules that a generic language must be able to represent safely.

A-M must not be reinterpreted as a mere chronological feature backlog or as a list that can be ignored because current legacy code happens not to exercise one of them.

---

## 6. Meaning of Gates A-E

Gates A-E are proven foundation/kernel capabilities. Their validated evidence should be reused rather than repeated without cause.

They cover, at minimum:

- A — reaction / interaction / semantic recalculation;
- B — multi-target saves and shared/per-target result composition;
- C — persistent effects and automatic event-triggered execution;
- D — Zone RuntimeArtifact, membership, frequency, and cleanup;
- E — spatial facts / target sets / movement legality through provider or manual authority without Core geometry fabrication.

Subsequent work should make these capabilities portable and production-authoritative where needed; it should not reopen their already-proven foundation design unless new evidence materially invalidates it.

---

## 7. Meaning of Gates F-M

Gates F-M were deliberately anticipated because D&D contains rule structures likely to exceed simpler compositions:

- F — maintained effects / concentration / suppression;
- G — selector + allocation runtime;
- H — object and link artifacts;
- I — actor artifact / summon runtime;
- J — form overlay / transformation;
- K — stored invocation / contingency-like behavior;
- L — mutable item lifecycle operations;
- M — source-bound state ownership where an actual mechanic needs it.

**Dormant means implementation is dormant, not that the coverage question may be forgotten.**

A gate must not be implemented speculatively merely because it exists. Existing primitives must be tried first. However, before Gate N final acceptance, each F-M gate must have an explicit disposition supported by a deterministic representative D&D scenario:

- `IMPLEMENTED` — the representative scenario proved a reusable missing semantic, the gate was activated, and the capability was implemented/verified;
- `PROVEN_UNNEEDED` — the representative scenario composes safely and cleanly from existing generic primitives, with a test proving that no new primitive is required;
- `EXPLICITLY_OUT_OF_SCOPE` — the owner/product scope explicitly declines that mechanism for the claimed V1 support boundary, and imported content requiring it is reported unsupported rather than silently approximated.

An unresolved `DORMANT/TBD` F-M gate is **not sufficient for Gate N entry**.

A deterministic coverage probe may come from either:

1. a real shipping/legacy migration failure; or
2. a deliberately selected representative D&D rule scenario when current SimpleVTT legacy code does not exercise the anticipated mechanism.

This prevents the architecture from proving only that it can reproduce SimpleVTT's historical named implementation subset while incorrectly claiming broad D&D portability.

---

## 8. Gate activation rule

A new generic primitive/capability may be added only when all relevant conditions are satisfied:

1. a concrete deterministic D&D/product scenario is captured;
2. composition with existing Common Play primitives is attempted first;
3. the existing composition is shown insufficient, ambiguous, unsafe, or authority/lifetime incorrect;
4. the missing concept is reusable beyond the named content that exposed it;
5. authority, lifetime, state ownership, failure behavior, and persistence implications are defined;
6. schema/evaluator parity and unsupported behavior can be tested;
7. the resulting design does not require named-content dispatch.

Do not add a primitive from imagination or from a content survey alone. Do not refuse to probe an anticipated F-M risk merely because no old named adapter currently reaches it.

---

## 9. Migration philosophy

Legacy execution is a behavior oracle and technical-debt ledger, not the roadmap's source of truth.

For a migrated behavior:

```text
existing named behavior oracle
        -> equivalent unknown/portable RuleModule definition
        -> validation + normalization
        -> generic lowering / Resolver or correct generic transaction domain
        -> production/session authority
        -> parity / identity invariance / recovery evidence
        -> delete only the absorbed named execution
```

Never keep a hidden compatibility fallback that routes supported portable mechanics back into the old named engine.

Migration should be organized by mechanism family, not by class, subclass, spell list, or content-name order.

---

## 10. Capability-family lens

When selecting or reviewing work, reason in reusable families such as:

- resource / action economy;
- tests / rolls / outcomes;
- damage / healing / HP;
- targeting / selectors / allocation;
- interactions / reactions / interceptors;
- persistent effects / triggers / frequency;
- spatial facts / zones / movement;
- items and mutable item state;
- progression / grants / choices;
- maintained effects, artifacts, summons, forms, stored invocations, and source-owned state when their coverage probes require them.

Named examples such as Action Surge, Cutting Words, Rage, Fireball, Shield, Wild Shape, a summon, or a magic item are **probes/oracles**, never primitive names or dispatch keys.

---

## 11. Gate N is final architecture acceptance

Gate N exists to prove that the preceding design is genuinely a portable D&D rule-execution language rather than a collection of isolated generic-looking tests.

Gate N may not begin until:

- the claimed V1-supported mechanism families have reached the required pipeline maturity;
- every anticipated F-M coverage area has an explicit `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` disposition;
- unsupported requirements fail explicitly instead of entering a hidden second engine.

Gate N must exercise an external RuleModule that did not exist when the app was built and must cross multiple content categories/mechanism families. Representative unknown content should include several of: spell, feat, class feature, item, condition, monster ability, or other portable entries.

Final acceptance requires:

- no source-code registration of those content IDs;
- no named React/session/resolver/runtime adapter;
- import/validation/normalization;
- generic execution;
- authoritative commit/write-back where relevant;
- persistence/reconnect/retry/Undo where relevant;
- UI projection/presentation;
- identity/name rename invariance;
- explicit unsupported/provider/manual behavior.

If changing only the external IDs/names changes mechanical semantics, Gate N fails.

---

## 12. Anti-drift instructions for future agents

Before changing architecture or choosing the next migration:

1. read this charter;
2. read `docs/rules/resolver-execution-checklist.md`;
3. reconcile current GitHub/Rerun evidence;
4. distinguish capability maturity from expressive coverage;
5. preserve already-proven evidence instead of redesigning from preference;
6. do not downgrade F-M into optional forgotten backlog;
7. do not proactively implement F-M without deterministic evidence;
8. do not mistake legacy deletion for the final product goal;
9. do not route to `main`; the product integration target remains `work/v1-composite` unless owner routing changes explicitly.

If a future agent believes a different architecture is materially better, it must first identify the concrete contradiction or failure in this charter/checklist and surface that decision to the owner. It must not silently substitute a new philosophy during routine execution.
