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

The work branch remains at the dead-legacy cleanup commit. No source write is part of this coordination change.

## User coordination instruction — durable
- `STATUS.md` and human-facing watcher status text must be written in **Korean**; exact technical identifiers may stay in original form.
- GitHub work must invoke the matching **GitHub plugin skill first** rather than using direct `gh` CLI as an independent/default workflow.
- Prefer the most specific plugin skill (`github`, `gh-fix-ci`, `gh-address-comments`, `yeet`, etc.).
- For CI failures, invoke `gh-fix-ci` first. **If that skill cannot inspect Actions because `gh` is missing or unauthenticated, the user explicitly authorizes a fallback to the GitHub connector's `fetch_workflow_job_logs` plus related run/job/status APIs.**
- This fallback is only for obtaining exact failure evidence after the plugin skill has been invoked. It does not authorize speculative fixes; source changes must be tied to the observed log output.
- Do not independently install or directly invoke `gh` as the primary workflow.

## Current dispatch reauthorization
On 2026-08-19 the user explicitly authorized the connector fallback above and requested that the same sequence `3` be changed immediately from `blocked` back to `continue`.

This is a new work authorization under the rerun protocol. Resume from this durable checkpoint without incrementing the sequence and without repeating validated work.

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

## Historical Windows evidence — unchanged
At validated head `04d8af30...`, all previously pending Windows jobs are confirmed success without rerun:
- Persistence `95877878039`.
- Phase 12 Windows connected `95878210229`.
- Main Windows playable `95878131296`.

## Current unvalidated dead-legacy cleanup
Source commit:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

It removes obsolete local-only `App.tsx` Character Sheet/Create/Scene helpers and their private imports/helpers while preserving the current router, current LevelUp, Resolution/DM adjudication, Combatants, Rules, Activity, Session, Settings and Debug surfaces. The focused structure test inspects the real `ProductionPlayScreen` route and guards against those legacy helpers returning.

This cleanup is **not yet validated** because Main Playable is red.

## Current unfinished point
Main Playable:
- run `32189591188`
- job `95880814298` (`playable-contract`)
- failing step: `Verify full UI, rules, TypeScript, and production frontend`
- downstream steps skipped.

The exact failing test/type/build output has not yet been inspected. No root cause is claimed and no speculative source fix has been made.

## Other exact-head runs
Earlier checkpoint records show these automatic runs started for `5c70b302...`: UI `32189591171`, Phase 12 `32189591122`, Persistence `32189591129`, Rules Domain `32189591400`, Contract validation `32189591389`, Phase 11 `32189591204`. Do not manually rerun them merely because of watcher restart; fetch their final result only when needed for convergence.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch, or PR #109 moved.
2. With control re-authorized as `continue`, resume only from this checkpoint.
3. If work HEAD remains `5c70b302...`, do not repeat validated slices or the legacy reachability audit.
4. Invoke the GitHub plugin `gh-fix-ci` skill first for run `32189591188` / job `95880814298`.
5. If the skill still cannot read Actions because `gh` is unavailable, use the **user-authorized connector fallback**: `fetch_workflow_job_logs` for the exact job, with `fetch_workflow_run_jobs`, `fetch_workflow_job_steps`, or `get_commit_combined_status` only as needed.
6. Capture the exact failing test/type/build output and fix only the observed failure.
7. Recheck PR HEAD immediately before any branch write and use non-force fast-forward only.
8. Validate affected UI/Main gates at the resulting exact head and observe automatic connected/persistence/Windows gates without manually rerunning unchanged historical boundaries.
9. After source convergence, collect one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
10. Human Windows acceptance remains required for standalone Sheet-at-table and two-instance Host/Client image reveal/reconnect before final V0.9 completion.
11. Keep PR #109 draft/unmerged.

## Coordination writes for this reauthorization
- PLAN was written first on `main` as commit `8554aed9eb8cd733c648e19c9757cab4573e00de`.
- STATE is this durable reauthorization write.
- STATUS must be refreshed in Korean next.
- control must be written last with sequence `3`, status `continue`.

## Dispatch recommendation
`continue`
