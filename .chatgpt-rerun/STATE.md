# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T10:18:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order. All records reconciled to run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md`, `.agents/V1_CURRENT_HANDOFF.md`, the release checklist, `docs/design/campaign-systems.md`, and `docs/design/ui-ux/ITEM-CURRENCY-TRANSFER-FOUNDATION.md` were rechecked. Starting coordination head was `c876a3451cfd075213e867b574a5146ef06b127f`; prior product head `45c6dae...` had no combined status and no workflow runs. Existing V1-12 and owner-journal work was preserved rather than repeated.

## Preserved foundation

Keep intact:

- V1-12 connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durable storage; Host never copies a remote Character into its Character library;
- Campaign-owned Party Stash and existing local compensation/idempotency;
- connected owner apply/undo routing with fresh Character projection acknowledgement;
- durable owner inventory journal and restart-safe compensation;
- exact request-scoped Host Stash compensation;
- comprehensive Codex audit remains deferred until implementation freeze.

## Completed in this dispatch

### 1. Durable Host Party Stash coordinator

Commits:

- `a6d4df43590adee29bfdf5ee84feba46109d457e` — deterministic Host-recovery contract authored first.
- `d10d2801fca9389edeed86559b83909ca0290ddc` — Memory/Tauri Host coordinator store.
- `2b47ba2dc467eeeb55785094894aaa1534dcc4bf` — Rust create-once Host coordinator persistence.
- `4d5d1ea272bc3a51c122ba478470588d27150939` — Tauri commands registered under the existing Character/Campaign persistence mutex.

Coordinator record identity:

- `requestId`;
- `campaignId`;
- `actorId`;
- exact `ownerParticipantId`;
- full immutable `PartyStashTransferCommand`.

Tauri record path is request-id keyed under `connected-party-stash-host`. Repeated identical writes and deletes are idempotent; a different payload under the same requestId is rejected.

### 2. Host-originated remote Stash restart/reconnect recovery

Commits:

- `5fd5b7f04225512091a1038c23fdea7305969316` — recovery runtime/wire.
- `27325d3e182f727e5b76c7a2376ca954741de7fb` — Host remote Stash writes coordinator before entering transfer runtime.
- `9bbeb52da5d49539172891eeeb1e579659433557` / `2fc679ed3ad1a2d73ca1b9f9a1e525716ab93035` — structure contracts and focused-suite wiring.

Normal Host-originated remote Stash ordering is now:

1. identify mounted remote Character and accepted owner participant;
2. durably write Host coordinator;
3. run existing owner/Campaign transfer path;
4. owner journal settles/finalizes;
5. only after the outer transfer returns successfully may Host delete the coordinator.

If Host dies before step 5, compatible reconnect triggers recovery after the base handshake has already registered `peerParticipants` and peer manifest.

Recovery uses Campaign idempotency as the durable decision:

- `recentRequestIds` contains original request and not `<request>.compensate` => desired owner outcome `applied`;
- original request absent => desired owner outcome `undone`;
- original and `<request>.compensate` both present => desired owner outcome `undone`.

Host sends the exact reconstructed owner inventory command. Owner journal apply/undo is restart-idempotent, owner finalizes the desired outcome, returns a fresh Character projection, Host refreshes mounted durable Character facts/session inventory/manifest revision, then Host deletes the coordinator. Lost recovery result leaves the coordinator for another reconnect.

### 3. Player self-service Stash Host-crash window

Commit `da50921bde128ed28ad7183fd12cf9fe1fd66427` extends the same coordinator to incoming `campaign-stash-deposit` requests.

- Host checkpoints a valid owner/participant request before delegating to the existing Campaign handler.
- `.compensate` requests do not create a second coordinator; the original coordinator remains the transaction identity.
- Client sends `campaign-party-stash-owner-complete` only after the client transfer returns and its owner journal has finalized.
- Host deletes the coordinator only when current Campaign idempotency agrees with the Client-reported `applied`/`undone` outcome.
- lost owner-complete acknowledgement leaves the coordinator for reconnect recovery.

This covers both transfer directions at the source level:

- Character -> Stash: owner mutation happens first; Host crash before Campaign commit recovers to owner undo, after commit recovers to applied.
- Stash -> Character: Campaign commit happens first; Host crash before Client apply recovers by applying the exact owner command; later compensation is recognized through `<request>.compensate`.

`e299cf876b97a6d056a10bf702ddd67888c16570` updates source-structure coverage for this self-service ordering.

### 4. Inventory-only sourceRevision refresh

Source audit found that adding or fully removing an item changes Character `source.itemReferences`, which can advance `sourceRevision`. The previous Host refresh rejected any sourceRevision change, so item transfer could fail even though GP transfer worked.

Commits:

- `5108064af99000d06125fe033d0b4696d8235b7e` — deterministic item-only source refresh contract.
- `0ba836dce893cd73c012b59e75cdfcb0d5fdfbd1` — Host projection refresh now permits a forward sourceRevision only when non-inventory source/rules/content identity remains unchanged; backward revision and non-inventory drift reject.
- `61d17e19711f9b883a2846a1fad7a7a0abcc3784` — normal connected owner result precheck changed from equality to backward-only before the stricter mount-layer comparison.
- `2e5477dc6d8f620ff957d1cd2265e087fdd7807f` — Host-recovery precheck aligned to the same rule.
- `c76b34c86c319098bd92317a7a492219c72dacdf` — focused suite includes the contract.

This permits canonical item membership changes without allowing an inventory acknowledgement to mutate class/species/background/rules authority.

### 5. Campaign custom item SessionProjection

Source audit also found that a Campaign DM Library custom item may not exist in either side's installed rule catalog. Requiring a qualified content identity for every inventory item prevented such an item from being returned in a connected Character projection.

Commits:

- `eec1237744c049adcb2f4217464fe5dbaa7bd803` — inert custom-item projection contract.
- `1fc60332a51864c7323eb63d2aaec3cb14fafb0d` — projection identities remain mandatory for executable class/spell/build content and for inventory definitions that Host actually knows, but an unknown inventory definition can travel as embedded item source metadata.
- `e71edd1430f71749cc71d155bf75482cc28635a0` — reconstruction preserves custom item display metadata/charges/provenance but discards `grantedActionIds`; custom item with no trusted Host mechanics is rejected if equipped, wielded, or attuned.
- `9e5bd437c102518969c4d85c795f96293f8af64a` — custom item contract wired into focused suite.

This is deliberately an **inert item** boundary. Embedded Client metadata does not become executable mechanics.

## Exact product/test head

`e299cf876b97a6d056a10bf702ddd67888c16570`

The branch was verified identical to that SHA before coordination writes.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `e299cf876b97a6d056a10bf702ddd67888c16570` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for:

- the new Host-recovery/self-service tests;
- item-only source refresh/custom item tests;
- `npm run test:campaign-rest`;
- `tsc --noEmit` / `npm run build`;
- Rust/Tauri build;
- Windows two-instance Party Stash/DM Library acceptance.

Source-authored tests are not execution evidence.

## Current V1-13 assessment

V1-13 remains **IMPLEMENTATION IN PROGRESS / VALIDATION PENDING**. Connected Party Stash owner/Host process restart and the canonical/custom item projection boundaries are now source-connected, but the remaining DM Library and acceptance audit has not been closed.

Important next questions:

- Host-originated Campaign DM Library -> remote Character grant currently has normal-process owner compensation/finalize behavior, but its Host-process crash ordering must be audited separately if Campaign `recentEntryIds` mutation is part of the atomic grant contract.
- DM-only definitions/images must remain private before explicit reveal/materialization.
- Campaign isolation/delete/provenance and Session-visible policy/quick-action UX still need an explicit current-source audit.
- malformed connected Stash payload checkpoint validation should be hardened/reviewed so invalid remote input cannot strand a useless coordinator record.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head executable evidence; if none, preserve V1-12 and the source-connected owner/Host Stash recovery instead of repeating it.
3. Audit `grantCampaignDmLibraryItem` + connected owner journal wrapper for Host-process crash ordering and implement the smallest durable recovery change only if the Campaign-side update is transactionally required.
4. Audit DM Library privacy/isolation/delete/provenance and Session-visible quick actions/policy denial states against V1-13 acceptance; add deterministic tests for concrete gaps.
5. Only after the real V1-13 gaps are source-connected should later V1 implementation slices advance.
6. Keep comprehensive Codex audit deferred until implementation freeze; final evidence still requires exact-head regression and Windows two-instance acceptance.
