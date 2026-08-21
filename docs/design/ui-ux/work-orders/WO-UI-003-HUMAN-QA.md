# WO-UI-003 — Human QA Record

Status: **PASS AFTER ACCEPTED-REFERENCE REWORK**

Date: 2026-08-22

Work Order:

`WO-UI-003-connected-play-actor-boards-command-center.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

---

# 1. First Owner verdict — FAIL

The Owner rejected the first WO-UI-003 visual implementation after running the production Session UI:

> 세션이 우리가 미리 상의했던 씬대로여야하잖아.
> https://github.com/Kaetaeru/SimpleVTT/blob/agent/108-production-play-session-ux/docs/design/ui-ux/prototype/app/integrated-reference.html
> 여기 만들어둔 html를 기준으로 다시 작성한걸 기준으로 기록해둔 기획서를 기준으로 UI작업을 해야지. 완전 다르잖아

This was a **Human QA FAIL** for the first broad Connected Play visual/composition implementation.

The earlier automated PASS is historical evidence only. The structural gate had been too weak: it verified broad region presence/order without pinning the runtime to the accepted prototype's concrete scene geometry and composition.

---

# 2. First implementation failure diagnosis

Material drift in the rejected runtime included:

- separate 52px identity/session header instead of the accepted compact ~41px Play chrome;
- vertical Session utility rail instead of accepted chrome controls + contextual right utility pane;
- Actor Board label gutter and different card anatomy instead of accepted horizontal 86px bands;
- oversized Freeform/Initiative center content rather than the broad restrained Mapless Play Context;
- Initiative strip carrying round/economy/action controls instead of remaining the compact ~40px tracker;
- Command Center anatomy differing from the accepted 37px economy/resource rail plus 240px / Hotbar / 104px lower-body composition;
- Hotbar slots materially larger than the accepted compact ~70px capability slots.

---

# 3. Rework rule

The rework was pinned directly to the accepted prototype implementation, not merely to a prose summary:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
docs/design/ui-ux/prototype/app/integrated-reference.js
docs/design/ui-ux/prototype/app/integrated-reference.css
docs/design/ui-ux/prototype/app/integrated-reference-fixtures.js
```

`INTEGRATED-PRODUCT-UX-PLAN.md` and the extracted contracts remained mandatory semantic/authority guards, but were not treated as permission to substitute a visually different composition where the accepted prototype already defined the scene.

Primary runtime target:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

Initiative extends the same accepted scene.

---

# 4. Rework geometry baseline

Wide/normal desktop reference:

```text
Play chrome: 41px
Upper Actor Board: 86px
Mapless Stage: flexible remaining height
Lower Actor Board: 86px
Command Center: 174px
Initiative tracker: ~40px at Stage top edge
Utility pane: 338px nominal, 288–455px bounded
Command lower body: 240px / flexible Hotbar / 104px context
Hotbar slot: ~70px
```

Narrow reference follows the prototype's constrained-desktop variants rather than inventing a different IA.

---

# 5. Rework automated evidence

Accepted-reference rework source used for the strengthened UI evidence:

```text
acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f
```

Evidence recorded during rework:

- strengthened Connected Play accepted-reference structure gate: PASS;
- Main Playable `Verify full UI, rules, TypeScript, and production frontend`: PASS on the same source candidate;
- Connected Session production frontend gate: PASS;
- UI workflow's separate `Phase 09 real mechanics services` aggregate remained red, but compare evidence showed the accepted-reference rework changed UI/CSS/UI-test/UI-doc files only and did not modify the Phase 09 mechanics service layer. That unrelated aggregate red is not represented as a WO-UI-003 visual failure.

The strengthened gate directly checks the accepted prototype relationship/geometry rather than only named-region existence.

---

# 6. Second Owner verdict — PASS

After pulling/running the accepted-reference rework and performing the requested visual Session check, the Owner responded:

> 그래 잘 됐어.

This is the Owner Human QA acceptance for the reworked WO-UI-003 Connected Play visual/composition slice.

Interpretation:

- the previous first implementation remains rejected/superseded;
- the accepted-reference rework is the valid WO-UI-003 visual implementation;
- the Session scene now passes the Owner's visual check against the previously accepted integrated reference direction;
- this acceptance does not silently close unrelated architecture gaps or later DM Library work.

---

# 7. Final WO-UI-003 acceptance state

```text
FIRST WO-UI-003 AUTOMATION: PASS BUT INSUFFICIENT / HISTORICAL
FIRST OWNER HUMAN VISUAL QA: FAIL
ACCEPTED-REFERENCE REWORK: IMPLEMENTED
STRENGTHENED ACCEPTED-REFERENCE UI GATE: PASS
REWORK OWNER HUMAN VISUAL QA: PASS
WO-UI-003 VISUAL SLICE: CLOSED / ACCEPTED
```

Known gaps explicitly not closed by this acceptance remain separate, including Main Hand relation, resolution-safe interaction locking, Handout networking and DM-only/private delivery architecture.
