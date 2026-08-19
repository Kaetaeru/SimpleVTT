# Rerun 상태

**연결 상태:** `main` coordination · 첫 Session UI walking skeleton 구현/검증 완료

- 저장소: `Kaetaeru/SimpleVTT`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- PR: #109 open/draft/unmerged
- exact source HEAD: `fbf37144d2ed56272429287419393bf221d83f44`

## 이번에 실제 구현한 것

- 연결된 Host/Client Session이 생기면 Library sidebar 안의 `scene` route가 아니라 새 `SessionModeRoot`가 앱 전체를 차지합니다.
- 상단 Session Bar, 낮은 밀도의 Main Focus, 우측 Utility Rail, LayerHost, 하단 Action Dock 골격을 추가했습니다.
- Player는 항상 Character identity chip을 보고 한 번 클릭해서 Quick Sheet를 엽니다.
- DM은 현재 Actor identity를 항상 보고 compact Actor view를 열 수 있습니다.
- Player 0명 / Combatant 0명도 정상 활성 Session으로 표시하며 Lobby/Ready 대기 화면으로 보내지 않습니다.
- Quick Sheet는 기존 canonical Character/Scene/Action projection만 읽고 별도 Character store나 resolver를 만들지 않습니다.
- active Session에서는 기존 Library sidebar, `플레이로 돌아가기`, permanent Actor wall/category hotbar가 기본 화면에 나타나지 않습니다.

## 검증

GitHub Actions UI run `32211000260` / frontend job `95943502788`: **SUCCESS**.

새 persistent Session root 구조 테스트와 기존 Phase 14 UX/라이프사이클/메커니즘 회귀, TypeScript, production build까지 모두 통과했습니다.

## 아직 하지 않은 것

이번 slice는 walking skeleton만 구현했습니다.

다음은 Full Sheet를 Session LayerHost 안에서 기존 SimpleVTT/Official Sheet content를 재사용하도록 분리하는 단계입니다. Rules/Activity, 완성된 Action Dock/Target flow, Encounter/Participants, Initiative/Handout 최종 배치는 그 뒤입니다.

구현은 여기서 잠시 멈춥니다. PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
