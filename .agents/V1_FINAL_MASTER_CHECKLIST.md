# SimpleVTT Final V1 Master Checklist

Status: **OWNER-LOCKED FINAL V1 GOAL**  
Decision date: 2026-08-23 Asia/Seoul  
Canonical implementation branch: `work/v1-composite`  
GitHub tracking Epic: `#110`  
Scenario catalog: `docs/design/multiplayer-v1-scenario-catalog.md`

## Completion rule

V1 is complete only when the existing `V1-00` through `V1-80` release gates and all 112 multiplayer scenarios (`MP-A01` through `MP-I06`) pass on one exact Git SHA.

Protocol/state convergence alone is insufficient. H, acting P1, and observing P2 must see the same permitted action, authoritative dice, attack/effect presentation, result, state change, and Activity. Reconnect/late join scenarios additionally use P3.

## Phase 0 — Canonical planning

- [x] Create the 112-scenario catalog.
- [x] Create GitHub Epic `#110`.
- [x] Create work issues `#111` through `#122`.
- [x] Open documentation PR `#123` against `work/v1-composite`.
- [x] Merge PR `#123` (`a2e5f3f5e342e57fbe8bb6925b071bcb6a563c98`).

## Phase 1 — Existing V1 foundation

- [x] Reconcile latest `work/v1-composite` and record BASE_SHA (`a2e5f3f5e342e57fbe8bb6925b071bcb6a563c98`).
- [ ] Validate `V1-00`~`V1-13`: source baseline, Campaign persistence/UI, calendar, rations, Party Stash, DM Library.
- [ ] Validate `V1-20`~`V1-21`: Character creation, persistence, sheets, local actions/checks/spells/items/level-up.
- [ ] Validate `V1-30`~`V1-32`: Session lifecycle, Host authority, Character projection, owner write-back, reconnect.
- [ ] Validate `V1-40`~`V1-42`: DM live operation, optional spatial capability, physics dice and combat VFX.
- [ ] Update stale `DONE/PARTIAL/TODO` entries in `V1_RELEASE_EXECUTION_CHECKLIST.md` only from exact-head evidence.

## Phase 2 — Shared multiplayer presentation core

- [ ] `#111 / MP-01`: freeze the immutable Resolution Presentation Envelope.
- [ ] Include actor/action/targets, structured authoritative dice, selected/discarded faces, totals, outcome, damage/healing/effect, privacy, timeline, and Activity linkage.
- [ ] Freeze live/resume/catch-up behavior and prevent reconnect rerolls.
- [ ] Preserve one mechanics result and Host authority.
- [ ] Preserve one shared presentation pipeline: `VisualDiceBridge` and `buildCombatVfxProfile -> CombatVfxBridge`; do not add network-only renderers.
- [ ] `#114 / MP-02`: implement the ordered remote presentation queue and common-renderer projection.
- [ ] `#112 / MP-03`: complete H+P1+P2 attack/check/save/spell/item/action presentation and state matrix.

## Phase 3 — Multiplayer feature slices

- [ ] `#113 / MP-04`: Initiative, turns, reactions, concentration, Ready lifecycle, correction/Undo.
- [ ] `#116 / MP-05`: item/GP/XP/level-up and Party Stash ownership, approval, compensation, restart.
- [ ] `#115 / MP-06`: calendar, rations, declarative providers, distributed Long Rest.
- [ ] `#117 / MP-07`: DM Library NPC/PC preset/custom JSON, handout, spatial capability.
- [ ] `#118 / MP-08`: reconnect, late join, event gaps, exactly-once, Host/owner restart and durable failure.
- [ ] `#122 / MP-09`: role privacy, hidden outcomes, projection trust and capability security.
- [ ] `#119 / MP-10`: keyboard, screen reader, responsive UI, Reduced Motion, performance and diagnostics.

## Phase 4 — Automated acceptance

- [ ] `#120 / MP-11`: production H+P1+P2 harness covers every `AUTO` scenario.
- [ ] Assert ordered presentation envelope/queue on each peer.
- [ ] Assert scene, Character, Campaign and Activity convergence.
- [ ] Assert exactly-once for duplicate requests/batches and catch-up.
- [ ] Assert owner-only Character and Host-only Campaign durable writes.
- [ ] Assert role-private payloads, logs, errors and accessibility labels do not leak.
- [ ] Run focused suites, full tests, generated content, TypeScript and production build.
- [ ] Run Rust/Tauri tests on the exact release candidate SHA.

## Phase 5 — Windows multi-instance acceptance

- [ ] `#121 / MP-12`: run real H+P1+P2; use P3 for late join/reconnect.
- [ ] Record attack, miss, critical/advantage, damage, check, save, spell, item, heal and feature presentation on all permitted peers.
- [ ] Confirm dice enter from behind the camera, roll/collide/settle, and match authoritative faces.
- [ ] Confirm combat VFX and result cards use the same shared renderer on H/P1/P2.
- [ ] Confirm turn/reaction/Ready/correction flows.
- [ ] Confirm inventory/GP/XP/level-up/Party Stash flows and restart recovery.
- [ ] Confirm calendar/rations/Long Rest/provider flows.
- [ ] Confirm DM Library Actor/handout/spatial fallback and privacy.
- [ ] Confirm reconnect during intent, presentation and committed catch-up without reroll/duplication.
- [ ] Confirm keyboard, narrow desktop, screen-reader text result and mixed Reduced Motion preferences.
- [ ] Attach recordings/screenshots and correlated event/request/resolution IDs.

## Phase 6 — Release closure

- [ ] `V1-50`: close UX/error/accessibility recovery gaps.
- [ ] `V1-60`: all automated gates pass on one exact SHA.
- [ ] `V1-70`: all human acceptance gates pass on the same Windows artifact.
- [ ] `V1-80`: publish artifact, digest, evidence and canonical branch update.
- [ ] Close every child issue in Epic `#110` with commands, counts, SHA and evidence.
- [ ] Confirm Git working tree is clean.
- [ ] Declare V1 complete only after all boxes above are checked.

## Immediate next action

Continue `#113 / MP-04` with concentration and Ready trigger owner-routing, then close the remaining MP-03 projected spell/feature cases. Do not close MP-01 through MP-04 until the full mapped scenario set passes.

## Implementation checkpoints on `codex/v1-multiplayer`

- [x] Public Resolution Presentation Envelope schema/identity validation, structured authoritative faces, selected/discarded indices, cumulative timeline, Activity linkage, and private-control stripping.
- [x] Ordered Client presentation queue with duplicate sequence rejection, terminal catch-up without reroll, and the shared `VisualDiceBridge` / `CombatVfxBridge` path.
- [x] H+P1+P2 attack hit/miss, damage, check, healing feature, consumable, charged item, saving-throw single/multi-target, and no-roll Dash coverage.
- [x] Owner-only interrupt prompt routing with public redaction, Host ownership revalidation, accepted response continuation, and spoof rejection.
- [x] Host Undo as a new inverse `resolution-undo` event; original Activity remains historical and Client apply is exactly once.
- [x] Connected regression checkpoint: 186/186 tests, TypeScript pass, Vite production build pass (2026-08-23 Asia/Seoul).
- [ ] MP-03 remaining projected production spell/feature/invalid/concurrent cases.
- [ ] MP-04 concentration, Ready trigger live presentation, timeout, and correction-during-presentation cases.

