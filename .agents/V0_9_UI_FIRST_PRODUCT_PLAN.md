# SimpleVTT V0.9 UI-First Product Plan

## 문서 목적

이 문서는 V0.9의 제품 기획을 **사용자가 실제로 보는 화면과 행동 흐름**을 기준으로 다시 정의한다.

기존 Phase 14 문서는 구현 구조, runtime state, Host/Client lifecycle을 먼저 정하고 UI를 그 위에 얹는 방식으로 작성된 부분이 있었다. 그 결과 자동 검증이 green이어도 실제 사용 화면에서 다음과 같은 불일치가 남았다.

- 데모에서 합의한 주사위 연출과 실제 시트 굴림 연출이 달랐다.
- Character 카드 선택과 실제 active Character가 일치하지 않았다.
- official sheet layout이 구현되어 있어도 사용자가 자연스럽게 찾을 수 없었다.
- Session lifecycle이 사용자 행동보다 `preparing / lobby / Ready / start` 상태 모델을 우선했다.
- 공간/거리 시스템을 제품이 기본 제공하지 않기로 했음에도 공격 가능 여부가 거리 fact에 묶였다.

따라서 이후 구현은 이 문서의 **UI 계약을 먼저 확정한 다음** 진행한다. 내부 adapter, protocol, state machine은 UI 계약을 만족시키는 수단이지 제품 흐름의 출발점이 아니다.

---

## 1. 전역 UI 원칙

1. **화면에서 가능한 행동이 제품의 진실이다.** 구현되어 있지만 사용자가 발견할 수 없는 기능은 완료된 기능으로 간주하지 않는다.
2. **사용자 흐름을 내부 lifecycle에 맞추지 않는다.** 필요하면 내부 상태를 숨기거나 자동 전이한다.
3. **한 행동은 한 명확한 결과로 이어져야 한다.** Character 카드, 공격 대상, 시트 레이아웃, 세션 진입 모두 클릭한 대상/의도가 그대로 유지되어야 한다.
4. **기본 제품에 없는 시스템을 전제로 사용자를 막지 않는다.** 거리, LOS, grid 등은 선택적 module이 제공할 때만 제약으로 작동한다.
5. **데모에서 승인된 interaction은 모양뿐 아니라 동작 방식까지 계약이다.** 애니메이션의 위치, 레이어, 진입/퇴장 방식도 포함한다.
6. UI 기획이 확정되기 전에는 기존 green CI를 근거로 새 제품 흐름을 완료 처리하지 않는다.

---

## 2. Character Library

### 사용자 목표
저장된 Character를 보고, 원하는 Character를 정확히 선택해 시트로 들어간다.

### UI 계약
- 각 Character card는 자기 canonical Character id를 가진다.
- 카드의 어느 정상적인 open/select 영역을 눌러도 **그 카드의 Character**가 active Character가 된다.
- 다른 카드를 눌렀는데 이전 active Character가 열리는 동작은 허용하지 않는다.
- Character Library에는 현재 사용할 시트 레이아웃 선택이 자연스럽게 보여야 한다.
  - `SimpleVTT 시트`
  - `공식 시트 스타일`
- 레이아웃 preference는 Character 데이터 자체와 분리된 presentation preference다.
- Character를 연 뒤에도 두 레이아웃을 전환할 수 있다.

---

## 3. Character Sheet와 주사위

### 사용자 목표
시트만 열어둔 상태에서도 실제 테이블에서 Character를 운용할 수 있다.

### UI 계약
- ability/save/skill/Initiative/attack/damage/common die roll은 시트에서 직접 실행할 수 있다.
- **주사위 굴림 때문에 시트 안에 별도의 주사위 무대/프레임이 생기지 않는다.**
- 데모에서 승인한 방식대로 주사위는 app/body level의 cinematic overlay에서 표시된다.
- 주사위는 화면 깊은 곳/뒤쪽에서 시작해 **사용자 쪽으로 날아오며 굴러오는 3D 연출**을 사용한다.
- 결과 정보는 짧게 overlay로 표시되고 사라지며, 시트 레이아웃 자체를 밀거나 재배치하지 않는다.
- sheet-local roll history는 남길 수 있지만, history를 다시 볼 때도 별도 상시 dice frame을 만들지 않는다.
- connected authoritative roll과 standalone local roll은 결과 authority가 다를 수 있지만 **시각 언어와 cinematic presentation은 동일 계열**이어야 한다.

---

## 4. Session / Multiplayer — 새로운 기본 흐름

### 핵심 제품 결정
기존 `Host preparing → players lobby → Ready → 플레이 시작`을 필수 사용자 흐름으로 사용하지 않는다.

**세션을 연 순간 DM 세션은 이미 활성 상태다.**

### DM이 세션을 여는 순간
`세션 열기`를 누르면 즉시:

- 사용자는 DM이 된다.
- DM play/session workspace로 바로 이동한다.
- Session name, connection address 등 필요한 공유 정보는 볼 수 있다.
- 동시에 Encounter/Combatant, 장면/플레이 상태, 이미지 handout, Initiative 등 DM 도구에 바로 접근할 수 있다.
- **세션을 연 순간부터 세션 편집이 가능하다.**
- 플레이어가 아직 0명이어도 DM은 세션 준비와 플레이 편집을 계속할 수 있다.

### 로비/Ready에 대한 결정
- DM이 플레이어들을 별도 lobby에서 기다렸다가 `플레이 시작`을 누르는 흐름을 기본으로 사용하지 않는다.
- Player `Ready`를 세션 시작의 필수 조건으로 사용하지 않는다.
- 내부적으로 handshake/content parity/sync가 필요하더라도 이를 제품의 lobby 단계로 노출하지 않는다.
- 플레이어는 세션이 이미 열려 있는 동안 들어오며, 연결/동기화가 끝나면 현재 세션 상태에 합류한다.
- DM은 새로운 플레이어가 들어오는 동안에도 세션을 계속 편집/운영할 수 있다.
- reconnect도 별도의 시작 단계로 되돌리지 않고 현재 활성 세션으로 복귀한다.

### Session UI에서 보여야 할 것
DM:
- 세션 이름
- 접속 주소
- 현재 연결 플레이어
- DM 도구/세션 편집
- 세션 종료

Player:
- 선택한 Character
- 연결 상태
- 현재 세션/플레이 화면
- 나가기/재연결 상태

### Session UI에서 기본적으로 제거할 것
- `Host preparing`을 별도의 오래 머무는 화면으로 취급하는 UI
- 모든 플레이어 Ready를 기다리는 lobby
- `플레이 시작`을 session activation gate로 쓰는 버튼
- healthy handshake/content sync를 사용자가 승인해야 하는 단계처럼 보이는 UI

---

## 5. DM workspace

### 핵심 원칙
DM은 별도의 관리 앱으로 이동하는 것이 아니라, 세션을 열자마자 **플레이 가능한 DM workspace**에 들어간다.

### 세션 오픈 직후 가능한 행동
- 세션 이름/기본 정보 편집
- Combatant 추가/제거
- Encounter 구성
- Freeform 플레이 진행
- 필요할 때 Initiative 시작/종료
- DM 이미지 보여주기/회수
- 연결된 플레이어 상태 확인
- 현재 actor/target/action을 사용한 authoritative resolution

### UI 구조 원칙
- `세션 설정 완료` 같은 선행 완료 단계를 요구하지 않는다.
- 준비와 플레이가 같은 workspace에서 연속적으로 가능해야 한다.
- Initiative는 필요할 때 켜지는 mode이며 세션 자체의 시작/종료와 동일시하지 않는다.
- DM 도구는 필요할 때 바로 접근 가능하되, 영구적인 debug/inspector 패널을 강제하지 않는다.

---

## 6. 공격 대상과 거리 — 기본 제품 규칙

### 핵심 제품 결정
SimpleVTT 기본 제품은 tactical grid, token position, pathfinding, LOS, 지속적인 정확 거리 추적을 제공하지 않는다.

따라서 **별도의 spatial/range module이 연결되어 있지 않은 경우, 거리 때문에 공격을 막아서는 안 된다.**

### 기본 동작 — spatial module 없음
- 공격의 대상 후보가 되는 모든 적/대상은 기본적으로 **사정거리 이내**로 간주한다.
- 근접 공격도 `5 ft 대상이 없다`는 이유로 비활성화하지 않는다.
- 원거리 공격도 기본 제품이 별도 거리 정보를 가지고 있지 않다면 거리 초과로 막지 않는다.
- 기본 UI는 정확한 ft 거리를 요구하거나 임의의 fixture distance를 만들어내지 않는다.
- 사용자는 공격 intent → 공격 수단 → 대상 선택으로 바로 진행할 수 있다.

### spatial/range module이 연결된 경우
해당 module이 명시적으로 제공하는 authoritative spatial facts가 있을 때만:

- range 제한
- reach
- line of sight
- cover
- 기타 module-defined positional constraint

를 target eligibility에 적용할 수 있다.

### fallback 원칙
- `spatial data 없음`은 `out of range`가 아니다.
- `spatial data 없음`은 **unconstrained / in range로 취급**한다.
- module absence 때문에 기존 공격 mechanics가 unusable해지는 것은 제품 결함이다.

---

## 7. Exploration / Combat 화면

### Freeform 기본
- Character/actor
- intent actions
- 필요한 대상
- 방금 발생한 결과

만 우선 보여준다.

### Attack 흐름
1. `공격` 선택
2. 사용 가능한 공격/무기 선택
3. 공격 가능한 대상 선택
4. authoritative roll/resolution
5. cinematic dice + 결과 표시

spatial module이 없으면 3단계에서 거리 필터로 대상을 제거하지 않는다.

### Initiative
- Initiative는 combat-only 정보를 추가하는 overlay/state다.
- round/current turn/action economy가 필요할 때만 나타난다.
- Session 자체를 시작시키는 lifecycle gate가 아니다.

---

## 8. Multiplayer 내부 기술과 UI의 분리

다음 기술 동작은 유지될 수 있지만 사용자에게 별도 lifecycle 단계로 강요하지 않는다.

- Host authority
- hello / handshake
- installed-content parity
- Character projection
- reconnect/replay/idempotency
- ResolutionEvent ledger

예:
- content parity sync 중이면 짧은 `세션 콘텐츠 동기화 중` 상태는 가능하다.
- 그러나 이를 Player lobby + Ready + Start workflow로 확장하지 않는다.
- 동기화 완료 후 사용자는 현재 활성 세션으로 자연스럽게 진입한다.

---

## 9. 기존 기획에서 명시적으로 폐기/수정할 가정

다음은 더 이상 제품 기획의 기본 전제가 아니다.

1. `Host preparing`이 DM의 주요 독립 화면이어야 한다.
2. 플레이어들이 lobby에서 Ready가 될 때까지 DM이 기다려야 한다.
3. `플레이 시작` 버튼이 세션 활성화의 필수 gate여야 한다.
4. spatial relation data가 없으면 공격 range를 계산할 수 없으므로 공격을 막아야 한다.
5. standalone sheet roll은 sheet 내부 `VisualDiceTray` frame을 기본 presentation으로 사용해야 한다.

---

## 10. 구현 재개 전 필요한 UI 기획

다음 항목을 화면 단위로 확정한 뒤 구현을 다시 시작한다.

1. App 시작 화면 / 주요 navigation
2. Character Library
3. SimpleVTT Character Sheet
4. Official-style Character Sheet
5. Session 열기 / 참가하기 진입 화면
6. DM session workspace — player 0명 / player 합류 중 / live 상태
7. Player session workspace — 최초 join / reconnect
8. Freeform intent interaction
9. Initiative/combat interaction
10. DM Combatant/Encounter 편집
11. DM handout/image interaction
12. Activity/Undo를 언제 어떻게 노출할지
13. Settings / appearance / accessibility
14. 오류/연결 실패/복구 상태

각 화면은 구현 전에 최소한 다음을 정의한다.
- 화면 목적
- 사용자가 보는 정보
- primary action
- secondary action
- 숨겨야 할 내부 정보
- 상태 전이
- empty/loading/error state
- keyboard/responsive behavior
- human acceptance scenario

---

## 현재 결정 상태

이 문서는 UI-first 재기획의 시작점이다. 위에 명시된 원칙은 현재 제품 방향 결정으로 기록하되, 전체 V0.9 화면별 상세 기획이 끝날 때까지 구현 완료를 선언하지 않는다.

PR #109는 계속 draft/unmerged 상태로 유지한다.
