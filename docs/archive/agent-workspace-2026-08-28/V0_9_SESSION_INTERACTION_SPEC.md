# SimpleVTT V0.9 Session Interaction Specification

## 0. 목적

이 문서는 `V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`와 `V0_9_COMPLETE_UI_SCENE_PLAN.md`를 실제 구현 가능한 **조작 규칙**까지 구체화한다.

상위 철학은 하나다.

> **D&D 세션 중에는 SimpleVTT를 계속 켜 둔 채, Character 확인, 규칙 확인, 판정, 대화, 탐험, 전투, DM 운영을 빠르고 자연스럽게 이어갈 수 있어야 한다.**

따라서 이 문서는 화면이 존재하는지만 보지 않는다. 사용자가 몇 번 클릭해야 하는지, 도구를 열고 닫았을 때 무엇이 보존되는지, 좁은 화면에서 무엇이 접히는지, 실패했을 때 무엇을 보여 주는지까지 제품 계약으로 정의한다.

---

# 1. Interaction budget — 자주 하는 일은 가까워야 한다

## Player

세션 중 다음 행동은 **항상 한 번의 명시적 조작으로 시작할 수 있어야 한다.**

- 내 Character Quick Sheet 열기
- Full Character Sheet 열기
- Rules 검색 시작
- 현재 할 수 있는 행동 선택 시작
- 최근 판정 결과 확인

`메뉴 -> 캐릭터 -> 내 캐릭터 -> 시트`처럼 2~3단계 navigation을 요구하지 않는다.

## DM

세션 중 다음 행동은 **항상 한 번의 명시적 조작으로 시작할 수 있어야 한다.**

- acting Actor 변경
- Encounter 편집 열기
- Combatant 추가 시작
- Participants 확인
- Initiative 시작/관리
- Handout 준비
- Rules 검색
- 최근 결과/Undo 확인
- Session 공유 정보 열기

## 공통

- 현재 떠 있는 transient layer 하나를 닫는 행동은 한 번이어야 한다.
- 사용자가 `닫기`를 반복해서 눌러 Session Shell까지 빠져나가면 안 된다.
- destructive action은 예외적으로 confirmation을 요구할 수 있다.

---

# 2. S-00 Persistent Active Session Shell — 물리적 배치

Session Shell은 세션 종료/Leave 전까지 유지되는 기본 프레임이다.

## 2.1 Desktop wide layout

권장 구조:

- 상단: **Session Bar** — 약 48~56px 높이의 compact bar
- 중앙: **Main Focus Area** — 남는 화면의 대부분
- 하단: **Action Dock** — 평소 얇고, intent/detail 선택 시 확장
- 우측 또는 좌측 가장자리: **Utility Rail** — icon + tooltip 형태의 고정 접근점
- Shell 위: **Pane / Drawer / Overlay Stack**

중요한 원칙은 Main Focus가 가장 큰 면적을 가지는 것이다. Session Bar, Utility Rail, Action Dock가 각각 대형 패널이 되어 중앙을 압박하면 안 된다.

## 2.2 Session Bar

항상 표시:

- Session name
- Freeform / Initiative 상태
- Player: 자기 Character identity chip
- DM: 현재 acting Actor identity chip

조건부 표시:

- reconnecting/disconnected 등 실제 조치가 필요한 connection state
- Initiative일 때 round/current turn compact indicator

항상 숨김:

- raw host/client role
- peer ID
- protocol version
- healthy handshake/content parity 상태
- RulesProfile/internal capability

### Character / Actor identity chip

Player:
- portrait + Character name + HP compact indicator
- **chip click -> Quick Sheet**
- chip 안 또는 바로 옆의 명확한 expand affordance -> **Full Sheet**

DM:
- 현재 acting Actor portrait/name
- click -> Actor Quick View
- actor switch affordance -> DM Actor Switcher

Double-click, long-press, hover-only interaction은 핵심 기능에 사용하지 않는다.

---

# 3. Character Sheet는 Session의 1급 요소다

Player의 Character Sheet는 Utility menu 안에 숨겨진 부가 기능이 아니다.

## 3.1 Quick Sheet

### 열기

세션 화면의 Character identity chip 한 번 클릭.

### 형태

Desktop:
- 320~420px 정도의 anchored drawer/pane
- Main Focus는 뒤에서 유지

Narrow window:
- bottom sheet 또는 거의 full-height drawer

### 기본 내용

첫 화면에서 바로 보여야 하는 것:

- portrait / name / class / level
- AC
- current HP / max HP / temp HP
- Speed
- Initiative modifier
- Proficiency Bonus
- passive Perception
- 주요 사용 자원
- 현재 condition/status
- 자주 쓰는 attacks
- 자주 쓰는 spells/features의 quick access

### 직접 조작

- HP/resource/spell slot 등 기존 허용된 session-safe operation
- attack/spell/feature 선택 시작
- `전체 시트` 열기
- `SimpleVTT / 공식 시트 스타일` 표시 및 필요 시 전환

### 금지

- Character build 전체 편집 wizard로 자연스럽게 연결
- Host projection을 durable Character처럼 편집
- Quick Sheet를 또 하나의 영구 side panel로 고정

## 3.2 Full Character Sheet

### 열기

Character chip 옆의 expand action 또는 Quick Sheet의 `전체 시트`.

### 형태

Wide desktop:
- large centered workspace layer 또는 split view
- Session Bar는 가능하면 계속 보임
- Main Focus의 일부가 뒤에서 보이거나 최소한 Session identity가 유지

Medium/narrow:
- full workspace overlay
- 상단에 `세션으로 돌아가기`가 아니라 명확한 `시트 닫기` action
- 닫으면 같은 Session Shell로 복귀

### 상태 보존

Full Sheet를 여는 동안 다음은 가능한 한 보존한다.

- Freeform / Initiative mode
- current acting Actor
- 진행 중인 intent
- 선택한 action detail
- 아직 유효한 target-selection context
- Main Focus scroll position
- 열기 전 utility pane 상태

실제 game state가 바뀌어 선택이 무효가 되면 해당 선택만 취소하고 `상태가 변경되어 이전 대상 선택을 취소했습니다`처럼 domain language로 알린다.

### Sheet 내부 roll

- 별도 Sheet-local dice frame 생성 금지
- body/app-level Cinematic Dice Overlay 사용
- roll 후에도 Sheet가 같은 위치에 유지
- connected authoritative roll은 authoritative result를 사용
- standalone/local roll은 local result지만 같은 visual language 사용

### 닫기

- close button
- `Escape`는 Full Sheet가 top layer일 때 Sheet만 닫음
- 닫은 뒤 이전 Session context로 즉시 복귀

---

# 4. Utility Rail — 세션 중 도구의 고정 주소

Utility Rail은 `다른 페이지로 이동하는 nav`가 아니라 **현재 Session 위에 도구를 여는 launcher**다.

## 4.1 Player Utility Rail

고정 우선순위:

1. Character Sheet
2. Rules
3. Activity / recent results
4. Handout reopen — active reveal이 있을 때만
5. Session / connection / leave

## 4.2 DM Utility Rail

고정 우선순위:

1. Actor / Quick View
2. Rules
3. Encounter
4. Participants
5. Handout
6. Activity / Undo
7. Session share/settings

Initiative control은 상황에 따라 Session Bar 또는 Main Focus 가까이에 나타내며, 깊은 Utility menu 안에 숨기지 않는다.

## 4.3 Rail interaction

- icon에는 text tooltip과 accessible name이 있어야 한다.
- 현재 열려 있는 tool icon은 selected state를 명확히 표시한다.
- 같은 icon을 다시 누르면 해당 lightweight pane을 닫을 수 있다.
- 한 번에 여러 대형 pane을 중첩해서 화면을 압박하지 않는다.

---

# 5. Layer stack 규칙

Session 중 UI layer는 다음 우선순위를 사용한다.

1. Base Session Shell
2. anchored popover / lightweight quick view
3. utility pane / drawer
4. large workspace layer — Full Sheet 등
5. transient presentation overlay — dice/result/handout
6. blocking recovery/confirmation modal

## 5.1 Escape 규칙

`Escape`는 항상 **현재 가장 위의 닫을 수 있는 layer 하나만 닫는다.**

예:

Full Sheet 위에 Rules detail이 열려 있으면:
- 첫 Escape -> Rules detail 닫힘
- 두 번째 Escape -> Full Sheet 닫힘
- Session Shell은 유지

`Escape` 한 번으로 Session leave/end가 실행되면 안 된다.

## 5.2 Backdrop click

- non-destructive lightweight popover는 backdrop click으로 닫을 수 있다.
- Full Sheet, Handout, 중요한 multi-step action은 accidental dismissal을 막기 위해 명확한 close action을 기본으로 한다.
- destructive confirm은 backdrop click으로 확정되지 않는다.

---

# 6. Rules Lookup — 플레이를 멈추지 않는 규칙 확인

## 6.1 시작

Utility Rail의 Rules 한 번 클릭으로 검색 pane을 연다.

Action/spell/feature 이름에 `규칙 보기` affordance가 있으면 같은 Rules pane의 해당 항목을 바로 연다.

## 6.2 형태

Desktop:
- 360~480px side pane

Narrow:
- full-height drawer

## 6.3 기본 구조

- search input
- 최근 본 규칙
- 검색 결과
- 선택한 규칙 detail

### 중요한 흐름

`Attack 선택 -> Longsword detail -> 규칙 보기 -> 읽기 -> Rules 닫기 -> Longsword 선택 상태 복귀`

이 흐름에서 intent/action context를 잃지 않는다.

## 6.4 금지

- Rules route로 이동한 뒤 `플레이로 돌아가기`
- rule ID/package metadata를 primary UI로 표시
- 검색을 위해 세션 context를 초기화

---

# 7. Freeform Main Focus — 낮은 시각 밀도

Freeform은 세션에서 가장 오래 보는 화면이다.

## 7.1 기본 표시

- 현재 scene/session context
- 현재 조작 Character/Actor
- 필요하면 DM이 제공한 scene image/handout 상태 진입점
- 매우 최근의 meaningful result를 짧게
- Action Dock

## 7.2 기본 미표시

- 전체 Scene Actor board
- 전체 party/NPC card rows
- Initiative order
- Action/Bonus/Reaction/Movement economy
- 전체 spell/item/class list
- permanent Activity
- permanent Inspector

## 7.3 empty state

Player 0명인 DM Session:
- 빈 화면이 오류처럼 보이면 안 된다.
- `현재 연결된 플레이어가 없습니다`는 secondary status
- DM은 그대로 Encounter, Combatant, Handout, Rules, Initiative, Actor tools를 사용할 수 있다.

Encounter 0명:
- 정상 Freeform 상태
- DM에게만 compact `Combatant 추가` 진입점을 제공

---

# 8. Action Dock — intent-first, 필요할 때만 확장

## 8.1 Resting state

항상 거대한 action catalog를 펼치지 않는다.

Resting Action Dock은 다음 중 하나로 구성한다.

- 4~6개의 context-relevant frequent intent
- `모든 행동` launcher
- 최근/즐겨찾기 action 소수

모든 official intent는 최대 한 단계 안에서 접근 가능해야 한다.

공식 vocabulary:
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

## 8.2 Intent 선택 후

Dock이 contextual mode로 확장된다.

예:

`Attack`
- available attacks/weapons
- disabled option은 이유를 바로 표시

`Magic`
- spells/features
- filter/search 가능

`Search`
- 관련 skill/approach

### Back behavior

- contextual mode에는 항상 명확한 back/cancel affordance
- Escape는 현재 action flow 한 단계만 뒤로
- Session Shell 전체를 닫지 않음

---

# 9. Target Selection

Target이 필요한 action을 선택했을 때만 대상 UI가 등장한다.

## 9.1 기본 제품 — spatial module 없음

- otherwise-valid target을 모두 표시
- `거리 정보 없음`을 이유로 제거하지 않음
- 근접 공격을 `5 ft 내 대상 없음`으로 disable하지 않음

## 9.2 대상 표시 방식

Freeform:
- contextual target strip/list 또는 focused chooser
- 전체 Actor board를 permanent하게 펼치지 않는다.

Initiative:
- compact initiative/actor context와 target chooser를 연계할 수 있다.

## 9.3 선택 피드백

- targetable 대상은 명확하게 강조
- 선택한 대상은 selected state
- multi-target은 현재 `2/3 선택` 같은 progress
- invalid target은 click 후 무반응이 아니라 disabled reason 제공

---

# 10. Resolution / Dice feedback

## 10.1 즉시 피드백

사용자가 action을 실행하면 UI는 즉시 다음 상태 중 하나를 보여야 한다.

- 선택됨
- 판정 요청 중
- 결과 수신/결정됨
- 실패했고 복구 필요

버튼을 눌렀는데 아무 visual response가 없는 상태를 허용하지 않는다.

## 10.2 Cinematic Dice

- app/body level
- 화면 깊은 곳/뒤에서 시작
- 사용자 쪽으로 날아오며 tumble
- authoritative result로 settle
- Sheet/Rules/Utility pane을 layout shift시키지 않음

## 10.3 Result layer

짧고 명확하게:
- actor
- action
- success/failure 또는 outcome
- roll total
- damage/healing/state change

DM만 필요 시 `상세 / Undo` 진입.

Result가 사라져도 U-04 Activity에서 최근 결과를 다시 볼 수 있다.

---

# 11. DM-specific continuous workflow

## 11.1 Actor switching

DM Actor Switcher는 항상 한 번의 action으로 열 수 있다.

- 최근/현재 Encounter actor
- 검색 또는 compact list
- 선택 시 Main Focus/Action Dock가 해당 actor context로 변경

전체 NPC card wall을 항상 표시하지 않는다.

## 11.2 Encounter editing

Encounter Editor는 Session 중 언제든 열 수 있다.

편집 가능 여부는 `preparing/live` 같은 lifecycle label보다 **해당 operation의 안전성**으로 판단한다.

예:
- 새 Combatant 추가: 일반적으로 Freeform에서 허용
- Initiative 중 actor 제거: 현재 turn/ledger 안전성을 확인하고 필요한 guard 제공
- 단순 metadata edit: mechanics 영향이 없다면 허용 가능

## 11.3 Participants

- name / Character
- connected/reconnecting/disconnected
- 필요한 최소 sync warning

Ready checkbox 없음.

## 11.4 Handout

- Utility Rail -> Handout 한 번 클릭
- local preview
- reveal
- withdraw

Handout preparation 중에도 Main Session context는 유지된다.

## 11.5 Activity / Undo

- 최근 user-readable outcome이 먼저
- Undo 가능한 event만 명확한 action 제공
- raw ResolutionEvent payload는 advanced detail

---

# 12. Player-specific continuous workflow

## 12.1 Character reference

세션 중 Player가 가장 자주 찾는 것은 자기 Character다.

따라서 다음 정보는 Quick Sheet에서 빠르게 접근한다.

- AC / HP
- ability/save/skill
- attacks
- spell slots
- spell list
- features
- resources
- inventory 핵심 항목

Full Sheet를 열기 전에도 정상적인 한 턴/한 판정을 수행하는 데 필요한 정보는 Quick Sheet에서 대부분 찾을 수 있어야 한다.

## 12.2 Turn start

Player turn이 되면:
- 과도한 modal을 띄우지 않는다.
- Session Bar/Initiative 영역에서 current turn을 명확하게 강조
- Action Dock가 해당 Character context를 유지

## 12.3 Reconnect

- Shell 유지 가능한 경우 그대로 유지
- reconnect indicator는 작고 명확하게
- authoritative state가 복원되면 현재 context에 합류
- Character 재선택 / Ready / Play Start를 다시 요구하지 않음

---

# 13. Keyboard / focus / pointer contract

## 13.1 Focus

- tool pane을 열면 logical heading/search/first actionable element로 focus 이동
- 닫으면 launcher로 focus 복귀
- modal/large overlay는 focus trap을 사용하되 Session Shell을 잃지 않음

## 13.2 Escape

- top layer 하나 닫기
- action flow 중이면 현재 step 취소/back
- Session end/leave는 실행하지 않음

## 13.3 Hover

핵심 정보/기능을 hover에만 숨기지 않는다.

Tooltip은 보조 설명용이다.

## 13.4 Target size

주요 interactive target은 가능한 한 최소 약 40~44px의 클릭/터치 영역을 확보한다.

작은 icon만 사용하는 경우 visible focus/tooltip/accessible label을 필수로 한다.

## 13.5 Shortcut

키보드 shortcut은 discoverable한 보조 기능으로만 사용한다.

초기 후보:
- `Shift+S`: Quick Sheet toggle
- `Shift+R`: Rules pane toggle
- `Escape`: top layer close/back

단, text input에 focus가 있을 때는 global shortcut을 가로채지 않는다. 최종 binding은 구현 시 OS/app conflict를 확인한다.

---

# 14. Responsive contract

## 14.1 Wide desktop

- Utility Rail 고정
- Quick Sheet/Rules/Activity는 side pane
- Full Sheet는 split 또는 large overlay
- Action Dock horizontal

## 14.2 Medium / narrow desktop

- Utility Rail은 compact icon rail 또는 bottom utility strip
- side pane은 overlay drawer로 전환
- Main Focus를 최소 usable width 이하로 압축하지 않음
- Action Dock는 2-row 또는 horizontally scrollable compact layout 가능

## 14.3 Very narrow window

- Session Bar compact
- Quick Sheet / Rules는 full-height drawer
- Full Sheet는 full workspace overlay
- 반드시 항상 보이는 close/back control
- 중요한 primary action이 viewport 밖에 고립되지 않음

### 공통

window resize로 tool이 pane -> overlay로 바뀌어도 현재 선택/검색/scroll context를 가능한 한 유지한다.

---

# 15. Feedback language

사용자에게는 domain language를 쓴다.

좋음:
- `현재 사용할 수 없는 주문입니다 — 주문 슬롯이 없습니다.`
- `대상을 선택하세요.`
- `연결이 끊어졌습니다. 다시 연결하는 중…`
- `상태가 변경되어 이전 대상 선택을 취소했습니다.`

피함:
- `ActionVm unavailable`
- `SessionProjection mismatch`
- `ResolutionEvent rejected`
- `manifest incompatible`

기술 detail은 advanced diagnostics에만 둔다.

---

# 16. 상태 보존 규칙

Tool open/close는 game state transition이 아니다.

보존 대상:
- current mode
- current actor
- intent/detail flow
- valid target selection
- Main Focus scroll
- Quick/Full Sheet tab/page
- Rules query/detail
- Activity position
- active Handout state

다음 경우에만 해당 UI selection을 폐기할 수 있다.

- authoritative game state가 실제로 바뀌어 selection이 invalid
- actor/Character가 제거됨
- action/resource가 더 이상 legal하지 않음
- Session 종료

폐기 시 이유를 보여준다.

---

# 17. Loading / latency contract

- 150ms 미만의 빠른 local transition에는 불필요한 spinner를 남발하지 않는다.
- 눈에 띄는 지연이 생기면 action 위치에서 pending state를 표시한다.
- pending 동안 동일 destructive/network action의 중복 실행을 막는다.
- 전체 앱 loading screen으로 Session Shell을 덮는 것은 정말 전체 context를 사용할 수 없는 경우에만 한다.

---

# 18. Human usability acceptance scenarios

아래는 자동 테스트만으로 완료 처리하지 않는다. 실제 Windows build에서 손으로 확인한다.

## Scenario A — 대화 중 Character 확인

1. Freeform 유지
2. Character chip 클릭
3. Quick Sheet 즉시 표시
4. AC/HP/spell slot 확인
5. Quick Sheet 닫기
6. 이전 Freeform 위치/context 그대로

합격 기준: route 전환 없음, 1-click open, 1-action close.

## Scenario B — Full Sheet roll

1. Freeform에서 Full Sheet open
2. ability/save/attack roll
3. body-level cinematic dice
4. Sheet layout shift 없음
5. Sheet close
6. Session Shell의 이전 context 복귀

## Scenario C — 주문 규칙 확인 후 행동 계속

1. Magic 선택
2. spell 선택
3. `규칙 보기`
4. Rules pane에서 설명 확인
5. Rules 닫기
6. 같은 spell/action context 유지
7. target 선택/resolve

## Scenario D — DM이 대화 중 Combatant 추가

1. Player와 Freeform 진행 중
2. Encounter 열기
3. Combatant Picker
4. Combatant 추가
5. Encounter 닫기
6. Freeform 그대로 유지

별도 Host Preparing 이동 금지.

## Scenario E — Initiative 전환

1. Freeform
2. DM Initiative 시작
3. 같은 Shell에 order/economy 추가
4. 정상 combat 진행
5. Initiative 종료
6. 같은 Shell이 low-noise Freeform으로 복귀

## Scenario F — Rules / Sheet 왕복

1. Quick Sheet open
2. Full Sheet open
3. Rules open
4. Rules close
5. Full Sheet close
6. Freeform 복귀

각 단계에서 의미 없는 `플레이로 돌아가기` route transition이 없어야 한다.

## Scenario G — Reconnect

1. Player active session
2. 연결 일시 중단
3. reconnect indicator
4. Shell/context 유지
5. reconnect 성공
6. 현재 authoritative session state로 복귀

Lobby/Ready/Start 없음.

## Scenario H — DM player 0명

1. 세션 열기
2. 즉시 DM Session Shell
3. Encounter 편집
4. Handout 준비
5. Rules 확인
6. Initiative 선택 가능

Player를 기다리는 gate 없음.

## Scenario I — spatial module 없음

1. melee Attack 선택
2. hostile target 존재
3. 별도 distance fact 없음
4. target이 정상 표시
5. `5 ft 대상 없음`으로 막히지 않음

## Scenario J — 좁은 Windows viewport

1. Session Shell을 작은 창으로 줄임
2. Quick Sheet 열기/닫기
3. Rules 열기/닫기
4. Action 선택
5. target 선택
6. Full Sheet 열기/닫기

primary controls와 close action이 viewport 밖으로 사라지지 않아야 한다.

---

# 19. 명시적 anti-patterns

다음 구현은 이 명세를 위반한다.

- 세션 중 Sheet를 보기 위해 Character route로 이동
- 세션 중 Rules를 보기 위해 Rules route로 이동
- `플레이로 돌아가기`가 정상 workflow의 반복 동작
- Character Sheet를 2개 이상의 menu depth 안에 숨김
- Quick Sheet가 화면을 항상 점유하는 permanent panel
- Freeform에 전체 Scene Actor board 상시 표시
- Freeform에 action economy 상시 표시
- Freeform에 full category hotbar 상시 표시
- tool open/close 시 current actor/intent를 무조건 reset
- hover-only critical controls
- click 후 무반응인 disabled action
- `distance unknown`을 `out of range`로 처리
- Sheet 안에 별도 dice stage를 생성
- reconnect 시 Lobby/Ready로 복귀

---

# 20. 구현 slice 순서

이 interaction contract를 기준으로 source 구현은 다음 순서로 나눈다.

1. Persistent Session Shell frame + layer host
2. Session Bar + Player Character / DM Actor identity control
3. Quick Sheet 1-click access
4. Full Sheet in-session layer + state preservation
5. Utility Rail + Rules pane + Activity drawer
6. Low-noise Freeform Main Focus
7. Intent-first Action Dock
8. Detail / Target flow
9. Cinematic Dice / Result feedback
10. DM Encounter / Actor / Participant / Session tools
11. Player session utilities / reconnect
12. Initiative expansion
13. Handout workflow
14. Responsive + keyboard/focus pass
15. Windows human usability acceptance scenarios A~J

각 slice는 다음 slice로 넘어가기 전에 실제 interaction contract를 충족하는지 확인한다.
