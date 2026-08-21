# WO-UI-004 — DM Library Preparation + Quick Live Invocation

Status: **PLANNED — UPDATED AFTER OWNER LIVE-UX CORRECTION — PROTOTYPE/ARCHITECTURE REVIEW BEFORE RUNTIME AUTHORIZATION**

Owner directions:

> DM은 혼자 액세스 가능한 전용 라이브러리 시스템이 있었어야해. 거기에 이미지와 PC액터와 NPC액터를 미리 모아두고 사용할수 있어야했어.

> 세션 내에서는 더 간단하게 액터를 추가하거나 이미지를 볼수있게 했으면 좋겠어.

Planning authorization:

> 그래 바로 가자

This Work Order remains planning/prototype-only until the relevant architecture contracts and Owner prototype review are complete.

---

# 1. Product sources

Required reading:

1. `docs/design/ui-ux/CORE-SYSTEMS-UX-PLAN.md`
2. `docs/design/ui-ux/DM-LIBRARY-PLAN.md`
3. `docs/design/dm-library-persistence.md`
4. `docs/design/ui-ux/prototype/CORE-SYSTEMS-EXTENSION.md`
5. `docs/design/ui-ux/prototype/app/core-systems-reference.html`
6. `docs/design/ui-ux/prototype/DM-LIBRARY-EXTENSION.md` — preparation-surface evidence
7. `docs/design/ui-ux/prototype/app/dm-library-reference.html` — preparation-surface candidate/history
8. existing accepted `docs/design/ui-ux/prototype/app/integrated-reference.html`
9. `docs/design/persistence.md`
10. `docs/design/session-runtime.md`
11. applicable `docs/design/ui-ux/contracts/*`

---

# 2. Goal

Provide durable local preparation collections:

```text
Images
PC Actor Presets
NPC Actor Definitions
```

and make their routine live use shallow:

```text
Ctrl+K / + Quick
-> Actor +1 / More
-> Image View / Reveal
```

The full DM Library remains the deep preparation/management surface.

The nested Encounter/Handout Library browser remains a detailed fallback, not the primary live path.

Player Clients must not receive the private Library catalog/source metadata.

---

# 3. Runtime implementation phases

## Phase A — Local durable preparation

- DM Library route under Session;
- structured metadata persistence;
- Images / PC Actors / NPC Actors;
- search/folder/tag/favorite/recent;
- local CRUD;
- local image preview after asset-store contract exists;
- validation/problem state.

## Phase B — Quick Search + Actor instantiation

Only after source aggregation/privacy and Actor instantiation contracts exist:

- small DM-only Quick launcher in accepted Play chrome;
- `Ctrl+K` keyboard access;
- Recent/Favorites empty-query state;
- Actor search result `+1`;
- secondary `More` for repeated quantity and management;
- independent Session Actor identities;
- no Library source write-back from runtime mutations;
- optional existing control assignment for PC Actor instances;
- detailed `Open in DM Library` fallback.

## Phase C — Quick Image View / Reveal

Only after `GAP-HANDOUT-NETWORK-CONTRACT` is resolved:

- image result `View` = private Host preview;
- image result `Reveal` = explicit connected Handout projection;
- withdraw;
- reconnect restoration;
- no private catalog/index delivery.

## Phase D — Broader Quick palette integration

Coordinate with the Core Systems plan when authorized:

- Item `Give / Party`;
- Condition `Apply`;
- Rule `Open`;
- source-specific result actions;
- no cross-source privacy leakage.

WO-UI-004 does not independently authorize Party Stash or unrelated Character-system runtime changes.

---

# 4. Hard boundaries

Do not implement:

- battlemap library semantics;
- Actor coordinates/tokens/grid/path/LoS/fog;
- DM ownership of Player Character files;
- PC Actor preset as Character Library alias;
- automatic source mutation from live Session state;
- automatic Library/index sync to Clients;
- CSS-only privacy;
- selection-as-image-reveal;
- UI-invented persistence/network/schema/legality authority.

---

# 5. Required prototype acceptance before runtime UI

Active live-use candidate:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

Primary review scenario:

`SYS-SCN-04 — DM unified Quick Search`

Also inspect:

- `SYS-SCN-00` placement grammar;
- `SYS-SCN-03` live system density;
- first DM Library candidate `DMLIB-SCN-01/02/03` for offline preparation layout;
- Player non-delivery principle from `DMLIB-SCN-06`.

The older heavy live picker in `DMLIB-SCN-04/05` is superseded as the primary live interaction direction. Its privacy/source-instantiation principles remain useful evidence.

Owner must explicitly accept or amend the Quick flow before runtime UI is treated as frozen enough for implementation.

---

# 6. Architecture blockers

Required DM Library gaps:

- `GAP-DM-LIBRARY-METADATA-PERSISTENCE`;
- `GAP-DM-LIBRARY-ASSET-STORAGE`;
- `GAP-DM-LIBRARY-ACTOR-INSTANTIATION`;
- `GAP-DM-LIBRARY-PRIVATE-PROJECTION`;
- Quick Search aggregation/index privacy/caching contract.

Existing relevant blockers:

- `GAP-HANDOUT-NETWORK-CONTRACT`;
- `GAP-DM-ONLY-DELIVERY-PROTOCOL` where applicable.

---

# 7. Definition of Done

WO-UI-004 can close only when an accepted/verified runtime source satisfies:

1. DM Library survives restart using explicit durable storage;
2. Images / PC Actors / NPC Actors are reusable/searchable;
3. private Library/index metadata is not delivered to Players;
4. `Ctrl+K` / Quick opens over the accepted Play scene without route replacement;
5. common Actor add is `search/recent -> +1` without opening Encounter management;
6. repeated quantity remains available behind secondary detail;
7. Session Actor instances are independent from source definitions;
8. PC Actor preset control assignment does not become Character ownership;
9. Image `View` stays private;
10. Image `Reveal` is explicit and connected/reconnect-safe after network contract resolution;
11. full DM Library remains available for preparation/management;
12. TypeScript/build and dedicated persistence/session/privacy/UI regressions are green;
13. Owner Human QA passes preparation + Quick live use + Player non-delivery.

---

# 8. Current route

```text
DM Library preparation direction
-> heavy live picker prototype built
-> Owner requests faster live access
-> unified Core Systems / DM Quick candidate built
-> OWNER PROTOTYPE REVIEW
-> architecture gap materialization/freeze
-> scoped runtime authorization
-> phased implementation
```

Do not begin WO-UI-004 runtime implementation merely because this Work Order exists.
