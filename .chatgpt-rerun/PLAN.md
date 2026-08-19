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
- dispatch recommendation: `needs_user`

## Watcher execution conventions
- `STATUS.md`와 사람에게 보여 주는 watcher 상태 설명은 **한국어로 작성한다**. SHA, workflow/job 이름, 코드 식별자처럼 정확성이 필요한 기술 식별자는 원문을 유지할 수 있다.
- GitHub 작업은 직접 `gh` CLI를 독립 실행 경로로 사용하지 말고, 먼저 해당 작업에 맞는 GitHub 플러그인 스킬을 호출한다.
- 일반 저장소/PR 작업은 `github`, CI 실패는 `gh-fix-ci`, 리뷰 피드백은 `gh-address-comments`, 게시 작업은 `yeet` 등 가장 구체적인 플러그인 스킬을 우선한다.
- CI 실패에서는 `gh-fix-ci` 스킬을 먼저 호출한다. 그 스킬이 `gh` 부재 또는 인증 불가 때문에 Actions 로그를 읽지 못하면, 사용자 승인에 따라 GitHub connector의 `fetch_workflow_job_logs`를 fallback으로 사용할 수 있다. 필요하면 `fetch_workflow_run_jobs`, `fetch_workflow_job_steps`, `get_commit_combined_status`를 보조적으로 사용한다.
- connector fallback은 `gh-fix-ci`를 생략하는 경로가 아니다. 스킬을 먼저 호출한 뒤 실행 의존성이 막힌 경우에만 사용하며 실제 실패 로그를 확보해서 관측된 원인만 수정한다.
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

## Exact validated work HEAD
`bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

Latest source commits:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`
- `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994` — `Update UI rule baseline after legacy removal`

The second commit changes only `.agents/UI_NAMED_RULE_BASELINE.json`; it removes the four obsolete `src/App.tsx` legacy debt entries that disappeared with the proven-unreachable Sheet/Create/Scene code deletion.

## CI failure diagnosis and fix
The previously unresolved Main Playable failure was diagnosed using the recorded plugin-first + connector-fallback policy:
1. `gh-fix-ci` was invoked first.
2. Its required `gh` dependency was still unavailable in this execution environment.
3. The user-authorized connector fallback fetched the exact log for run `32189591188`, job `95880814298`.
4. The log showed `test:ui-rule-boundary` failing only because the baseline still expected removed `src/App.tsx` occurrences:
   - `ability-modifier-arithmetic`: baseline 1, current 0
   - `point-buy-cost-symbol`: baseline 5, current 0
   - `point-buy-cost-table`: baseline 1, current 0
   - `standard-ability-array-literal`: baseline 1, current 0
5. The scanner's current findings otherwise matched the remaining intended presentation debt in `CharacterSheetV10.tsx` and `CombatSpellHud.tsx`.
6. Fix: remove only those four obsolete baseline entries. No runtime/mechanics/UI source was changed in the fix commit.

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
10. Proven-unreachable legacy `App.tsx` Sheet/Create/Scene cleanup plus named-rule baseline alignment at exact HEAD `bed3119c...`.

## Exact-head automated validation at `bed3119c...`
All automatic workflows triggered for this source HEAD completed **success**. No manual reruns were used for historical boundaries.

- UI run `32202359225`: **success**. Includes named-rule boundary, production UX regressions, TypeScript and production build.
- Rules Domain run `32202359177`: **success**.
- Contract validation run `32202359173`: **success**.
- Persistence run `32202359176`: **success**.
  - application-contract job `95918637454`: success.
  - tauri-storage job `95918637462`: success.
- Phase 11 Playable run `32202359213`: **success**.
  - offline-walkthrough job `95918637574`: success.
  - Windows playable job `95918778475`: success, including executable build, staging and artifact upload.
- Phase 12 Connected Session run `32202359183`: **success**.
  - connected-protocol job `95918637353`: success.
  - windows-connected-playable job `95918775214`: success, including Tauri transport/persistence verification, executable build, staging and artifact upload.
- Main Playable run `32202359188`: **success**.
  - playable-contract job `95918637735`: success, including full UI/rules/TypeScript/frontend, offline, connected, SessionProjection, DM prepared/live, Undo and accessibility contracts.
  - windows-playable job `95918801170`: success, including Tauri persistence/session transport verification, Windows executable build, staging and artifact upload.

There are no known pending automatic jobs for this exact source HEAD.

## Remaining V0.9 acceptance — human Windows
Automated acceptance is converged. Final V0.9 completion still requires a **human Windows acceptance pass at exact source HEAD `bed3119c...`** covering both required product modes:

### A. Standalone Sheet-at-table
- launch the Windows playable artifact/build for `bed3119c...`;
- open the normal Character Sheet and confirm routine ability/save/skill/Initiative/attack/damage/common-die rolls;
- confirm Hit Dice, spell slots/resources and local roll history behave normally;
- confirm local portrait preview/focal positioning/replace/remove and persistence across restart;
- confirm both normal sheet layouts remain usable without technical/debug clutter.

### B. Two-instance Host/Client play
- start a Host and join from a second Windows instance with a saved Character;
- confirm direct-IP/session-name flow and required-content parity reach Ready before play;
- start play and confirm freeform/initiative intent-first mechanics and existing Host authority behave normally;
- Host reveals a local image handout; Client receives it, dismisses/reopens it, Host withdraws it;
- reconnect the Client while a current image is revealed and confirm the current reveal is restored;
- confirm no tactical grid/token/fog/path/LOS/cloud dependency appears.

Record the exact source SHA and pass/fail observations. If a failure is found, capture the specific UI action and observed result; do not broaden scope without evidence.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch, or PR #109 moved.
2. While control is `needs_user`, do not make source edits or rerun validated automation.
3. Obtain the human Windows acceptance result for exact HEAD `bed3119c...` using the two checklists above.
4. If human acceptance passes, record the result in PLAN/STATE/STATUS and set control `complete` last for V0.9; keep PR #109 draft/unmerged unless the user separately authorizes merge.
5. If human acceptance finds a product defect, record the exact repro, return the same sequence to `continue`, and fix only the observed failure with affected-gate validation.
6. Never merge PR #109 without explicit user authorization.

## Dispatch recommendation
`needs_user`
