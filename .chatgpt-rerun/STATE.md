# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **Full Sheet + Rules/Activity validated; Freeform Main Focus implemented and awaiting exact-head CI**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Authorization and planning authority
The user explicitly authorized this same sequence to continue through the consolidated V0.9 UI-first implementation plan in `.chatgpt-rerun/PLAN.md`.

Resume from this durable checkpoint. Do not redo validated slices solely because rerun restarts.

## Validated checkpoints — do not repeat unless touched

### Walking skeleton
Exact source HEAD:
`fbf37144d2ed56272429287419393bf221d83f44`

Validation:
- UI run `32211000260`
- frontend job `95943502788`
- conclusion **SUCCESS**

Validated scope:
- app-level persistent SessionModeRoot;
- Player Character identity + one-click Quick Sheet;
- DM Actor identity + compact Actor view;
- zero Player / zero Combatant valid active Session state;
- no duplicate Character/Scene/action/session authority;
- no dominant Library sidebar / `플레이로 돌아가기` / permanent Actor wall / category hotbar in active Session.

### Slice 4 — in-session Full Sheet reuse
Exact source HEAD:
`d1641ae415f12e2b3604c42f34f65b3f0d947338`

Validation:
- UI run `32212271658`
- frontend job `95947137481`
- conclusion **SUCCESS**

Validated scope:
- shared `CharacterSheetWorkspace` with `standalone | session` hosts;
- one persisted SimpleVTT/Official layout preference over the same canonical Character;
- Player opens Full Sheet from Session Bar or Quick Sheet without leaving SessionModeRoot;
- Full Sheet remains mounted in LayerHost so presentation state survives close/reopen;
- Standalone local tabletop rolls preserved;
- Session Sheet does not present local random rolls as authoritative shared outcomes;
- embedded Sheet dice/result tray is standalone-only;
- responsive large-workspace overlay contract;
- existing UI/mechanics regressions, TypeScript and production build green.

### Slice 5 — in-session Rules + Activity
Validated exact source HEAD:
`139ebcffcc537572ff198dd0140017a75dc21e97`

Validation:
- UI run `32212781137`
- frontend job `95948568396`
- conclusion **SUCCESS**

Validated scope:
- Rules and Activity are Session utility panes rather than route replacements;
- Rules reads canonical `snapshot.catalog` and keeps only query/detail UI state locally;
- Activity reads canonical `snapshot.activity`;
- DM Undo uses existing `undoLastResolution()` authority;
- Rules can layer above Full Sheet while Session and Sheet remain mounted;
- Escape closes Rules before Full Sheet;
- responsive drawer behavior;
- all prior UI/mechanics regressions, TypeScript and production build green.

Intermediate HEAD `5a981de2b2bfd84bae850f1949183beaad6cf384` is **not** a valid checkpoint: its only observed failure was a missing JSX closing `div` in Quick Sheet. That exact syntax defect was fixed at `139ebcff...`; do not revisit it unless later edits touch the same boundary.

## Current unvalidated source checkpoint — Slice 6
Current exact work-branch/PR HEAD:
`377d06f6129502e4be897d633758dda57e57021a`

Implemented:
- new `SessionMainFocus` component backed only by the existing snapshot;
- Freeform center reduced to scene/session identity, quiet guidance, and at most one recent meaningful result;
- Activity remains one-click from the recent-result card;
- DM zero-player and empty-Encounter states are quiet valid-session notes, not lifecycle gates;
- no Actor list, Activity feed, action economy or action catalog is rendered in Freeform Main Focus;
- minimal Initiative placeholder remains intentionally temporary; final Initiative UI is a later slice;
- new responsive `session-main-focus.css`;
- focused structural regression `sessionFreeformMainFocusStructure.test.ts` added to UI workflow.

Exact-head UI validation:
- UI run `32212972447`
- frontend job `95949109966`
- current status at checkpoint: **QUEUED**

Do not claim Slice 6 complete until this exact-head run finishes successfully.

## Remaining approved implementation order
After Slice 6 validates:
1. intent-first Action Dock;
2. Detail/Target flow + canonical no-spatial fallback repair if still required;
3. cinematic dice/result convergence;
4. DM Encounter / Actor / Participants / Session tools;
5. Player reconnect/session utilities;
6. Initiative expansion;
7. Handout integration;
8. responsive/keyboard/focus pass;
9. final exact-head automated validation;
10. Windows human usability acceptance A-J.

Each slice must replace/disconnect the conflicting old normal-Session presentation it supersedes. Do not add a parallel mechanics authority.

## Next Exact Action
1. Fetch UI run `32212972447` for exact source HEAD `377d06f6129502e4be897d633758dda57e57021a`.
2. If it fails, invoke `gh-fix-ci` first and fix only the observed failure.
3. If it succeeds, record Slice 6 as validated and implement the next approved slice: **intent-first Action Dock**.
4. Action Dock must use existing `OFFICIAL_PLAY_INTENTS` / `intentOptions`, current actor `ActionVm[]`, `eligibleTargetIds`, and `resolveAction`; do not create a second resolver or target legality engine.
5. Do not yet start DM tools, final Initiative, or Handout work in the same slice.
6. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`continue`
