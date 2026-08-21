# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → Reference Prototype 재구축 → Owner Acceptance → 구현 계약 추출 → 첫 Runtime Slice 구현 준비 → WO-UI-001 scoped Freeze**까지 진행된 상태입니다.

이제 UI의 기준은 흩어진 과거 문서나 현재 코드가 아니라 다음 네 층을 함께 읽습니다:

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions + `INTEGRATED-PRODUCT-UX-PLAN.md`;
3. Owner가 승인한 `integrated-reference.html`;
4. Accepted Prototype에서 추출한 상세 implementation contract set.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **완료 — 0개 남음** |
| Repository-wide Product/UI audit | **완료** |
| Integrated Product/UX baseline | **Active** |
| Core map model | **MAPLESS — battlemap 없음** |
| `prototype/app/index.html` | **Rejected / Historical** |
| `prototype/app/final-spec.html` | **Invalidated / Historical** |
| `prototype/app/integrated-reference.html` | **OWNER ACCEPTED** |
| Prototype Owner Acceptance | **PASS — 2026-08-21** |
| Implementation Playbook | **작성됨** |
| Terminology Guard | **작성됨** |
| Runtime Surface contract | **작성됨** |
| Runtime Component contract | **작성됨** |
| Interaction/State/Layer/Motion contract | **작성됨** |
| End-to-end Behavior Scenarios | **48개 작성됨** |
| Implementation traceability | **작성됨** |
| QA Acceptance Matrix | **작성됨** |
| First Runtime Slice | **WO-UI-001 선택 / 준비 완료** |
| WO-UI-001 src/tests 조사 | **완료** |
| WO-UI-001 Domain/Architecture blocker | **없음 — 복잡한 Gap 영역은 scope 밖으로 분리** |
| WO-UI-001 scoped Freeze | **ACTIVE — 10개 dependency를 이 Work Order 범위에서 고정** |
| Runtime `src/` 구현 | **아직 승인되지 않음** |

Accepted prototype:

```text
prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

First Runtime Work Order:

[`work-orders/WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md`](work-orders/WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md)

Scoped Freeze record:

[`work-orders/WO-UI-001-SCOPED-FREEZE.md`](work-orders/WO-UI-001-SCOPED-FREEZE.md)

---

# 현재 선택된 첫 Runtime Slice

## WO-UI-001 — Product Shell + First-run Tutorial + Sheet Presentation Preference

이 Slice는 실제 UI 전체를 한 번에 갈아엎지 않습니다.

목표는 다음 일곱 가지로 제한합니다.

```text
1. Fresh first use -> Home보다 Tutorial이 먼저
2. Tutorial -> Standalone / Host / Join 설명
3. Tutorial -> Official-style / SimpleVTT 초기 Sheet 선택
4. Tutorial 완료 + Sheet preference를 local preference로 저장
5. Returning launch -> Home
6. Settings/Help -> Tutorial 다시 열기
7. Product Shell -> permanent left sidebar가 아닌 accepted top navigation
```

현재 `src/`와 관련 테스트도 다시 조사했습니다.

확인된 주요 drift:

- `src/App.tsx`는 normal route를 Home부터 시작함;
- `src/App.tsx` / `src/v1-product-shell.css`가 permanent left sidebar를 primary Product navigation으로 사용함;
- `src/V1HomeScreen.tsx`의 기존 onboarding은 Home 안의 dismissible guide이며 required initial Sheet choice가 없음;
- `tests/ui/v1ProductShellStructure.test.ts`가 Home-first와 permanent `.v1-sidebar`를 성공 조건으로 고정하고 있어 현재 accepted contract 기준으로는 부분 stale test임.

재사용 가능한 기반:

- global destination set/order는 이미 거의 맞음;
- `src/app/sheetLayoutPreferences.ts`는 Sheet presentation을 Character data와 분리해 localStorage로 저장함;
- `src/CharacterSheetPlayScreen.tsx`는 두 Sheet가 같은 `snapshot.activeCharacter`를 사용함;
- Character/domain/runtime 테스트의 대부분은 이번 Slice 밖이며 그대로 보존 가능.

---

# 이번 Slice에서 의도적으로 건드리지 않는 것

현재 `src/ProductRoot.tsx`는 connected session에서 Product Shell을 우회하고 `SessionModeRoot`만 렌더합니다.

이건 accepted `Return to Play` 모델과 충돌하는 실제 drift이지만, 첫 Slice에 같이 넣으면 Connected Play composition까지 범위가 커집니다.

따라서 **WO-UI-002 — Connected Product Shell Continuity / Return to Play**로 분리했습니다.

WO-UI-001에서는 다음을 건드리지 않습니다:

```text
ProductRoot connected composition
SessionModeRoot
ProductionPlayScreen
Actor Boards
Command Center
Targeting / Main Hand
Resolution / selective locking
DM-only privacy
Handout networking
Session authority / transport / lifecycle
Character creation / Level Up rules
map/spatial modules
```

---

# WO-UI-001 scoped Freeze

Owner 승인에 따라 다음 10개 Reviewed Product/UX dependencies를 **WO-UI-001 구현 범위에 한해서** 안정적 implementation dependency로 고정했습니다.

```text
UX-01-01
UX-01-02
UX-03-01
UX-03-05
NAV-01-01
NAV-01-04
NAV-01-07
NAV-01-08
UI-01-01
UI-01-07
```

이 scoped Freeze는 `docs/design/ui-ux-planning-framework.md`의 explicit scoped authorization 예외를 사용합니다. 전역 Decision lifecycle을 임의로 변경하지 않으며, **WO-UI-001 안에서만** 구현자가 이 10개 결정을 안정적인 의존성으로 재해석 없이 사용할 수 있습니다.

기록:

[`work-orders/WO-UI-001-SCOPED-FREEZE.md`](work-orders/WO-UI-001-SCOPED-FREEZE.md)

---

# WO-UI-001에 남은 마지막 게이트

## Explicit Runtime Implementation Authorization

Work Order, source/test inspection, Domain/Architecture blocker 확인, scoped Freeze까지 모두 끝났습니다.

하지만 실제 `src/`와 runtime test를 수정하려면 **별도의 명시적 구현 승인**이 여전히 필요합니다.

현재:

```text
WO-UI-001 PREPARATION: COMPLETE
WO-UI-001 SCOPED FREEZE: ACTIVE
WO-UI-001 DOMAIN/ARCHITECTURE BLOCKER: NONE
WO-UI-001 IMPLEMENTATION AUTHORIZED: NO
Runtime src changes: NONE in preparation/freeze steps
```

---

# 구현자가 가장 먼저 읽어야 하는 문서

## 전체 제품 설명 / 오해 방지

[`contracts/IMPLEMENTATION-PLAYBOOK.md`](contracts/IMPLEMENTATION-PLAYBOOK.md)

처음 SimpleVTT를 보는 사람/AI가 가장 먼저 읽는 설명서입니다.

여기에는:

- SimpleVTT가 무엇인지;
- 무엇이 아닌지;
- battlemap이 왜 없는지;
- Tutorial-first;
- same-Sheet dice;
- Connected Play 구조;
- Host/Join;
- Freeform/Initiative;
- Actor click 우선순위;
- Main Hand no-fallback;
- privacy;
- Handout/spatial;
- 흔한 오해/잘못된 구현 예;

가 한 번에 정리되어 있습니다.

## 용어사전

[`contracts/GLOSSARY-AND-TERMINOLOGY.md`](contracts/GLOSSARY-AND-TERMINOLOGY.md)

특히 아래 단어를 일반 VTT 의미로 함부로 해석하지 않게 합니다:

```text
Scene
Play Context
Tabletop Stage
Actor
ActorCard
Control
Selected
Target
Freeform
Initiative
DM Only
Handout
Spatial Fact
```

각 용어마다 `뜻 / 뜻하지 않는 것`을 적었습니다.

---

# 상세 구현 계약 세트

진입점:

[`contracts/README.md`](contracts/README.md)

필수 읽기 순서:

```text
1. IMPLEMENTATION-PLAYBOOK.md
2. GLOSSARY-AND-TERMINOLOGY.md
3. SURFACE-CONTRACT.md
4. COMPONENT-CONTRACT.md
5. INTERACTION-STATE-MOTION-CONTRACT.md
6. BEHAVIOR-SCENARIOS.md
7. IMPLEMENTATION-TRACEABILITY.md
8. QA-ACCEPTANCE-MATRIX.md
9. MANIFEST.yaml
```

## Surface

[`contracts/SURFACE-CONTRACT.md`](contracts/SURFACE-CONTRACT.md)

화면 구조와 공존 관계.

## Component

[`contracts/COMPONENT-CONTRACT.md`](contracts/COMPONENT-CONTRACT.md)

ActorCard, ActorBoard, Command Center, Hotbar, Activity, Dice 등 각 UI의 책임.

## Interaction / State / Layer / Motion

[`contracts/INTERACTION-STATE-MOTION-CONTRACT.md`](contracts/INTERACTION-STATE-MOTION-CONTRACT.md)

클릭 우선순위, targeting, resolution, layer, focus, Reduced Motion 등.

## 실제 사용자 시나리오 48개

[`contracts/BEHAVIOR-SCENARIOS.md`](contracts/BEHAVIOR-SCENARIOS.md)

형식:

```text
Start state
-> User action
-> Expected UI
-> preserved state
-> forbidden behavior
```

## QA Matrix

[`contracts/QA-ACCEPTANCE-MATRIX.md`](contracts/QA-ACCEPTANCE-MATRIX.md)

Runtime slice마다 각 행을:

```text
PASS / FAIL / BLOCKED / N/A
```

로 검증합니다.

`BLOCKED`인 기술 계약을 UI가 임의 구현해서 `PASS`로 만드는 것은 금지했습니다.

---

# 제품을 한 장으로 보면

```text
Fresh App
-> Tutorial
-> Home

Home
├ Characters -> Library -> Sheet / Create / Level Up
├ Host -> immediately live Host/DM Freeform
├ Join -> Character Select -> current live Client/Player state
├ Content
├ Rules
└ Settings

Connected Play
├ Compact Play chrome/status
├ Upper NPC/Neutral/Hostile Actor Board
├ Play Context / Tabletop Stage        [contextual utility]
├ Lower Player/Allied Actor Board
└ Persistent Command Center
```

중앙 `Play Context`는 battlemap이 아닙니다.

---

# 가장 중요한 불변조건

## 1. Battlemap 없음

Core에서 금지:

```text
Actor x/y tactical position
map token dragging
grid / hex
pathfinding / collision
movement trace
Fog of War
LoS geometry
range ring / tactical AoE map template
```

## 2. First Run = Tutorial

Home보다 Tutorial이 먼저입니다.

Tutorial 안에서 Official-style / SimpleVTT Sheet presentation을 고릅니다.

## 3. 같은 Character, 두 Sheet presentation

Sheet를 바꿔도 Character가 바뀌지 않습니다.

## 4. Standalone Roll은 Sheet 안에서

별도 Dice window/modal/page가 없습니다.

## 5. Host=DM / Client=Player

Offline은 DM/Player 역할이 없습니다.

## 6. Freeform과 Initiative는 같은 Play

Initiative는 같은 화면에 tracker/turn/economy를 추가합니다.

## 7. Targeting은 ActorCard/manual set

map position으로 target을 고르지 않습니다.

## 8. Main Hand smart fallback 없음

불가능하면 이유를 보여주고 멈춥니다.

## 9. DM Only는 CSS hide가 아님

Player에게 private event 존재 자체를 보내지 않는 architecture가 필요합니다.

## 10. Handout은 image presentation

Battlemap으로 사용하지 않습니다.

---

# 아직 다른 Runtime Slice를 막는 기술 Gap

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

이 네 Gap은 **WO-UI-001의 blocker가 아닙니다.** 해당 기능을 첫 Slice 범위에서 제외했기 때문입니다.

상세 매핑:

[`contracts/IMPLEMENTATION-TRACEABILITY.md`](contracts/IMPLEMENTATION-TRACEABILITY.md)

---

# 앞으로 Runtime Work Order가 반드시 포함해야 하는 것

반드시:

```text
- exact runtime slice
- accepted prototype reference
- Frozen Decision IDs or explicit scoped dependency authorization
- Domain/Architecture sources
- touched contract sections
- touched Behavior Scenario IDs
- touched QA Matrix row IDs
- authoritative state/projection sources
- open blocker Gaps
- exact src/tests
- out-of-scope
- stop conditions
```

를 적어야 합니다.

WO-UI-001은 이 형식으로 작성되었습니다.

---

# 현재 단계

```text
Repository-wide audit                      DONE
Integrated Product/UI plan                 DONE
Mapless Reference Prototype                DONE
Owner Prototype Acceptance                 PASS
Detailed contract set                      DONE
Behavior Scenarios (48)                    DONE
QA Acceptance Matrix                       DONE
WO-UI-001 source/test inspection            DONE
WO-UI-001 Work Order                        DONE
WO-UI-001 Domain/Architecture blockers       NONE
WO-UI-001 scoped dependency freeze           ACTIVE
-> explicit runtime implementation approval NEXT
-> src implementation
-> targeted + regression + visual QA

Deferred:
WO-UI-002 Connected Product Shell continuity / Return to Play
```

**실제 `src/` UI는 아직 수정하지 않았습니다. 다음 단계는 WO-UI-001의 explicit Runtime implementation 승인입니다.**