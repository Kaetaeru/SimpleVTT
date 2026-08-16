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
- main `8652d5afb89632329e0a6ea73d039d82b26c62f5`
- work `868b8e37127ea644444630cb45a84f36664912ed`
- PR #109 open/draft/unmerged, mergeable observed true

Previously verified fresh Character/Skills/Actions/Inventory/Spells and connected lifecycle/session-end gates were not manually repeated.

## Documentation-only checklist credit
- Fetched the complete `.agents/PHASE14_CHECKLIST.md` blob and safely replaced the whole file at `119bf5dd029ab7cd4268c908afa1cf28075d16de`.
- No product source changed and no product gate was rerun merely for checkboxes.
- Credited only wording directly supported by prior exact-head evidence: fresh Character actor/action materialization; core authoritative skill behavior; real Character canonical attack/Freeform economy; atomic persisted consumable use; real-caster Fire Bolt/Magic Missile authority; local/restart integration and directly proven automated integration items.
- Visible UI/accessibility, broad equipment/attunement, concentration, connected spell and other unproven wording remain unchecked.

## Completed this continuation — P14.8 host-unknown remote Inventory authority
Final validated work head: `00487d6f421a43b15fb5ef77419e87d8182c35d4`.
Product behavior boundary: `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3`.

### Test-first failure and product repair
- `30bb1f51b495b6b21f5b9f334c5f3090b7e30495` added `connectedProjectedCharacterInventoryResolution.test.ts` using a host-unknown non-fixture Fighter and exact persisted Potion of Healing ItemInstance id `item.phase14.remote-inventory-fighter.healing-potion`.
- `39eadde71371fb5508ded21bebfca2c39424661b` wired it into Phase12.
- Phase12 `31979020855`, connected-protocol `95242770542`: existing 42 connected tests passed and only the new regression failed. Exact product failure: canonical `dnd.srd521.item.gear.potion-of-healing` reconstructed as `equipment`, because reconstruction relied on presentation category rather than the Host canonical `consumable-definition` mechanic.
- `bd4c104eeb9e953ffdc94468f2ae8f502fc724e3` repaired `characterSessionProjectionReconstruction.ts` only:
  - canonical `consumable-definition` drives reconstructed ItemInstance kind;
  - supported Potion of Healing action is derived from Host canonical mechanics (`2d4+2`, bonus-action economy) and the actual projected ItemInstance id;
  - client `grantedActionIds`/presentation strings are not mechanics authority;
  - Host ledger, connected event apply, persistence and replay code remain unchanged.
- `dfdbceeddef85fc4b0b9b42f1fd1d0b386dee839` added the regression to Main Playable's SessionProjection batch.
- Phase12 `31979172287`, connected-protocol `95243134055` then failed only because the test attempted to read `.actions` from the registry entry, whose contract intentionally contains projection + sheet only. The canonical kind assertion had passed; this was test-only.
- `00487d6f421a43b15fb5ef77419e87d8182c35d4` corrected the assertion to inspect the mounted `SceneVm.actionsByActor`; no product behavior was changed.

## Exact validation at `00487d6f421a43b15fb5ef77419e87d8182c35d4`
- Phase12 `31979232001`, connected-protocol `95243277113`: **completed success** — new projected Inventory regression, all existing connected authority regressions, Phase11 offline preservation and production frontend build green.
- Main Playable `31979231986`, playable-contract `95243277140`: **completed success** — full UI/rules/TypeScript/build + Phase11 + Phase12 + Phase13 arbitrary SessionProjection including the new remote Inventory regression green.
- Windows subjobs were not used as human/final release acceptance evidence.

The focused remote Inventory regression proves:
- Host reconstructs a host-unknown persisted Character's canonical Potion of Healing as a consumable/executable action with exact ItemInstance id.
- Remote ActionRequest stages on Host without spending quantity during preview, then Host atomically commits healing and ItemInstance quantity `2 -> 1`.
- Host restores local Character context and its permanent Character library is unchanged; projected runtime receives the commit.
- Host emits exactly one ordered committed event batch after authoritative commit.
- Owning Client applies Host-confirmed HP/item changes, persists before cursor advancement, and a fresh adapter rehydrates the committed values.
- Duplicate Host event does not double-apply/create another Character generation; duplicate request returns the original event without a second broadcast.

This directly supports the P14.8 remote action/Inventory/event-batch/owning-client/idempotency/host-library-isolation statements. Remote supported spell and remote skill remain open.

## Architecture preserved
- SessionProjection reconstruction derives mechanics from Host canonical content, not client-supplied action presentation.
- Host projected Character state remains ephemeral; Host permanent Character library remains unchanged.
- Owning Client Character Library remains the durable source and commits before accepted cursor advancement.
- Existing connected ActionRequest -> Host ResolutionEvent -> event batch -> Client apply architecture and replay semantics were reused unchanged.
- No duplicate connected message path, fixture fallback, second Character source, or tactical map/grid/path/LOS scope was added.

## Current actual state before coordination writes
- main `8652d5afb89632329e0a6ea73d039d82b26c62f5`
- work `00487d6f421a43b15fb5ef77419e87d8182c35d4`
- PR #109 open/draft/unmerged, head `00487d6f421a43b15fb5ef77419e87d8182c35d4`, mergeable observed true
- no merge performed or authorized

## Remaining work / Next Exact Action
1. Do not rerun the remote Inventory, local P14.6 spell, or unchanged connected lifecycle gates unless their source boundary changes.
2. On the next safe documentation-only checklist update, credit the P14.8 remote-action statements directly proven by `connectedProjectedCharacterResolution.test.ts` plus the new remote Inventory regression; leave remote spell/skill unchecked until separately proven.
3. Continue P14.8 test-first with a host-unknown persisted spellcaster projection. Prefer Fire Bolt or Magic Missile and the existing connected ActionRequest path. Prove Host canonical reconstruction/runtime authority, one committed event batch, Client convergence/once-only apply, and no Host permanent-library mutation.
4. Patch product only if the regression exposes a real gap; run Phase12 and Main once for the changed boundary.
5. Later continue remaining P14.7 DM/live-session gaps, P14.10 UX/accessibility, Windows two-instance human acceptance and final exact-head artifact verification.

## Dispatch recommendation
`continue`
