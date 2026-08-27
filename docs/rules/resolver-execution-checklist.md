# Common Play Resolver / Convergence Execution Checklist

Status: **CANONICAL PLAN FOR THIS WORKING BRANCH**  
Working branch: `agent/resolver-foundation-convergence`  
Integration target: `work/v1-composite`  
Owner direction: **finish the Common Play foundation through Gate E, then migrate legacy named execution into JSON/Common Play; activate Gate F-M only from concrete migration/product failures; finish with Gate N unknown-module E2E.**

This document is the single product-plan router for the Common Play / data-driven rule execution program on this branch. Rerun coordination files may point here, but must not duplicate this checklist.

---

## 1. Product goal

SimpleVTT must have one canonical rule-execution language and one authoritative execution pipeline:

```text
RuleModule / content JSON
        -> structural + semantic validation
        -> normalization / authoring sugar expansion
        -> Common Play IR
        -> generic Resolver / Runtime Kernel
        -> PendingResolution
        -> typed StateChange[]
        -> atomic authoritative commit
        -> session/runtime projection
        -> UI presentation
```

### Final invariant

A previously unknown external supported `Class`, `Subclass`, `Feat`, `Spell`, `Item`, condition, monster feature, or other RuleModule entry must execute through supported Common Play primitives **without adding a branch for its content ID/name in React, session code, or resolver/runtime code**.

Changing only the external content ID or display name must not change execution semantics.

Forbidden execution behavior:

```ts
if (spell.id === "known-spell") { ... }
if (subclass.id === "known-subclass") { ... }
if (content.name === "Known Feature") { ... }
```

Allowed trusted-engine behavior:

```ts
switch (operation.kind) {
  case "damage.apply": ...
  case "resource.change": ...
  case "artifact.spawn": ...
}
```

The engine is allowed to know generic primitive kinds, registered properties, timing points, capability contracts, RulesProfile policy, authority state, and typed runtime state. It must not know named game content in order to execute that content.

---

## 2. Architecture boundaries

### 2.1 Content is data

Named rules content belongs in versioned RuleModule/content JSON. Presentation labels, descriptions, icons, citations, localization, and catalog identity may remain named content. **Execution semantics may not depend on those names.**

### 2.2 Common Play is the single execution language

Authoring macros/sugar may normalize into Common Play IR. Runtime must execute the normalized IR, never a named authoring macro or named D&D feature directly.

### 2.3 Trusted engine code remains code

The goal is not "put the entire engine in JSON." Trusted TypeScript/Rust code implements finite generic primitives, validation, RulesProfile policy, authoritative state transitions, persistence, networking, and provider interfaces.

Imported JSON must never gain arbitrary JavaScript/eval/plugin execution merely to avoid adding a primitive.

### 2.4 One authoritative mutation path

Mechanically meaningful mutations go through `PendingResolution -> typed StateChange[] -> atomic commit`. React state, presentation adapters, or content-specific helpers must not become an alternate rule authority.

### 2.5 RulesProfile owns ruleset semantics

Edition/profile-specific semantics such as rounding, timing interpretation, registered property behavior, economy policy, and equivalent ruleset choices belong in RulesProfile/trusted registries rather than arbitrary content adapters.

### 2.6 Mapless first

Spatial automation is optional. Core asks semantic questions and receives semantic answers.

```text
Common Play request
      |
      +--> capability provider -> semantic answer/event
      |
      +--> manual authority ----> same semantic answer/event
      |
      v
same resolver path
```

Core must not fabricate coordinates, LOS, affected actors, legal destinations, or map geometry when no provider exists.

---

## 3. Global anti-regression rules

These rules apply immediately, before later migration finishes.

- [ ] **No new named execution adapter.** Do not add a new runtime/session/resolver branch whose purpose is to recognize a specific spell, class, subclass, feat, item, or feature.
- [ ] **No expansion of existing named adapters** unless the change is strictly required to preserve behavior while their generic replacement is being landed in the same migration slice.
- [ ] New supported content must first attempt composition from existing Common Play primitives.
- [ ] A new primitive requires one concrete deterministic failing scenario proving existing composition is unsafe or insufficient.
- [ ] A new primitive must be reusable across unrelated content IDs.
- [ ] Unknown external ID and ID-rename invariance are required for every new generic execution capability.
- [ ] Unsupported mechanics are explicit; never silently approximate while reporting full support.
- [ ] Schema/evaluator parity is mandatory for executable persisted kinds.
- [ ] Retry/reconnect/event replay must not double-spend or double-apply.
- [ ] Costs, frequency markers, resulting effects, and related state changes that form one resolution commit atomically or roll back together.
- [ ] UI never becomes the sole owner of rule-relevant state.

---

## 4. Program shape

The program is deliberately split into four phases so engine capability work and content migration are not confused.

```text
PHASE 1  FOUNDATION
F0 -> A -> B -> C -> D -> E
                         |
                         v
PHASE 2  LEGACY CONVERGENCE
named execution -> JSON/Common Play -> delete absorbed legacy path
                         |
                         +---- concrete unsupported mechanism ----+
                                                                  |
                                                                  v
PHASE 3  DEMAND-DRIVEN CAPABILITIES                          F .. M
                                                                  |
                                                                  v
PHASE 4  FINAL CONVERGENCE -------------------------------------- N
```

**Stop line:** proactive foundation building ends after Gate E. Gate F-M do not run merely because they are listed. They activate only from a bounded real migration/V1 scenario that cannot be represented safely with the existing contract.

---

# PHASE 1 — COMMON PLAY FOUNDATION

## F0 — Common Play Contract v0.2 — DONE

- [x] restricted declarative contract exists;
- [x] RuleModule/content JSON is the authoring/import surface;
- [x] typed operations/choices/facts/artifact/state concepts exist;
- [x] structural fixtures validate the persisted language.

## Gate A — Reaction / semantic recalculation — DONE

- [x] blocking reaction/interaction path;
- [x] payment availability and atomic spend;
- [x] semantic outcome recalculation;
- [x] stale/replay protection;
- [x] unknown external content proof.

## Gate B — Multi-target save + shared damage — DONE

- [x] multiple targets;
- [x] per-target saves;
- [x] shared authoritative roll support;
- [x] data-driven outcomes;
- [x] profile-owned rounding;
- [x] atomic damage pipeline.

## Gate C — Persistent Effect + automatic event trigger — DONE

- [x] persistent Effect runtime state;
- [x] authoritative event-triggered rule execution;
- [x] generic retaliation/automatic operation path;
- [x] explicit lifetime/consumption;
- [x] replay after consumption prevented.

## Gate D — Zone RuntimeArtifact + frequency + mapless membership — DONE

Canonical merge evidence: PR #137 merged at `406a9574d249bb770ec7725efa1384808ddc9bc3`.

- [x] `RuntimeArtifact` Zone state;
- [x] generic `artifact.spawn` path;
- [x] optional opaque external placement;
- [x] authoritative `zone.entered`, `zone.left`, `zone.turn-start`, `zone.turn-end` semantic events;
- [x] manual/spatial membership authority through the same state/event contract;
- [x] persistent idempotent membership;
- [x] once-per-turn frequency with atomic marker/result commit;
- [x] expiry/removal cleanup;
- [x] removed/expired Zone cannot produce later events;
- [x] unknown external Zone and ID-invariance proof.

### Deferred from Gate D

These are not hidden Gate-D requirements. Activate only from a concrete later scenario:

- [ ] actor-bound/aura anchor execution;
- [ ] Zone relocation + membership reconciliation after movement;
- [ ] hidden/DM-only Zone visibility policy.

## Gate E — Spatial Fact / Manual Authority execution — ACTIVE / REQUIRED FOUNDATION

Gate E is the final proactive foundation gate. It closes the mapless spatial-query side that complements Gate D's persistent spatial-state side.

### Gate E objective

A rule may require a semantic spatial answer without Core owning geometry. A provider-backed and a manual-authority answer must normalize into the same fact/selection/result contract and feed the same resolver path.

### Required bounded scenarios

#### E1 — Range fact

- [ ] Unknown external JSON ability declares a supported range requirement.
- [ ] With a spatial provider, provider answers the semantic range fact.
- [ ] Without a provider, the authorized manual authority receives a fact/adjudication request.
- [ ] Both answers normalize to the same Core fact result.
- [ ] Rule execution does not branch on the ability's ID/name.

#### E2 — Visibility / cover-like fact

- [ ] Unknown external JSON rule requests registered visibility/cover-like semantic facts.
- [ ] Core does not compute raycasts/geometry.
- [ ] Provider-backed and manual paths use the same typed fact boundary.
- [ ] Missing capability/authority fails explicitly rather than inventing a value.

#### E3 — Instantaneous area affected-target set

- [ ] Unknown external JSON action declares a supported instantaneous area shape/range as content metadata/targeting semantics.
- [ ] Without a spatial provider, authorized user selects the affected eligible actor set manually.
- [ ] The instantaneous effect does **not** create a fake temporary Zone merely to choose targets.
- [ ] The selected set enters the normal selector/resolution path deterministically.
- [ ] Provider-backed target determination, when available, converges on the same semantic target-set contract.

#### E4 — Legal destination / movement result

- [ ] Unknown external JSON movement operation requests a semantic legal-destination/movement result.
- [ ] Without a provider, DM/manual authority supplies the legal result rather than Core fabricating geometry.
- [ ] With a provider, automatic answer uses the same semantic result type.
- [ ] Unsupported movement shapes fail explicitly.

### Gate E authority requirements

- [ ] Fact/selection request identifies eligible authority/responder.
- [ ] Connected Host/session authority remains authoritative for shared resolution.
- [ ] Private/owner-only information is not exposed merely because a fact was requested.
- [ ] Duplicate response/event delivery is idempotent.
- [ ] Stale response is rejected.
- [ ] Reconnect/rebind cannot revive an already consumed/answered interaction.

### Gate E data/engine requirements

- [ ] Fact keys/capabilities are registered typed semantics, not arbitrary executable strings.
- [ ] Imported JSON may request supported fact kinds but may not define code for new fact evaluators.
- [ ] Manual and provider answers preserve provenance: requester, responder/provider, fact kind, answer, causation/resolution IDs.
- [ ] No named spell/feat/class/subclass/item branch is added.
- [ ] Unknown-ID fixture passes.
- [ ] Changing only the external ID/name preserves behavior.

### Gate E verification

- [ ] Concrete red scenario exists before implementation.
- [ ] Existing Common Play composition is attempted first.
- [ ] Smallest missing reusable capability only, if one is actually needed.
- [ ] Focused tests run at exact candidate SHA.
- [ ] Impacted Gate A-D regressions remain green.
- [ ] Connected-session regression runs if authority/interaction changes.
- [ ] Typecheck/build runs for touched surfaces.
- [ ] Exact SHA, environment, commands, pass/fail counts, workflow/job IDs are recorded.
- [ ] Gate E merges only after owner approval.

### Gate E completion transition

When Gate E is merged and green:

1. mark Foundation frozen through E;
2. do **not** automatically activate F;
3. begin Phase 2 Legacy Convergence;
4. use migration failures to decide whether any F-M gate must activate.

---

# PHASE 2 — LEGACY CONVERGENCE / STRANGLER MIGRATION

Status: **QUEUED AFTER GATE E**.

The purpose is not a big-bang rewrite. Existing named execution remains temporarily as a behavior oracle until each path is replaced and verified through JSON/Common Play. Then the absorbed named execution code is deleted.

## M0 — Freeze and inventory named execution

- [ ] Enumerate runtime/session/resolver/app code that recognizes known content IDs/names or imports known-content constants to decide execution semantics.
- [ ] Classify every finding:
  - `CONTENT/PRESENTATION` — allowed named data/label/catalog code;
  - `LEGACY_EXECUTION` — must migrate/delete;
  - `GENERIC_ENGINE` — allowed primitive/capability code;
  - `UNCLEAR` — requires architecture review before editing.
- [ ] Record file, symbol, recognized content identity, mechanism family, current tests, authority/lifetime dependencies, and likely Common Play composition.
- [ ] Add a narrow architecture guard for execution directories when feasible; allowlist content/presentation/fixtures rather than banning IDs repository-wide.

## M1 — Establish the generic migration harness

For every migrated legacy behavior, require the same harness:

- [ ] source behavior captured by deterministic golden test before deletion;
- [ ] equivalent RuleModule/content JSON fixture;
- [ ] validation + normalization to Common Play IR;
- [ ] generic resolver/session path executes it;
- [ ] arbitrary external ID version of the fixture also executes;
- [ ] ID/name-only rename preserves semantic result;
- [ ] legacy and generic behavior match on relevant state changes/authority/lifetime;
- [ ] once generic path is authoritative and regressions are green, remove the named execution branch/adapter;
- [ ] no compatibility fallback silently routes the same supported mechanic back into a named engine.

## M2 — Representative migration probes

Run representative mechanism probes before attempting broad deletion. Exact named content is chosen from existing shipping coverage, but the migration result must be generic.

### Probe S — simple action/resource/economy

- [ ] migrate one existing named path whose behavior should compose from existing operations;
- [ ] prove no new primitive is required;
- [ ] delete its named execution path after parity.

### Probe R — reaction / cross-owner interceptor

- [ ] use the existing remote-owner Cutting Words scenario/test concept as a **golden behavior probe**, not as permission to extend the Cutting Words adapter;
- [ ] express responder eligibility, timing, payment, reaction economy, owner authority, roll/outcome modification, retry/reconnect/Undo through generic contracts;
- [ ] if existing Gate A/Common Play composition is insufficient, capture the exact generic failure before activating a new capability;
- [ ] never add a `Cutting Words` primitive or content-name branch.

### Probe P — persistent effect/event

- [ ] migrate one existing persistent named execution path through Gate C primitives;
- [ ] prove lifetime/cleanup/replay parity;
- [ ] remove absorbed named adapter.

### Probe X — spatial rule

- [ ] migrate one existing spatially constrained or area-like content definition through Gate D/E;
- [ ] prove providerless/manual path and provider semantic parity;
- [ ] remove absorbed named execution path.

## M3 — Capability-family migration waves

After representative probes, migrate remaining V1-supported named execution by mechanism family, not class/subclass/content-list order.

Suggested families:

- [ ] action/resource/economy;
- [ ] reactions/interceptors/roll modification;
- [ ] saves/checks/damage/healing;
- [ ] persistent effects/triggers;
- [ ] spatial targeting/facts/zones;
- [ ] maintained effects if activated;
- [ ] selector/allocation if activated;
- [ ] artifacts/summons/forms/items when their gates activate.

For each family:

- [ ] migrate smallest coherent set;
- [ ] run focused golden parity;
- [ ] run unknown-ID/rename invariance;
- [ ] delete only the named execution code now made obsolete;
- [ ] keep unrelated named data/presentation code;
- [ ] update inventory status.

## M4 — Legacy execution exit criteria

Phase 2 is not complete until, for every feature SimpleVTT claims as V1-supported:

- [ ] execution enters through RuleModule/content JSON or normalized portable content;
- [ ] resolver/session behavior depends only on generic mechanics/capabilities/state;
- [ ] no known content ID/name is required to select the execution algorithm;
- [ ] corresponding obsolete named runtime adapters/branches are deleted;
- [ ] generic path owns connected authority, retry/reconnect, persistence/lifetime and Undo behavior where applicable;
- [ ] unsupported legacy content is explicitly marked unsupported rather than kept alive by a hidden second engine.

---

# PHASE 3 — DEMAND-DRIVEN CAPABILITY GATES

Status: **DORMANT UNTIL A CONCRETE FAILURE ACTIVATES ONE**.

## Activation rule for Gate F-M

A gate may move to `ACTIVE` only when all are true:

1. an actual Phase-2 migration or concrete V1 product path is captured as a deterministic bounded scenario;
2. composition with existing Common Play primitives is attempted and shown insufficient/unsafe;
3. the missing concept is reusable beyond the named content that exposed it;
4. authority/lifetime/state ownership is defined;
5. owner direction authorizes that gate implementation.

Do not activate a gate from a survey, completeness argument, or because it is next alphabetically.

## Gate F — Maintained effects / concentration / suppression — PLANNED

Candidate scope only after activation:

- maintained-source lifetime;
- interruption/termination;
- suppress vs remove semantics;
- parent/child cleanup without implicit over-deletion.

## Gate G — Selector + Allocation runtime — PLANNED

Candidate scope only after activation:

- deterministic multi-selection;
- fixed-pool allocation across targets;
- selector scope/type validation;
- no arbitrary query language.

## Gate H — Object and Link artifacts — PLANNED

Candidate scope only after activation:

- object-like artifacts for barriers/walls where Zone/Actor is wrong;
- portal/link artifact semantics;
- mapless semantic interaction/events.

## Gate I — Actor artifact / summon runtime — PLANNED

Candidate scope only after activation:

- declarative actor spawn/despawn;
- ownership/control/lifetime;
- manual placement fallback;
- no named summon resolver.

## Gate J — Form overlay / transformation — PLANNED

Candidate scope only after activation:

- form state distinct from durable Character replacement;
- restoration/lifetime;
- property/resource projection policy;
- reconnect/Undo safety.

## Gate K — Stored invocation / contingency-like behavior — PLANNED

Candidate scope only after activation:

- captured invocation/content reference;
- snapshot vs live binding semantics;
- later trigger/consumption;
- exactly-once execution.

## Gate L — Item lifecycle operations — PLANNED

Candidate scope only after activation:

- create/copy/consume/destroy/update mutable ItemInstance state;
- charges/resources/payments atomic with results;
- durable vs session ownership explicit.

## Gate M — Source-bound state ownership — DEFERRED

Candidate scope only after activation:

- source-owned state such as source-specific temporary state when an actual scenario needs it;
- smallest authoritative ownership/capture model;
- never infer ownership from an unrelated scalar field.

---

# PHASE 4 — FINAL CONVERGENCE

## Gate N — Cross-mechanism capability matrix / unknown-module E2E — REQUIRED FINAL GATE

Gate N verifies the actual product promise rather than one mechanism in isolation.

### N1 — Unknown external module import

- [ ] Create/import a RuleModule that did not exist when the app was built.
- [ ] Module uses only capabilities declared supported by the current app/profile.
- [ ] Module validates and normalizes without source-code registration of its content IDs.

### N2 — Full execution graph

- [ ] RuleModule/content JSON
- [ ] validation/normalization
- [ ] Common Play IR
- [ ] generic Resolver
- [ ] PendingResolution
- [ ] typed StateChange[]
- [ ] authoritative session commit
- [ ] owner write-back/persistence where applicable
- [ ] UI projection/presentation

All execute end-to-end without a named content branch.

### N3 — Identity invariance

- [ ] Change every external content ID/name while preserving declared mechanics.
- [ ] Re-run the module.
- [ ] Semantic execution results remain equivalent except expected provenance/identity labels.

### N4 — Cross-mechanism matrix

Include representative combinations from supported capabilities, such as:

- [ ] interaction/reaction + resource payment + roll modification;
- [ ] multi-target selection + saves + shared/per-target results;
- [ ] persistent effect + automatic event + cleanup;
- [ ] Zone/membership + frequency;
- [ ] spatial fact/manual authority + instantaneous area selection;
- [ ] any F-M capability actually activated for V1.

### N5 — Capability failure behavior

- [ ] Unsupported requested capability is reported explicitly.
- [ ] Missing optional provider uses agreed manual fallback where supported.
- [ ] No provider/manual authority path fabricates an answer.
- [ ] Imported content that cannot execute safely remains inspectable/round-trippable when appropriate but is not reported fully supported.

### N6 — No-edit acceptance

Adding the unknown supported module requires:

- [ ] zero React feature branches;
- [ ] zero session feature branches;
- [ ] zero resolver named-content branches;
- [ ] zero new feature-specific runtime adapter;
- [ ] zero rebuild-time content registration beyond loading/importing the module through the supported catalog path.

Gate N is the final architecture convergence acceptance for V1-supported rules execution.

---

## 5. Gate / migration Definition of Done

Every executable gate or migration slice must satisfy the applicable items below.

### Scenario and contract

- [ ] one concrete scenario is named;
- [ ] expected input/state/trigger/output is deterministic enough to test;
- [ ] existing primitives are tried first;
- [ ] any new primitive is the smallest reusable missing semantic;
- [ ] unsupported shapes are explicit;
- [ ] schema/evaluator parity is preserved.

### Runtime

- [ ] unknown external ID executes;
- [ ] ID/name-only change preserves behavior;
- [ ] no named content branch selects execution behavior;
- [ ] typed StateChanges own mutations;
- [ ] atomicity holds;
- [ ] duplicate/retry is idempotent where applicable;
- [ ] persistence/lifetime/cleanup is explicit where applicable;
- [ ] reconnect/Undo semantics are covered where applicable.

### Capability/fallback

- [ ] optional provider absence is tested;
- [ ] manual fallback reaches the same semantic Core boundary where supported;
- [ ] unsupported fallback is explicit rather than fabricated.

### Verification evidence

A test file existing is not evidence that it passed.

Required record for executable work:

```text
head: <exact SHA>
environment: <OS/runtime/toolchain>
command: <exact command>
result: <pass/fail and counts>
artifact/run: <workflow/job/artifact if applicable>
```

- [ ] focused test executed at exact candidate SHA;
- [ ] justified impacted regressions executed;
- [ ] typecheck/build executed for changed surfaces;
- [ ] connected/persistence/Windows-specific evidence executed when the change actually depends on those environments;
- [ ] unavailable required environment is `VERIFICATION BLOCKED`, never inferred green;
- [ ] unrelated CI red is classified separately;
- [ ] final diff is reviewed for named-content leakage and drive-by cleanup;
- [ ] owner approval precedes merge where approval is required.

---

## 6. ChatGPT / Codex execution boundary

### ChatGPT owns

- architecture/mechanism review;
- deciding whether a migration failure actually needs a new primitive/gate;
- Common Play/RulesProfile/provider/authority boundaries;
- gate contract and acceptance scenarios;
- review of actual PR diff/evidence for named-content leakage and scope drift.

### Codex owns after the contract is bounded

- repository-dependent implementation;
- schema/validator/evaluator changes;
- focused refactors;
- migration wiring and deletion of newly obsolete named execution;
- fixtures/tests;
- compile/build/test failure diagnosis;
- exact-SHA executable verification;
- PR preparation and concrete unresolved code constraints.

### Stop and return to design if

- a named-content branch appears necessary;
- a new primitive appears necessary but no reusable contract is defined;
- authority/lifetime ownership is ambiguous;
- current contracts conflict;
- a broad schema/protocol redesign appears necessary;
- multiple materially different product behaviors remain possible.

---

## 7. Current repository decisions

- Gate D is `DONE` on canonical history.
- Gate E is the current next foundation gate.
- The previous post-Gate-D rule that automatically returned to named-feature/V1 R2 implementation is superseded by this owner direction.
- PR #140's remote-owner Cutting Words test scenario is useful migration evidence; the PR's adapter-local named implementation direction is **not** the architecture to merge as the final solution.
- The old resolver-checklist PR #139 is superseded by this rewritten plan once this branch is used as the Rerun source.
- `main` is not the safe integration target for this planning change while it remains historically diverged from `work/v1-composite`; deliberate branch-history promotion is a separate repository operation.

---

## 8. Current next action

1. Treat Gate E as `ACTIVE`.
2. Capture the smallest executable Gate-E scenarios E1-E4 against the current Common Play contract and implementation.
3. Prove which pieces compose already and identify only concrete missing generic capability.
4. Freeze the bounded Gate-E implementation packet.
5. Implement/verify Gate E without named-content branches.
6. After owner-approved Gate-E merge, begin Phase 2 M0 inventory and migration harness.
7. Do not start Gate F merely because Gate E completes.
