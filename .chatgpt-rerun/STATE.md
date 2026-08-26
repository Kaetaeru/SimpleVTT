# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:10:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, and Open Hand Quivering Palm R1 remain source-complete/execution-validated.

**Paladin Devotion Smite of Protection R1 source/install/focused coverage/build-gate wiring still exists, but execution validation remains blocked by the preceding Warlock Fiend Dark One's Own Luck focused gate. Do not duplicate Smite work.**

Smite work already present:

- `904ad145579425003d6a05c1edea6f881ac857d0` — production bridge.
- `fed1bd8404947f8401a66df902e89fa82127c3ce1` — offline installation.
- `e793e4312a99b686c29467b1c48796d1359802bf` — focused production coverage.
- `7bc0f9ae93da1583a40b7ea5ec08920506ce0fc1` — `test:devotion-smite-protection` build wiring.

Fiend findings to preserve:

- Fiend mechanics are already implemented; do not add a new runtime bridge:
  - `97503b90d14354524b2c8f4e4852bb2d9e508318` — `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts`.
  - `05df3dc19a3eb96b78b1533e0208f84b1e52daf3` — offline runtime installation.
  - `d663043447f23d863ca7e81a3cb023e7f4f47981` — class-feature resource projection already includes Fiend runtime resources.
- Existing production reconcile explicitly removes fixture `char.aelar` when `session.role === "host"`; this explained the earlier fixture/live-Scene identity failures.
- Concurrent test recovery through `eb70d8df82714aba809466382f1a13854eac8e79` still left the Fiend build gate red.
- Minimal test-only commit `c15e85808f5146b590af9bde80dc054d0ff4ebc5` isolated a unique Fiend actor and separated DM preview from host session; exact-head UI still failed at `Typecheck and build`.
- Follow-up test-only commit `3f99ea86a207ce74fe9eda8e246b502d83e07e01` switched fixture setup to the existing production API `startProductionLocalPlay("dm")`, which sets DM role + offline session + production reconcile without private fixture semantics.
- No production mechanics files were changed by those two commits.

Exact-head evidence for `3f99ea86a207ce74fe9eda8e246b502d83e07e01`:

- UI run `32946161333`, job `98107196916`: steps 1-28 green; `Typecheck and build` failed.
- Phase 12 Connected Session run `32946161388`, job `98107197076`: connected-session authority protocol and Phase 11 offline walkthrough green; production frontend gate failed because the same shared build remained red.
- GitHub Actions job-log download is unavailable to this integration (`Resource not accessible by integration` / 403). Do not repeat that endpoint.
- Because the production fixture contract is now aligned and the gate is still red, do not keep changing fixture identity/role speculatively. The remaining failure must be isolated to a concrete focused subtest/assertion before touching production mechanics.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.
- `PLAN.md` is unchanged.
- The release checklist remains `PARTIAL` until current R1 execution evidence is green.

## Next Exact Action

Reconcile live `work/v1-composite` first. Starting from code head `3f99ea86a207ce74fe9eda8e246b502d83e07e01` unless GitHub has moved, isolate which of the three `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts` cases is still failing (ability-check, saving-throw, or below-feature-level) using the smallest deterministic test-name/skip bisection because full Actions logs are inaccessible. Do not alter Fiend production code until one concrete failing assertion proves a runtime seam. Fix only that first evidence-backed seam, rerun exact-head UI + Connected gates, then if green verify both `test:fiend-luck` and `test:devotion-smite-protection` execute/pass inside `npm run build`; only then advance canonical handoff/checklist from the live next pointer.