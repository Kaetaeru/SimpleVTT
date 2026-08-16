# Character SessionProjection Authority Contract

This document refines the `SessionProjection` lifetime defined in `docs/design/session-runtime.md` for a connected Character that does not already exist in the DM host's permanent Character library.

## Ownership

- The player remains the only owner of the permanent Character source/local library.
- The DM host owns the authoritative shared-session state while connected.
- A host `SessionProjection` is ephemeral. It is never written into the host Character library and is removed when a new host session starts.
- A transient disconnect does not immediately destroy the host projection because reconnect/catch-up must retain the host-authoritative runtime state.

## Wire payload

`CharacterSessionProjectionV1` is declarative only. It carries:

- Character ID;
- source/runtime revisions;
- RulesProfile ID/version;
- canonical Character source snapshot;
- explicitly source-owned values that are not yet reconstructable from that snapshot, currently maximum HP;
- mutable Character runtime snapshot;
- exact qualified content identities (`contentId`, `sourceId`, `version`, `category`, `qualifiedId`).

It does not carry:

- `materializedCache.sheet` authority;
- client `ActionVm` values;
- client-presented AC, attack/check bonuses, speed, proficiency bonus, or derived save totals;
- executable module/content definitions or scripts;
- host SessionRuntime, initiative, PendingResolution, or EventHistory.

## Host validation and reconstruction

The host validates every required content identity against its own trusted resolved catalog. Required identities include every multiclass track, species, background, subclass, referenced spell, item definition, and mastery weapon.

Missing, ambiguous, source/version-mismatched, or unsupported mechanics are blockers. The host must not copy presentation values as a fallback.

The host reconstructs derived mechanics from its own canonical rules/content. Source-owned mutable/durable inputs are overlaid only in their declared lifetime domain. For example:

- proficiency and class-level feature math are derived from canonical progression;
- speed comes from canonical species rules;
- AC comes from canonical equipment/unarmored rules;
- resource maximum/definition is source-owned while current is runtime-owned;
- item static identity/configuration is source-owned while mutable quantity/equipped/charges are runtime-owned;
- maximum HP is explicitly source-owned until a richer HP progression provenance snapshot exists.

## Connected action authority

A mounted projected Character gets a host SceneEntity, action projection, and economy projection for the session only.

An ActionRequest from that peer must match the Character identity established by hello. The host activates the projected Character as the resolution context only while processing that peer's staged authoritative action, then restores the host's local Character context.

Duplicate action IDs are actor-scoped by the resolution context. A projected actor must not accidentally resolve another actor's action with the same action ID.

Only canonical committed `ResolutionEvent[]` enter shared history. PendingResolution remains provisional.

## Durable write-back

When the host commits a Character-durable event for a projected Character:

- the host updates its ephemeral projection in memory;
- the host does not create/update a permanent Character record for that player;
- the owning client applies the same host event and commits Character-durable changes to its own local Character library before advancing its applied-event cursor;
- duplicate host event delivery is a no-op and must not create another local Character generation.

## Reconnect

Reconnect sends the Character projection again for validation, but the host must not replace already-authoritative runtime state with a stale client runtime snapshot.

The host revalidates source revision, RulesProfile, and qualified content identity. Source/content drift during the same connected session is rejected and requires explicit revalidation/session policy. If compatible, the transport peer is rebound to the existing host projection and catch-up resumes from the client's event cursor.

## Session cleanup

- transient network disconnect: retain host projection for reconnect;
- reconnect: rebind peer, preserve host authoritative runtime;
- new Host session: remove all prior ephemeral projections from Scene/actions/economy and clear the projection registry;
- permanent host Characters remain untouched.
