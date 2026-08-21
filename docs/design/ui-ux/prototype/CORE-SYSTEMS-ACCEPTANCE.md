# Core Systems UX — Owner Acceptance

Status: **OWNER ACCEPTED PRODUCT / UX EXTENSION — RUNTIME SEMANTICS NOT YET AUTHORIZED**

Accepted date: **2026-08-22**

Owner acceptance:

> 좋아. 이걸 기반으로 일단 반영하는걸로 하자

This acceptance applies to the Core Systems UX direction built from the preceding Owner directions:

> 일단 뭐든 나중에 추가할수있는 방식으로 소프트 코딩하고 일단 제작을 계속하는게 맞을것같아. 그리고 전체적으로 한국어 기준으로 제작되어야해.

The accepted review entry is:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

The active extensibility/localization design contract is:

`docs/design/ui-ux/EXTENSIBILITY-KOREAN-FIRST.md`

The planning source is:

`docs/design/ui-ux/CORE-SYSTEMS-UX-PLAN.md`

---

# 1. Accepted product direction

The following interaction grammar is accepted as the baseline direction for recurring game systems:

```text
관리
-> 캐릭터 시트 / DM 라이브러리 / 파티 보관함 상세

사용
-> 커맨드 센터

상태
-> 액터 카드 / 자원 표시줄 / 현재 대응

빠른 검색
-> Ctrl+K / + 빠른 검색
```

Full management surfaces and live execution surfaces remain intentionally separate.

Accepted examples:

- Inventory is not the Item Hotbar.
- Spellbook is not the Spell Hotbar.
- passive Features do not automatically occupy Hotbar slots.
- DM Library is the preparation source, while live retrieval uses Quick Search.
- Conditions/Concentration stay compact until detail/response is needed.
- Rest is a preview/choice/commit workflow rather than a blind reset button.
- Party Stash is a shared-inventory concept separate from one Character inventory.

---

# 2. Korean-first product UI

The default v1 user-facing product language is `ko-KR`.

The accepted direction is:

- menus, buttons, tabs, system labels, status text, error/help text, accessibility labels and tutorials are authored in Korean by default;
- stable internal IDs, persistence keys and network identities remain language-neutral;
- user-authored names and external content names are not force-translated;
- localization resources/descriptors are preferred over using visible Korean/English strings as identity.

This is a product baseline, not merely a prototype styling preference.

---

# 3. Extensible / soft-coded structure

The accepted extensibility goal is not to predict every future system in advance.

The goal is to preserve stable extension points so future systems can be registered without rebuilding the core UI.

Preferred structure:

```text
stable identity
+ validated domain/application capability
+ registry/provider/descriptor
+ localized presentation metadata
-> shared renderer / interaction grammar
```

Initial accepted registry-style extension points include:

- Character Sheet sections;
- Hotbar pages/capabilities;
- Quick Search providers and result actions;
- Party Stash permission-policy presets;
- Rest activity descriptors;
- status/effect presentation descriptors;
- future inventory grouping/presentation metadata where domain contracts support it.

The product must not treat untyped JSON or UI-local string switches as a substitute for domain contracts.

---

# 4. Party Stash disposition

Party Stash is accepted as a shared inventory concept, but its exact durable ownership/lifetime/transaction contract is still architecture/domain work.

The current UX policy presets are accepted as initial configurable presets, not hard-coded storage models:

```text
공유 관리
DM 승인형
DM 관리형
```

All presets operate over one Party Stash concept. A future custom policy/capability matrix may be added without changing the stash data model merely because the permission policy changes.

Unknown/unrevealed DM loot must not be hidden inside Player-delivered Party Stash data. Private preparation/loot candidates remain separate until an explicit acquisition/publish transition.

---

# 5. DM Library / Quick Search disposition

The earlier full DM Library preparation surface remains relevant for preparation and detailed management.

The heavy live path:

```text
Encounter -> Add Actor -> DM Library picker -> quantity -> Add
```

is not the primary live UX.

Accepted primary live direction:

```text
Ctrl+K / + 빠른 검색
-> 액터: +1 추가 / 더 보기
-> 이미지: 미리보기 / 공개
-> 아이템: 지급 / 파티 보관함
-> 상태: 적용
-> 규칙: 열기
```

The full picker may remain as a detailed fallback.

Private DM source catalogs are not delivered to Players merely to hide them in presentation.

---

# 6. Existing accepted Play remains valid

This acceptance extends rather than replaces the already Owner-accepted Connected Play composition:

```text
Play chrome
Upper Actor Board
Mapless Stage
Lower Actor Board
Persistent Command Center
```

Core remains mapless. No battlemap/grid/token/x-y/path/LoS/fog semantics are introduced by this acceptance.

---

# 7. Runtime authorization boundary

This acceptance authorizes product/UX consolidation and future contract materialization.

It does **not** by itself authorize UI code to invent unresolved runtime semantics for:

- Party Stash persistence/ownership/lifetime;
- durable item transfer/grant/write-back;
- Quick Search indexing/source privacy architecture;
- DM Library persistence and private projection gaps;
- connected Handout transport/reconnect;
- condition/effect authoritative fast-apply path;
- rest preview/commit authority;
- Hotbar customization persistence.

Those remain explicit domain/architecture/runtime work.

---

# 8. Consolidation rule

Future UI planning and implementation should treat this acceptance plus `EXTENSIBILITY-KOREAN-FIRST.md` as the active baseline for new recurring systems.

When a new system is introduced, first ask whether it can join an existing registry/provider/capability extension point. Add a new core UI structure only when the task model materially requires one.
