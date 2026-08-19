# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, 전체 UI 씬 기획 완료

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 최신 전체 UI 씬 기획: `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- 최신 planning HEAD: `afce5407d2a3b243f5b25d74dceb6257099d1ded`

## 전체 UI 구조

V0.9를 두 개의 큰 모드로 정리했습니다.

### Library Mode
세션 밖에서 Home, Character Library, Character Create/Edit, Standalone Character Sheet, Content, Rules, Settings, Session Entry를 사용합니다.

### Active Session Mode
Session이 시작되면 앱 전체가 persistent Session Mode가 되고, Session 종료/Leave까지 같은 Active Session Shell을 유지합니다.

공용 핵심 씬:
- Freeform
- Intent → Detail → Target
- Resolution
- Initiative/Combat
- Quick Character/Actor View
- in-session Full Character Sheet
- Rules Lookup
- Activity
- Connection/Recovery
- Cinematic Dice
- Handout Viewer

DM 전용:
- Session Share/Settings
- Participants
- Encounter Editor
- Combatant Picker
- Actor Switcher
- Initiative Controls
- Handout Control
- Adjudication/Undo

Player 전용:
- My Character session tools
- Leave/Reconnect

## 중요한 UI 원칙

- Freeform은 낮은 밀도의 기본 화면입니다.
- Scene Actor 전체 목록, action category hotbar, action economy를 상시 표시하지 않습니다.
- Rules/Sheet/Encounter/Activity는 Play를 대체하는 route가 아니라 Session Shell 안의 pane/drawer/overlay입니다.
- Initiative는 다른 페이지가 아니라 같은 Shell의 확장 상태입니다.
- Player Lobby/Ready/Play Start gate는 없습니다.
- 별도 spatial/range module이 없으면 적절한 target은 사거리 내로 봅니다.
- 주사위는 화면 뒤에서 앞으로 날아오는 body-level cinematic overlay이며 Sheet 내부 dice frame을 만들지 않습니다.

구현/CI는 아직 재개하지 않습니다. 다음 단계는 전체 씬 기획을 사용자와 확인한 뒤 `S-00 Persistent Active Session Shell`의 실제 배치를 구현 가능한 수준으로 확정하는 것입니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
