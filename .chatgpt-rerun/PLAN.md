# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical repository URL: `https://github.com/Kaetaeru/SimpleVTT`
- Canonical baseline / active product branch: `work/v1-composite`
- Rerun control path: `.chatgpt-rerun/control.json`
- Existing run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Existing sequence: `1`
- Existing task_id: `phase14-production-play-session-ux`
- Historical Phase 14 branch/issue: `agent/108-production-play-session-ux`, issue #108
- Canonical V1 routing authority: `CANONICAL_ROOT.md`
- Current V1 execution router: `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`
- Current implementation checkpoint: `.agents/V1_CURRENT_HANDOFF.md`

## Reconciliation note — 2026-08-23

This is an **existing active Rerun run**, not a new run. The run_id, sequence, task identity, preserved completion history, and validation history are retained.

Earlier Rerun documents treated `main` as canonical. Actual GitHub work in the current ChatGPT conversation and the repository's `CANONICAL_ROOT.md` now establish `work/v1-composite` as the canonical V1 implementation/build/test/release-preparation branch. Rerun therefore resumes this same run on `work/v1-composite`; it must not recreate the historical Phase 14 branch or route new V1 work back to `main`.

The user's current goal has also broadened beyond the original Phase 14 slice: **implement all remaining V1 checklist work through the pre-release boundary first, then perform one comprehensive Codex audit immediately before V1 acceptance/release.** The existing task_id is preserved for continuity; this sequence now acts as the durable V1-completion umbrella rather than resetting task identity.

## Product direction

SimpleVTT must reach a genuinely playable Windows V1 where the same canonical exact head supports the complete local and connected user journeys defined by `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`:

- first-run Character creation, persistence, restart and sheet use;
- Campaign preparation including roster, calendar/rations, Party Stash and DM Library;
- real Character local play with freeform/initiative, actions, skills, spells and inventory;
- connected Host/Join with host-unknown Character projection, Ready lifecycle, authoritative actions and reconnect;
- complete DM live operation, corrections/Undo, handouts and Campaign integration;
- durable Character/Campaign state with Session transient cleanup;
- mapless/module fallback correctness;
- final dice/presentation behavior;
- UX/error/accessibility closeout and release packaging.

The V1 implementation router and its dependency order are authoritative. Historical phase checklists are evidence/context only when they conflict with the current V1 router.

## Preserved completed work — Task 0

**task_id:** `phase13-closeout-ui-dice-regression`

**status:** COMPLETE

Phase 13 arbitrary Character SessionProjection, connected host authority, reconnect/write-back, creation/level-up UX convergence, and shared visual dice were closed with exact-head green Contract/Rules/Persistence/UI/Phase11/Phase12/Phase13 workflows.

Preserved implementation checkpoint: `7c9440970753a370fec7830cfa691832552e1d05`.

Preserved Phase 13 artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

This history must not be erased or relabeled by the current V1 work.

## Task 1 — existing sequence 1, reconciled V1 completion umbrella

**task_id:** `phase14-production-play-session-ux`

**status:** ACTIVE / CONTINUE AUTHORIZED

### Preserved Phase 14 intent

The original task corrected the reference-fixture-dependent production play path and required a real persisted Character -> session -> Scene actor/actions flow, with in-session `행동`, `기술`, `주문`, and `인벤토리` surfaces and preserved Phase 09-13 authority/network boundaries.

That implementation history remains part of the current V1 source and must not be redone merely because Rerun is being reconnected.

### Current canonical implementation state

According to `.agents/V1_CURRENT_HANDOFF.md`, recent canonical work has moved beyond the original Phase 14 slice into V1 convergence, including actor-specific Ready configuration, Ready lifecycle network propagation, `ready-action-v1` capability negotiation, connected reset cleanup, Live Development tooling, and isolated two-instance acceptance tooling.

The next implementation decision must therefore come from the current V1 handoff/checklist, not the old Phase 14 next-action text.

### Execution strategy from now until V1 pre-release

1. Read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` after the mandatory Rerun files.
2. Reconcile stale checklist statuses against current code before choosing work; do not reimplement already-present slices.
3. Select the next unblocked **implementation** item in V1 dependency order.
4. Implement coherent slices directly on `work/v1-composite`, preserving existing authority/persistence/module boundaries.
5. Add deterministic feature-level tests/fixtures as part of implementation when needed, but **do not stop after each slice for a separate Codex comprehensive audit**.
6. Keep `.agents/V1_CURRENT_HANDOFF.md` and the release checklist current enough that the next execution can resume without rediscovery.
7. Continue until all implementation work needed for V1 is present and the repository reaches a single pre-release candidate exact SHA.
8. Only at that boundary, freeze the candidate SHA and perform the comprehensive Codex audit/full regression across TypeScript, UI, domain, persistence, connected play, Rust/Tauri, Windows build, structural checks, and release metadata.
9. Fix all audit findings and rerun the final audit as necessary.
10. After the final Codex audit is green, perform remaining human acceptance/evidence and release promotion steps.

### Codex audit policy

The user explicitly does **not** want a per-slice Codex total-validation queue to interrupt implementation.

- `.agents/CODEX_VALIDATION_QUEUE.md` created during the current conversation is not the active execution gate unless the user later re-authorizes it.
- Final audit input is one exact pre-V1 canonical SHA, not a rolling series of feature SHAs.
- Implementation may still contain normal focused tests and CI guards; those are engineering safety nets, not the final Codex audit.

### V1 acceptance contract

Implementation phase is ready for the final Codex audit only when the V1 release checklist has no remaining implementation gaps that should be fixed before audit. The final release remains gated by the checklist's exact-head evidence requirements.

At minimum the final candidate must cover the nine V1 user journeys recorded in `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`: J1 First run/Character, J2 Campaign preparation, J3 Local session, J4 Connected session, J5 DM live operation, J6 Persistence, J7 Mapless/module behavior, J8 Dice/presentation, and J9 Release.

### Verification method

During implementation:

- deterministic focused tests for changed behavior where practical;
- TypeScript/build or Rust checks when a slice materially changes those boundaries;
- Live Development/manual visual checks when UI behavior needs direct inspection;
- current canonical CI may provide additional evidence but does not replace the final audit.

At V1 pre-release freeze:

- comprehensive Codex audit on the exact candidate SHA;
- full relevant TypeScript/domain/UI/persistence/connected regression suite;
- `npm run build` / TypeScript compile checks;
- Rust/Tauri library/build checks;
- Windows two-instance connected acceptance and restart/persistence evidence;
- release artifact/digest/build metadata checks;
- final human acceptance for visual/interaction behaviors that automation cannot prove.

## Dependencies

- Work only from `work/v1-composite` unless the repository's canonical routing authority is deliberately changed by the user.
- Do not promote to `main` until the release checklist explicitly reaches that step.
- Preserve authoritative domain/rules/persistence/network boundaries documented under `docs/design/`.
- Keep map/tactical provider behavior optional; V1 core remains usable without a battlemap provider.
- Do not silently convert Session transient state into Character/Campaign durable state.

## Current Next Exact Action contract

On the next Rerun dispatch after reconciliation:

1. Confirm `control.json` still authorizes sequence `1`, task `phase14-production-play-session-ux`, status `continue`.
2. Confirm `work/v1-composite` still resolves and re-fetch the current canonical head.
3. Read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`.
4. Reconcile the handoff's current Ready/two-instance state against the V1 router and identify the next **implementation** gap that can be completed without a user-only acceptance step.
5. Implement that V1 slice; do not start the final Codex audit yet.
6. Before the 18-minute checkpoint, durably record completed work, evidence available so far, and the next exact implementation action.
