# Campaign Runtime and Optional Session Rules

Date: 2026-08-22
Status: canonical v1 design policy

Detailed system/data/UI specification: `docs/design/campaign-systems.md`

## Product boundary

For a DM, `Campaign` is the durable preparation and continuity root. A live `Session` is always launched from one Campaign and never becomes the long-term owner of party state.

```text
Local Host
└─ Campaign Library
   ├─ Campaign A
   │  ├─ session defaults and optional-rule settings
   │  ├─ calendar state
   │  ├─ ration/supply state
   │  ├─ Party Stash
   │  ├─ private DM Library namespace
   │  └─ past Session summaries
   └─ Campaign B
      └─ independent state with no implicit sharing
```

Player-owned Characters, installed ContentCatalog definitions, and application preferences remain separate stores. A Campaign may reference them but does not copy or take ownership of them.

## Campaign lifecycle

The v1 DM path is:

```text
Campaigns
-> create or open Campaign
-> review Campaign dashboard
-> start Session
-> review Session settings
-> Host preparation / lobby
-> live Session
-> end Session and commit authorized Campaign changes
```

A Campaign has a stable `campaignId`, display name, created/updated timestamps, session defaults, optional-rule configuration, Party Stash identity, private DM Library namespace, and a bounded Session-history summary. Deleting or archiving a Campaign is an explicit destructive operation and must never delete player-owned Characters or installed content.

The Host can start more than one Session over the lifetime of a Campaign. Starting a new Session clears transient participants, readiness, Initiative, projections, pending resolutions, and active handouts while retaining Campaign-owned continuity state.

## Session configuration snapshot

Session setup exposes, at minimum:

- Session name;
- Freeform or Initiative starting mode;
- `세션 달력 사용`;
- `식량 규칙 사용`;
- enabled rules/content modules and detected capabilities;
- the selected Campaign identity.

Campaign defaults prefill the form. Starting the Session captures an immutable configuration snapshot for that Session. Changing Campaign defaults later does not silently alter a running Session.

An authorized DM may change an optional rule during a live Session only through an explicit Session command and Activity entry. Disabling a feature hides or disables its commands and automation; it does not erase its saved Campaign state. Re-enabling resumes from the retained state unless the DM explicitly resets it.

## Calendar capability

The v1 calendar is an optional Campaign continuity capability, not a tactical clock and not a mandatory dependency of duration rules.

When enabled, the Campaign can track a current date/day marker, optional time-of-day label, notes, and an append-only advancement history. The Session may advance Campaign time through an authoritative DM command. Rule modules may contribute calendar presentation or advancement policies through declared capabilities, but UI code must not invent a setting-specific calendar formula.

When disabled:

- calendar UI and advance-time commands are unavailable;
- no rest, duration, travel, or effect is rejected merely because Campaign calendar data is absent;
- saved calendar state remains intact and private unless explicitly projected;
- rule content requiring a concrete calendar provider is reported as inactive/unsupported, not approximated.

## Ration and food capability

`식량 규칙 사용` controls ration/supply bookkeeping and any declared consumption automation. The baseline v1 model may track a non-negative party ration balance and explicit DM adjustments/consumption events. More specific survival formulas belong to the active RulesProfile or a compatible declarative module.

When enabled, changes use authoritative, idempotent transactions and appear in Campaign/Session Activity with provenance. Consumption can never make the balance negative or mutate player inventory through UI-local arithmetic.

When disabled:

- ration counters, warnings, automatic consumption, and food-related blockers are inactive;
- ordinary travel/rest/session progression remains usable;
- existing balances and history are preserved;
- ItemDefinitions tagged as food remain normal inventory items unless another active rule says otherwise.

## Party Stash

The Party Stash is Campaign-owned durable shared inventory/wallet state. A Session receives an authorized projection and submits transfers to Session authority, but the Session is not the durable owner.

Every stash transaction carries `campaignId`, `sessionId` when live, idempotency key, endpoint revisions, initiating participant, policy result, and provenance. Ending and restarting a Session must retain committed Campaign stash state exactly once.

The existing `shared`, `dm-approval`, and `dm-managed` policy presets remain valid. Turning ration rules on does not reinterpret arbitrary stash items as food; only explicit capability-backed definitions participate.

## Campaign-scoped DM Library

Every Campaign owns a private DM Library namespace for its images, PC Actor presets, NPC definitions, custom items, notes, favorites, recents, and organization metadata. Search and Quick actions in a live Session query only:

1. the selected Campaign's private DM Library;
2. compatible installed content/rulebook definitions;
3. explicitly authorized Session-local assets.

Campaign A private entries never appear in Campaign B search, recents, autocomplete, payloads, or Session projections unless the DM explicitly duplicates/imports them. A later reusable global template library may be added, but v1 does not create implicit cross-Campaign sharing.

Clients never receive the private library index. They receive only explicitly instantiated Actors, granted ItemInstances, revealed handouts, public stash projections, and other authorized Session data.

## Spatial and battle-map capability

Core remains mapless. A battle-map/spatial module must declare and successfully mount the capabilities it supplies, such as distance, visibility, cover, token movement, or movement-trigger facts.

If no compatible module is detected, or the module disconnects/fails validation:

- map/token/movement controls are absent or disabled;
- distance, visibility, cover, path, and line-of-sight labels are not fabricated;
- `거리 초과`, `시야 없음`, or cover-based disabled reasons are not produced from missing facts;
- missing distance is `unknown`, never `out-of-range`;
- otherwise valid manual targets remain selectable;
- rules that fundamentally require a module-owned operation are shown as inactive/unsupported with a clear capability reason.

Once a compatible provider is active, Core may enforce only the authoritative facts supplied through the coordinate-agnostic host contract. Removing the provider clears/invalidates its live facts and immediately returns the UI to mapless behavior; stale module facts cannot continue blocking actions.

## Persistence and authority

Campaign data is local Host-owned durable state. Connected Session authority orders accepted commands, while durable commits are written to the owning Host Campaign store. Player Character write-back remains owned by each Player client.

Required boundaries:

- Campaign state has schema version, revision, migration, corruption recovery, and atomic write semantics;
- a Session snapshot records its source `campaignId` and configuration revision;
- connected retries are idempotent and reconnect replay does not duplicate Campaign changes;
- Session end produces a bounded summary, not a copy of the event ledger or Character files;
- private Campaign data is never serialized into broad Client snapshots.

## V1 acceptance

1. Create two Campaigns and prove their stash, calendar, ration, and DM Library state remain isolated after restart.
2. Start, end, and restart Sessions from one Campaign without leaking transient Session state or losing durable Campaign state.
3. Toggle calendar and ration rules at Session setup; disabled features create no blockers or automation and preserve prior values.
4. Advance calendar, adjust/consume rations, and mutate Party Stash exactly once across reconnect/retry.
5. Search and grant a Campaign custom item without exposing the private catalog to a Client.
6. Run without a spatial module and prove missing distance/visibility/cover never disables an otherwise valid target.
7. Mount a compatible spatial provider, enforce its facts, then remove it and prove stale facts no longer affect legality.

## Explicit v1 non-goals

- built-in tactical map, grid, tokens, Fog of War, pathfinding, collision, or LOS;
- a full calendar editor for every fictional calendar system;
- automatic travel simulation, weather, hunting, encumbrance, or detailed nutrition;
- cloud Campaign synchronization or multi-DM concurrent editing;
- implicit sharing of private DM Library entries across Campaigns;
- executable third-party map plugins inside declarative RuleModule packages.
