# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:59:00+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live state remained authoritative during concurrent branch movement. `PLAN.md` is unchanged.

Do not repeat validated R1 work without direct regression evidence: Rage, Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge, Berserker Intimidating Presence, Open Hand Wholeness of Body, Open Hand Fleet Step, Devotion Holy Nimbus, Open Hand Quivering Palm supported path, Devotion Smite of Protection, Fiend Dark One's Own Luck, and College of Lore Peerless Skill.

Peerless Skill exact product checkpoint remains `88bb72dc3d725af049025728003ab6e6b8db1eb0`; UI `32953773211` / frontend `98130829740` and Phase 12 `32953773099` / connected-protocol `98130829706` are green. Canonical sync remains handoff `c9016dc1729fa1789d03c6aad8ab4ef430ab8edd` and release checklist `8cd1be27d1afca578d84ccc6ce2407567580a3ff`.

## College of Lore Cutting Words — implementation/gate in progress

The earlier staged-damage blocker was superseded by live source work that adds a sanctioned pre-commit preview/rebuild path. No completion is claimed yet.

Relevant live commits:

- `bb51a63d1b4f717a2ba5e354c2bbc7b9ec246eae`: staged atomic damage preview.
- `6a2ab2b322cea054c2fe0f6c488f5e53b3fe0223`: queued flat damage reduction + staged preview helpers.
- `bed4d8fc0817679dc7bc83384649b1577975b90d`: Cutting Words production follow-up bridge.
- `472b3e4f0939d733eda76e8cfa0d57b15b6db20a`: installs bridge in `offlineRuntimeAdapters.ts`.
- `60814cfb8b0be8e9b19576ee1a0b91ea6f0bbde6`: focused runtime coverage for ability-check, attack-roll, staged damage-roll, Activity/economy/Undo, and below-level gate.
- `d3cd0265795ebdd7bf0350489bce07e3006a7953`: preserves queued damage multiplier across staged preview.
- `aaa23862dc1d90b438d98e5722ad273f55900eb7`: stages Cutting Words decision before authoritative atomic damage build and reuses `previewRuntimeAtomicAttackDamage`.

`package.json` already contains `test:lore-cutting-words` and includes it in `npm run build`; do not duplicate build wiring.

Latest reconciled product head before this checkpoint: `aaa23862dc1d90b438d98e5722ad273f55900eb7` (`fix: stage Cutting Words before atomic damage build`).

Exact-head Actions currently observed:

- UI run `32955787174`, frontend job `98137024017`: **in progress**. Steps through Phase 14/session/progression checks were green; authoritative spellcasting was still running, then Phase 09 real mechanics and `Typecheck and build` remained.
- Phase 12 Connected Session run `32955787143`: **in progress**.

No red was observed at checkpoint time. Do not add speculative fixes while these exact-head gates are running.

Shared-seam invariant to preserve: staged Cutting Words damage adjustment must not consume/drop existing queued attack modifiers (especially Uncanny Dodge multiplier), reroll authoritative faces unexpectedly, duplicate Character write-back/events, or break event-native Undo. Test the shared seam only as required; do not reopen Rogue R1 mechanics themselves.

## Inventory exclusions / backup

- Life Domain `Preserve Life`: requires explicit per-target allocation; no auto-allocation.
- Circle of the Land `Land's Aid`: requires richer point/multi-result input; no fake simple button.
- Berserker `Retaliation`: requires player choice of melee weapon/Unarmed Strike; do not auto-select an attack. Reuse a real action-choice reaction surface if/when available.
- If Cutting Words staged rebuild cannot preserve existing attack modifiers without broad refactor, stop and use the smaller Berserker Mindless Rage inventory slice rather than expanding the attack subsystem.
- R2 remote-owner exactly-once/reconnect/event-native Undo matrix stays excluded absent direct R1 regression.

## Next Exact Action

1. Reconcile live `work/v1-composite` first; GitHub wins if newer than this checkpoint.
2. Observe exact-head UI and Phase 12 results for the newest Cutting Words product head. Do not rerun earlier green slices.
3. If red, read the first concrete Cutting Words/staged-seam failure and make the smallest single fix only.
4. If both UI frontend and Phase 12 connected-protocol are green at the same exact product head, record exact run/job evidence in `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`.
5. Then update `STATE.md` and `control.json` last, moving the R1 pointer to the next honest remaining subclass inventory slice.
6. Windows connected-playable remains later packaging/acceptance debt and is not this R1 completion gate.
