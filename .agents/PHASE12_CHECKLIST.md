# Phase 12 — Connected Session / Remote Host-Client

Tracking issue: #103
Branch: `agent/103-connected-session-runtime`
Base checkpoint: `7176715d0ccab1bb6b3fa05faba96ace09a4af69` (Phase 11 CLOSED)

Phase 12 closes only when two separate app instances can complete a verified host/client play flow and reconnect without violating host authority or Character ownership.

## A. Transport-independent protocol / authority

- [ ] explicit protocol version + rules profile/capability compatibility handshake
- [ ] typed ActionRequest envelope carries session ID, request ID, actor/action/targets, Character revisions, and known host event cursor
- [ ] host is the only allocator of authoritative ordered shared event sequence numbers
- [ ] duplicate request ID is idempotent and cannot create a second committed event
- [ ] client event application is idempotent by event ID
- [ ] sequence gaps/conflicting history are rejected instead of guessed through
- [ ] reconnect catch-up returns deterministic missing events after a known cursor

## B. Product runtime integration

- [ ] production Host/Join no longer flips mock flags directly
- [ ] host creates authoritative connected SessionRuntime and participant registry
- [ ] player joins with Character SessionProjection/revision/capability metadata
- [ ] client ActionRequest reaches host resolution path
- [ ] host ResolutionEvent/state change reaches every connected client
- [ ] Character-owned durable state is written back locally only after confirmed host event
- [ ] session-only state never enters Character persistence
- [ ] disconnect keeps local Character usable and never treats PendingResolution as committed

## C. Real Tauri transport

- [ ] host binds a real LAN/Hamachi-reachable address/port
- [ ] client connects to an entered host address
- [ ] framed protocol messages survive partial/read boundaries and malformed packets fail explicitly
- [ ] connection lifecycle reports connected/reconnecting/disconnected from real transport state
- [ ] host shutdown/client disconnect cleanup is deterministic
- [ ] no network dependency is required for offline Phase 11 play

## D. Reconnect / synchronization

- [ ] reconnect exchanges event cursor and Character revisions/capabilities
- [ ] missing events are replayed exactly once
- [ ] incompatible source/module/profile changes surface explicit compatibility failure
- [ ] duplicate/reordered host events cannot double-apply HP/resources/items/economy
- [ ] local persistence failure after host confirmation surfaces recoverable unsaved-local state without corrupting shared history

## E. Deterministic product gate

- [ ] dedicated two-peer host/client protocol tests green
- [ ] production-composed connected-session integration gate green
- [ ] Phase 11 offline walkthrough remains green
- [ ] UI / Rules Domain / Persistence / Contract gates remain green
- [ ] Windows Tauri build green
- [ ] Windows two-instance owner walkthrough instructions/artifact produced
- [ ] Draft PR checkpoint

## Boundaries

- The player owns permanent Character source/local library.
- The DM host owns authoritative ordered shared-session state while connected.
- SessionProjection is not a second permanent Character file.
- PendingResolution is ephemeral and never synchronized as committed state.
- Applying an already-applied host event ID is a no-op.
- Transport does not redefine rules/domain authority.
- Core remains map/grid/token/path/LOS free.
