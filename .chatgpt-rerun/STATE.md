# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:41:00+09:00`

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
- `a993ff8061a362cdc102985b1e7b0858437ec5c9`: first Smite case alone reactivated on top of `af30d17`, early-returning immediately after `assert.ok(smite)`; second Smite case remained skipped. UI `32947669347` **success**. This proves Fiend diagnostic setup and existing Divine Smite action projection are green.
- `78b9d382e1f68b23ddf81b710f226dc59d675ede`: test-only fixture alignment changed `devotionPaladin()` to existing production entry `startProductionLocalPlay("dm")`; UI `32947748619` **success** and Connected `32947748644` production frontend **success**. No production mechanics changed.
- `0b23d14e3f22615d1365560edaf0b1c626ff6a78`: first Smite case advanced through `resolveAction` and committed `resolutionId`, `stage === "complete"`, and `actionId`, then returned before Smite detail/Activity. UI `32947868960` **success**. Therefore Divine Smite execution and committed resolution identity are green.
- `6f2d322bfe77d89591909c240d88c0b2a3e683fd`: first Smite case advanced through Smite resolution-detail and Activity provenance assertions, then returned before TurnRuntime marker checks. UI `32948045089` **success**, including `Typecheck and build`. Therefore action projection, committed Divine Smite execution, Smite of Protection detail, and Activity provenance are green.
- `52555dca30a83e9244edf905d89ce870261a110c`: first Smite case advanced only through TurnRuntime protection marker existence, then returned before expiry metadata. UI `32948247304` **success**, including `Typecheck and build`. Therefore marker persistence/projection is green.
- `506ab6fb2b1ab219f530a60aaeb0ba8270c38c2c`: first Smite case advanced through marker expiry metadata and returned before half-cover eligibility. UI `32948422256` **success**, including `Typecheck and build`; Connected `32948422247` connected-protocol and production frontend **success** when checked. Therefore expiry metadata is green.
- `013a02f8d7510a896c13091748a0333360d537ff`: first Smite case advanced through `smiteOfProtectionGrantsHalfCover(...) === true` and returned before generic Undo. UI `32948609647` **success**, including `Typecheck and build`; Connected `32948609609` connected-protocol and production frontend **success** when checked. Therefore half-cover eligibility is green and generic Undo is the sole remaining assertion in the first Smite case.
- `6ea5efbda2a56a8b1405043804b4f3ad4a8485cd`: removed only that final diagnostic return so the existing generic Undo assertion executes. UI `32948793586` **failure** specifically at `Typecheck and build`, while every earlier UI step succeeded. Therefore generic Undo removal is now the first and only concrete failing assertion in the first Smite case. No production mechanics changed by the bisection.

Current diagnostic test state at live code boundary `6ea5efbda2a56a8b1405043804b4f3ad4a8485cd`:

- `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`: first case returns immediately after `beforeUses === 4`; saving-throw and below-feature-level cases are temporarily `test.skip`.
- `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts`: first case now runs through generic Undo and is red only at the post-Undo marker-removal assertion; second expiry/below-level case remains temporarily `test.skip`.
- Smite fixture enters `startProductionLocalPlay("dm")` before Initiative.
- No Fiend or Smite production mechanics file was changed by the current bisection.
- All diagnostic skips/returns must be restored before canonical advancement.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.
- `PLAN.md` is unchanged.
- Canonical handoff/checklist must not advance until all diagnostic skips/returns are restored and exact-head UI + Connected gates are green.

## Next Exact Action

Reconcile live `work/v1-composite` first. Generic Undo is the sole concrete failing assertion in the first Smite case: inspect only the existing `paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` event-history/Undo composition together with the repository's event-native Undo path, determine why the protection marker survives `undoLastResolution()`, and make the smallest proven production fix. Do not alter already-green Smite projection/detail/Activity/marker/expiry/half-cover behavior. Keep Fiend at the known-green `6038687` diagnostic boundary and the second Smite case skipped while fixing this seam. After the Undo seam is green, restore the second Smite case and full Fiend focused coverage, verify `test:fiend-luck` and `test:devotion-smite-protection` execute/pass inside exact-head `npm run build`, require UI + Connected green, then advance canonical handoff/checklist. PLAN unchanged; update `STATE.md` then `control.json` last per protocol.