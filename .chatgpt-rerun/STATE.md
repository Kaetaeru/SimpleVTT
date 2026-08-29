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
- checkpointed_at: `2026-08-29 Asia/Seoul`

## Durable checkpoint

The recovered V1 Common Play Master Run checkpoint remains valid in ancestry and C8 has advanced by one bounded generic capability slice.

- recovered code checkpoint: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- recovered tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- preflight branch HEAD for this execution: `ef33f663c11567a44f5f1efc58e962c5355ea909`
- accepted candidate branch: `agent/c8-common-play-subtract-die`
- accepted candidate exact head: `3f1de2b22aa8335cc95ca343e2b00b765ebd08b1`
- merged PR: `#176` — `rules: add generic Common Play subtract-die semantic`
- product merge commit: `bb53ef104a76547099673daa7deb33a5d7928016`
- canonical C8 plan checkpoint commit: `9643cdacfb7739f4bb9b5a7f463e507a3ad4948e`

Product integration remains `work/v1-composite`, never `main`.

## Work completed in this execution

The unresolved design question from the previous checkpoint was answered against live implementation and tests.

Existing Common Play composition was **insufficient** for an authoritative rolled-die subtraction:

- the operation lowerer could add an authoritative modifier die but only as a positive contribution;
- the bounded Gate A reaction kernel recalculated an attack after literal `defense.ac` modification but did not provide a reusable rolled-die reduction binding;
- no existing production evaluator path could turn a separately rolled authoritative die into a signed subtraction without adding a new reusable semantic.

A side engine or Cutting-Words-specific replacement was therefore rejected. PR #176 added only generic `roll.modify: subtract-die` to the existing Common Play pipeline.

Changed product/test files in PR #176:

- `schemas/common-play-contract.schema.json`
- `src/domain/commonPlayOperationRuntime.ts`
- `src/domain/d20.ts`
- `tests/domain/commonPlayD20Runtime.test.ts`

The integrated behavior is structural rather than identity-selected:

- arbitrary definition ID/name changes do not change mechanics;
- authoritative modifier-die faces are required before commit;
- the entire authored `XdY+Z`/`XdY-Z` reduction is subtracted, not just the die portion;
- the central d20 evaluator remains authoritative for natural-1/natural-20/critical behavior;
- missing modifier-die authority rejects without state mutation.

During candidate diff review, an accidental omission of the existing `selectD20(...)` assignment was caught before acceptance and restored in candidate head `3f1de2b...`; the accepted PR diff contains no such deletion.

## Validation evidence

Exact-head candidate `3f1de2b22aa8335cc95ca343e2b00b765ebd08b1`:

- M1 Common Play d20 + TypeScript typecheck: **SUCCESS** (`33237579004`)
- M1 Common Play Interaction: **SUCCESS**
- M1 Common Play Targeting: **SUCCESS**
- M1 Common Play Resource Economy: **SUCCESS**
- M1 Common Play HP: **SUCCESS**
- Rules Domain: **SUCCESS** (`33237579039`)
- Persistence: **SUCCESS**

Known red workflows were investigated instead of attributed to this slice:

- Contract validation: schema, fixture, and coverage stages pass; the unified-definition stage fails because the workflow invokes `tsx` without installing it (`sh: 1: tsx: not found`). This is a workflow environment defect, not a `subtract-die` semantic failure.
- UI/Phase11/Phase12: candidate Phase09 reports 104/116 passing with 12 failures. The recovered product checkpoint `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9` already produces the same 104/116 result with the same deterministic-dice, HP/Undo, and spatial-provenance failures. The red is inherited from the parent product state.

The broad Master Run evidence was not repeated because this bounded change touched only the generic d20/Common Play operation surface and the focused exact-head checks covered that surface.

## C8 debt after this slice

PR #176 deliberately removes no named migration path, so there is no legacy negative delta yet:

- D&D `LEGACY_EXECUTION`: **40** total = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: **19**;
- V1 coverage ledger: **36** mandatory families, all still `INCOMPLETE`.

No ledger row is promoted by this primitive alone. Cutting Words remains the active migration slice.

## Waiting condition

None. Sequence 5 remains authorized to continue directly on `agent/v1-common-play-full-convergence`.

C9 Gate N remains prohibited until all D&D named legacy execution is removed and the coverage ledger reaches terminal evidence.

## Next Exact Action

Resume from Section 9 of `docs/rules/v1-common-play-c8-rerun-plan.md`.

Do not re-prove PR #176 unless its surface changes. The next bounded product action is the generic production/session interceptor bridge that applies the retained `subtract-die` semantic to eligible d20 and damage-roll events with remote responder Reaction/resource payment and authoritative spatial/visibility facts. Then encode built-in Cutting Words through Common Play data; only after focused connected/Undo evidence is green may the named Cutting Words app/domain path be deleted and the legacy baseline shrunk.

Current verdict: `V1 INCOMPLETE`.
