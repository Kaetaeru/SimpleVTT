# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → Reference Prototype 재구축 → Owner Acceptance → 구현 계약 추출**까지 완료한 상태입니다.

이제 UI의 기준은 흩어진 과거 문서나 현재 코드가 아니라 다음 세 층을 함께 읽습니다:

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions + `INTEGRATED-PRODUCT-UX-PLAN.md`;
3. Owner가 승인한 `integrated-reference.html`에서 추출한 구현 계약.

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
| Prototype static verification | **PASS** |
| Prototype Owner Acceptance | **PASS — 2026-08-21** |
| Runtime Surface contract | **작성됨** |
| Runtime Component contract | **작성됨** |
| Interaction/State/Layer/Motion contract | **작성됨** |
| Implementation traceability | **작성됨** |
| Frozen Product Decisions | **추가 Freeze 없음** |
| Runtime `src/` 구현 | **아직 승인되지 않음** |

Accepted prototype record:

[`prototype/PROTOTYPE-ACCEPTANCE.md`](prototype/PROTOTYPE-ACCEPTANCE.md)

Accepted prototype:

```text
prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

---

# 가장 먼저 읽을 문서

## 1. 통합 제품/UI 기획

[`INTEGRATED-PRODUCT-UX-PLAN.md`](INTEGRATED-PRODUCT-UX-PLAN.md)

저장소 전체의 Product/Domain/Owner/history/code evidence를 한 기준으로 해석하는 cross-source baseline입니다.

## 2. Accepted UI/UX implementation contracts

[`contracts/README.md`](contracts/README.md)

구현자가 Prototype HTML을 직접 해석하지 않고도 작업할 수 있도록 Accepted Prototype을 다음 계약으로 분해했습니다.

- [`contracts/SURFACE-CONTRACT.md`](contracts/SURFACE-CONTRACT.md)
- [`contracts/COMPONENT-CONTRACT.md`](contracts/COMPONENT-CONTRACT.md)
- [`contracts/INTERACTION-STATE-MOTION-CONTRACT.md`](contracts/INTERACTION-STATE-MOTION-CONTRACT.md)
- [`contracts/IMPLEMENTATION-TRACEABILITY.md`](contracts/IMPLEMENTATION-TRACEABILITY.md)

---

# 1. 제품 정체성

SimpleVTT는 **local-first D&D tabletop companion**입니다.

두 경험이 동등한 핵심입니다.

```text
Standalone Character
Connected Session
```

Core에는 battlemap이 없습니다.

금지되는 기본 Core 개념:

```text
Actor x/y tactical position
map token dragging
grid / hex
pathfinding / collision
movement trace
Fog of War
LoS geometry
range ring / tactical AoE map template
3D battlefield
```

필요한 거리/visibility/cover는 Domain/모듈/DM fact에서 공급될 수 있지만 UI가 지도 배치로 만들어내지 않습니다.

---

# 2. 첫 실행

Fresh first run의 첫 의미 있는 패널은 **Tutorial / Onboarding**입니다.

```text
App boot
-> Tutorial
   -> Standalone / Connected 설명
   -> Official-style / SimpleVTT Sheet 초기 선택
   -> Character / Host / Join 방향 안내
   -> 완료
-> Home
```

Returning user는 Home에서 시작합니다.

Tutorial은 Settings/Help에서 다시 열 수 있습니다.

---

# 3. Product Shell

Top-level navigation:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

Play는 별도 live workspace이며 top-level peer navigation destination이 아닙니다.

Live Session 중 Product 화면을 보더라도 `Return to Play`가 있고, 연결 역할과 authoritative session state는 유지됩니다.

---

# 4. Standalone Character

Official-style / SimpleVTT는 같은 canonical Character를 보여주는 두 presentation입니다.

모든 일반 Roll은 현재 Sheet를 떠나지 않습니다.

```text
현재 Sheet 유지
-> Roll
-> 같은 Sheet viewport 안/위 transient physical dice
-> 결과
-> transient layer 소멸
-> 같은 Sheet 그대로 계속
```

별도 dice page/modal/drawer/result window는 만들지 않습니다.

---

# 5. Session lifecycle

Host:

```text
Host Setup
-> Open Session
-> 즉시 live Host / DM Freeform
```

Join:

```text
Join Setup
-> local Character 선택
-> 필요한 sync
-> 현재 live Client / Player state
```

기본 lifecycle에 Lobby / Ready / Start Session gate는 없습니다.

Player 0명인 live DM Session도 정상입니다.

---

# 6. Connected Play

Accepted skeleton:

```text
Compact Play chrome / status
────────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
────────────────────────────────────────
Shared Play Context / Tabletop Stage    [contextual utility]
────────────────────────────────────────
Lower Player / Allied Actor Board
────────────────────────────────────────
Persistent Command Center
```

중앙은 battlemap이 아니라 action / targeting guidance / resolution / dice / result / NOTICE / Handout presentation 공간입니다.

Actor는 중앙 x/y token이 아니라 Actor Board의 Card입니다.

---

# 7. Freeform / Initiative

Freeform:

- 같은 Play skeleton;
- fake turn economy 없음;
- normal capabilities는 Command Center/Hotbar에서 직접 발견 가능.

Initiative:

- 같은 Play skeleton;
- compact Initiative Tracker 추가;
- authoritative Action/Bonus/Reaction/Movement economy 추가;
- End Turn 추가;
- Actor Boards와 Command Center 유지.

---

# 8. Targeting / Resolution

Targeting은 Actor Card/manual target set 기반입니다.

- valid/invalid/selected는 authoritative projection에서 받음;
- single valid target은 즉시 submit;
- multi-target은 explicit Execute;
- area-like action도 Core에서는 manual Actor set;
- no map AoE template.

Default hostile click은 canonical Main Hand relation만 사용할 수 있고 smart fallback은 없습니다.

Resolution 중에도 Actor Boards / Play Context / Command Center skeleton을 유지합니다.

---

# 9. Handout / Activity / DM tools

Handout은 image presentation입니다.

```text
Overlay
Upper
Full
```

Battlemap으로 사용하지 않습니다.

DM contextual utilities:

- Activity;
- Encounter;
- Participants;
- Session;
- Rules lookup;
- Quick/Full Sheet;
- advanced spatial facts;
- correction/adjudication.

Spatial tool은 Actor pair + distance/visibility/cover 같은 fact editor이지 coordinate editor가 아닙니다.

---

# 10. 아직 Runtime 구현을 막는 기술 Gap

UI 모양은 승인됐지만 다음은 UI가 임의로 구현할 수 없습니다.

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

특히 DM Only는 Player에게 secret event의 존재 자체를 보내지 않는 Architecture contract가 먼저 필요합니다.

상세 매핑:

[`contracts/IMPLEMENTATION-TRACEABILITY.md`](contracts/IMPLEMENTATION-TRACEABILITY.md)

---

# 11. 현재 단계

```text
Repository-wide audit                     DONE
Integrated Product/UI plan                DONE
Mapless Reference Prototype               DONE
Owner Prototype Acceptance                PASS
Surface Contract                          DONE
Component Contract                        DONE
Interaction/State/Layer/Motion Contract   DONE
Implementation Traceability               DONE
-> 첫 Runtime 구현 Slice 선택
-> 해당 Slice의 src/tests 재검사
-> 해당 Slice를 막는 기술 Gap 해결
-> touched legacy docs/tests reconciliation
-> 필요한 Decision만 scoped Freeze
-> Runtime Work Order
-> 별도 Runtime implementation 승인
-> src 구현
```

**지금은 Runtime Preparation 단계입니다. 실제 `src/` UI 구현은 아직 승인되지 않았습니다.**

다음 단계에서 가장 안전한 첫 구현 Slice는 `Product Shell + First-run Tutorial + Sheet presentation preference`입니다. DM-only privacy, Handout networking, selective resolution locking처럼 Architecture Gap이 큰 영역보다 먼저 진행하기 적합합니다.
