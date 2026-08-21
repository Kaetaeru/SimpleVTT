# SimpleVTT UI/UX Glossary and Terminology Guard

Status: **Mandatory interpretation aid for UI planning, implementation and QA**

이 문서는 용어의 의미를 고정한다.

목표는 특히 `Scene`, `Play Context`, `Actor`, `Control`, `Target`, `Handout`, `Freeform`, `Initiative`처럼 일반 VTT 경험 때문에 잘못 해석하기 쉬운 단어를 보호하는 것이다.

새 Product Decision을 만들지 않는다.

---

# 1. 용어 사용 규칙

하나의 단어가 일반 게임/VTT 업계에서 다른 뜻을 갖더라도 SimpleVTT에서는 아래 정의를 우선한다.

모호하면:

1. Domain/Architecture contract 확인;
2. Product Decision 확인;
3. accepted prototype/contract 확인;
4. 그래도 불명확하면 Planning Gap으로 올린다.

**업계 관습으로 빈칸을 채우지 않는다.**

---

# 2. Product / navigation terms

## Product Shell

뜻:

- SimpleVTT 전체 앱의 공통 제품 프레임;
- global navigation과 top-level destinations를 포함.

Top-level destinations:

```text
Home / Characters / Session / Content / Rules / Settings
```

뜻하지 않는 것:

- Play 전용 HUD;
- left permanent sidebar;
- debug shell.

---

## Home

뜻:

- returning user의 기본 product entry;
- Character / Host / Join로 가는 orientation surface.

뜻하지 않는 것:

- Fresh first-run의 첫 화면;
- Activity dashboard;
- protocol diagnostics page.

Fresh first run은 Tutorial이 먼저다.

---

## Tutorial / Onboarding

뜻:

- Fresh user의 첫 의미 있는 panel;
- Standalone/Connected 소개;
- Official-style/SimpleVTT 초기 Sheet presentation 선택;
- Character/Host/Join 기본 orientation.

뜻하지 않는 것:

- Home에 있는 도움말 card 하나;
- 일회성 splash logo;
- runtime rules tutorial 전체.

---

# 3. Character terms

## Character

뜻:

- player-owned durable canonical Character.

UI에서 Official-style/SimpleVTT로 보이는 것은 같은 Character다.

---

## Official-style Sheet

뜻:

- 종이 캐릭터 시트 계열 정보 구조를 참고한 SimpleVTT presentation.

뜻하지 않는 것:

- 별도 Character 저장 형식;
- Wizards of the Coast 공식 자산 복제;
- connected Player 전용 Sheet.

---

## SimpleVTT Sheet

뜻:

- 디지털 사용성을 중심으로 한 같은 Character의 presentation variant.

뜻하지 않는 것:

- 별도 Character model;
- 다른 rules engine.

---

## Standalone

뜻:

- 연결 Session 없이 local Character를 사용하는 first-class product context.

Role:

```text
DM = 없음
Player = 없음
```

뜻하지 않는 것:

- local DM mode;
- fake single-player session.

---

# 4. Session / role terms

## Host

뜻:

- Connected Session의 authoritative host connection role.

Product mapping:

```text
Host = DM
```

다른 조합은 없다.

---

## Client

뜻:

- Host에 접속한 connected client role.

Product mapping:

```text
Client = Player
```

---

## DM

뜻:

- Connected Host의 play role.

DM은 shared session state의 authority와 관련된 UI를 볼 수 있지만, UI component 자체가 authority를 만드는 것은 아니다.

---

## Player

뜻:

- Connected Client의 play role.

Player에게 허용되지 않은 private event는 UI에서 단순 hide하는 것이 아니라 projection/delivery 계약상 전달되지 않아야 한다.

---

## Live Session

뜻:

- Host가 Session을 Open한 순간부터 authoritative session이 이미 진행 가능한 상태.

뜻하지 않는 것:

- Lobby;
- Ready waiting room;
- DM Start button을 기다리는 준비 단계.

Zero Player도 valid live Host/DM session이다.

---

# 5. Play-space terms

## Play

뜻:

- Connected Session 중 Actor/Action/Resolution을 다루는 dedicated operational workspace.

뜻하지 않는 것:

- global navigation peer destination;
- tactical map screen.

---

## Play Context

뜻:

- Connected Play 중앙의 현재 interaction/presentation 영역.

표현 가능:

- action/target guidance;
- pending response;
- dice;
- result;
- Notice;
- Handout.

뜻하지 않는 것:

- Actor coordinate canvas;
- battlefield map.

---

## Tabletop Stage

뜻:

- physical tabletop 느낌을 주는 presentation 공간이라는 시각적 표현.

뜻하지 않는 것:

- terrain/map geometry;
- token board.

---

## Scene

과거 문서/코드에서 나타날 수 있는 용어.

SimpleVTT UI에서 broad 해석할 때:

```text
Scene ~= current play context / current Actor set / current session presentation context
```

**Scene이라는 이름만 보고 battlemap을 만들면 안 된다.**

---

## Battlemap

뜻:

- Actor 좌표, tactical token placement, grid/terrain/path/LoS 등을 갖는 spatial map system.

Core SimpleVTT에는 없음.

미래 optional movement/map module이 별도로 소유할 수 있지만 Core UI contract에 포함되지 않는다.

---

# 6. Actor terms

## Actor

뜻:

- Connected Play에서 현재 조작/판정/표현의 대상이 되는 Character 또는 Combatant/session entity 계열 개념.

UI에서 기본 표현은 ActorCard다.

뜻하지 않는 것:

- map token 자체.

---

## ActorCard

뜻:

- Actor를 식별하고 상태/target/control/current-turn 등을 보여주는 primary Play object.

ActorCard의 visual 위치는 거리/위치를 의미하지 않는다.

---

## ActorBoard

뜻:

- ActorCard들의 horizontal board/list.

위:

```text
NPC / Neutral / Hostile
```

아래:

```text
Player / Allied
```

뜻하지 않는 것:

- battlemap;
- initiative order 그 자체.

---

## Controlled Actor

뜻:

- 현재 사용자가 조작 맥락을 갖는 Actor.

Player:

- authoritative assignment에 따른 Actor.

DM:

- DM이 현재 control focus를 둔 Actor.

`controlled`는 `selected`, `currentTurn`, `targetSelected`와 다른 상태다.

---

## Selected Actor

뜻:

- inspection/context를 위해 선택된 Actor.

뜻하지 않는 것:

- 자동으로 controlled;
- 자동으로 target;
- 자동으로 current turn.

---

## Target

뜻:

- 선택된 Action/Resolution에서 authoritative eligibility에 따라 대상이 되는 Actor.

Target은 ActorCard/manual set으로 선택한다.

뜻하지 않는 것:

- 중앙 지도 클릭 좌표.

---

# 7. Action / capability terms

## Capability

뜻:

- 현재 Actor가 사용할 수 있거나 확인할 수 있는 Action/Spell/Item/etc의 UI-facing 기능 항목.

UI는 availability/eligibility를 계산하지 않는다.

---

## Hotbar

뜻:

- capabilities를 직접 발견/실행하기 위한 persistent Command Center region.

Baseline page family:

```text
Mixed / Action / Spell / Item / Custom
```

뜻하지 않는 것:

- intent category를 먼저 골라야만 capabilities를 볼 수 있는 funnel.

---

## Main Hand

뜻:

- canonical domain/application relation이 제공하는 default hostile-click executable relation.

UI가 "가장 그럴듯한 무기"를 선택하는 개념이 아니다.

---

## Smart fallback

뜻:

- Main Hand unavailable 시 UI가 다른 무기/주문/행동을 알아서 선택하는 것.

금지됨.

---

# 8. Mode / turn terms

## Freeform

뜻:

- initiative order/round/current turn이 없는 live Session mode.

HP/resource/effect/action은 여전히 실제다.

뜻하지 않는 것:

- rules-free mode;
- turn economy를 UI가 fake로 유지하는 mode.

---

## Initiative

뜻:

- 같은 Play workspace에 order/round/current turn/economy가 추가된 structured mode.

뜻하지 않는 것:

- 별도 Combat app/screen.

---

## Economy

뜻:

- Action / Bonus Action / Reaction / Movement 등의 authoritative turn-related projection.

Initiative에서 meaningful하다.

Freeform에서는 turn-spent 상태처럼 가짜 표현하지 않는다.

---

# 9. Resolution terms

## ActionRequest

뜻:

- 사용자가 실행을 요청한 intent/request.

직접 HP를 바꾸는 UI command가 아니다.

---

## PendingResolution

뜻:

- authoritative resolution pipeline이 아직 commit되지 않은 ephemeral work state.

UI에서는:

- resolving;
- reaction;
- choice;
- dice;

등으로 보일 수 있다.

뜻하지 않는 것:

- 모든 UI를 disable해야 한다는 신호.

---

## ResolutionEvent

뜻:

- committed authoritative event/history unit.

Activity의 durable history와 연관된다.

UI가 임의로 만들거나 변경하지 않는다.

---

## Selective locking

뜻:

- PendingResolution 중 충돌하는 interaction만 잠그고 안전한 interaction은 유지하는 정책.

UI는 conflict boundary를 계산하지 않는다.

현재 runtime technical Gap이 있음.

---

## Reaction / Interrupt

뜻:

- resolution 중 사람의 응답이 필요한 explicit timing/choice state.

현재 Play context 안에서 집중적으로 보여준다.

뜻하지 않는 것:

- 새 full-screen app.

---

## Concentration response

뜻:

- authoritative flow가 concentration 관련 input/result를 요구하는 상태.

UI가 DC/modifier를 임의 계산하지 않는다.

---

# 10. Dice / result terms

## Dice Presentation

뜻:

- authoritative/local result를 물리적인 주사위 움직임처럼 보여주는 presentation.

결과 authority가 아니다.

---

## Standalone Dice

뜻:

- 현재 Character Sheet 안/위 transient layer.

별도 window/surface가 아니다.

---

## Connected Dice

뜻:

- central Play Context/Tabletop Stage에서 transient하게 보이는 physical presentation.

배틀맵 위 dice가 아니다.

---

## Immediate Result

뜻:

- 현재 작업 맥락에서 빠르게 읽는 compact outcome.

Durable 상세 이력은 Activity가 맡는다.

---

# 11. Privacy terms

## Public

뜻:

- 현재 contract상 참가자에게 공개 가능한 authoritative projection/event.

---

## DM Only

뜻:

- DM만 받을 수 있는 private authoritative information/event.

Player UI에서 placeholder도 만들지 않는다.

---

## Hidden

이 단어만으로는 authority/privacy를 의미하지 않는다.

CSS-hidden != private.

---

# 12. Handout terms

## Handout

뜻:

- DM이 공유하는 이미지/자료 presentation.

Modes:

```text
Overlay / Upper / Full
```

뜻하지 않는 것:

- tactical map;
- Actor positioning surface.

---

## Local dismiss

뜻:

- Player가 Overlay presentation만 자신의 화면에서 접는 것.

뜻하지 않는 것:

- DM의 shared Handout state를 변경하는 것.

---

# 13. Spatial terms

## Spatial Fact

뜻:

- rules에 필요한 coordinate-independent relation fact.

예:

```text
distance = 25 ft
visibility = visible
cover = half
```

---

## Spatial Editor

SimpleVTT Core에서 뜻하는 것:

- Actor pair와 fact를 form/list로 입력/검토하는 advanced DM utility.

뜻하지 않는 것:

- coordinate map editor.

---

## Movement Module

뜻:

- 미래 optional executable spatial module이 coordinates/token/path/LoS 등을 소유할 수 있는 확장 seam.

Core Product contract와 별개다.

---

# 14. Layer terms

## Contextual Utility Pane

뜻:

- Play를 유지한 채 옆에서 여는 Activity/Encounter/Participants/Rules/Session/DM facts 등의 도구.

뜻하지 않는 것:

- global destination;
- Play replacement.

---

## Quick Sheet

뜻:

- Play를 유지한 lightweight Character detail layer/pane.

---

## Full Sheet

뜻:

- live Session을 유지한 채 크게 여는 Character Sheet layer.

Session을 종료하거나 별도 Character app로 이동하는 것이 아니다.

---

## NOTICE

뜻:

- 현재 task/session에 영향을 주는 persistent condition/status communication.

예:

- reconnecting;
- DM Only active;
- live content snapshot warning.

뜻하지 않는 것:

- Activity feed 복제.

---

# 15. 개발/기획 문서 용어

## Accepted Prototype

뜻:

- Owner가 visual/interaction 기준으로 승인한 특정 prototype revision.

현재:

```text
integrated-reference.html
4c12084bef603866b9b69f1bfd8f363146920184
```

Prototype mock logic은 production authority가 아니다.

---

## Contract

뜻:

- accepted prototype과 canonical sources에서 추출한 implementation-facing requirement.

Product Decision을 자동 Freeze하지 않는다.

---

## Reviewed

뜻:

- planning truth로 검토 완료.

뜻하지 않는 것:

- runtime implementation-ready;
- Frozen.

---

## Frozen

뜻:

- runtime dependency로 안정화된 Product/UX decision 상태.

AI가 임의로 Frozen으로 올리지 않는다.

---

## Planning Gap

뜻:

- 아직 필요한 Domain/Architecture/Product contract가 없는 지점.

Gap이 있으면 UI가 추측해서 채우지 않는다.

---

# 16. 빠른 모호성 판정표

| 표현 | 올바른 해석 | 금지된 자동 해석 |
| --- | --- | --- |
| Scene | current play context | battlemap |
| Tabletop | presentation feel | grid board |
| Actor | play entity | token |
| Position | 문맥 확인 필요 | x/y 좌표 |
| Target | Actor/manual set | map point |
| Range | authoritative fact/rule | circle overlay |
| Visibility | fact | LoS ray |
| Handout | shared image | map |
| Control | Actor control context | ownership |
| Selected | UI selection | target/control/current turn |
| Hidden | presentation state | privacy guarantee |
| Freeform | no turn order | rules disabled |
| Initiative | structured state | separate combat app |

---

# 17. 최종 원칙

> **SimpleVTT 용어는 일반 VTT 관습이 아니라 SimpleVTT의 Domain/UX 계약으로 해석한다. 모호한 단어 하나를 근거로 새로운 제품 기능을 발명하지 않는다.**
