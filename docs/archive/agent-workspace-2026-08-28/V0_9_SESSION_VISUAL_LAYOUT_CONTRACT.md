# SimpleVTT V0.9 Session Visual Layout Contract

## 0. 목적과 지위

이 문서는 다음 기획 문서를 실제 화면 배치 수준으로 구체화한다.

- `V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `V0_9_SESSION_INTERACTION_SPEC.md`

상위 철학은 변하지 않는다.

> **D&D 세션 중에는 SimpleVTT를 계속 켜 둔 채 Character 확인, 규칙 확인, 판정, 대화, 탐험, 전투, DM 운영을 빠르고 자연스럽게 이어갈 수 있어야 한다.**

이 문서는 특히 다음을 확정한다.

1. S-00 Persistent Active Session Shell의 실제 배치
2. Player / DM variant의 차이
3. Freeform / Initiative 상태의 시각 변화
4. Quick Sheet / Full Sheet의 위치와 크기
5. Rules / Activity / DM utility pane의 위치
6. Action Dock의 resting / intent / detail / target 상태
7. narrow Windows viewport에서의 변형
8. layer stack, focus, z-order, 화면 압박 방지 규칙

이 문서는 low-fidelity wireframe contract다. 색상, 최종 typography, 세부 icon style은 이후 visual design pass에서 정할 수 있지만 **영역의 위치, 정보 우선순위, interaction hierarchy는 구현 중 임의로 바꾸지 않는다.**

---

# 1. 기본 화면 좌표계

## 1.1 기준 viewport

설계 기준 desktop viewport:

- 기준: `1440 x 900`
- 일반 지원 범위: `1024 x 720` 이상
- constrained Windows 검수: 약 `900 x 650`
- 그보다 좁은 화면에서는 pane을 overlay/drawer로 변환한다.

픽셀 값은 구현 시 CSS token으로 조정할 수 있으나 비율과 우선순위는 유지한다.

## 1.2 Persistent Shell의 다섯 영역

1. **Session Bar** — 상단 고정, 약 52px
2. **Main Focus** — 중앙의 가장 큰 영역
3. **Action Dock** — 하단, resting 약 64~72px
4. **Utility Rail** — 우측 고정, 약 48~56px
5. **Layer Host** — Quick Sheet, Rules, Full Sheet, Dice, Result, Handout, Recovery가 올라오는 공간

Main Focus가 항상 최대 면적을 가져야 한다.

### Desktop wide 기본 비율

- Session Bar: 52px
- Utility Rail: 52px
- Action Dock resting: 68px
- Main Focus: 나머지 전체

Action Dock이 contextual mode로 확장되어도 대략 화면 높이의 25~30%를 지속적으로 넘지 않도록 한다.

---

# 2. S-00 공통 Session Shell 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ SESSION BAR                                                         52px    │
│ [세션명] [FREEFORM]                 [상태/턴]         [Identity Chip] [⋯]   │
├───────────────────────────────────────────────────────────────────┬──────────┤
│                                                                   │ Utility  │
│                                                                   │ Rail     │
│                                                                   │          │
│                         MAIN FOCUS AREA                            │  □       │
│                                                                   │  ?       │
│               대화·탐험을 방해하지 않는 낮은 밀도                 │  ◷       │
│                                                                   │  …       │
│                                                                   │          │
├───────────────────────────────────────────────────────────────────┴──────────┤
│ ACTION DOCK — compact intents / current interaction                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

핵심은 화면 중앙을 Actor board나 card wall로 채우지 않는 것이다.

---

# 3. Session Bar 상세

## 3.1 왼쪽 영역 — Session identity

왼쪽부터:

- Session name
- 현재 mode badge: `자유 진행` / `이니셔티브`
- 필요 시 scene/context label

Session name은 가장 큰 heading이 아니다. 상단 bar 안에서 compact하게 유지한다.

## 3.2 중앙 영역 — 상태는 필요할 때만

Freeform 정상 상태에서는 비워 둘 수 있다.

조건부 표시:

- reconnecting / disconnected
- Initiative: `3라운드 · Goblin의 턴`
- pending authoritative resolution
- 중요한 session-wide warning

정상 connected 상태를 큰 초록 badge로 계속 강조하지 않는다.

## 3.3 오른쪽 영역 — 역할 identity

### Player

항상 보이는 Character Identity Chip:

```text
[portrait] Aelar   HP 24/31   [⌃/확장]
```

- 전체 chip click: Quick Sheet
- 명확한 expand action: Full Sheet
- HP가 심각한 상태라면 compact visual emphasis 가능
- Character 이름이 길면 말줄임하되 tooltip/accessibility name 제공

### DM

```text
[portrait] Goblin  [Actor 변경 ▾]
```

- actor identity click: Actor Quick View
- switch affordance: Actor Switcher
- 세션 전체의 DM role badge를 크게 표시하지 않는다.

## 3.4 overflow

`⋯`는 세션 종료/Leave 같은 저빈도 기능만 담는다.

Player:
- connection detail
- Session leave

DM:
- Session share/settings
- Session end

Rules, Sheet, Encounter 같은 고빈도 기능을 overflow 안에 숨기지 않는다.

---

# 4. Utility Rail

## 4.1 위치

기본 desktop에서는 **우측**에 둔다.

이유:
- Player Identity가 Session Bar 오른쪽에 있어 Sheet를 같은 시각 축에서 찾기 쉽다.
- Main Focus 왼쪽은 읽기/대화 context를 위해 비운다.
- side pane도 우측에서 열어 rail과 관계가 명확하다.

## 4.2 Player Rail

위에서 아래 우선순위:

1. Character / Sheet
2. Rules
3. Activity
4. active Handout reopen — reveal이 있을 때만
5. Session / connection

각 icon은 최소 40~44px hit area를 확보한다.

## 4.3 DM Rail

1. Actor
2. Rules
3. Encounter
4. Participants
5. Handout
6. Activity / Undo
7. Session

### Initiative button의 예외

Initiative 시작/다음 턴/종료는 rail 깊숙이 숨기지 않는다.

- Freeform: Main Focus/Action Dock 근처의 contextual `이니셔티브 시작`
- Combat: Session Bar 또는 Initiative strip에 `다음 턴`, `전투 종료`

## 4.4 Selected state

현재 열려 있는 tool icon은 배경/outline/indicator로 selected 상태를 명확하게 표시한다.

같은 icon을 다시 누르면 lightweight pane은 닫힌다.

---

# 5. Player Freeform 기본 화면

## 5.1 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ The Sunless Citadel · 자유 진행                              [Aelar HP] [⋯] │
├───────────────────────────────────────────────────────────────────┬──────────┤
│                                                                   │ Sheet    │
│      [scene/context title — 필요할 때만]                           │ Rules    │
│                                                                   │ Activity │
│      최근 의미 있는 결과 1건 정도만 짧게 표시 가능                │          │
│      예: "Aelar가 비밀문을 발견했습니다."                         │          │
│                                                                   │          │
│      대부분은 여백.                                               │          │
│      플레이어는 실제 테이블 대화와 DM 설명에 집중한다.            │          │
│                                                                   │          │
├───────────────────────────────────────────────────────────────────┴──────────┤
│ [공격] [마법] [탐색] [영향] [도움]                     [모든 행동]          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 5.2 Freeform Main Focus에 상시 두지 않는 것

- 전체 party 목록
- 전체 hostile 목록
- 모든 HP card
- action economy
- Initiative order
- spell/item/class tab
- Inspector
- Activity history 전체

## 5.3 최근 결과

최근 meaningful result는 최대 1개 정도의 compact notice로 표시할 수 있다.

몇 초 뒤 시각적 강조를 줄이고 Activity로 남긴다.

화면의 중심을 영구적으로 차지하지 않는다.

---

# 6. DM Freeform 기본 화면

## 6.1 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ The Sunless Citadel · 자유 진행                        [Goblin ▾ Actor] [⋯] │
├───────────────────────────────────────────────────────────────────┬──────────┤
│                                                                   │ Actor    │
│      [scene/context]                                               │ Rules    │
│                                                                   │ Encounter│
│      현재 Encounter가 비어 있으면:                                │ Players  │
│      "아직 Combatant가 없습니다. [+ Combatant]"                   │ Handout  │
│                                                                   │ Activity │
│      연결 Player 0명은 오류가 아님.                               │ Session  │
│      큰 lobby/대기 문구를 띄우지 않는다.                          │          │
│                                                                   │          │
├───────────────────────────────────────────────────────────────────┴──────────┤
│ [공격] [마법] [탐색] [영향] [모든 행동]        [이니셔티브 시작]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 DM Empty State

Player 0명:
- 작은 status: `연결된 플레이어 없음`
- 세션은 이미 active
- Encounter/Handout/Rules/Initiative 등 모두 접근 가능

Combatant 0명:
- compact CTA `Combatant 추가`
- Freeform 자체는 정상

---

# 7. Action Dock visual contract

## 7.1 Resting height

약 64~72px.

한 줄 또는 두 줄의 compact control만 표시한다.

## 7.2 Freeform 기본 intent 우선순위

Player 기본 후보:

- Attack
- Magic
- Search
- Influence
- Help
- `모든 행동`

DM은 현재 actor가 지원하지 않는 intent를 억지로 동일하게 유지하지 않아도 된다. 단 `모든 행동`에서 전체 official intent에 접근할 수 있어야 한다.

### context replacement

현재 actor가 자주 쓰는 Character-specific quick action이 있으면 1~2개를 intent 옆에 보조 quick action으로 배치할 수 있다.

예:
- Sneak Attack 관련 attack shortcut
- Healing Word recent shortcut

단 category hotbar로 확장하지 않는다.

## 7.3 Initiative resting intent

전투에서는 자주 쓰는 항목의 우선순위를 바꿀 수 있다.

- Attack
- Magic
- Dash
- Disengage
- Dodge
- Help
- `모든 행동`

화면 폭이 부족하면 4~5개 + overflow로 줄인다.

## 7.4 Intent 선택 상태

예: Attack

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← 공격      [Longsword +5] [Shortbow +4] [Unarmed +5]        [취소]         │
│              선택 불가 항목은 이유를 카드/tooltip에 직접 표시               │
└──────────────────────────────────────────────────────────────────────────────┘
```

Dock은 약 120~180px까지 확장할 수 있다.

## 7.5 Detail + Rules

공격/주문 detail에는:

- 이름
- 주요 수치
- 비용/resource
- 짧은 effect
- `규칙 보기`

를 제공한다.

Rules를 열어도 현재 detail 선택은 유지한다.

---

# 8. Target Selection layout

## 8.1 등장 조건

실제 action이 target을 요구할 때만 Main Focus에 target chooser가 나타난다.

## 8.2 Freeform chooser

화면 중앙 전체를 grid로 바꾸기보다 Main Focus 하단/중앙에 compact strip/list를 표시한다.

```text
대상을 선택하세요
[ Goblin A ] [ Goblin B ] [ Cultist ] [ Ally: Mira ]
```

- targetable만 strong affordance
- invalid target은 disabled reason
- multi target: `2 / 3 선택`

## 8.3 Spatial fallback

Spatial module이 없을 때 target card에는 거리 숫자를 만들어내지 않는다.

- 거리 정보 없음 = 정상
- otherwise-valid target 모두 selectable
- `5 ft 내 대상 없음` 문구 금지

---

# 9. Initiative / Combat Expansion

Initiative는 같은 Session Shell의 확장 상태다.

## 9.1 추가되는 영역

Session Bar 아래에 compact Initiative Strip을 추가한다.

높이 목표: 약 64~88px.

```text
Round 3   [Aelar 18] [Goblin 15 ●] [Mira 12] [Cultist 8]    [다음 턴]
```

현재 turn actor는 명확하게 강조한다.

전체 Actor board로 화면을 교체하지 않는다.

## 9.2 Player Combat 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Session · 이니셔티브 · 3라운드                               [Aelar HP] [⋯] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Aelar 18] [Goblin 15 ●] [Mira 12] [Cultist 8]                             │
├───────────────────────────────────────────────────────────────────┬──────────┤
│                                                                   │ Sheet    │
│      현재 턴 / 필요한 target context                              │ Rules    │
│                                                                   │ Activity │
│      action economy는 현재 actor에 대해서만 compact하게 표시      │          │
│      Action ●  Bonus ●  Reaction ●  Move 30/30                    │          │
│                                                                   │          │
├───────────────────────────────────────────────────────────────────┴──────────┤
│ [공격] [마법] [질주] [이탈] [회피] [도움] [모든 행동]   [턴 종료]           │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 9.3 DM Combat

DM은 Initiative Strip 오른쪽에:

- `다음 턴`
- `전투 종료`

를 가까이 둔다.

Actor switch는 current turn과 별개로 가능한 경우 별도 Actor control을 유지한다.

---

# 10. Quick Sheet visual contract

## 10.1 Desktop 위치

우측 Utility Rail의 왼쪽에서 안쪽으로 열리는 anchored pane.

폭:
- 목표 360px
- 허용 320~420px

Session Bar 아래부터 Action Dock 위까지의 높이를 사용한다.

Main Focus를 약간 줄일 수 있으나 최소 usable width 이하로 밀지 않는다.

## 10.2 Quick Sheet 와이어프레임

```text
┌───────────────────────────────┐
│ [portrait] Aelar        [□] X │
│ Fighter 5 · Human             │
├───────────────────────────────┤
│ HP 24 / 31      AC 17        │
│ Temp 0          Speed 30     │
│ Init +3         Prof +3      │
│ Passive Perception 14        │
├───────────────────────────────┤
│ Conditions                    │
│ [Blessed] [Concentrating]     │
├───────────────────────────────┤
│ Resources                     │
│ Second Wind 1/1               │
│ Hit Dice 3/5                  │
│ Spell Slots 1: ●●○○           │
├───────────────────────────────┤
│ Attacks                       │
│ Longsword +5   1d8+3 [Roll]  │
│ Shortbow  +4   1d6+2 [Roll]  │
├───────────────────────────────┤
│ Spells / Features             │
│ [Healing Word] [Action Surge] │
├───────────────────────────────┤
│ [공식 시트 스타일 ▾] [전체 시트]│
└───────────────────────────────┘
```

## 10.3 Quick Sheet priority

스크롤 없이 가능한 한 첫 viewport에:

1. identity
2. HP/AC
3. key combat/navigation stats
4. conditions
5. key resources
6. frequent attacks

Spells/features는 아래로 이어질 수 있다.

## 10.4 직접 굴림

Attack, ability/save/skill quick roll을 지원하는 경우 click 즉시 body-level Cinematic Dice로 연결한다.

Quick Sheet 내부에 dice viewport를 만들지 않는다.

---

# 11. Full Character Sheet visual contract

## 11.1 Wide desktop

기본 선택은 **large centered workspace overlay**다.

이유:
- Official-style Sheet의 정보 밀도를 충분히 확보
- Session Shell은 뒤에서 mounted 상태 유지
- split view를 강제하면 작은 laptop에서 두 화면이 모두 좁아질 위험

### 기본 크기

- width: viewport의 약 88~94%
- height: Session Bar 아래에서 Action Dock 위 또는 거의 전체 workspace
- 최대 폭 token을 둘 수 있음

Session Bar는 가능하면 계속 보인다.

## 11.2 와이어프레임

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Session Bar                                                   [Aelar HP]     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Aelar Character Sheet        [SimpleVTT | 공식 시트] [Rules] [닫기 X] │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │                         FULL SHEET CONTENT                             │  │
│  │                                                                        │  │
│  │   Sheet scroll / tabs stay local to this layer                        │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│             underlying Session Shell remains mounted                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 11.3 Layout switch

상단 Sheet toolbar에:

- `SimpleVTT`
- `공식 시트 스타일`

두 option을 명시적으로 제공한다.

같은 canonical Character를 다른 presentation으로 볼 뿐이다.

## 11.4 Rules from Sheet

Full Sheet 위에서 Rules를 열면 Rules pane이 Sheet의 오른쪽 위 layer로 올라온다.

첫 Escape/close:
- Rules만 닫힘

두 번째 Escape/close:
- Full Sheet 닫힘

Session Shell은 유지한다.

## 11.5 Sheet close

button label은 `플레이로 돌아가기`가 아니라 단순히 `시트 닫기` 또는 X다.

왜냐하면 사용자는 플레이를 떠난 적이 없기 때문이다.

---

# 12. Rules Pane visual contract

## 12.1 Desktop

우측 400~460px side pane.

Quick Sheet와 동일한 rail side에서 열린다.

동시에 Quick Sheet와 Rules를 작은 pane 두 개로 나란히 쌓지 않는다.

- Quick Sheet에서 Rules를 열면 Quick Sheet context는 보존하되 Rules가 active pane이 됨
- 닫으면 Quick Sheet 또는 이전 launcher context로 복귀

## 12.2 구조

```text
┌──────────────────────────────────┐
│ Rules                        X   │
│ [검색........................]   │
├──────────────────────────────────┤
│ 최근 본 규칙                     │
│                                  │
│ Search results / detail          │
│                                  │
│ Longsword                        │
│ Martial melee weapon ...         │
│                                  │
└──────────────────────────────────┘
```

검색은 focus 진입점이 명확해야 한다.

---

# 13. Activity / Result History

Activity는 permanent feed가 아니다.

우측 drawer에서:

- 최근 human-readable action/result
- actor
- outcome
- DM이면 Undo 가능 여부

를 시간 순으로 보여준다.

Freeform Main Focus에는 Activity 전체를 복제하지 않는다.

---

# 14. DM utility visual contracts

## 14.1 Encounter Pane

우측 large pane 또는 width 420~520px split drawer.

상단:
- Encounter 이름/상태
- `+ Combatant`

목록:
- Combatant name
- HP/AC compact
- Initiative 중인지/현재 turn인지
- remove/edit action은 contextual

Combatant Picker는 Encounter pane 안에서 nested subpane/modal로 열린다.

## 14.2 Participants

폭 320~420px.

각 row:

```text
[portrait] Mira · Wizard 5     Connected
```

reconnecting/disconnected만 상태를 강조한다.

Ready checkbox 없음.

## 14.3 Handout

Handout tool은 drawer/modal.

- local preview가 큰 비중
- `플레이어에게 보여주기`
- active일 때 `회수`

이미지 파일 manager/library 페이지로 확장하지 않는다.

---

# 15. Cinematic Dice layer

Dice는 layout 영역이 아니라 **presentation layer**다.

z-order:
- Session/Sheet/Rules 위에서 visible
- blocking modal보다 아래 또는 interaction 의미에 맞게 조정

주사위는 화면 깊은 곳에서 시작해 사용자 쪽으로 이동한다.

중요:
- Action Dock가 아래로 밀리지 않음
- Full Sheet가 resize되지 않음
- Quick Sheet가 재배치되지 않음
- result는 authoritative outcome과 일치

---

# 16. Result feedback placement

Dice 이후 compact result card는 화면 중앙 하단 또는 Action Dock 위에 잠깐 표시한다.

예:

```text
Aelar · Longsword
명중 18 vs AC 15
8 slashing damage
```

DM이면 작은 `상세` / `Undo` affordance를 붙일 수 있다.

Result는 Action Dock나 Sheet를 영구 점유하지 않는다.

---

# 17. Responsive visual states

## 17.1 >= 1200px

- 우측 Utility Rail 고정
- Quick Sheet/Rules/Activity side pane
- Full Sheet large overlay
- Action Dock 한 줄 중심

## 17.2 900~1199px

- Rail icon 유지 가능
- Quick Sheet/Rules는 360px drawer overlay 성격 강화
- Main Focus를 과도하게 squeeze하지 않음
- Action Dock 2-row 허용

## 17.3 < 900px 또는 매우 좁은 창

Utility Rail -> bottom utility strip 또는 compact top controls.

Quick Sheet / Rules:
- full-height drawer

Full Sheet:
- full workspace overlay

Action Dock:
- bottom sheet 형태의 contextual expansion
- primary action / close / back 항상 viewport 안

## 17.4 매우 낮은 높이

높이 < 약 650px에서는:
- Session Bar 44~48px로 compact
- Action Dock resting height 축소 가능
- pane 내부 자체 scroll
- body 전체가 pane 때문에 double-scroll되지 않도록 한다.

---

# 18. Visual density budget

Freeform 기준 동시에 강하게 보이는 primary 영역은 최대 세 가지 정도로 제한한다.

1. Session identity / current Character
2. Main Focus의 현재 context
3. Action Dock

Utility Rail은 launcher로 존재하지만 시각적으로 secondary다.

Initiative가 시작되면 Initiative Strip과 current-turn economy가 추가되지만 기존 영역을 모두 그대로 강하게 유지하지 않는다.

---

# 19. 상태별 UI matrix

| 상태 | Session Bar | Main Focus | Action Dock | Extra |
|---|---|---|---|---|
| Player Freeform | Character chip | low-noise | freeform intents | none |
| DM Freeform | Actor chip | low-noise + DM empty CTA | freeform intents + Initiative | DM rail |
| Intent selected | 유지 | context 유지 | detail options로 확장 | cancel/back |
| Target selecting | 유지 | target chooser 등장 | selected action summary | no actor wall |
| Initiative | round/turn | current-turn context | combat intents | Initiative Strip/economy |
| Quick Sheet | 유지 | 뒤에서 유지 | 유지 | right pane |
| Full Sheet | 유지 | overlay 뒤에서 mounted | state 보존 | large layer |
| Rules | 유지 | 뒤에서 유지 | action context 보존 | right pane |
| Reconnecting | 유지 | 가능한 한 유지 | risky network action 제한 | compact warning |
| Blocking failure | 유지 가능한 한 유지 | dim | disabled as needed | recovery modal |

---

# 20. 시각적 의미 계층

## Primary

- current Character/Actor
- current action step
- target 선택
- current turn
- destructive confirmation

## Secondary

- session name
- recent result
- resource summaries
- utility rail

## Tertiary

- connection healthy state
- timestamps
- technical detail

Primary/secondary/tertiary가 모두 같은 크기와 contrast로 보이면 실패다.

---

# 21. 구현 시 금지되는 레이아웃

다음은 이 계약 위반이다.

- 세션 중 기존 Library sidebar 전체를 그대로 유지하면서 Session Shell을 그 안의 한 route로 넣기
- `플레이로 돌아가기` 버튼이 정상 세션 navigation의 필수 요소
- Player Character Sheet를 Utility overflow 2단계 아래에 숨김
- Freeform 중앙을 항상 NPC/Party card grid로 채움
- Freeform에 action/bonus/reaction/movement rail 상시 노출
- Action Dock를 `공통/클래스/주문/아이템/패시브/커스텀` 탭 bar로 구성
- Quick Sheet와 Rules pane을 동시에 나란히 열어 Main Focus를 지나치게 압축
- Full Sheet가 Session Shell을 unmount
- Rules를 열면 current intent/action selection을 reset
- 좁은 창에서 close/back이 viewport 밖으로 이동
- Sheet 안에 dice stage를 위한 별도 layout region 생성

---

# 22. 구현 직전 acceptance — visual contract

코드 구현을 시작하기 전에 다음 질문에 문서로 답이 존재해야 한다.

1. Player가 Session 중 Character Sheet를 어디서 1-click으로 여는가? — Session Bar Character Chip
2. Full Sheet는 어디에 뜨는가? — mounted Session Shell 위 large workspace layer
3. Rules는 어디에 뜨는가? — Utility Rail 기반 right pane/drawer
4. Freeform 중앙은 무엇이 차지하는가? — 대화/탐험을 위한 low-noise Main Focus
5. target은 언제 나타나는가? — action이 target을 요구할 때만
6. Initiative는 새 페이지인가? — 아니며 같은 Shell의 strip/economy 확장
7. DM Encounter는 어디서 여는가? — one-click rail pane
8. Dice는 어디에 뜨는가? — body/app presentation layer
9. narrow viewport에서는 pane이 어떻게 되는가? — drawer/full overlay
10. tool을 닫으면 어디로 돌아가는가? — 바로 이전 Session context

---

# 23. 다음 세부 기획 순서

이 visual layout contract가 승인되면 더 이상 전체 제품 기획을 늘리지 않는다.

다음 세부 문서는 구현 slice와 1:1로 연결한다.

1. `S-00 Session Shell component contract`
   - exact component boundaries / state ownership / layer host
2. `Quick Sheet information architecture`
   - 실제 field/section/action 목록
3. `Full Sheet in-session reuse contract`
   - standalone sheet component reuse / layout mode switching
4. `Freeform Action Dock behavior table`
   - intent별 detail source / target need / Rules deep-link
5. 이후 source implementation 시작

이 단계부터는 문서가 구현을 미루는 목적이 아니라 **각 slice의 acceptance checklist** 역할을 해야 한다.
