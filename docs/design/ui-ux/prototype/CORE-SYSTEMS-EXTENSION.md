# Core Systems UX — Accepted Prototype Extension

Status: **OWNER ACCEPTED PRODUCT / UX EXTENSION — CONSOLIDATION BASELINE — RUNTIME SEMANTICS NOT YET AUTHORIZED**

Owner acceptance record:

`docs/design/ui-ux/prototype/CORE-SYSTEMS-ACCEPTANCE.md`

Planning source:

`docs/design/ui-ux/CORE-SYSTEMS-UX-PLAN.md`

Extensibility / localization contract:

`docs/design/ui-ux/EXTENSIBILITY-KOREAN-FIRST.md`

Accepted review entry:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

Supporting files:

- `core-systems-reference.css`;
- `core-systems-reference-ko.js`;
- existing accepted `integrated-reference.css` for the shared Play visual grammar.

---

# Purpose

This extension establishes where Inventory, Spells, Features, Conditions, Rest, Party Stash, and DM Library/Quick belong without turning each subsystem into a separate product.

Accepted common grammar:

```text
관리 -> 시트 / 라이브러리 / 파티 보관함 상세
사용 -> 커맨드 센터
상태 -> 액터 카드 / 자원 표시줄 / 현재 대응
빠른 검색 -> Ctrl+K / + 빠른 검색
```

Full collection/management surfaces are not the normal live execution surface.

---

# Relationship to accepted Play

The already Owner-accepted Connected Play composition remains valid:

- compact Play chrome;
- upper opposing Actor Board;
- broad mapless Stage;
- lower allied Actor Board;
- persistent Command Center.

This extension adds system presentation/entry points without replacing that topology.

Core remains mapless.

---

# Accepted scenarios

## SYS-SCN-00 — 전체 시스템 위치

Accepted direction:

- 관리 = Sheet / Library / Party detail;
- 사용 = Command Center;
- 상태 = Actor / Resource / current response;
- 빠른 검색 = command palette.

## SYS-SCN-01 — 캐릭터 인벤토리 관리

Accepted direction:

- Inventory lives inside Character Sheet;
- equipped / consumable / container / other grouping is presentation metadata, not a permanently closed taxonomy;
- quantity/equipment/container state belongs to owned-item management;
- executable Item capabilities project to Play rather than dumping the full Inventory into Play.

## SYS-SCN-02 — 주문과 특성 관리

Accepted direction:

- complete known/owned/configured records stay on the Sheet;
- passive and executable capabilities are visually and semantically distinct;
- passive traits do not automatically consume Hotbar slots;
- current resources may project to the Resource Rail.

## SYS-SCN-03 — 플레이어 실시간 사용

Accepted direction:

- accepted Play skeleton remains visible;
- Hotbar pages expose current executable capability, not complete source collections;
- important current states such as Concentration/Conditions remain compact until detail is needed.

## SYS-SCN-04 — DM 빠른 검색

Accepted primary live direction:

- small DM-only `+` launcher plus `Ctrl+K`;
- empty query emphasizes recent/favorite/relevant entries;
- result types/actions come from provider/descriptor registration rather than one permanently closed switch;
- initial result families are Actor / Image / Item / Condition / Rule;
- Actor common path is `+1 추가`;
- Image `미리보기` and `공개` remain explicitly distinct;
- Item may route to explicit `지급` or `파티 보관함` flows;
- private DM source catalogs are not delivered to Players.

The old nested Encounter/Library picker remains only a detailed fallback.

## SYS-SCN-05 — 파티 보관함과 분배

Accepted product direction:

- Party Stash is distinct from one Character inventory;
- item/currency presentation and explicit transfer are appropriate;
- policy and stored inventory are separate concepts;
- initial policy presets are `공유 관리`, `DM 승인형`, `DM 관리형`;
- these presets must not become three incompatible storage models;
- future policies may be added through permission/capability descriptors.

Exact durable ownership/lifetime/write-back semantics remain runtime architecture work.

## SYS-SCN-06 — 휴식 미리보기와 적용

Accepted direction:

- Rest is a contextual Activity/workflow;
- preview affected state first;
- ask only real choices;
- explicit completion/commit;
- UI does not hard-code which resources recover merely from the visible rest label.

## SYS-SCN-07 — 상태와 집중 대응

Accepted direction:

- ordinary Play keeps status compact;
- focused detail/response appears when attention is required;
- UI does not authoritatively calculate missing legality/save/expiry semantics.

---

# Korean-first acceptance

The accepted default user-facing language for v1 is Korean (`ko-KR`).

Visible product strings, labels, help/error/status text, accessibility labels, tutorials, and normal product terminology should therefore be Korean-first.

Stable internal IDs, persistence keys, network identities, provider IDs, and capability IDs remain language-neutral.

User-authored names and external content names are not force-translated.

---

# Extensibility acceptance

The accepted implementation direction is registry/provider/descriptor-driven extension where appropriate:

```text
stable internal identity
+ validated capability/domain contract
+ registry/provider/descriptor
+ localized presentation metadata
-> shared renderer / shared interaction grammar
```

This does not mean untyped JSON everywhere. Type safety, validation, authority, privacy, lifetime, and domain contracts remain explicit.

Initial extension points include:

- Character Sheet sections;
- Hotbar pages/capabilities;
- Quick Search providers/actions;
- Party Stash policy presets/capabilities;
- Rest activity descriptors;
- status/effect presentation descriptors;
- inventory presentation grouping where canonical metadata supports it.

---

# Supersession note for first DM Library candidate

`dm-library-reference.html` remains useful for offline preparation-surface review.

Its heavier live flow:

```text
Encounter -> Add Actor -> Library picker -> quantity -> Add
```

is superseded as the primary live path.

Accepted primary live path:

```text
Ctrl+K / + 빠른 검색 -> explicit result action
```

Detailed Encounter/Library navigation remains a fallback.

---

# Runtime boundary

Owner acceptance here is product/UX acceptance and a consolidation baseline.

It does not permit UI code to invent unresolved semantics for Party Stash persistence, durable transfers, Quick Search source privacy/indexing, DM Library persistence/projection, Handout networking, condition fast-apply authority, rest commit semantics, or Hotbar customization persistence.

Those require explicit domain/architecture contracts and scoped runtime authorization.
