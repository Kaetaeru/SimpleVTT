# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current work head
`5c70b3028aed70b0fc5ddafafe119f40174df833`

The work branch was advanced by non-force fast-forward from `04d8af303e4f77eeb62801f8fd99e07146a2e48e` to `5c70b3028aed70b0fc5ddafafe119f40174df833` only after PR #109 was rechecked open/draft/unmerged at the expected old head.

## Current dispatch reauthorization
The user explicitly changed the same sequence `3` from `blocked` back to `continue` on 2026-08-19. This is a new work authorization under the rerun protocol; resume from this durable checkpoint without incrementing the sequence and without repeating validated work.

## User coordination instruction recorded
The user explicitly changed watcher coordination conventions:
- `STATUS.md` and human-facing watcher status text must be written in **Korean**. Exact technical identifiers such as SHA/workflow/job names may stay in their original form.
- GitHub work must invoke the matching **GitHub plugin skill first** rather than using direct `gh` CLI as an independent/default workflow.
- Use the most specific plugin skill available (`github`, `gh-fix-ci`, `gh-address-comments`, `yeet`, etc.) and prefer the plugin/connector path it defines.
- Do not independently install or call `gh` as the primary path. If the invoked plugin skill itself declares a required dependency/guardrail and cannot proceed without it, record a technical blocker instead of bypassing that skill or guessing.

PLAN was updated first with these conventions. This STATE records the same instruction durably so future watcher invocations do not revert to the prior direct-`gh` wording.

## Preflight reconciliation for the source execution that produced the current head
Mandatory watcher files were read from `main` in exact protocol order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Coordinates reconciled to run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `3`, task `v1-product-experience-overhaul`. Validated slices 1–9 were not reimplemented or manually rerun.

## Recovered prior pending Windows jobs without rerun
The three jobs left automatic/in-progress at the prior validated head `04d8af30...` are all confirmed **success**:
- Persistence `tauri-storage` `95877878039`.
- Phase 12 `windows-connected-playable` `95878210229`, including Tauri transport/persistence verification, Windows connected executable build, staging/upload.
- Main Playable `windows-playable` `95878131296`, including Tauri persistence/session transport, Windows playable executable build, staging/upload.

## Dead-legacy reachability audit and source change
The current `App.tsx` router was confirmed to use:
- `CharacterSheetPlayScreen` for Character Sheet;
- `CharacterCreateScreenV10` for create/edit;
- `ProductionPlayScreen` for scene/play;
- current local `LevelUpScreen/LevelStep`;
- current ResolutionDrawer and non-Character product surfaces.

The removed obsolete local-only functions were:
- old Character sheet/create group: `CharacterSheetScreen`, `InventoryPanel`, `InventoryItem`, `CharacterCreateScreen`, `GuidedCreateStep`, `DerivedStep`, `AbilityBuilder`, `AbilityEditor`, `QuickCreate`, `ImportCreate`, `DuplicateCreate`, `ReviewRows`;
- old scene group: `useTargeting`, `PlayerSceneScreen`, `DmSceneScreen`, `ActionConsole`, `EntityList`, `EntityPortrait`, `Inspector`, `TargetingOverlay`.

The corrected source commit is:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

It removes only those obsolete local functions and their now-unused imports/constants/helpers. It preserves the current router, current LevelUp, Resolution/DM adjudication, Combatants, Rules, Activity, Session, Settings and Debug surfaces. `tests/ui/productionNonCharacterUxRedesign.test.ts` now inspects the actual `ProductionPlayScreen` route and asserts the removed legacy helper names do not return.

## Validation blocker at exact head `5c70b302...`
Automatic Actions started after the branch update.

### Main Playable
- run `32189591188`
- playable-contract job `95880814298`
- step `Verify full UI, rules, TypeScript, and production frontend`: **failure**
- subsequent contract steps were skipped.

The exact root cause has not been diagnosed or fixed. The matching GitHub plugin `gh-fix-ci` skill was invoked before diagnosis. That skill reported an unavailable required dependency in the prior execution environment. Under the recorded user instruction, future attempts must still invoke the plugin skill first and must not independently install/invoke `gh` as a replacement workflow. If the skill cannot proceed under its own guardrails, record the technical blocker rather than guessing.

### Other exact-head runs
- UI `32189591171`: started; final result not claimed at blocker checkpoint.
- Phase 12 `32189591122`: started; final result not claimed at blocker checkpoint.
- Persistence `32189591129`: started; final result not claimed at blocker checkpoint.
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
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`, including complete same-head Windows evidence.

The new `5c70b302...` dead-legacy deletion is **not validated** and must not be added to this list until the observed Main Playable failure is diagnosed/fixed and affected gates are green.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch or PR #109 moved.
2. With control re-authorized as `continue`, resume only from this checkpoint.
3. If work HEAD remains `5c70b302...`, do not repeat the legacy reachability audit or validated slices.
4. Invoke the GitHub plugin `gh-fix-ci` skill first for the Main Playable failure. Do not independently install or directly invoke `gh` as the primary workflow.
5. Follow the plugin skill's supported diagnosis path for run `32189591188`, job `95880814298`, step `Verify full UI, rules, TypeScript, and production frontend`. If the plugin skill reports a missing required dependency, record `blocked` again rather than bypassing its guardrails.
6. Once exact failure evidence is available, fix only the observed failure; do not guess.
7. Recheck PR head immediately before any branch write and use non-force fast-forward only.
8. Validate affected UI/Main gates at the resulting exact head and observe automatic connected/persistence/Windows gates without rerunning unchanged historical boundaries.
9. After source convergence, collect one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
10. Human Windows acceptance remains required for standalone Sheet-at-table and two-instance Host/Client image reveal/reconnect before final V0.9 completion.
11. Keep PR #109 draft/unmerged.

## Coordination writes
- PLAN was written first on `main` to change the same sequence dispatch recommendation to `continue`.
- STATE is this durable reauthorization checkpoint and is written after PLAN.
- STATUS will be refreshed in Korean for human visibility.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
