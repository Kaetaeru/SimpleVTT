# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, V0.9 UI-first 기획 재정립

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 새 UI 기획 문서: `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- planning commit: `3d1507fafbfdeff27d8986fd26f9d815fb6f41dd`

## 현재 상태

자동 검증 green 상태에서도 실제 사용자 화면의 interaction 계약이 여러 군데 빠져 있었기 때문에 구현을 더 진행하지 않고 UI 기준으로 V0.9 기획을 다시 잡습니다.

이번에 확정해서 문서화한 핵심 결정:

1. **주사위 연출** — Character Sheet 내부에 별도 주사위 frame을 만들지 않습니다. 데모에서 합의한 body-level cinematic overlay를 사용하고, 주사위는 화면 뒤/깊은 곳에서 사용자 쪽으로 날아오는 3D 연출을 사용합니다.
2. **멀티플레이 DM 흐름** — DM이 `세션 열기`를 누르는 순간 세션은 활성 상태이며 DM workspace에 바로 들어갑니다. 플레이어 0명이어도 즉시 Encounter/Combatant/session editing/handout/Initiative 등 DM 도구를 사용할 수 있습니다.
3. **로비 제거** — 플레이어들을 lobby에서 기다리고 모두 Ready가 된 뒤 `플레이 시작`을 누르는 필수 흐름을 사용하지 않습니다. 플레이어는 이미 열린 세션에 합류합니다.
4. **사거리 fallback** — 별도 spatial/range module이 없으면 모든 적절한 target을 사정거리 이내로 간주합니다. `spatial data 없음`을 `out of range`로 취급하지 않으며, 기본 제품에서 `5 ft 대상 없음` 때문에 근접 공격을 막지 않습니다.

기존 `PHASE14_PRODUCTION_UX_REDESIGN.md`의 Host preparing/Client lobby/Ready/Start 전제와 기본 spatial-distance 전제는 새 UI-first 문서와 충돌하는 범위에서 더 이상 제품 기준으로 사용하지 않습니다.

## 다음 단계

구현이나 CI를 바로 재개하지 않습니다. 다음에는 새 문서를 화면 단위로 보강합니다: Session/DM/Player lifecycle, Character Library/Sheet, Freeform/Combat, Handout, Activity/Undo, Settings, error/recovery 순으로 실제 사용자가 보는 정보와 primary action을 먼저 확정합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
