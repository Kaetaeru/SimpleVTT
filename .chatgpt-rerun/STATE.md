# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:05:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, Open Hand Quivering Palm R1, and the validated Smite of Protection boundaries remain preserved.

## Smite of Protection result — do not reopen

Paladin Devotion Smite of Protection R1 is green at the focused UI/build gate.

- `d128fc0db9c58ca46b426c140faf6c726890bd74` fixed generic Undo by excluding TurnRuntime spell-slot current counts from Character durable write-back.
- `89cc64213032c016de053d6a88b51e23aa91209d` restored the real public `undoLastResolution()` assertion and passed UI `32950156016`.
- `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` restored complete Smite coverage including next-turn expiry and below-level behavior and passed UI `32950193461`.

Do not repeat the Smite bisection unless a direct regression proves it necessary.

## Current Fiend Dark One's Own Luck bisection

Warlock Fiend Dark One's Own Luck mechanics already exist in `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts`; do not add another bridge. Existing local-DM ability-check host fix `a51154f3a06a00122df12459e8465129123d6d41` is preserved.

- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a` remains the earlier known-green diagnostic boundary through Fiend resource projection (`beforeUses === 4`), UI `32947158403` success.
- `5ecc2eb7d77a0c89b1444eac9032bd9ed0a7a574` restored all three Fiend focused cases and exposed the Fiend-only build red; UI `32950308840` failed at `Typecheck and build` while its parent full Smite gate was green.
- `875bcd926b59366092f0e912f877888965b69538` kept only the first ability-check/Activity/Undo case active and was red, proving the failure is inside the first Fiend ability-check case after the previously green resource projection boundary.
- `5cca3692234d59b3cfcaf108e5bcd54d7bb0dde0` returned immediately after the DM DC produces the Fiend interrupt. UI `32950659433` passed, proving ability-check resolution, DM DC adjudication, and interrupt offer are green.
- `7c3aaa272dfae45f2b8bf3919fabdadc3b68c00f` advanced through `respondToInterrupt(true)` and asserted `checkOutcome === "성공"`. UI `32950832046` failed at `Typecheck and build`. Therefore the failing boundary is after the interrupt is offered and at/inside accepted Fiend response processing; resource/Activity/Undo assertions were not reached.
- Live diagnostic HEAD at checkpoint is `7597d5358b00058692c3ce024f325179cd05166f` (`test: bisect Fiend interrupt response call`). It calls `respondToInterrupt(true)` and returns immediately before any post-response assertion. UI `32951016604` and Connected `32951016520` are the exact-SHA evidence runs; UI had reached `Typecheck and build` and was still in progress at checkpoint.
- No Fiend production mechanics file has been changed by this bisection.

Static inspection confirms the existing Fiend adapter reuses TurnRuntime resource state, `resolveFiendDarkOnesOwnLuck`, `applyResolutionEvents`, Character write-back, and `commitAdapterTurnRuntimeState`; do not replace those with a new subsystem. The next diagnostic must distinguish whether `respondToInterrupt(true)` itself completes cleanly versus the first post-response outcome assertion being wrong. A plausible test-fixture issue is that Dark One's Own Luck adds d10 but does not guarantee success; do not change production behavior merely to satisfy `checkOutcome === "성공"` unless exact evidence proves the mechanics path failed.

`PLAN.md` is unchanged. Canonical handoff/checklist must not advance while Fiend diagnostic returns/skips remain or exact-head gates are red/pending.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## Next Exact Action

Reconcile live `work/v1-composite` first. Read UI `32951016604` and Connected `32951016520` for exact HEAD `7597d5358b00058692c3ce024f325179cd05166f`.

- If `7597d53` is green, `respondToInterrupt(true)` itself is green and the first failing assertion is the hard-coded `checkOutcome === "성공"`. Inspect the actual deterministic initial total / d10 expectation and change only the test if the feature correctly adds d10 but still legitimately fails; otherwise isolate resource/Activity/Undo one boundary at a time.
- If `7597d53` is red, the fault is inside the accepted interrupt call before any post-response assertion; isolate seed/domain/apply/write-back/TurnRuntime commit using existing helpers and do not introduce a new bridge.
- After the first Fiend ability-check case is green, re-enable only the saving-throw case, then the below-level case.
- After all Fiend cases are green, remove all diagnostic skips/returns and require exact-head `npm run build`, UI, and Connected green with both `test:fiend-luck` and `test:devotion-smite-protection` wired into build; only then advance canonical handoff/checklist to the next R1 inventory item.

PLAN unchanged; update `STATE.md` then `control.json` last per protocol.
