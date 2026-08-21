# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → mapless Reference Prototype → Owner Acceptance → 상세 구현 계약 → WO-UI-001 CLOSED/ACCEPTED → WO-UI-002 구현 및 자동검증 완료**까지 진행되었습니다.

UI 작업은 앞으로 다음 기준을 함께 읽습니다:

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions + `INTEGRATED-PRODUCT-UX-PLAN.md`;
3. Owner가 승인한 `prototype/app/integrated-reference.html`;
4. `contracts/`의 상세 implementation contracts;
5. 해당 Runtime Slice의 Work Order / Scoped authorization / Implementation Record / Human QA record.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **0개** |
| Repository-wide Product/UI audit | **완료** |
| Integrated Product/UX baseline | **Active** |
| Core spatial model | **MAPLESS — battlemap 없음** |
| Accepted prototype | **`integrated-reference.html` — OWNER ACCEPTED** |
| Detailed contract set | **완료** |
| Behavior Scenarios | **48개** |
| QA Acceptance Matrix | **완료** |
| WO-UI-001 automated verification | **PASS** |
| WO-UI-001 Owner Human QA | **PASS** |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 source/test inspection | **완료** |
| WO-UI-002 scoped dependency + runtime authorization | **RECORDED** |
| WO-UI-002 runtime implementation | **완료** |
| WO-UI-002 automated verification | **PASS** |
| WO-UI-002 Owner Human QA | **대기** |
| broad future runtime implementation | **자동 승인 아님** |

Accepted prototype:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Machine-readable current state:

[`contracts/MANIFEST.yaml`](contracts/MANIFEST.yaml)

WO-UI-001 final evidence:

- [`work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md)
- [`work-orders/WO-UI-001-HUMAN-QA.md`](work-orders/WO-UI-001-HUMAN-QA.md)

Current Work Order and evidence:

- [`work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`](work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md)
- [`work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md`](work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md)
- [`work-orders/WO-UI-002-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-002-IMPLEMENTATION-RECORD.md)

---

# WO-UI-001 — CLOSED / ACCEPTED

Implemented runtime slice:

**Product Shell + First-run Tutorial + Sheet Presentation Preference**

Final evidence:

```text
bounded local verification: PASS
full UI CI: PASS
production TypeScript/build: PASS
Owner Human QA: PASS
```

Final successful UI workflow:

```text
run_id: 32486454036
conclusion: SUCCESS
```

WO-UI-001 acceptance does not authorize adjacent runtime slices.

---

# WO-UI-002 — IMPLEMENTED / AUTOMATED PASS / HUMAN QA PENDING

Runtime slice:

**Connected Product Shell Continuity / Return to Play**

## Implemented behavior

```text
Live Connected Play
-> compact `SimpleVTT 메뉴`
-> Product Shell / safe Product destination
-> visible `플레이로 돌아가기`
-> exact same SessionModeRoot live Session
```

Navigation preserves authoritative Session truth rather than creating another Session or Play implementation.

Preserved state includes:

```text
same Session
same Host/DM or Client/Player role
same SessionMode
same initiative/current turn
same authoritative controlled Actor where valid
same PendingResolution/game state
same connection truth
HP/resources/effects/participants/history
```

Product navigation does **not**:

- call `stopSession`;
- start a new Host Session;
- Join again;
- reconnect merely because Product Shell opened;
- create local/fake role or SessionMode authority;
- use `ProductionPlayScreen` as a second connected Play implementation.

## Implementation boundary

`AppProvider` remains above `ProductRoot` and owns the authoritative application snapshot/runtime operations.

`ProductRoot` owns only local presentation choice:

```text
product | play
```

This presentation state is not persisted across process restart.

Connected Play exposes the Product entry as compact chrome; Session termination remains a separate lifecycle action.

## Automated verification

Latest successful UI workflow for the implemented exact head lineage:

```text
run_id: 32490406078
frontend: SUCCESS
```

The workflow passed:

- WO-UI-002 dedicated continuity gate;
- v1 Product Shell / Session layer contracts;
- Session accessibility/responsive regressions;
- Phase 14 play/session/tabletop-sheet/physics-dice regressions;
- connected lifecycle/ownership/inventory/spellcasting regressions;
- progression and authoritative mechanics regressions;
- TypeScript + production build.

## Human QA path

WO-UI-002 is not CLOSED yet. Owner verification should cover:

```text
1. Host or Client enters live Connected Play.
2. `SimpleVTT 메뉴` opens Product Shell without ending the Session.
3. Open Home or Rules.
4. `플레이로 돌아가기` returns to the same connected Play.
5. Role, Freeform/Initiative state, current turn and current Session context remain intact.
```

Also confirm the Product entry remains usable at a narrow desktop width and is clearly distinct from Session End/Leave.

---

# WO-UI-002 key contract references

Primary behavior:

- `Scenario 34 — Product navigation during live Host Session`

Primary QA:

- `QA-NAV-06` — live Return to Play preserves context
- `QA-SES-09` — Product nav preserves role/session

Direct Product/UX dependencies:

```text
UX-01-02
UX-01-03
UX-02-01
UX-02-06
UX-02-07
UX-03-01
UX-03-02
NAV-01-01
NAV-01-02
NAV-01-04
NAV-01-06
NAV-01-08
UI-01-01
```

---

# Implementation reading order

Start with:

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
11. current Work Order + authorization + implementation record.

Do not substitute generic VTT conventions or historical `.agents/` notes for this accepted hierarchy.

---

# Product invariants that remain binding

- SimpleVTT Core has **no battlemap**.
- Actor tactical x/y position, grid, pathfinding, Fog of War, LoS geometry, draggable map tokens are not Core UI semantics.
- First use starts with the dedicated Tutorial.
- Official-style and SimpleVTT are two presentations of the same Character.
- Standalone dice stay inside the current Character Sheet.
- Connected Play uses Actor Cards/Boards and a persistent Command Center, not a tactical token map.
- Host = DM, Client = Player; Offline has no DM/Player role.
- Product navigation must not create/end/reconnect a Session by itself.
- Main Hand has no smart fallback.
- DM-only privacy cannot be implemented as CSS hiding.
- Handout is image presentation, not a battlemap.

---

# Open technical contracts for later slices

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

They did not block WO-UI-002 because that Slice was bounded to navigation/presentation composition.

---

# Current next action

```text
WO-UI-001: CLOSED / OWNER ACCEPTED
WO-UI-002: IMPLEMENTED / AUTOMATED PASS / OWNER HUMAN QA PENDING
```

Next gate:

**WO-UI-002 Owner Human QA.**

Do not close WO-UI-002 or automatically begin a later Runtime Slice until this bounded acceptance gate is recorded.
