# SimpleVTT UI/UX — 사용자 대시보드

현재 UI/UX는 **Repository-wide 통합 기준을 바탕으로 새 Reference Prototype까지 재구축한 상태**입니다.

기존 Prototype을 계속 수정하는 방식은 중단했습니다. 저장소 전체의 Product/Domain/Rules/Session/Character/UI planning/Owner 원문/`.agents` 역사/current code/tests를 교차검증해 별도의 통합 기준을 만들었고, 그 기준에서 새 Prototype을 처음부터 다시 만들었습니다.

핵심 교정은 세 가지입니다:

- SimpleVTT Core는 원래 **battlemap이 없는 tabletop companion**입니다.
- 첫 사용에서 첫 의미 있는 패널은 **Tutorial/Onboarding**입니다.
- broad UI는 이제 흩어진 한두 문서가 아니라 **통합 기획서 + canonical Domain/Decision**을 함께 읽어야 합니다.

---

# 지금 가장 먼저 읽을 문서

## 통합 기획서

[`INTEGRATED-PRODUCT-UX-PLAN.md`](INTEGRATED-PRODUCT-UX-PLAN.md)

이 문서가 broad UI/Prototype 작업의 mandatory cross-source baseline입니다.

새로운 Decision 저장소는 아닙니다. 다음을 한 곳에서 같이 읽기 위한 기준입니다:

- canonical Domain/Architecture contracts;
- current Reviewed Product/UX Decisions;
- direct Owner provenance;
- non-canonical `.agents` historical plans;
- current code/tests as evidence;
- prototype drift/rebuild rules.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **완료 — 0개 남음** |
| 핵심 Product/UX 방향 | **Reviewed** |
| Repository-wide Product/UI audit | **완료** |
| Integrated Product/UX baseline | **Active** |
| Core map model | **MAPLESS — battlemap 없음** |
| 첫 Prototype `app/index.html` | **Rejected / Historical** |
| 두 번째 `app/final-spec.html` | **Invalidated / Historical** |
| 새 Prototype `app/integrated-reference.html` | **Active Static Review Candidate** |
| Static verification | **PASS** |
| Browser visual/interaction QA | **Pending** |
| Prototype Owner Acceptance | **Pending** |
| Frozen 결정 | 없음 |
| Runtime `src/` UI 구현 | **승인되지 않음** |

현재 verification:

[`prototype/INTEGRATED-REFERENCE-VERIFICATION.md`](prototype/INTEGRATED-REFERENCE-VERIFICATION.md)

현재 acceptance gate:

[`prototype/PROTOTYPE-ACCEPTANCE.md`](prototype/PROTOTYPE-ACCEPTANCE.md)

---

# 1. SimpleVTT에는 battlemap이 없다

Core는 다음을 기본 제품 기능으로 소유하지 않습니다.

```text
battle map
token position / Actor x,y
grid / hex
pathfinding / collision
movement trace
Fog of War
LoS map visualization
range ring / tactical AoE template
3D battlefield
```

따라서 UI에서 `Scene`, `Scene/Table`, `Tabletop Stage`, `Canvas`라는 단어가 보여도 **배틀맵을 뜻하지 않습니다.**

새 Prototype의 중앙 영역은 `Play Context / Tabletop Stage`로 쓰며:

- 현재 행동/타게팅 맥락;
- PendingResolution;
- Reaction/Concentration;
- Dice;
- Result/NOTICE;
- Handout;

을 표현합니다.

Actor는 중앙 map 위 token이 아니라 위/아래 **Actor Board의 Card**입니다.

---

# 2. 첫 실행 첫 패널은 Tutorial

이건 새로 만든 요구가 아니라 기존 Owner 원문에 이미 있던 기획을 복구한 것입니다.

현재 흐름:

```text
App boot
-> first use?
   -> YES: Tutorial / Onboarding window
       -> Standalone / Connected 설명
       -> Official-style vs SimpleVTT Sheet 초기 선택
       -> Character / Host / Join 기본 안내
       -> 완료
       -> Home
   -> NO: Home
```

Tutorial은 Settings/Help에서 다시 열 수 있어야 합니다.

새 `integrated-reference.html`도 `PROTO-SCN-01 First launch Tutorial`에서 시작합니다.

---

# 3. Standalone Sheet는 자체적으로 완전한 tabletop tool

Official-style / SimpleVTT 두 레이아웃은 같은 canonical Character를 사용합니다.

어떤 일반 Roll도 현재 Sheet를 떠나지 않습니다.

```text
현재 Sheet 유지
-> Roll
-> 같은 Sheet viewport 위/안에서 transient physical dice
-> 짧은 결과
-> dice/result layer 자동 소멸
-> 같은 Sheet 그대로 계속 사용
```

새 Prototype은 이 same-Sheet 경로를 하나의 공통 Roll 처리로 구현했고 정적 검증을 통과했습니다.

---

# 4. Connected Play 구조

새 Prototype의 기본 골격:

```text
Compact Play chrome / status
────────────────────────────────────────
상단 NPC / Neutral / Hostile Actor Board
────────────────────────────────────────
Play Context / Tabletop Stage          [contextual utility pane]
────────────────────────────────────────
하단 Player / Allied Actor Board
────────────────────────────────────────
Persistent Command Center
```

중앙 영역에는 Actor 좌표나 map token이 없습니다.

Targeting도 map click이 아니라 Actor Card/manual target set으로 합니다.

Area action도 Core에서는 AoE template가 아니라 manual multi-target 선택입니다.

---

# 5. Freeform / Initiative

## Freeform

같은 Play skeleton을 쓰지만 턴이 없으므로 fake turn economy를 보여주지 않습니다.

Command Center는 capability discovery를 위해 남지만 `Action/Bonus/Reaction/Movement`를 턴 자원처럼 소비 중인 것으로 표현하지 않습니다.

## Initiative

같은 화면에 다음만 추가합니다.

- round/current turn;
- 중앙 Play Context 상단 edge의 compact tracker;
- 실제 Initiative economy;
- End Turn.

Actor Boards와 Command Center는 그대로 유지합니다.

---

# 6. Hotbar / 행동 UX

현재 Reviewed 방향은:

- normal capabilities를 직접 찾을 수 있어야 함;
- persistent Command Center / Hotbar;
- Mixed / Action / Spell / Item / custom;
- 자동 capability discovery + 사용자 Hotbar customization;
- 선택 뒤 필요한 세부 choice만 contextual하게 열기.

따라서 과거 `.agents`의 intent-first funnel은 제품 기준으로 복원하지 않습니다.

---

# 7. Session lifecycle

현재 흐름:

```text
Host Session
-> Open
-> 바로 live Host/DM Freeform
```

```text
Join Session
-> Character 선택
-> connection/content/Character sync
-> 현재 live Client/Player Play
```

없음:

- 기본 Host Preparing 대기 화면;
- Player Lobby;
- Ready gate;
- DM Start Session gate.

또한 새 Prototype QA에서 Product Shell을 잠깐 보고 `Return to Play` 했을 때 기존 Host/DM 또는 Client/Player 연결 역할이 유지되도록 보강했습니다.

---

# 8. 이번 새 Prototype QA에서 추가로 잡은 문제

새 후보를 만든 뒤에도 기획과 interaction을 다시 대조해 다음을 고쳤습니다.

1. **Return to Play 역할 보존** — Host/DM이 Product 화면을 보고 돌아와 Player로 바뀌는 prototype state 오류를 수정.
2. **DM controlled Actor와 Command Center 동기화** — DM이 NPC/적을 조종해도 Rowan 상태가 계속 남는 문제를 수정.
3. **DM Control Mode 클릭 우선순위** — 명시적 DM 조종 모드가 hostile Main Hand 기본 공격보다 먼저 처리되게 교정.
4. **Selective resolution locking** — safe/conflicting control을 UI가 계산하지 않고 explicit QA fixture가 공급하도록 분리.
5. **advanced Spatial Facts** — routine Play chrome에서 내리고 contextual QA/tool surface로 유지.
6. **제품 UI 카피 정리** — 내부 `mapless` Guard를 사용자 화면에 반복 노출하지 않고, 실제 작업 맥락 중심의 `PLAY CONTEXT` 표현으로 교정.

---

# 9. Handout / DM spatial

Handout은 **image presentation**입니다. Battlemap이 아닙니다.

DM spatial tool은 advanced fact editor입니다:

- Actor A / B;
- distance;
- visibility;
- cover;
- 필요한 manual fact.

좌표 map editor가 아닙니다.

---

# Prototype 상태

현재 Active Review Candidate:

```text
prototype/app/integrated-reference.html
```

정적 검증은 통과했습니다.

다만 Browser visual/interaction QA는 아직 `Pending`입니다. 현재 작업 컨테이너에는 Chromium이 있지만 GitHub/raw GitHub 호스트 DNS 해석이 되지 않아 connected branch bundle을 exact local browser run으로 열 수 없었습니다. 따라서 이 상태를 Browser PASS나 Owner Accepted로 과장하지 않습니다.

---

# 다음 순서

```text
Repository-wide audit                         DONE
Integrated Product / UI / UX Plan            DONE
AI routing / preflight mapless guard         DONE
Old prototype invalidation                   DONE
Prototype spec/catalog reconciliation        DONE
NEW integrated Reference Prototype           DONE
Static verification                          PASS
-> Browser / Owner visual review             PENDING
-> Owner natural-language iteration
-> Explicit Prototype Acceptance
-> Surface/Component/Motion contract extraction
-> remaining Domain/Architecture gaps
-> legacy reconciliation / scoped Freeze
-> runtime Work Order
-> separate runtime implementation authorization
-> src UI implementation
```

지금은 **Reference Prototype review 단계**이며 actual runtime UI 구현 단계가 아닙니다.
