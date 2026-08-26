# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:57:31+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, and Open Hand Quivering Palm R1 remain source-complete/execution-validated.

Paladin Devotion Smite of Protection R1 source/install/build wiring already exists and must not be duplicated:

- `904ad145579425003d6a05c1edea6f881ac857d0` — production bridge.
- `fed1bd8404947f8401a66df902e89fa82127c3ce1` — offline installation.
- `e793e4312a99b686c29467b1c48796d1359802bf` — focused production coverage.
- `7bc0f9ae93da1583a40b7ea5ec08920506ce0fc1` — `test:devotion-smite-protection` build wiring.

Warlock Fiend Dark One's Own Luck mechanics also already exist; do not add another bridge. Existing local-DM ability-check host fix `a51154f3a06a00122df12459e8465129123d6d41` is preserved.

## Smite Undo result

The Smite generic Undo failure is resolved and must not be reopened unless a direct regression proves otherwise.

- `013a02f8d7510a896c13091748a0333360d537ff` — Smite first case green through half-cover eligibility.
- `6ea5efbda2a56a8b1405043804b4f3ad4a8485cd` — exposing generic Undo made the first Smite case red.
- `ac1594e56eb451693346c501d7f1f70b0ba3a913` — direct runtime `undoResolutionEvents(...)` committed; runtime validator was green.
- `e12598f8b48d5723f47d40368df07b65ea6f07a4` / `9bdff768e992e52a462a6c918e73970f14f913bf` — failure narrowed to inverse Character durable projection/write-back.
- `d128fc0db9c58ca46b426c140faf6c726890bd74` (`fix: keep spell slots session-only in write-back`) excludes only `spell-slot-<level>` current-count resource changes from Character durable write-back because spell-slot current counts are authoritative TurnRuntime session state. UI `32949969840` succeeded.
- `89cc64213032c016de053d6a88b51e23aa91209d` restored the real public `undoLastResolution()` assertion; UI `32950156016` succeeded.
- `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` restored the complete Smite focused gate including next-turn expiry and below-level behavior; UI `32950193461` succeeded through `Typecheck and build`.

Therefore Paladin Devotion Smite of Protection R1 behavior is green at the UI/build gate. Do not repeat the prior Smite bisection.

## Current Fiend bisection

- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a` is the earlier known-green Fiend diagnostic boundary through resource projection (`beforeUses === 4`), UI `32947158403` success.
- `5ecc2eb7d77a0c89b1444eac9032bd9ed0a7a574` restored all three Fiend focused cases after the Smite fix. UI `32950308840` completed **failure** specifically at `Typecheck and build`; all earlier UI steps succeeded. Connected `32950308806` was still running when last checked.
- Because parent `ec89fa2` has the complete Smite focused gate green and `5ecc2eb` changed only `tests/ui/warlockFiendDarkOnesOwnLuckRuntime.test.ts`, the newly exposed red is confined to restored Fiend focused coverage, not Smite or the spell-slot write-back seam.
- Live HEAD `875bcd926b59366092f0e912f877888965b69538` (`test: isolate Fiend ability-check path`) is test-only. It leaves the first ability-check/Undo case active and temporarily skips the saving-throw case plus below-feature-level case.
- Exact-head diagnostic workflows for `875bcd926b59366092f0e912f877888965b69538` are in progress: UI `32950473694`, Connected `32950473821`.
- No Fiend production mechanics file has been changed by this bisection.

`PLAN.md` is unchanged. Canonical handoff/checklist must not advance while Fiend diagnostic skips remain or exact-head gates are red/pending.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## Next Exact Action

Reconcile live `work/v1-composite` first. Check UI `32950473694` and Connected `32950473821` for exact HEAD `875bcd926b59366092f0e912f877888965b69538`.

- If `875bcd9` is green, the complete Fiend ability-check/Activity/Undo case is green; re-enable only the saving-throw case next and keep the below-level case skipped until that boundary is known.
- If `875bcd9` is red, isolate only the first Fiend ability-check case from the already-green `beforeUses === 4` boundary. Do not change production code until the first concrete failing assertion is proven.
- After every Fiend case is green, remove all diagnostic skips, require `test:fiend-luck` and `test:devotion-smite-protection` inside exact-head `npm run build`, require exact-head UI + Connected green, then advance `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` to the next R1 item.

PLAN unchanged; update `STATE.md` then `control.json` last per protocol.