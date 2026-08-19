# Rerun 상태

**연결 상태:** `main` coordination · V0.9 전체 기획 통합 완료, 구현 계속 승인

- 저장소: `Kaetaeru/SimpleVTT`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- PR: #109 open/draft/unmerged
- 검증된 source checkpoint: `fbf37144d2ed56272429287419393bf221d83f44`

## V0.9 전체 실행 계획

`.chatgpt-rerun/PLAN.md`에 지금까지 확정한 V0.9 내용을 watcher 실행 명세로 모두 통합했습니다.

포함 범위:
- 세션 내내 켜두는 tabletop companion 철학
- Library Mode / persistent Session Mode
- DM 즉시 활성 세션, Lobby/Ready/Play Start 폐기
- Player join/reconnect
- Session Bar/Main Focus/Action Dock/Utility Rail/LayerHost
- Player/DM 공용 및 고유 UI
- Quick Sheet / Full Sheet
- Rules / Activity
- Freeform / intent-first Action Dock / Target flow
- spatial module 부재 시 valid target을 사거리 내로 취급
- Initiative 확장
- DM Encounter/Actor/Participants/Session 도구
- cinematic dice / result
- Handout
- responsive / keyboard / focus / recovery
- 기존 authority 재사용 원칙과 금지되는 중복 시스템
- slice별 구현 순서
- Windows human acceptance A-J
- exact-head validation 및 V0.9 완료 기준

## 현재 완료된 구현

walking skeleton은 이미 구현/검증 완료입니다.

- active connected Session -> app-level `SessionModeRoot`
- persistent Session shell
- Player Character identity + one-click Quick Sheet
- DM Actor identity + Quick View
- zero Player / zero Combatant valid session state
- canonical snapshot/command authority 유지
- 기존 Library sidebar / `플레이로 돌아가기` / permanent Actor wall / category hotbar를 새 Session root에서 제거

GitHub Actions UI run `32211000260` / frontend job `95943502788`: **SUCCESS**.

## 다음 실행

같은 sequence 3에서 바로 이어서:

1. Full Sheet in-session host + shared Sheet extraction/state preservation
2. Rules/Activity
3. Freeform convergence
4. Action Dock
5. Target/no-spatial fallback
6. cinematic dice/result
7. DM tools
8. reconnect utilities
9. Initiative
10. Handout
11. responsive/focus
12. exact-head validation
13. Windows acceptance

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
