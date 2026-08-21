# SimpleVTT V0.9 Play Surface Inventory

## 문서 목적

이 문서는 V0.9의 **플레이 화면 전체 목록**을 UI 기준으로 확정한다.

이후 구현은 화면을 임의로 추가하거나 내부 runtime state를 그대로 페이지로 만들지 않는다. 먼저 이 문서의 screen/surface 분류를 기준으로 구현하고, 새로운 화면이 필요하면 제품 기획을 먼저 수정한다.

핵심 원칙:

- DM과 Player가 같은 플레이 개념을 볼 때는 **공용 화면 구조를 사용하고 권한/행동만 다르게 노출**한다.
- 역할 차이가 실제 사용자 목표를 바꾸는 경우에만 DM/Player 고유 화면을 둔다.
- `Host preparing`, `Player lobby`, `Ready`, `Play Start` 같은 내부 lifecycle을 별도 필수 화면으로 만들지 않는다.
- Dice, result, handout, target choice처럼 순간적으로 필요한 것은 permanent page가 아니라 overlay/drawer/temporary layer로 처리한다.
- tactical grid / token map / LOS / exact-distance screen은 기본 제품 화면 목록에 없다.

---

# 1. 화면 분류 체계

## A. 공용 플레이 화면

DM과 Player가 같은 개념의 플레이 공간을 사용한다. 화면 골격은 같고 role에 따라 보이는 control만 달라진다.

## B. DM 고유 화면/도구

세션을 만들고 운영하고 판정 authority를 행사하기 위해 DM에게만 필요한 화면 또는 drawer다.

## C. Player 고유 화면/도구

자기 Character로 세션에 참가하고 자기 행동을 실행하기 위해 Player에게만 필요한 화면 또는 state다.

## D. 공용 transient layer

전체 페이지가 아니라 플레이 화면 위에 잠깐 나타나는 overlay/modal/drawer다.

---

# 2. 전체 화면 맵

## DM 흐름

`세션 열기` → **즉시 Active DM Play Workspace** → Freeform ↔ Initiative/Combat

Active DM Play Workspace 안에서 필요할 때:

- Session 정보/공유
- Encounter 편집
- Combatant 추가
- Actor 선택/DM 행동
- Initiative 관리
- Handout reveal
- Participant 상태
- Activity/Undo

를 drawer/modal/context control로 연다.

**Player가 0명이어도 Active DM Play Workspace는 완전히 사용 가능하다.**

## Player 흐름

`세션 참가` → 연결/콘텐츠 동기화 transient state → **Active Player Play Workspace** → Freeform ↔ Initiative/Combat

별도 Lobby/Ready 화면은 없다.

---

# 3. 공용 Route-Level 플레이 화면

## C-01. Active Session Play Shell

### 목적

세션이 활성화된 동안 DM과 Player가 머무르는 공통 최상위 플레이 shell.

### 항상 보이는 정보

- Session name
- 현재 연결 상태
- 현재 play mode: Freeform 또는 Initiative
- 현재 사용자에게 의미 있는 actor/Character identity
- 현재 주요 play surface

### 역할 차이

DM:
- Session 공유/관리 진입
- Encounter/Combatant 도구 진입
- actor authority controls
- Initiative controls
- handout controls

Player:
- 자기 Character identity
- 자기 행동 controls
- 현재 세션에서 나가기

### 금지

- raw `role=host/client`
- protocol/manifest/rulesProfile 정보
- 별도 permanent lifecycle panel
- permanent Inspector
- permanent debug/status panel

---

## C-02. Freeform Play Workspace

### 목적

전투가 아닌 탐험, 대화, 조사, 일반 행동을 가장 조용한 화면으로 진행한다.

### 공용 표시

- 현재 장면/세션 이름
- 현재 actor/Character의 compact summary
- intent actions
- 필요할 때만 target/secondary choice
- 직전 판정 결과가 발생했을 때만 transient result

### 기본 intent

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
- 필요 시 improvised action

### DM 차이

- DM은 현재 조작할 NPC/Combatant를 선택할 수 있다.
- DM adjudication control은 secondary/progressive disclosure다.

### Player 차이

- Player는 자기 Character의 허용된 action만 직접 실행한다.

### 금지

- 모든 skill을 top-level button wall로 표시
- initiative order 상시 표시
- action economy 상시 표시
- permanent entity list
- permanent Activity panel

---

## C-03. Initiative / Combat Workspace

### 목적

Freeform 화면에 전투에 필요한 정보만 추가한다. 완전히 다른 앱/페이지로 갈아타지 않는다.

### Freeform 대비 추가되는 정보

- round
- current turn
- compact initiative order
- 현재 actor action economy
- target choice when required
- relevant HP/status summary
- turn end control when applicable

### DM 차이

- Initiative 시작/종료
- NPC/Combatant turn control
- next turn/advance authority
- 필요 시 adjudication/Undo 접근

### Player 차이

- 자기 turn에서 자기 Character의 action controls
- 현재 사용할 수 없는 action은 이유를 domain language로 표시

### 거리 기본 규칙

spatial/range module이 없으면 적절한 대상은 모두 사거리 내로 취급한다.

따라서 기본 제품에서:

- `5 ft 내 대상 없음`
- `정확한 거리 정보 없음`

만으로 공격을 막지 않는다.

---

## C-04. Actor / Character Quick View

### 형태

Permanent side panel이 아니라 필요할 때 여는 compact drawer/popover.

### 목적

플레이를 떠나지 않고 현재 actor의 핵심 정보를 확인한다.

### 공용 정보

- name / portrait
- HP / AC / key resources
- 주요 status
- attacks / spells / features로 진입할 수 있는 compact summary

### 역할 차이

Player:
- 자기 Character 정보
- full Character Sheet 열기 가능

DM:
- 선택한 NPC/Combatant 정보
- DM control에 필요한 상태만 수정 가능

---

# 4. 공용 Interaction 화면/흐름

## C-05. Intent → Detail Choice Flow

### 목적

사용자가 먼저 의도를 선택하고 필요한 경우에만 세부 선택을 한다.

### 예시

Attack → weapon/attack 선택 → target 선택

Magic → spell/feature 선택 → 필요 시 target 선택

Influence → 관련 skill/approach 선택

Search → 관련 skill 선택

### 형태

play workspace 안의 contextual panel 또는 drawer.

새 route로 이동하지 않는다.

---

## C-06. Target Selection Layer

### 목적

현재 action이 실제 target을 요구할 때만 나타난다.

### 기본 제품

spatial module이 없으면 거리 기반 필터링을 하지 않는다.

- 적절한 hostile/valid target을 모두 선택 가능
- distance unknown은 out-of-range가 아님

### optional spatial module 존재 시

module이 authoritative facts를 제공하는 경우에만:

- range
- reach
- LOS
- cover
- module-defined positional constraints

를 적용한다.

### 형태

contextual target list / overlay.

별도 tactical map 화면으로 만들지 않는다.

---

## C-07. Resolution Result Layer

### 목적

판정 후 사용자가 바로 이해해야 할 결과를 짧게 보여준다.

### 표시

- 누가 무엇을 했는지
- 성공/실패 또는 결과
- roll total / damage / healing 등 필요한 값
- 실제 상태 변화

### 역할 차이

DM:
- 필요한 경우 detail/Undo 진입 가능

Player:
- 결과 확인 중심

### 금지

- ResolutionEvent ID
- raw event payload
- package provenance를 기본 결과에 표시

---

# 5. 공용 Transient Layers

## T-01. Cinematic Dice Overlay

### 가장 중요한 UI 계약

Dice roll은 **현재 플레이 화면 위의 body/app-level overlay**로 나타난다.

- 화면 안에 별도 dice window/frame을 삽입하지 않는다.
- 주사위는 화면 깊은 곳/뒤에서 시작한다.
- 사용자 쪽으로 날아오면서 3D physics tumble을 한다.
- authoritative connected roll은 이미 정해진 결과로 converge한다.
- standalone/local roll도 동일한 cinematic visual language를 사용한다.
- 짧은 result notice 후 overlay가 사라진다.
- 배경 화면 layout을 밀거나 resize하지 않는다.

### 적용 화면

- Freeform
- Initiative/Combat
- standalone Character Sheet
- Official-style Sheet
- Character creation roll
- level-up Hit Die

---

## T-02. Handout Viewer

### 목적

DM이 공개한 이미지를 플레이어가 현재 플레이를 떠나지 않고 본다.

### 공용 viewer 동작

- focused overlay/lightbox
- fit-to-window
- zoom/pan
- 닫기/minimize
- active reveal인 동안 reopen 가능

### 역할 차이

Player:
- dismiss/minimize/reopen

DM:
- 현재 reveal preview 확인 가능
- 실제 reveal/withdraw control은 DM 전용 도구에서 수행

---

## T-03. Connection / Reconnect Layer

### 목적

연결 상태가 실제 플레이에 영향을 줄 때만 표시한다.

### Player

- `연결 중`
- `세션 콘텐츠 동기화 중`
- `재연결 중`
- 실패 시 retry/leave

### DM

- Host transport가 실제로 실패했을 때 recovery 안내
- 개별 Player disconnect는 participant indicator에서 확인

### 금지

- reconnect 시 Lobby로 이동
- Ready 화면으로 되돌림
- 정상 handshake를 사용자가 승인해야 하는 단계처럼 표시

---

## T-04. Error / Recovery Layer

### 목적

현재 행동이 실패했을 때 원인과 다음 행동을 domain language로 제공한다.

예:

- Character가 더 이상 존재하지 않음 → Character 다시 선택
- 연결 실패 → 주소 확인 / 다시 연결
- content sync 실패 → 재시도 / 상세 보기
- invalid image → 다른 이미지 선택

raw stack/protocol error는 기본 화면에 노출하지 않는다.

---

# 6. DM 고유 화면 및 도구

## D-01. Open Session Screen

### 목적

DM이 새 세션을 연다.

### 표시

- Session name
- bind/listen address 또는 기본 network option
- `세션 열기`

### 전이

`세션 열기` 성공 → **즉시 D-02 Active DM Play Workspace**

Host preparing page로 가지 않는다.

Player를 기다리지 않는다.

---

## D-02. Active DM Play Workspace

### 목적

세션을 연 순간부터 DM이 실제로 세션을 만들고 운영한다.

### 핵심

이 화면은 C-01/C-02 또는 C-03의 DM composition이다.

별도 `preparing` 화면이 아니다.

### Player 0명 상태

정상 상태다.

DM은 즉시:

- Encounter 편집
- Combatant 추가/제거
- Freeform 진행
- Initiative 시작
- handout 준비/공개
- session name 등 편집

을 할 수 있다.

### Player 합류 중

DM workspace는 그대로 유지된다.

participant가 연결되면 roster에 자연스럽게 추가된다.

---

## D-03. Session Share & Settings Drawer

### 목적

세션 운영 중 연결 정보를 확인/수정한다.

### 표시

- Session name
- Host address
- copy/share action
- 현재 connection state
- 세션 종료

### 금지

이 drawer가 play workspace를 대체하지 않는다.

---

## D-04. Participant Drawer

### 목적

현재 연결된 Player를 확인한다.

### 표시

- Player/Character name
- connected / reconnecting / disconnected
- 필요한 최소 sync 상태

### 금지

- Ready checkbox
- 모두 Ready가 되어야 play할 수 있다는 gating
- raw peer/session IDs

---

## D-05. Encounter Editor Drawer

### 목적

현재 Encounter에 포함될 DM Combatant를 구성한다.

### 가능한 행동

- Combatant 추가
- 현재 Encounter에서 제거
- 필요한 encounter metadata 수정

### 사용 시점

- Player가 없을 때
- Freeform 중
- Initiative 전
- 필요하면 Initiative 중 제한적으로

즉 `세션 준비 단계`에만 묶이지 않는다.

---

## D-06. Combatant Library Picker

### 목적

설치된/사용 가능한 Combatant 중 현재 Encounter에 추가할 대상을 선택한다.

### 표시

- 검색
- 이름
- 핵심 전투 정보
- `Encounter에 추가`

### 금지

- fixture/reference monster 자동 추가
- package/version metadata를 카드의 primary content로 표시

---

## D-07. DM Actor Control

### 목적

DM이 NPC/Combatant를 현재 acting actor로 선택하고 행동시킨다.

### 표시

- 현재 DM-controlled actor
- available intent/actions
- 필요한 resources/status

### 형태

공용 play workspace의 role-specific control이다.

별도 전투 콘솔 페이지를 만들지 않는다.

---

## D-08. Initiative Control

### 목적

DM이 combat mode를 관리한다.

### 행동

- Initiative 시작
- 필요 시 order 조정/복구
- 다음 turn
- Initiative 종료

### 핵심

Initiative 시작은 **세션 시작이 아니다.**

세션은 이미 활성 상태다.

---

## D-09. Handout Control

### 목적

DM이 플레이어에게 이미지를 보여준다.

### 흐름

이미지 선택 → local preview → optional title/caption → `플레이어에게 보여주기` → active reveal → `회수`

### 형태

contextual DM drawer/modal.

Permanent image manager는 아니다.

---

## D-10. Activity / Undo Detail

### 목적

DM이 최근 authoritative outcome을 확인하고 실제로 안전한 경우 Undo/correction을 수행한다.

### 형태

기본 화면에서는 숨겨진 history drawer.

### 표시

- human-readable action/result
- 필요한 detail
- Undo available 여부

raw ResolutionEvent ledger는 advanced detail 밖에서는 보이지 않는다.

---

# 7. Player 고유 화면 및 도구

## P-01. Join Session Screen

### 목적

Player가 기존 Character를 선택하고 열린 세션에 참가한다.

### 표시

- saved Character selector
- Host address
- `참가하기`

### 전이

Join → T-03 연결/동기화 상태 → **P-02 Active Player Play Workspace**

Lobby/Ready screen은 없다.

---

## P-02. Active Player Play Workspace

### 목적

Player가 자기 Character로 현재 세션 상태에 즉시 합류한다.

### 핵심

C-01 + C-02/C-03의 Player composition이다.

### Freeform

- 자기 Character summary
- intent actions
- 필요할 때 target/detail choice

### Initiative

- 현재 turn/order
- 자기 action economy
- legal actions
- 필요한 target

### 금지

- DM Encounter editing
- DM Initiative advance
- Host network settings
- 다른 actor 임의 조작

---

## P-03. My Character Quick Sheet

### 목적

세션을 떠나지 않고 자기 Character의 핵심 sheet 정보를 확인한다.

### 행동

- quick info 확인
- 필요하면 full Character Sheet 열기

### 데이터 authority

owning Client Character가 canonical durable source다.

Host projection을 별도 Character로 편집하지 않는다.

---

## P-04. Leave Session / Reconnect Choice

### 목적

Player가 명시적으로 세션을 나가거나 복구 불가능한 연결 문제에서 행동을 선택한다.

### 행동

- 다시 연결
- 세션 나가기

### 금지

- 정상 disconnect/reconnect를 Character 재선택 + Ready + Start 전체 흐름으로 되돌림

---

# 8. 세션 외 플레이 화면

멀티플레이 역할과 별개로 Character owner가 사용할 수 있는 플레이 화면이다.

## S-01. SimpleVTT Character Sheet

- 독립적인 physical-table play surface
- direct ability/save/skill/Initiative/attack/damage/common dice roll
- body-level cinematic dice
- Character resources 관리

## S-02. Official-Style Character Sheet

- 동일 canonical Character의 두 번째 presentation
- 같은 roll semantics
- 같은 body-level cinematic dice
- Spellcasting page 포함

두 화면은 서로 다른 Character 데이터 모델을 만들지 않는다.

---

# 9. 별도 화면으로 만들지 않을 것

다음 항목은 V0.9에서 독립 route/page로 만들지 않는다.

- Host Preparing screen
- Player Lobby
- Ready screen
- `플레이 시작` gate screen
- permanent dice tray/window
- standalone target-distance editor
- tactical map/grid/token screen
- permanent Inspector
- permanent Activity panel
- permanent Handout manager
- protocol/debug dashboard
- healthy content-parity confirmation screen

필요한 기능은 active play workspace의 contextual drawer/overlay 또는 짧은 transient state로 표현한다.

---

# 10. 공용 화면과 역할별 권한 매트릭스

| Surface | DM | Player |
|---|---|---|
| Active Session Play Shell | 사용 | 사용 |
| Freeform Workspace | 모든 DM-controlled actor + authority controls | 자기 Character |
| Initiative/Combat Workspace | 시작/진행/종료 + NPC control | 자기 turn/action |
| Intent Flow | 사용 | 사용 |
| Target Selection | 사용 | 사용 |
| Cinematic Dice | 사용 | 사용 |
| Resolution Result | 결과 + detail/Undo 진입 | 결과 확인 |
| Character/Actor Quick View | 선택 actor/NPC | 자기 Character |
| Handout Viewer | preview 가능 | dismiss/reopen 가능 |
| Connection Recovery | Host recovery | reconnect/leave |
| Encounter Editor | 사용 | 없음 |
| Combatant Picker | 사용 | 없음 |
| Participant Drawer | 관리/상태 확인 | 별도 관리 없음 |
| Handout Control | reveal/withdraw | 없음 |
| Activity/Undo | 사용 | 기본 read-only 또는 미노출 |
| Session Share/Settings | 사용 | 없음 |

---

# 11. 구현 순서 기준

플레이 UI를 구현할 때 다음 순서로 한 화면씩 완료한다.

1. Active Session Play Shell
2. Freeform Workspace
3. Intent → Detail → Target 흐름
4. Cinematic Dice + Result layer
5. DM Open Session → 즉시 Active DM Workspace
6. DM Encounter/Combatant 편집
7. Player Join → 즉시 Active Player Workspace
8. Initiative/Combat mode
9. DM Initiative/Actor controls
10. Handout viewer/control
11. Activity/Undo
12. Reconnect/error states
13. 두 standalone Character Sheet의 play integration

각 slice는 다음 화면으로 넘어가기 전에 human acceptance 기준을 포함해 닫는다.

---

# 12. Play UI Acceptance의 기본 원칙

화면 구현 완료는 component가 존재하거나 CI가 green인 것으로 판단하지 않는다.

각 화면은 실제 Windows build에서 다음을 확인해야 한다.

- 사용자가 기대한 위치에서 기능을 찾을 수 있는가
- 클릭한 actor/Character/target/action identity가 끝까지 유지되는가
- role에 맞지 않는 control이 보이지 않는가
- 내부 lifecycle 때문에 사용자가 막히지 않는가
- optional module 부재 때문에 기본 기능이 막히지 않는가
- transient interaction이 permanent frame/panel로 변질되지 않았는가
- keyboard와 constrained viewport에서도 주요 행동이 가능한가

이 문서에 없는 새로운 permanent play screen이 필요해지면 구현하기 전에 먼저 이 inventory를 수정한다.
