# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **persistent Session walking skeleton implemented and UI-validated**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current exact source checkpoint
`fbf37144d2ed56272429287419393bf221d83f44`

## What changed
The first approved source slice is complete.

### Root mode
- `ProductRoot` now chooses Library `App` only for `session.role === "offline"`.
- existing Host/Client session facts immediately select `SessionModeRoot`.
- active Session is therefore app-level presentation rather than the old `scene` route inside the Library sidebar.

### Persistent Session shell
`SessionModeRoot` now provides:
- compact Session Bar;
- dominant low-noise Main Focus;
- minimal right Utility Rail;
- persistent Action Dock shell;
- ordered LayerHost.

### Identity and Quick Sheet
Player:
- Character identity chip is always visible;
- one click opens Quick Sheet;
- Quick Sheet reads canonical Character/Scene/Action projections only.

DM:
- current Actor identity is always visible;
- one click opens a compact Actor quick view;
- Player 0 / Combatant 0 remains a normal active Session state.

### Authority preservation
No new mechanics authority was introduced.
- Character, Scene, Actions, Session, Resolution and Activity still come from existing `AppProvider` snapshot/adapters.
- no `mockAdapter` import in the new Session root;
- no new action resolver, target engine, Character cache or Session lifecycle;
- existing runtime/network/content/dice/VFX/handout bridges remain mounted in `main.tsx`.

### Presentation migration begun
The new active Session root does not render the old Library sidebar, `플레이로 돌아가기`, permanent Actor card wall or permanent category hotbar.

Quick Sheet has no embedded `VisualDiceTray`.

## Validation
Exact-head UI run: `32211000260`
Frontend job: `95943502788`
Conclusion: **SUCCESS**.

Verified at this exact HEAD:
- new persistent Session root structural contract;
- existing Phase 14 UX regressions;
- existing lifecycle/live-DM/local projection/spellcasting regressions;
- Phase 09 mechanics regressions;
- TypeScript;
- production build.

Container-local checkout could not be used because the execution container has no external DNS/network access to GitHub. GitHub Actions is the successful validation source for this slice.

## Important incompleteness
This is intentionally only slices 1-3 / walking skeleton.

Not yet implemented:
- in-session Full Sheet reuse host;
- Rules/Activity panes;
- final Freeform content;
- intent-first Action Dock behavior and target flow;
- DM Encounter/Participant controls in the new root;
- final Initiative expansion;
- final Handout placement;
- fresh Windows human acceptance.

The bottom Action Dock is currently only the persistent shell/status region, not the finished action interface.

## Next Exact Action
1. Remain `needs_user` at this validated checkpoint.
2. If the user authorizes continuation, implement **Full Sheet in-session host + shared Sheet extraction/state preservation** next.
3. Preserve one canonical Character and existing mechanics authority.
4. Do not introduce Sheet-local dice presentation.
5. Validate the next slice before moving to Rules/Activity or Action Dock.
6. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
