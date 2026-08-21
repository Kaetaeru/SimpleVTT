# Owner Review — Foundation / Navigation / Layout / Interaction

Sheets: `UX-03`, `NAV-01`, `UI-01`, `INT-01`

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# UX-03 — Information Hierarchy

### UX-03-01 — Global destination vs Contextual tool boundary

**질문:** 어떤 영역을 Product-level Global destination으로 두고, 어떤 영역을 현재 작업/세션에 붙는 Contextual tool로 둘 것인가?

**선택지**
- `A` — Home / Characters / Session / Content / Rules / Settings만 Global. Activity / Encounter / Adjudication / Session utilities는 Contextual.
- `B` — A와 같되 Activity는 Global history destination으로 승격.
- `C` — Home / Characters / Session만 핵심 Global로 두고 Content / Rules / Settings도 secondary/contextual 진입으로 축소.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UX-03-02 — Product Shell ↔ Live Play hierarchy

**질문:** Product Shell과 Live Play 사이를 계층적으로 어떻게 연결할 것인가?

**선택지**
- `A` — Play에서도 Product Shell navigation을 완전히 계속 노출.
- `B` — Play는 전용 workspace로 전환하지만 Global로 돌아갈 compact persistent entry는 유지.
- `C` — Play는 거의 독립된 full workspace이며 명시적 Exit/Return control로만 Product Shell에 복귀.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `B`

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UX-03-03 — Permanent UI vs Contextual UI

**질문:** 어떤 UI를 항상 보이는 Permanent UI로 두고, 어떤 UI를 상황에 따라 여는 Contextual UI로 둘 것인가?

**선택지**
- `A` — 핵심 anchors/capabilities는 Permanent, task/role/detail utilities는 Contextual.
- `B` — 핵심 anchors + 자주 쓰는 Session/DM utilities까지 Permanent.
- `C` — 핵심 anchors만 Permanent, 나머지는 최대한 Contextual.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UX-03-04 — Play Workspace information priority

**질문:** Play Workspace에서 어떤 정보가 가장 높은 시각/정보 우선순위를 가져야 하는가?

**선택지**
- `A` — Scene/Actor Context + Command Center 공동 1순위 → current turn/resolution/status 2순위 → utilities/history 3순위.
- `B` — Scene/Actor Context + Command Center + turn/status를 모두 1순위 operational layer로 취급.
- `C` — 공통 anchors는 유지하되 DM/Player 역할별 operational information을 동급 1순위까지 올릴 수 있음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `B`

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UX-03-05 — Standalone Character Sheet priority

**질문:** Standalone Character Sheet에서 가장 먼저 읽히고 접근되어야 하는 정보/행동은 무엇인가?

**선택지**
- `A` — Character identity / HP / core stats + 자주 쓰는 actions/rolls 우선, 상세 record는 아래 계층.
- `B` — Character record의 완전한 열람을 최우선으로 하고 actions/rolls는 그 안의 주요 영역.
- `C` — actions/rolls를 최우선 operational layer로 두고 Character record는 secondary detail.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `A`

**OWNER NOTE:** `이건 공식 시트 레이아웃 버전과 SVTT버전을 선택할수있게 하는게 좋겠어.`

**AI STATUS:** `PENDING`

### UX-03-06 — Progressive disclosure scope

**질문:** Progressive disclosure를 어디까지 허용할 것인가?

**선택지**
- `A` — 보조 설명/세부정보에만 허용. 기능 자체는 거의 숨기지 않음.
- `B` — 보조정보 + advanced/rare tools는 contextual하게 숨길 수 있음. Core capabilities는 항상 직접 노출.
- `C` — Progressive disclosure를 최소 사용하고 대부분의 정보/도구를 한 화면에 직접 노출.
- `CUSTOM` — 직접 정의. Core capability direct exposure에 대한 기존 Reviewed 결정은 유지해야 함.

**OWNER SELECT:** `A`

**OWNER NOTE:** `장소에 따라 다르겠지만 웬만해선 마우스 호버링을 하면 마우스를 따라오는 프레임에서 설명이 가능하면 좋겠어.`

**AI STATUS:** `PENDING`

### UX-03-07 — Duplicate information principle

**질문:** 같은 canonical 정보를 여러 surface에 반복 표시하는 것을 어떤 원칙으로 허용할 것인가?

**선택지**
- `A` — 가능한 한 한 위치만 표시하고 중복을 최소화.
- `B` — 동일 canonical source를 사용한다면 현재 task에서 중요한 정보는 관련 surface에 의도적으로 반복 가능.
- `C` — 각 surface가 독립적으로 필요하면 폭넓게 반복 가능하되 값은 canonical projection만 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `B`

**OWNER NOTE:** `이건 나중에도 계속 이야기 해봐야할것같아. 상황에 따라 달라질테니까`

**AI STATUS:** `PENDING`

### UX-03-08 — Result / Notification / Activity priority

**질문:** 즉시 결과, notification, persistent status, Activity history를 어떤 우선순위로 배치할 것인가?

**선택지**
- `A` — 즉시 중요한 결과는 현재 Scene/Task 가까이 → 지속 문제는 Status/Banner → 상세 이력은 Activity → Toast는 짧은 비차단 피드백.
- `B` — 대부분의 이벤트를 Activity 중심으로 기록/표시하고 현재 Scene에서는 최소 요약만 보여줌.
- `C` — Toast/event-feed 중심으로 즉시 이벤트를 적극적으로 보여주고 Activity는 장기 history 역할.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# NAV-01 — Navigation

### NAV-01-01 — Top-level Product Shell destinations

**질문:** 최종 Product Shell의 top-level destination set과 order는 무엇인가?

**선택지**
- `A` — Home → Characters → Session → Content → Rules → Settings.
- `B` — Home → Characters → Session → Rules/Content Library 통합 → Settings.
- `C` — Home → Characters → Session을 primary로, Content / Rules / Settings는 secondary global group으로 분리.
- `CUSTOM` — 직접 destination set/order 정의.

**OWNER SELECT:** `A`

**OWNER NOTE:** `편하게 해줘`

**AI STATUS:** `PENDING`

### NAV-01-02 — Return to Play entry

**질문:** live session이 있을 때 Return to Play는 어디에 어떻게 노출할 것인가?

**선택지**
- `A` — Product Shell top-level navigation에 항상 보이는 Return to Play destination/badge.
- `B` — live session일 때만 나타나는 compact persistent Return to Play control.
- `C` — Home/Session destination에서만 Return to Play를 제공하고 다른 global surface에는 별도 persistent control 없음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-03 — Character navigation family

**질문:** Character Library / Sheet / Builder / Edit / Level Up의 진입과 복귀 관계는?

**선택지**
- `A` — Library가 hub. Sheet는 full destination/workspace, Builder/Edit/Level Up은 Sheet/Library에서 들어가는 task flow.
- `B` — Library / Sheet / Builder / Level Up을 각각 route-level destination으로 명시.
- `C` — Sheet가 Character 중심 hub이고 Library는 Character switcher/manager 역할. Builder/Level Up은 Sheet에서만 진입.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-04 — Rules / Content / Settings context return

**질문:** Rules / Content / Settings에 갔다가 돌아올 때 이전 Product Shell context를 어떻게 복원할 것인가?

**선택지**
- `A` — 진입 전 global destination과 해당 surface의 local context를 가능한 범위에서 복원.
- `B` — 각 utility를 독립 destination으로 보고 닫기/뒤로가기는 항상 Home 또는 고정 parent로 복귀.
- `C` — global destination은 유지하되 Rules/Content/Settings를 secondary workspace layer처럼 열고 닫으면 정확히 이전 context로 복귀.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-05 — Contextual tools vs top-level tools

**질문:** Activity / Encounter / Adjudication / Session utilities 중 무엇을 contextual로 유지할 것인가?

**선택지**
- `A` — 전부 contextual. 필요한 Play/Session/Result context에서만 launch.
- `B` — Activity만 global/history 접근 허용, Encounter/Adjudication/Session utilities는 contextual.
- `C` — Activity + Encounter를 global로 접근 가능하게 하고 Adjudication/Session utilities만 contextual.
- `CUSTOM` — 도구별로 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-06 — Back / Close / Return grammar

**질문:** Product Shell, contextual layer, full workspace에서 Back / Close / Return을 어떻게 구분할 것인가?

**선택지**
- `A` — Back=내부 navigation history, Close=contextual layer 종료, Return=상위 workspace/Play 복귀로 명확히 분리.
- `B` — 가능한 한 하나의 Back grammar로 통합하고 modal/contextual surface만 Close 사용.
- `C` — explicit breadcrumb/parent navigation을 중심으로 하고 Back은 보조 history 기능으로 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-07 — First-use guidance location

**질문:** 첫사용 가이드는 어디에 있고, 닫은 뒤 어디서 다시 열 수 있는가?

**선택지**
- `A` — Home inline/onboarding card + Help/Info에서 재열기.
- `B` — 최초 launch overlay + Settings/Help에서 재열기.
- `C` — 별도 Getting Started destination/guide를 두고 Home에는 짧은 진입점만 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### NAV-01-08 — Restart / deep-link restore policy

**질문:** app restart/deep link 시 어떤 상태는 직접 복구하고, 어떤 상태는 Home을 거쳐야 하는가?

**선택지**
- `A` — live session/reconnect context만 직접 복구, 일반 Product surface는 Home에서 시작.
- `B` — 안전하게 복원 가능한 마지막 global destination까지 복구, live session은 Play/reconnect로 직접 복귀.
- `C` — 가능한 모든 addressable safe state를 직접 복구하고 위험/불완전 task만 parent/Home으로 fallback.
- `CUSTOM` — surface별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# UI-01 — Layout & Grid

### UI-01-01 — Product Shell region grammar

**질문:** Product Shell의 primary navigation과 content 영역을 어떤 큰 레이아웃으로 구성할 것인가?

**선택지**
- `A` — 고정/축소 가능한 left navigation rail + main content.
- `B` — top navigation/header + full-width main content.
- `C` — compact left rail + optional secondary context column + main content.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-02 — Play Dual Anchor layout

**질문:** Scene/Actor Context와 bottom Command Center를 모두 co-primary로 유지하는 region model은?

**선택지**
- `A` — Scene/Table이 flexible center를 차지하고 Command Center는 fixed bottom band.
- `B` — Scene/Table full canvas + Command Center가 bottom overlay/dock으로 겹치되 scene safe-area를 보장.
- `C` — Scene/Table + Command Center를 명시적 two-region split로 두고 Command Center 높이는 content에 따라 제한적으로 변동.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-03 — Actor Board placement

**질문:** upper opposing / lower allied Actor Boards를 Scene/Table 주변에 어떻게 배치할 것인가?

**선택지**
- `A` — 상단/하단 고정 horizontal board bands.
- `B` — scene 상/하 edge에 overlay-style card rows, 필요한 safe-area 확보.
- `C` — 상/하 board zones는 유지하되 card overflow 시 horizontal scroll/paging.
- `CUSTOM` — 직접 정의. Permanent side portrait rail로 대체하는 선택은 기존 Reviewed 방향과 충돌.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-04 — Initiative Tracker placement

**질문:** top horizontal Initiative Tracker를 Actor Boards/Command Center를 대체하지 않으면서 어디에 배치할 것인가?

**선택지**
- `A` — upper Actor Board 위/앞의 dedicated top strip.
- `B` — scene top edge overlay strip with reserved safe-area.
- `C` — Play workspace top header row 안에 compact tracker를 통합.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-05 — Command Center internal regions

**질문:** bottom Command Center 내부의 큰 영역 구성을 어떻게 할 것인가?

**선택지**
- `A` — left Actor summary / center Hotbar / right economy+resources+context actions.
- `B` — left Actor+economy / center Hotbar / right contextual controls+resources.
- `C` — two-row model: top actor/economy/resources/status, bottom full-width Hotbar + contextual controls.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-06 — Session/DM utility placement

**질문:** core Play anchors를 밀어내지 않으면서 contextual Session/DM utilities는 어디를 사용해야 하는가?

**선택지**
- `A` — 좌/우 contextual side pane. 열려도 Command Center와 핵심 Actor/Scene 영역은 유지.
- `B` — drawer/overlay layer. 일시적으로 scene 일부를 덮지만 core command controls는 유지.
- `C` — floating/resizable utility panels with bounded placement.
- `CUSTOM` — utility별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-07 — Standalone Character Sheet regions

**질문:** Standalone Character Sheet의 큰 region model은?

**선택지**
- `A` — identity/summary header + multi-column main record + sticky/common actions.
- `B` — central sheet/document + contextual side detail/actions.
- `C` — tabbed major sections + persistent identity/summary strip.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-08 — Builder / Level Up regions

**질문:** Character Builder와 Level Up의 큰 region model은?

**선택지**
- `A` — step/progress rail + main work area + persistent preview/summary.
- `B` — single-column wizard + optional preview drawer/panel.
- `C` — split form/work area + live preview, progress는 top stepper.
- `CUSTOM` — Builder와 Level Up을 서로 다르게 정의해도 됨.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### UI-01-09 — Scroll / sticky ownership

**질문:** normal desktop에서 어떤 region이 scroll하고 어떤 region이 sticky/fixed여야 하는가?

**선택지**
- `A` — Product main content만 주 scroll; primary nav sticky. Play는 scene/boards/context별 내부 scroll, Command Center fixed.
- `B` — 각 major region이 독립 scroll 가능. Header/nav/Command Center만 sticky.
- `C` — Product는 page-level scroll, Play는 거의 fixed viewport + 내부 pane/card overflow만 scroll.
- `CUSTOM` — surface별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# INT-01 — Interaction

### INT-01-01 — Overlapping interaction priority

**질문:** Actor selection, selected-action targeting, DM Actor control이 겹칠 때 어떤 interaction context가 우선하는가?

**선택지**
- `A` — selected-action targeting 우선 → explicit DM control/takeover action → ordinary Actor selection/context focus.
- `B` — selected-action targeting 우선 → explicit DM control mode가 켜져 있으면 그 mode → ordinary selection.
- `C` — targeting은 항상 left-click 우선, DM control은 context menu/별도 control로만 수행하여 click-mode 충돌 자체를 제거.
- `CUSTOM` — 직접 정의. Selected action target override에 대한 기존 Reviewed 규칙은 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-02 — Actor Context Menu command categories

**질문:** Hotbar common actions를 중복하지 않으면서 Actor Context Menu에는 어떤 command category를 넣을 것인가?

**선택지**
- `A` — Inspect/Details + control/selection + role-specific DM/session utilities + uncommon contextual actions.
- `B` — Inspect/Details + control/selection만 두고 DM/session utilities는 별도 utility surface에 유지.
- `C` — 공통 Inspect/Control section + DM에게만 추가 DM Tools section.
- `CUSTOM` — category를 직접 정의. Common Hotbar action duplication은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-03 — Keyboard equivalent for context menu

**질문:** Actor Card right-click/context menu의 keyboard equivalent는?

**선택지**
- `A` — 표준 `Shift+F10` / Context Menu key 지원.
- `B` — Actor Card focus 상태에서 전용 shortcut 또는 explicit “More” key/button 제공.
- `C` — A+B 모두 지원하고 동일 menu를 연다.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-04 — Escape / Back priority

**질문:** targeting, expanded UI, pane, modal, full sheet, Play가 겹칠 때 Escape/Back의 우선순위는?

**선택지**
- `A` — innermost modal/interrupt → targeting/selection mode → contextual pane/popover → full sheet/workspace layer → global navigation.
- `B` — active targeting/command mode를 항상 가장 먼저 cancel → 그다음 topmost layer → navigation.
- `C` — topmost semantic layer가 항상 우선하며 targeting은 그 layer 안에서만 cancel; global Back은 별도 control.
- `CUSTOM` — 직접 priority stack 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-05 — Direct vs contextual actions

**질문:** 어떤 common action을 직접 control로 보여주고 어떤 action을 secondary/contextual로 보낼 것인가?

**선택지**
- `A` — 자주 쓰고 reversible/low-risk인 primary actions는 direct, rare/role-specific/destructive actions는 contextual.
- `B` — 한 surface당 한두 개의 primary action만 direct, 나머지는 context/detail layer.
- `C` — Actor/Card/Command Center에서 가능한 한 여러 frequent action을 direct로 노출하고 contextual은 truly exceptional actions에만 사용.
- `CUSTOM` — 직접 정의. Core capability direct exposure는 기존 Reviewed 결정 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-06 — Unavailable / invalid reason access

**질문:** unavailable/invalid reason을 pointer, keyboard, focus 사용자에게 어떻게 보여줄 것인가?

**선택지**
- `A` — disabled/unavailable control 근처의 tooltip/focus help + accessible description. Material blocker는 inline text도 허용.
- `B` — 모든 material unavailable state에 inline reason을 직접 표시하고 tooltip은 보조.
- `C` — compact surface는 tooltip/focus help, workflow/blocking surface는 inline reason으로 severity에 따라 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-01-07 — Selection state model

**질문:** controlled Actor, current turn, targetable, selected target, contextual focus를 어떻게 구분할 것인가?

**선택지**
- `A` — 모두 별도 orthogonal state로 유지하고 동시에 여러 indicator가 공존 가능.
- `B` — control/current-turn은 persistent badges, targeting/selected-target/context-focus는 하나의 active interaction selection layer로 단순화.
- `C` — 두 축으로 분리: authority/turn axis + interaction/target axis. Focus는 accessibility-only visual state로 별도 처리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
