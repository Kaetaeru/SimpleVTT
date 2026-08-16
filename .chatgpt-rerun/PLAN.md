# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Tracking issue: #108
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Preserved evidence

Phase 13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`, and Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable Phase14 evidence unless its source boundary changes:

- PlaySessionDock `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635`.
- Host start/stop/restart/preparation `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715`.
- saved non-reference Character Join/compatible lobby `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233`, Persistence `31967968226`.
- fresh non-fixture production play `c6d494cf26f081741da0fb3afca2230bcfde2eb1`, Phase11 `31969356422`.
- repaired pre-Ready core matrix `c991ef2a28efe01b389f22141a9be6bb24f11862` green across UI/Contract/Phase11/Phase12/Main.
- Ready/start product boundary `bd1077b9bc61b86c2c0370543a16496c72f840c2`, with Phase12 `31971618571`, UI `31971618534`, Phase11 `31971618537`, Main `31971618703` success; six P14.8 Ready/start boxes credited at checklist-only `56ef07b85e805368b1a9a61863c68683c3409208`.

Do not repeat these focused gates unless the relevant boundary changes.

## Participant lifecycle slice

Current exact work head: `84d1d39135c08a2094783fb336a606f294b1cf58`.

Implemented on the existing Host ledger / SessionProjection / cursor authority model:

1. `b92435ea55fb9e18935cda63f684b1f3e89f587e` adds typed frontend `SessionTransportPeerLifecycle { peer, state:"disconnected" }` and `onPeerLifecycle` for `session-transport-peer-lifecycle`.
2. `1e0d6d3e9c32c7b145ce6c6963e85b40434f67be` makes the Tauri backend emit the exact transport peer id when `spawn_reader` observes disconnect, plus a Rust identity unit regression.
3. `c6dceb9c5c99a223412e181edd6a4f5480d0df5e` replaces aggregate peer-count inference with exact peer -> participant handling. Host commits only that participant as `disconnected, ready:false`, broadcasts the normal participant event, and preserves peer manifest / SessionProjection runtime needed for reconnect.
4. `748e9ec5e709d8e970e4901562260ff535db581b` defines live hello policy: genuinely new participants are rejected before projection/ledger mutation once play is live; a previously accepted participant may reconnect only with the accepted Character identity, then safely rebinds to the new peer and receives ordered `eventsAfter(knownEventCursor)` catch-up. Existing SessionProjection fingerprint/rebind logic preserves Host runtime instead of replacing it from stale client state.
5. `d1e0c0ebc1692efe61fc446596d4979229618f12` updates the existing lifecycle fake transport for the new listener.
6. `13a8ce8b97243a94e719be636fdd093788a0cd3a` proves exact peer disconnect affects only the mapped participant, resets Ready, preserves reconnect mapping, emits an authoritative event and blocks Start.
7. `886b04897bec699d9c9cdb6b1e972134b506005e` adds focused live late-join rejection and accepted-participant reconnect/rebind + ordered catch-up tests.
8. `c736dc8bcaaab068e68f374ab42a2179aa3c13f6` adds the new participant lifecycle test to canonical Phase12. An attempted Linux Tauri `cargo test` failed because bare Ubuntu lacks GTK/GIO native development packages, not because of product Rust.
9. `84d1d39135c08a2094783fb336a606f294b1cf58` removes that invalid Linux-native assumption while retaining frontend lifecycle gates; Rust transport validation remains in the existing Windows `cargo test --lib` job.

### Exact-head validation at `84d1d391...`

- Phase12 `31972318100` connected-protocol: success. New participant lifecycle authority tests, Phase11 preservation and production frontend build all pass.
- Phase12 Windows job `95226630569`: `Verify Tauri session transport and persistence library` succeeded, proving the Rust exact-peer transport code compiles/tests on the supported Windows path. The executable/artifact build continued afterward and is not used as human/release acceptance here.
- UI `31972318109`: completed success including Host lifecycle, mechanics, TypeScript and production build.
- Main Playable `31972318188`: playable-contract completed success for full UI/rules/build, Phase11, Phase12 and Phase13; its Windows `Verify Tauri persistence and connected-session transport` step also succeeded while the artifact build continued.

The earlier failed Phase12 `31972118864` is classified as CI-environment configuration debt: Linux lacked `gio-2.0`, `glib-2.0`, and `gobject-2.0`; no product rollback was required.

## Checklist credit discipline

Do not over-credit participant lifecycle yet.

Evidence now directly supports exact Host disconnect state and live-new-participant rejection, and proves Host-side accepted participant rebind/catch-up. The broader checklist phrase “Reconnect resumes from the last accepted event cursor and restores the participant/projection without duplication” still needs a focused client-side production regression covering transport loss -> reconnect attempt -> hello with existing replica cursor -> hello-ack catch-up apply. Duplicate/replayed hello policy also remains separately uncredited.

## Next Exact Action

1. Add one focused client reconnect production test using fake transport state transitions: start from an initialized client replica/cursor, emit transport disconnect, exercise the reconnect path, verify the reconnect hello uses that cursor, apply Host hello-ack catch-up once, and prove no duplicate durable/session mutation.
2. Add/confirm duplicate/replayed hello behavior for an already accepted participant so a replay cannot create an extra participant/projection or corrupt the ledger. Keep any authentication expansion out of scope unless existing contracts require it.
3. Once those focused lifecycle gates pass, update only the P14.8 participant lifecycle checklist boxes actually proved by exact-head evidence; do not reopen Ready/start.
4. Then implement explicit Host live-session end notification/cleanup and former-client ended state, followed by clean Host restart.
5. After connected lifecycle end/restart is green, repair the known stale previous local projection when switching two non-fixture local Characters while preserving remote ephemeral SessionProjection actors.
6. Windows two-instance human acceptance and final release artifact verification remain later release gates.

Draft PR #109 remains open/draft. No merge is authorized or attempted.
