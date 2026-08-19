# Rerun 상태

**연결 상태:** `main` coordination · 구현 계속 승인 · responsive/keyboard/focus pass까지 검증 완료

- 저장소: `Kaetaeru/SimpleVTT`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- PR: #109 open/draft/unmerged
- 검증된 현재 source HEAD: `ee76aaec6af10fc7b28e939ccfd66eacd4d19384`

## 추가 검증 완료 — responsive / keyboard / focus

UI run `32220293621` / frontend `95969371848`: **SUCCESS**.

- Player Handout 닫기/Escape 후 활성 `자료` reopen control로 focus 복귀
- 기존 utility launcher focus restoration과 top-layer 한 단계 Escape 순서 유지
- 좁은 화면에서 header 종료 버튼이 숨겨져도 DM `세션` pane에서 기존 `stopSession()`으로 세션 종료 가능
- 낮은 Windows 창에서 Utility Rail이 세로 스크롤되어 모든 도구 접근 가능
- result/resolution layer도 높이 제한 + 내부 스크롤로 제어 버튼 접근 가능
- Quick Sheet / DM pane / Handout / Action Dock target/detail의 기존 constrained-width fallback 유지
- 새 focused responsive/keyboard/focus 회귀 테스트 통과
- 기존 Session/DM/reconnect/Initiative/Handout/lifecycle/Phase09, TypeScript, production build 모두 green

Phase 12 connected workflow도 authority protocol 단계는 green이며, 이후 실패는 이전부터 기록된 `phase11OfflineWalkthrough.test.ts`의 오래된 spatial-provenance assertion 하나뿐입니다.

## 다음

다음 단계는 **final exact-head automated validation**입니다.

1. 오래된 offline spatial-provenance assertion을 canonical no-spatial 계약에 맞게 수렴
2. 하나의 새 exact source SHA에서 UI / Phase 11 / Main Playable / Phase 12 / Persistence / Rules / Contract / Windows build를 함께 검증
3. 이후 Windows human usability acceptance A-J

이 단계에서 공간 시스템을 다시 기본 기능으로 복원하거나 가짜 spatial provenance를 만들어 테스트를 통과시키지 않습니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
