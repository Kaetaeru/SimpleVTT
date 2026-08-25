# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T08:51:19+09:00`

## Durable execution checkpoint

Rerun preflight completed in the mandatory order and the live run/sequence/task identity remained consistent with `control.json=continue`. Canonical V1 routing still points to R1 Druid Wild Shape. Previously completed Barbarian Rage work remains preserved and must not be repeated, including spellcasting prohibition, SRD 5.2.1 duration/extension/automatic termination, production extension action, Heavy-armor termination, and the intentional absence of a voluntary End Rage action.

New Druid Wild Shape progress in this execution:

- Added `src/domain/druidWildShape.ts` using existing RulesRuntimeState/Resolution primitives rather than a parallel shapeshift manager.
- Added canonical form-limit facts from the repository-linked SRD 5.2.1 Druid source: level 2 = 4 known forms / CR 1/4 / no flight; level 4 = 6 / CR 1/2 / no flight; level 8 = 8 / CR 1 / flight allowed.
- Wild Shape start now compiles one atomic resolution: replace any active Wild Shape marker, spend `resource:druid.wild-shape`, spend Bonus Action when initiative economy is active, gain temporary HP equal to Druid level through the existing temporary-HP primitive, and apply a time-limited marker for `druid level / 2` hours.
- The marker reuses existing effect termination for Incapacitated/dead and records selected form identity/CR/AC/speed plus Beast Spells casting permission at Druid level 18.
- Wild Shape start intentionally does not end Concentration; the repository-linked SRD source explicitly preserves existing Concentration.
- Voluntary Wild Shape exit is represented as the canonical Bonus Action removal of the active marker. It does not invent temp-HP source cleanup because the SRD text does not say remaining temporary HP disappears on exit and the existing temp-HP model has no source ownership.
- Reusing Wild Shape while already shaped replaces the marker and spends another use. Existing temporary HP conflict remains an explicit `keep-existing` / `take-new` choice through the existing temporary-HP rule instead of silently stacking or overwriting it.
- Added `tests/domain/druidWildShape.test.ts` covering atomic start/resource/economy/temp HP/duration, CR and flight gates, form replacement, voluntary exit, Concentration preservation, and level-18 Beast Spells metadata.
- Corrected the flying-form regression fixture so CR validation cannot mask the intended pre-level-8 flight rejection.
- Product source/test head before Rerun metadata commits: `cddef0c254108fe963a92cab2da7bd991a09bc21`.
- GitHub compare from pre-slice head `8dfa7334c687a3039fa4dbbe536bad645399d87f` to `cddef0c2` is ahead 4 / behind 0 and contains only `src/domain/druidWildShape.ts` and `tests/domain/druidWildShape.test.ts`.

Validation status:

- GitHub exposes 0 check runs and 0 commit statuses for `cddef0c2`; combined status therefore has no executable evidence.
- No new test/build green claim is made. The focused domain test is committed validation debt for a capable checkout/CI.
- Wild Shape overall is **not source-complete yet**. This checkpoint covers the domain lifecycle core only; production selection/action/projection/Undo and spellcasting enforcement remain.

## Next Exact Action

Continue Druid Wild Shape without repeating the domain core:

1. Reuse the existing production feature-adapter pattern (`barbarianRageRuntimeAdapter`) and existing `sourceKind:"wild-shape"` attack path; do not create a generic shapeshift/attack subsystem.
2. Establish the smallest non-arbitrary production seam for the Character's **known Wild Shape forms** and project one executable transform action per known form plus the canonical Bonus Action exit.
3. Connect transform/exit to existing resource/economy, ResolutionEvent Activity, Character write-back/runtime commit, and event-native Undo paths.
4. Enforce spellcasting prohibition from the active `DRUID_WILD_SHAPE_TAG` marker while allowing the level-18 Beast Spells exception recorded by `spellcastingAllowed`.
5. Add focused production regressions, then obtain executable validation evidence before calling Wild Shape source-complete or advancing the canonical R1 pointer to Monk Focus.

Keep the same run/sequence/task on `continue` while this implementation remains incomplete.
