# Phase 13 — Arbitrary Character SessionProjection

Status: **CLOSED on `main`**

Tracking issue: #104
Canonical branch: `main`
Historical implementation branch: `agent/104-arbitrary-character-session-projection`
Base checkpoint: `a2b1b9cbab0f5aad9eb264d76f4098a58ca1b7c5` (Phase 12 final handoff)
Verified implementation head: `7c9440970753a370fec7830cfa691832552e1d05`

## Goal

Allow a connected player to join with an arbitrary locally authored Character that the DM host did not already have, without copying a second permanent Character file to the host and without trusting client-presented mechanics.

The player continues to own the permanent Character source/runtime. The host reconstructs an ephemeral SessionProjection from declarative source/runtime state plus exact content identities that the host can resolve through its own trusted rules/content catalog.

## A. Projection contract

- [x] define versioned `CharacterSessionProjectionV1`
- [x] projection carries Character source/runtime revisions and D&D rules profile identity
- [x] projection reuses canonical Character source/runtime snapshots, not `materializedCache.sheet`
- [x] projection carries qualified content identities only; no executable module/content payload
- [x] strict wire validation rejects malformed/unknown projection envelope and identity fields
- [x] host validates exact content ID/source/version/category identity against its own resolved catalog
- [x] missing/incompatible canonical mechanics are explicit rejection, never presentation fallback

## B. Host reconstruction

- [x] reconstruct a host-side ephemeral CharacterSheet/SceneEntity from source/runtime plus trusted canonical data
- [x] derive proficiency/saves/skills/class/spell/item/action facts from host rules/content, not client attack/AC/check presentation values
- [x] mount projected Character in Scene/actions/economy/resources only for the connected session
- [x] bind projection ownership to the authenticated transport peer/Character ID
- [x] unmount/disconnect does not mutate or delete the player's permanent Character
- [x] no host Character-library record is created for SessionProjection

## C. Connected lifecycle

- [x] client hello carries projection alongside manifest/cursor
- [x] host handshake validates protocol/profile/revisions/capabilities before projection mount
- [x] host-unknown Character can submit ActionRequest through the existing authoritative staged resolution path
- [x] canonical committed ResolutionEvent[] remain the only shared mutation stream
- [x] Character-durable host-confirmed changes still write back only to the owning client
- [x] reconnect revalidates projection revision/content identities and resumes from event cursor
- [x] projection drift or content drift rejects/re-handshakes explicitly

## D. Deterministic gates

- [x] projection builder omits `materializedCache` and executable content
- [x] same canonical host catalog accepts a projected Character
- [x] missing or version-mismatched host content rejects explicitly
- [x] untrusted presentation-field drift cannot change reconstructed host mechanics
- [x] two-peer host-unknown Character mounts and resolves at least one canonical event-native action
- [x] duplicate/reconnect flow remains idempotent for projected Character
- [x] Phase 12 connected authority regressions remain green
- [x] Phase 11 offline walkthrough remains 84/84
- [x] full production frontend build remains green
- [x] Windows Tauri transport/persistence tests remain green
- [x] Windows connected-session release artifact builds from exact Phase 13 handoff head

## Closeout evidence

The final source-changing implementation head is `7c9440970753a370fec7830cfa691832552e1d05`.

GitHub Actions at that exact head are green:

- Contract validation — run `31955742556` ✅
- Rules Domain — run `31955742577` ✅
- Persistence — run `31955742563` ✅
- UI — run `31955742530` ✅, including UI rule boundary, creation ChoiceDefinition convergence, progression/subclass/spellcasting regressions, TypeScript, and production build
- Phase 11 Playable — run `31955742560` ✅, including production-composed offline walkthrough and Windows playable build
- Phase 12 Connected Session — run `31955742539` ✅, including connected authority protocol, Phase 11 regression, Tauri transport/persistence tests, and Windows connected build
- Phase 13 SessionProjection — run `31955742524` ✅, including projection/reconstruction/mount/hello/authoritative action flow, Phase 12 regression, Phase 11 regression, production frontend, Windows Tauri transport/persistence tests, and Windows projected-character executable

Exact-head Phase 13 artifact:

- `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`
- artifact id `9266043327`
- SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`

After `7c944097...`, the promotion/Rerun reconciliation path to `main` changed only `.chatgpt-rerun/*` coordination documents. No source, test, workflow, rules, content, or runtime file changed before this closeout. The verified implementation evidence therefore applies to the code now on `main`.

The former stacked branch was cleanly fast-forwarded into `main`; `main` is the canonical baseline for future work. Historical Draft PR #107 is not an outstanding integration dependency.

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
