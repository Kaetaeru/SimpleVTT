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
- `STATUS.md`와 사람에게 보여 주는 watcher 상태 설명은 **한국어로 작성한다**. 정확한 SHA/workflow/job/code 식별자는 원문을 유지할 수 있다.
- GitHub 작업은 먼저 해당 GitHub 플러그인 스킬을 호출한다. 일반 저장소/PR은 `github`, CI 실패는 `gh-fix-ci`, 리뷰는 `gh-address-comments`, 게시 작업은 `yeet`를 우선한다.
- CI에서 `gh-fix-ci`가 `gh` 부재/인증 문제로 Actions 로그를 읽지 못하면 사용자 승인에 따라 connector `fetch_workflow_job_logs`와 관련 run/job API를 fallback으로 사용할 수 있다.
- 로그/실제 repro 없이 추측 수정하지 않는다.
- PR #109는 명시적 사용자 승인 없이 merge하지 않는다.

## Architecture invariants
- one canonical Character; owning Client Character Library remains durable Character authority;
- Host projections remain ephemeral and Host remains connected mechanics authority;
- ResolutionEvent ledger/reconnect/idempotency/event-native Undo remain canonical;
- installed-content composition/validation remain content authority;
- no second Character/content store, resolver, mechanics protocol or event ledger;
- portraits/handouts remain presentation state only;
- no tactical grid/token/Fog/pathfinding/minimap/LOS/cloud dependency.

## Last automated-green source HEAD
`bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

Latest source commits:
- `5c70b3028aed70b0fc5ddafafe119f40174df833` — `Remove unreachable legacy App surfaces`
- `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994` — `Update UI rule baseline after legacy removal`

At `bed3119c...`, UI, Rules Domain, Contract validation, Persistence, Phase 11, Phase 12 Connected Session, Main Playable and all associated Windows build/stage/upload jobs completed success. This automated evidence remains valid for untouched behavior, but **human Windows acceptance has now failed and V0.9 is not complete**.

## Human Windows acceptance defects reported at `bed3119c...`
The user exercised the delivered Main Playable Windows artifact and reported four concrete product mismatches:

1. **Visual dice mismatch** — production dice are not the shapes/visual treatment previously established in the UI demo; they appear completely different.
2. **Demo-session attack unavailable** — in the demo session the user cannot perform an attack.
3. **Official Character Sheet layout missing** — the Character surface does not expose the previously required official-sheet layout version.
4. **Character-card selection resolves to one Character** — when choosing among existing Character cards, clicking different cards still enters the same single Character.

These are acceptance failures. Do not mark the previous automated-green head as final product acceptance.

## Previously validated boundaries — do not repeat unless touched
1. Production Play.
2. Fast production Visual Dice automation evidence.
3. Composable Combat VFX.
4. Appearance preferences.
5. Dual Character Sheet + Official Spellcasting automation evidence.
6. Direct-IP Session entry/configuration.
7. Automatic validated Host-required declarative content parity before Ready.
8. Character portrait + DM image handout/reconnect.
9. Contextual DM/Content polish + production dead-wiring cleanup at `04d8af30...`.
10. Proven-unreachable legacy `App.tsx` Sheet/Create/Scene cleanup plus named-rule baseline alignment at `bed3119c...`.

Human acceptance now specifically reopens the presentation/selection/attack portions implicated by the four observed defects; unrelated validated boundaries stay closed.

## Next Exact Action
1. Perform mandatory watcher preflight and trust GitHub if `main`, control, work branch or PR #109 moved.
2. With this same sequence re-authorized as `continue`, investigate only the four human acceptance defects above.
3. For dice, locate the prior UI-demo dice authority/assets/components and compare the actual production-mounted dice renderer; restore the demo-established geometry/treatment rather than inventing a new appearance.
4. For demo attack, trace the production demo/session actor ActionVm/intent/target gating and fix the observed inability to attack without changing Host-authoritative resolution semantics.
5. For Character Sheet, restore/expose the official-sheet layout alongside the other normal layout, reusing the existing sheet authority rather than creating another Character representation.
6. For Character selection, trace card id -> active Character selection -> route/session entry and ensure each card resolves its own canonical Character.
7. Add/adjust focused regressions for all four observed defects.
8. Recheck PR #109 HEAD immediately before source writes; non-force fast-forward only.
9. Validate only affected UI/Main/Character/session/dice gates first, then collect same-head automatic Windows evidence after convergence. Do not rerun unrelated historical boundaries solely due watcher restart.
10. Deliver a new exact-head Windows artifact for another human acceptance pass.
11. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
