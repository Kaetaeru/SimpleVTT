# SimpleVTT UI/UX — 사용자 대시보드

현재 **Owner가 직접 답해야 하는 필수 UI/UX 질문은 모두 끝났습니다.**

예전처럼 세부 UI 항목을 하나씩 선택할 필요가 없습니다. 앞으로는 AI가 이미 Reviewed된 방향과 [`OWNER-CONTROL-POLICY.md`](OWNER-CONTROL-POLICY.md)에 따라 세부 UX를 설계하고, 제품 사용법을 크게 바꾸는 새 선택이 생길 때만 다시 Owner에게 묻습니다.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **완료 — 0개 남음** |
| UX-01 / UX-02 | **Reviewed** |
| UX-03 / NAV-01 / UI-01 / INT-01 | **Reviewed** |
| 핵심 Owner Checkpoint 10개 | **Reviewed** |
| 상세 UI 질문 | AI Design Default / contract로 처리 |
| Frozen 결정 | 없음 |
| 실제 구현 | 아직 승인되지 않음 |

완료된 핵심 워크시트: [`owner-review/02-key-decisions.md`](owner-review/02-key-decisions.md)

Canonical 결정: [`decisions.md`](decisions.md)

---

# 이번에 추가로 확정된 핵심 방향

## 화면 지원 범위

- v1은 **큰/보통/좁은 데스크톱 창**을 공식 지원합니다.
- mobile/touch-first 전용 UI는 v1 범위에서 제외합니다.

## 세션 진입 방식

- **별도 대기실/Ready 화면을 만들지 않습니다.**
- Host가 세션을 열면 곧바로 **live session**이 됩니다.
- DM은 같은 live session 안에서 플레이와 준비/편집을 동시에 할 수 있습니다.
- Player는 이미 열린 세션에 **중간 참가**할 수 있습니다.
- Character가 하나도 없으면 Join을 막고 `Create / Import`를 안내한 뒤 Character를 준비하고 다시 Join합니다.

## DM 굴림 / Activity

- 새 세션에서 DM 굴림 기본값은 **Public**입니다.
- DM이 바꾼 Public/DM Only 값은 **그 live session 동안만** 유지됩니다.
- DM Activity는 공개/비공개 기록을 **하나의 시간순 기록**에서 보여주고, 표시와 필터로 구분합니다.
- DM-only 비밀정보는 기존 원칙대로 Player에게 전달하지 않습니다.

## DM 고급 도구 / 수정 기록

- 거리/시야/엄폐 수동 편집은 v1에 남기되 **고급 DM 도구**로 필요할 때만 엽니다.
- Undo/판정수정은 기존 기록을 삭제하지 않습니다.
- 이전 결과는 남기고 **correction/reversal 기록을 새로 추가**합니다.

## Content / Add-on

- v1 공식 import 형식은 **SimpleVTT package format 하나**입니다.
- v1에서 install / update / replace / disable / delete 전체 lifecycle을 제품 기능으로 지원합니다.
- live session은 **세션이 열릴 때의 content configuration을 snapshot으로 고정**합니다.
- live 중 library의 콘텐츠를 변경해도 현재 세션은 바뀌지 않고 이후 세션에만 적용됩니다.

---

# 이전에 이미 정리된 큰 방향

## 제품 / 역할

- Standalone Character Sheet와 Connected VTT는 둘 다 핵심 기능
- Connected: **Host = DM / Client = Player**
- Offline/Standalone에는 DM/Player 역할 없음
- Player는 자신의 Character Actor를 기본 조종
- DM은 추가 Actor 조종권을 줄 수 있고 모든 Actor를 조종 가능
- v1 Spectator / Co-DM / Observer 없음

## 앱 / 메뉴

- 기본 메뉴: **홈 → 캐릭터 → 세션 → 콘텐츠 → 룰 → 설정**
- Product Shell은 상단 메뉴형
- Activity/Encounter/판정수정/세션도구는 contextual tool
- live session 중 `플레이로 돌아가기`를 항상 제공
- 앱을 완전히 종료했다 다시 켜면 Home에서 시작
- 첫 실행은 별도 튜토리얼/안내 화면

## 플레이 화면

- Scene/Actor + Command Center + 현재 턴/상태를 최우선 표시
- Command Center는 화면 아래 고정
- BG3 계열 구조: 위쪽 action/resource 줄 + 왼쪽 Actor 상태 + 오른쪽 행동/Hotbar
- 적/NPC Actor Board는 위, Player/아군 Board는 아래
- 카드가 최소 크기보다 작아질 때 가로 scroll/paging
- Initiative Tracker는 Scene 상단 edge에 compact overlay
- Session/DM 도구는 side pane
- 안전한 범위에서 주요 panel 크기 조절 가능
- 중요한 현재 상태를 별도 **NOTICE UI**에서도 지속 표시

## 캐릭터 / 조작

- Character Library가 캐릭터 관리 hub
- Official-style Sheet + SimpleVTT Sheet 선택 가능
- 첫 tutorial에서 기본 sheet style 선택
- 기존 Character Builder / Level Up UX 유지
- Actor 우클릭 메뉴는 정보/관리 같은 UI 기능만 사용
- 공격/주문/아이템은 우클릭 메뉴에 넣지 않음
- 자주 쓰는 행동은 직접 노출
- 설명/세부정보는 hover explanation frame을 적극 활용

---

# 이제 AI가 알아서 정하는 것

Owner에게 다시 묻지 않고 AI가 설계합니다:

- 글씨 크기, 여백, 색상 token
- 아이콘과 button variant
- 일반 Hover / Focus / Pressed 상태
- 일반 loading / empty / error UI
- 좁은 desktop에서의 세부 reflow
- panel 내부 배치
- 일반 confirmation/copy
- component 세부 구조
- animation 세부 timing
- 접근성의 일반적인 좋은 관행

단, 이런 세부사항이 실제 제품 사용법을 크게 바꾸는 선택으로 커지면 `OWNER-CONTROL-POLICY.md` 기준에 따라 다시 Owner Checkpoint로 올립니다.

---

# 아직 AI도 임의로 정하지 않는 기술/계약 문제

현재 남은 material blocker는 Owner 취향 문제가 아닙니다.

- `GAP-MAIN-HAND-CANONICAL-RELATION`
  - 장착 Main Hand와 실행 가능한 기본 공격의 authoritative 관계
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
  - 판정 중 어떤 authoritative command가 동시에 안전한지
- `GAP-HANDOUT-NETWORK-CONTRACT`
  - Handout shared mode / reconnect projection
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
  - DM-only data를 Player에게 전혀 보내지 않는 network/event contract
- `GAP-CANONICAL-UX-DOC-RECONCILIATION`
  - 오래된 planning 문서와 새 Reviewed 방향 정리

이 항목들은 Domain/Architecture 계약 또는 문서 reconciliation로 처리합니다.

---

# 다음 단계

Owner가 추가로 작성할 필수 워크시트는 없습니다.

다음 planning 작업은:

1. 남은 detailed map을 AI Design Default / contract로 정리
2. 위 Domain/Architecture Gap 해결
3. legacy UX planning 문서 reconciliation
4. 구현 준비 시 Surface / Component / Motion contracts 생성
5. 필요한 범위를 Frozen한 뒤 scoped Work Order 준비

**현재 결정은 Reviewed이며 Frozen이 아닙니다. 구현도 아직 승인되지 않았습니다.**
