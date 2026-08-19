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

PR #109 was rechecked during this execution and remains open/draft/unmerged at exactly that HEAD. No source write was made in this execution.

## User coordination instruction — durable
- `STATUS.md` and human-facing watcher status text must be written in **Korean**; exact technical identifiers may stay in original form.
- GitHub work must invoke the matching **GitHub plugin skill first** rather than using direct `gh` CLI as an independent/default workflow.
- Prefer the most specific plugin skill (`github`, `gh-fix-ci`, `gh-address-comments`, `yeet`, etc.) and the plugin/connector path it defines.
- Do not independently install or call `gh` as the primary path. If the invoked plugin skill itself declares a required dependency/guardrail and cannot proceed without it, record a technical blocker instead of bypassing the skill or guessing.

## Mandatory preflight for this execution
Read from `main` in exact order before project work:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Reconciled coordinates:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task `v1-product-experience-overhaul`
- dispatch at start `continue`
- durable work HEAD `5c70b3028aed70b0fc5ddafafe119f40174df833`
- canonical `main` HEAD before checkpoint writes `ca8b41458bd2a7dbda0f83ba6691acfdcdb6f99b`

Validated slices 1–9 and the prior dead-legacy reachability audit were not repeated.

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

## Recovered historical Windows evidence — unchanged
At validated head `04d8af30...`, all previously pending Windows jobs were confirmed success without rerun:
- Persistence `95877878039`.
- Phase 12 Windows connected `95878210229`.
- Main Windows playable `95878131296`.

## Current unvalidated dead-legacy cleanup
Source commit:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

It removes obsolete local-only `App.tsx` Character Sheet/Create/Scene helpers and their private imports/helpers while preserving the current router, current LevelUp, Resolution/DM adjudication, Combatants, Rules, Activity, Session, Settings and Debug surfaces. The focused structure test now inspects the real `ProductionPlayScreen` route and guards against those legacy helpers returning.

This cleanup is **not validated** because Main Playable is red.

## Current blocking failure
Main Playable:
- run `32189591188`
- job `95880814298` (`playable-contract`)
- failing step: `Verify full UI, rules, TypeScript, and production frontend`
- downstream steps skipped.

The exact failing test/type/build output remains uninspected; therefore no root cause is claimed and no speculative fix has been made.

## Plugin-skill-first retry in this execution
After preflight and PR reconciliation, the matching GitHub plugin `gh-fix-ci` skill was invoked first as required by the user instruction.

That skill explicitly requires authenticated GitHub CLI for Actions log inspection and explicitly says the GitHub app/connector is not a substitute. Its dependency check in this execution returned:
- `gh: command not found`
- exit status `127`

Because the invoked skill cannot proceed under its own guardrails, this execution did not use connector workflow logs to bypass the skill and did not modify source. This is an execution-environment technical blocker, not a product/design blocker.

## Other exact-head runs
Earlier checkpoint records show these automatic runs started for `5c70b302...`: UI `32189591171`, Phase 12 `32189591122`, Persistence `32189591129`, Rules Domain `32189591400`, Contract validation `32189591389`, Phase 11 `32189591204`. Do not promote or repeat them merely because of watcher restart; the Main Playable failure remains the only authorized unfinished point.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch, or PR #109 moved.
2. If control remains `blocked`, do not continue source work.
3. If the same sequence is re-authorized with `continue` and work HEAD remains `5c70b302...`, do not repeat validated slices or the legacy reachability audit.
4. Invoke the GitHub plugin `gh-fix-ci` skill first for run `32189591188` / job `95880814298`.
5. Follow the plugin skill's supported diagnosis path. If its required dependency is still unavailable, keep/record `blocked`; do not bypass the skill or guess.
6. Once exact failure evidence is available, fix only the observed failure.
7. Recheck PR HEAD immediately before any branch write and use non-force fast-forward only.
8. Validate affected UI/Main gates at the resulting exact head and observe automatic connected/persistence/Windows gates without manually rerunning unchanged historical boundaries.
9. After source convergence, collect one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
10. Human Windows acceptance remains required for standalone Sheet-at-table and two-instance Host/Client image reveal/reconnect before final V0.9 completion.
11. Keep PR #109 draft/unmerged.

## Coordination writes for this checkpoint
- PLAN written first as commit `00d306e05a954f3d1149be3a1990212afb06a2a1`.
- STATE is this write.
- STATUS must be refreshed in Korean next.
- control must be written last with sequence `3`, status `blocked`.

## Dispatch recommendation
`blocked`
