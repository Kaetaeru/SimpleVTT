# SimpleVTT UI Implementation Playbook

Status: **Human/AI interpretation guide for the accepted UI contracts — not runtime authorization**

이 문서는 새로운 Product Decision을 만들지 않는다.

목적은 하나다:

> **처음 이 프로젝트를 보는 개발자나 AI가 기존 문서를 잘못 해석하지 않고, accepted UI/UX를 같은 제품으로 구현하게 한다.**

Accepted reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

반드시 같이 읽을 것:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
../decisions.md
../../README.md
../../movement-modules.md
../../session-runtime.md
SURFACE-CONTRACT.md
COMPONENT-CONTRACT.md
INTERACTION-STATE-MOTION-CONTRACT.md
IMPLEMENTATION-TRACEABILITY.md
```

---

# 1. 30초 요약

SimpleVTT는 **배틀맵 VTT가 아니다.**

핵심은:

```text
Character 준비
-> 필요하면 Host/Join
-> Actor와 Action을 선택
-> 사람이 결정해야 하는 것만 입력
-> 엔진이 계산/검증/상태변경
-> 현재 맥락에서 결과 확인
-> Activity에 기록
```

UI의 중심은 지도 위 Token 이동이 아니라:

- Character Sheet;
- Actor Board;
- Action / Hotbar;
- 현재 판정/반응/주사위/결과;
- Session state;
- Activity;
- 필요한 DM 사실 입력;

이다.

---

# 2. 절대 오해하면 안 되는 12가지

## 2.1 `Scene`, `Table`, `Tabletop Stage`, `Play Context`는 배틀맵이 아니다

이 단어들은 **현재 플레이 맥락을 보여주는 중앙 표현 공간**을 뜻한다.

가능:

- 현재 선택 행동 안내;
- Targeting 안내;
- PendingResolution;
- Reaction / Concentration;
- 주사위;
- 즉시 Result;
- NOTICE;
- Handout 이미지;
- 비전술적 배경/질감.

불가능:

- Actor x/y 좌표;
- Token drag;
- grid/hex;
- 벽/문/terrain;
- 이동 경로;
- range circle;
- AoE template;
- Fog of War;
- LoS line/cone;
- minimap.

**잘못된 구현 예:** 중앙 공간이 비어 보여서 32x32 grid와 Actor token을 추가한다.

**올바른 구현 예:** 중앙 공간은 여백을 유지하고, 현재 선택/판정/주사위/Handout이 필요할 때만 그 맥락을 보여준다.

---

## 2.2 Actor는 map token이 아니라 `ActorCard`가 기본 표현이다

Connected Play에서 Actor의 기본 UI 객체는 `ActorCard`다.

위쪽:

```text
NPC / Neutral / Hostile Actor Board
```

아래쪽:

```text
Player / Allied Actor Board
```

Targeting, 상태, 현재 턴, control, HP 등은 ActorCard에서 표현한다.

Actor의 카드 순서나 화면 위치로 거리/사거리/시야를 추론하지 않는다.

---

## 2.3 첫 실행은 Home이 아니라 Tutorial이다

Fresh install / tutorial incomplete:

```text
App boot
-> Tutorial / Onboarding
-> Official-style vs SimpleVTT Sheet 선택
-> Standalone / Host / Join 기본 설명
-> Complete
-> Home
```

Home 안에 작은 도움말 카드를 넣는 것으로 대체하지 않는다.

Tutorial은 나중에 Settings/Help에서 다시 열 수 있어야 한다.

---

## 2.4 Official-style Sheet와 SimpleVTT Sheet는 서로 다른 Character가 아니다

둘은 **같은 canonical Character의 presentation variant**다.

절대 금지:

```text
OfficialCharacterModel
SimpleVttCharacterModel
```

처럼 별도 데이터 모델을 만드는 것.

Sheet switch는 presentation preference다.

---

## 2.5 Standalone 주사위는 현재 Sheet를 떠나지 않는다

모든 일반 Roll:

```text
현재 Sheet
-> Roll
-> 같은 Sheet viewport 안/위에서 transient dice
-> 결과
-> transient layer 사라짐
-> 같은 Sheet 그대로
```

금지:

- Dice route;
- Dice modal;
- Dice drawer;
- 별도 Result window;
- 영구 Dice tray 때문에 Sheet layout 밀기;
- Close/Back을 눌러야 다시 Sheet를 쓰는 UX.

---

## 2.6 Host와 Join은 별도 흐름이다

Host:

```text
Host Setup
-> Open Session
-> Host = DM
-> 즉시 live Freeform
```

Join:

```text
Join Setup
-> local Character 선택
-> 필요한 sync
-> Client = Player
-> 현재 live state 진입
```

기본 제품에 Lobby / Ready / Start Session gate를 다시 만들지 않는다.

Host는 Player가 될 수 없고 Client는 DM이 될 수 없다.

---

## 2.7 Freeform과 Initiative는 다른 앱 화면이 아니다

둘은 같은 Play workspace다.

Freeform:

- turn/round 없음;
- fake Action/Bonus/Reaction/Movement spend UI 없음;
- Command Center와 capabilities는 계속 사용 가능.

Initiative:

- 같은 화면;
- compact Initiative Tracker 추가;
- round/current turn 추가;
- authoritative turn economy 추가;
- End Turn 추가.

Initiative 시작 때문에 별도 Combat route/screen을 만들지 않는다.

---

## 2.8 Command Center는 계속 남아 있는 핵심 UI다

기본 구조:

```text
[compact resource/economy row]
[Controlled Actor] [large Hotbar / capabilities] [context controls]
```

다음 상태에서 없어지면 안 된다:

- targeting;
- resolving;
- interrupt;
- dice;
- result;
- Initiative.

전체를 spinner/"Resolving..." 박스로 교체하지 않는다.

---

## 2.9 Targeting은 ActorCard/manual set으로 한다

Single target:

```text
Action selected
-> 모든 ActorCard 유지
-> valid / invalid 표시
-> valid Actor 클릭
-> 바로 submit
```

Multi target:

```text
Action selected
-> ActorCard 여러 개 선택
-> selected target state 유지
-> Execute
```

Area-like action:

```text
manual eligible Actor set / checklist
```

AoE circle/template를 중앙 공간에 그리지 않는다.

---

## 2.10 Main Hand unavailable이면 아무 다른 행동도 자동 선택하지 않는다

Default hostile click이 사용 가능한 경우에도 application/domain이 canonical Main Hand relation을 제공해야 한다.

불가능하면:

```text
Main Hand unavailable
+ reason
```

으로 끝난다.

다음으로 fallback하지 않는다:

- 다른 무기;
- 주문;
- unarmed;
- 임의의 first available action.

---

## 2.11 DM Only는 CSS hide가 아니다

Player가 알 권한이 없는 private authoritative event는 **Player projection에 존재 자체가 전달되지 않는 것**이 목표다.

금지:

```text
DOM에는 존재
-> display:none
```

또는:

```text
[Hidden event]
```

placeholder를 Player Activity에 두는 것.

실제 delivery protocol은 Architecture Gap이 해결되어야 구현 가능하다.

---

## 2.12 Handout은 이미지 presentation이지 map이 아니다

Handout:

- Overlay;
- Upper;
- Full;

가능:

- local zoom/pan;
- Player overlay local dismiss/reopen;
- DM shared presentation control.

금지:

- Token 배치;
- grid;
- target 클릭;
- map movement;
- LoS;
- AoE.

---

# 3. Connected Play를 한 화면으로 이해하는 법

정상적인 구조는 아래다.

```text
┌──────────────────────────────────────────────────────────┐
│ Play chrome / connection / session status               │
├──────────────────────────────────────────────────────────┤
│ Upper Actor Board: NPC / Neutral / Hostile              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                 PLAY CONTEXT / TABLETOP                  │
│                                                          │
│   current action / pending response / dice / result      │
│   notice / handout / contextual presentation             │
│                                                          │
│                                  ┌────────────────────┐   │
│                                  │ contextual utility │   │
│                                  │ Activity / DM etc  │   │
│                                  └────────────────────┘   │
├──────────────────────────────────────────────────────────┤
│ Lower Actor Board: Player / Allied                      │
├──────────────────────────────────────────────────────────┤
│ Command Center                                           │
│ resources | controlled Actor | Hotbar | context action   │
└──────────────────────────────────────────────────────────┘
```

중앙이 가장 넓다고 해서 가장 많은 persistent 정보를 채우는 곳이 아니다.

**정보 밀도는 위/아래 Actor Board와 Command Center에 집중되고, 중앙은 현재 맥락을 위한 breathing room을 갖는다.**

---

# 4. 역할별 차이

## Offline

- DM/Player 역할 없음;
- local Character 중심;
- Standalone Sheet 완전 사용 가능;
- local roll/result.

## Host / DM

같은 Play skeleton을 사용하지만 추가로:

- 모든 Actor control authority가 가능한 범위;
- Encounter;
- Participants;
- Session Share;
- Activity private/public view;
- advanced spatial fact input;
- adjudication/correction;
- Handout shared control;

등의 DM utility가 있다.

## Client / Player

- same Play skeleton;
- 자신의 authorized Actor/capabilities;
- DM-only utility 없음;
- DM-only event 존재 흔적 없음;
- Player Session / reconnect/leave 등 자신에게 필요한 utility만.

DM과 Player를 서로 완전히 다른 workspace로 만들지 않는다.

---

# 5. Actor click 우선순위

ActorCard 클릭이 여러 의미를 가질 수 있기 때문에 반드시 이 순서를 지킨다.

```text
1. selected action targeting
2. explicit DM control mode
3. ordinary selection / context focus
4. default hostile Main Hand behavior (조건이 맞는 경우만)
```

예시:

### Action selected

DM control mode가 켜져 있어도 selected action targeting이 먼저다.

### No action + DM control mode

Hostile Actor를 클릭해도 공격하지 않고 control/context 변경이 먼저다.

### No action + no DM control mode + hostile click

canonical Main Hand relation이 있고 target valid일 때만 default attack 경로 가능.

---

# 6. State를 서로 섞지 않는 법

다음은 서로 다른 상태다.

```text
controlled
current turn
selected
context focused
target valid
target invalid
target selected
```

한 종류의 노란 테두리로 전부 표현하지 않는다.

예:

```text
Rowan
- controlled = true
- currentTurn = true
- selected = false
- targetValid = false
```

이 경우 "controlled/current turn" 두 의미가 동시에 읽혀야 한다.

색만으로 구분하지 말고 label/icon/border/shape/background 등 중복 신호를 사용한다.

---

# 7. Resolution 중 무엇이 남고 무엇이 잠기는가

정상:

```text
Actor Boards          남음
Play Context          남음
Command Center        skeleton 남음
Session status        남음
Pending interaction   현재 context에서 강조
```

잠금 범위는 UI가 정하지 않는다.

반드시 authoritative/application projection이:

```text
conflicting controls
safe controls
```

또는 이에 상응하는 정보를 공급해야 한다.

`PendingResolution != disable everything`.

현재 이 정확한 runtime contract는 Gap으로 남아 있으므로 임의 구현하지 않는다.

---

# 8. Spatial facts를 이해하는 법

SimpleVTT Core가 거리/시야/엄폐 개념을 모른다는 뜻은 아니다.

Core는 **좌표를 소유하지 않고 결과 fact를 소비한다.**

예:

```text
Actor A: Rowan
Actor B: Ash Raider
Distance: 25 ft
Visibility: visible
Cover: half
```

가능한 UI:

- DM form;
- pairwise facts list;
- source/provenance label.

잘못된 UI:

- 두 token을 canvas에 놓아서 거리 계산;
- line drawing으로 LoS 편집;
- drag로 cover 판정.

미래 map module이 생겨도 Core UI 자체의 기본 제품 정체성은 mapless다.

---

# 9. Product Shell에서 live Session을 다루는 법

Live session 중에도 사용자가 safe Product destination을 볼 수 있다.

예:

```text
Play
-> Rules
-> Return to Play
```

이때 보존해야 하는 것:

- session identity;
- Host/DM or Client/Player role;
- Session mode;
- current turn;
- controlled Actor;
- authoritative state;
- PendingResolution 등 계약이 보존하도록 요구하는 live state.

Navigation이 새 Session을 만들거나 역할을 바꾸면 안 된다.

---

# 10. UI가 계산하면 안 되는 값

React/UI component는 다음을 추론/계산하지 않는다.

```text
"이 target은 25ft니까 valid"
"AC가 15니까 hit"
"이 spell은 Action"
"이 Main Hand가 없으니 dagger 사용"
"DM이니까 이 private event를 가져와도 됨"
"resolution 중이니 모든 버튼 disable"
"이 Handout은 reconnect 후에도 active일 것"
```

UI는 projection을 받는다.

예시 형태:

```text
ActorCardProjection
  targetEligibility = valid | invalid(reason)

CapabilityProjection
  available
  unavailableReason
  cost/economy projection

ResolutionUiProjection
  phase
  conflictingInteractionIds
  safeInteractionIds

ActivityProjection
  events already filtered for current recipient
```

위 이름들은 설명용이며 production schema를 새로 정의하는 것이 아니다.

---

# 11. 구현자가 자유롭게 조절할 수 있는 것

기존 hierarchy와 behavior를 바꾸지 않는 범위에서 조정 가능:

- exact px;
- spacing;
- border radius;
- exact dark palette;
- icon family;
- microcopy;
- hover animation timing;
- breakpoint exact number;
- ordinary internal React component split;
- CSS architecture.

하지만 아래가 바뀌면 단순 디자인 조정이 아니다:

- 무엇이 항상 보이는가;
- 화면의 주요 region 관계;
- Host/Player 권한;
- privacy;
- first-run flow;
- target flow;
- Session lifecycle;
- navigation hierarchy;
- mapless boundary;
- same-Sheet dice;
- Handout semantics.

---

# 12. 구현 전에 스스로 묻는 15개 질문

```text
1. 이 UI는 battlemap을 암시하고 있지 않은가?
2. Actor를 좌표/Token으로 다루고 있지 않은가?
3. Fresh user가 Tutorial보다 Home을 먼저 보지 않는가?
4. Sheet switch가 Character 데이터 모델을 바꾸지 않는가?
5. Standalone roll이 Sheet를 떠나지 않는가?
6. Host/Join이 별도이며 Host가 바로 live Freeform으로 가는가?
7. Freeform에 fake turn economy가 없는가?
8. Initiative가 같은 Play skeleton을 유지하는가?
9. Actor Boards와 Command Center가 targeting/resolution 중 유지되는가?
10. Target validity를 UI가 계산하지 않는가?
11. Main Hand unavailable 시 fallback하지 않는가?
12. DM-only data를 Player DOM에 숨겨 넣지 않는가?
13. Handout을 tactical map으로 쓰지 않는가?
14. Product Shell navigation 뒤 Return to Play가 같은 role/context로 돌아가는가?
15. prototype fixture를 production model로 복사하고 있지 않은가?
```

하나라도 `아니다 / 모르겠다`면 구현을 진행하기 전에 계약/Gap을 다시 확인한다.

---

# 13. 구현 중 자주 생길 잘못된 합리화

## "중앙 공간이 너무 비어 보인다"

정상이다. Battlemap을 추가하지 않는다.

## "대부분 VTT는 token을 쓴다"

SimpleVTT Core는 의도적으로 그렇지 않다.

## "Player에게 숨기기만 하면 private 아닌가?"

아니다. delivery 자체가 role-scoped여야 한다.

## "Resolution 중에는 안전하게 다 disable하자"

아니다. selective locking contract가 필요하다.

## "Main Hand가 없으면 보통 다른 무기로 공격하게 하자"

아니다. smart fallback 금지.

## "Tutorial은 나중에 만들자"

아니다. 첫-run product identity의 일부다.

## "Prototype의 fixture 구조를 그대로 type으로 만들면 빠르다"

아니다. fixture는 presentation QA 데이터일 뿐이다.

---

# 14. 가장 먼저 구현하기 좋은 slice

현재 계약상 가장 안전한 첫 runtime slice 후보:

```text
Product Shell
+ First-run Tutorial
+ Sheet presentation preference
+ Home navigation
```

이유:

- accepted reference가 명확함;
- mapless identity를 가장 먼저 고정함;
- private delivery / Handout network / selective resolution Gap과 거리가 멂;
- 이후 Character/Session UI가 같은 shell 위에 쌓임.

하지만 실제 구현은 별도 Runtime Work Order와 명시적 구현 승인이 있어야 한다.

---

# 15. 한 문장 기준

> **SimpleVTT UI는 지도를 대신 만드는 화면이 아니라, Character·Actor·Action·판정·상태·사람의 선택을 가장 적은 마찰로 연결하는 mapless tabletop companion이다.**
