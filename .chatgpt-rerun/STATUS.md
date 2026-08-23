# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product/test checkpoint: `cbf20abf4870807348443728c6fd6022113ef14c`

## Current result

V1-12 Connected Long Rest remains source-complete / validation pending and was not repeated.

V1-13 this dispatch closed additional real source gaps:

- DM Library ItemInstance materialization is no longer rolled back merely because later private `recentEntryIds` metadata persistence fails;
- committed connected remote grants are not exposed as retryable failures solely because owner-finalize acknowledgement/cleanup was lost;
- private DM Library data remains out of connected Campaign projections;
- deleting a DM Library definition leaves already granted Character items and provenance intact;
- Player Party Stash writes now enforce both roster permission and Campaign policy;
- `dm-managed` is inspect-only for Players;
- `dm-approval` allows deposit but denies direct withdrawal pending a real approval flow;
- `shared` retains authorized direct transfers;
- Player UI shows/blocks actions according to policy;
- malformed or policy-denied Player requests are rejected before a durable Host recovery coordinator is written.

Host still does not own or persist a remote Player Character in its Character library.

## Remaining V1-13 work

V1-13 is still implementation-in-progress. The next concrete product gap is no longer authority bypass: it is the missing user-reachable policy configuration and real `dm-approval` queue.

- Campaign UI currently only displays `partyStash.policy`; it cannot select `shared`, `dm-approval`, or `dm-managed`.
- `dm-approval` has no Player pending withdrawal request -> DM approve/reject/cancel workflow yet.
- Approved requests must reuse the existing durable Stash transfer path and pending requests must not mutate assets before approval.

## Validation

**NO GREEN CLAIM.** Exact product/test head `cbf20abf4870807348443728c6fd6022113ef14c` has no combined statuses and no commit-associated workflow runs. No observed execution exists for the new focused tests, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library scenarios.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
