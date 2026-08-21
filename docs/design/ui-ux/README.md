# SimpleVTT UI/UX — 사용자 대시보드

현재 SimpleVTT UI/UX 진행 상태:

```text
Repository-wide 통합 기획
-> mapless Reference Prototype
-> Owner Acceptance
-> 상세 runtime contracts
-> WO-UI-001 CLOSED / ACCEPTED
-> WO-UI-002 CLOSED / ACCEPTED
-> WO-UI-003 IMPLEMENTED / AUTOMATED PASS / OWNER HUMAN QA PENDING
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
| WO-UI-003 implementation | **완료** |
| WO-UI-003 automated verification | **PASS** |
| WO-UI-003 Owner Human QA | **대기** |
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

This acceptance did not approve the then-current broad Connected Play topology; that drift became WO-UI-003.

---

# WO-UI-003 — IMPLEMENTED / AUTOMATED PASS / HUMAN QA PENDING

Scope:

**Connected Play Actor Boards / Tabletop Stage / Persistent Command Center**

Evidence:

- [`work-orders/WO-UI-003-connected-play-actor-boards-command-center.md`](work-orders/WO-UI-003-connected-play-actor-boards-command-center.md)
- [`work-orders/WO-UI-003-SCOPED-AUTHORIZATION.md`](work-orders/WO-UI-003-SCOPED-AUTHORIZATION.md)
- [`work-orders/WO-UI-003-IMPLEMENTATION-RECORD.md`](work-orders/WO-UI-003-IMPLEMENTATION-RECORD.md)

Owner authorization:

> 그래 가자

Implemented production skeleton:

```text
Compact Play chrome / connection status
────────────────────────────────────────
Upper opposing Actor Board
────────────────────────────────────────
Shared mapless Play Context / Tabletop Stage
────────────────────────────────────────
Lower allied Actor Board
────────────────────────────────────────
Persistent Command Center
```

Command Center now uses direct authoritative capability discovery instead of the historical intent-first primary funnel:

```text
controlled Actor summary
+ HP / Temp HP / status
+ authoritative resources where actually projected
+ Initiative economy only during Initiative
+ direct Hotbar pages: Mixed / Action / Spell / Item
+ contextual target selection / Execute
```

Actor Boards consume `SceneVm.entities`; Command Center consumes `SceneVm.actionsByActor`, `economyByActor`, `ActionVm.available`, `disabledReason`, and `eligibleTargetIds`. UI does not calculate D&D legality or spatial geometry.

## Automated verification

Verified source:

```text
fb007d809ab586ca8d2e135e5813e929772a7f2c
```

Exact-head UI workflow:

```text
run_id: 32496754716
job: frontend
conclusion: SUCCESS
```

Passed:

- accepted Connected Play topology gate;
- Product Shell / Return-to-Play continuity;
- Freeform / Initiative / Command Center / utility / Handout / responsive regressions;
- connected lifecycle / late join / ownership regressions;
- broad rules/progression/mechanics regressions;
- TypeScript;
- production build.

## Remaining Human QA

Owner should verify the Tauri runtime visually and interactively:

```text
Host Open -> immediate Freeform
-> upper/lower Actor Boards visible
-> broad mapless Stage visible
-> persistent direct-capability Command Center visible
-> add/select DM Combatant updates Actor/Command Center
-> Initiative preserves boards + Command Center and adds tracker/economy
-> narrow desktop stays usable
-> SimpleVTT 메뉴 -> Product -> 플레이로 돌아가기 preserves Session
```

Do not close WO-UI-003 until that Owner Human QA is recorded.

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

# Open technical contracts for later slices

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

WO-UI-003 does not claim these gaps resolved.

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

**WO-UI-003 Owner Human QA.**

Do not automatically begin a later Runtime Slice merely because automated checks passed.
