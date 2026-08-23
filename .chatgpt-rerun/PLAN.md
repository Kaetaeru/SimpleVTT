# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

Preserve the current V1 Session UI, Player-owned remote Character durability, Campaign authority, V1-12 connected Long Rest source boundary, and the source-connected V1-13 inventory/Stash recovery work. Do not route to `main`, redo source-connected work solely for validation, or begin the comprehensive Codex audit before implementation freeze.

## V1-12

Connected Long Rest remains source implementation complete for the normal durable-storage path / validation pending. No exact-head executable evidence has appeared; do not rebuild it.

## V1-13 source boundary through `e299cf876b97a6d056a10bf702ddd67888c16570`

The release checklist's V1-13 `TODO` label is stale relative to canonical source. Existing local Party Stash / Campaign DM Library runtime and UI foundations remain in place.

Source-connected V1-13 now includes:

- request-id scoped, delta-safe Character inventory compensation;
- Host -> owning Client remote Character apply/undo and fresh `CharacterSessionProjectionV1` acknowledgement;
- durable owner inventory journal with immutable `applied`, `undoing`, `undone`, and `finalized` sidecars;
- owner apply/undo restart replay without relying on prior process memory;
- exact Host Stash request binding instead of global last-undo selection;
- Tauri Host Party Stash coordinator written before a Host-originated remote transfer can mutate either side;
- Host restart/reconnect reconciliation from Campaign `recentRequestIds`:
  - original request committed and no `.compensate` => owner must be/remain `applied`;
  - original request absent or `.compensate` committed => owner must be/remain `undone`;
- recovery result returns a fresh Character projection and Host deletes the coordinator only after accepted owner recovery;
- Player self-service `campaign-stash-deposit` is also checkpointed before the Campaign handler; Client sends owner-complete only after its local owner journal is finalized; ack loss leaves the coordinator for reconnect recovery;
- canonical item add/remove can advance Character sourceRevision only when all non-inventory Character source remains unchanged;
- Campaign custom items may cross SessionProjection without pretending to be installed rule content: missing Host mechanics are reconstructed as inert embedded item metadata, executable granted actions are discarded, and equipped/wielded/attuned custom items are rejected.

Focused source contracts are wired into the existing `test:campaign-rest` restart module for owner restart, Host restart, Player self-service checkpointing, exact compensation, item-only source refresh, and inert custom-item reconstruction.

## Validation status

**NO GREEN CLAIM.** Exact product/test head `e299cf876b97a6d056a10bf702ddd67888c16570` is the current branch head and returned:

- combined commit statuses: none;
- commit-associated workflow runs: none.

No observed execution exists for the newly authored V1-13 tests, `npm run test:campaign-rest`, `tsc --noEmit`, `npm run build`, Rust/Tauri build, or Windows two-instance Stash/DM Library recovery.

## Remaining V1-13 work

Do not mark V1-13 release-complete yet.

1. Audit Host-originated **Campaign DM Library -> remote Character** grant as a crash transaction. The normal process path defers owner finalize and compensates if the Campaign-side recent-entry update rejects, but Host process death between owner Character apply and Campaign-side completion still needs a deliberate durable/recovery decision if the Campaign recent-entry mutation is considered part of the transaction.
2. Finish DM Library privacy/isolation audit: DM-only definitions/images must not leak before explicit reveal/materialization; Campaign namespace/delete/provenance behavior must remain isolated.
3. Recheck user-reachable Session quick actions and policy states against V1-13 acceptance, including shared/request/DM-managed Stash behavior and denial UX.
4. Harden/review malformed connected Stash request checkpoint validation so invalid remote payloads cannot leave useless coordinator records.
5. Preserve the new item projection rule boundary: embedded custom item metadata is display-only/inert unless Host has trusted canonical mechanics.

## Next Exact Action

1. Reconcile README -> control -> STATE -> PLAN and actual `work/v1-composite` HEAD.
2. Check exact-head executable evidence; if none, do not repeat V1-12, owner journal, Host Stash recovery, or item projection work.
3. Audit `grantCampaignDmLibraryItem` and its connected wrapper specifically for Host-process crash ordering and decide/implement the smallest durable coordinator or transaction simplification required by the existing Campaign contract.
4. Then audit DM Library privacy/isolation/delete/provenance and Session-visible quick actions against V1-13 acceptance; implement only concrete source gaps with deterministic tests.
5. Keep V1-14 and later slices behind V1-13's real remaining gaps; keep comprehensive Codex audit deferred until implementation freeze.
6. Final release evidence still requires exact-head regression plus Windows two-instance acceptance.
