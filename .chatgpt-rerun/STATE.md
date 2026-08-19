# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9 UI-first replanning complete through implementation-facing contracts**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current checkpoint
Source implementation remains paused.

The Session UI is now specified at five levels:
1. product philosophy;
2. complete visible scene map;
3. interaction contract;
4. low-fidelity visual layout;
5. implementation-facing architecture/reuse/data/behavior contracts.

Latest planning HEAD:
`a1ee400d1bcb7b8db3f72d793e7bdefb7782c8e9`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

No source code or CI was run in this planning turn.

## Current planning documents
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`
- `.agents/V0_9_SESSION_UI_ARCHITECTURE_CONTRACT.md`
- `.agents/V0_9_EXISTING_UI_REUSE_MAP.md`
- `.agents/V0_9_QUICK_SHEET_INFORMATION_ARCHITECTURE.md`
- `.agents/V0_9_FULL_SHEET_IN_SESSION_REUSE_CONTRACT.md`
- `.agents/V0_9_ACTION_DOCK_BEHAVIOR_MATRIX.md`

## Locked architecture decisions
### App/Session root
- active Session is app-level `SessionModeRoot`, not one Library route;
- `SessionModeRoot` contains SessionBar, MainFocus, ActionDock, UtilityRail and LayerHost;
- Host enters active DM Session immediately after Host succeeds;
- no Player Lobby / Ready / Play Start visible gate.

### State ownership
New Session UI state may own only presentation state such as:
- open tool/layer;
- intent/detail/selected-target UI step;
- focus/scroll restoration;
- responsive pane presentation.

It may not own duplicate Character, Scene, action legality, initiative, participant/session truth, Resolution/Undo, handout or installed-content state.

`AppProvider` / existing adapters remain the command and projection authority.

### Existing UI migration
Reuse mechanics/data logic from current production screens and Character Sheets, but replace conflicting normal-Session presentation:
- Library sidebar around active Play;
- `플레이로 돌아가기` route round-trip;
- permanent Actor card wall;
- permanent category hotbar;
- Freeform action economy;
- Host lifecycle-gated Encounter editing UX;
- embedded Sheet dice result/tray.

### Quick Sheet
- one-click from Character Identity Chip;
- canonical `activeCharacter` + Scene/action projections;
- first viewport prioritizes HP/AC/core stats/status/resources/frequent attacks;
- no duplicate HP/resource store or generic local setter;
- routine actions enter authoritative action flow;
- connected Session rolls must not silently use local randomness as authoritative mechanics.

### Full Sheet
- Standalone and Session hosts share one Sheet content family;
- reuse Official Character/Spellcasting pages and SimpleVTT sections;
- Session Full Sheet is a LayerHost workspace, not route navigation;
- layout switch is presentation-only;
- connected mechanics rolls route through canonical authority;
- body-level cinematic dice replace Sheet-local tray.

### Action Dock
State machine:
`Resting -> Intent -> Action Detail -> Target if needed -> Pending -> Resolution`.

- intent grouping uses `OFFICIAL_PLAY_INTENTS` / `intentOptions`;
- current `ActionVm[]` owns legality/details;
- `eligibleTargetIds` owns canonical candidates;
- `resolveAction` owns execution;
- no second resolver/target engine;
- no spatial module => canonical target eligibility must treat otherwise-valid targets in range;
- Freeform hides permanent economy; Initiative adds compact economy/turn context.

## First source slice after authorization
Do not start the full redesign at once.

Walking skeleton only:
1. AppRoot Library vs Session Mode selection;
2. persistent SessionModeRoot frame;
3. Session Bar real Player Character / DM Actor identity;
4. low-noise MainFocus placeholder backed by real snapshot;
5. minimal UtilityRail + LayerHost;
6. one-click Quick Sheet open/close using canonical state;
7. preservation of Session context while Quick Sheet opens/closes.

Do not yet add the complete Action Dock, Initiative redesign, Encounter redesign or Handout redesign in the first slice.

## Validation status
No new validation. Historical `d942d58a...` green automation remains regression evidence for unchanged authorities only and does not validate the new UI.

## Next Exact Action
1. Remain `needs_user` until explicit source implementation authorization.
2. On authorization, switch the same sequence to `continue` and implement the walking skeleton only.
3. Add focused tests proving persistent Session Mode, no route round-trip, one-click Quick Sheet and no duplicated authority.
4. Validate the slice before moving to Full Sheet / Rules / Action Dock.
5. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
