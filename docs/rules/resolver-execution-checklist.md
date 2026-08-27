# Common Play Resolver Execution Checklist

Status: **CANONICAL RULES/RESOLVER EXECUTION ROUTER**  
Owner priority: **Common Play / data-driven rules resolver**  
Canonical integration target: `work/v1-composite`  
Last structured review: **2026-08-28 Asia/Seoul**

This document is the single execution router for the Common Play / Rules Resolver program. It records **what the resolver must ultimately do, what is already implemented, what is only planned, how work is divided between ChatGPT and Codex, and what must be true before a gate is considered complete**.

It does not replace detailed contracts such as `common-play-contract-v0.2.md`, the broader rules architecture in `README.md`, or release checklists. It routes work into those sources of truth and prevents future sessions from reconstructing the plan from chat history.

---

## 1. North star

The product goal is:

```text
RuleModule / content JSON
        -> validation + normalization
        -> Common Play IR
        -> generic Resolver / Runtime Kernel
        -> PendingResolution
        -> typed StateChange[]
        -> atomic authoritative commit
        -> session/runtime projection
```

The resolver is the executable core. The Common Play contract is its machine-verifiable instruction language. Authoring sugar/macros may normalize into Common Play IR, but runtime never executes named content or authoring macros directly.

### Final acceptance invariant

A previously unknown external `Class`, `Subclass`, `Feat`, `Spell`, `Item`, or other supported RuleModule entry must be able to use supported Common Play primitives **without adding a content-name branch to React, session code, or the resolver**.

Changing only the external content ID must not change execution semantics.

Forbidden examples:

```ts
if (spell.id === "cloudkill") { ... }
if (subclass.id === "battle-master") { ... }
if (content.name === "Shield") { ... }
```

Allowed behavior is driven by declared mechanics, registered capabilities, RulesProfile policy, authoritative facts, and typed runtime state.

---

## 2. Source-of-truth and priority rules

Use sources in this order for Common Play / resolver work:

1. explicit current owner direction;
2. this checklist for gate order, ownership, and current resolver status;
3. `docs/rules/common-play-contract-v0.2.md` for the persisted Common Play contract;
4. `docs/rules/README.md` for broader rules architecture;
5. active GitHub Issue / branch / PR for the implementation slice;
6. `.agents/` only for continuation pointers and non-canonical coordination.

An older `.agents/V1_CURRENT_HANDOFF.md` or release item must not silently cancel a later explicit owner priority change. Conversely, this resolver program must not erase unrelated historical release work; those queues remain separate until the owner returns to them.

When repository state and chat memory conflict, repository state wins unless the owner explicitly changes the requirement.

### Rerun integration

ChatGPT Rerun must route Common Play / Resolver work to this exact file:

`docs/rules/resolver-execution-checklist.md`

Rerun integration follows these rules:

- `.chatgpt-rerun/PLAN.md` points directly to this file and instructs future authorized resolver runs to read and follow it before selecting work;
- `.chatgpt-rerun/STATE.md` stores only resumable evidence and a pointer back to this checklist, not a copied resolver plan;
- `.chatgpt-rerun/control.json` remains dispatch authorization only and must not override a later explicit owner priority with stale task prose;
- Rerun must use this document's current active gate / `Current next action`, ChatGPT/Codex handoff rules, and Definition of Done;
- changing the Rerun routing never by itself authorizes execution; `control.json` must still explicitly allow continuation;
- when this checklist changes gate or owner priority, Rerun routing should be reconciled without duplicating the changed product specification inside `.chatgpt-rerun/`.

---

## 3. Hard architectural invariants

Every gate must preserve all of the following unless the owner explicitly changes the architecture.

- **Content is data.** Named D&D content is never a resolver branch.
- **Common Play is engine-agnostic.** No Roblox-only, React-only, VTT-only, or PHB-only execution primitive.
- **RulesProfile owns edition semantics.** Rounding, registered properties, timing semantics, capability interpretation, economy policy, and similar edition rules do not leak into arbitrary UI/runtime code.
- **Typed StateChanges are authoritative.** Do not use unrestricted JSON Patch as the rules mutation language.
- **Resolution is atomic.** Costs, effects, frequency markers, artifact changes, and resulting state changes that belong to one resolution commit together or roll back together.
- **Retry/reconnect is idempotent.** Duplicate trigger delivery, interaction response, or event replay must not spend or apply twice.
- **Unsupported is explicit.** A missing capability may fall back to supported DM-assisted/manual execution or report unsupported; the core never silently invents an answer.
- **Spatial capability is optional.** The rules core never requires battlemap coordinates, pathfinding, line-of-sight geometry, or point-in-zone calculations.
- **UI is not the authority.** React/local component state must not become the only owner of rule-relevant session state.
- **One concrete failure before one new primitive.** Do not grow the DSL from imagination. First reproduce a real mechanism that cannot be composed safely from existing primitives.
- **Schema/evaluator parity.** Persisted executable operation kinds and trusted evaluator kinds must not drift.

---

## 4. Mapless-first execution invariant

A spatial module is an optional automation provider, not a prerequisite for spell/rule execution.

The same content definition must work in both modes:

```text
Common Play rule
      |
      v
semantic spatial question/event
      |
      +--> Spatial Provider -> automatic answer/event
      |
      +--> Manual Authority -> DM/user answer/event
      |
      v
same Resolver path
```

### 4.1 Instantaneous area effects

When no spatial provider exists, an instantaneous sphere/cone/line/cube/cylinder-like effect uses a **manual affected target set**. It does not create a temporary fake Zone merely to select targets.

The shape/range data remains in content for a future spatial provider; mapless execution asks the authorized user which eligible actors are affected.

### 4.2 Persistent areas / zones

Persistent areas use a real `RuntimeArtifact` of kind `zone` plus authoritative membership state.

Membership authority can be:

- `spatial`: an external provider derives membership;
- `manual`: the DM/user explicitly enters/leaves actors;
- later, a hybrid provider may combine automatic results with explicit override if a concrete requirement proves it necessary.

Both providers emit the same semantic transitions. Minimum supported event family for the Zone gate:

```text
zone.entered
zone.left
zone.turn-start
zone.turn-end
```

A single manual `enter` persists membership. The DM must not have to re-click the actor every turn merely to make turn-start/turn-end rules fire.

### 4.3 Spatial facts

Range, visibility, cover, legal destination, adjacency, route obstruction, and similar questions are semantic facts, not coordinates owned by Core.

With a provider: answer automatically.  
Without a provider: ask the authorized DM/user through the existing Fact/Interaction/Adjudication model when the mechanic can be supported manually.

### 4.4 Movement

Content may declare semantic movement such as push/pull/teleport/relocate. Without a spatial provider, the actual legal result is DM-assisted rather than fabricated by Core.

### 4.5 Vision and membership remain separate

Being inside Fog/Darkness/another Zone does not automatically mean `canSee = false`. Membership and visibility are different authoritative facts and must remain composable with RulesProfile and other effects.

---

## 5. ChatGPT / Codex division of labor

The default objective is to spend Codex effort on repository-dependent implementation rather than open-ended product architecture.

### 5.1 ChatGPT owns broad design work

Use ChatGPT for:

- mechanism-family surveys across spells/features/items;
- identifying missing abstractions and contradictory requirements;
- Common Play primitive/IR semantics;
- RulesProfile vs Core vs provider ownership boundaries;
- mapless/manual fallback design;
- UX state/authority design before code exists;
- gate sizing and dependency ordering;
- acceptance criteria and invariants;
- deciding whether a proposed new primitive is actually necessary;
- reviewing a Codex PR for architectural leakage, over-engineering, named-content branches, missing failure paths, or unsupported claims.

ChatGPT should **not** hand Codex a broad prompt such as "analyze all spells and design a generic engine" when the architecture is still open.

### 5.2 Codex owns implementation-heavy work

Use Codex after the gate contract is sufficiently fixed for:

- reading the relevant repository implementation in depth;
- TypeScript/schema/validator implementation;
- focused refactors required by the gate;
- fixtures and regression tests;
- compile/type/build/test failures;
- CI diagnosis;
- minimal migrations or compatibility wiring required by the accepted contract;
- preparing the implementation PR and reporting concrete unresolved code constraints.

### 5.3 Return-to-design conditions

Codex must stop expanding scope and return the problem to ChatGPT/owner when any of these occurs:

- the accepted scenario cannot be expressed without a new Common Play primitive;
- two current contracts require contradictory behavior;
- satisfying the task appears to require a named-content branch;
- authority/persistence/lifetime ownership is undefined;
- a spatial capability is absent and the fallback behavior is not specified;
- a requested change would require a broad schema/protocol redesign not present in the task packet;
- multiple materially different product behaviors remain possible.

Do not spend Codex tokens inventing the missing product decision.

### 5.4 Token-efficiency rules

- One implementation gate or tightly related correction per Codex task.
- Give Codex exact source files/contracts to read when known.
- Give observable acceptance tests before asking for implementation.
- Reuse already validated regressions; do not ask Codex to re-prove the entire historical matrix on every gate.
- Run narrow tests first, then only the broader repository gates justified by the change.
- Keep unrelated cleanup, dependency upgrades, and speculative abstractions out of the implementation task.

---

## 6. Standard gate lifecycle

Every executable mechanism gate follows this loop:

```text
1. Concrete table/content scenario
        |
        v
2. ChatGPT mechanism review
        |
        v
3. Try composition with existing Common Play
        |
        +--> works -> no new primitive
        |
        +--> cannot work safely -> smallest reusable primitive
        |
        v
4. Freeze gate contract + acceptance criteria
        |
        v
5. Codex implementation task packet
        |
        v
6. Focused tests -> broader justified CI
        |
        v
7. ChatGPT architecture review of actual diff/PR
        |
        +--> design gap -> return to step 2
        |
        v
8. Owner-approved merge
```

A gate is not complete because a schema fixture parses. It is complete only when the supported path executes through the runtime and its acceptance tests prove the intended authority, state, failure, and retry behavior.

---

## 7. Per-gate Definition of Done

Unless the gate is explicitly structural-only, check all applicable items.

### Contract

- [ ] Concrete failing scenario is documented.
- [ ] Existing primitives were tried before adding a new one.
- [ ] Any new primitive is reusable and not named-content-specific.
- [ ] Unsupported shapes fail explicitly.
- [ ] Persisted schema and trusted evaluator support remain aligned.

### Runtime

- [ ] Unknown external content ID executes successfully.
- [ ] Renaming/changing only that external ID preserves behavior.
- [ ] No React/session/runtime branch checks a spell/class/subclass/feat/item name or known content ID.
- [ ] State mutation goes through typed StateChanges / authoritative runtime state.
- [ ] Multi-change resolution is atomic.
- [ ] Duplicate/retry behavior is idempotent when applicable.
- [ ] Lifetime/expiry/cleanup is explicit when persistent state exists.
- [ ] Reconnect/session persistence is covered when state survives more than one immediate resolution.

### Capability/fallback

- [ ] Missing optional capability is tested.
- [ ] If supported manually, the manual path reaches the same semantic resolver event/fact contract.
- [ ] If not supportable manually, the result is explicit `unsupported` rather than fabricated automation.

### Verification

- [ ] Focused regression test passes.
- [ ] Existing Gates A..current focused regressions remain green where impacted.
- [ ] Typecheck/build passes for changed application surfaces.
- [ ] Relevant connected/persistence gate passes when authority/persistence changed.
- [ ] Unrelated pre-existing CI failures are reported separately instead of being folded into the gate.
- [ ] ChatGPT reviews the final PR against this checklist before merge.
- [ ] Merge occurs only after owner approval.

---

## 8. Master execution checklist

Status meanings:

- `DONE`: merged into `work/v1-composite` with required evidence.
- `ACTIVE`: current implementation/design gate.
- `PLANNED`: known mechanism family with concrete reason to cover, but exact primitive set is not frozen.
- `PROPOSED`: candidate mechanism family; activate only when a concrete scenario justifies it.
- `DEFERRED`: deliberately held until a prerequisite/authority model exists.

### Foundation

- [x] **F0 — Common Play Contract v0.2** (`DONE`)
  - CastProcess, PaymentContract, semantic slots, Selector/AllocationPlan, typed binding, Fact/Consent, RuntimeArtifact lifetime, Interaction/idempotency contracts.
  - Structural fixtures validate the initial language.

### Implemented runtime gates

- [x] **Gate A — Reaction / semantic recalculation** (`DONE`)
  - generic blocking reaction choice;
  - payment availability and atomic spend;
  - semantic `attack.outcome` recalculation;
  - stale/replay protection;
  - unknown external content fixture.

- [x] **Gate B — Multi-target save + shared damage** (`DONE`)
  - multiple targets;
  - per-target saves;
  - one shared authoritative damage roll;
  - data-driven outcome behavior;
  - RulesProfile-owned rounding;
  - atomic existing damage pipeline.

- [x] **Gate C — Persistent Effect + automatic event trigger** (`DONE`)
  - persistent Effect runtime state;
  - authoritative positive `damage.taken` trigger;
  - automatic retaliation through generic rule operation;
  - event lifetime destruction;
  - replay after consumption prevented.

### Active gate

- [ ] **Gate D — Zone RuntimeArtifact + frequency + mapless membership** (`ACTIVE`; implementation validated on Issue #136 / PR #137, awaiting owner-approved merge)

Implemented/proven on PR #137:

- [x] first narrow `artifact.spawn` operation;
- [x] first-class `RuntimeArtifact` zone state;
- [x] opaque optional external placement support;
- [x] authoritative `zone.entered` / `zone.left` / `zone.turn-start` / `zone.turn-end` semantic event path;
- [x] per-rule + subject + active-turn `once-per-turn` frequency;
- [x] frequency marker and resulting damage in one atomic resolution;
- [x] elapsed-duration expiry and artifact removal;
- [x] unknown external zone fixture, content-ID invariance, and focused runtime regressions;
- [x] authoritative session-runtime Zone membership state outside artifact metadata/UI-local state;
- [x] `manual` and `spatial` membership authority through one semantic state/event contract;
- [x] persistent idempotent enter/leave with real-transition-only events;
- [x] membership-driven authoritative turn-start/turn-end execution without repeated DM entry actions;
- [x] Zone removal/expiry atomically cleans membership;
- [x] removed/expired Zones cannot produce later membership/turn events;
- [x] manual and spatial-provider inputs converge on the same Common Play Zone rule executor;
- [x] temporary Gate D diagnostics removed;
- [x] Gate-D-caused type/session integration regressions resolved without weakening typed StateChanges.

Evidence pointer: PR #137 head `134d2b88af707ee2e247372e25cec9630442d5d6`. Contract validation, Rules Domain (including focused Gate D + canonical typecheck), UI build, Phase 11 offline/full-frontend gate, and Phase 12 connected-session authority/full-frontend gate are green. Persistence remains red only on the pre-existing builtin-catalog count baseline (`501 !== 496`); the Gate D diff does not own that generator/expectation.

Gate D still requires only lifecycle step 8: **explicit owner approval and merge**. Do not mark it `DONE` before that merge lands in `work/v1-composite`.

Explicitly reviewed but deferred from Gate D until a concrete failing scenario requires them:

- [ ] actor-bound/aura anchor execution;
- [ ] Zone relocation + membership reconciliation after movement;
- [ ] hidden/DM-only Zone visibility policy.

### Next mechanism families

The following are ordered candidates, not permission to pre-build a giant DSL. Each becomes an implementation gate only after ChatGPT captures one or more concrete table/content scenarios and proves the existing contract insufficient.

- [ ] **Gate E — Spatial Fact / Manual Authority execution** (`PLANNED`)
  - range checks;
  - visibility/LOS-like fact requests without Core geometry;
  - cover-like profile facts;
  - legal destination checks;
  - manual affected target-set authority for instantaneous areas;
  - DM-assisted movement result when no provider exists.

- [ ] **Gate F — Maintained effects / concentration / suppression** (`PLANNED`)
  - maintained-source lifetime;
  - interruption/termination;
  - suppress vs remove semantics;
  - parent/child cleanup without implicit over-deletion.

- [ ] **Gate G — Selector + Allocation runtime** (`PLANNED`)
  - deterministic multi-selection;
  - fixed-pool allocation across targets;
  - validate selector scope/type;
  - no arbitrary query language.

- [ ] **Gate H — Object and Link artifacts** (`PLANNED`)
  - walls/barriers represented as object-like artifacts rather than fake actors/zones when appropriate;
  - portals/links represented as link artifacts;
  - interaction/event paths remain semantic when mapless.

- [ ] **Gate I — Actor artifact / summon runtime** (`PLANNED`)
  - spawn/despawn actor through declarative content;
  - ownership/control/lifetime;
  - manual placement fallback;
  - no named summon resolver.

- [ ] **Gate J — Form overlay / transformation** (`PLANNED`)
  - form state distinct from replacing the durable Character source;
  - restoration/lifetime;
  - property/resource projection rules;
  - reconnect/undo safety.

- [ ] **Gate K — Stored invocation / contingency-like behavior** (`PLANNED`)
  - capture invocation/content reference;
  - snapshot/live binding rules;
  - later trigger and consumption;
  - exactly-once execution.

- [ ] **Gate L — Item lifecycle operations** (`PLANNED`)
  - create/copy/consume/destroy/update mutable ItemInstance state;
  - charges/resources and payments atomic with results;
  - durable vs session ownership explicit.

- [ ] **Gate M — Source-bound state ownership** (`DEFERRED from Gate C`)
  - concrete scenario required for source-owned temporary HP or equivalent state;
  - do not infer source ownership from the current scalar temp-HP field;
  - add the smallest authoritative ownership/capture model only when required.

- [ ] **Gate N — Cross-mechanism capability matrix / unknown-module E2E** (`PLANNED final convergence`)
  - combine representative mechanics without named-content branches;
  - mapless and provider-backed capability paths;
  - unsupported capability reporting;
  - external RuleModule creation/import -> resolved graph -> resolver -> session runtime;
  - verify that adding a previously unknown supported module does not require React/session TypeScript edits.

---

## 9. Mechanism survey backlog for ChatGPT

Before activating later gates, use concrete examples to challenge the current language. The purpose is to discover the **smallest missing reusable mechanic**, not to reproduce every named spell.

- [ ] instantaneous single-target attack/save/check effects;
- [ ] instantaneous multi-target and area target sets;
- [x] persistent zones and moving/actor-bound auras reviewed; persistent mapless membership is validated on PR #137, while moving/actor-bound execution remains deferred;
- [ ] walls/objects/portals;
- [ ] range/visibility/cover/destination facts;
- [ ] push/pull/teleport and blocked movement;
- [ ] repeated saves and periodic effects;
- [ ] concentration/maintained/suppressed effects;
- [ ] healing/temp HP/source ownership;
- [ ] resource-powered optional effects;
- [ ] projectile/charge/allocation mechanics;
- [ ] summons and controlled actors;
- [ ] transformations/forms;
- [ ] stored invocation/contingency;
- [ ] item creation/consumption/copy/destruction;
- [ ] information/divination/illusion requiring DM-assisted adjudication;
- [ ] consent/willing-target flows;
- [ ] hidden/DM-only facts and visibility;
- [ ] reconnect/retry/undo of persistent results;
- [ ] explicit unsupported mechanic behavior.

A checked survey item means the mechanism family has been reviewed against the current contract. It does **not** automatically mean a new runtime gate is needed.

---

## 10. Codex Task Packet template

When a gate moves from design to implementation, ChatGPT should hand Codex a bounded packet in this form.

```text
CODEX TASK

Repository:
Kaetaeru/SimpleVTT

Base:
work/v1-composite

Issue / branch:
<issue>
<branch>

Objective:
<one concrete runtime outcome>

Read first:
<repo rules>
<contract/spec>
<relevant implementation/tests>

Concrete failing scenario:
<table/content scenario>

Required behavior:
- ...

Architectural invariants:
- no named-content branch
- preserve atomicity/idempotency
- preserve mapless fallback contract
- ...

Do not:
- invent new primitives unless the scenario cannot be expressed
- add speculative framework layers
- refactor unrelated code
- bypass typed StateChanges
- make UI component state authoritative

Expected implementation areas:
- ...

Acceptance tests:
- unknown external ID
- ID rename invariance
- positive path
- missing capability/manual fallback or explicit unsupported path
- duplicate/retry path when applicable
- cleanup/expiry path when applicable

Regression gates:
- focused ...
- typecheck/build if touched
- connected/persistence only if authority/lifetime changed

STOP AND REPORT TO CHATGPT/OWNER IF:
- a new Common Play primitive appears required
- current contracts conflict
- authority/lifetime is undefined
- named-content branching appears necessary
- there are multiple materially different product choices

Deliver:
- smallest implementation diff
- tests
- exact validation results
- PR
- unresolved architectural questions only
```

---

## 11. ChatGPT PR review checklist

After Codex implementation and before owner-approved merge, review the actual diff rather than the task description.

- [ ] Does the implementation satisfy the concrete scenario rather than only the fixture shape?
- [ ] Did any named content identity leak into runtime/app/UI behavior?
- [ ] Did the implementation accidentally create a second source of truth?
- [ ] Are authority, persistence, and lifetime explicit?
- [ ] Does missing spatial/provider capability have the agreed fallback?
- [ ] Is manual fallback semantically equivalent to provider-backed execution at the Core boundary?
- [ ] Are duplicate delivery and stale state safe?
- [ ] Do costs/frequency/effects/cleanup commit atomically where required?
- [ ] Was a new abstraction added without a scenario that needs it?
- [ ] Are unsupported cases rejected explicitly?
- [ ] Are unrelated CI failures clearly separated?
- [ ] Is the PR free of temporary diagnostics and drive-by cleanup?
- [ ] Is the documentation/checklist status updated if the gate actually closed?

---

## 12. Checklist maintenance policy

This file must remain useful as a router, not become another historical log.

When a gate changes:

1. update only its status, acceptance delta, and concrete evidence pointer;
2. move detailed implementation history to the Issue/PR rather than expanding this file indefinitely;
3. do not duplicate this checklist into `.agents/` or `.chatgpt-rerun/`;
4. if a new mechanism family appears, add it as `PROPOSED` first unless a concrete failing scenario already exists;
5. if gate order changes, record the prerequisite reason;
6. if the owner changes priority, update the `Owner priority` field and active gate rather than rewriting unrelated release history;
7. reconcile Rerun PLAN/STATE routing pointers when owner priority changes, but keep product details canonical here;
8. never mark a gate `DONE` from green CI alone if owner/manual acceptance is part of that gate's explicit Definition of Done.

### Current next action

```text
Owner: decide whether PR #137 should merge into work/v1-composite.
       -> Gate D implementation and architecture review are complete on the PR branch
       -> merge is still prohibited without explicit owner approval

ChatGPT: do not repeat Gate D implementation or validation unless PR #137 head changes or a new regression appears
         -> if the owner approves merge, merge only the approved PR/head and then mark Gate D DONE after canonical reconciliation
         -> do not activate Gate E from this checklist alone; first capture a concrete spatial-fact/manual-authority scenario and freeze a bounded gate

Codex: no further Gate D implementation work is currently authorized.
```