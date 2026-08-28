# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/resolver-execution-checklist-v2.md`
- checkpointed_at: `2026-08-28 Asia/Seoul`

## Durable checkpoint

The owner explicitly directed this continuation to preserve the architectural intent for future agents and remove stale Rerun blockers. Mandatory preflight was performed in README -> control -> STATE -> PLAN order, followed by `CANONICAL_ROOT.md`, the current rules planning documents, PR #159, and current exact-head workflow evidence.

The old blocker in control/STATE was stale: PR #159 candidate `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` no longer had queued workflows. All seven old exact-head runs had completed, exposing actionable evidence rather than queue congestion.

The active plan pointer is now `docs/rules/resolver-execution-checklist-v2.md`. The durable owner intent is locked in `docs/rules/common-play-resolver-architecture-charter.md`, and Rerun README requires that charter during post-preflight routing. The charter itself is aligned to checklist v2; the older checklist is historical/evidence detail only where v2 has not restated it.

The live parent after the architecture-alignment write is `a45d1fa689d5ac86b54bdbed84260506995e4bee`.

## Architecture intent retained

Future agents must preserve these distinctions rather than invent a new philosophy during routine execution:

- the product goal is a portable declarative D&D rule-execution language + generic Resolver, not legacy deletion by itself;
- named spells, feats, classes, items, conditions, monster abilities, and other content are data/presentation identity, never execution dispatch keys;
- capability maturity is tracked separately from expressive coverage;
- maturity axis: `SPEC -> KERNEL -> PORTABLE -> PRODUCTION -> MIGRATED -> ACCEPTED`;
- Gates A-M are the D&D expressive coverage map;
- A-E retain their already-proven foundation/kernel evidence;
- F-M remain implementation-dormant until evidence justifies implementation, but their coverage question may not be forgotten;
- before Gate N, every F-M gate must have an explicit `IMPLEMENTED`, `PROVEN_UNNEEDED`, or `EXPLICITLY_OUT_OF_SCOPE` disposition from a deterministic representative D&D scenario;
- a representative coverage probe may be a real legacy/product migration or a deliberately selected D&D scenario when historical SimpleVTT code does not exercise that mechanism;
- one declarative rules language does not require forcing progression/module installation/durable-source transactions into fake combat PendingResolutions;
- Gate N is final unknown-module/multi-category architecture acceptance, not a missing-primitive implementation gate.

The full normative wording lives in the charter/plan and must not be reconstructed from this summary when those files are available.

## Retained completed evidence

- Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.
- M0/legacy inventory freeze remains `DONE`; reuse `docs/rules/legacy-execution-inventory.md` and the Legacy Execution Boundary rather than repeating inventory work.
- The generic resource/economy harness integrated before PR #159 remains valid unless touched surfaces invalidate its evidence.

## PR #159 — portable Resource/Economy bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable mechanics bridge. Do not revive duplicate/superseded bridges.

Old candidate `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` evidence:

- Contract validation: SUCCESS;
- M1 Resource/Economy focused harness: 4/4 PASS, then typecheck failed;
- typecheck failure was exactly `TS2322` in `src/domain/commonPlayOperationRuntime.ts`: parsed `entryPoints[].invocation` widened to `string` instead of the declared literal union;
- Persistence application contract: 79/80 PASS; the single `501 !== 496` failure was the pre-existing stale hard-coded builtin catalog total, not a portable-bridge semantic failure;
- broad Rules/UI/Phase failures were consistent with the same shared compile gate absent contrary evidence.

Corrections made in this owner continuation:

1. Child branch `agent/m1-rulemodule-portable-activation` commit `87945628c31a751c697a8c67b4096fae7c374e0c` adds only contextual typing for parsed `entryPoints`, preserving the literal invocation union without adding semantics or a named branch.
2. Parent branch corrected the unrelated persistence baseline invariant in `tests/ui/installedContentRuntimeAdapter.test.ts`: instead of hard-coding catalog total `496`, it asserts the initial catalog contains only canonical builtin entries. A compare against the pre-change parent confirmed the final correction is exactly one addition / one deletion in that file.
3. Architecture charter and v2 plan were added on the parent; Rerun README/PLAN routing now points agents through them.
4. PR #159 description was refreshed to remove stale queued-run claims, record the latest child candidate/evidence, and restate the architecture boundary.

Latest observed exact-head workflow evidence for child `87945628c31a751c697a8c67b4096fae7c374e0c`:

- M1 Common Play Resource Economy `33148877787`: SUCCESS;
- Contract validation `33148877810`: SUCCESS;
- Rules Domain `33148877904`: SUCCESS;
- UI `33148877892`: SUCCESS;
- Persistence `33148877863`: FAILURE only on the same unrelated stale parent `501 !== 496` assertion because this child run was created before the parent baseline correction entered its merge context;
- Phase 11 Playable `33148877783`: in progress at latest observation;
- Phase 12 Connected Session `33148877843`: in progress at latest observation.

PR #159 is currently open, mergeable, and still reports exactly seven changed files. The unrelated persistence baseline correction remains on the parent and is not part of the seven-file portable bridge diff.

Phase 11/12 in-progress verification is normal active work, not an external/technical blocker. The stale queue blocker is removed and Rerun remains authorized to continue.

## Next Exact Action

On the next Rerun execution of sequence `2`:

1. perform mandatory README -> control -> STATE -> PLAN preflight;
2. read `CANONICAL_ROOT.md`, then the architecture charter, then `resolver-execution-checklist-v2.md`;
3. re-fetch parent and PR #159 child tips because either may have advanced;
4. read only the current exact-head workflows for the latest child candidate; do not rerun obsolete `60c5...` evidence;
5. inspect only actual current failures; do not treat the already-corrected parent catalog-total baseline as a product failure;
6. reconcile current parent ancestry/base context so the persistence-baseline correction participates in merge verification while PR #159's product diff remains the bounded seven files;
7. confirm PR #159 contains no named Fighter/Action Surge execution branch, second evaluator, new transport, or hidden fallback;
8. when current verification and ancestry are acceptable, follow the Rerun owner-approval rule for PR #159 merge rather than inventing another waiting reason;
9. after #159 integration, immediately create the deterministic RED for installed portable mechanics -> real production/session action dispatch through `commonPlayOperationRuntime` + generic Resolver;
10. keep the named Fighter Action Surge production seam until end-to-end generic parity, then remove only the absorbed named execution and shrink legacy baseline/inventory;
11. continue by mechanism/capability family, tracking pipeline maturity and F-M coverage dispositions according to the v2 plan;
12. do not route product work to `main`.
