# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product/test checkpoint: `e299cf876b97a6d056a10bf702ddd67888c16570`

## Current result

V1-12 Connected Long Rest remains source-complete / validation pending and was not repeated.

V1-13 connected Party Stash now has both owner-side and Host-side restart durability at the source level:

- durable owner inventory journal and request-scoped compensation;
- Host durable Party Stash coordinator before remote cross-store mutation;
- Campaign `recentRequestIds` reconciliation after Host restart/reconnect;
- Player self-service Stash checkpoint before Host Campaign commit plus owner-complete acknowledgement;
- duplicate/lost recovery messages converge through durable owner journal + retained Host coordinator;
- canonical item membership can advance sourceRevision only with non-inventory source unchanged;
- Campaign custom items can project as inert embedded items without gaining untrusted executable mechanics.

Host still does not own or persist a remote Player Character in its Character library.

## Remaining V1-13 work

V1-13 is still implementation-in-progress. Next audit is Host-process crash ordering for Campaign DM Library -> remote Character grant, followed by DM Library privacy/isolation/delete/provenance and Session-visible policy/quick-action acceptance.

## Validation

**NO GREEN CLAIM.** Exact product/test head `e299cf876b97a6d056a10bf702ddd67888c16570` has no combined statuses and no commit-associated workflow runs. No observed execution exists for the new focused tests, TypeScript/build, Rust/Tauri, or Windows two-instance Stash/DM Library recovery.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
