# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → mapless Reference Prototype → Owner Acceptance → 상세 구현 계약 → WO-UI-001 구현/자동검증/Owner Human QA 완료 → WO-UI-002 구현 준비 완료**까지 진행되었습니다.

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
| WO-UI-002 Work Order | **PREPARED** |
| WO-UI-002 Domain/Architecture blocker | **없음 확인** |
| WO-UI-002 scoped dependency authorization | **아직 없음** |
| WO-UI-002 runtime implementation | **미승인 / 미시작** |
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

Current Work Order:

[`work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`](work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md)

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

# WO-UI-002 — PREPARED

Runtime slice:

**Connected Product Shell Continuity / Return to Play**

## Current drift

Current production composition is:

```text
src/ProductRoot.tsx
connected role
-> SessionModeRoot only

offline
-> App / Product Shell
```

That prevents the accepted model where Connected Play is a dedicated workspace **inside the same product identity** and the user can safely inspect Product destinations while the live Session stays authoritative/alive.

There is a second related drift:

```text
src/App.tsx
Return to Play
-> setRoute("scene")
-> ProductionPlayScreen
```

Once Product Shell becomes reachable during a live connected Session, that path would create a competing Connected Play presentation instead of returning to the accepted `SessionModeRoot` workspace.

Play also currently lacks the accepted compact persistent Product Shell entry in `SessionModeRoot` chrome.

## Accepted target behavior

```text
Live Connected Play
-> compact Open Product Shell
-> Home / safe Product destination
-> visible Return to Play
-> exact same SessionModeRoot live Session
```

Navigation alone must preserve:

```text
same Session
same Host/DM or Client/Player role
same SessionMode
same initiative/current turn
same authoritative controlled Actor where valid
same PendingResolution/game state
same connection truth
```

It must **not**:

- call `stopSession`;
- start a new Host Session;
- Join again;
- reconnect merely because Product Shell opened;
- create local/fake role or SessionMode state;
- mount `ProductionPlayScreen` as a second Connected Play implementation.

## Why this can remain a UI-composition Slice

`AppProvider` is mounted above `ProductRoot` and owns the authoritative application snapshot/runtime operations. Therefore ProductRoot can switch the visible **presentation subtree** between Product Shell and Connected Play without moving Session authority into the navigation layer.

No new Domain/Architecture contract is currently required.

## Expected implementation scope after authorization

Primary:

```text
src/ProductRoot.tsx
src/App.tsx
src/SessionModeRoot.tsx
src/session-mode.css

tests/ui/v1ProductShellStructure.test.ts
tests/ui/connectedProductShellContinuity.test.ts
.github/workflows/ui.yml
```

Conditional/minimal only:

```text
tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts
src/v1-product-shell.css
```

Explicitly out of scope:

```text
Connected Play topology redesign
Actor Boards
Command Center
targeting / Main Hand
resolution selective locking
DM-only privacy
Handout networking
Session transport/wire/authority
Host/Join lifecycle semantics
Lobby/Ready removal
Character rules/progression
map/spatial modules
```

---

# WO-UI-002 key contract references

Primary behavior:

- `Scenario 34 — Product navigation during live Host Session`

Primary QA:

- `QA-NAV-06` — live Return to Play preserves context
- `QA-SES-09` — Product nav preserves role/session

Direct Product/UX dependencies include:

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
11. [`work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`](work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md)

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

They do not block WO-UI-002 because that Slice is bounded to navigation/presentation composition.

---

# Current next action

```text
WO-UI-001: CLOSED / OWNER ACCEPTED
WO-UI-002: PREPARED
```

Next gate:

**WO-UI-002 scoped dependency authorization**.

No `src/` implementation should begin until that gate is recorded and a separate runtime implementation authorization is given.
