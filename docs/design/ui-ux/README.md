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
-> accepted integrated-reference exact-scene rework IMPLEMENTED
-> accepted-reference automation PASS
-> Owner visual re-QA PENDING
```

---

# UI 구현 권위 순서

1. canonical Domain/Architecture truth;
2. current Product/UX Decisions;
3. `INTEGRATED-PRODUCT-UX-PLAN.md`;
4. **Owner가 승인한 실제 reference render**:
   - `prototype/app/integrated-reference.html`
   - `prototype/app/integrated-reference.js`
   - `prototype/app/integrated-reference.css`;
5. `contracts/` implementation contracts;
6. current Work Order / authorization / implementation / Human QA record.

핵심 규칙:

> Accepted prototype가 실제 장면을 이미 정의한 경우, prose contract의 큰 구조만 만족하는 시각적으로 다른 화면을 대체안으로 만들지 않는다.

Prototype fixture 값은 production authority가 아니지만, accepted scene의 **composition / proportions / density / visual relationship**은 production UI의 reference다.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Core spatial model | **MAPLESS** |
| Accepted prototype | **OWNER ACCEPTED** |
| Accepted candidate ref | `4c12084bef603866b9b69f1bfd8f363146920184` |
| WO-UI-001 | **CLOSED / ACCEPTED** |
| WO-UI-002 | **CLOSED / ACCEPTED** |
| WO-UI-003 first visual implementation | **SUPERSEDED** |
| WO-UI-003 first Owner visual QA | **FAIL** |
| WO-UI-003 reference rework source | `acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f` |
| Accepted-reference structural/UI gate | **PASS** |
| Full UI / Rules / TypeScript / production frontend | **PASS** |
| Connected Session authority/frontend gate | **PASS** |
| UI workflow global result | **RED — separate Phase 09 aggregate step** |
| WO-UI-003 new Owner visual QA | **PENDING** |
| PR #109 | **DRAFT / UNMERGED** |

---

# Accepted Connected Play scene

Primary reference scenarios:

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

Constrained desktop follows the prototype family:

```text
80px Actor Boards
164px Command Center
308px contextual overlay pane, max 42%
150px ActorCard basis
190px / flexible / 90px Command body
62px Hotbar slots
```

---

# WO-UI-003 rework

The Owner rejected the first implementation because it reproduced the region names but not the accepted scene.

The rejected implementation used, among other differences:

- a 52px separate identity header;
- a vertical utility rail;
- Actor Board label gutters;
- an oversized Stage dashboard;
- a large Initiative control area;
- a different Command Center anatomy;
- oversized Hotbar slots.

The rework now pins the actual accepted reference:

- compact 41px Play chrome;
- full-width Actor bands;
- restrained radial mapless Stage;
- compact Initiative order strip;
- right contextual utility pane;
- accepted Command Center anatomy;
- five-page compact Hotbar.

DM chrome follows the accepted order. Features whose authority contracts remain unresolved are not faked:

- `Public / DM Only` visually preserves the accepted chrome, but DM-only delivery remains unavailable until `GAP-DM-ONLY-DELIVERY-PROTOCOL` resolves;
- `Spatial Facts` is shown as explicitly unavailable when no authoritative projection exists;
- DM Handout remains available through the Session contextual pane instead of adding a permanent non-reference chrome button.

---

# Automated evidence

Rework source:

```text
acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f
```

Accepted-reference UI workflow:

```text
run: 32500827497
accepted-reference / Session structure gate: PASS
same gate on rerun: PASS
```

Main Playable workflow on the same source:

```text
run: 32500827476
full UI / rules / TypeScript / production frontend: PASS
connected authority and Phase 14 playable regressions: PASS
```

Connected Session workflow on the same source:

```text
run: 32500827494
connected-session authority: PASS
production frontend gate: PASS
```

The UI workflow remains globally red because its later `Verify Phase 09 real mechanics services` aggregate step fails and prevents that workflow's final build step from running.

Comparison against the prior green source shows the accepted-reference rework changed only Connected Play UI/CSS, UI structural tests and UI/UX docs; no Phase 09 `src/app` mechanics service or Phase 09 test file changed. That separate regression is therefore not being speculatively patched inside WO-UI-003.

---

# Product invariants

- Core remains **mapless**.
- No Actor x/y, grid, pathfinding, Fog of War, LoS geometry or tactical token field.
- Actor Cards/Boards are the Connected Play Actor representation.
- Stage is context/dice/result/Handout presentation, not a battlefield.
- Freeform has no fake turn economy.
- Initiative extends the same Play scene.
- Host = DM; Client = Player.
- Product navigation does not end or recreate the Session.
- Main Hand has no smart fallback.
- DM-only privacy cannot be implemented by CSS hiding.
- Handout is presentation, not battlemap.

Open technical contracts remain:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

---

# Current next gate

```text
Owner Tauri visual re-QA against integrated-reference
```

WO-UI-003 remains **OPEN** until the Owner confirms that the production Connected Play scene now matches the accepted reference direction.
