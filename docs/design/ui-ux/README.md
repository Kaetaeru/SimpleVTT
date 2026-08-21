# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → Reference Prototype 재구축 → Owner Acceptance → 구현 계약 추출 → 상세 해석/시나리오/QA 문서화**까지 완료한 상태입니다.

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
| Machine-readable Contract Manifest | **작성됨** |
| Frozen Product Decisions | **추가 Freeze 없음** |
| Runtime `src/` 구현 | **아직 승인되지 않음** |

Accepted prototype:

```text
prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
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

예를 들어:

- Fresh first run;
- Sheet roll;
- Host Session;
- Join no Character;
- Freeform;
- Initiative;
- single/multi/area targeting;
- Main Hand unavailable;
- DM control;
- Reaction/Concentration;
- Dice/Result;
- DM-only Activity;
- Handout;
- reconnect;
- narrow desktop;
- optional future map module boundary;

까지 포함합니다.

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

# 아직 Runtime 구현을 막는 기술 Gap

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

상세 매핑:

[`contracts/IMPLEMENTATION-TRACEABILITY.md`](contracts/IMPLEMENTATION-TRACEABILITY.md)

---

# 앞으로 Runtime Work Order가 반드시 포함해야 하는 것

이제 단순히:

```text
"Prototype대로 구현"
```

이라고 적는 Work Order는 허용하지 않습니다.

반드시:

```text
- exact runtime slice
- accepted prototype reference
- Frozen Decision IDs
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

---

# 현재 단계

```text
Repository-wide audit                     DONE
Integrated Product/UI plan                DONE
Mapless Reference Prototype               DONE
Owner Prototype Acceptance                PASS
Implementation Playbook                   DONE
Terminology Guard                         DONE
Surface Contract                          DONE
Component Contract                        DONE
Interaction/State/Layer/Motion Contract   DONE
Behavior Scenarios (48)                   DONE
Implementation Traceability               DONE
QA Acceptance Matrix                      DONE
Machine-readable routing/gates            UPDATED
-> 첫 Runtime Slice 선택
-> 해당 Slice src/tests 재검사
-> blocker Gap 해결/회피가 아닌 scope 분리
-> touched legacy reconciliation
-> 필요한 Decision만 scoped Freeze
-> Runtime Work Order with Scenario + QA IDs
-> 별도 Runtime implementation 승인
-> src 구현
```

**지금은 Runtime Preparation 단계입니다. 실제 `src/` UI 구현은 아직 승인되지 않았습니다.**

첫 Runtime Slice 후보는 여전히 `Product Shell + First-run Tutorial + Sheet presentation preference`가 가장 안전합니다.
