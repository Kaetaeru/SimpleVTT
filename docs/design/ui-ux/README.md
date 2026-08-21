# SimpleVTT UI/UX — 사용자 대시보드

현재 UI/UX는 **Repository-wide 재통합 단계**입니다.

기존 Prototype을 계속 수정하는 대신, 저장소 전체의 Product/Domain/Rules/Session/Character/UI planning/Owner 원문/`.agents` 역사/current code/tests를 교차검증해 별도의 통합 기준을 만들었습니다.

핵심 이유는 명확합니다:

- SimpleVTT Core는 원래 **battlemap이 없는 mapless tabletop companion**인데;
- 이전 Prototype이 `Scene/Table`을 tactical map처럼 잘못 해석했고;
- 첫 실행 Tutorial과 초기 Official/SimpleVTT Sheet 선택 같은 이미 합의된 Owner 기획도 누락했습니다.

---

# 지금 가장 먼저 읽을 문서

## 통합 기획서

[`INTEGRATED-PRODUCT-UX-PLAN.md`](INTEGRATED-PRODUCT-UX-PLAN.md)

이 문서가 broad UI/Prototype 작업의 cross-source baseline입니다.

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
| Integrated Product/UX baseline | **작성됨 / Active** |
| Core map model | **MAPLESS — battlemap 없음** |
| 첫 Prototype `app/index.html` | **Rejected / Historical** |
| 두 번째 `app/final-spec.html` | **Invalidated** |
| Active Prototype review entry | **없음** |
| Prototype specification | **통합 기준으로 재정리 중** |
| Prototype rebuild | **필요** |
| Prototype Owner Acceptance | **아직 안 함** |
| Frozen 결정 | 없음 |
| Runtime `src/` UI 구현 | **승인되지 않음** |

---

# 이번 전수조사에서 확정된 가장 중요한 교정

## 1. SimpleVTT에는 battlemap이 없다

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

앞으로 중앙 영역은 **Mapless Play Context / Tabletop Stage**로 해석합니다.

그곳에는:

- 현재 행동/타게팅 맥락;
- PendingResolution;
- Reaction/Concentration;
- Dice;
- Result/NOTICE;
- Handout;

이 들어갈 수 있지만 Actor를 x/y 좌표로 놓는 map/token 공간은 아닙니다.

---

# 2. 첫 실행 첫 패널은 Tutorial

이건 새로 정한 게 아니라 기존 Owner 원문에 이미 있었습니다.

현재 통합 흐름:

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

Home 안의 일반 가이드 카드만으로는 이 요구를 충족하지 않습니다.

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

금지:

- 별도 dice page;
- 별도 Resolution route;
- detached dice/result window;
- permanent dice tray frame;
- Roll 때문에 Sheet를 밀거나 교체하는 구조;
- routine roll 후 `Close`를 눌러야 원래 Sheet로 돌아오는 구조.

---

# 4. Connected Play도 mapless

현재 Reviewed Play skeleton은 유지합니다.

```text
Compact Play chrome / status
────────────────────────────────────────
상단 NPC / Neutral / Hostile Actor Board
────────────────────────────────────────
Mapless Play Context / Tabletop Stage  [contextual utility pane]
────────────────────────────────────────
하단 Player / Allied Actor Board
────────────────────────────────────────
Persistent Command Center
```

Actor는 중앙 map 위 token이 아니라 **Actor Board의 Card**입니다.

Targeting도 map click이 아니라 Actor Card/manual target set으로 합니다.

Area action도 Core에서는 AoE template가 아니라 manual multi-target 선택입니다.

---

# 5. Freeform / Initiative

## Freeform

같은 Play skeleton을 쓰지만 턴이 없으므로 fake turn economy를 보여주지 않습니다.

Command Center는 현재 Reviewed 방향대로 capability discovery를 위해 남지만, `Action/Bonus/Reaction/Movement`를 턴 자원처럼 소비 중인 것처럼 보여서는 안 됩니다.

## Initiative

같은 화면에 다음만 추가합니다.

- round/current turn;
- 중앙 mapless context 상단 edge의 compact tracker;
- 실제 Initiative economy;
- End Turn.

Actor Boards와 Command Center는 그대로 유지합니다.

---

# 6. Hotbar / 행동 UX

과거 `.agents` 문서와 일부 현재 테스트는 intent-first UI를 강하게 요구하지만, `.agents`는 저장소 자체에서 non-canonical working context로 선언되어 있습니다.

현재 Reviewed 방향은:

- normal capabilities를 직접 찾을 수 있어야 함;
- persistent Command Center / Hotbar;
- Mixed / Action / Spell / Item / custom;
- 자동 capability discovery + 사용자 Hotbar customization;
- 선택 뒤 필요한 세부 choice만 contextual하게 열기.

따라서 과거 intent-first funnel은 제품 기준으로 복원하지 않습니다.

---

# 7. Session lifecycle

현재 Reviewed 흐름:

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

Player 0명이어도 DM live session은 정상입니다.

---

# 8. Handout / DM spatial

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

현재는 열어서 평가할 Prototype이 없습니다.

- `prototype/app/index.html` — historical rejected
- `prototype/app/final-spec.html` — repository-wide audit로 invalidated

Prototype gate:

[`prototype/README.md`](prototype/README.md)

새 Prototype 실행 계약:

[`prototype/PROTOTYPE-REBUILD-CONTRACT.md`](prototype/PROTOTYPE-REBUILD-CONTRACT.md)

현재 Acceptance:

[`prototype/PROTOTYPE-ACCEPTANCE.md`](prototype/PROTOTYPE-ACCEPTANCE.md) — **BLOCKED**

---

# 다음 순서

```text
Repository-wide audit                         DONE
Integrated Product / UI / UX Plan            DONE
AI routing / preflight mapless guard         DONE
Old prototype invalidation                   DONE
Prototype Rebuild Contract                   DONE
-> Prototype catalogs/defaults/models reconcile
-> NEW mapless Reference Prototype build
-> Static + browser/visual QA
-> Owner natural-language iteration
-> Explicit Prototype Acceptance
-> Surface/Component/Motion contract extraction
-> remaining Domain/Architecture gaps
-> legacy reconciliation / scoped Freeze
-> runtime Work Order
-> separate runtime implementation authorization
-> src UI implementation
```

지금은 **Prototype spec reconciliation 단계**이며 actual runtime UI 구현 단계가 아닙니다.
