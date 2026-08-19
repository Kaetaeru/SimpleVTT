# Rerun 상태

**연결 상태:** `main` coordination · 구현 일시 중단, Session UI 시각 배치 기획 완료

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 새 시각 배치 명세: `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`
- 최신 planning HEAD: `df1da3582f0a43d1ed573eee9d5e40de72874365`

## 이번에 확정한 화면 골격

기준 desktop은 1440x900이며 Session Mode는 다음 다섯 영역으로 고정합니다.

1. 상단 compact Session Bar 약 52px
2. 가장 큰 Main Focus
3. 하단 intent-first Action Dock 약 64~72px resting
4. 우측 Utility Rail 약 48~56px
5. 그 위에 pane/drawer/Full Sheet/dice/result를 올리는 Layer Host

Freeform의 중앙은 계속 조용하게 유지합니다. 전체 Actor/Party board, Initiative order, action economy, 대형 category hotbar, Activity/Inspector는 상시 노출하지 않습니다.

## Player

- Session Bar 오른쪽에 Character portrait/name/compact HP가 항상 보입니다.
- Character chip 한 번 클릭 -> Quick Sheet
- 바로 옆 명확한 expand -> Full Sheet
- Quick Sheet는 desktop 약 360px 우측 pane
- Full Sheet는 mounted Session Shell 위 약 88~94% 폭의 large workspace overlay
- Full Sheet toolbar에서 `SimpleVTT | 공식 시트 스타일`, Rules, close를 제공합니다.
- close는 `플레이로 돌아가기`가 아니라 `시트 닫기`입니다.

## DM

- Session Bar에 현재 acting Actor identity를 둡니다.
- actor click -> Quick View
- switch affordance -> Actor Switcher
- 우측 Rail은 Actor, Rules, Encounter, Participants, Handout, Activity/Undo, Session 순입니다.
- Player 0명/Combatant 0명도 정상 Freeform 상태이며 필요한 compact CTA만 제공합니다.

## Action / Combat

Freeform resting Action Dock은 Attack, Magic, Search, Influence, Help + `모든 행동` 같은 작은 intent 집합을 기본으로 하고 필요할 때만 contextual detail로 확장합니다.

Initiative는 새 페이지가 아니라 같은 Shell에 compact order strip/current-turn economy/turn controls를 추가합니다.

Target chooser는 target이 필요한 action을 선택했을 때만 나타납니다. spatial module이 없으면 거리 값을 만들지 않고 otherwise-valid target은 모두 선택 가능합니다.

## Responsive

- >=1200px: fixed right rail + side panes
- 900~1199px: drawer 성격 강화, Action Dock 2-row 허용
- <900px/constrained: utility strip, Quick Sheet/Rules full-height drawer, Full Sheet full workspace overlay

좁은 Windows 창에서도 close/back/primary action이 viewport 밖으로 사라지면 안 됩니다.

## 다음 단계

구현/CI는 아직 시작하지 않습니다. 다음 기획은 더 큰 제품 문서가 아니라 구현 slice와 바로 연결되는 네 계약입니다.

1. S-00 Session Shell component/state ownership
2. Quick Sheet 정확한 정보 구조
3. Full Sheet in-session component reuse
4. Freeform Action Dock intent별 behavior table

이 네 가지가 승인된 뒤 같은 sequence를 `continue`로 돌려 구현을 시작합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
