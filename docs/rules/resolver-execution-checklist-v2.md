# Common Play Resolver / D&D Execution Language Checklist v2

Status: **CANONICAL PRODUCT PLAN FOR THIS RERUN**  
Working branch: `agent/resolver-foundation-convergence`  
Integration target: `work/v1-composite`  
Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`

This document supersedes `docs/rules/resolver-execution-checklist.md` as the active product-plan router. The older checklist remains useful historical/evidence detail for completed Gates A-E and prior migrations, but it must not override the architecture charter or this v2 plan.

The intent is deliberately explicit so a later agent cannot silently reinterpret the project as merely deleting legacy adapters, implementing only currently-shipping named features, or abandoning anticipated D&D capability coverage.

---

## 1. Product promise

SimpleVTT is building a **declarative D&D rule-execution language and generic Resolver**.

A previously unknown external RuleModule containing a supported Spell, Feat, Class/Subclass Feature, Item, Condition, Monster Ability, or other rules content must execute without adding source-code branches for its ID/name/content identity.

Canonical runtime shape:

```text
RuleModule / content JSON
        -> structural + semantic + capability validation
        -> normalization / authoring sugar expansion
        -> Common Play IR
        -> trusted generic lowering + RulesProfile semantics
        -> PendingResolution
        -> typed StateChange[]
        -> atomic authoritative commit
        -> ResolutionEvent
        -> session / persistence projection
        -> UI presentation
```

Correctly-owned non-runtime transactions remain distinct:

- progression: `ProgressionDraft -> Character revision commit`;
- module installation: reviewed activation -> installed-content persistence;
- Character durable state vs session authority: explicit write-back boundary.

Do not force these into fake combat Resolutions. The invariant is one declarative semantics model and no named-content side engine.

### Final invariant

Changing only external content IDs/names must not change mechanical results except provenance/presentation labels.

Forbidden:

```ts
if (spell.id === "known-spell") { ... }
if (feature.id === "action-surge") { ... }
const compiler = namedCompilers[contentId]
```

Allowed:

```ts
switch (operation.kind) {
  case "damage.apply": ...
  case "resource.change": ...
  case "artifact.spawn": ...
}
```

---

## 2. Non-negotiable anti-drift rules

- [ ] Read `common-play-resolver-architecture-charter.md` before architecture changes or gate selection.
- [ ] No new named execution adapter/branch for a spell, feat, class, subclass, item, condition, monster ability, or other named content.
- [ ] Existing named adapters are behavior oracles only until the generic production path owns their semantics.
- [ ] Common Play capability support is never inferred merely because a schema field exists.
- [ ] New primitives require deterministic evidence that existing generic composition is insufficient or unsafe.
- [ ] New primitives must be reusable across unrelated content IDs.
- [ ] Imported content never gains arbitrary JS/eval/plugin execution.
- [ ] Unsupported mechanics are explicit, never silently approximated as supported.
- [ ] Schema/evaluator parity is mandatory for persisted executable kinds.
- [ ] UI/presentation never owns the only copy of rule-relevant state.
- [ ] Retry/replay must not double-spend or double-apply.
- [ ] One mechanically atomic resolution commits all related costs/results/frequency markers together or rolls them all back.
- [ ] Do not route V1 product work to `main`; integration target remains `work/v1-composite` unless owner direction explicitly changes.

---

## 3. Two-dimensional progress model

Future agents must track both axes. Neither replaces the other.

### Axis A — pipeline maturity for each capability family

Use these statuses:

1. `SPEC` — representable in persisted Common Play/Profile contracts;
2. `KERNEL` — generic trusted runtime semantics are implemented and tested;
3. `PORTABLE` — unknown external RuleModule data survives import, validation, persistence, rehydration, and session transfer without semantic loss;
4. `PRODUCTION` — real application/session execution reaches the generic path;
5. `MIGRATED` — absorbed named execution is deleted after parity;
6. `ACCEPTED` — unknown-ID/rename, authority, retry/reconnect, lifetime/persistence/Undo as applicable pass end-to-end.

A foundation Gate marked DONE may still need PORTABLE/PRODUCTION/MIGRATED work.

### Axis B — D&D expressive coverage

Gates A-M are a mechanism coverage map, not merely an implementation sequence.

- A — reaction / interaction / semantic recalculation;
- B — multi-target save / shared and per-target results;
- C — persistent effect / automatic event trigger;
- D — Zone artifact / membership / frequency;
- E — spatial facts / manual-provider semantic parity;
- F — maintained effects / concentration / suppression;
- G — selector + allocation;
- H — object + link artifacts;
- I — actor artifact / summon;
- J — form overlay / transformation;
- K — stored invocation / contingency-like behavior;
- L — mutable item lifecycle operations;
- M — source-bound state ownership.

A-M tell us whether the language can express difficult D&D rule structures. Legacy inventory tells us which old implementation still bypasses that language.

---

# PHASE 1 — RETAINED FOUNDATION

## F0 — Common Play Contract v0.2 — DONE

Retain existing evidence. Do not repeat without touched-surface justification.

## Gate A — Reaction / semantic recalculation — KERNEL DONE

Retain validated foundation evidence.

## Gate B — Multi-target save + shared damage — KERNEL DONE

Retain validated foundation evidence.

## Gate C — Persistent effect + automatic trigger — KERNEL DONE

Retain validated foundation evidence.

## Gate D — Zone / membership / frequency — KERNEL DONE

Canonical merge evidence remains PR #137 / `406a9574d249bb770ec7725efa1384808ddc9bc3`.

## Gate E — Spatial fact / manual authority — KERNEL DONE

Canonical merge evidence remains PR #141 / `00d3c9233bb678ec93bb828cb3941c3048c42054`, validated product candidate `12950273ee00fb1d52e12ef8d191e4cbf1a5e5ba`.

Foundation A-E is frozen unless new deterministic evidence materially invalidates it.

---

# PHASE 2 — PORTABLE EXECUTION CONVERGENCE

Status: **ACTIVE**.

Purpose: make the Common Play language actually cross the full product pipeline, then use that path to absorb named execution. Legacy deletion is a consequence, not the governing objective.

## P0 — Legacy inventory/freeze — DONE

Authority remains `docs/rules/legacy-execution-inventory.md` plus `.agents/LEGACY_EXECUTION_BASELINE.json` and the Legacy Execution Boundary regression.

The inventory is a debt ledger and behavior-oracle map, not the product roadmap.

## P1 — Universal migration harness

Every migrated mechanism must satisfy the applicable pipeline:

### Contract / validation

- [ ] equivalent unknown/portable RuleModule fixture exists;
- [ ] structural validation passes;
- [ ] semantic/capability validation passes;
- [ ] unsupported shapes fail explicitly;
- [ ] normalized Common Play meaning does not depend on content ID/name.

### Portability

- [ ] preview/import preserves mechanics;
- [ ] activation preserves mechanics;
- [ ] installed persistence preserves mechanics;
- [ ] restart/rehydration preserves mechanics;
- [ ] required session content / peer transfer preserves mechanics where applicable.

### Execution

- [ ] trusted generic lowering exists;
- [ ] real production/session dispatch reaches it;
- [ ] correct authoritative transaction domain owns mutation;
- [ ] runtime resolutions produce typed StateChanges and atomic commit;
- [ ] provenance remains traceable.

### Identity / authority / recovery

- [ ] arbitrary external ID executes;
- [ ] ID/name-only rename preserves semantics;
- [ ] owner/host authority parity is preserved where applicable;
- [ ] retry/replay idempotency is covered where applicable;
- [ ] reconnect/stale-response behavior is covered where applicable;
- [ ] lifetime/persistence/write-back is explicit where applicable;
- [ ] Undo/reversal behavior is covered where applicable.

### Migration

- [ ] existing named behavior oracle remains unchanged until parity is proven;
- [ ] production generic path becomes authoritative;
- [ ] only then remove the absorbed named adapter/branch;
- [ ] no hidden fallback routes supported mechanics back to the named engine;
- [ ] shrink legacy baseline/inventory only after removal.

## P2 — Capability maturity board

Track each family independently through `SPEC -> KERNEL -> PORTABLE -> PRODUCTION -> MIGRATED -> ACCEPTED`.

Initial families:

- [x] resource / action economy — `MIGRATED`; PR #171 absorbed the built-in Action Surge named production seam after generic-path parity. `ACCEPTED` is not claimed by this migration alone;
- [ ] tests / rolls / outcomes;
- [ ] damage / healing / HP;
- [ ] targeting / selectors / allocation;
- [ ] interactions / reactions / interceptors;
- [ ] persistent effects / triggers / frequency;
- [ ] spatial facts / zones / movement;
- [ ] item activation / mutable item state;
- [ ] progression / grants / choices;
- [ ] F-M families when their coverage disposition requires implementation.

Do not migrate by class/spell/feat list order. Migrate the smallest coherent mechanism family slice.

---

## P3 — Resource / Economy migration convergence — MIGRATED

Named oracle: Fighter Action Surge only because it provides a deterministic existing behavior sample. `Action Surge` is not a primitive and must never become a dispatch key.

Retained generic harness evidence before PR #159:

- Common Play resource payments/economy lowering exists;
- atomicity exists;
- restricted extra Action policy is RulesProfile-owned;
- arbitrary-ID rename invariance is covered.

### PR #159 portable bridge — INTEGRATED

PR: `#159`  
Branch: `agent/m1-rulemodule-portable-activation`  
Validated candidate: `1bc7a420b90378804a5b5994fa1ad1f59b963b1d`  
Merge commit: `dfe9d4c9fa1483276f9edf40364d042f1b50f852`

Required outcome:

- [x] registered data-only Common Play mechanics survive RuleModule preview/activation;
- [x] installed-content persistence/rehydration preserves them;
- [x] required session content / peer install preserves them;
- [x] one shared validator/parser boundary is used;
- [x] unsupported/custom mechanics remain explicit failures;
- [x] no named Fighter branch, second evaluator, new transport, or hidden fallback is introduced.

Historical red/fix evidence:

- old candidate `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` passed the focused M1 behavior 4/4 before failing TypeScript because parsed `entryPoints[].invocation` widened from its literal union to `string`;
- Persistence exposed an unrelated stale hard-coded builtin catalog total `501 !== 496`;
- child contextual typing fixed only the invocation literal typing;
- parent persistence baseline was corrected independently to assert the intended builtin-only invariant instead of a stale count.

Exact-head acceptance for `1bc7a420b90378804a5b5994fa1ad1f59b963b1d`:

- [x] M1 Common Play Resource Economy `33149435346` — focused harness + TypeScript typecheck SUCCESS;
- [x] Contract validation `33149435378` — SUCCESS;
- [x] Rules Domain `33149435342` — SUCCESS;
- [x] UI `33149435365` — SUCCESS including typecheck/build;
- [x] Persistence `33149435419` — SUCCESS including persistence contracts, production build, and Tauri storage;
- [x] Phase 11 Playable `33149435390` — SUCCESS including Windows playable artifact;
- [x] Phase 12 Connected Session `33149435367` — SUCCESS including connected protocol, Tauri transport/persistence, and Windows connected-session artifact.

### PR #159 completion gate

- [x] latest child SHA resolved after the typing fix;
- [x] exact-head evidence used instead of obsolete `60c5...` conclusions;
- [x] focused M1 harness passes;
- [x] typecheck/build passes on affected workflows;
- [x] persistence baseline no longer blocks the reconciled candidate;
- [x] product diff remained bounded to seven files and contained no named-content leakage;
- [x] parent/child ancestry reconciled only as needed for product verification;
- [x] owner merge approval obtained through the Rerun continuation command;
- [x] PR #159 merged into `agent/resolver-foundation-convergence`, never `main`.

### PR #168 production bridge — INTEGRATED

PR: `#168` — `rules: dispatch installed Common Play through production authority`  
Branch: `agent/m1-installed-common-play-production`  
Validated candidate: `da4ffecd2de1b7f95d324e7170312cdd8d512797`  
Merge commit: `c372c09353de58dfcc12ad3adbe6fd118fe28106`

Required outcome:

- [x] arbitrary installed data-only Common Play mechanics enter the real production/session action authority;
- [x] dispatch uses the installed-content repository lookup, `commonPlayOperationRuntime`, the existing generic Resolver, and the shared authoritative commit path;
- [x] Character resource writeback plus turn/session/history projection and Undo are preserved;
- [x] D&D economy grants remain RulesProfile-owned;
- [x] arbitrary external package/content/mechanic/entry-point identities prove production dispatch is not selected by Action Surge identity/name;
- [x] no second evaluator, store, session transport, executable-content fallback, or named-content algorithm branch is introduced.

Exact-head acceptance for `da4ffecd2de1b7f95d324e7170312cdd8d512797` reused at merge:

- [x] Contract validation — SUCCESS;
- [x] M1 Common Play Resource Economy — SUCCESS;
- [x] Rules Domain — SUCCESS;
- [x] UI — SUCCESS;
- [x] Phase 11 Playable — SUCCESS;
- [x] Phase 12 Connected Session — SUCCESS.

PR #168 established Resource/Economy `PRODUCTION`; PR #171 subsequently absorbed the named Fighter Action Surge production seam.

### PR #171 built-in migration — INTEGRATED

PR: `#171` — `rules: migrate built-in Action Surge to generic Common Play`  
Branch: `agent/m1-action-surge-generic-production`  
Validated candidate: `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`  
Merge commit: `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f`

Migration evidence:

- [x] built-in Fighter Action Surge reaches the same generic Common Play production path;
- [x] two-resource spend matches the existing behavior oracle atomically;
- [x] restricted extra Action semantics remain RulesProfile-owned with `allowsMagicAction: false`;
- [x] authoritative Character/session writeback and Undo remain correct;
- [x] connected host/client convergence preserves the grant and resources;
- [x] action/content/definition/display-name-only renames preserve mechanical semantics;
- [x] arbitrary installed Common Play production coverage from PR #168 remains in the focused harness;
- [x] the named `fighterActionSurgeRuntimeAdapter.ts` production path is deleted;
- [x] `.agents/LEGACY_EXECUTION_BASELINE.json` no longer admits the removed adapter;
- [x] no replacement named fallback, evaluator, store, transport, or content-ID/name algorithm branch is introduced.

Exact-head acceptance for `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`:

- [x] focused Common Play / Action Surge parity harness — 8/8 SUCCESS on the candidate lineage;
- [x] Contract validation `33174441211` — SUCCESS;
- [x] M1 Common Play Resource Economy `33174441198` — SUCCESS;
- [x] Persistence `33174441162` — SUCCESS;
- [x] Rules Domain `33174441191` — SUCCESS;
- [x] UI `33174441234` — SUCCESS;
- [x] Phase 12 Connected Session `33174441183` — SUCCESS including Windows connected-playable;
- [x] Phase 11 Playable `33174441152` — SUCCESS including Windows playable.

Resource/Economy therefore advances from `PRODUCTION` to `MIGRATED`. This does not by itself claim the stronger `ACCEPTED` maturity status; any remaining acceptance obligations must be proven explicitly under the universal criteria.

The next Phase 2 implementation slice must be selected by mechanism family from the P2 maturity board and current legacy evidence. Do not resume a named class/spell/feat queue or speculatively activate Gates F-M merely because Resource/Economy is complete.

---

# PHASE 3 — ANTICIPATED D&D CAPABILITY COVERAGE F-M

Status: **IMPLEMENTATION DORMANT; COVERAGE DISPOSITION REQUIRED BEFORE GATE N**.

The old rule “only a current legacy migration may activate F-M” is superseded.

F-M were deliberately anticipated because D&D contains difficult rules that a generic language must be able to represent safely.

## Required disposition for every F-M gate

Before Gate N, each gate must be exactly one of:

- `IMPLEMENTED` — deterministic scenario proved a reusable missing semantic and the capability was implemented/verified;
- `PROVEN_UNNEEDED` — deterministic representative D&D scenario composes safely from existing primitives, with tests proving that no new primitive is required;
- `EXPLICITLY_OUT_OF_SCOPE` — owner/product scope explicitly declines that mechanism for the claimed V1 support boundary, and imported content requiring it is reported unsupported rather than silently approximated.

`DORMANT`, `PLANNED`, or `TBD` is not a valid Gate-N-entry disposition.

A coverage probe may be triggered by either:

1. a real shipping/legacy migration failure; or
2. a deliberately selected representative D&D rule scenario where current SimpleVTT legacy code provides no suitable oracle.

For every probe:

- [ ] capture deterministic input/state/trigger/output;
- [ ] attempt existing Common Play composition first;
- [ ] verify authority/lifetime/state ownership;
- [ ] if composition succeeds cleanly, mark `PROVEN_UNNEEDED` with evidence;
- [ ] if composition fails for a reusable reason, define the smallest generic capability and activate implementation;
- [ ] never create a named primitive from the representative spell/feat/feature.

## Gate F — Maintained effects / concentration / suppression

Representative risk: concentration-like maintained source, interruption, suppression vs removal, dependent cleanup.

Disposition: `TBD`.

## Gate G — Selector + Allocation runtime

Representative risk: fixed pool/projectile/charge distribution across selected targets.

Disposition: `TBD`.

## Gate H — Object and Link artifacts

Representative risk: walls/barriers/portals where Zone or Actor semantics are incorrect.

Disposition: `TBD`.

## Gate I — Actor artifact / summon runtime

Representative risk: declarative summon/spawn with ownership, control, placement, lifetime, reconnect.

Disposition: `TBD`.

## Gate J — Form overlay / transformation

Representative risk: Wild Shape/Polymorph-like state overlay, restoration, property/resource projection, Undo/reconnect.

Disposition: `TBD`.

## Gate K — Stored invocation / contingency-like behavior

Representative risk: capture now, trigger later, snapshot-vs-live bindings, exactly-once consumption.

Disposition: `TBD`.

## Gate L — Item lifecycle operations

Representative risk: create/copy/consume/destroy/update mutable ItemInstance state with atomic result/payment and durable ownership.

Disposition: `TBD`.

## Gate M — Source-bound state ownership

Representative risk: temporary/runtime state whose correct ownership is the generating source and cannot safely be inferred from unrelated scalar state.

Disposition: `TBD`.

---

# PHASE 4 — FINAL CONVERGENCE / GATE N

Gate N is not another missing primitive. It is the final architecture acceptance test.

## N0 — Entry requirements

- [ ] claimed V1 mechanism families have reached the required maturity for the product promise;
- [ ] every F-M gate has `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` disposition;
- [ ] no supported mechanic depends on a hidden named engine fallback;
- [ ] unsupported capability behavior is explicit.

## N1 — Unknown multi-category external RuleModule

Create/import a module that did not exist when the app was built. It should exercise multiple content categories, for example several of:

- [ ] unknown Spell;
- [ ] unknown Feat;
- [ ] unknown Class/Subclass Feature;
- [ ] unknown Item;
- [ ] unknown Condition;
- [ ] unknown Monster Ability.

These are category/presentation identities only; execution must compose from already-supported generic capabilities.

## N2 — Full graph E2E

- [ ] RuleModule/content JSON;
- [ ] validation;
- [ ] normalization;
- [ ] Common Play IR;
- [ ] trusted generic lowering;
- [ ] Resolver / correct generic transaction domain;
- [ ] PendingResolution where runtime-interactive;
- [ ] typed StateChange[];
- [ ] authoritative session commit;
- [ ] Character owner write-back/persistence where applicable;
- [ ] reconnect/retry/Undo where applicable;
- [ ] UI projection/presentation.

## N3 — Identity invariance

- [ ] rename every external content ID/name while preserving mechanics;
- [ ] rerun the module;
- [ ] semantic outcomes remain equivalent except provenance/presentation identity.

## N4 — Cross-mechanism composition

At minimum cover supported combinations such as:

- [ ] reaction + payment + roll/outcome modification;
- [ ] multi-target selection + saves + shared/per-target result;
- [ ] persistent effect + automatic trigger + cleanup;
- [ ] Zone/membership + frequency;
- [ ] spatial/manual fact + instantaneous target selection;
- [ ] representative combinations from every F-M gate marked IMPLEMENTED.

## N5 — Failure behavior

- [ ] unsupported capability is explicit;
- [ ] missing optional provider uses manual authority only where supported;
- [ ] no provider/manual path fabricates an answer;
- [ ] unsafe executable content may remain inspectable/round-trippable but is never falsely reported executable.

## N6 — No-edit acceptance

Adding the unknown supported module requires:

- [ ] zero React feature branch;
- [ ] zero session feature branch;
- [ ] zero resolver content-ID/name branch;
- [ ] zero feature-specific runtime adapter;
- [ ] zero rebuild-time registration of its content IDs.

Gate N passes only when the system demonstrates that Common Play is a portable D&D execution language rather than a collection of named migrations.

---

## 4. Universal Definition of Done

For every executable migration/gate/probe, apply only the relevant checks but never weaken them silently.

### Scenario / semantics

- [ ] concrete deterministic scenario;
- [ ] existing primitives attempted first;
- [ ] smallest reusable missing semantic if expansion is required;
- [ ] no named-content dispatch;
- [ ] unsupported behavior explicit;
- [ ] schema/evaluator parity.

### State / authority

- [ ] correct authority owns the mutation;
- [ ] typed StateChanges for runtime state;
- [ ] atomicity;
- [ ] retry/replay idempotency where applicable;
- [ ] persistence/lifetime/cleanup explicit where applicable;
- [ ] reconnect/stale response where applicable;
- [ ] Undo/reversal where applicable.

### Portability / identity

- [ ] unknown external ID executes;
- [ ] ID/name-only rename invariance;
- [ ] import/persistence/rehydration path covered where applicable;
- [ ] no hidden compatibility fallback.

### Verification evidence

Record:

```text
head: <exact SHA>
environment: <OS/runtime/toolchain>
command: <exact command>
result: <pass/fail and counts>
artifact/run: <workflow/job/artifact when applicable>
```

- [ ] focused exact-SHA test;
- [ ] impacted regression only where justified;
- [ ] typecheck/build for touched surfaces;
- [ ] connected/persistence/Windows evidence only when relevant;
- [ ] unavailable required environment is `VERIFICATION BLOCKED`, not inferred green;
- [ ] unrelated CI red classified separately;
- [ ] final diff reviewed for named leakage and drive-by cleanup;
- [ ] owner approval before merge when required.

---

## 5. ChatGPT / Codex / future-agent decision boundary

ChatGPT/design work owns:

- architecture intent;
- capability vs named-content distinction;
- F-M probe/disposition decisions;
- RulesProfile/provider/authority/lifetime boundaries;
- acceptance scenarios and review of evidence.

Repository implementation may proceed once the contract is bounded:

- schema/validator/evaluator changes;
- generic lowering/runtime wiring;
- production/session integration;
- tests/fixtures;
- deletion of newly obsolete named execution;
- exact-SHA verification and PR preparation.

Stop and return to architecture review if:

- named-content branching appears necessary;
- a new primitive seems necessary without a reusable semantic contract;
- authority/lifetime/state ownership is ambiguous;
- current contracts materially conflict;
- a broad redesign has multiple valid product choices.

A future agent must not silently replace the charter/checklist philosophy with a preferred alternative. If it believes the architecture is wrong, it must identify the concrete contradiction/failure and surface the decision before changing direction.

---