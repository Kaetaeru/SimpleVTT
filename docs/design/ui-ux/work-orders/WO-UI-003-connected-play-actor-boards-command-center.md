# WO-UI-003 — Connected Play Actor Boards / Tabletop Stage / Persistent Command Center

Status: **CLOSED / ACCEPTED AFTER ACCEPTED-REFERENCE REWORK**

Date: 2026-08-22

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

Authorization record:

`WO-UI-003-SCOPED-AUTHORIZATION.md`

Implementation record:

`WO-UI-003-IMPLEMENTATION-RECORD.md`

Human QA record:

`WO-UI-003-HUMAN-QA.md`

Accepted-reference rework source evidence:

`acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f`

---

# 1. Goal

Reconcile production Connected Play with the Owner-accepted mapless layout contract without changing Session authority, rules, transport, persistence or Character rules.

Accepted production composition:

```text
Compact Play chrome / Session status
Upper opposing Actor Board
Mapless Play Context / Tabletop Stage      [contextual utility]
Lower allied Actor Board
Persistent Command Center
```

Initiative extends this skeleton; it does not replace it with another route/workspace.

---

# 2. First implementation — rejected

The first implementation used the right broad nouns but materially diverged from the accepted scene.

Historical source/run:

```text
source: fb007d809ab586ca8d2e135e5813e929772a7f2c
UI run: 32496754716
result: SUCCESS, but structural gate was insufficient
```

Owner Human QA rejected that visual implementation and required the runtime to follow the concrete accepted `integrated-reference.html/js/css` scene rather than a prose-only approximation.

That implementation is superseded and is not the accepted visual result.

---

# 3. Accepted-reference rework

The rework directly pins the production scene to the accepted reference relationship and geometry:

```text
Play chrome             41px
Upper Actor Board       86px
Mapless Stage           flexible remainder
Lower Actor Board       86px
Command Center          174px
Initiative tracker      ~40px at Stage top
Contextual utility      338px nominal / 288–455px bounds
Command body            240px / flexible Hotbar / 104px
Hotbar slot             ~70px
ActorCard               ~164–258px, 73px high
```

Constrained desktop follows the accepted prototype family rather than inventing a different information architecture.

Material corrections include:

- removed the separate 52px Connected Play identity header;
- removed the permanent vertical Session utility rail;
- restored compact accepted Play chrome;
- restored full-width horizontal Actor Board bands/card density;
- made the central Stage broad/quiet/mapless;
- reduced Initiative to the compact tracker role;
- kept economy/End Turn in Command Center;
- restored accepted Command Center anatomy and compact Hotbar density;
- aligned Session/Encounter/Activity/etc. to contextual utility behavior;
- preserved Product Return-to-Play session continuity.

---

# 4. Command Center

The accepted primary capability model is direct/persistent rather than the historical intent-first funnel.

Baseline accepted page family:

- Mixed;
- Action;
- Spell;
- Item;
- Custom presentation family.

Canonical runtime sources remain authoritative:

- `SceneVm.actionsByActor`;
- `SceneVm.economyByActor`;
- `ActionVm.available` / `disabledReason`;
- `eligibleTargetIds` / `maxTargets`;
- owning Character resources only for the actual controlled Character;
- existing `resolveAction`, `selectDmActor`, Initiative/Session operations.

UI does not calculate rules legality, target range/LoS, Main Hand fallback, privacy delivery, reconnect truth or spatial geometry.

---

# 5. Actor Boards

This slice establishes production Actor Boards/Cards for:

- identity;
- current runtime relation/side;
- HP / Temp HP;
- compact status;
- AC;
- current turn/control emphasis where supplied;
- intentional empty boards;
- minimum useful card width + horizontal overflow.

The existing runtime relation schema remains authoritative; this slice does not invent new relation/domain states.

Full future target-valid/invalid/selected ActorCard behavior is not silently claimed beyond current authoritative targeting projection.

---

# 6. Verification

Accepted-reference rework source:

```text
acb3f68a2e985f2abb8cdf2a5b241a3d275aa08f
```

Evidence:

- strengthened accepted-reference Connected Play structural/geometry gate: **PASS**;
- Main Playable `Verify full UI, rules, TypeScript, and production frontend`: **PASS**;
- Connected Session production frontend gate: **PASS**;
- existing connected/session/character/spellcasting regressions reached/passed before the separate Phase 09 aggregate red in the UI workflow.

The UI workflow's separate `Phase 09 real mechanics services` aggregate remained red, but compare evidence showed this rework changed UI/CSS/UI tests/UI docs only and did not modify Phase 09 mechanics service/test files. It is recorded as a separate regression concern rather than misclassified as a WO-UI-003 visual failure.

The strengthened gate reads the accepted prototype source and pins concrete relationships/geometry so the previously rejected visual approximation can no longer pass merely by containing similarly named regions.

---

# 7. Owner Human QA — PASS

The first visual implementation was rejected.

After the accepted-reference rework, the Owner performed the requested Session visual check and responded:

> 그래 잘 됐어.

This closes the WO-UI-003 visual/composition slice as **ACCEPTED**.

See `WO-UI-003-HUMAN-QA.md` for the full fail -> rework -> pass provenance.

---

# 8. Explicit exclusions still open

WO-UI-003 acceptance does not resolve:

- battlemap/grid/Actor coordinates/path/LoS/fog;
- default hostile click -> Main Hand relation;
- smart action fallback;
- selective resolution-safe interaction calculation;
- DM-only/private delivery protocol;
- Handout network/reconnect architecture;
- authoritative Spatial Facts projection;
- Character rules/progression;
- new neutral-relation domain schema;
- Hotbar persistence/customization schema.

Those remain separate scope/gaps.

---

# 9. Final state

```text
FIRST IMPLEMENTATION: SUPERSEDED / OWNER QA FAIL
ACCEPTED-REFERENCE REWORK: IMPLEMENTED
ACCEPTED-REFERENCE AUTOMATION: PASS
OWNER RE-QA: PASS
WO-UI-003: CLOSED / ACCEPTED
```

Next product work must treat the accepted Connected Play composition as the baseline rather than reopen it implicitly.
