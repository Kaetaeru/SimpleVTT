# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9 complete UI-first implementation authorized**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## User authorization
The user explicitly instructed that all V0.9 planning be consolidated into the rerun PLAN and that this same sequence be changed to `continue`.

The watcher is authorized to resume source implementation from the durable validated checkpoint without waiting for another confirmation.

## Consolidated implementation authority
`.chatgpt-rerun/PLAN.md` now contains the complete V0.9 execution contract needed by rerun, including:
- always-on tabletop companion product philosophy;
- canonical architecture invariants;
- Library Mode vs app-level persistent Session Mode;
- DM immediate active/editable session with no Host Preparing/Lobby/Ready/Play Start gate;
- Player join/reconnect behavior;
- complete persistent Session Shell layout and layer model;
- shared vs DM-specific vs Player-specific Session surfaces;
- low-noise Freeform contract;
- one-click Quick Sheet contract;
- in-session Full Sheet reuse contract;
- body/app-level cinematic dice contract;
- Rules and Activity behavior;
- intent-first Action Dock state machine and all official intent groupings;
- no-spatial-module target eligibility fallback;
- Initiative expansion in the same Shell;
- DM Encounter/Actor/Participants/Session tools;
- handout behavior;
- interaction quality, keyboard/focus and responsive contracts;
- error/reconnect behavior;
- explicit anti-patterns and retired assumptions;
- existing-code reuse/retirement map;
- implemented walking-skeleton checkpoint;
- remaining slice-by-slice implementation order;
- Windows human acceptance scenarios A-J;
- exact-head validation discipline and V0.9 definition of completion.

The supporting `.agents/V0_9_*` documents remain detailed references, but rerun can continue from PLAN without conversational memory.

## Current exact source checkpoint — validated; do not redo
`fbf37144d2ed56272429287419393bf221d83f44`

Implemented:
- `ProductRoot` switches connected Host/Client facts into app-level `SessionModeRoot`;
- persistent Session Bar/Main Focus/Utility Rail/LayerHost/Action Dock shell;
- Player Character identity + one-click Quick Sheet;
- DM Actor identity + compact Actor Quick View;
- zero Player / zero Combatant valid active DM state;
- canonical snapshot/commands preserved;
- old dominant Library sidebar / `플레이로 돌아가기` / permanent Actor wall / category hotbar absent from new active Session root;
- Quick Sheet has no embedded dice tray.

Validation at this exact head:
- UI run `32211000260`;
- frontend job `95943502788`;
- conclusion **SUCCESS**;
- persistent Session root structure passed;
- existing Phase 14 regressions passed;
- lifecycle/live-DM/local-projection/spellcasting regressions passed;
- Phase 09 mechanics regressions passed;
- TypeScript and production build passed.

Historical pre-replan broad green implementation HEAD remains:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Do not repeat already validated work solely due rerun restart unless later source changes touch that boundary.

## Active remaining implementation sequence
1. Full Sheet in-session host + shared Sheet extraction/state preservation.
2. Utility Rail Rules pane + Activity drawer.
3. low-noise Freeform Main Focus convergence.
4. intent-first Action Dock.
5. Detail/Target flow + canonical no-spatial fallback repair if still required.
6. cinematic dice/result convergence.
7. DM Encounter / Actor / Participants / Session tools.
8. Player reconnect/session utilities.
9. Initiative expansion.
10. Handout integration.
11. responsive/keyboard/focus pass.
12. exact-head automated validation.
13. Windows human usability acceptance A-J.

Each slice must disconnect the conflicting old normal-Session presentation that it replaces; adding a new UI alongside obsolete normal flow is not completion.

## Next Exact Action
1. Resume from work-branch HEAD `fbf37144d2ed56272429287419393bf221d83f44` after reconciling actual PR head.
2. Implement **Full Sheet in-session host + shared Sheet extraction/state preservation** only.
3. Reuse existing SimpleVTT/Official Sheet content and one canonical Character.
4. Keep Session Shell mounted when Full Sheet opens/closes.
5. Keep layout choice presentation-only.
6. Do not create Sheet-local authoritative rolls or embedded dice tray.
7. Add focused regression coverage and validate the slice at its exact head before moving to Rules/Activity.
8. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`continue`
