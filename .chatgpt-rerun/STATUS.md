# Rerun 상태

**연결 상태:** `main` coordination · 구현 계속 승인 · Handout integration까지 검증 완료

- 저장소: `Kaetaeru/SimpleVTT`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- PR: #109 open/draft/unmerged
- 검증된 현재 source HEAD: `9f4d2f64cad008726e318a8ea43cb4f008ae962c`

## 추가 검증 완료 — Handout integration

UI run `32219878491` / frontend `95968231474`: **SUCCESS**.

Phase 12 connected run `32219878487`의 connected-authority 단계도 49/49 **SUCCESS**이며, 현재 DM handout이 compatible reconnect 후 Player에게 복원되는 기존 runtime 테스트가 포함됩니다.

- 기존 handout runtime/state/transfer semantics만 재사용; 새 image/session protocol이나 durable store 없음
- `main.tsx`의 전역 body-level Handout UI mount 제거, persistent `SessionModeRoot`가 presentation 소유
- DM Utility Rail의 `자료`에서 로컬 이미지 preview → 공개 → 철회
- 기존 PNG/JPEG/WebP 및 4 MiB 검증 경로 유지
- Player는 현재 이미지가 오면 transient Session layer로 보고, 닫은 뒤 활성 이미지가 있을 때만 `자료`로 다시 열기 가능
- Handout이 열린 동안 Action Dock 입력은 suspend되고 `Escape`는 Handout 한 레이어만 닫음
- Sheet/Rules/Action/Initiative/Session Shell 문맥은 그대로 mounted 상태로 유지
- reconnect restore는 기존 hello-ack path를 그대로 사용
- ResolutionEvent/Undo/combat state와 분리된 presentation-only 상태 유지
- permanent image manager / tactical map으로 확장하지 않음

중간 CI에서는 두 개의 오래된 presentation-ownership assertion만 교정했습니다. 하나는 Action Dock suspend 조건을 이전 세 레이어로 고정했고, 다른 하나는 `main.tsx`에 전역 `SessionImageHandoutBridge`가 반드시 있어야 한다고 가정했습니다. 둘 다 test-only 수정이며 제품 동작을 되돌리지 않았습니다.

## 다음

다음 승인 slice는 **responsive/keyboard/focus pass**입니다.

- constrained Windows viewport에서 Session Bar/Rail/Quick·Full Sheet/Rules/Activity/DM tools/reconnect/Initiative/Handout/Action Dock/target/result가 모두 도달 가능해야 함
- keyboard-only 사용과 focus restoration 확인
- `Escape`는 top layer/interaction step 하나만 닫기
- 이미 검증된 mechanics/authority나 UX 구조를 재설계하지 않음

기존 no-spatial 변경 이후 오래된 offline provenance assertion은 final automated validation 단계에서 정리합니다. 현재 Handout exact HEAD의 connected authority 49/49는 green이고 이 알려진 assertion만 그 이후 단계에서 실패합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
