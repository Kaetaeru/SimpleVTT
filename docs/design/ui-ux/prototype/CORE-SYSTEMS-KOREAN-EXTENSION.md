# Core Systems Korean-first Extension

Status: **OWNER-DIRECT CANDIDATE — VISUAL/FLOW REVIEW PENDING**

Owner direction:

> 일단 뭐든 나중에 추가할수있는 방식으로 소프트 코딩하고 일단 제작을 계속하는게 맞을것같아. 그리고 전체적으로 한국어 기준으로 제작되어야해.

Review entry:

`docs/design/ui-ux/prototype/app/core-systems-reference.html`

Primary script:

`docs/design/ui-ux/prototype/app/core-systems-reference-ko.js`

Design contract:

`docs/design/ui-ux/EXTENSIBILITY-KOREAN-FIRST.md`

---

## Candidate purpose

This candidate demonstrates two product-wide implementation defaults:

1. user-facing SimpleVTT UI is Korean-first (`ko-KR`);
2. recurring systems use registry/provider/descriptor extension points instead of accumulating hard-coded UI branches.

The existing Owner-accepted Connected Play geometry is not invalidated. This candidate changes/extends system placement and wording around that geometry.

---

## Registry examples in the demo

The prototype intentionally drives the following from data registries:

- scenario list;
- product navigation labels;
- Character Sheet section list;
- Command Center Hotbar pages;
- DM Quick Search provider/result types;
- Party Stash permission-policy presets.

The prototype registries are fixture presentation data, not runtime/domain authority.

---

## Korean-first examples

Visible candidate terminology includes:

```text
홈
캐릭터
세션
콘텐츠
규칙
설정

인벤토리
주문
특성
상태
휴식
파티 보관함
DM 빠른 검색

혼합
행동
주문
아이템
사용자 지정
```

Stable internal IDs remain language-neutral/English slugs where appropriate. Korean labels are presentation data rather than persistence/network identity.

---

## Party Stash extension point

The candidate shows three initial policy presets:

```text
공유 관리
DM 승인형
DM 관리형
```

These do not create three different Party Stash storage models.

They are examples of permission/capability presets layered over one shared Party Stash ownership model. Future policies may be added without rewriting the Party Stash view when the domain permission contract is materialized.

---

## Quick Search extension point

Initial fixture providers:

```text
액터
이미지
아이템
상태
규칙
```

Each provider contributes result metadata and contextual actions. The palette should not need a structural rewrite to add a future provider.

Privacy remains source/provider authoritative: DM-only preparation entries are never sent to Players merely to hide them visually.

---

## Review scenarios

```text
SYS-SCN-00 — 전체 시스템 위치
SYS-SCN-01 — 캐릭터 인벤토리 관리
SYS-SCN-02 — 주문과 특성 관리
SYS-SCN-03 — 플레이어 실시간 사용
SYS-SCN-04 — DM 빠른 검색
SYS-SCN-05 — 파티 보관함과 분배
SYS-SCN-06 — 휴식 미리보기와 적용
SYS-SCN-07 — 상태와 집중 대응
```

---

## Scope guard

This prototype does not authorize UI-owned invention of:

- Party Stash persistence/lifetime;
- arbitrary custom permission semantics;
- Loot ownership transitions;
- rest mechanics;
- condition legality;
- DM Library connected privacy/transport;
- Handout network transfer;
- runtime module/plugin execution.

Those remain Domain/Application/Architecture contracts.

The prototype only establishes a user-facing Korean-first presentation and extensible UI integration pattern.
