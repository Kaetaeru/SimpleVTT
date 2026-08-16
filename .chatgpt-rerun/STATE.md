# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged

## Preflight
Required files were read from `main` in exact order: README -> control -> STATE -> PLAN after reading the GitHub skill. run_id / sequence / task / `continue` matched.

Initial actual state for this continuation:
- main `0ce953aeb33be0228571af917efc5611cf0f7fce`
- work `c61469c87f6343ff55601e60890d13a58b6a5536`
- PR #109 open/draft/unmerged, mergeable observed true

Previously verified Inventory, fresh Character Skills/Actions, connected participant/session-end and older persistence gates were not manually repeated.

## Completed this continuation — P14.6 persisted non-fixture spellcasting
Current exact work/product head: `868b8e37127ea644444630cb45a84f36664912ed`.

### Investigation and test-first failure
- Production spell projection was still split: `productionPlayRuntimeAdapter` exposed only Healing Word/Vicious Mockery/Thunderwave presentation actions, while `spellcastingRuntimeAdapter` maintained its runtime caster/slot registry around fixture-era `char.mira`.
- Domain `spellMechanics.ts` already marks `dnd.srd521.spell.fire-bolt` and `dnd.srd521.spell.magic-missile` as `combat-executable`, making them a narrow supported Sorcerer pair without promoting partial mechanics.
- `277e2cd84b110a8657a4aa8e5d940131549bc923` added `tests/ui/productionFreshCharacterSpells.test.ts` using a persisted non-fixture Sorcerer `char.phase14-spell-sorcerer`, Fire Bolt, Magic Missile and two level-1 slots.
- `0da70413261a7662d4a54c644fdfbeb92a4def1d` wired it into the canonical UI Phase14 step.
- UI `31977327303`, frontend `95238662114` failed only the new test after the existing 15 Phase14 tests passed. Exact failure: `persisted production spellcaster must own a spellcasting HUD/runtime caster projection`. This was classified as a real product gap.

### Product repair
- `6591fca15cd15483a534b529c365ba41220db557` added `src/app/productionSpellcasterProjectionAdapter.ts`:
  - arbitrary persisted Character spell sources -> `spellcastingByActor[character.id]`;
  - class-appropriate spellcasting ability, attack modifier, save DC and slot maxima;
  - production Fire Bolt and Magic Missile actions with executable spell metadata;
  - no fixture Character mapping and no duplicate slot store.
- `29ece514ff6683fdbd6723ce4a9af172f9341a3c` added `src/app/productionSpellRuntimeAdapter.ts`:
  - intercepts only Fire Bolt/Magic Missile;
  - reuses existing `resolveSpellCast`, current TurnRuntime, real HUD caster and target facts;
  - commits authoritative Fire Bolt attack/damage and Magic Missile projectile damage/slot cost;
  - projects committed ResolutionEvents to Activity/event history;
  - leaves Character Library untouched for session-only slot consumption.
- `ead7d9bb525d75125ea0d251e7a5b669caad0e64` corrected Fire Bolt to draw one authoritative d20 face and reuse that same face for domain resolution/evidence.
- `868b8e37127ea644444630cb45a84f36664912ed` updated `offlineRuntimeAdapters.ts` composition so arbitrary spellcaster projection is visible before the Phase09 spell router captures its snapshot boundary, then production spell execution is layered after production Character projection.

## Exact validation at `868b8e37127ea644444630cb45a84f36664912ed`
- UI push `31977494408`, frontend `95239056759`: **completed success**. New persisted Sorcerer spell regression passed; existing Phase14 lifecycle/skills/actions/inventory tests, historical authoritative spellcasting, full Phase09 mechanics, TypeScript and production build all green.
- Main Playable PR run `31977496228`, playable-contract `95239068920`: **completed success**. Full UI/rules/build + Phase11 + Phase12 + Phase13 all green.
- Contract validation `31977496255`: **success**; Rules Domain `31977496204`: **success** at the same exact head. These are supplementary automatic evidence.
- Windows Main subjob was queued after playable-contract and is not used as human/final acceptance evidence for this slice.

The focused P14.6 regression proves:
- persisted non-fixture Sorcerer owns the runtime caster HUD and real-caster slot projection;
- Fire Bolt resolves through authoritative spell attack/damage and does not spend a slot;
- initiative turn cycling restores action economy;
- Magic Missile resolves through authoritative projectile damage and spends exactly one level-1 slot (`2 -> 1`);
- Activity/provenance and the one-slotted-spell-per-turn marker are produced, and a second same-turn slotted cast is disabled;
- Character Library storage revision stays unchanged because spell-slot consumption is session runtime, not a new durable Character source of truth.

## Checklist documentation path
- `.agents/PHASE14_CHECKLIST.md` exact pre-credit blob: `0e452a8e800390bf737b660f6e06b5b5c0709151`, size 35,919 bytes.
- Unlike earlier truncated contents reads, `GitHub.fetch_blob` returned the complete checklist safely in this continuation.
- Physical checkbox credit was deliberately not written after the product validation because the checkpoint window had begun. Do not rerun product gates just to mark boxes.
- Next continuation can safely fetch the current blob and perform a documentation-only whole-file replacement while preserving all content.
- P14.6 directly evidence-backed statements: real Character caster context; real-caster slot derivation; cantrip does not spend slots; committed slotted spell spends correct slot; spell attack/damage uses authoritative runtime; supported cantrip + supported slotted spell gate. Leave concentration and connected remote spell statements unchecked from this local-only slice.
- Earlier fresh Character/P14.3/P14.4/P14.5 statements remain eligible for documentation-only credit only where their recorded exact-head evidence directly proves the wording.

## Architecture preserved
- Character Library remains the durable Character source; session spell slots remain TurnRuntime state.
- `resolveSpellCast`, TurnRuntime resources, ResolutionEvents and Activity/event history remain the authority path.
- Unsupported/partial Vicious Mockery and Thunderwave were not upgraded merely to satisfy P14.6.
- No Aelar/Mira product fallback, duplicate Character mechanics document, or direct UI mutation was added.
- Existing connected Host/SessionProjection/reconnect/end/write-back boundaries were unchanged.
- No tactical map/grid/path/LOS expansion.

## Current actual state before coordination writes
- main `0ce953aeb33be0228571af917efc5611cf0f7fce`
- work `868b8e37127ea644444630cb45a84f36664912ed`
- PR #109 open/draft/unmerged, head `868b8e37127ea644444630cb45a84f36664912ed`, mergeable observed true
- no merge performed or authorized

## Remaining work / Next Exact Action
1. Documentation-only first: fetch the exact current `.agents/PHASE14_CHECKLIST.md` blob and safely credit only directly evidence-backed fresh Character/P14.3/P14.4/P14.5/P14.6 statements. Do not rerun those green gates.
2. Then begin P14.8 remote-action coverage test-first on a host-unknown persisted Character projection, preferring extension of existing connected projection/action tests. Focus first on a supported spell or inventory action through connected action request -> Host authoritative commit -> committed event batch -> owning Client apply.
3. Prove Host permanent Character library remains untouched, owning Client durable event apply remains once-only where applicable, and replay/idempotency guarantees remain intact. Patch product only if the new regression exposes a real gap.
4. Later continue remaining P14.7 DM/live-session gaps, P14.10 UX/accessibility, Windows two-instance human acceptance and final exact-head artifact verification.

## Dispatch recommendation
`continue`
