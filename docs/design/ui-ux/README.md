# SimpleVTT UI/UX — 사용자 대시보드

현재 진행 상태:

```text
Repository-wide 통합 기획
-> mapless Integrated Reference Prototype
-> Owner Acceptance
-> 상세 runtime contracts
-> WO-UI-001 CLOSED / ACCEPTED
-> WO-UI-002 CLOSED / ACCEPTED
-> WO-UI-003 first implementation automated PASS
-> Owner visual QA FAIL
-> accepted integrated-reference exact-scene rework IN PROGRESS
```

---

# 권위 순서

UI 작업은 항상 다음 순서로 읽습니다.

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions;
3. `INTEGRATED-PRODUCT-UX-PLAN.md`;
4. **Owner가 실제로 승인한 `prototype/app/integrated-reference.html`과 그 렌더 구현 (`integrated-reference.js/css`)**;
5. `contracts/` implementation contracts;
6. 현재 Work Order / authorization / Implementation Record / Human QA.

중요:

**Accepted prototype가 실제 장면을 이미 정의한 경우, prose contract의 큰 구조만 만족하는 시각적으로 다른 화면을 대체안으로 만들지 않는다.**

Prototype fixture 데이터는 production authority가 아니지만, accepted scene의 composition / density / spatial relationship은 visual reference다.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Core spatial model | **MAPLESS** |
| Accepted prototype | **`integrated-reference.html` — OWNER ACCEPTED** |
| Accepted candidate ref | `4c12084bef603866b9b69f1bfd8f363146920184` |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 | **CLOSED / ACCEPTED** |
| WO-UI-003 first automated gate | **PASS, later judged insufficient** |
| WO-UI-003 Owner visual QA | **FAIL** |
| WO-UI-003 accepted-reference rework | **IMPLEMENTED SOURCE CANDIDATE / AUTOMATION PENDING** |
| WO-UI-003 new Owner re-test | **PENDING** |
| PR #109 | **DRAFT / UNMERGED** |

Accepted visual source set:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
docs/design/ui-ux/prototype/app/integrated-reference.js
docs/design/ui-ux/prototype/app/integrated-reference.css
docs/design/ui-ux/prototype/app/integrated-reference-fixtures.js
```

Primary Connected Play reference scenarios:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

---

# WO-UI-001 — CLOSED / ACCEPTED

Scope:

**Product Shell + First-run Tutorial + Sheet Presentation Preference**

Evidence:

- `work-orders/WO-UI-001-IMPLEMENTATION-RECORD.md`
- `work-orders/WO-UI-001-HUMAN-QA.md`

---

# WO-UI-002 — CLOSED / ACCEPTED

Scope:

**Connected Product Shell Continuity / Return to Play**

Accepted behavior:

```text
Live Connected Play
-> Product destination
-> Return to Play
-> same live Session / role / mode / context
```

This slice accepted continuity only. It did not accept the broad Connected Play visual layout.

Evidence:

- `work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`
- `work-orders/WO-UI-002-SCOPED-AUTHORIZATION.md`
- `work-orders/WO-UI-002-IMPLEMENTATION-RECORD.md`
- `work-orders/WO-UI-002-HUMAN-QA.md`

---

# WO-UI-003 — HUMAN QA FAIL / REWORK ACTIVE

Scope:

**Connected Play Actor Boards / Mapless Stage / Persistent Command Center**

Owner authorization:

> 그래 가자

Owner visual rejection of first implementation:

> 세션이 우리가 미리 상의했던 씬대로여야하잖아. ... 여기 만들어둔 html를 기준으로 다시 작성한걸 기준으로 기록해둔 기획서를 기준으로 UI작업을 해야지. 완전 다르잖아

The rejection is recorded in:

`work-orders/WO-UI-003-HUMAN-QA.md`

## Why the first implementation failed

The first runtime reproduced only the **names/order of the broad regions**, not the accepted scene itself.

Examples:

```text
first runtime                          accepted integrated reference
───────────────────────────────────    ──────────────────────────────────
52px identity header                   41px compact Play chrome
vertical utility rail                  chrome controls + right utility pane
Actor Board label gutter               full horizontal Actor band
large Initiative control area          ~40px compact Stage-top tracker
different Command Center anatomy       37px rail + 240/flex/104 body
large Hotbar cards                     ~70px compact capability slots
```

Therefore the old automated result:

```text
source fb007d809ab586ca8d2e135e5813e929772a7f2c
UI run 32496754716: SUCCESS
```

is historical regression evidence only and **not visual acceptance**.

## Current exact-reference rework

Production Connected Play is being pinned to the actual accepted render:

```text
41px Play chrome
────────────────────────────────────
86px Upper Actor Board
────────────────────────────────────
flexible Mapless Play Context
  centered focus / dice / result
  ~40px Initiative tracker when active
  contextual right utility pane
────────────────────────────────────
86px Lower Actor Board
────────────────────────────────────
174px Persistent Command Center
  37px economy/resource rail
  240px controlled Actor | Hotbar | 104px context
```

Narrow desktop follows the accepted prototype family:

```text
80px boards
164px Command Center
308px contextual overlay pane (max 42%)
150px ActorCard basis
190 / flex / 90 Command body
62px Hotbar slots
```

Runtime source remains authoritative for Actor/action/resource/session truth. Prototype fixture values are not copied into production.

## Rework files

Primary:

- `src/ProductRoot.tsx`
- `src/SessionModeRoot.tsx`
- `src/SessionInitiativeStrip.tsx`
- `src/SessionActionDock.tsx`
- `src/session-integrated-reference-play.css`

Strengthened gates:

- `tests/ui/connectedPlayAcceptedTopology.test.ts`
- `tests/ui/connectedProductShellContinuity.test.ts`
- `tests/ui/sessionInitiativeExpansionStructure.test.ts`
- `tests/ui/sessionActionDockStructure.test.ts`
- `tests/ui/sessionResponsiveKeyboardFocusStructure.test.ts`

The topology test now reads the accepted prototype JS/CSS directly and pins concrete composition/proportions rather than accepting a structural approximation.

---

# Product invariants

- SimpleVTT Core has **no battlemap**.
- No Core Actor x/y, grid, pathfinding, Fog of War, LoS geometry or draggable tactical token.
- Actor Cards remain board/list objects.
- Central Stage is presentation/context/dice/result space, not a battlefield.
- First use starts with Tutorial.
- Official-style and SimpleVTT Sheets share one canonical Character.
- Standalone dice stay on the current Sheet.
- Connected Host = DM; Client = Player.
- Freeform has no fake per-turn economy.
- Initiative extends the same Play scene.
- Normal capabilities stay directly discoverable through the Hotbar.
- Product navigation does not end/recreate a Session.
- Main Hand has no smart fallback.
- DM-only privacy cannot be CSS hiding.
- Handout is presentation, not battlemap.

---

# Open technical contracts

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

WO-UI-003 does not claim these resolved.

---

# Current next gate

```text
accepted-reference rework exact-head automation
-> Owner Tauri visual re-test against integrated-reference
```

Do not close WO-UI-003 or begin a later visual slice until the Owner accepts the reworked production scene.
