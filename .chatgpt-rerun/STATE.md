# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `5`
- task_id: `v1-common-play-c8-rerun`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/v1-common-play-full-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/v1-common-play-c8-rerun-plan.md`
- checkpointed_at: `2026-08-29 19:32 Asia/Seoul`

## Durable checkpoint

The owner explicitly changed C8 scope from global D&D legacy strangling to **Common Play Engine Core completion**. `docs/rules/v1-common-play-c8-rerun-plan.md` was revised accordingly on the Rerun working branch. Existing D&D named execution is now a deferred Legacy Migration backlog rather than a C8 Core exit blocker. This does not permit new identity-selected fallback paths: unknown portable content still must execute through generic Common Play semantics and authority.

Previously retained evidence remains valid:

- PR #176 added generic authored `roll.modify: subtract-die` semantics;
- PR #177 merged as `aa20f7ad7f54983d8b63e7afbe081cee08cc0143` and proved the generic Gate A reaction kernel can pause on a successful ability check/attack roll, atomically pay Reaction/resource costs, consume authoritative modifier-die faces, recalculate through central d20 semantics, preserve natural-20 behavior, and reject invalid authority without mutation.

Do not repeat PR #176/#177 validation unless those surfaces materially change.

## C8 Core boundary 1/4 complete — portable interceptor lowering

PR #178 (`rules: lower portable d20 reaction interceptors`) was implemented and merged into the Rerun working branch as `fc6a45fb7905790ea01c947d39af5ab15f02f668`.

The bounded slice added only the portable-to-kernel bridge:

- `schemas/common-play-contract.schema.json` now exposes generic interceptor slot `d20.roll` alongside the existing structural interceptor vocabulary;
- `src/domain/commonPlayReactionDefinitionRuntime.ts` lowers supported portable d20 and attack-outcome recalculation interceptors into the already-existing `CommonPlayReactionDefinition` kernel;
- d20 lowering supports `timing: d20.outcome-determined`, `operation: recalculate`, `slot: d20.roll`, and `roll.modify: subtract-die`;
- existing attack-outcome `property.modify` recalculation remains supported;
- blocking boolean interaction and commit-time resource/economy payments are validated structurally;
- unsupported interceptor/payment shapes fail explicitly instead of falling through to a named engine;
- arbitrary definition/interceptor/interaction identity rename preserves the lowered mechanics;
- a schema-valid external portable d20 reaction fixture and focused tests were added.

Exact candidate head before merge: `d7918e9527bcf1c185edcefa16d4ed63767c8e31`.

Relevant validation on that exact head:

- M1 Common Play Interaction: **SUCCESS**, including the new lowering tests and TypeScript typecheck;
- M1 Common Play d20: **SUCCESS**;
- M1 Common Play HP: **SUCCESS**;
- M1 Common Play Resource Economy: **SUCCESS**;
- Rules Domain: **SUCCESS**;
- Contract schema/fixture validation: **SUCCESS**, including `generic-d20-reaction.json`;
- V1 mechanism coverage checker: **SUCCESS** at its current non-terminal ledger state.

The overall Contract validation workflow remains red only at its known environment defect: it invokes `tsx` without installing Node dependencies (`sh: 1: tsx: not found`) after schema/fixture and ledger validation have already passed. UI/Phase11/Phase12 retain inherited Phase09 failures and were not reclassified as PR #178 regressions.

## C8 Core remaining scope

Three coherent engine boundaries remain. Global `LEGACY_EXECUTION` cleanup and Cutting Words migration are **not** part of these completion requirements.

1. **Production/session discovery + responder authority**
   - passively discover eligible installed portable interceptor definitions during real production/session resolution;
   - route accept/decline through the existing interaction lifecycle;
   - resolve external/remote responder ownership without content identity branching;
   - keep Reaction/resource payment atomic through the generic kernel.

2. **Authoritative spatial/visibility**
   - source required eligibility facts only from existing provider/manual authority;
   - block or request authority when unavailable rather than fabricating distance/visibility/sensory facts.

3. **Damage-roll + production acceptance**
   - extend the same generic interceptor path to authoritative damage-roll subtraction;
   - prove applicable Host/Client convergence, retry/replay/reconnect, persistence, Undo, unsupported-shape rejection, and arbitrary-ID/name invariance.

When those three boundaries are green, mark **C8 Core complete**.

## Deferred Legacy Migration backlog

Last verified inventory is retained for later migration planning, not as a C8 Core blocker:

- D&D `LEGACY_EXECUTION`: **40** total = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: **19**;
- V1 coverage ledger: **36** mandatory families, currently non-terminal pending later acceptance reconciliation.

Existing named implementations may remain only as legacy content paths; they must not be used as fallback or execution selection for unknown portable Common Play content.

## Waiting condition

None. Sequence 5 remains authorized to continue.

## Next Exact Action

Begin C8 Core boundary 2 from the current Rerun working-branch head. Do not migrate Cutting Words and do not work the global legacy inventory.

Read only the existing generic session/content APIs needed to answer these questions:

1. how installed Common Play mechanics are enumerated for the active session/character without feature-name dispatch;
2. how a passive interceptor can observe an in-progress canonical d20 resolution before final commit without adding another engine;
3. how interaction responder identity maps to local/remote participant authority;
4. how the existing Gate A awaiting/resume result can be persisted/projected through production and connected-session flow.

Then implement the smallest identity-independent production/session discovery bridge, add focused external-definition and responder/payment tests, and run only the affected Common Play Interaction/connected/typecheck evidence before merge.

If the existing session APIs do not expose a required generic hook, stop at that architecture boundary and add the smallest reusable hook rather than patching a named adapter.

Current verdict: `V1 INCOMPLETE`.
