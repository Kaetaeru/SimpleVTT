# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve the current V1 Session UI, Player-owned remote Character durability, Campaign authority, V1-12 connected Long Rest source boundary, and all source-connected V1-13 inventory/Stash recovery work. Do not route to `main`, redo source-connected work solely for validation, or begin the comprehensive Codex audit before implementation freeze.

## V1-12

Connected Long Rest remains source implementation complete for the normal durable-storage path / validation pending. No new executable evidence has appeared; do not rebuild it.

## V1-13 source boundary through `cbf20abf4870807348443728c6fd6022113ef14c`

Existing Party Stash / Campaign DM Library foundations plus prior owner/Host restart work remain preserved:

- owner-Client durable Character inventory apply/undo and fresh SessionProjection acknowledgement;
- request-id scoped delta compensation;
- durable owner inventory journal and restart replay;
- durable Host Party Stash coordinator + reconnect reconciliation using Campaign `recentRequestIds`;
- Player self-service Stash Host-crash recovery;
- exact request-id Host compensation;
- inventory-only forward Character sourceRevision refresh;
- unknown Campaign custom items represented as embedded inert SessionProjection items, never trusted executable mechanics.

This dispatch additionally source-connected:

### DM Library materialization semantics

- A successful Character/Stash ItemInstance materialization is the asset transaction.
- `dmLibrary.recentEntryIds` is navigation/recents metadata, not asset ownership state.
- `campaignDmLibraryMaterializationAdapter.ts` treats a later recents persistence failure as non-fatal only when the exact requested definition quantity is proven to have materialized.
- Connected Host remote Character grants similarly do not surface a retryable failure when the requested quantity is already present and only owner-journal finalization acknowledgement/cleanup failed.
- This removes the need to roll back a durable Character grant solely because DM Library recents could not be updated.

### Party Stash policy authority

- Host authority now enforces `shared | dm-approval | dm-managed` for Player-originated Stash commands.
- `dm-managed`: Player writes reject; inspection remains possible.
- `dm-approval`: Player deposit is allowed, but direct withdrawal is rejected until a DM approval workflow exists.
- `shared`: roster-authorized Player direct transfer remains allowed.
- Client performs the same preflight so obvious policy denial is visible before network mutation.
- Player Stash UI shows the active policy state and disables direct controls consistently.

### Recovery checkpoint hardening

- malformed Player Stash amounts/quantities/required item fields are rejected before durable Host coordinator creation;
- Campaign identity, accepted owner identity, roster permission and Stash policy are checked before the self-service recovery coordinator is written;
- policy-denied requests therefore cannot strand useless recovery records.

### DM Library privacy/delete/provenance

Existing source already keeps private DM Library entries out of connected Campaign projections and has Campaign namespace isolation tests. This dispatch adds a lifecycle contract proving that deleting the source DM Library definition does not delete an already granted Character ItemInstance and that its provenance snapshot remains intact.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `cbf20abf4870807348443728c6fd6022113ef14c` is current and has:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the newly authored V1-13 tests, `npm run test:campaign-rest`, `tsc --noEmit`, `npm run build`, Rust/Tauri, or Windows two-instance Stash/DM Library scenarios. Source-authored tests are not execution evidence.

## Remaining V1-13 work

Do not mark V1-13 release-complete yet.

1. **Campaign Stash policy selection is not user-reachable.** The model stores three policies and the runtime now enforces them, but current Campaign UI only displays `partyStash.policy`; newly created Campaigns remain on default `dm-approval` with no selector.
2. **`dm-approval` lacks the actual pending approval queue/state machine.** Direct withdrawal is now safely rejected/disabled, but Player cannot create a pending withdrawal request for DM approve/reject/cancel yet.
3. The approval flow must preserve current ownership rules: Campaign owns Stash, Player owns remote Character, Host sequences approval, and accepted transfer must reuse the existing durable owner/Host recovery path rather than creating a second transfer implementation.
4. Approval request/reservation state must be Session-transient or explicitly declared; V1 default should cancel pending offers/requests at Session end and not leak them into Campaign persistence unless the contract intentionally requires it.
5. After policy selector + approval queue are source-connected, re-audit remaining V1-13 checklist details and then advance to later V1 slices.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. If executable evidence is still absent, preserve all source-connected V1-12/V1-13 durability and policy work.
3. Add a user-reachable Campaign Party Stash policy selector that updates the authoritative Campaign Stash policy and Session default coherently.
4. Implement the smallest `dm-approval` Player withdrawal request -> DM approve/reject/cancel flow on top of the existing `transferPartyStash` durable transaction path; do not let pending requests mutate assets before approval.
5. Add deterministic policy transition, approval/rejection/cancel, reconnect/idempotency, and Session-end pending cleanup tests.
6. Then re-audit V1-13 release checklist and continue the next unblocked V1 implementation slice.
7. Keep comprehensive Codex audit deferred until implementation freeze; final release evidence still requires exact-head regression and Windows two-instance acceptance.
