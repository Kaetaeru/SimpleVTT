# Phase 13 — Arbitrary Character SessionProjection

Tracking issue: #104
Branch: `agent/104-arbitrary-character-session-projection`
Base checkpoint: `a2b1b9cbab0f5aad9eb264d76f4098a58ca1b7c5` (Phase 12 final handoff)

## Goal

Allow a connected player to join with an arbitrary locally authored Character that the DM host did not already have, without copying a second permanent Character file to the host and without trusting client-presented mechanics.

The player continues to own the permanent Character source/runtime. The host reconstructs an ephemeral SessionProjection from declarative source/runtime state plus exact content identities that the host can resolve through its own trusted rules/content catalog.

## A. Projection contract

- [ ] define versioned `CharacterSessionProjectionV1`
- [ ] projection carries Character source/runtime revisions and D&D rules profile identity
- [ ] projection reuses canonical Character source/runtime snapshots, not `materializedCache.sheet`
- [ ] projection carries qualified content identities only; no executable module/content payload
- [ ] strict wire validation rejects malformed/unknown projection envelope and identity fields
- [ ] host validates exact content ID/source/version/category identity against its own resolved catalog
- [ ] missing/incompatible canonical mechanics are explicit rejection, never presentation fallback

## B. Host reconstruction

- [ ] reconstruct a host-side ephemeral CharacterSheet/SceneEntity from source/runtime plus trusted canonical data
- [ ] derive proficiency/saves/skills/class/spell/item/action facts from host rules/content, not client attack/AC/check presentation values
- [ ] mount projected Character in Scene/actions/economy/resources only for the connected session
- [ ] bind projection ownership to the authenticated transport peer/Character ID
- [ ] unmount/disconnect does not mutate or delete the player's permanent Character
- [ ] no host Character-library record is created for SessionProjection

## C. Connected lifecycle

- [ ] client hello carries projection alongside manifest/cursor
- [ ] host handshake validates protocol/profile/revisions/capabilities before projection mount
- [ ] host-unknown Character can submit ActionRequest through the existing authoritative staged resolution path
- [ ] canonical committed ResolutionEvent[] remain the only shared mutation stream
- [ ] Character-durable host-confirmed changes still write back only to the owning client
- [ ] reconnect revalidates projection revision/content identities and resumes from event cursor
- [ ] projection drift or content drift rejects/re-handshakes explicitly

## D. Deterministic gates

- [ ] projection builder omits `materializedCache` and executable content
- [ ] same canonical host catalog accepts a projected Character
- [ ] missing or version-mismatched host content rejects explicitly
- [ ] untrusted presentation-field drift cannot change reconstructed host mechanics
- [ ] two-peer host-unknown Character mounts and resolves at least one canonical event-native action
- [ ] duplicate/reconnect flow remains idempotent for projected Character
- [ ] Phase 12 connected authority regressions remain green
- [ ] Phase 11 offline walkthrough remains 84/84
- [ ] full production frontend build remains green
- [ ] Windows Tauri transport/persistence tests remain green
- [ ] Windows connected-session release artifact builds from exact Phase 13 handoff head

## Boundaries

- SessionProjection is ephemeral/session-owned on the host.
- Player owns the permanent Character source/local library.
- DM host remains authoritative for shared-session state and rules outcomes.
- No executable module/content payload is accepted over the network.
- No copied `materializedCache.sheet` authority.
- No client `ActionVm`/AC/attack/check presentation value becomes authoritative merely because it was transmitted.
- Unsupported or missing canonical content is a blocker, not guessed mechanics.
- PendingResolution is never committed network state.
- Core remains map/grid/token/path/LOS free.
