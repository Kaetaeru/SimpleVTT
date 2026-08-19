# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **Freeform + intent-first Action Dock validated; Target/no-spatial slice implemented and awaiting exact-head CI**
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
Exact source HEAD: `fbf37144d2ed56272429287419393bf221d83f44`
- UI run `32211000260`
- frontend job `95943502788`
- conclusion **SUCCESS**

Validated: persistent app-level SessionModeRoot, Session shell, Player Quick Sheet, DM Actor Quick View, zero-Player/zero-Combatant valid state, canonical authority reuse, no dominant Library sidebar/return-to-play/Actor wall/category hotbar.

### Slice 4 — in-session Full Sheet reuse
Exact source HEAD: `d1641ae415f12e2b3604c42f34f65b3f0d947338`
- UI run `32212271658`
- frontend job `95947137481`
- conclusion **SUCCESS**

Validated: shared standalone/session CharacterSheetWorkspace, one canonical Character and presentation-only layout preference, Session root stays mounted, standalone local tabletop rolls preserved, Session Sheet does not create local authoritative rolls, embedded dice tray standalone-only.

### Slice 5 — in-session Rules + Activity
Exact source HEAD: `139ebcffcc537572ff198dd0140017a75dc21e97`
- UI run `32212781137`
- frontend job `95948568396`
- conclusion **SUCCESS**

Validated: Rules and Activity are on-demand Session panes, canonical catalog/activity projections, existing Undo authority, Full Sheet layering/Escape order, responsive drawers, full UI/mechanics regressions and build green.

### Slice 6 — low-noise Freeform Main Focus
Validated exact source HEAD: `fe78030c1e705ff6de1e46124d9ef7eb78e60552`
- UI run `32213234658`
- frontend job `95949840012`
- conclusion **SUCCESS**

Validated scope:
- `SessionMainFocus` owns the low-noise Freeform center;
- scene/session identity, quiet guidance, and at most one recent meaningful result;
- recent result can open Activity in one action;
- zero Player / empty Encounter DM states remain normal active Freeform states;
- no Actor wall, Activity feed, action economy, or action catalog in Freeform Main Focus;
- minimal Initiative placeholder remains temporary for the later Initiative slice.

The earlier exact head `377d06f...` failed only because `v1ProductShellStructure.test.ts` still expected participant access directly inside `SessionModeRoot` after that access had intentionally moved to delegated `SessionMainFocus`. The test was aligned to the new ownership boundary; product code was not reverted.

### Slice 7 — intent-first Action Dock
Validated exact source HEAD: `2765beb7069e82fdb5d4ddf6284d8a81b79a9d86`
- UI run `32213526027`
- frontend job `95950668674`
- conclusion **SUCCESS**

Validated scope:
- compact resting Action Dock mounted in the persistent Session footer;
- Freeform primary intents: Attack, Magic, Search, Influence, Help, All Actions;
- Initiative primary intents: Attack, Magic, Dash, Disengage, Dodge, Help, All Actions;
- full official vocabulary comes from `OFFICIAL_PLAY_INTENTS`;
- intent options come from existing `intentOptions()` over current Actor `ActionVm[]`;
- legality/disabled reasons come from canonical `ActionVm.available` / `disabledReason`;
- no-target/self actions use existing `resolveAction()` and pending protection;
- target-requiring actions stop before target execution at this validated checkpoint;
- no second resolver, economy engine, or target engine;
- Rules/Sheet layers preserve the mounted action-flow presentation state;
- Actor change clears actor-specific action-flow state;
- full UI/mechanics regressions and TypeScript/build green.

## Current unvalidated source checkpoint — Slice 8 Target flow + no-spatial fallback
Current exact work-branch/PR HEAD: `2372a28068c625ed83e728be73bb52d98bcd6ff9`

Implemented:
- Session Action Dock target picker consumes `ActionVm.eligibleTargetIds` directly;
- single-target click calls existing `resolveAction(action.id, [targetId])`;
- multi-target selection toggles only canonical eligible IDs, honors `ActionVm.maxTargets`, and uses explicit Execute;
- selected targets reconcile against new snapshot eligibility and are dropped if invalidated;
- target selection remains mounted while Rules/Sheet layers open;
- UI does not calculate distance, range, LOS, cover, or a second target-legality rule;
- target rows show only existing entity identity/HP/status context, not invented distance values.

Canonical runtime repair:
- `realSpatialRuntimeService` now exposes `authoritativeSpatialModuleRelation()` without replacing the historical compatibility service;
- `realRuntimeAttackFactProvider.resolveRuntimeTargetingFact()` constrains attacks only when the requested pair has an explicit relation whose provenance begins `module:`;
- when no authoritative spatial-module fact exists for the pair, the provider returns an unconstrained targeting fact (`distanceFeet: 0`, visible, no cover) with explicit provenance;
- core/reference presentation distance and old manual non-module pair facts no longer become default range authority;
- the Rules Domain transaction remains unchanged: if an explicit authoritative targeting fact says the target is beyond range/hidden/covered, the existing domain can still reject or modify it;
- old Phase09 regressions that required missing pairwise spatial data to reject were updated to the approved V0.9 rule: missing optional spatial data means unconstrained/in range, while explicit `module:` facts still constrain.

A transient wrong-path duplicate `src/realSpatialRuntimeService.ts` was created during editing, detected immediately, and deleted before validation. The canonical implementation remains only at `src/app/realSpatialRuntimeService.ts`; do not recreate a second service.

Exact-head UI validation:
- UI run `32214014666`
- frontend job `95952019703`
- current status at checkpoint: **QUEUED**

Do not claim Slice 8 complete until this exact-head run finishes successfully.

## Remaining approved implementation order
After Slice 8 validates:
1. cinematic dice/result convergence;
2. DM Encounter / Actor / Participants / Session tools;
3. Player reconnect/session utilities;
4. Initiative expansion;
5. Handout integration;
6. responsive/keyboard/focus pass;
7. final exact-head automated validation;
8. Windows human usability acceptance A-J.

Each slice must replace/disconnect conflicting old normal-Session presentation it supersedes and must not add parallel mechanics authority.

## Next Exact Action
1. Fetch UI run `32214014666` / frontend job `95952019703` for exact source HEAD `2372a28068c625ed83e728be73bb52d98bcd6ff9`.
2. If it fails, invoke `gh-fix-ci` first and fix only the observed failure. `gh` is unavailable in the current environment, so connector workflow/job/log APIs are the allowed fallback after specialist invocation.
3. If it succeeds, record Slice 8 as validated and implement only the next approved slice: **cinematic dice/result convergence**.
4. Preserve Host/runtime authoritative results and the existing body-level VisualDice presentation; do not add Sheet-local or Session-local dice authority.
5. Do not start DM tools, final Initiative, or Handout in the same slice.
6. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`continue`
