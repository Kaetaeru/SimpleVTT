# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, 플레이 화면 인벤토리 기획 완료

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
- 최신 planning HEAD: `72220a90e851a74b8cbf66c7038529d283957efc`

## 이번 기획에서 정리한 화면 분류

### DM/Player 공용 기반
- Active Session Play Shell
- Freeform Play Workspace
- Initiative / Combat Workspace
- Actor / Character Quick View
- Intent -> Detail -> Target 흐름
- Resolution Result
- Cinematic Dice / Handout / Reconnect / Error transient layers

### DM 고유
- Open Session
- Active DM Play Workspace
- Session Share & Settings
- Participant
- Encounter Editor
- Combatant Picker
- DM Actor Control
- Initiative Control
- Handout Control
- Activity / Undo detail

### Player 고유
- Join Session
- Active Player Play Workspace
- My Character Quick Sheet
- Leave / Reconnect choice

### 세션 외 플레이
- SimpleVTT Character Sheet
- Official-Style Character Sheet

## 중요한 금지 사항

Host Preparing, Player Lobby, Ready, Play Start gate를 별도 필수 화면으로 만들지 않습니다. permanent dice frame, permanent Inspector/Activity/Handout manager, tactical map/grid/token, standalone distance editor, protocol/debug dashboard도 기본 play page로 만들지 않습니다.

구현은 아직 재개하지 않습니다. 다음 단계는 `C-01 Active Session Play Shell`부터 화면 하나씩 layout/정보 hierarchy/action/state/error/responsive/human acceptance까지 구현 가능한 수준으로 확정하는 것입니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
