# WO-UI-003 — Human QA Record

Status: **FAIL — VISUAL / COMPOSITION REWORK REQUIRED**

Date: 2026-08-22

Work Order:

`WO-UI-003-connected-play-actor-boards-command-center.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

---

# Owner verdict

The Owner rejected the first WO-UI-003 visual implementation after running the production Session UI:

> 세션이 우리가 미리 상의했던 씬대로여야하잖아.
> https://github.com/Kaetaeru/SimpleVTT/blob/agent/108-production-play-session-ux/docs/design/ui-ux/prototype/app/integrated-reference.html
> 여기 만들어둔 html를 기준으로 다시 작성한걸 기준으로 기록해둔 기획서를 기준으로 UI작업을 해야지. 완전 다르잖아

This is a **Human QA FAIL** for the broad Connected Play visual/composition slice.

The earlier automated PASS must not be interpreted as visual acceptance. The structural gate was too weak: it verified the presence/order of Actor Boards, Stage and Command Center, but did not pin the runtime to the accepted prototype's concrete scene geometry and composition.

---

# Failure diagnosis

The rejected runtime approximated the accepted structure instead of reproducing the accepted scene.

Material drift included:

- separate 52px identity/session header instead of the accepted compact ~41px Play chrome;
- vertical Session utility rail instead of the accepted chrome controls + contextual right utility pane;
- Actor Board label gutter and different card anatomy instead of the accepted horizontal 86px bands;
- oversized Freeform/Initiative center content rather than the accepted broad restrained Mapless Play Context;
- Initiative strip carrying round/economy/action controls instead of remaining the accepted compact ~40px tracker;
- Command Center anatomy differing from the accepted 37px economy/resource rail plus 240px / Hotbar / 104px lower-body composition;
- Hotbar slots materially larger than the accepted compact ~70px capability slots.

---

# Rework rule

The rework is pinned directly to the accepted prototype implementation, not merely to a prose summary:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
docs/design/ui-ux/prototype/app/integrated-reference.js
docs/design/ui-ux/prototype/app/integrated-reference.css
docs/design/ui-ux/prototype/app/integrated-reference-fixtures.js
```

`INTEGRATED-PRODUCT-UX-PLAN.md` and the extracted contracts remain mandatory semantic/authority guards, but they are not a license to substitute a visually different composition when the accepted prototype already defines the scene.

Primary runtime target:

```text
PROTO-SCN-08 — DM Freeform mapless
PROTO-SCN-09 — Player Freeform mapless
```

Initiative extends the same scene according to the accepted prototype.

---

# Rework geometry baseline

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

# Acceptance state

```text
FIRST WO-UI-003 AUTOMATION: PASS BUT INSUFFICIENT
OWNER HUMAN VISUAL QA: FAIL
WO-UI-003: OPEN — REWORK IN PROGRESS
```

Do not close WO-UI-003 until the Owner visually confirms that production Connected Play now matches the accepted integrated reference direction.
