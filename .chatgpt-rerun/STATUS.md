# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, 상시 세션 UI 철학 재정립

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- UI-first 문서: `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- 플레이 화면 인벤토리: `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- 상시 세션 UX 원칙: `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- 최신 planning HEAD: `4c4c07fdbd41ea14f30f00f51f33cec73f4cf482`

## 새 핵심 철학

D&D 세션이 활성화된 뒤에는 SimpleVTT를 계속 켜 둔 채 대화, 탐험, Character/규칙 확인, 판정, 전투, DM 운영을 끊김 없이 이어갈 수 있어야 합니다.

따라서 `플레이`는 여러 route 중 하나가 아니라 세션이 끝날 때까지 유지되는 **Session Mode**입니다. Sheet, Rules, Activity, Encounter, Participants, Handout, Session 정보는 정상 세션 중 별도 페이지로 나갔다 돌아오는 방식이 아니라 Session Play Shell 안의 drawer/pane/overlay로 열어야 합니다.

## 현재 UI 재점검에서 확인한 충돌

1. 현재 App shell은 Home/Characters/Session/Content/Rules/Settings route로 workspace를 교체하고 `플레이로 돌아가기`를 제공합니다.
2. Freeform에서 NPC/Combatant 및 Player/Party Scene Actor row가 항상 화면 중앙을 크게 차지합니다.
3. `공통/클래스/주문/아이템/패시브/커스텀` hotbar가 상시 노출되어 tabletop companion보다 game HUD에 가깝습니다.
4. Freeform에서도 action/bonus/reaction/movement economy를 `FREE`로 계속 표시합니다.
5. Encounter 편집이 active session 운영이 아니라 offline/preparing lifecycle에 묶여 있습니다.
6. full Character Sheet와 Rules lookup이 session-resident 도구가 아니라 route 단위입니다.

이 항목들은 구현 전에 C-01 Active Session Play Shell 설계에서 다시 정의합니다.

## 다음 단계

구현/CI는 아직 재개하지 않습니다. 다음에는 C-01을 persistent session bar, 낮은 밀도의 main focus, intent-first action dock, in-session utility rail, transient overlay stack으로 구체화합니다. 특히 Sheet/Rules/Activity와 DM Encounter/Participants/Handout/Session 도구가 Session Shell을 대체하지 않도록 확정합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.