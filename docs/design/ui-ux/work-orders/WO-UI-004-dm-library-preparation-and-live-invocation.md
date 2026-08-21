# WO-UI-004 — DM Library Preparation + Live Invocation

Status: **PLANNED — PROTOTYPE/ARCHITECTURE REVIEW BEFORE RUNTIME AUTHORIZATION**

Owner direction:

> DM은 혼자 액세스 가능한 전용 라이브러리 시스템이 있었어야해. 거기에 이미지와 PC액터와 NPC액터를 미리 모아두고 사용할수 있어야했어.

Planning authorization:

> 그래 바로 가자

This authorization covers the planning/prototype work described below. It does not yet authorize broad runtime persistence/network implementation before the new architecture gaps and prototype acceptance are resolved.

---

# 1. Product sources

Required reading:

1. `docs/design/ui-ux/DM-LIBRARY-PLAN.md`
2. `docs/design/dm-library-persistence.md`
3. `docs/design/ui-ux/prototype/DM-LIBRARY-EXTENSION.md`
4. `docs/design/ui-ux/prototype/app/dm-library-reference.html`
5. existing accepted `docs/design/ui-ux/prototype/app/integrated-reference.html`
6. `docs/design/persistence.md`
7. `docs/design/session-runtime.md`
8. applicable `docs/design/ui-ux/contracts/*`

---

# 2. Goal

Add a durable local DM preparation Library with three collections:

```text
Images
PC Actor Presets
NPC Actor Definitions
```

Then allow live Host/DM tasks to invoke that Library without leaving/replacing the accepted Connected Play workspace:

- Encounter -> Add Actor -> From DM Library;
- Session/Handout -> Choose Image -> DM Library -> explicit Reveal.

Player Clients must not receive the private Library catalog/source metadata.

---

# 3. Runtime implementation phases

Runtime work should be split so unresolved transport/storage does not contaminate UI.

## Phase A — Local durable metadata and preparation UI

- DM Library Product Shell route under Session;
- structured metadata persistence;
- Images / PC Actors / NPC Actors collection UX;
- search/folder/tag/favorite/recent;
- local CRUD;
- local image preview after asset-store contract exists;
- validation/problem state.

## Phase B — Actor definition/preset instantiation

- validate source against current catalog/session snapshot;
- create independent Session Actor identities;
- Add from Library inside Encounter;
- repeated NPC quantity add;
- no source write-back from Session mutations;
- optional existing Session control assignment for PC Actor instances.

## Phase C — Connected Handout projection

Only after `GAP-HANDOUT-NETWORK-CONTRACT` is resolved:

- choose Library image;
- private preview;
- explicit reveal;
- connected delivery;
- withdraw;
- reconnect restoration;
- no private catalog delivery.

---

# 4. Hard boundaries

Do not implement:

- battlemap library semantics;
- Actor coordinates/tokens/grid/path/LoS/fog;
- DM ownership of Player Character files;
- PC Actor preset as a Character Library alias;
- automatic Library source mutation from live Session state;
- automatic full Library sync to Clients;
- CSS-only privacy;
- executable plugin code in entries;
- UI-invented image limits/schema/versioning;
- UI-invented Actor legality/derived authority.

---

# 5. Required prototype acceptance before runtime UI

Candidate review entry:

`docs/design/ui-ux/prototype/app/dm-library-reference.html`

Required scenarios:

- `DMLIB-SCN-01` Offline Images;
- `DMLIB-SCN-02` Offline NPC Actor Definitions;
- `DMLIB-SCN-03` Offline PC Actor Presets;
- `DMLIB-SCN-04` Live Encounter Add from Library;
- `DMLIB-SCN-05` Live Handout Reveal from Library;
- `DMLIB-SCN-06` Player non-delivery.

Owner should explicitly accept or request changes before runtime UI is treated as frozen enough for implementation.

---

# 6. Architecture blockers

Created/required:

- `GAP-DM-LIBRARY-METADATA-PERSISTENCE`;
- `GAP-DM-LIBRARY-ASSET-STORAGE`;
- `GAP-DM-LIBRARY-ACTOR-INSTANTIATION`;
- `GAP-DM-LIBRARY-PRIVATE-PROJECTION`.

Existing blockers still relevant:

- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

These are defined/explained in `docs/design/dm-library-persistence.md`.

---

# 7. Definition of Done

WO-UI-004 can close only when one accepted/verified runtime source satisfies:

1. DM Library survives app restart using explicit durable storage;
2. Images / PC Actors / NPC Actors are reusable and searchable;
3. private Library catalog is not delivered to Players;
4. NPC definition can instantiate multiple independent Session Actors;
5. Session runtime changes never silently mutate the source definition;
6. PC Actor preset can instantiate and use existing control assignment without becoming Player-owned Character source;
7. Encounter can Add from Library without leaving accepted Play composition;
8. image preview is private until explicit reveal;
9. connected Handout reveal/withdraw/reconnect is correct once the network contract exists;
10. deletion/corruption/missing-content recovery is explicit;
11. TypeScript/build and dedicated persistence/session/privacy/UI regressions are green;
12. Owner Human QA passes preparation + live-use + Player non-delivery flows.

---

# 8. Current route

```text
Product direction recorded
-> architecture boundary recorded
-> DM Library prototype candidate built
-> OWNER PROTOTYPE REVIEW
-> architecture gap materialization/freeze
-> scoped runtime authorization
-> Phase A/B/C implementation
```

Do not begin WO-UI-004 runtime implementation merely because this Work Order exists.
