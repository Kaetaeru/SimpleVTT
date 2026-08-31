# SimpleVTT V0.9 Complete UI Scene Plan

## 0. 문서 목적

이 문서는 V0.9의 **전체 사용자 UI 씬**을 한 번에 정의한다.

상위 제품 철학은 다음과 같다.

> **D&D 세션이 시작된 뒤에는 SimpleVTT를 계속 켜 둔 채 대화, 탐험, 판정, 전투, 규칙 확인, Character 확인, DM 운영을 끊김 없이 이어갈 수 있어야 한다.**

따라서 UI는 `페이지를 자주 이동하는 앱`이 아니라 두 개의 큰 제품 모드로 설계한다.

1. **Library Mode** — 세션 밖에서 Character, 콘텐츠, 규칙, 설정을 준비하거나 독립 Character Sheet를 사용한다.
2. **Session Mode** — 세션이 활성화된 동안 하나의 persistent Session Shell 안에서 거의 모든 작업을 수행한다.

Session Mode에서는 Rules, Character Sheet, Encounter, Participants, Activity, Handout 같은 기능을 정상적인 route 전환으로 열지 않는다. Drawer, pane, overlay, split workspace 등으로 현재 플레이 맥락 위에 연다.

이 문서에서 `Scene`은 반드시 React route를 뜻하지 않는다. 사용자가 인지하는 하나의 UI 상태/작업 공간을 의미한다.

---

# 1. 전체 모드 구조

## Mode A — Library Mode

세션이 활성화되지 않은 상태다.

사용자는 여기에서:
- Character를 선택/생성/편집한다.
- Character Sheet를 독립적인 physical-table tool로 사용한다.
- 새 Session을 열거나 기존 Session에 참가한다.
- 콘텐츠/애드온을 관리한다.
- 규칙을 탐색한다.
- 앱 설정을 변경한다.

## Mode B — Active Session Mode

DM이 Session을 열었거나 Player가 Session에 합류한 상태다.

핵심 규칙:
- Session Shell은 Session 종료/Leave 전까지 유지된다.
- Freeform이 기본 상태다.
- Initiative는 같은 Shell의 확장 상태다.
- Rules/Sheet/Encounter/Activity 등의 도구를 열어도 play context는 유지된다.
- 연결 재시도 중에도 가능한 범위에서 Shell과 현재 context를 유지한다.

---

# 2. 전체 씬 인벤토리

| ID | Scene | Mode | 대상 | 형태 |
|---|---|---|---|---|
| L-01 | Home / Launch | Library | 공용 | route-level |
| L-02 | Character Library | Library | Player/owner | route-level |
| L-03 | Character Create / Edit | Library | Player/owner | route-level |
| L-04 | Standalone Character Sheet | Library | Player/owner | route-level |
| L-05 | Content / Add-on Management | Library | 공용 | route-level |
| L-06 | Rules Library | Library | 공용 | route-level |
| L-07 | Settings | Library | 공용 | route-level |
| E-01 | Session Entry | Library | 공용 | route-level |
| E-02 | Open Session | Library → Session | DM | panel/state |
| E-03 | Join Session | Library → Session | Player | panel/state |
| S-00 | Persistent Active Session Shell | Session | 공용 | persistent shell |
| S-01 | Freeform Baseline | Session | 공용 | shell state |
| S-02 | Intent Choice | Session | 공용 | contextual state |
| S-03 | Action Detail Choice | Session | 공용 | contextual state |
| S-04 | Target Selection | Session | 공용 | contextual layer |
| S-05 | Resolution Result | Session | 공용 | transient layer |
| S-06 | Initiative / Combat Expansion | Session | 공용 | shell state |
| U-01 | Character Quick View | Session | 공용 | popover/drawer |
| U-02 | Full Character Sheet | Session | Player 중심 | large overlay/split |
| U-03 | Rules Lookup | Session | 공용 | side pane |
| U-04 | Activity / Result History | Session | 공용/DM 강화 | drawer |
| U-05 | Connection / Recovery | Session | 공용 | transient layer |
| U-06 | Cinematic Dice | Session/Library | 공용 | body overlay |
| U-07 | Handout Viewer | Session | 공용 | overlay |
| D-01 | Session Share / Settings | Session | DM | drawer |
| D-02 | Participants | Session | DM | drawer |
| D-03 | Encounter Editor | Session | DM | drawer/split pane |
| D-04 | Combatant Picker | Session | DM | nested pane/modal |
| D-05 | DM Actor Switcher | Session | DM | compact control |
| D-06 | Initiative Controls | Session | DM | contextual controls |
| D-07 | Handout Control | Session | DM | drawer/modal |
| D-08 | Adjudication / Undo | Session | DM | drawer/detail |
| P-01 | My Character Session Tools | Session | Player | utility group |
| P-02 | Leave / Reconnect Choice | Session | Player | modal/layer |
| X-01 | End Session Confirmation | Session | DM | confirmation modal |
| X-02 | Session Ended / Return | Session → Library | 공용 | transition state |

---

# 3. Library Mode 씬

## L-01. Home / Launch

### 목적
앱을 켰을 때 사용자가 다음 행동을 즉시 선택한다.

### Primary actions
- `내 캐릭터`
- `세션 열기 / 참가하기`
- 최근 사용 Character가 있으면 `시트 열기`

### Secondary actions
- 콘텐츠
- 규칙
- 설정

### 보여주지 않는 것
- active session이 없는데 Initiative/Freeform 상태
- raw role
- protocol/debug 상태

### 세션 연속성 규칙
active Session이 존재하는 동안에는 이 Home으로 일반 navigation하지 않는다. Session Mode가 우선한다.

---

## L-02. Character Library

### 목적
저장된 Character를 정확히 선택한다.

### 구성
- Character card grid/list
- portrait
- name / class / level / species
- compact HP/AC
- 새 Character
- import

### 핵심 계약
- 카드 선택은 반드시 해당 card의 canonical Character id를 active Character로 만든다.
- 다른 card를 눌러도 기존 active Character가 열리는 동작은 금지한다.
- `SimpleVTT 시트 / 공식 시트 스타일` preference는 쉽게 찾을 수 있어야 한다.

### Session 중 접근
Session Mode에서는 이 전체 Library route를 열지 않는다. Player는 자기 Character Sheet를 U-01/U-02로 열고, Join 전에만 L-02에서 Character를 선택한다.

---

## L-03. Character Create / Edit

### 목적
Character를 생성하거나 소유 Character를 편집한다.

### 구조
- step-based builder
- 현재 단계
- validation
- preview
- save/complete

### 세션 중 원칙
세션 도중 Character의 durable build를 광범위하게 편집하는 것은 기본 flow가 아니다. 세션 중에는 Sheet/resource operation을 우선하고, full build edit가 필요하면 명확한 이탈/저장 semantics를 제공한다.

---

## L-04. Standalone Character Sheet

### 목적
실제 테이블에서 VTT Session 없이 digital Character Sheet 하나만 켜고 플레이한다.

### 지원
- ability/save/skill
- Initiative
- attack/damage
- common dice
- HP/resources/spell slots/Hit Dice
- portrait
- SimpleVTT / Official layout

### Dice
sheet 내부 dice frame을 만들지 않는다. U-06과 동일한 body-level cinematic dice를 사용한다.

---

## L-05. Content / Add-on Management

### 목적
RuleModule/설치 콘텐츠를 Session 밖에서 관리한다.

### 구조
- 설치된 콘텐츠
- import/install
- validation
- activate/remove

### Session 중 원칙
Session 중 정상 콘텐츠 parity는 자동 처리한다. 일반 Session 플레이에서 사용자를 이 route로 강제 이동시키지 않는다.

---

## L-06. Rules Library

### 목적
전체 규칙을 깊게 탐색한다.

### 구조
- search
- category
- rule detail
- source/provenance는 secondary

### Session 중 차이
Session Mode에서는 같은 rules authority를 U-03 quick lookup으로 사용한다. `Play → Rules route → Play로 돌아가기`를 정상 flow로 사용하지 않는다.

---

## L-07. Settings

### 목적
appearance/accessibility/general product preferences를 관리한다.

### Session 중
세션에 직접 필요한 일부 setting은 Session Shell에서 contextual setting으로 열 수 있다. 전체 설정 route는 일반 Session 작업의 필수 경로가 아니다.

---

# 4. Session 진입 씬

## E-01. Session Entry

### 목적
한 화면에서 `세션 열기`와 `세션 참가`를 선택한다.

### 두 영역
DM:
- Session name
- bind/listen option
- `세션 열기`

Player:
- saved Character selector
- Host address/port
- `참가하기`

### 금지
- Host Preparing를 별도 장시간 화면으로 만드는 것
- Player Lobby
- Ready gate

---

## E-02. Open Session — DM

### 전이
`세션 열기` 성공 즉시 S-00/S-01로 전환한다.

### 의미
Session은 이미 활성화된 상태다.

Player 0명은 정상 상태다.

DM은 즉시:
- Encounter 편집
- Combatant 추가
- Freeform 진행
- Handout 준비
- Initiative 시작
- Session 정보 공유

를 할 수 있다.

---

## E-03. Join Session — Player

### 전이
`참가하기` → 짧은 connection/content sync → 현재 S-00 state 합류

### sync 표현
필요한 경우:
- 연결 중
- 세션 콘텐츠 동기화 중
- Character 동기화 중

### 금지
- Ready
- Lobby
- DM이 Play Start를 누를 때까지 대기

---

# 5. S-00 Persistent Active Session Shell

이 씬이 제품의 중심이다.

## 목적
D&D Session이 진행되는 동안 사용자가 계속 머무르는 하나의 persistent workspace다.

## Layout Region A — Session Bar

최상단 또는 상단 compact strip.

항상/조건부 표시:
- Session name
- Freeform / Initiative
- 연결 문제 발생 시 connection state
- DM이면 share/session utility 진입
- Player이면 leave/reconnect utility

정상 연결 상태를 큰 배지로 계속 강조하지 않는다.

## Layout Region B — Main Focus Area

가장 큰 중앙 영역.

Freeform에서는 매우 조용하다.

기본 표시:
- 현재 조작 Character/Actor identity
- 필요 시 짧은 scene/session context
- 현재 진행 중 interaction

Actor 전체 목록이나 action 전체 목록을 상시 펼치지 않는다.

## Layout Region C — Intent Dock

화면 하단 compact action area.

기본:
- Attack
- Magic
- Help
- Hide
- Search
- Study
- Influence
- Utilize
- More/other official actions

상황에 따라 recent/favorite Character action 1~몇 개를 추가할 수 있다.

`공통/클래스/주문/아이템/패시브/커스텀` 대형 permanent tab HUD는 사용하지 않는다.

## Layout Region D — Utility Rail

Session 중 자주 여는 도구의 진입점.

공용:
- Character/Actor
- Rules
- Activity

DM 추가:
- Encounter
- Participants
- Handout
- Session

Player 추가:
- My Character 중심

Utility를 누르면 route 이동 대신 pane/drawer가 열린다.

## Layout Region E — Overlay Stack

가장 위에 순간적으로 나타나는 layer:
- Dice
- Resolution
- Target choice
- Handout
- reconnect/error
- confirmation

## Context preservation
다음 tool을 열고 닫아도 유지:
- selected acting actor
- Freeform/Initiative
- 현재 play scroll/position
- 가능한 경우 intent/detail/target context
- current handout state

게임 상태 변화로 선택이 무효화되면 해당 선택만 취소하고 이유를 알려준다.

---

# 6. S-01 Freeform Baseline

## 목적
D&D Session에서 가장 오래 머무르는 기본 상태.

대화/탐험/조사/일반 판정을 지원한다.

## 화면 밀도
낮아야 한다.

### 보이는 것
- 현재 actor/Character compact identity
- Intent Dock
- session utilities
- 필요할 때 최근 결과 1건 정도

### 기본적으로 숨기는 것
- Initiative order
- action/bonus/reaction/movement economy
- 모든 NPC/Player card
- 모든 spell/item/class action
- Activity history
- Encounter editor

### DM
DM이 다른 NPC를 조작하려 하면 D-05를 열어 actor를 바꾼다.

### Player
자기 Character가 기본 actor다.

---

# 7. S-02 Intent Choice

## 목적
사용자가 먼저 `무엇을 하려는가`를 표현한다.

### 예시
- Attack
- Magic
- Search
- Influence
- Hide
- Help
- Utilize

### UI
Intent Dock의 선택된 item이 확장되어 작은 contextual panel을 만든다.

전체 화면을 바꾸지 않는다.

### Escape/Cancel
한 단계 뒤로 빠르게 돌아갈 수 있어야 한다.

---

# 8. S-03 Action Detail Choice

## 목적
Intent에 필요한 세부 요소만 고른다.

예:
- Attack → longsword / longbow / unarmed
- Magic → spell / feature / magic item
- Search → Perception / Investigation 등 연결된 선택
- Influence → 접근/관련 skill
- Utilize → item

### 정보
각 option에서 필요한 최소 정보만 즉시 표시:
- 이름
- 판정/보너스
- 핵심 효과
- resource cost
- unavailable reason

긴 rules text는 U-03에서 바로 열 수 있다.

---

# 9. S-04 Target Selection

## 목적
Action이 실제 target을 요구할 때만 target을 선택한다.

## 기본 제품 semantics
optional spatial/range module이 없으면:
- otherwise-valid target은 모두 range 안으로 간주한다.
- missing distance는 out-of-range가 아니다.
- `5 ft 내 대상 없음` 때문에 melee attack을 막지 않는다.

## UI
이 순간에만 relevant actor/target list를 보여준다.

표시:
- portrait/name
- side
- HP/status의 필요한 범위
- 선택 가능/불가

별도 tactical map을 만들지 않는다.

## Optional module
module이 authoritative fact를 제공할 때만 range/reach/LOS/cover restriction을 표시한다.

---

# 10. U-06 Cinematic Dice

## 목적
모든 실제 roll에 하나의 일관된 시각 언어를 사용한다.

## 연출 계약
- body/app-level overlay
- 화면 깊은 곳/뒤에서 시작
- 사용자 방향으로 날아오며 3D physics tumble
- 결과 face에 converge
- 짧은 result notice
- 자동 퇴장

## 금지
- Sheet 내부 dice frame
- permanent dice tray
- layout reflow

## Authority
connected roll은 authoritative result를 절대 변경하지 않는다.

---

# 11. S-05 Resolution Result

## 목적
Dice 직후 `그래서 무엇이 일어났는지`를 즉시 이해한다.

### 표시
- actor
- action
- target
- total / hit-miss / save result
- damage/healing
- 실제 상태 변화

### 시간
짧은 overlay + 최근 결과 access.

### DM
상세/Undo가 필요하면 D-08로 연결.

### Player
결과 확인이 중심.

---

# 12. S-06 Initiative / Combat Expansion

## 목적
같은 Session Shell을 전투 상태로 확장한다.

별도 Combat page가 아니다.

## Freeform에 추가되는 것
- round
- current turn
- compact initiative order
- 현재 actor action / bonus / reaction / movement
- turn end / next turn
- 필요한 status/HP

## 유지되는 것
- same utility rail
- same Rules
- same Sheet
- same Intent flow
- same dice/result

## 종료
Initiative 종료 즉시 S-01의 low-noise Freeform으로 축소된다.

---

# 13. Session 공용 Utility 씬

## U-01. Character / Actor Quick View

형태: compact drawer/popover.

### Player
- portrait/name
- HP/AC
- key resources
- conditions
- attacks/spells/features quick links
- `전체 시트`

### DM
- selected actor/Combatant summary
- HP/status
- relevant action/resources

---

## U-02. Full Character Sheet In Session

### 형태
large overlay, split workspace 또는 near-fullscreen layer.

Session Shell을 unmount하지 않는다.

### 기능
- SimpleVTT / Official-style switch
- normal full sheet
- direct roll
- resource use
- spell/attack lookup

### 닫기
정확히 이전 Session context로 돌아간다.

### Dice
U-06가 Session Shell 전체 위에 나타난다.

---

## U-03. Rules Lookup

### 중요도
Session 핵심 도구다.

### 형태
side pane / command-palette style search.

### 기본 사용
- spell
- condition
- action
- class feature
- item/rule

검색 후 detail을 읽어도 Main Focus는 유지된다.

### 빠른 연동
Action/Spell/Condition 이름에서 바로 해당 Rule detail로 열 수 있다.

---

## U-04. Activity / Result History

### 목적
조금 전 결과를 다시 확인한다.

### Player
최근 결과/read-only 중심.

### DM
최근 Resolution + D-08 진입.

### 형태
history drawer.

permanent panel이 아니다.

---

## U-05. Connection / Recovery

### 정상 연결
최소 표시.

### 문제가 생기면
Shell 위에 contextual indicator/layer:
- reconnecting
- retry
- leave

### 금지
- Lobby 복귀
- Ready 복귀
- Character 재선택 강요

---

## U-07. Handout Viewer

### Player
DM reveal 시 focused overlay.

- fit
- zoom/pan
- dismiss/minimize
- active 동안 reopen

### DM
preview 가능.

Viewer를 닫아도 Session context는 그대로다.

---

# 14. DM 전용 Session 씬

## D-01. Session Share / Settings

### 형태
small drawer.

### 표시
- Session name
- Host address
- copy/share
- connection health
- Session 종료

### 원칙
이 drawer를 열어도 play는 계속된다.

---

## D-02. Participants

### 표시
- Player name
- Character name
- connected/reconnecting/disconnected

### 금지
- Ready checkbox
- Ready gating
- raw peer id

### Player join
새 Player가 들어오면 background에서 roster에 추가된다. DM workflow를 interrupt하지 않는다.

---

## D-03. Encounter Editor

### 목적
Session 어느 시점이든 Encounter를 운영한다.

### 동작
- Combatant 추가
- 제거
- relevant metadata 변경

### 중요한 restriction model
`preparing이라서 가능 / live라서 불가`가 아니라 **각 operation이 현재 authoritative state에서 안전한가**로 판단한다.

예:
- Freeform에서 Combatant 추가: 일반적으로 가능
- Initiative 중 현재 acting Combatant 제거: 명확한 경고/안전 규칙 필요
- Initiative 중 future Combatant 추가: runtime이 지원하면 가능

### 형태
side pane/split drawer.

---

## D-04. Combatant Picker

Encounter Editor 안에서 연다.

### 표시
- search
- name
- AC/HP
- basic role/info
- `추가`

fixture/reference 자동 삽입 금지.

---

## D-05. DM Actor Switcher

### 목적
DM이 NPC/Combatant를 조작할 때만 actor 목록을 연다.

### 형태
compact dropdown/palette/popover.

상시 Scene Actors board를 만들지 않는다.

### 표시
- portrait/name
- HP/status
- Initiative turn indicator 필요 시

---

## D-06. Initiative Controls

S-06에서만 강조된다.

- Initiative 시작
- next turn
- order recovery/edit가 필요한 경우 secondary
- Initiative 종료

Initiative 시작은 Session 시작이 아니다.

---

## D-07. Handout Control

### 흐름
image select → local preview → caption/alt → reveal → active → withdraw

### 형태
contextual drawer/modal.

permanent image manager 금지.

---

## D-08. Adjudication / Undo

### 목적
DM이 방금 authoritative 결과를 검토하고 안전한 경우 correction/Undo한다.

### 진입
- U-04 Activity
- 직전 S-05 result

### 표시
- human-readable action/result
- changed state
- Undo 가능 여부
- 필요한 correction controls

raw ResolutionEvent payload는 advanced details에서만.

---

# 15. Player 전용 Session 씬

## P-01. My Character Session Tools

별도 permanent page가 아니라 Utility Rail의 Character group이다.

빠른 접근:
- Quick View
- Full Sheet
- Spells
- Items
- Features

Player가 실제 세션 중 가장 자주 쓰는 lookup path를 짧게 만든다.

---

## P-02. Leave / Reconnect Choice

### 명시 Leave
confirmation 후 Library Mode로 이동.

### 연결 문제
reconnect 우선.

복구 실패 시:
- retry
- leave

Lobby/Ready로 가지 않는다.

---

# 16. Session 종료 씬

## X-01. End Session Confirmation — DM

### 목적
실수로 Session을 종료하지 않게 한다.

### 표시
- 현재 연결 Player 수
- Session 종료 시 연결이 닫힌다는 설명
- `취소`
- `세션 종료`

---

## X-02. Session Ended / Return

### DM
종료 성공 → Library Mode의 Session Entry/Home.

### Player
Host 종료 감지 → `세션이 종료되었습니다` 짧은 state → Library Mode.

### 보존
owning Character durable state는 기존 persistence contract에 따라 유지한다.

---

# 17. 공용 Role Matrix

| 기능 | DM | Player |
|---|---|---|
| Persistent Session Shell | O | O |
| Freeform | O | O |
| Initiative shell | O | O |
| Intent / detail / target | O | O |
| Cinematic Dice | O | O |
| Rules Lookup | O | O |
| Activity history | O | O |
| Character/Actor Quick View | O | O |
| Full own Character Sheet | 필요 시 | O |
| Session Share | O | X |
| Participants management/view | O | 제한적/불필요 |
| Encounter Editor | O | X |
| Combatant Picker | O | X |
| DM actor switching | O | X |
| Initiative authority | O | 자기 turn control만 |
| Handout Control | O | X |
| Handout Viewer | preview | O |
| Undo/adjudication | O | X |
| Leave Session | Host 종료 | O |

---

# 18. 씬 전환 규칙

## 정상 Session 중 route 전환 금지 패턴

다음은 금지한다.

- Play → Rules route → Play
- Play → Character route → Play
- Play → Encounter route → Play
- Play → Activity route → Play

정상 동작은:

- Session Shell → Rules pane → close
- Session Shell → Sheet overlay → close
- Session Shell → Encounter drawer → close
- Session Shell → Activity drawer → close

이다.

## 상태 보존
utility를 열고 닫을 때:
- mode
- acting actor
- round/current turn
- selected intent
- target context
- scroll/focus context

를 가능한 범위에서 보존한다.

---

# 19. Responsive 기준

## Desktop / 일반 Windows
- Session Bar 상단
- Utility Rail 한쪽
- Main Focus 중앙
- Intent Dock 하단
- side pane은 Main Focus와 공존 가능

## 좁은 창
- Utility Rail → compact bottom/side icon rail
- side pane → modal drawer
- Intent Dock은 주요 actions가 가려지지 않게 유지
- Dice/Result overlay는 viewport에 맞춰 축소

## Keyboard
- Utility shortcut 접근 가능
- Escape는 현재 가장 위 contextual layer를 닫음
- target/action 선택을 keyboard로 완료 가능
- focus trap은 modal에서만, 닫을 때 원래 trigger로 복귀

---

# 20. 화면별 Empty / Error 원칙

## Encounter empty
DM의 정상 Freeform 상태다.

`아직 Encounter가 없습니다` + `Combatant 추가` 정도만 제공한다. 오류처럼 보이지 않는다.

## Player 0명
DM Session의 정상 상태다.

`연결된 플레이어 없음`은 Participant drawer에서 보여주고 DM tool 사용을 막지 않는다.

## No target
spatial module absence 때문에 `거리상 대상 없음`으로 만들지 않는다.

실제로 hostile/valid entity가 없을 때만 empty target state를 표시한다.

## Connection error
현재 Shell을 유지한 채 recover action을 제공한다.

## Content sync error
재시도/상세 보기. healthy parity는 별도 scene이 아니다.

---

# 21. 구현 우선순위

각 항목은 하나씩 구현하고 human acceptance 후 다음으로 이동한다.

1. **S-00 Persistent Session Shell** — 현재 route-centric play를 Session Mode shell로 전환.
2. **S-01 Freeform Baseline** — Scene Actor board와 permanent hotbar/economy를 제거해 low-noise state 확정.
3. **S-02/S-03/S-04 Intent → Detail → Target**.
4. **U-06/S-05 Cinematic Dice + Resolution**.
5. **U-01/U-02/U-03** — in-session Quick Sheet / Full Sheet / Rules.
6. **E-02 + D-01/D-02** — Session open 즉시 DM active workspace + share/participants.
7. **D-03/D-04/D-05** — Encounter/Combatant/Actor DM tools.
8. **E-03 + P-01/P-02** — Player join/current-session entry/reconnect.
9. **S-06 + D-06** — Initiative expansion.
10. **D-07/U-07** — Handout.
11. **U-04/D-08** — Activity/Undo.
12. **X-01/X-02** — Session end.
13. Library Mode 정리와 전체 responsive/accessibility 통합.

---

# 22. Human Acceptance Philosophy

각 씬은 CI green만으로 완료하지 않는다.

실제 Windows에서 다음 질문에 `예`가 되어야 한다.

1. 이 기능을 Session 흐름을 끊지 않고 찾을 수 있는가?
2. Rules/Sheet/Encounter 등을 보고 다시 play로 `돌아가야 한다`는 느낌이 없는가?
3. 대화 중 화면이 전투 HUD처럼 과도하게 시끄럽지 않은가?
4. Attack 하나를 하기 위해 불필요한 panel/tab navigation을 하지 않는가?
5. DM이 Player 0명부터 Session 종료까지 같은 workspace를 계속 사용할 수 있는가?
6. Player가 Join 후 Lobby 없이 현재 Session으로 자연스럽게 들어오는가?
7. Initiative 시작/종료가 같은 화면의 확장/축소로 느껴지는가?
8. Dice/Result/Handout이 순간 interaction이지 permanent panel이 아닌가?
9. optional spatial module이 없다고 기본 combat가 막히지 않는가?
10. Character/target/action identity가 interaction 끝까지 유지되는가?

이 기준을 만족해야 다음 UI slice로 넘어간다.
