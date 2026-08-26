# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:27:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, and Open Hand Quivering Palm R1 remain source-complete/execution-validated.

Paladin Devotion Smite of Protection R1 source/install/focused coverage/build wiring already exists and must not be duplicated:

- `904ad145579425003d6a05c1edea6f881ac857d0` — production bridge.
- `fed1bd8404947f8401a66df902e89fa82127c3ce1` — offline installation.
- `e793e4312a99b686c29467b1c48796d1359802bf` — focused production coverage.
- `7bc0f9ae93da1583a40b7ea5ec08920506ce0fc1` — `test:devotion-smite-protection` build wiring.

Warlock Fiend Dark One's Own Luck mechanics also already exist; do not add another bridge. Earlier fixture/host recovery is preserved, including `a51154f3a06a00122df12459e8465129123d6d41` (`fix: treat local DM as ability check host`).

### Deterministic bisection evidence

Actions job logs remain inaccessible to this integration (403), so exact-SHA test-only bisection is authoritative evidence.

- `a2b6a941bb1f90fa392bdb9dae680c86b36d5747`: both Smite cases skipped; earliest Fiend action-projection smoke. UI `32946981597` **success**.
- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a`: Fiend smoke advanced through Dark One's Own Luck resource projection (`beforeUses === 4`), both Smite cases skipped. UI `32947158403` **success**.
- `ac4df00d256d721d1ff18ddefdae0875bf99304a`: only first Smite case changed from skipped to active while Fiend stayed at the known-green diagnostic boundary. UI `32947180684` **failure**; Connected `32947180662` failed shared build. Therefore first Smite focused case is independently red.
- `af30d17e1a5cc35df491cb757b682a1d69c9651c`: Fiend restored to the known-green `6038687` boundary while first Smite case early-returns immediately after confirming Divine Smite action projection; second Smite case remains skipped. UI `32947608202` **success**. Therefore Fiend diagnostic setup and Smite Divine Smite action projection are green; the first Smite failure is after action projection.
- `78b9d382e1f68b23ddf81b710f226dc59d675ede`: fixture-only change in `devotionPaladin()` from `await adapter.getSnapshot()` to `await adapter.startProductionLocalPlay("dm")`, aligning the Smite fixture with the production local-play path required by the existing authoritative spell/TurnRuntime bridge. No production mechanics changed. UI `32947748619` and Connected `32947748644` were in progress at checkpoint. The first Smite case still early-returns after action projection, so this SHA only validates fixture alignment/projection until the diagnostic return is advanced.

Current diagnostic test state at live head `78b9d382e1f68b23ddf81b710f226dc59d675ede`:

- `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`: first case returns immediately after `beforeUses === 4`; saving-throw and below-feature-level cases are temporarily `test.skip` to hold the known-green boundary.
- `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts`: first case is active but returns immediately after `assert.ok(smite)`; second expiry/below-level case remains temporarily `test.skip`.
- Smite fixture now enters `startProductionLocalPlay("dm")` before Initiative.
- No Fiend or Smite production mechanics file was changed by this bisection/fix candidate.

The first Smite focused case checks, in order: Divine Smite action projection, committed resolution, Smite of Protection detail/Activity, TurnRuntime protection marker + expiry metadata + half-cover eligibility, then generic Undo removal. Action projection is now proven green. The exact post-projection failing assertion is not yet isolated.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.
- `PLAN.md` is unchanged.
- Canonical handoff/checklist must not advance until all diagnostic skips/returns are restored and exact-head UI + Connected gates are green.

## Next Exact Action

Reconcile live `work/v1-composite` first. Check exact-SHA UI `32947748619` and Connected `32947748644` for `78b9d382e1f68b23ddf81b710f226dc59d675ede`. If the diagnostic fixture-alignment SHA is green, advance only the first Smite case's early return to after the committed-resolution + Smite detail/Activity assertions while keeping Fiend at the known-green `6038687` boundary and the second Smite case skipped. If that split is green, the failure is in TurnRuntime marker/expiry/half-cover/Undo; if red, bisect only the committed-resolution/detail/Activity half. Do not edit `paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` until a concrete post-projection seam is proven. After the seam is fixed, restore all Fiend and both Smite tests, verify `test:fiend-luck` and `test:devotion-smite-protection` execute/pass inside exact-head `npm run build`, require UI + Connected green, then advance canonical handoff/checklist. Update `STATE.md` and `control.json` last per protocol.
