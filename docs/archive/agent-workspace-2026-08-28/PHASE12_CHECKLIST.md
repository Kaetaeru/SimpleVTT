# Phase 12 — Connected Session / Remote Host-Client — CLOSED

Tracking issue: #103
Draft PR: #105
Branch: `agent/103-connected-session-runtime`
Base checkpoint: `7176715d0ccab1bb6b3fa05faba96ace09a4af69` (Phase 11 CLOSED)
Verified implementation checkpoint: `d21c6f91889719031cdc849d844b6eda52204da4`
Verified exact-head CI checkpoint: `8fd4dda13858122465c9d8099f4c1d91e583649f`

Phase 12 automated code completion closes when the connected authority/offline regression/build gates pass and the Windows connected-session workflow builds the explicitly checked-out source head rather than a synthetic PR merge SHA. Human two-instance Windows acceptance remains a separate owner gate (#106).

## A. Transport-independent protocol / authority

- [x] explicit protocol version + rules profile/capability compatibility handshake
- [x] typed ActionRequest envelope carries session ID, request ID, actor/action/targets, Character revisions, and known host event cursor
- [x] host is the only allocator of authoritative ordered shared event sequence numbers
- [x] remote requests reserve their cursor without committing history until the host produces canonical committed events
- [x] duplicate request ID is idempotent and cannot create a second committed event
- [x] client event application is idempotent by event ID
- [x] sequence gaps/conflicting history are rejected instead of guessed through
- [x] reconnect catch-up returns deterministic missing events after a known cursor

## B. Product runtime integration

- [x] production Host/Join no longer flips mock flags directly; non-Tauri paths explicitly refuse fake remote connection
- [x] host creates authoritative connected SessionRuntime ledger and participant handshake registry
- [x] host-resolvable player Character identity + source/runtime revisions + capability metadata are validated at join/action boundaries
- [x] client ActionRequest reaches the existing host production resolution path
- [x] only canonical committed ResolutionEvent[] are broadcast; PendingResolution is never synchronized as committed state
- [x] host ResolutionEvent/state change reaches connected clients through ordered event batches
- [x] Character-owned durable host-confirmed events are written back on the owning client before its applied-event cursor advances
- [x] session-only state never enters Character persistence
- [x] host Initiative/round/current actor/economy projection is synchronized as ordered state
- [x] DM HP/status/resource corrections are synchronized as structured drift-checked ordered events
- [x] disconnect keeps the local Character usable; reconnect resumes from the last applied host cursor
- [x] staged Shortbow exposes its existing atomic domain ResolutionEvents to the connected commit registry
- [x] successful Host switches the product to DM role and Join to Player role

Scope note: importing an arbitrary locally authored Character that is unknown to the host into an ephemeral full SessionProjection is intentionally not guessed from client presentation data. That extension is tracked in #104. Unsupported/unknown host mechanics are rejected explicitly.

## C. Real Tauri transport

- [x] host binds real TCP `0.0.0.0:3210`, suitable for LAN/Hamachi address reachability subject to OS/network firewall configuration
- [x] client connects to an entered host address
- [x] newline-framed protocol uses bounded frames and malformed/oversized packet rejection
- [x] host supports broadcast plus targeted peer replies
- [x] connection lifecycle reports connected/reconnecting/disconnected from real transport state
- [x] host/client disconnect cleanup removes transport writers deterministically
- [x] client reconnect retries and re-handshakes from its existing event cursor
- [x] no network dependency is required for Phase 11 offline play

## D. Reconnect / synchronization

- [x] reconnect exchanges event cursor plus current Character revisions/capabilities
- [x] missing events are replayed exactly once
- [x] protocol/rules-profile/capability/source-revision mismatch surfaces explicit compatibility/revalidation failure
- [x] duplicate/reordered host events cannot double-apply HP/resources/items/economy
- [x] local Character persistence failure after host confirmation leaves host history committed but does not advance the client event cursor; the same event can be retried safely
- [x] authoritative forward event replay validates every `before` value atomically before applying `after`

Arbitrary module/content identity reconstruction for a host-unknown Character remains #104 rather than accepting executable or unvalidated client mechanics.

## E. Deterministic product gate

- [x] connected protocol/handshake/cursor/idempotency tests green
- [x] remote ActionRequest reservation/commit tests green
- [x] two-peer host ResolutionEvent -> client convergence and duplicate-suppression gate green
- [x] turn-state reconnect/catch-up projection gate green
- [x] structured DM correction atomic apply gate green
- [x] staged Shortbow canonical event-capture gate green
- [x] client durable-write failure/retry cursor gate green
- [x] Phase 11 production-composed offline walkthrough remains green: 84/84
- [x] full production frontend build remains green, including Rules Domain build gate
- [x] UI workflow green
- [x] Persistence application/build + Windows atomic-storage workflow green
- [x] Contract validation workflow green
- [x] Windows Tauri session-transport + persistence Rust library tests green
- [x] Windows connected-session Tauri release executable builds
- [x] CI uploads a Windows connected-session artifact with `SimpleVTT.exe`, `BUILD.txt`, and `REMOTE-WALKTHROUGH.txt`
- [x] PR workflow explicitly checks out `github.event.pull_request.head.sha || github.sha` and writes that same SHA into `BUILD.txt` / artifact name
- [x] Draft PR #105 checkpoint

Implementation-head verification (`d21c6f91889719031cdc849d844b6eda52204da4`):
- Phase 12 Connected Session push workflow `31944394245`: connected authority suite + Phase 11 walkthrough 84/84 + full production frontend build + Windows Rust transport/persistence + Windows release executable + artifact upload ✅
- Windows artifact `9262986418`: `SimpleVTT-Phase12-Windows-d21c6f91889719031cdc849d844b6eda52204da4`, 2,955,392 bytes, SHA-256 `dae5287f853a3b30ed623110fec649842e88ba3f51e5d42b372e466eeabc4835` ✅
- Persistence push workflow `31944394240`: application-contract + production build + Windows atomic storage ✅
- UI push workflow `31944394283` ✅
- Contract validation PR workflow `31944600146` ✅

Exact-head CI verification (`8fd4dda13858122465c9d8099f4c1d91e583649f`):
- Phase 12 Connected Session PR workflow `31945403323`: explicit PR-head checkout + connected authority suite + Phase 11 walkthrough 84/84 + full production frontend build + Windows Rust transport/persistence + Windows release executable + artifact upload ✅
- Windows artifact `9263246789`: `SimpleVTT-Phase12-Windows-8fd4dda13858122465c9d8099f4c1d91e583649f`, 2,955,371 bytes, SHA-256 `cbfc6a51010f28d7426ae5325a18fb06348c549862ff72fc68284b8eb3e6b3b2` ✅

## F. Product handoff / human acceptance

- [x] implementation/exact-head CI artifacts are retrievable
- [x] artifact contains a two-instance LAN/Hamachi walkthrough
- [x] artifact identity is tied to the explicitly checked-out source SHA, not a synthetic PR merge SHA
- [x] arbitrary host-unknown Character projection follow-up is tracked explicitly in #104
- [x] owner two-instance Windows acceptance is tracked separately in #106 and is not misrepresented as an automated CI result

The documentation-close commit that contains this record is the final handoff candidate. Its CI artifact verification is recorded on issue #103 and Draft PR #105 after the workflow finishes, without creating another source commit.

## Boundaries

- The player owns the permanent Character source/local library.
- The DM host owns authoritative ordered shared-session state while connected.
- A connected projection is session-only and is never a second permanent Character file.
- PendingResolution is ephemeral and never synchronized as committed state.
- Applying an already-applied host event ID is a no-op.
- Transport does not redefine rules/domain authority.
- The host never guesses mechanics for an unknown client Character/action; unsupported projections fail explicitly (#104).
- Core remains map/grid/token/path/LOS free.
- Owner two-instance real-Windows verification remains #106, separate from automated Phase 12 code completion.
