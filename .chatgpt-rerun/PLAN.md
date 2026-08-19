# Rerun Plan — SimpleVTT V0.9 UI-first replanning

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9 UI-first product replanning**
- dispatch recommendation: `needs_user`

## Watcher execution conventions
- `STATUS.md`와 사람에게 보여 주는 watcher 상태 설명은 한국어로 작성한다.
- GitHub 작업은 먼저 해당 GitHub 플러그인 스킬을 호출한다.
- CI 실패는 `gh-fix-ci` 우선; `gh` 부재/인증 문제 시 사용자 승인된 connector log fallback을 사용할 수 있다.
- 실제 로그/실제 human repro 없이 추측 수정하지 않는다.
- PR #109는 명시적 사용자 승인 없이 merge하지 않는다.

## Product-planning pivot
Human Windows acceptance와 후속 소스 확인 결과, 자동 검증 green만으로는 실제 UI 계약을 충분히 보장하지 못했다. 구현을 계속 덧대기 전에 **화면/사용자 행동 흐름을 기준으로 V0.9 기획을 다시 확정**한다.

새 UI authority 초안:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- work-branch commit `3d1507fafbfdeff27d8986fd26f9d815fb6f41dd`

이 문서가 전체 화면별 기획이 확정될 때까지 새로운 UI 구현의 1차 제품 기준이다. 기존 Phase 14 문서는 기술/역사 참고 자료로 유지하되, 새 문서와 충돌하는 UI lifecycle/interaction 가정은 새 문서가 우선한다.

## Newly locked UI decisions
### 1. Dice presentation
- standalone Character Sheet roll은 sheet 내부 별도 `VisualDiceTray`/dice frame을 기본 presentation으로 만들지 않는다.
- 데모에서 합의한 body-level cinematic overlay가 UI 계약이다.
- 주사위는 화면 깊은 곳/뒤에서 시작해 사용자 쪽으로 날아오며 굴러오는 3D 연출을 사용한다.
- 결과 overlay는 시트를 밀거나 재배치하지 않는다.

### 2. Multiplayer / DM session lifecycle
- `Host preparing -> player lobby -> Ready -> 플레이 시작`을 필수 사용자 lifecycle로 사용하지 않는다.
- DM이 `세션 열기`를 누르는 순간 세션은 활성 상태이며 DM workspace로 바로 진입한다.
- player 0명이어도 DM은 즉시 Encounter/Combatant, session state, handout, Initiative 등 DM 도구를 사용하고 세션을 편집할 수 있다.
- Player Ready를 session activation gate로 사용하지 않는다.
- 플레이어는 이미 열린 세션에 합류하며 handshake/content sync가 끝나면 현재 session state로 들어간다.
- reconnect도 lobby/start gate로 되돌아가지 않는다.

### 3. Range / spatial semantics
- SimpleVTT 기본 제품은 tactical grid/token position/pathfinding/LOS/지속적 정확 거리 추적을 기본 제공하지 않는다.
- **별도 spatial/range module이 연결되지 않은 경우 모든 적절한 대상은 사정거리 이내로 간주한다.**
- `spatial data 없음`은 `out of range`가 아니다.
- 근접 공격을 `5 ft 대상 없음`으로 막지 않는다.
- range/reach/LOS/cover 제약은 해당 module이 authoritative spatial facts를 명시적으로 제공할 때만 적용한다.

## Previous automated evidence
Exact source `d942d58a83eb2222ffd722d58b19c67c3dc8de13`에서 UI, Rules Domain, Contract validation, Persistence/Tauri, Main Playable, Phase 11, Phase 12 Connected 및 Windows build/stage/upload는 모두 green이었다.

이 증거는 기존 기술 경계가 동작했다는 기록으로 보존한다. 하지만 UI-first 기획과 충돌하는 동작을 제품 완료 증거로 사용하지 않는다.

## Planning work before implementation resumes
다음 화면/흐름을 UI 단위로 확정한다.
1. App 시작 화면 / navigation
2. Character Library
3. SimpleVTT Character Sheet
4. Official-style Character Sheet
5. Session 열기 / 참가하기
6. DM session workspace — player 0명, player 합류, live 운영
7. Player session workspace — 최초 join / reconnect
8. Freeform intent interaction
9. Initiative/combat interaction
10. DM Combatant/Encounter 편집
11. DM handout/image interaction
12. Activity/Undo 노출
13. Settings / appearance / accessibility
14. 오류/연결 실패/복구

각 화면은 구현 전 최소한 다음을 정의한다.
- 화면 목적
- visible information hierarchy
- primary action
- secondary actions
- 숨겨야 할 내부 정보
- state transition
- empty/loading/error state
- keyboard/responsive behavior
- human acceptance scenario

## Next Exact Action
1. 구현/CI 재실행을 시작하지 않는다.
2. 사용자와 `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`를 화면 단위로 계속 보강한다.
3. 특히 DM/Player multiplayer 흐름, Character Sheet roll presentation, freeform/combat interaction을 먼저 확정한다.
4. 전체 UI 기획이 승인되면 구현 slice와 acceptance checklist를 새 문서에서 파생한다.
5. 그때 같은 sequence를 `continue`로 재승인하고 source work를 재개한다.
6. PR #109는 draft/unmerged 유지.

## Dispatch recommendation
`needs_user`
