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

The user's current goal has broadened beyond the original Phase 14 slice: **implement all remaining V1 checklist work through the pre-release boundary first, make every intended V1 feature actually work end-to-end while preserving the current UI, then perform one comprehensive Codex audit immediately before V1 acceptance/release.** The existing task_id is preserved for continuity; this sequence now acts as the durable V1-completion umbrella rather than resetting task identity.

# Primary V1 contract

The following two rules are the highest-priority product contract for this Rerun sequence.

## 1. V1 means functional completion, not checklist completion

A checkbox, file, adapter, test, or partial implementation is not sufficient by itself.

V1 is reached only when **all functionality already intended for V1 behaves correctly in the real user-facing application path**. For every checklist item, Rerun must distinguish between:

- code that merely exists;
- code that passes a narrow fixture test;
- functionality that is actually reachable from the production UI;
- functionality that correctly preserves authority, persistence, session state, and error behavior;
- functionality that works together with the rest of the V1 product without requiring debug fixtures or manual repository intervention.

When a checklist item is marked implemented but the real workflow is incomplete, inconsistent, fixture-dependent, visually inaccessible, non-persistent when it should persist, persistent when it should be transient, or otherwise not usable as intended, **the item remains unfinished and must be corrected before V1 freeze**.

Do not add unrelated post-V1 features merely to improve completeness. The target is to make the **already intended V1 product** complete and reliable.

## 2. Preserve the current UI as the product baseline

The **current visible SimpleVTT UI is the UI baseline for V1 and must be preserved** while functionality is completed.

Rerun must not perform a broad redesign, visual refresh, navigation rewrite, panel reshuffle, component replacement, layout overhaul, typography restyle, color-system change, or aesthetic reinterpretation simply because implementation work touches that area.

Rules for UI-facing work:

1. Keep the current screen structure, navigation model, panel placement, visual hierarchy, component styling, spacing language, and interaction pattern unless a concrete functional defect makes a minimal change unavoidable.
2. Prefer fixing adapters, state flow, domain/application logic, persistence, routing, authority, and event propagation **behind the existing UI** rather than changing the UI to fit the implementation.
3. Existing controls that are intended to work must be wired to real behavior instead of being replaced with a different UX.
4. Do not remove, rename, relocate, or restyle an existing user-facing control merely to simplify implementation.
5. When a missing V1 capability truly requires an additional control or state presentation, add the **smallest compatible UI element** inside the existing component system and visual language.
6. Empty/loading/error/disabled states may be added where required for correctness, but they should look like natural extensions of the current UI rather than a redesign.
7. Debug/reference fixtures may be removed from production authority, but their removal must not be used as an excuse to redesign the surrounding screen.
8. If current UI behavior and an internal implementation shortcut conflict, preserve the intended current UI behavior and fix the implementation instead.
9. Any unavoidable visible change must be narrowly scoped, functionally justified, and recorded in STATE/handoff.
10. Final V1 acceptance includes a regression check that existing major screens still visually and structurally resemble the current product baseline while their intended functions now work correctly.

# Product direction

SimpleVTT must reach a genuinely playable Windows V1 where the same canonical exact head supports the complete local and connected user journeys defined by `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, **using the current UI as the visible product shell**:

- first-run Character creation, persistence, restart and sheet use;
- Campaign preparation including roster, calendar/rations, Party Stash and DM Library;
- real Character local play with freeform/initiative, actions, skills, spells and inventory;
- connected Host/Join with host-unknown Character projection, Ready lifecycle, authoritative actions and reconnect;
- complete DM live operation, corrections/Undo, handouts and Campaign integration;
- durable Character/Campaign state with Session transient cleanup;
- mapless/module fallback correctness;
- final dice/presentation behavior;
- UX/error/accessibility closeout **without redesigning the established UI**;
- release packaging.

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
3. For each apparently completed item, check whether its **intended real production behavior** is actually complete; do not trust code presence or stale checkmarks alone.
4. Select the next unblocked **implementation/functionality gap** in V1 dependency order.
5. Implement coherent slices directly on `work/v1-composite`, preserving existing authority/persistence/module boundaries and the current UI baseline.
6. Prefer internal wiring and correctness fixes behind existing screens. Do not redesign the UI as part of implementation cleanup.
7. Add deterministic feature-level tests/fixtures as part of implementation when needed, but **do not stop after each slice for a separate Codex comprehensive audit**.
8. Keep `.agents/V1_CURRENT_HANDOFF.md` and the release checklist current enough that the next execution can resume without rediscovery.
9. Continue until every intended V1 feature works through the real application path and no pre-release implementation gap remains.
10. Reach one single pre-release candidate exact SHA while retaining the current UI structure/visual identity.
11. Only at that boundary, freeze the candidate SHA and perform the comprehensive Codex audit/full regression across TypeScript, UI, domain, persistence, connected play, Rust/Tauri, Windows build, structural checks, and release metadata.
12. Fix all audit findings without broad UI redesign and rerun the final audit as necessary.
13. After the final Codex audit is green, perform remaining human acceptance/evidence and release promotion steps.

### Codex audit policy

The user explicitly does **not** want a per-slice Codex total-validation queue to interrupt implementation.

- `.agents/CODEX_VALIDATION_QUEUE.md` created during the current conversation is not the active execution gate unless the user later re-authorizes it.
- Final audit input is one exact pre-V1 canonical SHA, not a rolling series of feature SHAs.
- Implementation may still contain normal focused tests and CI guards; those are engineering safety nets, not the final Codex audit.
- The final Codex audit must assess both **functional completeness** and regression against the established UI structure; passing tests alone does not authorize a redesigned or behaviorally incomplete V1.

### V1 acceptance contract

Implementation phase is ready for the final Codex audit only when the V1 release checklist has no remaining implementation gaps that should be fixed before audit **and every intended V1 function is reachable and behaves correctly in the production UI path**.

At minimum the final candidate must cover the nine V1 user journeys recorded in `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`: J1 First run/Character, J2 Campaign preparation, J3 Local session, J4 Connected session, J5 DM live operation, J6 Persistence, J7 Mapless/module behavior, J8 Dice/presentation, and J9 Release.

Additional acceptance constraints:

1. No intended V1 feature may depend on fixture-only IDs, debug controls, manual data surgery, or repository commands in normal use.
2. Character/Campaign durable data must survive restart where intended.
3. Session-only state must clear where intended.
4. Local and connected authority paths must converge correctly.
5. Error, loading, incompatible, empty, and disabled states must fail clearly rather than silently.
6. Existing major UI screens and interaction structure must remain recognizably the same as the current baseline.
7. Broad visual redesign is explicitly **out of scope** for this V1 completion run.
8. New UI elements are allowed only when required to expose an intended missing V1 capability and must match the existing component/style language.

### Verification method

During implementation:

- deterministic focused tests for changed behavior where practical;
- TypeScript/build or Rust checks when a slice materially changes those boundaries;
- Live Development/manual checks when functional or visual behavior needs direct inspection;
- current canonical CI may provide additional evidence but does not replace the final audit;
- visible UI changes should be treated as regressions unless they are narrowly required for a missing intended function.

At V1 pre-release freeze:

- comprehensive Codex audit on the exact candidate SHA;
- full relevant TypeScript/domain/UI/persistence/connected regression suite;
- `npm run build` / TypeScript compile checks;
- Rust/Tauri library/build checks;
- Windows two-instance connected acceptance and restart/persistence evidence;
- release artifact/digest/build metadata checks;
- final human acceptance for visual/interaction behaviors that automation cannot prove;
- explicit UI-preservation review comparing the V1 candidate against the current established screens/layouts to ensure functionality was completed without unintended redesign.

## Dependencies

- Work only from `work/v1-composite` unless the repository's canonical routing authority is deliberately changed by the user.
- Do not promote to `main` until the release checklist explicitly reaches that step.
- Preserve authoritative domain/rules/persistence/network boundaries documented under `docs/design/`.
- Keep map/tactical provider behavior optional; V1 core remains usable without a battlemap provider.
- Do not silently convert Session transient state into Character/Campaign durable state.
- Treat the current UI implementation as a protected V1 baseline; functionality work must integrate into it rather than replace it.

## Current Next Exact Action contract

On the next Rerun dispatch after reconciliation:

1. Confirm `control.json` still authorizes sequence `1`, task `phase14-production-play-session-ux`, status `continue`.
2. Confirm `work/v1-composite` still resolves and re-fetch the current canonical head.
3. Read `CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`.
4. Reconcile current code against the V1 router and identify the next **real functional implementation gap** that can be completed without a user-only acceptance step.
5. Before editing, identify the existing UI surface involved and explicitly preserve its current structure/style unless the missing function requires a minimal compatible addition.
6. Implement that V1 slice end-to-end through the production path; do not merely satisfy a stale checkbox and do not start the final Codex audit yet.
7. Before the 18-minute checkpoint, durably record completed functionality, remaining behavioral gaps, any unavoidable UI-visible change, evidence available so far, and the next exact implementation action.
