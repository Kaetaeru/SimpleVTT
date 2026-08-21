# SimpleVTT UI/UX — 사용자 대시보드

현재 진행 상태:

```text
Repository-wide 통합 기획
-> mapless Integrated Reference Prototype
-> Owner Acceptance
-> 상세 runtime contracts
-> WO-UI-001 CLOSED / ACCEPTED
-> WO-UI-002 CLOSED / ACCEPTED
-> WO-UI-003 first visual implementation REJECTED
-> accepted-reference exact-scene rework
-> accepted-reference automation PASS
-> Owner visual re-QA PASS
-> WO-UI-003 CLOSED / ACCEPTED
-> DM Library product/architecture planning
-> DM Library candidate prototype BUILT
-> OWNER DM LIBRARY PROTOTYPE REVIEW PENDING
```

---

# UI 구현 권위 순서

1. canonical Domain/Architecture truth;
2. current Product/UX decisions/directions;
3. `INTEGRATED-PRODUCT-UX-PLAN.md`;
4. active direct Owner product extensions where present;
5. Owner-accepted visual references;
6. `contracts/` implementation contracts;
7. current Work Order / authorization / implementation / Human QA record.

For existing Connected Play, the visual reference is:

```text
prototype/app/integrated-reference.html
prototype/app/integrated-reference.js
prototype/app/integrated-reference.css
```

Core rule:

> Accepted prototype가 실제 장면을 이미 정의한 경우, prose contract의 큰 구조만 만족하는 시각적으로 다른 화면을 대체안으로 만들지 않는다.

Prototype fixture values are not runtime authority, but accepted composition/proportions/density/visual relationships are the production visual reference.

---

# Current status

| Item | Status |
| --- | --- |
| Core spatial model | **MAPLESS** |
| Existing Integrated Reference | **OWNER ACCEPTED** |
| Accepted candidate ref | `4c12084bef603866b9b69f1bfd8f363146920184` |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 | **CLOSED / ACCEPTED** |
| WO-UI-003 first visual implementation | **SUPERSEDED / OWNER QA FAIL** |
| WO-UI-003 accepted-reference rework | **OWNER RE-QA PASS** |
| WO-UI-003 | **CLOSED / ACCEPTED** |
| DM Library product direction | **RECORDED** |
| DM Library architecture boundary | **DRAFTED** |
| DM Library candidate prototype | **BUILT** |
| DM Library Owner visual/flow review | **PENDING** |
| DM Library runtime implementation | **NOT YET AUTHORIZED** |
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

The Owner re-tested this rework and accepted it with:

> 그래 잘 됐어.

See:

- `work-orders/WO-UI-003-HUMAN-QA.md`;
- `work-orders/WO-UI-003-IMPLEMENTATION-RECORD.md`.

---

# New product extension — DM Library

Owner direction:

> DM은 혼자 액세스 가능한 전용 라이브러리 시스템이 있었어야해. 거기에 이미지와 PC액터와 NPC액터를 미리 모아두고 사용할수 있어야했어.

Canonical planning entry:

`DM-LIBRARY-PLAN.md`

Architecture boundary:

`../dm-library-persistence.md`

The new durable model is:

```text
PLAYER DURABLE
Character Library
└─ Player-owned Characters

LOCAL HOST PREPARATION DURABLE
DM Library
├─ Images
├─ PC Actor Presets
└─ NPC Actor Definitions

SESSION TRANSIENT / AUTHORITATIVE
Current Session
├─ Character SessionProjections
├─ instantiated Library Actors
├─ active/revealed Handout
├─ HP/resources/effects
├─ Initiative/economy
└─ Resolution/Activity
```

Hard rules:

- DM Library is private local preparation data;
- Player Clients do not receive the Library catalog merely because a Session exists;
- image preview is not reveal;
- explicit Reveal creates the shared Handout projection;
- NPC/PC source entry -> new independent Session Actor instance;
- Session HP/resources/effects do not automatically write back to the Library source;
- PC Actor Preset is not a Player-owned Character;
- assigning Session control does not transfer Character ownership;
- Images remain presentation/Handout assets, not battlemaps;
- DM Library stays under Session rather than becoming a new permanent global navigation destination;
- Content/Add-ons remains a separate package/catalog concept.

---

# DM Library prototype candidate

Review entry:

```text
docs/design/ui-ux/prototype/app/dm-library-reference.html
```

Supporting files:

```text
docs/design/ui-ux/prototype/app/dm-library-reference.css
docs/design/ui-ux/prototype/app/dm-library-reference.js
docs/design/ui-ux/prototype/DM-LIBRARY-EXTENSION.md
```

Review scenarios:

```text
DMLIB-SCN-01 — Offline Images
DMLIB-SCN-02 — Offline NPC Actor Definitions
DMLIB-SCN-03 — Offline PC Actor Presets
DMLIB-SCN-04 — Live Encounter Add from Library
DMLIB-SCN-05 — Live Handout private preview -> Reveal
DMLIB-SCN-06 — Player non-delivery
```

The existing accepted Integrated Reference remains accepted for its existing scenes. DM Library is a **new candidate extension** and needs separate Owner visual/flow acceptance before it is promoted into the consolidated accepted reference.

---

# DM Library architecture gaps before runtime implementation

```text
GAP-DM-LIBRARY-METADATA-PERSISTENCE
GAP-DM-LIBRARY-ASSET-STORAGE
GAP-DM-LIBRARY-ACTOR-INSTANTIATION
GAP-DM-LIBRARY-PRIVATE-PROJECTION
```

Existing relevant gaps:

```text
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

Work Order planning record:

`work-orders/WO-UI-004-dm-library-preparation-and-live-invocation.md`

WO-UI-004 runtime implementation is **not yet authorized**. First review the candidate prototype, then freeze/materialize the needed architecture/runtime contracts.

---

# Product invariants

- Core remains **mapless**.
- No Actor x/y, grid, pathfinding, Fog of War, LoS geometry or tactical token field.
- Actor Cards/Boards are Connected Play Actor representation.
- Stage is context/dice/result/Handout presentation, not a battlefield.
- Freeform has no fake turn economy.
- Initiative extends the same Play scene.
- Host = DM; Client = Player.
- Offline has no hidden connected DM/Player role identity.
- Product navigation does not end/recreate the Session.
- Main Hand has no smart fallback.
- DM-only privacy cannot be implemented by CSS hiding.
- Handout is presentation, not battlemap.

---

# Current next gate

```text
Open prototype/app/dm-library-reference.html
-> review DMLIB-SCN-01 through DMLIB-SCN-06
-> Owner accept/change DM Library preparation + live invocation UX
```
