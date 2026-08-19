# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9 UI-first product replanning**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current planning checkpoint
Implementation remains paused. The product is being replanned from the visible UI/interaction boundary before any further source work.

Current UI planning documents:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`

Latest work-branch planning HEAD:
`72220a90e851a74b8cbf66c7038529d283957efc`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## Locked product decisions
### Dice
- Character Sheet rolls do not create a sheet-local dice frame.
- Dice use a body-level cinematic overlay, entering from screen depth/behind and moving toward the user.

### Multiplayer
- Host open immediately enters an active DM workspace.
- DM can edit and operate with zero players.
- no mandatory lobby/Ready/Play Start gate.
- players join the already-active session after internal connection/content synchronization.

### Range/spatial
- no optional spatial/range module => all otherwise-valid targets are treated in range.
- missing spatial data is not an out-of-range result.
- range/reach/LOS/cover constraints only apply when a module supplies authoritative spatial facts.

## Play surface inventory now documented
The new inventory separates:
- shared play shell/freeform/combat/action-target-result surfaces;
- shared transient dice/handout/reconnect/error layers;
- DM-only session/encounter/combatant/initiative/handout/participant/Undo tools;
- Player-only join/active-play/my-character/leave-reconnect surfaces;
- standalone SimpleVTT and Official-style Character Sheets.

It also explicitly forbids independent Host Preparing, Player Lobby, Ready, Play Start, permanent dice, permanent Inspector/Activity/Handout manager, tactical map, distance-editor, protocol/debug and healthy content-parity pages.

## Validation status
No implementation or CI was run for this planning-only checkpoint. Existing `d942d58a...` automated evidence remains historical regression evidence and does not supersede the new UI contract.

## Next Exact Action
1. Keep source implementation paused.
2. Review/refine `.agents/V0_9_PLAY_SURFACE_INVENTORY.md` with the user.
3. Detail screens one-by-one to implementation-ready fidelity, beginning with `C-01 Active Session Play Shell`.
4. For each screen define layout, visible information, actions, role differences, transitions, empty/loading/error, keyboard/responsive and human acceptance.
5. Reauthorize source work only after the relevant screen contract is approved.
6. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
