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
- fresh Character create/save/play/restart: `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`; UI `31975560755`; Main `31975560651`.
- fresh Skills: `c835963e918cce94bd535054a6553ead7e786262`; UI `31976028376`; Main `31976028381`.
- fresh attack + Dash/session-economy: product boundary `5d48312289e2f01508b3860428ce98e2830d5f26`; UI `31976479248`; Main `31976479264`.
- persisted non-fixture Inventory: `c61469c87f6343ff55601e60890d13a58b6a5536`; Persistence `31976901167`; UI `31976901162`; Main `31976901170`.
- persisted non-fixture spellcasting: product/final head `868b8e37127ea644444630cb45a84f36664912ed`; UI `31977494408`; Main `31977496228`; Contract `31977496255`; Rules `31977496204`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Documentation credit completed this continuation
- `.agents/PHASE14_CHECKLIST.md` was safely read through the full-blob path and updated documentation-only at `119bf5dd029ab7cd4268c908afa1cf28075d16de`.
- Product source did not change in that commit, so no green gate was rerun just for checkbox credit.
- Credit was deliberately conservative: fresh Character actor/action derivation, core P14.3 skill runtime, canonical P14.4 attack/Freeform economy, P14.5 atomic consumable durability, P14.6 real-caster spell authority, local/restart integration, and directly proven automated integration items. Visible-UI/accessibility, concentration, connected spell, broad equipment/attunement and unproven lifecycle wording remain unchecked.

## Latest validated slice — P14.8 host-unknown remote Inventory authority
Final validated work head: `00487d6f421a43b15fb5ef77419e87d8182c35d4`.
Product behavior boundary: `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`.

### Test-first evidence and product gap
- `30bb1f51b495b6b21f5b9f334c5f3090b7e30495` added `tests/ui/connectedProjectedCharacterInventoryResolution.test.ts` for a host-unknown persisted Fighter with exact ItemInstance `item.phase14.remote-inventory-fighter.healing-potion` and canonical definition `dnd.srd521.item.gear.potion-of-healing`.
- `39eadde71371fb5508ded21bebfca2c39424661b` wired it into the canonical Phase12 connected authority batch.
- Phase12 `31979020855`, connected-protocol `95242770542`: existing 42 connected regressions passed; only the new test failed because Host reconstruction classified the canonical potion as `equipment` instead of `consumable`. This isolated a real SessionProjection reconstruction gap rather than a ledger/apply regression.

### Product repair
- `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3` updates `characterSessionProjectionReconstruction.ts` only:
  - determines consumable ItemInstance kind from the Host-trusted canonical `consumable-definition` mechanic instead of presentation category;
  - derives the supported Potion of Healing action only from the Host canonical definition/mechanic, including canonical `2d4+2`, bonus-action economy and actual projected ItemInstance id;
  - does not trust client-provided `grantedActionIds` or presentation strings as mechanics authority;
  - leaves connected ledger, event application, persistence and replay protocols unchanged.
- `dfdbceeddef85fc4b0b9b42f1fd1d0b386dee839` adds the new regression to Main Playable's arbitrary SessionProjection gate.
- The next Phase12 run `31979172287` proved kind reconstruction passed; its only failure was test-only registry misuse (`MountedCharacterSessionProjection` intentionally has no `actions` field). `00487d6f421a43b15fb5ef77419e87d8182c35d4` corrected the test to assert the mounted action from `SceneVm.actionsByActor`; no product behavior changed.

### Exact validation at `00487d6f421a43b15fb5ef77419e87d8182c35d4`
- Phase12 `31979232001`, connected-protocol `95243277113`: **completed success** — new remote projected Inventory regression + all existing connected authority tests + Phase11 offline preservation + production frontend build all green.
- Main Playable `31979231986`, playable-contract `95243277140`: **completed success** — full UI/rules/TypeScript/build + Phase11 + Phase12 + Phase13 arbitrary SessionProjection, including the new remote Inventory regression, all green.
- Windows subjobs are not used as human/final release acceptance evidence for this slice.

The focused regression proves:
- a host-unknown non-fixture Character's canonical Potion of Healing is reconstructed as a consumable and executable action with its exact projected ItemInstance id;
- the remote ActionRequest stages/resolves on Host authority, does not spend quantity during preview, then atomically commits healing plus quantity `2 -> 1`;
- Host restores its own local Character context and permanent Character library remains unchanged;
- Host broadcasts exactly one ordered committed event batch after commit;
- owning Client applies HP/item changes, persists them before cursor advancement, rehydrates them from Character Library, and duplicate event/request traffic does not double-apply or create another durable generation.

This directly supports P14.8 remote `행동`/Inventory action, committed event batch, owning-client once-only durable apply, replay/idempotency, and host permanent-library isolation. Remote spell and remote skill remain open.

## Architecture constraints preserved
- SessionProjection mechanics are reconstructed from Host canonical content; client source declares identity/runtime values but does not own mechanics.
- Character Library remains the owning Client's durable source. Host projected Characters stay ephemeral.
- Existing Host ledger, ResolutionEvent broadcast, client apply-before-cursor, duplicate request/event and reconnect semantics were reused unchanged.
- No fixture Character fallback, parallel connected protocol, duplicate durable source, or tactical map/grid/path/LOS scope was added.

## Next Exact Action
1. Do not rerun the remote Inventory slice, P14.6 spell slice, or prior connected lifecycle gates unless their relevant source boundary changes.
2. Documentation-only: on the next safe checklist write, credit the P14.8 remote-action statements directly proven by existing `connectedProjectedCharacterResolution.test.ts` plus the new remote Inventory regression; do not credit remote spell/skill yet.
3. Continue P14.8 test-first with a host-unknown persisted spellcaster projection. Prove one supported spell ActionRequest resolves on Host through canonical SessionProjection/runtime authority, broadcasts committed ResolutionEvents once, and the Client converges without Host permanent-library mutation. Prefer the already-supported Fire Bolt or Magic Missile path and reuse the connected protocol rather than adding a parallel spell message.
4. Patch product only if that remote-spell regression exposes a real reconstruction/runtime gap; run Phase12 and Main only once for the changed boundary.
5. Then continue remaining P14.7 DM/live-session gaps, P14.10 UX/accessibility, Windows two-instance human acceptance and final exact-head artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.
