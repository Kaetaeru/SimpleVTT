# SimpleVTT UI/UX — 사용자 대시보드

현재 진행 상태:

```text
Repository-wide 통합 기획
-> mapless Integrated Reference Prototype
-> Owner Acceptance
-> WO-UI-001 / 002 / 003 CLOSED / ACCEPTED
-> DM Library product + persistence planning
-> Owner correction: live add/reveal must be faster
-> unified Core Systems UX plan + Korean-first extensibility contract
-> Korean Core Systems demo BUILT
-> OWNER CORE SYSTEMS DIRECTION ACCEPTED
-> NEXT: runtime/domain contracts materialization without hard-coding future systems
```

---

# UI 구현 권위 순서

1. canonical Domain/Architecture truth;
2. current Product/UX decisions/directions;
3. `INTEGRATED-PRODUCT-UX-PLAN.md`;
4. active Owner-accepted product extensions;
5. Owner-accepted visual references;
6. `contracts/` implementation contracts;
7. current Work Order / scoped authorization / implementation / Human QA.

Existing Connected Play visual reference:

```text
prototype/app/integrated-reference.html
prototype/app/integrated-reference.js
prototype/app/integrated-reference.css
```

Accepted Core Systems extension review entry:

```text
prototype/app/core-systems-reference.html
```

Owner acceptance record:

```text
prototype/CORE-SYSTEMS-ACCEPTANCE.md
```

Korean-first / extensibility contract:

```text
EXTENSIBILITY-KOREAN-FIRST.md
```

Core rule:

> Accepted prototype가 실제 장면을 이미 정의한 경우, prose contract의 큰 구조만 만족하는 시각적으로 다른 화면을 대체안으로 만들지 않는다.

The Core Systems extension extends the accepted Play scene; it does not replace it.

---

# Current status

| Item | Status |
| --- | --- |
| Core spatial model | **MAPLESS** |
| Existing Integrated Reference | **OWNER ACCEPTED** |
| Accepted candidate ref | `4c12084bef603866b9b69f1bfd8f363146920184` |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 | **CLOSED / ACCEPTED** |
| WO-UI-003 | **CLOSED / ACCEPTED** |
| DM Library product direction | **RECORDED / REVISED FOR QUICK LIVE USE** |
| DM Library architecture boundary | **DRAFTED** |
| Full DM Library preparation surface | **RETAINED FOR PREPARATION / DETAIL** |
| Heavy nested live picker | **SUPERSEDED AS PRIMARY LIVE UX** |
| Core Systems UX direction | **OWNER ACCEPTED** |
| Korean-first product UI | **ACTIVE BASELINE** |
| Extensible registry/provider direction | **ACTIVE BASELINE** |
| Party Stash UX concept | **OWNER ACCEPTED PRODUCT DIRECTION / RUNTIME CONTRACT PENDING** |
| WO-UI-004 runtime implementation | **NOT YET AUTHORIZED** |
| PR #109 | **DRAFT / UNMERGED** |

---

# Accepted Connected Play scene

Primary accepted reference scenarios remain:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

Wide/normal desktop:

```text
41px Play chrome
────────────────────────────────────────
86px Upper Actor Board
────────────────────────────────────────
flexible Mapless Play Context
  centered context / dice / result
  ~40px Initiative tracker when active
  contextual right utility pane
────────────────────────────────────────
86px Lower Actor Board
────────────────────────────────────────
174px Persistent Command Center
```

Hotbar family remains:

```text
혼합 | 행동 | 주문 | 아이템 | 사용자 지정
```

The underlying stable IDs may remain language-neutral; Korean is the default visible v1 presentation.

---

# Accepted Core Systems grammar

```text
관리
-> 캐릭터 시트 / DM 라이브러리 / 파티 보관함 상세

사용
-> 커맨드 센터

상태
-> 액터 카드 / 자원 표시줄 / 현재 대응

빠른 검색
-> Ctrl+K / + 빠른 검색
```

Hard interpretation:

```text
Inventory != Item Hotbar
Spellbook != Spell Hotbar
Feature list != executable Feature slots
DM Library != live Quick palette
```

Full management may be deep. Routine live use should be shallow.

---

# 한국어 우선 + 확장 가능 구조

v1 user-facing product language is Korean (`ko-KR`) by default.

Visible menus, buttons, tabs, system names, state/error/help text, tutorials and accessibility labels are Korean-first.

Internal identity remains stable and language-neutral:

```text
stable id
+ validated capability/domain contract
+ registry/provider/descriptor
+ localized presentation metadata
-> shared renderer
```

The goal is not to predict every future feature. The goal is to let new systems join stable extension points without rebuilding the core UI.

Initial extension points include:

- Character Sheet sections;
- Hotbar pages/capabilities;
- Quick Search providers/actions;
- Party Stash permission-policy presets;
- Rest activity descriptors;
- status/effect presentation descriptors;
- inventory presentation grouping where canonical metadata supports it.

Untyped JSON, visible-string identity, giant future-type switches, and CSS-only privacy are not accepted substitutes for proper domain contracts.

---

# Inventory / Spell / Feature direction

Inventory is the full owned-item management surface and uses canonical ItemInstance/Activation/quantity/resource state.

Command Center `아이템` receives executable item capabilities only.

Spellbook contains complete known/prepared/configured records; `주문` Hotbar receives current executable spells only.

Feature list contains passive and executable capabilities. Passive traits do not occupy Hotbar slots merely because they exist.

Conditions and Concentration remain compact live state until a response/detail is actually needed.

Rest is an Activity workflow:

```text
휴식 선택
-> authoritative preview
-> 필요한 실제 선택만 입력
-> 명시적 완료
-> commit
```

UI does not invent recovery semantics from the visible label.

---

# Party Stash accepted product direction

`파티 보관함` is a shared inventory concept separate from one Character inventory.

Storage/ownership and operation policy are separate concepts.

Initial policy presets:

```text
공유 관리
DM 승인형
DM 관리형
```

These are initial configurable presets over one Party Stash concept, not three incompatible storage models.

Future permission policies should be addable through a capability/policy descriptor.

Exact persistence, lifetime, transfer/write-back and durable ownership semantics remain runtime/domain contracts to materialize.

Unknown/unrevealed DM loot must not be hidden inside Player-delivered Party Stash state.

---

# DM Library + accepted live Quick direction

DM Library remains durable local Host preparation data:

```text
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions
```

Full Library = preparation/detail.

Primary live path = Quick Search:

```text
Ctrl+K / + 빠른 검색

액터      나이트크로우 궁수       [+1 추가] [더 보기]
이미지    봉인된 편지             [미리보기] [공개]
아이템    회복 물약                [지급] [파티 보관함]
상태      중독                     [적용]
규칙      중독                     [열기]
```

Key rules:

- Actor common path is one-click `+1 추가` after retrieval;
- quantity/batch controls are secondary;
- image preview and reveal are distinct;
- selecting a result never reveals an image by itself;
- empty Quick query favors recent/favorite/relevant results;
- Player never receives the DM Library/private Quick source catalog;
- full Encounter/Library picker remains a detailed fallback.

---

# Runtime gaps before implementation

Existing DM Library gaps:

```text
GAP-DM-LIBRARY-METADATA-PERSISTENCE
GAP-DM-LIBRARY-ASSET-STORAGE
GAP-DM-LIBRARY-ACTOR-INSTANTIATION
GAP-DM-LIBRARY-PRIVATE-PROJECTION
GAP-HANDOUT-NETWORK-CONTRACT
```

Additional Core Systems contracts to materialize where absent:

```text
Quick Search source aggregation/index privacy
Party Stash ownership/persistence/lifetime
Durable item transfer/grant semantics
Rest preview/commit projection
Condition/effect fast-apply authoritative path
Hotbar customization persistence
```

UI must not manufacture these semantics locally.

---

# Product invariants

- Core remains **mapless**.
- No Actor x/y, grid, pathfinding, Fog of War, LoS geometry or tactical token field.
- Actor Cards/Boards remain Connected Play Actor representation.
- Stage remains context/dice/result/Handout presentation, not battlefield.
- Freeform has no fake turn economy.
- Initiative extends the same Play scene.
- Host = DM; Client = Player.
- Offline has no hidden connected DM/Player role identity.
- Product navigation does not end/recreate the Session.
- Main Hand has no smart fallback.
- DM-only privacy cannot be implemented by CSS hiding.
- Handout is presentation, not battlemap.
- Full management surfaces do not replace the Command Center during routine Play.
- User-facing v1 UI is Korean-first while internal IDs remain language-neutral.
- New recurring systems should prefer stable registry/provider/capability extension points over hard-coded future-type branches.

---

# Current next gate

```text
Core Systems product/UX direction OWNER ACCEPTED
-> materialize missing domain/architecture contracts
-> define scoped runtime slice(s)
-> explicit runtime authorization
-> implementation + tests
-> Human QA
```

Do not infer runtime authorization merely from prototype/product acceptance.
