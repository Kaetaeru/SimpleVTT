# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, 세션 상호작용 상세 기획 완료

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 상세 상호작용 명세: `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- 최신 planning HEAD: `34477c78c1e85cd24433b578c0f4a405a4b7a824`

## 이번에 추가로 확정한 것

### 세션 중 Character Sheet
- Player Character identity는 Session Bar에 항상 노출합니다.
- Character chip 한 번으로 Quick Sheet를 엽니다.
- 명확한 expand action 한 번으로 Full Sheet를 엽니다.
- Full Sheet는 세션을 떠나는 route가 아니라 Session Shell 위의 큰 layer/split workspace입니다.
- 시트를 닫으면 이전 Freeform/Initiative/Actor/유효한 action context로 돌아갑니다.
- 시트 roll은 별도 dice frame 없이 body-level cinematic dice를 사용합니다.

### 세션 Utility
Player는 Sheet, Rules, Activity, active Handout, Session/connection을 고정 Utility에서 바로 엽니다.

DM은 Actor, Rules, Encounter, Participants, Handout, Activity/Undo, Session share/settings를 같은 Session 안에서 바로 엽니다.

### Layer / Escape
- Session Shell은 세션 종료 전까지 유지합니다.
- Quick View → pane/drawer → Full Sheet → transient overlay → confirmation 순의 layer 규칙을 둡니다.
- Escape는 항상 가장 위 layer/interaction step 하나만 닫습니다.
- Escape로 Session leave/end가 실행되지 않습니다.

### Freeform
- 전체 Scene Actor board 상시 표시 없음
- category hotbar 상시 표시 없음
- action economy 상시 표시 없음
- intent-first Action Dock는 평소 compact 상태
- target UI는 실제 target이 필요할 때만 노출

### 사용성/접근성
- 버튼을 눌렀는데 무반응인 상태를 허용하지 않습니다.
- disabled action은 이유를 domain language로 표시합니다.
- 핵심 기능은 hover-only로 숨기지 않습니다.
- 좁은 Windows 창에서는 pane을 drawer/full overlay로 바꾸되 close/primary action을 잃지 않습니다.
- focus는 열린 도구로 이동하고 닫으면 launcher로 복귀합니다.

## 실제 Windows human acceptance
A~J 시나리오를 명세했습니다: Freeform 중 Quick Sheet, Full Sheet roll, action 도중 Rules 확인, DM active Freeform 중 Combatant 추가, Initiative 전환, Sheet/Rules 중첩 닫기, reconnect, player 0명 DM, spatial module 없는 melee targeting, 좁은 viewport 사용성입니다.

구현/CI는 아직 재개하지 않습니다. 다음 단계는 이 interaction 명세를 확인한 뒤 S-00/Quick Sheet/Full Sheet의 실제 visual/layout contract를 확정하는 것입니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
