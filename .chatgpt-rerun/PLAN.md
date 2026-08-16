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
- P14.8 host-unknown remote Inventory authority: validated head `00487d6f421a43b15fb5ef77419e87d8182c35d4`; product boundary `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`; Phase12 `31979232001`; Main `31979231986`.

Do not manually repeat these gates unless their relevant source boundary changes.

## Documentation credit already completed
- `.agents/PHASE14_CHECKLIST.md` documentation-only credit is at `119bf5dd029ab7cd4268c908afa1cf28075d16de`.
- Product source did not change in that commit, so no green gate was rerun just for checkbox credit.
- Credit remains conservative: visible-UI/accessibility, concentration, broad equipment/attunement, remote skill and other unproven wording remain open.

## Completed this continuation — P14.8 host-unknown remote spell authority
Final validated work head: `82933a63846dae55fd4183eef15c22ca3836f082`.
No product source repair was required for this slice.

### Test-first evidence
- `3359883f2894687680c18874f23e612fc6ede564` added `tests/ui/connectedProjectedCharacterSpellResolution.test.ts` for a host-unknown persisted Sorcerer with canonical Fire Bolt `dnd.srd521.spell.fire-bolt`.
- The regression proves the SessionProjection carries the canonical spell content identity and persisted cantrip selection, then submits the normal connected `ActionRequest` using `action.fire-bolt` rather than introducing a parallel spell message.
- `395303b1033b754d348557718e20c827b7f0d415` wired the regression into the Phase12 connected-authority batch.
- Phase12 run `31980480472` reached the connected-authority step with the new test and that step passed before any product source change. This established that the existing projected-resolution context + production spell runtime already handles the remote Fire Bolt path.
- `82933a63846dae55fd4183eef15c22ca3836f082` wired the same regression into Main Playable's arbitrary SessionProjection gate.

### Existing architecture reused unchanged
- Host handshake accepts and mounts the remote Character SessionProjection ephemerally.
- On remote action routing, Host activates the mounted projected Character as the temporary resolution context and calls the existing production resolver.
- The existing production spellcaster projection derives the Fire Bolt action from the persisted Character spell selection; the existing production spell runtime resolves it through canonical spell mechanics and event-native ResolutionEvents.
- Host ledger commits and broadcasts the canonical resolution event exactly once, then restores the Host's own local Character context.
- Client applies the Host event through the existing replica/apply path; session-only enemy HP damage does not create a Character-library generation.
- Duplicate event/request traffic remains idempotent.
- Host permanent Character library remains unchanged; no fixture Character fallback or duplicate durable source was added.

### Exact validation at `82933a63846dae55fd4183eef15c22ca3836f082`
- Phase12 `31980517723`, connected-protocol `95246365126`: **completed success** — connected authority including the new remote Fire Bolt regression, Phase11 offline preservation and production frontend build all green.
- Main Playable `31980517740`, playable-contract `95246392981`: **completed success** — full UI/rules/TypeScript/build, Phase11, Phase12 and Phase13 arbitrary SessionProjection including the new remote Fire Bolt regression all green.
- Windows subjobs are not treated as human/final release acceptance evidence for this slice.

The focused regression proves:
- a host-unknown non-fixture Sorcerer's persisted Fire Bolt selection is present in the SessionProjection under the expected rules profile;
- the normal connected ActionRequest resolves through Host authoritative spell runtime and damages a Host Scene target;
- Host restores its own local Character context and permanent Character library is unchanged;
- Host emits one ordered committed event batch with canonical Fire Bolt provenance;
- Client converges target HP exactly once; duplicate event/request traffic does not apply damage twice;
- session-only target damage does not invent an owning Character-library durable generation.

This directly supports P14.8 remote spell authority. Remote skill remains the next connected-action gap.

## Architecture constraints preserved
- SessionProjection mechanics are reconstructed/derived from Host canonical content and runtime, not client presentation strings.
- Character Library remains the owning Client's durable source. Host projected Characters remain ephemeral.
- Existing Host ledger, ResolutionEvent broadcast, client apply-before-cursor, duplicate request/event and reconnect semantics are reused unchanged.
- No parallel connected protocol, fixture fallback, duplicate Character source, or tactical map/grid/path/LOS scope was added.

## Next Exact Action
1. Do not rerun remote Inventory, remote Fire Bolt, local P14.6 spell, or unchanged connected lifecycle gates unless their relevant source boundary changes.
2. On the next safe documentation-only checklist write, credit the P14.8 remote action/Inventory/spell statements directly proven by `connectedProjectedCharacterResolution.test.ts`, `connectedProjectedCharacterInventoryResolution.test.ts`, and `connectedProjectedCharacterSpellResolution.test.ts`; leave remote skill wording unchecked until separately proven.
3. Continue P14.8 test-first with a host-unknown persisted Character skill/check over the existing connected ActionRequest path. Prove Host canonical ability/proficiency modifier + authoritative d20/ResolutionEvent, exactly one committed event batch, Client once-only convergence/replay, no Host permanent-library mutation, and no unintended Initiative action-economy consumption for a freeform skill check.
4. Patch product only if the remote-skill regression exposes a real gap; run Phase12 and Main once for the changed boundary.
5. Then continue remaining P14.7 DM/live-session gaps, P14.10 UX/accessibility, Windows two-instance human acceptance and final exact-head artifact verification.
6. PR #109 remains draft/unmerged. No merge is authorized.
