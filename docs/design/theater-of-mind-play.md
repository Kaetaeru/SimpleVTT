# Theater-of-mind play (V1.2 design)

Owner decision (2026-09-05): SimpleVTT plays **without positions**. The app never stores coordinates or
distances. Rules that need geometry are resolved at the moment they are needed with the cheapest possible
question, and the default answer is always the permissive one the DM would already have in mind.

## Principles

1. **No positions, only relations that play produced.** A creature that made a melee attack against another is
   *engaged* with it. Engagement is inferred from resolved actions, never typed in.
2. **Default is "yes".** Melee reaches, ranged attacks are in range, targets are visible. The DM corrects the
   rare exception after the fact with one toggle on the result card.
3. **One question, on the result card, yes/no.** Players are never blocked. Anything the app is unsure about lands
   in a DM queue or as a toggle on the committed result; Undo authority already exists.
4. **One tap.** Action → target → result. Stages auto-advance; detail is behind a fold.

## Rules without positions

| Rule needs | Replacement |
| --- | --- |
| melee reach | always allowed; DM toggle "닿지 않음" on the result (re-records as approach + attack, or cancels) |
| ranged range | always allowed; if the attacker is engaged, ranged-in-melee disadvantage is applied automatically with a toggle to lift it |
| areas | target caps (already the model) plus **groups**: the DM pre-groups enemies once ("고블린 ×3 · 한 무리") and an area picks a group in one tap |
| opportunity attacks | only when an engagement exists, prompted at the moment a creature declares **물러남**; Disengage suppresses the prompt |
| movement | three declarations instead of feet: 접근(대상), 물러남, 그대로. Speed is displayed, never gates. Dash is a narrative flag |
| sight / light / cover | scene-wide conditions (어둠, 안개) and per-creature badges (숨음, 투명, 엄폐). Badges drive the rules; no badge means clear |
| engagement end | persists across turns; ends on 물러남, 이탈, target death, or a round without melee between the pair |

Range bands (교전 / 가까움 / 멀리) are optional: a DM may drop a card into a band, but every flow above works
without bands.

## What the DM sees

- The opposing board folds by **group**: three goblins are one card; expanded shows individual HP. Encounter add
  is one line ("고블린 ×3 한 무리"); identical monsters share group initiative by default.
- Engagement lines are thin links between cards — the only "spatial" information on screen.
- Every result card carries post-hoc toggles: 닿지 않음, 엄폐 반/¾, 불리점, 이점, 피해 절반. A toggle recalculates
  that one resolution.
- Narrative damage and conditions are direct: −5, −10, 절반 chips and condition badges on the card, no roll.
- A DM question queue holds only what the app could not decide (target count at the cap, opportunity-attack
  candidate, attack against a hidden creature). Player screens never block on it.

## What a player sees

- Action tap, target tap, done. No range or sight questions.
- Their own card's engagement state and badges. Withdrawing asks once: 이탈로? / 그냥 물러남?
- Area spells pick a group or check names from a list.

## Data model

Stored: engagement relation set, group tags, scene conditions, per-creature badges. Nothing else. Targeting
facts derive from them: engaged → 5 feet, otherwise "unknown but allowed"; visibility from badges and scene
conditions; cover from badges. The existing `manual-unconstrained` spatial authority accepts this provider; the
rules engine is unchanged.

## What changes in the code

1. Engagement inference: a pure domain function over resolution events (create / clear relations).
2. Group tags and group initiative: encounter panel and opposing board.
3. Movement reduced to three declarations; opportunity-attack prompt bound to 물러남; the per-card "기회공격 유발"
   button goes away.
4. One-tap resolution: auto-advance by default, detail folded, post-hoc toggles on the result card.
5. Scene conditions, creature badges, narrative edit chips.
6. Delete the collapsed distance tool on the Session screen and the unmounted movement dialog.

The SRD monster catalog is a precondition: group cards need something to fill them.
