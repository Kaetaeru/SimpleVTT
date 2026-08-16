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

Do not manually repeat these gates unless their relevant source boundary changes.

## Latest validated slice — persisted non-fixture Inventory use
Current exact work head: `c61469c87f6343ff55601e60890d13a58b6a5536`.

No product source changed in this slice.

1. `ce4b9db158476259588ea3baca9c710b783ad35c` adds `tests/ui/productionFreshCharacterInventory.test.ts`.
2. The test seeds a persisted non-fixture Character through `CharacterLibraryRepository` with unique Character id `char.phase14-inventory-fighter` and unique ItemInstance id `item.phase14-inventory-fighter.healing-potion`; it does not use Aelar/Mira as the played Character.
3. A fresh production adapter hydrates that Character from the same `MemoryCharacterLibraryStore`, enters local Freeform play, and derives `action.healing-potion` with `itemCost.itemId` equal to the actual persisted ItemInstance id.
4. Roll/effect preview does not spend quantity, mutate HP, or create a storage generation.
5. Confirmed use flows through existing `phase09RealAtomicItemAdapter`: authoritative healing + item quantity event stream commits HP and quantity together, event-native Activity records HP and `phase09:item:<itemId>:quantity`, and Freeform does not consume hidden Initiative economy.
6. Character Library storage revision advances once for the atomic durable commit; a fresh adapter rehydrates the same Character with committed HP and potion quantity, and the production item action is re-derived from the same ItemInstance id/remaining quantity.
7. `04534e61fcf6453e6c1d77f84a8d0b799a5b3d0b` wires the regression into the Phase14 UI gate; `c61469c87f6343ff55601e60890d13a58b6a5536` wires it into Persistence application-contract.

### Exact validation at `c61469c87f6343ff55601e60890d13a58b6a5536`
- Persistence `31976901167`, application-contract `95237644695`: **completed success** — new Inventory durability regression, existing Character/content/module persistence contracts, and production build all green. Separate Windows Tauri storage job is not required acceptance evidence for this test-only slice.
- UI `31976901162`, frontend `95237644651`: **completed success** — new Inventory regression, previous Phase14 fresh Character Skills/Actions, historical mechanics regressions, TypeScript, and production build all green.
- Main Playable `31976901170`, playable-contract `95237648526`: **completed success** — full UI/rules/build + Phase11 + Phase12 + Phase13 green. Windows executable subjob is not human/final release acceptance evidence here.

This directly supports the P14.5 authoritative item-use/durable-write-back gate and P14.9/P14.11 item durability statements. It does not by itself credit full Inventory browsing/grouping UI, equipment/attunement interactions, charged-magic-item behavior on a non-fixture Character, target-required item UX, or human acceptance.

## Checklist documentation status
The fresh Character baseline, P14.3, P14.4 and this P14.5 core behavior now have durable exact-head evidence. Physical `.agents/PHASE14_CHECKLIST.md` boxes remain unchanged because the connected GitHub file writer only exposes whole-file replacement while reads of this long file truncate. Do not risk truncating/corrupting the checklist merely to mark credit; retain evidence in PLAN/STATE until a safe partial edit method is available.

## Architecture constraints preserved
- Character Library remains the durable source; the Inventory test seeds and rehydrates through the actual repository/store contract rather than a parallel state path.
- Item use reuses the existing atomic ResolutionEvent -> Character write-back -> Activity/Undo architecture; no direct UI mutation or fixture fallback was introduced.
- production play derives item actions from the persisted Character/ItemInstance ids.
- connected Host authority/SessionProjection/reconnect/end/write-back boundaries were untouched.
- no tactical map/grid/path/LOS expansion.

## Next Exact Action
1. Do not rerun the Inventory slice or prior connected/session-end gates unless their source boundary changes.
2. Begin P14.6 Spells test-first using a persisted non-fixture spellcasting Character through the production play composition.
3. Prove at least one supported cantrip and one supported slotted spell are derived for the generated/persisted Character id, resolve through authoritative runtime services, create Activity/provenance, and obey slot/resource commit semantics without fixture ids.
4. Include fresh storage rehydrate if a slotted-spell durable resource is currently modeled by the existing Character persistence contract; do not invent a second source of truth just to satisfy the test.
5. Patch product source only if the product-realistic spell regression exposes a real gap. Run only affected UI/Persistence/Main boundaries once.
6. Then continue remaining DM/live-session and P14.8 handshake/remote-action coverage, P14.10 UX/accessibility, Windows two-instance human acceptance, and final exact-head artifact verification.
7. PR #109 remains draft/unmerged. No merge is authorized.
