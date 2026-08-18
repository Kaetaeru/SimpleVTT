# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `blocked`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`5c70b3028aed70b0fc5ddafafe119f40174df833`

The work branch was advanced by non-force fast-forward from `04d8af303e4f77eeb62801f8fd99e07146a2e48e` to `5c70b3028aed70b0fc5ddafafe119f40174df833` only after PR #109 was rechecked open/draft/unmerged at the expected old head.

## Preflight reconciliation for this execution
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates reconciled to:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task `v1-product-experience-overhaul`
- dispatch `continue`
- starting work HEAD `04d8af303e4f77eeb62801f8fd99e07146a2e48e`
- starting canonical `main` HEAD `a4ab6e71f65a745ac03a7bef6052ddb726e9fb1b`

Validated slices 1–9 were not reimplemented or manually rerun.

## Recovered prior pending Windows jobs without rerun
The three jobs left automatic/in-progress at the previous checkpoint are now all confirmed **success**:
- Persistence `tauri-storage` `95877878039`: success.
- Phase 12 `windows-connected-playable` `95878210229`: success; Tauri transport/persistence, Windows connected executable, staging/upload all success.
- Main Playable `windows-playable` `95878131296`: success; Tauri persistence/session transport, Windows playable executable, staging/upload all success.

## Dead-legacy reachability audit and source change
The current `App.tsx` router was confirmed to use:
- `CharacterSheetPlayScreen` for Character Sheet;
- `CharacterCreateScreenV10` for create/edit;
- `ProductionPlayScreen` for scene/play;
- current local `LevelUpScreen/LevelStep`;
- current ResolutionDrawer and non-Character product surfaces.

The following same-file functions were proven to be obsolete local-only surfaces rather than router targets:
- old Character sheet/create group: `CharacterSheetScreen`, `InventoryPanel`, `InventoryItem`, `CharacterCreateScreen`, `GuidedCreateStep`, `DerivedStep`, `AbilityBuilder`, `AbilityEditor`, `QuickCreate`, `ImportCreate`, `DuplicateCreate`, `ReviewRows`;
- old scene group: `useTargeting`, `PlayerSceneScreen`, `DmSceneScreen`, `ActionConsole`, `EntityList`, `EntityPortrait`, `Inspector`, `TargetingOverlay`.

A local clone/static-audit attempt could not reach GitHub because this runtime could not resolve `github.com`; connector source inspection was used instead.

An initial unreferenced candidate tree contained an accidental unrelated `POINT_COST` typo. It was detected before branch/commit publication and discarded. It never affected the work branch.

The corrected source commit is:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

It removes only those obsolete local functions and their now-unused imports/constants/helpers. It preserves the current router, current LevelUp, Resolution/DM adjudication, Combatants, Rules, Activity, Session, Settings and Debug surfaces.

`tests/ui/productionNonCharacterUxRedesign.test.ts` now inspects the actual `ProductionPlayScreen` route and asserts the removed legacy helper names do not return.

## Validation blocker at exact head `5c70b302...`
Automatic Actions were started by the branch update.

### Main Playable
- run `32189591188`
- playable-contract job `95880814298`
- step 5 `Verify full UI, rules, TypeScript, and production frontend`: **failure**
- subsequent contract steps were skipped.

The exact root cause has not been inspected or fixed.

Per protocol, the installed `gh-fix-ci` skill was invoked before diagnosis. Its required prerequisite check was executed through the container:
`gh --version && gh auth status`

Result:
- `gh: not found`
- exit status `127`

The CI-fix skill explicitly requires authenticated GitHub CLI for Actions log inspection and says the GitHub connector is not a substitute. Therefore no speculative fix was made and connector job logs were not used to infer a patch.

### Other exact-head runs
- UI `32189591171`: started/in progress when the blocker was established; final result not claimed.
- Phase 12 `32189591122`: started; final result not claimed.
- Persistence `32189591129`: started; final result not claimed.
- Rules Domain `32189591400`, Contract validation `32189591389`, Phase 11 `32189591204`: started; final results not claimed.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`, now including complete same-head Windows evidence.

The new `5c70b302...` dead-legacy deletion is **not validated** and must not be added to this list until the observed Main Playable failure is diagnosed/fixed and affected gates are green.

## Technical blocker
This execution environment lacks GitHub CLI (`gh`). That prevents the required CI-fix workflow from safely reading the failing GitHub Actions log. This is an execution-environment blocker, not a product/design clarification.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch or PR #109 moved.
2. If control remains `blocked`, do not continue source work.
3. If controller restores `continue` and work HEAD remains `5c70b302...`, do not repeat the legacy reachability audit or validated slices.
4. Invoke `gh-fix-ci` first; verify `gh --version` and `gh auth status`.
5. In a gh-capable authenticated environment inspect run `32189591188`, job `95880814298`, step `Verify full UI, rules, TypeScript, and production frontend` and capture the exact failure.
6. Fix only that observed failure; do not guess.
7. Recheck PR head immediately before any branch write and use non-force fast-forward only.
8. Validate affected UI/Main gates at the resulting exact head and observe automatic connected/persistence/Windows gates without rerunning unchanged historical boundaries.
9. After source convergence, collect one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
10. Human Windows acceptance remains required for standalone Sheet-at-table and two-instance Host/Client image reveal/reconnect before final V0.9 completion.
11. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN for this checkpoint was written first on `main` as commit `107ba8a0df9bf79a9a876c014db530be54ee9a85`.
- STATE is this durable checkpoint and is written after PLAN.
- STATUS may be refreshed next.
- control must be written last with sequence `3`, status `blocked`.

## Dispatch recommendation
`blocked`
