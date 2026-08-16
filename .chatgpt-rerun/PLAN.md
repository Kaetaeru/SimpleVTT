# Rerun Plan — SimpleVTT

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Work branch: `agent/108-production-play-session-ux`
- Issue #108; Draft PR #109 open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`; sequence `1`; task `phase14-production-play-session-ux`

## Preserved evidence — do not repeat unchanged boundaries
- Phase13 baseline `7c9440970753a370fec7830cfa691832552e1d05` and recorded artifact evidence.
- Ready/start: `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571`; UI `31971618534`; Main `31971618703`.
- disconnect/late-join/Host reconnect: `84d1d39135c08a2094783fb336a606f294b1cf58`; Phase12 `31972318100`; UI `31972318109`; Main `31972318188`.
- client reconnect/idempotency: `cf520d35acd1e21a0247fdeb2d3664ae8a334345`; Phase12 `31973034389`; UI `31973034337`; Main `31973034347`.
- explicit session end/restart: `240592cb646bfbbfe9466f94047bc1e2f544dcf9`; Phase12 `31973878162`; Main `31973878165`.
- local projection ownership: `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`; UI `31974455354`; Main `31974455339`.
- invalid-entry ghost safety: `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d`; Phase12 `31974996616`.
- durable-after-end rehydrate: `b20ecf18015cec15ad3eb26aba5674e5c91013cb`; Phase12 `31975132450`; Main `31975132458`.
- fresh Character create/save/play/restart baseline: `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`; UI `31975560755`; Main `31975560651`.
- fresh Character Skills: `c835963e918cce94bd535054a6553ead7e786262`; UI `31976028376`; Main `31976028381`.
- fresh Character attack + Dash/session-economy repair: product boundary `5d48312289e2f01508b3860428ce98e2830d5f26`; UI `31976479248`; Main `31976479264`.
- persisted non-fixture Inventory use: `c61469c87f6343ff55601e60890d13a58b6a5536`; Persistence `31976901167`; UI `31976901162`; Main `31976901170`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Latest validated slice — P14.6 persisted non-fixture spellcasting
Current exact work/product head: `868b8e37127ea644444630cb45a84f36664912ed`.

### Test-first failure that identified the product gap
- `277e2cd84b110a8657a4aa8e5d940131549bc923` added `tests/ui/productionFreshCharacterSpells.test.ts` for a persisted non-fixture Sorcerer (`char.phase14-spell-sorcerer`) with canonical Fire Bolt, Magic Missile, and two level-1 slots.
- `0da70413261a7662d4a54c644fdfbeb92a4def1d` wired the regression into the canonical Phase14 UI step.
- UI `31977327303`, frontend `95238662114` failed only the new spell regression; the existing 15 Phase14 tests in the same batch passed. Exact failure: the arbitrary persisted Sorcerer had no spellcasting HUD/runtime caster projection. This confirmed a real product gap rather than a stale-test expectation.

### Product repair
- Existing `spellcastingRuntimeAdapter` had fixture-era caster/slot projection centered on `char.mira`, while `productionPlayRuntimeAdapter` exposed only a small presentation spell subset. The domain spell kernel already had complete executable mechanics for Fire Bolt and Magic Missile.
- `6591fca15cd15483a534b529c365ba41220db557` added `productionSpellcasterProjectionAdapter.ts`:
  - projects arbitrary persisted Character spell sources into `spellcastingByActor[character.id]`;
  - derives class-appropriate spellcasting ability, attack modifier, save DC and slot maxima;
  - derives production Fire Bolt and Magic Missile actions from the Character's actual spell ids with `combat-executable` metadata;
  - does not add fixture Character ids or a second spell-slot store.
- `29ece514ff6683fdbd6723ce4a9af172f9341a3c` added `productionSpellRuntimeAdapter.ts`; `ead7d9bb525d75125ea0d251e7a5b669caad0e64` corrected Fire Bolt to reuse one authoritative d20 face consistently.
  - only the supported Fire Bolt/Magic Missile actions are intercepted;
  - execution reuses the existing `resolveSpellCast` domain kernel, current TurnRuntime state, real caster HUD and target facts;
  - Fire Bolt uses authoritative attack/damage dice without slot cost;
  - Magic Missile uses authoritative projectile dice, spends exactly one TurnRuntime slot, and records the slotted-caster turn marker;
  - committed ResolutionEvents are projected to Activity/event history; rejection remains atomic;
  - session spell-slot consumption is not serialized into Character Library, avoiding a duplicate durable source of truth.
- `868b8e37127ea644444630cb45a84f36664912ed` composed the arbitrary spellcaster projection before the Phase09 spell router and production spell execution after production Character projection.

### Exact validation at `868b8e37127ea644444630cb45a84f36664912ed`
- UI push `31977494408`, frontend `95239056759`: **completed success**. New persisted Sorcerer spell regression passed; existing Phase14 fresh Character lifecycle/skills/actions/inventory tests, legacy authoritative spellcasting, full Phase09 mechanics, TypeScript and production build all passed.
- Main Playable PR run `31977496228`, playable-contract `95239068920`: **completed success**. Full UI/rules/build + Phase11 + Phase12 + Phase13 all passed. Windows subjob is not human/final release evidence for this slice.
- Contract validation `31977496255` and Rules Domain `31977496204` also completed success automatically at the same head; they are supplementary, not a reason to rerun unchanged boundaries.

The P14.6 regression proves a persisted non-fixture Sorcerer owns the runtime caster HUD/slot resources, casts Fire Bolt through authoritative attack/damage without spending a slot, cycles initiative, casts Magic Missile through authoritative projectile damage with slot 2 -> 1 and Activity/provenance/turn-marker state, disables a second same-turn slotted cast, and leaves Character Library storage revision unchanged because the slot is session runtime rather than durable Character state.

## Checklist documentation status
- `.agents/PHASE14_CHECKLIST.md` is 35,919 bytes at blob `0e452a8e800390bf737b660f6e06b5b5c0709151` before any new documentation credit.
- This continuation discovered a safe full-blob read path with the GitHub blob API, so the earlier truncation limitation can be avoided on the next documentation-only write.
- Physical checkboxes were deliberately not rewritten after product validation because the checkpoint window had begun. Do not rerun product gates merely to mark documentation.
- Directly evidence-backed P14.6 credit includes: real Character caster context, real-caster slot derivation, cantrip no-slot behavior, committed slotted spell slot cost, authoritative spell attack/damage, and the P14.6 supported-cantrip + supported-slotted-spell gate. Do not credit concentration or connected remote spell casting from this local slice.
- Earlier fresh Character/P14.3/P14.4/P14.5 evidence remains eligible for documentation-only credit where the exact statements are directly proven.

## Architecture constraints preserved
- Character Library remains the sole durable Character source; session-only spell slots remain TurnRuntime state.
- Production spell execution reuses `resolveSpellCast`, TurnRuntime session state, ResolutionEvents, Activity/event-history projection and existing spell-slot selection.
- Unsupported/partial Vicious Mockery/Thunderwave mechanics were not promoted merely to satisfy the gate; the tested pair is Fire Bolt + Magic Missile, both already `combat-executable` in the domain kernel.
- No Aelar/Mira product fallback, duplicate Character library, or direct presentation mutation was added.
- Existing connected Host/SessionProjection/reconnect/end/write-back boundaries were not changed.
- No tactical map/grid/path/LOS expansion.

## Next Exact Action
1. Documentation-only first: fetch the exact current checklist blob and safely apply only evidence-backed fresh Character/P14.3/P14.4/P14.5/P14.6 checkbox credit. Do not rerun the corresponding green product gates.
2. Then begin P14.8 remote-action coverage test-first, focused on a host-unknown persisted Character projection sending a supported spell or inventory action through the existing connected action request -> Host authoritative commit -> committed event batch -> owning Client apply path. Prefer extending existing connected projection/action tests rather than creating a parallel protocol.
3. Prove Host does not mutate its permanent Character library and owning Client applies durable events once; retain existing replay/idempotency guarantees. Patch product only if this product-realistic regression exposes a real gap.
4. After that continue remaining P14.7 DM/live-session gaps, P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
5. PR #109 remains draft/unmerged. No merge is authorized.
