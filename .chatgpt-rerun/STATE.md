# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — open/draft, not merged
- phase checklist: `.agents/PHASE14_CHECKLIST.md`

## Preserved evidence

Phase13 remains complete at `7c9440970753a370fec7830cfa691832552e1d05`; preserved Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`, Windows artifact id `9266043327` / SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Reusable Phase14 slices remain preserved unless their boundary changes. Ready/start is closed at product source `bd1077b9bc61b86c2c0370543a16496c72f840c2` and checklist-only credit `56ef07b85e805368b1a9a61863c68683c3409208`; do not rerun or reopen it without a relevant source change.

## Preflight for this continuation

Mandatory files were read from `main` in exact order: README -> control -> STATE -> PLAN. run_id / sequence / task / `continue` reconciled.

Initial actual state:

- main `6de08cb69f51f3a67a325567486522647d92d35b`
- work `56ef07b85e805368b1a9a61863c68683c3409208`
- PR #109 open/draft/unmerged

## Current work state

**Exact work head before coordination writes:** `84d1d39135c08a2094783fb336a606f294b1cf58`.

Participant lifecycle changes:

- Tauri backend now emits exact disconnect peer identity through `session-transport-peer-lifecycle` instead of forcing frontend peer-count inference.
- frontend transport exposes typed `onPeerLifecycle`.
- Host maps the exact peer to one participant, commits `state:"disconnected", ready:false` through `HostSessionLedger`, broadcasts the existing participant event-batch, and preserves reconnectable peer manifest / SessionProjection state.
- live sessions reject genuinely new participant hello before projection or ledger mutation.
- previously accepted participants may reconnect only with the accepted Character identity; existing SessionProjection source-fingerprint/rebind logic preserves Host runtime and moves the binding to the new transport peer.
- reconnect hello returns ordered Host `eventsAfter(knownEventCursor)` catch-up and emits a connected participant event with Ready reset.
- focused regressions cover exact disconnect, live late-join rejection, Host-side reconnect/rebind/catch-up, and Freeform/Ready safety preservation.

Implementation commits in this continuation:

- `b92435ea55fb9e18935cda63f684b1f3e89f587e` — frontend exact peer lifecycle contract
- `1e0d6d3e9c32c7b145ce6c6963e85b40434f67be` — Rust exact disconnect peer event + unit test
- `c6dceb9c5c99a223412e181edd6a4f5480d0df5e` — exact Host participant disconnect authority
- `748e9ec5e709d8e970e4901562260ff535db581b` — live late-join/reconnect hello policy
- `d1e0c0ebc1692efe61fc446596d4979229618f12` — lifecycle test transport compatibility
- `13a8ce8b97243a94e719be636fdd093788a0cd3a` — exact disconnect safety regression
- `886b04897bec699d9c9cdb6b1e972134b506005e` — live participant lifecycle regressions
- `c736dc8bcaaab068e68f374ab42a2179aa3c13f6` — canonical Phase12 lifecycle gate; initial Linux Rust gate attempt
- `84d1d39135c08a2094783fb336a606f294b1cf58` — keep Rust validation on supported Windows job; remove invalid bare-Linux Tauri compile assumption

## Validation

At `84d1d39135c08a2094783fb336a606f294b1cf58`:

- Phase12 `31972318100` connected-protocol: **success**. New participant lifecycle tests, Phase11 preservation, and production frontend build all passed.
- Phase12 Windows job `95226630569`: `Verify Tauri session transport and persistence library` **success**, including the new exact-peer Rust test. Subsequent executable/artifact build was still running and is not human/release acceptance evidence.
- UI `31972318109`: **success**, including Host lifecycle, mechanics, TypeScript and production build.
- Main Playable `31972318188`: playable-contract **success** — full UI/rules/build, Phase11, Phase12 and Phase13. Its Windows `Verify Tauri persistence and connected-session transport` step also succeeded; later artifact build was still running.

The earlier Phase12 `31972118864` failure was not product failure. A newly inserted Linux `cargo test` caused Tauri GTK/GIO crates to require missing `gio-2.0`, `glib-2.0`, and `gobject-2.0` native packages. The invalid CI assumption was removed; Windows remains the existing supported Tauri test path.

## Checklist discipline

No participant-lifecycle checklist boxes were marked in this continuation yet. Direct evidence is sufficient for exact Host disconnect and live-new-participant rejection, and Host-side reconnect/rebind/catch-up is green. The broader reconnect box still needs one focused client production path proving transport disconnect -> reconnect attempt -> hello with the current replica cursor -> hello-ack catch-up applied exactly once. Duplicate/replayed hello lifecycle behavior also remains uncredited.

## Architecture boundaries preserved

- Host ledger/shared-session authority preserved.
- SessionProjection Host runtime remains authoritative across reconnect.
- peer identity comes from Tauri transport, never inferred from aggregate peer counts.
- event cursor/catch-up path remains the existing ledger/replica path.
- owning-client durable Character ownership is unchanged.
- no tactical map/grid/path/LOS scope and no fixture fallback added.

## Next Exact Action

1. Add a focused client reconnect production test around the existing reconnect timer/path: initialize client replica/cursor, emit transport disconnect, run reconnect, verify hello carries the existing cursor, deliver Host hello-ack catch-up, and prove events/durable mutation are applied once without projection/participant duplication.
2. Add/confirm duplicate/replayed hello behavior for an accepted participant so replay cannot create extra participant/projection or corrupt ledger state.
3. When those are exact-head green, update only the P14.8 participant lifecycle checklist boxes actually supported by evidence.
4. Then continue explicit Host live-session end notification/cleanup + former-client ended state + fresh Host restart.
5. After connected end/restart, repair stale prior local-owned projection on non-fixture Character switching without deleting remote ephemeral SessionProjection actors.
6. Windows two-instance human acceptance/final artifact verification remain later release gates.
7. PR #109 remains draft/unmerged; no merge authorized.

## Dispatch recommendation

`continue`
