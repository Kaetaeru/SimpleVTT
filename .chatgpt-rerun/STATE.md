# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:29:00+09:00`

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
- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a`: Fiend smoke advanced through Dark One's Own Luck resource projection (`beforeUses === 4`), both Smite cases skipped. UI `32947158403` **success**. This is the known-green Fiend diagnostic boundary.
- `ac4df00d256d721d1ff18ddefdae0875bf99304a`: only first Smite case active over the known-green Fiend boundary. UI `32947180684` **failure**; Connected `32947180662` failed shared build. Therefore first Smite focused case is independently red.
- `68469e1b47342573742d6a4e97c4ffd1acd87545`: first Smite case early-returned immediately after `assert.ok(smite)`, but full Fiend coverage was active; UI `32947379834` **failure**, so this result was confounded.
- `af30d17e1a5cc35df491cb757b682a1d69c9651c`: Fiend returned to the known-green `6038687` boundary; first Smite case remained skipped. No production code changed.
- `a993ff8061a362cdc102985b1e7b0858437ec5c9`: first Smite case alone reactivated on top of `af30d17`, still early-returning immediately after `assert.ok(smite)`; second Smite case remained skipped. UI run `32947669347` completed **success**. Connected run `32947669388` had `connected-protocol` **success** when checked. This clean split proves the Fiend diagnostic boundary and existing Divine Smite action projection are green; the independently red first Smite case fails **after `resolveAction` begins**.
- `78b9d382e1f68b23ddf81b710f226dc59d675ede`: test-only follow-up changed `devotionPaladin()` from `await adapter.getSnapshot()` to existing production entry `await adapter.startProductionLocalPlay("dm")`; no production mechanics changed. UI `32947748619` and Connected `32947748644` were still in progress at checkpoint. Treat their result as evidence only.

Current diagnostic test state at `78b9d382e1f68b23ddf81b710f226dc59d675ede`:

- `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`: first case returns immediately after `beforeUses === 4`; saving-throw and below-feature-level cases are temporarily `test.skip`.
- `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts`: first case is active but returns immediately after `assert.ok(smite)`; second expiry/below-level case remains temporarily `test.skip`.
- Smite fixture enters `startProductionLocalPlay("dm")` before Initiative.
- No Fiend or Smite production mechanics file was changed by the current bisection.
- All diagnostic skips/returns must be restored before canonical advancement.

The first Smite focused case checks, in order: Divine Smite action projection, committed resolution, Smite of Protection detail/Activity, TurnRuntime protection marker + expiry metadata + half-cover eligibility, then generic Undo removal. Action projection is proven green. The exact post-projection failing assertion is not yet isolated.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.
- `PLAN.md` is unchanged.
- Canonical handoff/checklist must not advance until all diagnostic skips/returns are restored and exact-head UI + Connected gates are green.

## Next Exact Action

Reconcile live `work/v1-composite` first. Check exact-SHA UI `32947748619` and Connected `32947748644` for `78b9d382e1f68b23ddf81b710f226dc59d675ede`. `a993ff8061a362cdc102985b1e7b0858437ec5c9` already proves action projection is green, so do not patch production or keep changing fixture identity speculatively. If `78b9d382...` is green, advance only the first Smite case's early return past `resolveAction` and the committed `resolutionId`/`stage`/`actionId` assertions while keeping Fiend at the known-green `6038687` boundary and the second Smite case skipped. If `78b9d382...` is red, revert only that test-fixture change and continue from the proven-green `a993ff80` boundary. Once a concrete post-`resolveAction` assertion proves a runtime seam, fix only that seam. Then restore all Fiend and both Smite tests, verify `test:fiend-luck` and `test:devotion-smite-protection` execute/pass inside exact-head `npm run build`, require UI + Connected green, and only then advance canonical handoff/checklist. Update `STATE.md` and `control.json` last per protocol.