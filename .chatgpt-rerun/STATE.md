# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:55:00+09:00`

## Durable execution checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). Live GitHub remained authoritative throughout concurrent branch movement.

Validated work was not repeated: Rage, Wild Shape, Monk Focus, Rogue R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Devotion Holy Nimbus R1, Open Hand Quivering Palm R1, Devotion Smite of Protection R1, Fiend Dark One's Own Luck R1, and College of Lore Peerless Skill R1 are preserved.

## College of Lore Peerless Skill R1 — execution-validated

- Exact product checkpoint: `88bb72dc3d725af049025728003ab6e6b8db1eb0`.
- Focused `test:lore-peerless-skill` is part of `npm run build`.
- UI run `32953773211` / frontend job `98130829740`: **success**.
- Phase 12 run `32953773099` / connected-protocol job `98130829706`: **success**.
- Canonical synchronization: handoff `c9016dc1729fa1789d03c6aad8ab4ef430ab8edd`, release checklist `8cd1be27d1afca578d84ccc6ce2407567580a3ff`.
- Windows connected-playable remains R3 packaging/acceptance debt and is not an R1 completion gate.

Inventory exclusions to preserve:

- Life Domain `Preserve Life`: player-selected per-target healing allocation required.
- Circle of the Land `Land's Aid`: richer point/multi-result input required.
- Berserker `Retaliation`: current `InterruptView` is a single boolean option while Retaliation requires choosing a melee weapon or Unarmed Strike; do not auto-select and erase player agency. Revisit only when an existing clean action-choice reaction surface is available.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## College of Lore Cutting Words — live branch changed during reconciliation

Earlier source inspection correctly found that the pre-existing queue alone was too early for the damage-roll trigger: `phase09RealRuntimeAttackAdapter` built/resolved the atomic attack at `attack-result`, exposed damage faces afterward, and `queueAtomicAttackDamageMultiplier` was consumed during that build. A partial attack/check-only Cutting Words bridge remains prohibited.

Live GitHub then advanced beyond that checkpoint and added an explicit staged preview/adjustment seam:

- `bb51a63d1b4f717a2ba5e354c2bbc7b9ec246eae` (`refactor: expose staged atomic damage preview`) adds `previewRuntimeAtomicAttackDamage(adapter)` in `phase09RealRuntimeAttackAdapter.ts` so a hit can be deterministically previewed at `attack-result` before the normal staged commit.
- `6a2ab2b322cea054c2fe0f6c488f5e53b3fe0223` (`feat: expose staged atomic damage adjustment seam`) adds queued flat damage reduction, preview storage, and multiplier peek helpers in `realAttackTransactionService.ts`.
- No Cutting Words completion is claimed at this checkpoint. These commits are infrastructure/seam work only until the production adapter, focused gate, exact-head CI, and canonical advancement exist.

### Required seam verification before any Cutting Words adapter

The new preview path calls the same `build()` / `resolveAtomicAttackTransaction()` used by the real staged attack. That service consumes queued damage multipliers during resolution. Uncanny Dodge already queues such a multiplier.

Before using the preview seam, verify and test that previewing a hit cannot consume or lose an existing Uncanny Dodge multiplier before the real commit. `peekAtomicAttackDamageMultiplier` appears intended to preserve this state, but no assumption should be made until the exact call flow/test proves it.

Also verify that preview + queued flat reduction rebuilds the same deterministic damage faces and applies the reduction before authoritative commit, with no duplicate write-back/events.

## Backup mechanically clean candidate

If the staged preview seam cannot preserve existing attack modifiers without broad refactoring, prefer Berserker `Mindless Rage` over Retaliation:

- `resolveBerserkerMindlessRageStart` is source-complete and domain-tested.
- It is automatic on Rage start, requires no player choice, removes existing Charmed/Frightened, and installs the condition-immunity marker.
- `compileBarbarianRageEnd` already removes all effects with the shared Barbarian Rage special duration key, so Mindless Rage cleanup composes with current Rage termination.
- This remains a backup only; do not switch while live Cutting Words seam work is still viable.

## Next Exact Action

Reconcile live `work/v1-composite` first. Inspect the exact staged preview/adjustment implementation at and after `6a2ab2b322cea054c2fe0f6c488f5e53b3fe0223`.

1. Prove a preview does not consume/lose a queued Uncanny Dodge multiplier; add the smallest regression fix/test only if needed.
2. Prove preview faces/total are stable across the subsequent authoritative rebuild and that queued flat reduction is applied exactly once before commit.
3. Only if both are green, resume the thin Cutting Words adapter using `resolveLoreCuttingWords` for all three trigger families (ability check, attack roll, damage roll), existing targeting/resource/reaction/event/Activity/Undo primitives, one focused deterministic gate, and `npm run build` wiring.
4. Require exact-head UI frontend + Phase 12 connected-protocol green before canonical handoff/checklist advancement.
5. If the seam is not clean without broad refactoring, record the blocker and switch to the backup `Berserker Mindless Rage` slice.

Do not reopen Peerless or earlier validated R1 work without direct regression evidence. Do not expand into R2 unless a direct R1 regression requires it.

PLAN unchanged; `control.json` must be written last per protocol.
