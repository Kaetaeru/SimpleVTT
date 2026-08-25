# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical target branch: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

## Active V1 planning authority — read this before product work

After the mandatory Rerun read order (`README.md -> control.json -> STATE.md -> PLAN.md`), read the current V1 planning sources in this order:

1. `.agents/README.md` — priority/router rules.
2. `.agents/DEFERRED_FIXES.md` — any currently blocking deferred gate.
3. `.agents/V1_CURRENT_HANDOFF.md` — **primary active execution plan and Next Exact Action**.
4. `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` — full V1 dependency/order/acceptance contract.
5. `.agents/CURRENT_WORK.md` — latest implementation evidence and already-completed mechanics.
6. Relevant `docs/design/` contracts for the selected item.

Rerun must not invent a second V1 implementation plan inside this file. This file is a resume pointer into the canonical `.agents` planning set. Reconcile those files with actual GitHub state before acting; a newer branch/PR/commit can make embedded SHA or branch prose stale. Do not repeat work already present and validated on the active head.

## Current active slice

Canonical sequence is currently **R1 — Barbarian Rage lifecycle** from `.agents/V1_CURRENT_HANDOFF.md`.

- Tracking issue: `#124` — `R1: Barbarian Rage lifecycle`
- Active draft PR: `#125` — `feat(v1): add Barbarian Rage atomic start/end lifecycle`
- Working branch: `codex/v1-barbarian-rage`
- PR base: `work/v1-composite`
- Last reconciled PR head: `af430394bc8d3312468c8aff3d477331e9911467`

The Issue/PR description can lag implementation. Always inspect the current PR head/diff before deciding what remains.

At `af430394` the branch already contains the Rage domain foundation, including atomic start/end, resistance/status metadata, concentration termination, heavy-armor termination handling, Rage damage scaling, and Strength-based weapon/unarmed Rage damage integration. Do not recreate those paths.

GitHub Actions associated with `af430394` are green for UI, Rules Domain, Contract validation, Phase 11 Playable, and Phase 12 Connected Session.

## Next Exact Action

1. Fetch PR `#125` and reconcile its current head against `af430394` before writing.
2. If no later commit already covers it, add the smallest regression in the existing production snapshot/weapon-runtime test surface proving that projected attacks expose the correct `attackAbility` and Rage damage metadata for the real production path. Do not add a new test framework or persistence schema.
3. Then continue the remaining Rage chain from the canonical handoff instead of revisiting completed domain work: player-facing Session action projection/resource economy -> local/freeform/initiative Activity + event-native Undo -> connected remote-owner exactly-once/reconnect/Undo.
4. Preserve the existing R1 order after Rage: Wild Shape -> Monk Focus -> Rogue Cunning Action/Uncanny Dodge, unless the canonical planning files or an explicit owner decision change it.

## Resume invariants

- Actual GitHub state wins stale checkpoint prose.
- `.agents/V1_CURRENT_HANDOFF.md` is the active execution pointer; `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` is the broader release contract.
- Do not replay previously validated V1-13 or Indomitable work.
- Prefer existing services/adapters and the smallest changed-file set; do not add parallel Rage engines or speculative abstractions.
- One active implementation slice at a time, deterministic test first where a behavior gap remains, then focused + regression validation.
- Windows two-instance/human acceptance remains a later release gate unless the canonical plan explicitly moves it forward.
