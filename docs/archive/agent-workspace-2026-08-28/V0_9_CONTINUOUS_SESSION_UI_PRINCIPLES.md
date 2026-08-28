# SimpleVTT V0.9 Continuous Session UI Principles

## 문서 목적

SimpleVTT의 핵심 제품 철학을 다음 한 문장으로 고정한다.

> **D&D 세션이 시작된 뒤에는 이 앱을 계속 켜 둔 채, 대화·탐험·판정·전투·규칙 확인·Character 확인·DM 운영을 끊김 없이 이어갈 수 있어야 한다.**

SimpleVTT는 세션을 준비하는 관리 도구와 플레이 중 사용하는 전투 콘솔을 따로 제공하는 제품이 아니다. 세션 전체를 함께 따라가는 **상시 tabletop companion**이다.

이 원칙은 기존 UI-first product plan과 play surface inventory를 해석하는 상위 UX 계약이다. 아래 원칙과 충돌하는 기존 route/lifecycle/HUD 구성은 구현 참고 자료일 뿐 최종 제품 기준이 아니다.

---

# 1. Session Mode가 앱의 중심이다

## 핵심 결정

세션이 활성화된 동안 `플레이`는 여러 메뉴 중 하나가 아니다.

**앱 전체가 Active Session Mode가 된다.**

세션을 나가거나 DM이 세션을 종료하기 전까지 사용자는 하나의 Session Play Shell 안에 머문다.

### Session Mode 안에서 여는 도구

공용:
- Character / Actor quick view
- full Character Sheet
- Rules lookup
- recent results / Activity
- connection state

DM 추가:
- Encounter
- Combatant library
- Participants
- Initiative controls
- Handout
- Session share/settings
- Undo / adjudication

Player 추가:
- My Character
- spells/items/features quick lookup
- leave/reconnect

이 기능들은 정상적인 세션 플레이 중 **Session Play Shell을 대체하는 별도 앱 route로 이동시키지 않는다.**

Drawer, popover, split pane, focused overlay, full-screen sheet layer처럼 Session Shell 위에서 연다.

---

# 2. 정상 플레이 중 route 전환을 최소화한다

## 금지되는 기본 패턴

`Play -> Rules page -> Play로 돌아가기`

`Play -> Character page -> Play로 돌아가기`

`Play -> Encounter page -> Play로 돌아가기`

`Play -> Activity page -> Play로 돌아가기`

위와 같은 왕복이 정상적인 세션 작업 흐름이면 UI 설계 실패로 간주한다.

### 이유

실제 D&D 세션에서는:
- 대화 중 규칙을 확인하고,
- 공격 직전에 주문을 다시 읽고,
- DM이 NPC를 하나 추가하고,
- 결과를 다시 확인하고,
- 바로 대화로 돌아가는 일이 반복된다.

이때 매번 플레이 페이지를 벗어나면 사용자의 실제 테이블 흐름이 끊긴다.

---

# 3. Session Shell은 정상 플레이 중 유지되어야 한다

다음 동작은 Session Shell을 unmount하거나 플레이 맥락을 초기화하면 안 된다.

- Rules 열기/닫기
- Character Sheet 열기/닫기
- Encounter 편집
- Combatant 추가
- Participant 확인
- Activity/Undo 확인
- Handout 준비
- Settings 중 세션에 직접 필요한 항목 확인
- reconnect transient state

가능하면 다음 상태도 보존한다.

- DM이 선택한 acting actor
- 현재 Freeform / Initiative mode
- 진행 중인 intent/detail 선택
- 현재 target selection context
- 현재 handout reveal
- drawer를 열기 전의 플레이 위치

단, 다른 도구를 여는 동안 실제 game state가 변경되어 기존 선택이 무효가 되면 사용자에게 이유를 알려주고 안전하게 해당 선택만 취소한다.

---

# 4. Freeform은 가장 오래 머무르는 기본 상태다

실제 세션 시간의 대부분은 항상 전투 HUD를 조작하는 시간이 아니다.

따라서 Active Session의 기본 화면은 **조용한 Freeform 상태**다.

### 항상 필요한 최소 정보

- 세션/장면 이름
- 연결 상태가 실제로 문제가 있을 때의 indicator
- 현재 자신이 조작하는 Character/Actor identity
- 즉시 사용할 수 있는 주요 intent
- DM/Player별 session utility 진입점

### 기본적으로 크게 점유하지 않는 정보

- 전체 Scene Actor 목록
- 전체 Initiative order
- action economy
- 모든 spell/item/class action 목록
- permanent Activity
- permanent Inspector
- permanent Encounter editor

이 정보들은 필요해지는 순간에 확장한다.

---

# 5. 대상/Actor 목록은 context-driven이어야 한다

모든 NPC와 Player card를 항상 화면 중앙에 펼쳐 놓는 것을 기본으로 하지 않는다.

### 대상 목록이 나타나는 순간

- Attack/Magic/Help 등 target이 필요한 행동을 선택했을 때
- DM이 acting NPC/Combatant를 바꾸려고 할 때
- Initiative order에서 특정 actor를 볼 때
- Participant/Encounter drawer를 직접 열었을 때

그 외 Freeform에서는 세션의 사람/괴물 목록보다 **대화와 현재 행동이 중심**이어야 한다.

---

# 6. 행동 UI는 HUD보다 intent 중심이다

Freeform의 기본 행동 영역은 `공통 / 클래스 / 주문 / 아이템 / 패시브 / 커스텀`을 상시 탐색하는 게임 hotbar가 아니다.

먼저 사용자의 의도를 보여준다.

- Attack
- Dash
- Disengage
- Dodge
- Help
- Hide
- Influence
- Magic
- Ready
- Search
- Study
- Utilize

그 뒤 필요한 경우에만:

`Intent -> weapon/spell/item/skill -> target -> resolution`

으로 좁힌다.

### 빠른 접근 예외

세션에서 매우 자주 쓰는 Character-specific action은 compact favorite/recent quick action으로 제공할 수 있다.

그러나 이것도 intent flow를 대체하는 대형 permanent HUD가 되어서는 안 된다.

---

# 7. Initiative는 Session Shell의 변형이다

Initiative 시작 시 다른 페이지로 이동하지 않는다.

기존 Freeform shell에 다음 정보만 추가한다.

- round
- current turn
- compact initiative order
- 현재 actor의 action/bonus/reaction/movement economy
- turn end / next turn
- 필요한 target/status summary

Initiative 종료 시 같은 Session Shell이 조용한 Freeform 상태로 돌아온다.

세션 자체는 계속 유지된다.

---

# 8. Character Sheet는 세션을 떠나지 않고 열 수 있어야 한다

Player가 자기 full Character Sheet를 보고 싶을 때 `scene -> character route`로 이동하는 방식은 기본 세션 UX가 아니다.

### 세션 내 Sheet

- Quick Sheet: 작은 drawer/popover
- Full Sheet: Session Shell 위의 large overlay 또는 split/full workspace layer
- Official-style / SimpleVTT layout 전환 가능
- 닫으면 정확히 이전 플레이 위치로 돌아온다.
- 시트에서 roll을 하면 body-level cinematic dice가 Session Shell 위에 나타난다.

Standalone physical-table Sheet는 세션 밖에서도 독립 route로 사용할 수 있다.

즉 **같은 Sheet가 standalone mode와 in-session layer 두 환경에서 사용**될 수 있어야 한다.

---

# 9. Rules Lookup은 핵심 세션 도구다

D&D 플레이 중 rules/spell/item/condition 확인은 예외 상황이 아니라 반복되는 정상 흐름이다.

따라서 Rules Catalog를 세션 밖의 별도 관리 페이지로만 취급하면 안 된다.

### Session Rules Drawer

- 즉시 검색
- spell / condition / action / item 등 category filter
- 결과 선택 시 concise detail
- 필요할 때 full detail
- 닫으면 진행 중이던 Session context로 즉시 복귀

DM과 Player 모두 사용할 수 있다.

설치 콘텐츠 관리/import는 별도의 Content 관리 화면에 남아도 되지만, **읽기용 Rules lookup은 Session Mode 안에 있어야 한다.**

---

# 10. DM은 한 화면에서 세션을 계속 운영한다

DM이 세션을 연 순간부터 Active DM Session Shell을 유지한다.

### 한두 번의 입력으로 접근 가능해야 하는 DM 작업

- acting actor 변경
- Combatant 추가/제거
- Encounter 확인
- Initiative 시작/종료/진행
- image handout reveal/withdraw
- Participants 확인
- Rules 확인
- 최근 authoritative result / Undo
- Session 주소 공유

`Host preparing`이나 `Combatants page`로 이동해야만 가능한 정상 운영 기능을 만들지 않는다.

### Encounter 편집

세션 lifecycle이 `preparing`인지 여부로 정상 편집 기능을 막지 않는다.

- Player 0명: 편집 가능
- Freeform 중: 편집 가능
- Player 합류 중: 편집 가능
- Initiative 중: 안전하지 않은 변경만 개별적으로 제한

즉 **Session state가 아니라 실제 operation의 안전성**이 제약 기준이다.

---

# 11. Player도 세션 안에서 필요한 것을 모두 확인한다

Player는 세션을 떠나지 않고 다음을 수행할 수 있어야 한다.

- 자기 Character quick/full Sheet 보기
- spell/item/feature detail 보기
- Rules 검색
- intent/action 수행
- target 선택
- 최근 자기 result 확인
- active handout reopen
- reconnect 상태 확인

Character edit/level-up처럼 실제 세션 중 변경하면 안 되는 작업은 별도 관리 흐름으로 남을 수 있다.

---

# 12. Transient interaction은 background layout을 바꾸지 않는다

다음은 모두 Session Shell 위 transient layer다.

- cinematic dice
- roll/result notice
- target choice
- handout viewer
- reconnect/status
- recoverable error

특히 dice는:
- 별도 frame/window를 만들지 않고
- 화면 깊은 곳에서 사용자 쪽으로 날아오며
- 결과를 보여준 뒤 사라지고
- 플레이 화면의 크기/배치를 밀지 않는다.

---

# 13. 장시간 사용을 위한 시각 원칙

세션은 수 시간 지속될 수 있다.

따라서 UI는 짧은 데모에서 화려해 보이는 것보다 오래 켜두었을 때 피로가 적어야 한다.

- Freeform의 기본 화면 밀도는 낮게 유지
- 연결 정상/건강 상태는 시끄럽게 표시하지 않음
- 반복 animation은 최소화
- 위험/실패/현재 turn 같은 실제 attention signal만 강하게 표시
- 주요 행동은 작은 viewport에서도 scroll 끝까지 내려가지 않고 접근 가능
- 키보드 focus와 Escape 닫기 일관성 유지
- drawer/overlay를 닫았을 때 focus를 호출한 control로 복원

---

# 14. 실제 현재 UI 재점검 결과

현재 production 구현에서 이 철학과 충돌하는 대표 사항:

1. **Route-centric app shell**
   - Home / Characters / Session / Content / Rules / Settings로 workspace 자체를 교체한다.
   - live session일 때 `플레이로 돌아가기` 버튼을 제공한다.
   - 이는 Play가 persistent mode가 아니라 여러 route 중 하나라는 구조다.

2. **Permanent Scene Actor stage**
   - NPC/Combatant 상단 row, Player/Party 하단 row를 항상 크게 표시한다.
   - Freeform에서도 entity board가 화면 중심이 된다.

3. **Permanent game hotbar**
   - `공통 / 클래스 / 주문 / 아이템 / 패시브 / 커스텀` tab과 action icon grid가 상시 표시된다.
   - tabletop companion보다 video-game combat HUD에 가까워진다.

4. **Freeform action economy noise**
   - Initiative가 아닌 상태에서도 행동/보너스/반응/이동을 `FREE`로 계속 표시한다.
   - Freeform에서는 없어도 되는 정보다.

5. **Encounter editing lifecycle gate**
   - 현재 구현은 DM Encounter 편집을 offline/preparing 및 non-combat 조건에 묶는다.
   - 이미 활성 세션을 계속 운영한다는 제품 철학과 맞지 않는다.

6. **Character Sheet / Rules가 route 단위**
   - live play 도중 확인하려면 플레이 화면을 벗어나는 구조다.
   - 정상적인 tabletop reference workflow를 끊는다.

이 항목들은 이후 UI 구현 slice에서 새 철학에 맞게 재설계한다.

---

# 15. C-01 Active Session Play Shell에 요구되는 구조

다음 세부 설계의 출발점은 아래다.

### Persistent session bar
- session/scene name
- Freeform / Initiative
- current turn only when relevant
- connection attention indicator only when needed

### Main focus area
- narrative/freeform 중심의 낮은 밀도
- 현재 intent/detail/result context
- target list는 필요할 때만

### Compact action dock
- intent-first actions
- recent/favorite quick actions는 optional

### Session utility rail
공용:
- Sheet
- Rules
- Activity

DM:
- Encounter
- Participants
- Handout
- Session

Player:
- My Character
- active handout reopen
- Leave

### Overlay stack
- target
- dice
- result
- handout
- reconnect/error

이 구조를 먼저 확정한 뒤 C-02 Freeform Workspace로 넘어간다.

---

# 16. Acceptance 질문

향후 각 UI slice는 최소한 다음 질문에 답해야 한다.

1. 실제 D&D 세션 중 이 작업 때문에 Play Shell을 벗어나야 하는가?
   - 정상 작업이면 답은 `아니오`여야 한다.
2. Player/DM이 대화 중에도 화면을 계속 켜두기 편한가?
3. 지금 필요하지 않은 combat/system 정보가 화면을 점유하는가?
4. Rules/Sheet/Encounter/Activity를 확인한 뒤 이전 플레이 맥락으로 즉시 돌아오는가?
5. Player가 들어오거나 나가도 DM의 현재 작업이 리셋되지 않는가?
6. Freeform -> Initiative -> Freeform 전환이 같은 Session Shell에서 이루어지는가?
7. optional module이 없다는 이유로 기본 플레이가 막히는가?
8. dice/result/handout 같은 transient interaction이 화면 구조를 밀어내는가?

이 질문을 통과하지 못하면 component/CI가 green이어도 해당 UI slice를 완료 처리하지 않는다.
