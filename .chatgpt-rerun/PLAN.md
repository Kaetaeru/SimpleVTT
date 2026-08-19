# Rerun Plan — SimpleVTT V0.9 convergence

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9**
- dispatch recommendation: `continue`

## Watcher execution conventions
- `STATUS.md`와 사람에게 보여 주는 watcher 상태 설명은 **한국어로 작성한다**. SHA, workflow/job 이름, 코드 식별자처럼 정확성이 필요한 기술 식별자는 원문을 유지할 수 있다.
- GitHub 작업은 **직접 `gh` CLI를 독립 실행 경로로 사용하지 말고, 먼저 해당 작업에 맞는 GitHub 플러그인 스킬을 호출한다**.
- 일반 저장소/PR 작업은 GitHub 플러그인 `github` 스킬, CI 실패는 `gh-fix-ci`, 리뷰 피드백은 `gh-address-comments`, 게시 작업은 `yeet` 등 가장 구체적인 플러그인 스킬을 우선한다.
- CI 실패에서는 `gh-fix-ci` 스킬을 먼저 호출한다. **그 스킬이 `gh` 부재 또는 인증 불가 때문에 Actions 로그를 읽지 못하면, 사용자 승인에 따라 GitHub connector의 `fetch_workflow_job_logs`를 fallback으로 사용해 해당 run/job의 실제 로그를 읽을 수 있다.** 필요하면 `fetch_workflow_run_jobs`, `fetch_workflow_job_steps`, `get_commit_combined_status` 같은 connector API로 동일 HEAD의 상태를 보조 확인한다.
- 위 connector fallback은 `gh-fix-ci`를 생략하는 경로가 아니다. 스킬을 먼저 호출한 뒤 그 실행 의존성이 막힌 경우에만 사용하며, **실제 실패 로그를 확보해서 관측된 원인만 수정**한다. 로그 없이 source diff만 보고 추측 수정하지 않는다.
- 별도로 `gh` 설치/직접 호출을 기본 절차로 두지 않는다.
- PR #109 must not be merged without explicit user authorization.

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts remain presentation state only;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency;
- production cleanup removes only proven unreachable UI/reference wiring and must not replace canonical runtime authorities.

## Exact work HEAD
`5c70b3028aed70b0fc5ddafafe119f40174df833`

Latest source commit:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`

The branch was fast-forwarded non-force from validated polish head `04d8af303e4f77eeb62801f8fd99e07146a2e48e` after rechecking PR #109 at that exact old head.

## Validated V0.9 slices — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`.

## Recovered same-head Windows evidence for `04d8af30...`
All three jobs previously left automatic/in-progress are **success**, without manual rerun:
- Persistence `tauri-storage` job `95877878039`.
- Phase 12 `windows-connected-playable` job `95878210229`, including Tauri transport/persistence verification, Windows connected executable build, staging and upload.
- Main Playable `windows-playable` job `95878131296`, including Tauri persistence/session transport verification, Windows playable executable build, staging and upload.

## Current dead-legacy cleanup candidate
`5c70b302...` removes only local `App.tsx` surfaces that the current router no longer calls, including the old Character Sheet/Create helpers and old local scene/targeting/Inspector helpers. Current production routing remains `CharacterSheetPlayScreen`, `CharacterCreateScreenV10`, `ProductionPlayScreen`, current LevelUp, Resolution/DM adjudication, Content/Rules/Session/Settings/Debug.

`tests/ui/productionNonCharacterUxRedesign.test.ts` now inspects the actual `ProductionPlayScreen` route and prevents the removed legacy helper names from returning.

## Current validation status for `5c70b302...`
### Main Playable — unresolved failure
- run `32189591188`
- job `95880814298` (`playable-contract`)
- step `Verify full UI, rules, TypeScript, and production frontend`: **failure**
- downstream steps skipped because of this failure.

The exact failure log/root cause has not yet been diagnosed and no speculative source change has been made.

### CI diagnosis policy update
The user explicitly authorized a connector fallback on 2026-08-19: invoke `gh-fix-ci` first; if its required `gh` dependency is unavailable, use GitHub connector workflow-log APIs to inspect the exact failing job rather than returning to `blocked` solely because `gh` is missing.

### Other same-head runs
Earlier checkpoint records show UI `32189591171`, Phase 12 `32189591122`, Persistence `32189591129`, Rules Domain `32189591400`, Contract validation `32189591389`, and Phase 11 `32189591204` were started. Do not rerun them merely because of watcher restart; fetch their final state only when needed for exact-head convergence.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch, or PR #109 moved.
2. This same sequence is re-authorized as `continue`. If work HEAD remains `5c70b302...`, do not repeat the reachability audit or validated product slices.
3. Invoke the GitHub plugin `gh-fix-ci` skill first for run `32189591188`, job `95880814298`.
4. If the skill cannot inspect Actions because `gh` is unavailable, use the **user-authorized GitHub connector fallback**: fetch the exact job logs with `fetch_workflow_job_logs` and use related run/job/status APIs only as needed.
5. Capture the exact failing test/type/build output and fix only that observed failure. Do not guess from the source diff.
6. Recheck PR HEAD immediately before any branch write and use non-force fast-forward only.
7. Validate affected UI/Main gates at the resulting exact head; observe automatic connected/persistence/Windows gates without manually rerunning unchanged historical boundaries.
8. After source convergence, obtain one exact-head full automated UI/Main/mechanics/persistence/installed-content/connected/Windows validation set.
9. Human Windows acceptance remains required for standalone Sheet-at-table use and two-instance Host/Client image reveal/reconnect; do not claim final V0.9 completion before that acceptance.
10. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
