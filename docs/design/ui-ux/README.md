# SimpleVTT UI/UX — 사용자 대시보드

현재 진행 상태:

```text
Repository-wide 통합 기획
-> mapless Integrated Reference Prototype
-> Owner Acceptance
-> WO-UI-001 / 002 / 003 CLOSED / ACCEPTED
-> DM Library product + persistence planning
-> first DM Library preparation/live candidate built
-> Owner correction: live add/reveal must be much faster
-> unified Core Systems UX plan
-> DM Quick + Inventory/Spell/Feature/Status/Rest/Party candidate BUILT
-> OWNER CORE SYSTEMS PROTOTYPE REVIEW PENDING
```

---

# UI 구현 권위 순서

1. canonical Domain/Architecture truth;
2. current Product/UX decisions/directions;
3. `INTEGRATED-PRODUCT-UX-PLAN.md`;
4. active direct Owner product extensions;
5. Owner-accepted visual references;
6. `contracts/` implementation contracts;
7. current Work Order / authorization / implementation / Human QA record.

Existing Connected Play visual reference:

```text
prototype/app/integrated-reference.html
prototype/app/integrated-reference.js
prototype/app/integrated-reference.css
```

Core rule:

> Accepted prototype가 실제 장면을 이미 정의한 경우, prose contract의 큰 구조만 만족하는 시각적으로 다른 화면을 대체안으로 만들지 않는다.

The new Core Systems candidate extends this scene; it does not replace it.

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
| First DM Library prototype | **BUILT — PREPARATION SURFACE STILL RELEVANT** |
| Heavy nested live picker | **SUPERSEDED AS PRIMARY LIVE UX** |
| Core Systems UX plan | **RECORDED** |
| Core Systems candidate prototype | **BUILT** |
| Core Systems Owner visual/flow review | **PENDING** |
| WO-UI-004 runtime implementation | **NOT YET AUTHORIZED** |
| PR #109 | **DRAFT / UNMERGED** |

---

# Accepted Connected Play scene

Primary accepted reference scenarios:

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
  37px economy/resource rail
  240px controlled Actor | flexible Hotbar | 104px context
```

Hotbar:

```text
Mixed | Action | Spell | Item | Custom
~70px slots
```

Owner re-tested and accepted the reference rework:

> 그래 잘 됐어.

---

# Unified Core Systems UX

Canonical planning entry:

`CORE-SYSTEMS-UX-PLAN.md`

The shared grammar is:

```text
MANAGE
-> Character Sheet / DM Library / Party Stash detail

USE
-> Command Center

STATUS
-> Actor Card / controlled Actor summary / Resource Rail / current response

QUICK
-> Ctrl+K / small + Quick launcher
```

Hard interpretation:

```text
Inventory != Item Hotbar
Spellbook != Spell Hotbar
Feature list != executable Feature slots
DM Library != live Quick palette
```

Full management is allowed to be deep. Routine live use should be shallow.

---

# System placement

```text
PRODUCT SHELL
Characters
  -> Character Sheet
     -> Inventory
     -> Spells
     -> Features
     -> Status

Session
  -> Host / Join
  -> DM Library          [offline preparation]
  -> Party Stash         [shared inventory candidate]

Content
  -> reusable definitions/packages

Rules
  -> authoritative browse/search

CONNECTED PLAY
Play chrome
  -> DM + Quick / Ctrl+K
Actor Boards
Mapless Stage
Command Center
  -> Mixed / Action / Spell / Item / Custom
  -> Resource Rail
```

---

# Inventory / Spell / Feature direction

Inventory is the full owned-item management surface and uses canonical ItemInstance/Activation/quantity/resource state.

Command Center `Item` only receives executable item capabilities.

Spellbook contains complete known/prepared/configured spell records; `Spell` Hotbar only receives current executable spells.

Feature list contains passive and executable features. Passive traits do not occupy Hotbar slots merely because they exist.

Conditions and Concentration are compact live status until a response/detail is actually needed.

Rest is an Activity workflow:

```text
Choose Rest
-> authoritative preview
-> ask only real choices
-> explicit Complete
-> commit
```

No blind UI-defined reset semantics.

---

# Party Stash candidate

Party Stash is proposed as a shared inventory/loot surface separate from one Player Character inventory.

```text
Party Stash Potion x4
-> Give Rowan x2
-> validated transfer
-> Party x2 / Rowan x2
```

Its ownership/persistence/write-back contract is not yet frozen. Prototype presentation does not authorize runtime semantics.

---

# DM Library + revised live Quick UX

DM Library remains durable local Host preparation data:

```text
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions
```

Full Library is the preparation room.

Primary live access is now:

```text
Ctrl+K / + Quick

ACTOR      Nightcrow Archer       [+1] [More]
IMAGE      봉인된 편지             [View] [Reveal]
ITEM       Potion of Healing      [Give] [Party]
CONDITION  Poisoned               [Apply]
RULE       Poisoned               [Open]
```

Key rules:

- Actor `+1` is the common single-add path;
- quantity is secondary under `More`;
- Image `View` is private preview;
- Image `Reveal` is explicit shared presentation;
- result selection itself never reveals;
- empty Quick query prefers Recent/Favorites;
- Player never receives DM Library/private Quick source catalog;
- full Encounter/Library picker remains a detailed fallback only.

---

# Active prototype candidate

Review entry:

```text
docs/design/ui-ux/prototype/app/core-systems-reference.html
```

Supporting files:

```text
docs/design/ui-ux/prototype/app/core-systems-reference.css
docs/design/ui-ux/prototype/app/core-systems-reference.js
docs/design/ui-ux/prototype/CORE-SYSTEMS-EXTENSION.md
```

Scenarios:

```text
SYS-SCN-00 — Product placement map
SYS-SCN-01 — Character Inventory management
SYS-SCN-02 — Spellbook + Features management
SYS-SCN-03 — Player live Quick Use
SYS-SCN-04 — DM unified Quick Search
SYS-SCN-05 — Party Stash / loot transfer
SYS-SCN-06 — Rest preview / commit
SYS-SCN-07 — Condition / concentration response
```

The candidate reuses the accepted Play visual family for all live scenarios.

---

# First DM Library prototype disposition

The earlier candidate remains at:

```text
docs/design/ui-ux/prototype/app/dm-library-reference.html
```

Keep it as evidence/review for the **offline preparation Library** layout.

Its heavier live flow:

```text
Encounter -> Add Actor -> Library picker -> quantity -> Add
```

is no longer the primary intended live UX after Owner feedback.

For live invocation review, use `core-systems-reference.html`.

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

---

# Current next gate

```text
Open prototype/app/core-systems-reference.html
-> review SYS-SCN-00 through SYS-SCN-07
-> Owner accept/change system placement + DM Quick + Inventory/Party/Rest grammar
-> only then consolidate accepted reference / materialize runtime contracts
```
