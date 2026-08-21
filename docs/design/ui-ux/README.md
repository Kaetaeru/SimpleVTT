# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 다음 단계까지 진행되었습니다.

```text
Repository-wide 통합 기획
-> mapless Reference Prototype
-> Owner Acceptance
-> 상세 runtime contracts
-> WO-UI-001 CLOSED / ACCEPTED
-> WO-UI-002 CLOSED / ACCEPTED
-> WO-UI-003 Connected Play topology 구현 중
```

UI 작업은 항상 다음 권위 순서를 함께 읽습니다.

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions + `INTEGRATED-PRODUCT-UX-PLAN.md`;
3. Owner가 승인한 `prototype/app/integrated-reference.html`;
4. `contracts/` 상세 implementation contracts;
5. 현재 Runtime Slice의 Work Order / Scoped authorization / Implementation Record / Human QA.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Core spatial model | **MAPLESS — battlemap 없음** |
| Accepted prototype | **`integrated-reference.html` — OWNER ACCEPTED** |
| Detailed contract set | **완료** |
| Behavior Scenarios | **48개** |
| QA Acceptance Matrix | **완료** |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 | **CLOSED / ACCEPTED** |
| WO-UI-003 | **AUTHORIZED / IMPLEMENTATION IN PROGRESS** |
| broad later runtime work | **자동 승인 아님** |

Accepted reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Machine-readable state:

[`contracts/MANIFEST.yaml`](contracts/MANIFEST.yaml)

---

# WO-UI-001 — CLOSED / ACCEPTED

Scope:

**Product Shell + First-run Tutorial + Sheet Presentation Preference**

Evidence:

- [`work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md)
- [`work-orders/WO-UI-001-HUMAN-QA.md`](work-orders/WO-UI-001-HUMAN-QA.md)

```text
bounded local verification: PASS
full UI CI: PASS
production TypeScript/build: PASS
Owner Human QA: PASS
```

---

# WO-UI-002 — CLOSED / ACCEPTED

Scope:

**Connected Product Shell Continuity / Return to Play**

Evidence:

- [`work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`](work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md)
- [`work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md`](work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md)
- [`work-orders/WO-UI-002-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-002-IMPLEMENTATION-RECORD.md)
- [`work-orders/WO-UI-002-HUMAN-QA.md`](work-orders/WO-UI-002-HUMAN-QA.md)

Accepted bounded flow:

```text
Live Connected Play
-> `SimpleVTT 메뉴`
-> Product Shell / safe destination
-> `플레이로 돌아가기`
-> exact same live Session / role / mode / context
```

Owner Human QA: **PASS**.

Important boundary: this acceptance did **not** approve the then-current broad Connected Play layout. The owner explicitly noticed that it did not look like the accepted prototype.

---

# WO-UI-003 — ACTIVE

Scope:

**Connected Play Actor Boards / Tabletop Stage / Persistent Command Center**

Work Order / authorization:

- [`work-orders/WO-UI-003-connected-play-actor-boards-command-center.md`](work-orders/WO-UI-003-connected-play-actor-boards-command-center.md)
- [`work-orders/WO-UI-003-SCOPED-AUTHORIZATION.md`](work-orders/WO-UI-003-SCOPED-AUTHORIZATION.md)

Owner authorization:

> 그래 가자

Target production skeleton:

```text
Compact Play chrome / connection status
────────────────────────────────────────
Upper opposing Actor Board
────────────────────────────────────────
Shared Play Context / Tabletop Stage   [contextual utility]
────────────────────────────────────────
Lower allied Actor Board
────────────────────────────────────────
Persistent Command Center
```

The Command Center follows the accepted direct-capability direction:

```text
controlled Actor summary
+ authoritative Resource Rail where supplied
+ Initiative economy only in Initiative
+ direct Hotbar pages: Mixed / Action / Spell / Item
+ contextual targeting/Execute without replacing the skeleton
```

Historical intent-first funnels are not the primary capability entry for this Connected Play runtime slice.

## Authority boundaries

WO-UI-003 consumes existing runtime projections and does not invent:

- D&D legality;
- target range/LoS;
- Main Hand fallback;
- reconnect truth;
- Actor resources for Actors that do not supply them;
- privacy delivery;
- map coordinates/grid/pathfinding.

## Known blockers that remain outside this slice

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

---

# Product invariants

- SimpleVTT Core has **no battlemap**.
- Actor tactical x/y, grid, pathfinding, Fog of War, LoS geometry and draggable map tokens are not Core UI semantics.
- First use starts with dedicated Tutorial.
- Official-style and SimpleVTT are presentations of the same Character.
- Standalone dice stay on the current Character Sheet.
- Connected Play uses Actor Cards/Boards and Persistent Command Center.
- Host = DM; Client = Player; Offline has no DM/Player identity.
- Freeform has no fake per-turn economy.
- Initiative extends the same Play skeleton.
- Product navigation does not end/recreate/reconnect Session by itself.
- Main Hand has no smart fallback.
- DM-only privacy cannot be implemented as CSS hiding.
- Handout is presentation, not battlemap.

---

# Implementation reading order

1. [`INTEGRATED-PRODUCT-UX-PLAN.md`](INTEGRATED-PRODUCT-UX-PLAN.md)
2. [`contracts/IMPLEMENTATION-PLAYBOOK.md`](contracts/IMPLEMENTATION-PLAYBOOK.md)
3. [`contracts/GLOSSARY-AND-TERMINOLOGY.md`](contracts/GLOSSARY-AND-TERMINOLOGY.md)
4. [`contracts/SURFACE-CONTRACT.md`](contracts/SURFACE-CONTRACT.md)
5. [`contracts/COMPONENT-CONTRACT.md`](contracts/COMPONENT-CONTRACT.md)
6. [`contracts/INTERACTION-STATE-MOTION-CONTRACT.md`](contracts/INTERACTION-STATE-MOTION-CONTRACT.md)
7. [`contracts/BEHAVIOR-SCENARIOS.md`](contracts/BEHAVIOR-SCENARIOS.md)
8. [`contracts/IMPLEMENTATION-TRACEABILITY.md`](contracts/IMPLEMENTATION-TRACEABILITY.md)
9. [`contracts/QA-ACCEPTANCE-MATRIX.md`](contracts/QA-ACCEPTANCE-MATRIX.md)
10. [`contracts/MANIFEST.yaml`](contracts/MANIFEST.yaml)
11. active Work Order + authorization + implementation record.

Do not substitute generic VTT conventions, current legacy source, or historical `.agents/` notes for this hierarchy.

---

# Current next gate

```text
WO-UI-003 automated exact-head verification
-> Tauri Owner visual/interaction Human QA
-> only then WO-UI-003 CLOSED / ACCEPTED
```

Do not automatically begin a later Runtime Slice merely because WO-UI-003 automated checks pass.
