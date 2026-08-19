# Rerun Plan — SimpleVTT V0.9 UI-first implementation

## Coordinates
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- current milestone: **persistent Session walking skeleton implemented and UI-validated**
- dispatch recommendation: `needs_user`

## Planning authority
The approved UI-first documents remain authoritative:
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

## Current source checkpoint
Exact work-branch HEAD:
`fbf37144d2ed56272429287419393bf221d83f44`

Previous broad automated-green implementation HEAD before UI-first replanning:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

### Implemented in this slice
1. `src/ProductRoot.tsx`
   - reads the existing `AppProvider` snapshot;
   - `session.role === "offline"` keeps Library `App`;
   - any existing Host/Client session immediately switches the visible app to `SessionModeRoot`;
   - no second `isSessionActive` authority.

2. `src/SessionModeRoot.tsx`
   - persistent Session Bar / low-noise Main Focus / minimal Utility Rail / LayerHost / Action Dock shell;
   - Player Character identity chip always visible and opens Quick Sheet in one click;
   - DM current Actor identity chip is always visible and opens a compact Actor view;
   - zero connected Players and zero Combatants are normal DM Session states, not lobby gates;
   - Quick Sheet reads canonical `activeCharacter`, matching Scene status and current canonical Action projections;
   - no duplicate Character/Scene/action/session store;
   - Escape closes the current utility layer and restores launcher focus;
   - existing Resolution projection/commands remain authoritative through a minimal Session-layer presentation fallback.

3. `src/session-mode.css`
   - desktop persistent geometry follows the approved ~52px Session Bar / dominant Main Focus / ~52px rail / ~68px Action Dock contract;
   - Quick Sheet is a right-side pane and becomes a drawer at constrained widths;
   - no permanent Actor card wall or category hotbar in the new Session root.

4. `src/main.tsx`
   - production composition now mounts `ProductRoot` under the existing `AppProvider` and keeps existing network/runtime/dice/VFX/handout bridges in their established order.

5. `tests/ui/v1ProductShellStructure.test.ts`
   - verifies active connected Sessions select `SessionModeRoot`;
   - verifies Library `App` remains the offline root;
   - verifies Session shell/Quick Sheet composition uses canonical snapshot state and does not import `mockAdapter`, `VisualDiceTray`, old `플레이로 돌아가기`, `HOTBAR_TABS`, or `SCENE ACTORS` presentation.

## Validation evidence
GitHub Actions UI run `32211000260`, frontend job `95943502788`: **SUCCESS** at exact HEAD `fbf37144...`.

Successful evidence includes:
- UI named-rule boundary;
- new `v1 product shell entry contract` including persistent Session root assertions;
- existing Phase 14 production/session/tabletop/intent/human-acceptance structural regressions;
- lifecycle/live-DM/local-projection/spellcasting regressions;
- Phase 09 real mechanics services;
- **TypeScript and production build**.

Local container checkout was unavailable because the container cannot resolve external GitHub hosts; GitHub Actions is the execution source of truth for this slice.

## Deliberately not implemented yet
This checkpoint is the walking skeleton only. Do not mistake it for the full Session redesign.

Still pending in approved order:
1. Full Sheet Session host + shared Sheet extraction/state preservation;
2. Utility Rail Rules pane + Activity drawer;
3. low-noise Freeform Main Focus content convergence;
4. intent-first Action Dock and Detail/Target flow;
5. canonical no-spatial fallback repair if still required at target eligibility authority;
6. cinematic Sheet roll/result convergence;
7. DM Encounter / Actor switching / Participants / Session tools;
8. reconnect/player utilities;
9. Initiative expansion;
10. Handout integration;
11. responsive/focus pass and fresh Windows human acceptance.

The current Action Dock is intentionally only the persistent shell/status region. The old mechanics authorities remain intact, but the complete new action UI is not yet wired into this root.

## Next Exact Action
1. Hold at `needs_user` after this validated walking skeleton.
2. On user authorization to continue, implement the next approved slice: **Full Sheet in-session host + shared Sheet extraction**, without creating a second Character representation or Sheet-local dice stage.
3. Validate that slice before Rules/Activity or Action Dock work.
4. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
