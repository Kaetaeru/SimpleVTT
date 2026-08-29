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
- checkpointed_at: `2026-08-29 19:44 Asia/Seoul`

## Durable checkpoint

The owner explicitly changed C8 scope from global D&D legacy strangling to **Common Play Engine Core completion**. `docs/rules/v1-common-play-c8-rerun-plan.md` was revised accordingly. Existing D&D named execution is a deferred Legacy Migration backlog rather than a C8 Core exit blocker. Unknown portable content must still execute through generic Common Play semantics and authority; named implementations may not become portable fallback paths.

Retain prior evidence:

- PR #176 added generic authored `roll.modify: subtract-die` semantics;
- PR #177 merged as `aa20f7ad7f54983d8b63e7afbe081cee08cc0143` and proved the generic Gate A d20 reaction kernel, atomic Reaction/resource payment, authoritative modifier-die faces, stale/replay protection, and central d20 recalculation;
- do not repeat PR #176/#177 validation unless those surfaces materially change.

## C8 Core boundary 1/4 complete — portable interceptor lowering

PR #178 (`rules: lower portable d20 reaction interceptors`) merged into the working branch as `fc6a45fb7905790ea01c947d39af5ab15f02f668`.

It added:

- portable schema slot `d20.roll`;
- `src/domain/commonPlayReactionDefinitionRuntime.ts` lowering supported portable d20/attack-outcome recalculation shapes into the existing Gate A reaction kernel;
- blocking boolean interaction plus commit-time resource/economy payment structural validation;
- explicit rejection of unsupported shapes;
- arbitrary identity rename invariance;
- schema fixture and focused tests.

Exact candidate head `d7918e9527bcf1c185edcefa16d4ed63767c8e31` had M1 Common Play Interaction + typecheck, d20, HP, Resource Economy, Rules Domain, schema/fixture validation, and current ledger checker green. Contract's later `tsx: not found` remains the known workflow environment defect.

## C8 Core boundary 2/4 active — production/session discovery + responder authority

Active PR: **#179** `runtime: discover installed Common Play post-roll interceptors`.

- branch: `agent/c8-core-production-interceptor-discovery`
- current exact head: `baa6d2604bd6b10c088270bfd7feb364e404d59c`
- base: current boundary-1 checkpoint lineage from working branch
- current diff is intentionally limited to 5 files:
  - `.github/workflows/m1-common-play-interaction.yml`
  - `src/app/abilityCheckResolutionEventAdapter.ts`
  - `src/app/commonPlayInterceptorProductionRuntimeAdapter.ts` (new)
  - `src/app/offlineRuntimeAdapters.ts`
  - `tests/ui/installedCommonPlayInterceptorProductionRuntime.test.ts` (new)

The implementation currently:

- enumerates installed Common Play definitions;
- discovers candidates only through Character-owned canonical content identities, with projected remote Character identities and a bounded canonical item-identity fallback for legacy/reference local Characters;
- lowers portable definitions through the existing Gate A reaction kernel;
- observes successful production ability-check and attack-roll results before final commit;
- projects the Gate A awaiting interaction into the existing `ResolutionView.interrupt` contract;
- sets `interrupt.responderId` to the owning Character, allowing the existing connected-session router to authorize and route a remote owner prompt without a second network reaction engine;
- draws modifier dice under production/Host authority only after accept;
- commits Reaction/resource cost through the generic kernel and existing durable/event transaction path;
- feeds recalculated d20 modifier contributions back into canonical ability-check/attack resolution rather than using a named penalty helper;
- includes external unknown RuleModule tests for accept, decline, attack miss conversion, and full identity/display rename invariance.

First PR #179 test attempt at head `0d920288763334350fb88f194c4a94d2e5f7dc80` ran 72 focused tests: **69 passed, 3 new tests failed** because the passive candidate was not discovered. Existing regressions remained green. The failure exposed an ownership-discovery problem, not a d20/reaction-kernel failure.

During the fix, a temporary helper edit to `characterSessionProjection.ts` broadened the diff beyond the required scope. That file was explicitly restored to its original blob (`447e33042c0d72dd21933aedb909bd617d1efa08`) before checkpoint. The final candidate diff no longer changes SessionProjection validation.

The candidate now uses the existing full SessionProjection content identity when available and a narrow direct canonical catalog match for actually-owned local ItemInstance definitions when legacy/reference source-model validation prevents the full envelope from being built. No content name/class-specific algorithm selection was added.

### Validation currently in progress

Exact head `baa6d2604bd6b10c088270bfd7feb364e404d59c` has a fresh PR CI run:

- M1 Common Play Interaction run `33248457715`: **in progress** at checkpoint; install and content generation passed, focused tests currently running, typecheck pending;
- other broad workflow families were queued/running and are not required to be reclassified unless they show a new affected-surface failure;
- Contract validation is expected to retain the known later `tsx: not found` environment defect.

Do not merge PR #179 until the fresh M1 Interaction focused tests and TypeScript typecheck on exact head `baa6d260...` are green.

## C8 Core remaining scope

If PR #179 passes and merges, only **two coherent engine boundaries remain**:

1. **Authoritative spatial/visibility**
   - connect reaction eligibility facts to existing `CommonPlaySpatialFactRuntime` / authoritative provider or manual authority;
   - do not use the legacy `resolveRuntimeTargetingFact` fallback that fabricates `0 ft / visible=true` when no authoritative spatial relation exists;
   - block/request authority when required facts are unavailable.

2. **Damage-roll + production acceptance**
   - extend the same generic interceptor path to authoritative damage-roll subtraction;
   - prove applicable Host/Client convergence, responder authorization, retry/replay/reconnect, persistence, Undo, unsupported-shape rejection, and arbitrary-ID/name invariance.

When those two boundaries are green after #179, mark **C8 Core complete**.

## Deferred Legacy Migration backlog

Not a C8 Core blocker:

- D&D `LEGACY_EXECUTION`: last verified **40** = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: last verified **19**;
- Cutting Words and broader named D&D migration;
- global legacy-zero cleanup.

These remain later migration/maintenance work and may be tackled incrementally.

## Waiting condition

None. Sequence 5 remains authorized to continue. Current execution checkpointed because the 20-minute Rerun window was reached while PR #179 fresh CI was still running.

## Next Exact Action

1. Re-read mandatory Rerun files in order and reconcile live GitHub.
2. Fetch PR #179 live head and confirm it remains `baa6d2604bd6b10c088270bfd7feb364e404d59c` or reconcile any newer exact head.
3. Inspect M1 Common Play Interaction run `33248457715` (or the run for the live exact head):
   - if focused tests or typecheck fail, fix only that concrete candidate failure and revalidate;
   - if both are green, reconcile PR diff/mergeability and merge #179 under current `continue` authority.
4. After merge, checkpoint boundary 2 complete and begin only boundary 3: authoritative spatial/visibility fact eligibility.
5. Do not migrate Cutting Words or work global legacy inventory as part of C8 Core.

Current verdict: `V1 INCOMPLETE`.
