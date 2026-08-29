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
- checkpointed_at: `2026-08-29 19:19 Asia/Seoul`

## Durable checkpoint

Owner authorization covers continuing all remaining C8 work. PR #177 was live-reconciled and merged into the Rerun working branch as `aa20f7ad7f54983d8b63e7afbe081cee08cc0143`. Its exact-head evidence remains retained: M1 Common Play Interaction 63/63 plus TypeScript typecheck green, and Rules Domain plus TypeScript typecheck green. Do not repeat PR #176/#177 validation unless affected surfaces materially change.

The working branch reached `bcee2d53cab4c9897d34cb81162594ce7202b072` after publishing the post-merge Rerun continuation state/control. No product-code change was started after PR #177; the remainder of this execution was used to identify the first safe production boundary before the 20-minute stop.

## First unfinished Section 9 boundary now inspected

The repository already has the structural pieces needed for the next generic slice; no new named side engine is required:

- `schemas/common-play-contract.schema.json` is the authored Common Play 0.2 contract. It already exposes structural `interceptors` with trigger/timing/affected-rolls/operations/authority/provisional-result fields and already supports generic `roll.modify`, including `subtract-die`.
- The portable schema expresses post-roll applicability through structural timing plus affected roll kinds such as attack/ability/damage. The PR #177 kernel's internal `d20.outcome-determined` / `d20.roll` vocabulary should therefore be reached by lowering rather than by casually exposing a new author-facing `d20.roll` schema slot.
- `src/domain/commonPlayDefinitionRuntime.ts` currently retains `interceptors` only as raw `unknown[]`; it does not yet normalize them into the typed runtime interceptor shape.
- `src/domain/commonPlayOperationRuntime.ts` lowers current Common Play operations/costs/provenance but does not yet project portable interceptors into the generic reaction runtime.
- `src/app/installedCommonPlayRuntimeAdapter.ts` is already the generic production adapter for installed Common Play definitions and already participates in the real session interrupt/payment lifecycle, but it currently handles active/manual Common Play use rather than passively discovering installed interceptor candidates.
- `src/app/bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` still owns the named Cutting Words session wrapping and authoritative distance/visibility checks. Its generic session/targeting mechanics should be reused or extracted only where truly generic; the named adapter remains a strangling target, not a template for another side engine.

This inspection resolves the immediate architecture choice: the next slice should type/normalize and lower portable interceptor data, then make the installed Common Play production path discover those generic interceptor candidates. Do not add class-name selection and do not invent a separate reaction engine.

## C8 debt

PR #177 removed no named execution path, so the last verified debt remains unchanged until a later negative-delta proof:

- D&D `LEGACY_EXECUTION`: **40** total = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: **19**;
- V1 coverage ledger: **36** mandatory families, all `INCOMPLETE`.

C9 Gate N remains prohibited.

## Waiting condition

None. Sequence 5 remains authorized to continue.

## Next Exact Action

Resume Section 9 without repeating the inspection above. Read only the directly relevant tests plus the `ProgressionContentRegistry`, `ProgressionSession` interrupt API, installed-overlay lookup, and the generic runtime-targeting helper needed for this slice. From the current working-branch head, create a bounded C8 child branch and implement the smallest generic portable/production bridge:

1. normalize typed Common Play 0.2 interceptor data in the definition boundary;
2. lower structural post-roll + affected-roll kinds + `roll.modify: subtract-die` into the PR #177 generic reaction kernel without class/race/name branching;
3. discover eligible installed definitions in the real production/session path and route responder/cost data through existing generic authority/payment concepts;
4. add focused parser/lowering/discovery/identity-invariance tests and run the narrowest relevant Actions plus typecheck;
5. if green, merge the bounded slice under the owner's standing C8 authorization and continue with authoritative spatial/visibility and damage-roll support, then built-in Cutting Words data, connected/reconnect/Undo proof, named Cutting Words deletion, legacy negative delta, and the remaining C8 mechanism families until D&D named execution reaches zero.

If inspection of the exact session/authority APIs reveals a genuinely undefined primitive or lifetime, return to the canonical design boundary instead of inventing it inside implementation.

Current verdict: `V1 INCOMPLETE`.
