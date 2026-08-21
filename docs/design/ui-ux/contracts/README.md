# SimpleVTT Accepted UI/UX Contracts

Status: **RUNTIME PREPARATION CONTRACT SET — accepted reference translated into implementation-facing requirements; not Frozen**

Accepted visual/interaction reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
Owner acceptance: docs/design/ui-ux/prototype/PROTOTYPE-ACCEPTANCE.md
```

Cross-source Product baseline:

```text
docs/design/ui-ux/INTEGRATED-PRODUCT-UX-PLAN.md
```

이 폴더의 목표:

> **runtime 구현자가 prototype HTML/CSS를 해석하거나 일반 VTT 관습으로 빈칸을 채우지 않고도 SimpleVTT의 제품 구조와 상호작용을 정확히 구현하게 한다.**

---

# 1. Authority

이 계약들은 accepted prototype + canonical Product/Domain sources에서 추출된 implementation-facing requirements다.

우선순위:

```text
Domain / Architecture contracts
> canonical made Product/UX Decisions
> explicit later Owner change
> accepted UI contracts in this directory
> current source/tests/historical docs as evidence only
```

이 계약들은:

- Product Decision을 자동으로 `Frozen`으로 만들지 않는다;
- rules/network/privacy truth를 새로 만들지 않는다;
- runtime implementation을 자동 승인하지 않는다.

---

# 2. 필수 읽기 순서 — broad UI runtime preparation

아래 순서를 생략하지 않는다.

```text
1. ../AI-READING-GUIDE.md
2. ../MANIFEST.yaml
3. ../PREFLIGHT.md
4. ../INTEGRATED-PRODUCT-UX-PLAN.md
5. applicable Domain/Architecture contracts
6. exact applicable Decision Cards in ../decisions.md
7. ../planning-gaps.md
8. prototype/PROTOTYPE-ACCEPTANCE.md
9. contracts/README.md                         <- 지금 문서
10. IMPLEMENTATION-PLAYBOOK.md                <- 먼저 전체 제품을 이해
11. GLOSSARY-AND-TERMINOLOGY.md               <- 용어 오해 방지
12. SURFACE-CONTRACT.md                       <- 화면/공존 구조
13. COMPONENT-CONTRACT.md                     <- 컴포넌트 책임
14. INTERACTION-STATE-MOTION-CONTRACT.md       <- 상호작용/상태/layer/motion
15. BEHAVIOR-SCENARIOS.md                     <- 실제 end-to-end 흐름
16. IMPLEMENTATION-TRACEABILITY.md             <- source/gap/authority 추적
17. QA-ACCEPTANCE-MATRIX.md                    <- 검증 계약
18. MANIFEST.yaml                             <- machine-readable gate
```

그 다음에만 accepted prototype/source와 production `src/`를 비교한다.

Prototype source는 visual comparison 용도이지 gameplay/network authority가 아니다.

---

# 3. 어떤 문서를 언제 읽는가

## `IMPLEMENTATION-PLAYBOOK.md` — 사람/AI가 가장 먼저 읽을 설명서

질문:

> "SimpleVTT UI가 대체 어떤 제품이고, 무엇을 절대 하면 안 되지?"

답한다.

포함:

- mapless product identity;
- exact Play composition;
- Tutorial-first;
- same-Sheet dice;
- Host/Join lifecycle;
- Actor click precedence;
- role differences;
- privacy/Handout/spatial boundaries;
- 흔한 잘못된 합리화와 anti-pattern.

---

## `GLOSSARY-AND-TERMINOLOGY.md` — 단어를 잘못 해석하지 않기 위한 사전

질문:

> "Scene이 map인가? Actor가 token인가? Hidden이면 private인가?"

답한다.

각 용어에:

- 뜻;
- 뜻하지 않는 것;
- 관련 제약;

을 명시한다.

---

## `SURFACE-CONTRACT.md` — 화면과 큰 구조

정의:

- destinations;
- Tutorial;
- Character surfaces;
- Session entry;
- Connected Play;
- Actor Boards;
- Command Center;
- utilities;
- Handout;
- responsive coexistence.

---

## `COMPONENT-CONTRACT.md` — 재사용 UI 책임

정의:

- GlobalNav;
- CharacterCard;
- ActorCard/Board;
- Command Center/Hotbar;
- Initiative;
- feedback;
- utility panes;
- Activity;
- Dice/Result;
- Handout;
- connection/session.

중요:

> component가 어떤 authoritative truth를 계산하면 안 되는지도 정의한다.

---

## `INTERACTION-STATE-MOTION-CONTRACT.md`

정의:

- Actor click priority;
- targeting lifecycle;
- Standalone dice;
- PendingResolution continuity;
- selective locking boundary;
- visible state vocabulary;
- layer priority;
- focus/keyboard;
- animation;
- Reduced Motion;
- desktop reflow.

---

## `BEHAVIOR-SCENARIOS.md` — 실제 사용자 행동 48개

형식:

```text
Start state
-> User action
-> Expected UI transition
-> State that must be preserved
-> Forbidden behavior
```

Runtime Work Order는 touched scenario를 명시해야 한다.

---

## `IMPLEMENTATION-TRACEABILITY.md`

각 UI requirement를:

- Product Decision;
- Domain/Architecture authority;
- Planning Gap;
- known implementation drift;

와 연결한다.

---

## `QA-ACCEPTANCE-MATRIX.md`

각 runtime slice를 `PASS / FAIL / BLOCKED / N/A`로 검증한다.

특히:

- mapless identity;
- Tutorial;
- Session role/lifecycle;
- Freeform/Initiative;
- Actor click/targeting;
- Resolution;
- privacy;
- Handout;
- spatial facts;
- accessibility;

을 fail-fast 수준으로 검사한다.

---

# 4. 한 번에 이해해야 하는 제품 구조

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
├ Play chrome/status
├ Upper NPC/Neutral/Hostile Actor Board
├ Play Context / Tabletop Stage (NO battlemap)
│   └ contextual utility pane when needed
├ Lower Player/Allied Actor Board
└ Persistent Command Center
```

Initiative는 Connected Play를 교체하지 않고 같은 구조에 tracker/turn/economy만 추가한다.

---

# 5. 계약적으로 반드시 보존할 것

- first-run Tutorial before normal Home interaction;
- initial Official-style / SimpleVTT Sheet choice;
- same canonical Character across layouts;
- top-level Product IA;
- distinct Host and Join flows;
- immediate-live Host/DM Freeform lifecycle;
- Host=DM, Client=Player;
- Offline has no DM/Player identity;
- mapless Core;
- upper opposing Actor Board;
- lower allied Actor Board;
- persistent Command Center;
- same Play skeleton for DM and Player;
- Freeform vs Initiative semantic difference;
- ActorCard/manual targeting;
- selected-action targeting priority;
- DM control priority when applicable;
- no Main Hand smart fallback;
- same-Sheet Standalone dice;
- connected in-context dice/result;
- contextual Activity/DM/session utilities;
- DM-only non-delivery requirement;
- Handout is not a tactical map;
- desktop-first accessibility/responsive behavior.

---

# 6. 구현자가 자유롭게 튜닝 가능한 것

위 hierarchy/behavior를 바꾸지 않는 범위:

- exact pixel values;
- spacing;
- dark palette detail;
- icon family;
- microcopy;
- ordinary component split;
- CSS architecture;
- easing/detail timing within motion policy;
- breakpoint exact values;
- low-risk polish.

다음이 바뀌면 단순 polish가 아니다:

- workflow;
- capability visibility;
- persistent region hierarchy;
- authority/privacy;
- Session lifecycle;
- first-run mental model;
- target flow;
- mapless boundary;
- Handout semantics.

---

# 7. UI가 절대 계산하지 않는 truth

UI/component는 다음의 source of truth가 아니다:

- D&D legality/calculation;
- target eligibility;
- executable Main Hand relation;
- safe/conflicting interaction boundary;
- privacy entitlement/delivery;
- reconnect truth;
- content validation truth;
- persistence semantics;
- spatial geometry.

Runtime UI는 owning application/domain/architecture projection을 소비한다.

Prototype fixture object를 production schema로 복사하지 않는다.

---

# 8. Mapless hard guard

Core에 추가하면 안 되는 것:

```text
battlemap
Actor x/y coordinates
draggable tactical tokens
grid / hex
pathfinding / collision
movement traces
Fog of War
LoS geometry
range rings / AoE map templates
Handout-as-map behavior
```

`Play Context`, `Tabletop Stage`, `Scene`, `Roll Area`는 presentation/context 용어다.

---

# 9. 현재 runtime blocker

계약 문서가 상세해졌다고 기술 Gap이 해결된 것은 아니다.

현재 주요 blocker:

- `GAP-MAIN-HAND-CANONICAL-RELATION`;
- `GAP-RESOLUTION-SAFE-INTERACTIONS`;
- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL` (Critical).

Gap이 있는 영역은 UI가 추측해서 완성하지 않는다.

`QA-ACCEPTANCE-MATRIX.md`에서 해당 행은 해결 전까지 `BLOCKED`로 남을 수 있다.

---

# 10. 현재 gate

```text
Accepted Reference Prototype: PASS
Contract extraction: MATERIALIZED
Interpretation Playbook: READY
Terminology Guard: READY
Behavior Scenarios: READY
QA Matrix: READY
Frozen Product dependencies: NOT YET ESTABLISHED
Technical gaps: OPEN where declared
Runtime Work Order: NOT YET CREATED
Runtime implementation authorization: NO
```

이 문서 세트는 **이해와 구현 준비의 기준**이다. `src/` 구현을 자동 시작시키는 승인이 아니다.
