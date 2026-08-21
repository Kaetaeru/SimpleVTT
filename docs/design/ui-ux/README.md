# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX는 **Repository-wide 통합 기획 → mapless Reference Prototype → Owner Acceptance → 상세 구현 계약 → 첫 Runtime Slice 구현 및 검증**까지 진행되었습니다.

UI 작업은 앞으로 다음 기준을 함께 읽습니다:

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions + `INTEGRATED-PRODUCT-UX-PLAN.md`;
3. Owner가 승인한 `prototype/app/integrated-reference.html`;
4. `contracts/`의 상세 implementation contracts;
5. 해당 Runtime Slice의 Work Order / Scoped Freeze / Implementation Record.

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
| WO-UI-001 scoped dependency gate | **PASS** |
| WO-UI-001 runtime implementation | **완료** |
| WO-UI-001 bounded local verification | **PASS** |
| WO-UI-001 full UI CI | **PASS** |
| WO-UI-001 TypeScript / production build | **PASS** |
| WO-UI-001 | **VERIFIED COMPLETE** |
| WO-UI-002 | **미승인 / 미시작** |
| broad future runtime implementation | **자동 승인 아님** |

Accepted prototype:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

Machine-readable current state:

[`contracts/MANIFEST.yaml`](contracts/MANIFEST.yaml)

WO-UI-001 implementation evidence:

[`work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md)

---

# WO-UI-001 — VERIFIED COMPLETE

Implemented runtime slice:

**Product Shell + First-run Tutorial + Sheet Presentation Preference**

## Implemented behavior

```text
Fresh first use
-> dedicated Tutorial before normal Home interaction
-> Standalone / Host / Join orientation
-> required Official-style / SimpleVTT initial Sheet choice
-> Tutorial completion + Sheet presentation persisted locally
-> Home
```

Returning use:

```text
App launch
-> Home
```

Tutorial can be reopened from Settings without clearing Character/session/rules state.

The two Character Sheet layouts remain presentation modes over the **same canonical Character**.

Normal Product navigation is now presented at the top in this order:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

The old Home-owned onboarding lifecycle was removed.

The historical `.v1-sidebar` class name remains temporarily in markup for bounded compatibility, but its user-visible layout is no longer a permanent left navigation rail.

---

# WO-UI-001 verification

Final successful UI workflow:

```text
run_id: 32486454036
source head SHA: ff3b253c840aa9c46f83ffcdd53374b1b5cd1760
conclusion: SUCCESS
```

Passed in the same run:

- UI named-rule boundary;
- new first-run preference tests;
- new Tutorial/Product Shell structural tests;
- existing Session layer contracts;
- production Play accessibility/structure;
- combat VFX boundaries;
- unified Session UX;
- tabletop Sheet/dice/intent regressions;
- non-Character product UX;
- Host preparation/content;
- live DM mechanics continuity;
- connected lifecycle / ownership / Character / inventory / spellcasting regressions;
- progression and authoritative mechanics suites;
- TypeScript + production build.

An earlier verification attempt failed because the new navigation-order test searched all of `App.tsx` instead of the actual `nav` declaration. The assertion was corrected; the runtime implementation did not need a behavioral rollback.

---

# Still deliberately deferred

WO-UI-001 did **not** modify:

```text
ProductRoot connected composition
SessionModeRoot
ProductionPlayScreen
Actor Boards
Command Center
targeting / Main Hand
resolution selective locking
DM-only privacy
Handout networking
Session transport / authority / lifecycle
map/spatial modules
Character creation / Level Up rules logic
```

This matters because a verified Slice is not permission to expand into adjacent systems.

---

# Next bounded Slice candidate

## WO-UI-002 — Connected Product Shell Continuity / Return to Play

Known drift:

```text
src/ProductRoot.tsx
connected session -> SessionModeRoot only
```

Accepted UX requires a live connected context to preserve Product navigation continuity and expose an explicit **Return to Play** path without resetting authoritative Session state.

Likely dependency set includes:

- `UX-01-03` — Play continuity;
- `UX-03-02` — dedicated Play with persistent return path;
- `NAV-01-02` — Return to Play;
- `QA-NAV-06` — connected continuity verification.

**WO-UI-002 has not been authorized or implemented.**

Before touching it, perform the same bounded process:

```text
source/test inspection
-> Work Order
-> applicable scoped dependency gate
-> explicit runtime authorization
-> implementation
-> targeted/regression/build verification
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

These did not block WO-UI-001 because that Slice explicitly excluded their behaviors.

---

# Current next action

```text
WO-UI-001: VERIFIED COMPLETE
WO-UI-002: NOT AUTHORIZED
```

The next runtime step, if the owner chooses to continue, is **preparing WO-UI-002**, not silently expanding WO-UI-001.
