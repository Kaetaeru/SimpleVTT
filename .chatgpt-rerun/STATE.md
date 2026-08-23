# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-23T10:28:00+09:00`

## Preflight reconciliation

This dispatch read `.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md` in the mandatory order. All records reconciled to run `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`, sequence `1`, task `phase14-production-play-session-ux`, status `continue`.

`CANONICAL_ROOT.md` and `.agents/V1_CURRENT_HANDOFF.md` reconfirmed `work/v1-composite`. Starting coordination head was `5e93ca3b8d790b5922f36b98cef753fea63d56aa`. Prior product/test head `e299cf876b97a6d056a10bf702ddd67888c16570` still had no combined statuses or workflow runs, so V1-12 and previously source-connected V1-13 owner/Host recovery were preserved rather than repeated.

Relevant Campaign DM Library and Party Stash contracts were rechecked in `docs/design/campaign-systems.md`: DM Library recents are private organizational metadata; Clients receive only explicitly materialized Actor/Item/Handout output; Stash policies are `shared`, `dm-approval`, and `dm-managed`.

## Preserved foundation

Keep intact:

- V1-12 Connected Long Rest source-complete normal durable-storage path / validation pending;
- Player-owned remote Character durable storage and Host projection refresh without a Host Character-library copy;
- request-scoped inventory compensation;
- durable owner inventory journal and owner restart recovery;
- exact Host Stash compensation request identity;
- durable Host Party Stash coordinator and reconnect recovery;
- Player self-service Stash Host-crash recovery;
- canonical item inventory-only sourceRevision refresh;
- inert embedded Campaign custom-item projection;
- comprehensive Codex audit deferred until implementation freeze.

## Completed in this dispatch

### 1. DM Library asset transaction separated from recents metadata

Audit of `grantCampaignDmLibraryItem` found the base runtime performs the actual Character/Stash materialization and then writes `dmLibrary.recentEntryIds`. The prior connected owner wrapper deferred finalization and could compensate an already durable Character grant merely because the later recents write failed.

Design review confirmed recents are DM Library organizational metadata, not ownership state. The asset transaction is the explicitly materialized ItemInstance.

Source changes:

- `971ea30976dcaff209e02940c6eb58f5ab22f987` — `campaignDmLibraryMaterializationAdapter.ts`; if the base grant throws after materialization, it returns success only when the exact requested definition quantity is proven to have increased by the requested amount.
- `a2ee363d1d2adc1eb46d4c977c13d311f2b37f0f` — `connectedDmLibraryGrantCommitAdapter.ts`; connected Host remote grants likewise avoid exposing a retryable error when the requested durable remote quantity is already reflected and only finalize acknowledgement/cleanup failed.
- `dc260583dbbf25dae43c46af9c445c66c8bc42c5` — initial production adapter ordering; later superseded by the final `main.tsx` policy wiring commit below.
- `cacd2e2dc965d52a6acd6b6b3363f17b83392af8` — functional source-authored recents-failure contract.
- `14d7eefceabc2822dd19c2b12959a9ad5c8167ec` — connected committed-grant/import-order structure contract.
- `7bd775a191797e5ceeb791c1e0398105912f6e13` — grant durability contracts imported into the focused restart suite.

Current semantics:

- actual grant failure still throws;
- successful ItemInstance materialization remains successful even if recents metadata persistence fails;
- a lost owner-finalize acknowledgement cannot invite a duplicate UI retry when the exact requested quantity is already present;
- a Host process death after remote Character grant may leave an unfinalized owner journal cleanup record, but the journal is not a global Character write lock and the durable asset outcome remains the granted ItemInstance. This is cleanup debt, not Character/Campaign partial asset ownership.

### 2. Party Stash policy authority restored

Source audit found Player Stash movement had been gated only by roster `stashPermission`; `partyStash.policy` was not enforced. This meant the default `dm-approval` and `dm-managed` authority boundaries could be bypassed.

Source changes:

- `814a85d8a9c78b731b1a8cd815521f570ea346c8` — Host `commitConnectedPartyStashDeposit` policy guard.
- `639218244a832244118ced2a73e914720c54bef4` — Client preflight policy guard.
- `9b266c476bfb6da506c047c206db06b08885d6b0` — production import ordering: Host policy wrapper before connected Campaign handler capture, Client policy wrapper after connected Client transfer implementation.
- `647554d5a394a69fce44918e3e8705eae53aa80c` — Player Session Stash UI reflects policy state and disables disallowed direct actions.

Current authority:

- `shared`: roster-authorized Player direct deposit/withdraw remains available;
- `dm-approval`: direct Player deposit allowed, direct withdrawal denied until DM approval workflow exists;
- `dm-managed`: Player Stash writes denied; inspection remains possible;
- roster `request`/`manage` permission remains independently required.

The UI now explicitly tells the Player whether the Stash is shared, approval-required, DM-managed, or unavailable by roster permission.

### 3. Recovery checkpoint validation hardened

Audit found the self-service recovery wrapper could write a durable Host coordinator before the downstream policy handler rejected the request.

- `e7f6ba9a030f61c90e22142e9498f6c6d9676e45` — `connectedPartyStashHostRecoveryAdapter.ts` now validates the Player request before coordinator creation:
  - non-empty request/Campaign/actor/session identity;
  - positive integer amount/quantity;
  - required item identity/template fields by transfer direction;
  - accepted owner peer/Character identity;
  - live Campaign identity;
  - roster Stash permission;
  - `dm-managed` rejection;
  - `dm-approval` direct-withdrawal rejection.

Malformed or policy-denied input therefore cannot strand a useless durable Host recovery record.

### 4. Privacy/isolation/delete/provenance audit

Existing source was preserved where already correct:

- connected Campaign systems projection contains Stash/roster/calendar/rations but not DM Library entries/index/notes;
- `campaignIsolation.test.ts` already verifies Campaign A/B DM Library namespaces remain isolated across restart;
- Session quick actions explicitly materialize image/NPC/item output rather than exposing the private library wholesale.

New lifecycle contract:

- `a7ddd9abddbcbf68bcfa22b1f864deb30a5ddc0e` — after a custom item is granted to a Character, deleting its DM Library definition leaves the granted ItemInstance intact and preserves its provenance snapshot (`Campaign DM Library · <campaign>`).

### 5. Focused policy contracts

- `2d3b704220d6fdcd47a7b3218669b473472c79f1` — default `dm-approval` source-authored functional contract: Player deposit commits, direct withdrawal rejects; import ordering, UI policy state, and pre-coordinator validation are source-checked.
- `cbf20abf4870807348443728c6fd6022113ef14c` — policy + delete/provenance contracts imported into the existing focused restart suite.

## Exact product/test head

`cbf20abf4870807348443728c6fd6022113ef14c`

The branch was verified identical to that SHA before Rerun coordination writes.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `cbf20abf4870807348443728c6fd6022113ef14c` returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for:

- new DM Library recents/materialization tests;
- new Stash policy/recovery checkpoint tests;
- delete/provenance test;
- `npm run test:campaign-rest`;
- `tsc --noEmit` / `npm run build`;
- Rust/Tauri tests/build;
- Windows two-instance Stash/DM Library acceptance.

Source-authored tests are not execution evidence.

## Current V1-13 assessment

V1-13 remains **IMPLEMENTATION IN PROGRESS / VALIDATION PENDING**.

The actual remaining policy product gaps are now explicit:

1. `partyStash.policy` has three modeled/enforced states but current Campaign UI only displays the current policy. New Campaigns default to `dm-approval`; there is no user-reachable selector to choose `shared` or `dm-managed`.
2. `dm-approval` now safely denies direct withdrawal, but no pending Player withdrawal request -> DM approve/reject/cancel queue/state machine exists yet.
3. Any approval queue must reuse the existing durable `transferPartyStash` path only after approval; pending requests must not mutate Character or Campaign assets.
4. Session-end/restart lifetime for pending approval requests needs an explicit implementation. V1 design defaults pending offers/reservations to cancellation/release at Session end.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head executable evidence; if none, preserve all completed V1-12/V1-13 durability, DM Library, policy and recovery work.
3. Add a Campaign UI/application path to select `shared | dm-approval | dm-managed` and persist it coherently as authoritative Party Stash policy / Session default.
4. Implement Player `dm-approval` withdrawal requests as pending, non-mutating Session authority records with DM approve/reject/cancel controls.
5. On approval, execute the existing durable Stash transfer transaction; do not create a second asset mutation implementation.
6. Add deterministic duplicate request/reconnect, rejection/cancel, policy-change, and Session-end pending cleanup tests.
7. Re-audit V1-13 checklist after this approval slice; only then advance later V1 implementation work.
8. Keep comprehensive Codex audit deferred until implementation freeze and Windows two-instance acceptance as release evidence.
