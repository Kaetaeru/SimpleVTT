# Authority, State Lifetimes, and Session Write-back

Status: Draft for Issue #21

## Product intent

SimpleVTT is local-first for permanent Character ownership while still supporting authoritative shared play hosted by the DM.

That requires separating three questions that are easy to accidentally mix together:

1. **Who owns this data permanently?**
2. **Who is authoritative for changing it right now?**
3. **How long should this state exist?**

A player owning a Character file does not imply that the player independently decides shared combat outcomes while connected. Likewise, a DM being authoritative for a session does not make the DM the permanent owner of player Character source data.

The architecture should therefore treat ownership, runtime authority, and state lifetime as explicit domain metadata rather than assumptions hidden in UI components or network handlers.

## Core invariants

1. Permanent Character source data is player-owned.
2. Shared session runtime outcomes converge on one host-authoritative event sequence.
3. Derived values are reproducible and are never the sole source of truth.
4. Pending Resolution state is never partially committed.
5. Every mutable state family has an explicit lifetime and write-back policy.
6. Session-only state never silently becomes permanent Character state.
7. Permanent Character changes initiated during a session require an explicit durable write-back path.
8. Local persistence failure must not cause a connected client to invent a different shared history.
9. Reconnect must be idempotent: confirmed events are never applied twice.
10. Offline and online play should reuse the same domain commands/Resolution semantics even though authority differs.

## State lifetime taxonomy

### PortableDefinition

Reusable versioned content that can be installed, imported, mounted, or referenced.

Examples:

- RulesProfile metadata;
- RuleModule;
- RuleSource definition;
- Item Definition;
- Combatant Definition;
- reusable Action/Effect templates.

Properties:

- portable;
- versioned;
- not mutable encounter state;
- may be local, built-in, or session-mounted;
- may be referenced by durable Character source data.

### CharacterSource

Durable player-owned facts and choices that define what the Character is.

Examples:

- Character identity;
- progression tracks and selections;
- class/species/background/feat/spell choices;
- permanent RuleSource selections;
- permanent inventory membership and ItemInstance identity;
- explicit permanent overrides;
- module/source identities needed to reproduce the build.

CharacterSource should not contain redundant flattened values that can be derived from rules and selected sources.

### CharacterRuntimeDurable

Mutable player-owned state expected to survive normal application restarts and, where rules allow, session boundaries.

Examples:

- current HP;
- long-lived resource values;
- spell-slot/feature use state;
- consumable quantity;
- item charges;
- persistent item configuration;
- persistent Character-bound conditions/effects when the RulesProfile defines them as durable.

This state may change because of authoritative session events, but the permanent copy remains stored on the player's machine.

### DerivedCache

Reproducible results computed from source data, runtime state, RulesProfile, active RuleSources, and current context.

Examples:

- AC;
- ability modifiers;
- save/skill totals;
- attack modifiers;
- current Action availability;
- resource maxima;
- provenance graphs;
- legality summaries.

DerivedCache may be discarded and rebuilt at any time.

### SessionProjection

The host-visible representation of a connected Character required for shared play.

A SessionProjection:

- references a stable Character ID;
- references source/build revision identity;
- references required module/profile capabilities;
- contains the runtime data needed by the shared resolver;
- excludes private/local-only Character data by default;
- is not a second permanent Character file.

### SessionRuntime

DM-host-authoritative shared state for the active session.

Examples:

- connected participants;
- SessionMode;
- initiative/order/round/turn;
- action-economy ledgers;
- session-scoped SituationalRules;
- session module mounts;
- shared activity/event cursor;
- encounter membership.

### EncounterRuntime

State that exists only for a specific encounter/structured scene unless explicitly promoted.

Examples:

- Combatant State;
- encounter-only temporary HP/effects;
- initiative-local economy;
- encounter-only environmental state;
- encounter-scoped target/group metadata.

### EffectInstance

Runtime rule state created from a definition/action/source.

Each EffectInstance must identify:

- instance ID;
- source definition/source RuleSource;
- creator/caster when relevant;
- target(s);
- activation context;
- start event/time;
- duration/expiry policy;
- stacking/refresh/replacement identity;
- explicit lifetime classification;
- current runtime state needed by the effect.

Valid lifetime examples include:

- resolution-only;
- turn-only;
- encounter-only;
- session-only;
- Character-durable;
- profile-defined time-based lifetime.

The engine must not infer permanence merely because an effect currently exists.

### PendingResolution

Ephemeral calculation state while an Action is being resolved.

It may include:

- snapshots;
- selected targets;
- planned dice;
- generated dice outcomes;
- unresolved ChoiceDefinitions;
- pending reactions/interrupts;
- provisional state changes;
- DM adjudication inputs.

PendingResolution is not committed state.

If it is cancelled, invalidated, disconnected before authority confirms it, or fails validation, no provisional HP/resource/economy changes may remain.

### EventHistory

Committed authoritative history used for:

- activity/roll log;
- synchronization;
- causation/correlation;
- diagnostics;
- reconnect;
- correction;
- undo/reversal;
- reproducibility.

History retention policy may be shorter or longer than the lifetime of the live state it created.

## Authority model

Authority is operation-specific, not globally attached to an object.

For each state family the application should be able to answer:

- permanent owner;
- offline authority;
- connected-session authority;
- allowed proposer(s);
- allowed committer;
- DM correction rights;
- persistence destination;
- synchronization requirement;
- conflict/reconnect policy.

## Initial authority matrix

| State family | Permanent owner | Offline authority | Connected authority | Typical lifetime | Write-back |
| --- | --- | --- | --- | --- | --- |
| Character identity/build selections | Player | Player | Player, compatibility-gated | Durable | Player Character |
| Progression/level-up source choices | Player | Player | Player, session review if connected | Durable | Player Character |
| Derived AC/saves/attack totals | None | Local resolver | Shared resolver from authoritative inputs | Rebuildable | Never as sole truth |
| Current HP | Player | Player | DM host event sequence | Durable runtime | Player Character |
| Temp HP | Player/session context | Player | DM host event sequence | Rule-defined | If still durable at save/end |
| Character resources | Player | Player | DM host event sequence | Durable runtime | Player Character |
| Permanent ItemInstances | Player | Player | Player source ownership + host runtime outcomes | Durable | Player Character |
| Item charge/quantity consumption | Player | Player | DM host event sequence | Durable runtime | Player Character |
| Equip/loadout state | Player | Player | Player proposal, host-visible projection | Usually durable | Player Character |
| Session-only ItemInstance | Session | N/A | DM host | Session/encounter | No automatic permanent write-back |
| Persistent Character EffectInstance | Player | Player | DM host while connected | Rule-defined durable | Player Character |
| Session/encounter EffectInstance | Session | N/A | DM host | Session/encounter | No permanent write-back |
| Combatant State | DM/session | DM | DM host | Encounter/session | DM/session only |
| Initiative/order | Session | Local host if solo | DM host | Initiative | None |
| Action economy | Session runtime | Local resolver if solo | DM host resolver | Turn/round | None |
| SituationalRule | Session/DM | Local DM if solo | DM host | Explicit scope | Only if explicitly promoted |
| Pending Resolution | None | Local resolver | Host-coordinated | Ephemeral | None |
| ResolutionEvent history | Session/local history | Local app | DM host authoritative ordering | History policy | Optional local/session log |

This table is a starting contract. RulesProfile-specific state may extend it but must choose an explicit lifetime and authority policy.

## Offline behavior

When no shared session exists, the player's local application is authoritative for its Character.

The same domain-level commands and Resolution pipeline should still be used.

Conceptually:

```text
ActionRequest
    -> local validation
    -> local Resolution
    -> local ResolutionEvent
    -> atomic StateChanges
    -> safe Character persistence
```

This keeps offline and online behavior structurally aligned and reduces duplicated rule logic.

## Connected-session behavior

While connected, shared runtime outcomes must converge on one authoritative ordered event stream.

Recommended flow:

```text
Player local Character
    -> ActionRequest
    -> host validates Character revision/capabilities
    -> host/session Resolution
    -> required player/DM choices
    -> host commits ResolutionEvent
    -> all clients apply event idempotently
    -> Character-owned durable changes persist locally
```

The player can originate a request without being authoritative for the final shared result.

## ActionRequest versus ResolutionEvent

Do not treat a click/request as committed state.

An ActionRequest is intent.

A ResolutionEvent is committed outcome.

A request may:

- be rejected by legality checks;
- require a target correction;
- wait for reaction/choice;
- receive DM adjudication;
- be cancelled;
- become stale because authoritative state changed first.

Only the committed event changes authoritative session state.

## Write-back classification

Each committed StateChange should carry enough information to classify whether it affects:

- CharacterSource;
- CharacterRuntimeDurable;
- SessionProjection only;
- SessionRuntime;
- EncounterRuntime;
- DerivedCache invalidation only;
- history only.

Write-back should be driven by this classification rather than ad-hoc UI checks.

### Expected durable write-back examples

- current HP after confirmed damage/healing;
- spell slot/feature resource use;
- consumable quantity;
- item charges;
- persistent Character-bound conditions/effects where rules require persistence;
- explicit permanent item/boon grants;
- accepted progression/build changes.

### Expected non-write-back examples

- initiative/order;
- current action-economy ledger;
- encounter-only Combatant state;
- session-mounted modules;
- one-roll DM modifier;
- initiative-only SituationalRule;
- session-only item;
- expired temporary EffectInstance.

## Permanent grant workflow

A DM may need to give a player something that should survive the session, such as a permanent item or boon.

That operation must be explicit.

Recommended semantic flow:

```text
DM proposes durable grant
    -> target player sees durable impact
    -> validate required module/content
    -> player-local Character change prepared
    -> commit durable grant
    -> update session projection
```

A temporary session grant must never be promoted to CharacterSource merely because the session ended.

## Character revision identity

A stable Character ID is not enough. The host must know which version of the Character source/projection it is using.

The model should distinguish at least conceptually:

- **source/build revision** — changes when Character source choices/content identity change;
- **durable runtime revision** — changes when persistent HP/resources/items/effects change;
- **session projection revision/cursor** — changes as host-visible runtime state evolves;
- **event cursor** — identifies the last authoritative event applied.

The exact serialized fields are deferred, but these concerns must not be collapsed into one ambiguous `updatedAt` timestamp.

## Editing Character source while connected

Editing source/build data while connected may invalidate the session projection.

Examples:

- equip/unequip item;
- change prepared content;
- level up;
- import/replace a module dependency;
- alter a permanent override.

Recommended process:

1. Commit the change locally first.
2. Produce a new source/build revision.
3. Revalidate RulesProfile/module compatibility.
4. Send a projection update request.
5. Host accepts/rejects/requires review.
6. Shared session uses the new projection only after acceptance.

The UI should not silently show new local rules as active in shared play before host compatibility succeeds.

## Session disconnect

Disconnect does not revoke player ownership of permanent Character data.

On disconnect:

- confirmed authoritative events already applied locally remain;
- unconfirmed ActionRequests/PendingResolutions are not committed;
- session-only state is retained only as resumable session state where appropriate;
- local Character remains usable offline;
- event cursor/revision data is retained for reconnect.

## Reconnect

Reconnect should use snapshot + event cursor semantics rather than blindly replacing local data.

Conceptual flow:

1. Identify session and participant.
2. Exchange Character source/build revision.
3. Exchange durable runtime revision where required.
4. Exchange last applied authoritative event cursor.
5. Recover missing event range or authoritative snapshot.
6. Detect local source/module incompatibility.
7. Apply missing events idempotently.
8. Restore SessionMode/initiative/economy/effects from host state.
9. Resume only after projection is coherent.

## Idempotency

Every committed event requires a stable unique ID.

A client that receives the same event twice must recognize that it was already applied.

This is mandatory for:

- reconnect;
- retry after network interruption;
- acknowledgement loss;
- duplicate WebSocket delivery;
- local crash recovery.

## Local persistence failure after shared commit

This is a critical failure case.

Example:

1. Host commits damage: HP 40 -> 28.
2. Player applies the authoritative event in memory.
3. Local disk write fails.

The player must not independently roll back to 40 while everyone else remains at 28.

Instead:

- session memory remains synchronized at 28;
- local persistence enters an explicit unsaved/recovery state;
- previous valid disk revision remains preserved;
- the application retries or provides a recovery/export path;
- event/revision metadata is preserved sufficiently to restore the authoritative durable state later.

Suggested UX:

`Session synchronized — local save failed`

with a clear recovery action.

## Session end

Ending a session is a lifetime transition, not a blanket reset.

The host/client should classify current state into:

### Keep

- CharacterSource changes explicitly committed as durable;
- CharacterRuntimeDurable state;
- player-owned ItemInstance state;
- durable RuleProfile-supported EffectInstances;
- local history according to user/session policy.

### Discard/unmount

- session-only modules;
- initiative/order;
- action economy;
- encounter Combatant state;
- expired/session-only SituationalRules;
- encounter-only EffectInstances;
- session-only temporary items.

### Review

If a rule asks for a lifetime the active implementation cannot classify, do not silently keep or delete it. Surface the state as unsupported/review-required.

## DM adjudication and correction

DM adjudication changes shared runtime state through explicit operations, not hidden mutation of player source data.

Examples:

- one-roll +2 modifier;
- force miss -> hit;
- manual damage correction;
- restore resource;
- add/remove condition;
- suppress a source for the encounter.

Each correction should create an explicit event or reversal linked to its authority/provenance.

A DM must use a distinct durable-grant/source-change workflow to alter permanent Character source data.

## ItemInstance integration

Permanent ItemInstances are player-owned Character data.

While connected:

- the host receives the mechanical projection needed for rules resolution;
- use/charge/quantity outcomes are host-authoritative events;
- confirmed durable state changes write back locally;
- equip/loadout changes originate from the player but become shared only after projection acceptance;
- session-only items remain session-owned unless explicitly converted into a durable grant.

## EffectInstance integration

An EffectInstance must state its lifetime explicitly.

Examples:

```text
one attack -> resolution-only
until end of turn -> initiative runtime
until encounter ends -> encounter-only
until session ends -> session-only
until long rest -> Character-durable
10 minutes -> depends on session/world-time and persistence policy
```

RulesProfile/content should provide the semantics. UI must not guess based on display text.

## Progression integration

Level-up/progression is a CharacterSource transaction.

While connected:

1. Player completes ProgressionDraft locally.
2. New Character source/build revision is committed locally.
3. Module/profile compatibility is revalidated.
4. Updated session projection is proposed.
5. Host accepts it before new mechanics affect shared Resolution.

The DM never owns the permanent progression transaction.

## StateChange transaction requirements

A single Resolution may affect many state families.

Example:

```text
Action economy: ready -> spent
Item charge: 3 -> 2
Target temp HP: 5 -> 0
Target HP: 24 -> 17
EffectInstance: created
```

These changes must commit atomically as one authoritative transaction.

If the Resolution is cancelled before commit, none apply.

Undo/correction operates against committed events and must respect later dependent events rather than silently rewriting history.

## UI requirements

Normal UX should expose simple actionable status rather than distributed-system terminology.

Useful states:

- `Saved locally`;
- `Saving`;
- `Local save failed`;
- `Connected / synchronized`;
- `Reconnecting`;
- `Session state newer than local disk`;
- `Character changed locally — review required before shared play`;
- `Session-only` badge;
- `Persists after session` badge for durable grants/effects.

Detailed revision IDs, event cursors, authority, and provenance belong in an advanced inspector/debug surface.

## Required scenario tests

The later domain implementation should include deterministic scenarios for at least:

1. Character starts at HP 40, takes authoritative 12 damage, local durable state becomes 28.
2. Client reconnects after event application and does not apply the damage twice.
3. Disconnect occurs while awaiting a reaction; no action/resource/HP mutation is committed.
4. Spell slot spent during session persists after session end.
5. Initiative/action economy disappear at session end while HP/resources remain.
6. Session-only magic item works during play and disappears without entering permanent inventory.
7. Explicit permanent DM item grant becomes player-owned only through durable grant workflow.
8. Local disk write fails after authoritative damage; session remains synchronized and recovery state is visible.
9. Player levels up while connected; new mechanics remain local until compatibility/projection acceptance.
10. DM correction changes HP through a correction event without changing Character build/source choices.
11. The same committed event delivered twice is applied once.
12. An unsupported EffectInstance lifetime blocks cleanup/persistence with an actionable review result.

## Open decisions to settle with ResolutionEvent design

The following belong to the next event/transaction specification but must preserve this document's invariants:

- exact event envelope fields;
- causation/correlation IDs;
- StateChange serialization;
- revision/cursor encoding;
- snapshot cadence;
- undo/reversal dependency policy;
- event retention boundaries.

## Non-goals

This design does not introduce:

- cloud Character synchronization;
- multi-DM distributed authority;
- peer-to-peer consensus;
- CRDT Character editing;
- arbitrary server-side ownership of permanent player files;
- a final WebSocket packet format.
