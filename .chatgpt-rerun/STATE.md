# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:22:00+09:00`

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

Actions job logs remain inaccessible to this integration (403), so the gate was isolated by exact-SHA test-only bisection instead of speculative production edits.

- `a2b6a941bb1f90fa392bdb9dae680c86b36d5747` skipped both Smite focused cases and kept only the earliest Fiend action-projection smoke. UI run `32946981597` completed **success**.
- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a` advanced that Fiend smoke through resource projection (`beforeUses === 4`) while both Smite cases stayed skipped. UI run `32947158403` completed **success**.
- `ac4df00d256d721d1ff18ddefdae0875bf99304a` changed only the first Smite focused case from `test.skip` to `test`; the second Smite case stayed skipped and the Fiend test remained at the known-green `6038687` diagnostic boundary. UI run `32947180684` completed **failure**; Connected run `32947180662` also failed on the shared build. Therefore the first Smite focused case is independently red. This is concrete evidence; the earlier assumption that Fiend was the sole blocker is obsolete.
- `cd242e4d378182cfdc08f8fb850b98210606b0da` restored all three Fiend focused cases while retaining the first Smite case active and the second Smite case skipped. UI run `32947189195` and Connected run `32947189164` both completed **failure**. This head is the latest observed code head at checkpoint.

Current diagnostic test state at `cd242e4d378182cfdc08f8fb850b98210606b0da`:

- `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`: all three Fiend cases active.
- `tests/ui/paladinDevotionSmiteOfProtectionRuntime.test.ts`: first case active; second expiry/below-level case still `test.skip` from bisection.
- No Fiend or Smite production mechanics file was changed by the bisection commits.

The first Smite focused case checks, in order: Divine Smite action projection, committed resolution, Smite of Protection detail/Activity, TurnRuntime protection marker + expiry metadata + half-cover eligibility, then generic Undo removal. The exact failing assertion inside this case is not yet isolated. Do not patch production code until it is.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.
- `PLAN.md` is unchanged.
- Canonical handoff/checklist must not advance until all diagnostic skips are restored and exact-head UI + Connected gates are green.

## Next Exact Action

Reconcile live `work/v1-composite` first. Starting from `cd242e4d378182cfdc08f8fb850b98210606b0da` unless GitHub has moved, isolate the exact assertion inside the **first** `paladinDevotionSmiteOfProtectionRuntime.test.ts` case. Use the smallest deterministic early-return bisection while keeping unrelated Fiend coverage at the known-green diagnostic boundary from `6038687` and keeping the second Smite case skipped only for isolation. First split around the committed-resolution/detail/Activity checks versus the TurnRuntime marker/Undo checks. Do not edit `paladinDevotionSmiteOfProtectionRuntimeAdapter.ts` until that bisection proves the failing seam. After the seam is fixed, restore all Fiend and both Smite tests, verify `test:fiend-luck` and `test:devotion-smite-protection` execute/pass inside exact-head `npm run build`, require UI + Connected green, then advance canonical handoff/checklist. Update `STATE.md` and `control.json` last per protocol.