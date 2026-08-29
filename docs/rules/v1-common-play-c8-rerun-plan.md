# V1 Common Play C8 Rerun Plan

Status: **ACTIVE CANONICAL CONTINUATION PLAN — C8 CORE COMPLETION**  
Repository: `Kaetaeru/SimpleVTT`  
Rerun working branch: `agent/v1-common-play-full-convergence`  
Product integration target: `work/v1-composite`  
Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`

This document owns the next product action after recovery of the large V1 Common Play Master Run checkpoint. It does not replace the architecture charter. The owner has explicitly narrowed C8 from a full legacy-strangler program to **Common Play engine Core completion**. Existing D&D named execution remains migration debt and is tracked as a separate follow-up backlog rather than a blocker for C8 Core completion.

This change preserves the charter's actual product promise: previously unknown external RuleModules that use supported generic mechanics must execute without source registration or identity-selected algorithms. Legacy deletion remains useful migration evidence, but is not itself the architecture objective.

## 1. Recovered checkpoint

The Master Run checkpoint is present on GitHub and was verified before this plan was activated:

- recovered branch: `agent/v1-common-play-full-convergence`;
- code checkpoint HEAD: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`;
- code checkpoint tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`;
- convergence base: `agent/resolver-foundation-convergence`;
- base SHA: `5fc742c5195930f92b2dfe8225f93f22f26038d6`.

Rerun coordination commits may advance the branch after that checkpoint. The code checkpoint above must remain in ancestry; do not reconstruct or replay the Master Run from the old convergence branch.

## 2. Reconciled engine state

The recovered work already established substantial Common Play coverage:

- C1: 36-row V1 coverage contract/checker;
- C2: unified parse/normalize/validate/lower Common Play boundary;
- C3-C7: generic primitives and representative composition scenarios;
- production slices for Resource/Economy, d20 tests/outcomes, Damage/Healing/HP, bounded Targeting, and bounded Interaction/Reaction;
- completed generic migrations/probes including Action Surge, Dash/status/effect grant, Bardic Inspiration, Divine Sense, Tactical Mind, Dark One's Own Luck, Peerless Skill, and Indomitable;
- PR #176 added the generic `roll.modify: subtract-die` semantic;
- PR #177 extended the generic reaction kernel to post-roll d20 subtraction with authoritative modifier-die faces, atomic Reaction/resource payment, stale/replay protection, natural-20 preservation, and identity invariance. PR #177 is merged on the Rerun working branch as `aa20f7ad7f54983d8b63e7afbe081cee08cc0143`.

Retain already-valid evidence. Do not rerun broad evidence merely because C8 scope changed. Revalidate only affected surfaces and the final C8 Core acceptance boundary.

## 3. Normative correctness rule

Legacy behavior is **not** the correctness oracle and legacy parity is **not** a migration requirement.

Correctness priority remains:

1. explicit SimpleVTT product rule / RulesProfile;
2. SRD 5.2.1 / current public Basic Rules for the covered D&D rule;
3. Common Play architecture invariants and correctly-owned transaction authority.

Existing named adapters may continue to serve already-shipping content until migrated, but they must not become a fallback or dispatch mechanism for new portable Common Play definitions. New C8 Core work must remain identity-independent.

## 4. C8 Core objective and exit gate

C8 Core completes the reusable post-roll interceptor/authority path needed for the Common Play engine to execute unknown portable reaction mechanics in real production/session flow.

C8 Core ends when all of the following are proven for the bounded supported interceptor family:

- portable Common Play definitions can structurally represent and normalize post-roll interceptors without content identity branching;
- portable structural timing/affected-roll data lowers into the existing generic reaction kernel rather than a second engine;
- real production/session execution can passively discover eligible installed interceptor definitions;
- an external responder can accept/decline through the existing interaction lifecycle and atomically pay Reaction/resource costs;
- d20 post-roll `subtract-die` works for supported ability-check and attack-roll results using central d20 recalculation semantics;
- damage-roll post-roll reduction is supported through the same generic interceptor path;
- distance/visibility or similar spatial eligibility uses authoritative provider/manual facts and explicitly refuses unavailable authority rather than fabricating geometry/sight;
- arbitrary external module/content/definition/interceptor IDs and display names do not alter mechanics;
- relevant Host/Client convergence, retry/replay/reconnect, persistence, and Undo behavior is proven for the supported production path;
- unsupported interceptor shapes fail explicitly rather than falling into a named D&D adapter.

**C8 Core does not require global D&D legacy execution to reach zero.**

## 5. Deferred Legacy Migration backlog

The following work is deliberately removed from the C8 Core critical path:

- converting every existing D&D named feature to Common Play immediately;
- deleting all remaining named RuntimeAdapters immediately;
- shrinking `LEGACY_EXECUTION` from its current inventory to zero as a prerequisite for C8 Core;
- using Cutting Words migration as the definition of engine completion.

The last verified inventory remains useful backlog/evidence data:

- D&D `LEGACY_EXECUTION`: 40 total = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: 19;
- V1 coverage ledger: 36 mandatory families, historically still non-terminal pending acceptance reconciliation.

After C8 Core, migrations should be performed incrementally when they provide product value, remove meaningful maintenance risk, or supply missing coverage evidence. Each migrated named path must still follow the charter's normative-rule -> generic semantics -> production authority -> proof -> deletion discipline. Do not create hidden compatibility fallbacks.

## 6. C8 Core execution method

Work by the smallest coherent generic capability boundary:

```text
portable structural contract
-> normalized/lowered generic interceptor
-> existing Common Play reaction kernel
-> production/session discovery
-> authoritative interaction/cost/facts
-> deterministic external-definition test
-> connected/recovery/Undo evidence
```

Prefer existing generic semantics. Do not create feature-specific replacement helpers, a second Common Play engine, content-ID/name dispatch, fabricated spatial/sensory facts, or progression-through-combat-Resolver shortcuts.

A named D&D rule such as Cutting Words may be used as a coverage probe, but C8 Core must be proven using arbitrary external identities as well.

## 7. C9 Gate N relationship

Global legacy-zero is no longer a C8 Core prerequisite and therefore is no longer, by itself, a Gate N entry condition.

Gate N remains governed by the architecture charter. Before final architecture acceptance:

- every required V1 mechanism-family coverage row must have its required evidence/disposition;
- anticipated F-M areas must be `IMPLEMENTED` or deterministically `PROVEN_UNNEEDED` as required by the charter;
- an unknown external multi-category RuleModule must execute without source registration or named dispatch;
- ID/name rename invariance and no-edit external RuleModule acceptance must pass;
- authoritative transaction ownership, persistence/reconnect/retry/Undo must pass where applicable;
- unsupported/provider/manual behavior must be explicit;
- final exact-head CI/build/contract evidence must be green.

Existing named D&D implementations may remain as migration debt only if they do not act as a fallback or execution selector for the unknown portable content used by Gate N. Final product cleanup can continue independently after architecture acceptance unless a specific coverage row requires a named migration as its proof.

Until the required Gate N evidence is reconciled, the overall V1 verdict remains `V1 INCOMPLETE` even if C8 Core is complete.

## 8. Active C8 Core checkpoint

PR #176 established generic authored `subtract-die` semantics. PR #177 then proved the generic kernel can pause on a successful ability check or attack roll, receive a blocking boolean interaction, atomically pay Reaction/resource costs, consume authoritative modifier-die faces, recalculate through the central d20 evaluator, preserve natural-20 semantics, and reject invalid authority without mutation.

The first unfinished Core boundary has already been inspected:

- `schemas/common-play-contract.schema.json` carries portable interceptor and `roll.modify` structure, but the authoring vocabulary must lower into the runtime kernel rather than expose runtime-internal slot names casually;
- `src/domain/commonPlayDefinitionRuntime.ts` retains interceptors structurally but does not yet provide the typed reaction lowering needed by production discovery;
- `src/app/installedCommonPlayRuntimeAdapter.ts` is the generic installed Common Play production path, but does not yet passively discover installed interceptor candidates;
- the current named Cutting Words adapter contains useful archaeology for responder/spatial/session behavior but is not the target architecture;
- an unmerged bounded candidate branch, `agent/c8-common-play-interceptor-portable-production`, contains early parser/lowering tests from the prior execution and is **not authoritative until replayed/reconciled onto the current working-branch head and validated**.

## 9. Next Exact Action

Complete C8 Core in four bounded boundaries, without migrating unrelated named D&D content:

1. **Portable interceptor lowering** — reconcile/replay the existing bounded candidate onto the current working head; normalize portable post-roll interceptor structure and lower supported `roll.modify: subtract-die` shapes into the PR #177 `CommonPlayReactionDefinition`, with parser/lowering and identity-invariance tests.
2. **Production/session discovery and responder authority** — make the installed Common Play production/session path passively discover eligible generic interceptor definitions and route accept/decline plus Reaction/resource payment through existing interaction/authority concepts, including external/remote responder ownership.
3. **Authoritative spatial/visibility** — route required eligibility facts through existing provider/manual authority and explicitly block when those facts are unavailable; do not fabricate them.
4. **Damage-roll + acceptance proof** — extend the same generic path to authoritative damage-roll subtraction and prove applicable connected Host/Client convergence, retry/replay/reconnect, persistence, Undo, unsupported-shape rejection, and arbitrary-ID/name invariance.

When these four boundaries are green, mark **C8 Core complete**. Do not require Cutting Words migration or global legacy-zero before doing so. Move any desired Cutting Words conversion and broader D&D named-path deletion to the Legacy Migration backlog.
