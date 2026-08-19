# Rerun 상태

**연결 상태:** `main` coordination · 구현 계속 승인 · Initiative expansion까지 검증 완료

- 저장소: `Kaetaeru/SimpleVTT`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- PR: #109 open/draft/unmerged
- 검증된 현재 source HEAD: `9739da95521206116e9638c0459f541de46fdc31`

## 추가 검증 완료 — Initiative expansion

UI run `32219100733` / frontend `95966108635`: **SUCCESS**.

- 같은 persistent Session Shell에 compact Initiative row를 확장
- canonical round/current Actor/initiative/status/economy projection만 읽음
- 순서는 Initiative total 기준 compact horizontal strip으로 표시하고 별도 turn authority를 만들지 않음
- 현재 턴 Action/Bonus/Reaction/Movement만 Initiative에서 노출
- Player는 자신의 현재 턴에서만 기존 `endTurn()` 사용, DM은 기존 authority로 다음 턴 진행
- DM Initiative 종료는 기존 `endInitiative()` 재사용
- order display가 Actor selection/currentActor/economy를 직접 변경하지 않음
- Main Focus는 현재 Actor 핵심 수치/상태만 표시하고 Action Dock은 기존 Initiative intent set 재사용
- Freeform low-noise 분기는 그대로 유지
- 기존 Session/DM/reconnect/lifecycle/Phase09, TypeScript, production build 모두 green

중간 CI 실패는 Freeform 구조 테스트가 `SessionMainFocus.tsx` 전체에 `economyByActor`가 없다고 가정한 오래된 소유 범위 문제였습니다. Freeform 분기만 검사하도록 테스트를 좁혔고 제품 동작은 되돌리지 않았습니다.

## 다음

다음 승인 slice는 **Handout integration**입니다.

- 기존 handout runtime/bridge/state/transfer semantics 재사용
- DM reveal/withdraw를 Session utility 안으로 통합
- Player dismiss/minimize/reopen 및 reconnect-restored active image 유지
- Session Shell/Action/Sheet/Rules/Initiative 문맥 위의 transient layer로 처리
- permanent image manager나 tactical map으로 확장하지 않음

기존 no-spatial 변경 이후 오래된 offline provenance assertion이 남아 있는 것은 final automated validation 단계에서 정리합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
