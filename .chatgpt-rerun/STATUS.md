# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, 구현 직전 UI 계약 완료

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 최신 planning HEAD: `a1ee400d1bcb7b8db3f72d793e7bdefb7782c8e9`

## 이번에 완료한 마지막 구현 직전 기획

### 1. Session UI Architecture
`.agents/V0_9_SESSION_UI_ARCHITECTURE_CONTRACT.md`

- active Session은 Library route가 아니라 app-level Session Mode
- SessionBar / MainFocus / ActionDock / UtilityRail / LayerHost로 분리
- 새 UI state는 pane/intent/focus/scroll 같은 presentation state만 소유
- Character/Scene/Action/Resolution/Session authority는 기존 AppProvider/runtime 그대로 유지

### 2. Existing UI Reuse Map
`.agents/V0_9_EXISTING_UI_REUSE_MAP.md`

재사용:
- production action/target command wiring
- 기존 Character Sheet projection/content
- Official Character/Spellcasting page
- layout preference
- app-level dice/VFX/handout authority

교체/퇴역할 정상 Session UI:
- Library sidebar 안의 Play route
- `플레이로 돌아가기`
- 상시 Actor card wall
- 상시 공통/클래스/주문/아이템/패시브/커스텀 hotbar
- Freeform action economy
- lifecycle 기준 Encounter 편집 제한
- Sheet 내부 dice tray

### 3. Quick Sheet IA
`.agents/V0_9_QUICK_SHEET_INFORMATION_ARCHITECTURE.md`

- Character chip 1-click
- 첫 화면: identity -> HP/AC -> 핵심 수치 -> 상태 -> 자원 -> 주 공격
- Spell/Feature/Item은 compact quick access
- 별도 Character/HP/resource store를 만들지 않음
- Session action은 canonical ActionVm/resolveAction 경로로 실행
- connected Session에서 local random roll을 authoritative result처럼 취급하지 않음

### 4. Full Sheet Reuse
`.agents/V0_9_FULL_SHEET_IN_SESSION_REUSE_CONTRACT.md`

- Standalone/Session이 같은 Sheet content family 재사용
- SimpleVTT Sheet section과 Official page를 재사용/분리
- Session에서는 Full Sheet가 LayerHost workspace
- `기기로 플레이` route 버튼 제거
- Rules는 Sheet 위에 열고 독립적으로 닫음
- Sheet roll presentation은 body-level cinematic dice

### 5. Action Dock Matrix
`.agents/V0_9_ACTION_DOCK_BEHAVIOR_MATRIX.md`

`Resting -> Intent -> Detail -> Target -> Pending -> Resolution`

Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study, Utilize 전체 행동을 intent별로 정의했습니다.

UI가 공격/사거리/target legality를 새로 계산하지 않습니다. canonical ActionVm/eligibleTargetIds를 사용하고, spatial module이 없을 때의 `모두 사거리 내` fallback은 canonical target eligibility에서 보장해야 합니다.

## 다음 구현 범위

구현 승인 후 처음부터 전체 UI를 한꺼번에 바꾸지 않습니다.

첫 walking skeleton:
1. Library / Session Mode root 분리
2. persistent Session Shell
3. Player Character / DM Actor identity
4. low-noise Main Focus
5. 최소 Utility Rail + LayerHost
6. Character chip 1-click Quick Sheet
7. Quick Sheet open/close 시 Session context 보존

이 slice를 실제 검증한 뒤 Full Sheet -> Rules -> Freeform Action Dock 순서로 확장합니다.

구현/CI는 아직 시작하지 않았습니다. PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
