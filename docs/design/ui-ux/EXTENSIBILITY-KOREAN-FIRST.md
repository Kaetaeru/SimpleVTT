# SimpleVTT UI/UX — 확장 가능 구조 + 한국어 우선 기준

Status: **OWNER-DIRECT REVIEWED PRODUCT DIRECTION — ACTIVE DESIGN CONTRACT**

Owner direction:

> 일단 뭐든 나중에 추가할수있는 방식으로 소프트 코딩하고 일단 제작을 계속하는게 맞을것같아. 그리고 전체적으로 한국어 기준으로 제작되어야해.

이 문서는 현재 Core Systems / DM Library / Connected Play 후보를 포함해 앞으로 추가되는 사용자-facing 시스템의 공통 구현 기준을 정의한다.

---

# 1. 기본 원칙

SimpleVTT는 기능 종류를 UI 컴포넌트 내부의 고정 분기와 문자열 배열로 늘리지 않는다.

기본 구조는 다음을 우선한다.

```text
stable internal identity
        +
registered capability/provider/descriptor
        +
localized presentation metadata
        ↓
shared UI renderer
```

새로운 시스템, 룰셋, 아이템 종류, 검색 결과 타입, 상태, 보관 정책 등이 추가될 때 가능한 한 기존 화면 코드를 다시 작성하지 않고 **등록 데이터/프로바이더/규칙 프로필을 추가하는 방식**으로 확장한다.

단, "소프트 코딩"은 모든 것을 무타입 JSON으로 처리한다는 뜻이 아니다.

- Domain/Application 계약은 명시적 타입과 검증을 유지한다.
- 확장 지점은 stable ID와 capability 계약을 가진다.
- 지원하지 않는 동작은 명시적으로 표시한다.
- UI가 임의의 규칙을 추론하지 않는다.

---

# 2. 한국어 우선 UI

## 2.1 사용자-facing 기본 언어

v1의 기본 제품 UI와 공식 데모/프로토타입은 **한국어(`ko-KR`)를 기준**으로 제작한다.

기본적으로 한국어여야 하는 항목:

- 전역 내비게이션;
- 버튼/메뉴/탭;
- 시스템 이름;
- 상태/오류/안내 문구;
- 접근성 라벨;
- 튜토리얼;
- Character/Session/DM 도구의 제품 문구;
- 기본 RulesProfile에서 제공하는 표시명.

고유명사, 사용자가 직접 작성한 이름, 외부 콘텐츠 원문 이름은 강제로 번역하지 않는다.

## 2.2 내부 ID와 표시 문자열을 분리

내부 안정 ID를 한국어 문자열로 만들지 않는다.

예:

```text
internal id: party_stash
locale key: session.partyStash.title
ko-KR: 파티 보관함

internal id: quick.actor.addOne
locale key: quick.actor.addOne
ko-KR: +1 추가
```

이렇게 하면 추후 영어/일본어 등 다른 언어를 추가해도 저장 데이터, 네트워크 계약, 모듈 ID를 바꿀 필요가 없다.

## 2.3 문자열 규칙

React/JSX/HTML 렌더 함수 안에 제품 문구를 무분별하게 직접 박아 넣지 않는다.

권장:

```text
uiText("inventory.title")
uiText("quick.image.reveal")
uiText("party.permission.shared")
```

프로토타입도 가능한 범위에서 동일한 localization resource/registry 문법을 모사한다.

필요한 fallback은 명시적으로 정의한다. 기본 제품에서 번역 누락이 발생하면 조용히 이상한 혼합 언어 화면을 만드는 것보다 개발/검증에서 발견 가능해야 한다.

---

# 3. 시스템 등록형 구조

UI의 큰 역할은 기존 Core Systems UX의 네 가지 역할을 유지한다.

```text
관리
사용
상태
빠른 검색
```

각 하위 시스템은 다음과 같은 descriptor를 통해 참여할 수 있다.

```text
SystemPresentationDescriptor
- id
- labelKey
- iconKey / visual token
- managementSurface?
- liveCapabilityProvider?
- statusProvider?
- quickSearchProvider?
- requiredCapabilities[]
- visibilityPolicy
- priority/order metadata
```

Inventory, Spellbook, Features, Conditions, Rest, Party Stash가 각각 완전히 다른 navigation/renderer를 소유하는 구조를 피한다.

---

# 4. Character Sheet 섹션

Character Sheet의 섹션 순서를 컴포넌트 내부 고정 버튼 목록으로만 만들지 않는다.

예상 등록 항목:

```text
개요
인벤토리
주문
특성
상태
```

향후 룰 프로필이나 기능에 따라 다음과 같은 섹션/서브섹션이 추가될 수 있어야 한다.

```text
제작
동료
차량
추가 자원
홈브루 전용 기록
```

섹션이 추가되더라도 Character canonical state와 UI presentation state의 경계는 유지한다.

---

# 5. 인벤토리

인벤토리의 카테고리를 `if (weapon)`, `if (potion)` 식으로 화면에 고정하지 않는다.

ItemDefinition / ItemInstance / RulesProfile가 제공하는 metadata/capability로 다음을 구성한다.

- 표시 그룹;
- 장착/활성화 상태;
- 수량/충전량;
- 컨테이너 관계;
- 실행 가능한 Action;
- 전달/이동 가능 여부;
- 세션 전용/영구 소유 lifetime.

기본 한국어 그룹 예시는 다음과 같지만 고정 taxonomy가 아니다.

```text
장착/활성
소모품
보관함
마법/기타
```

새 아이템 타입 때문에 Inventory React 컴포넌트에 새 전용 분기를 추가하는 것이 기본 확장 방식이 되어서는 안 된다.

---

# 6. 빠른 검색 / 명령 팔레트

빠른 검색은 source별 거대한 switch가 아니라 provider registry를 사용한다.

예:

```text
QuickProvider
- providerId
- search(query, context)
- resultType
- resultLabelKey
- resultIcon
- allowedRole/context
- actions(result, context)
- privacy/delivery contract
```

초기 provider 예시:

```text
actor
image
item
condition
rule
```

향후 추가 가능한 예시:

```text
spell
feature
table
macro-like declarative action
journal/note
sound/presentation asset
```

새 provider를 추가해도 Quick Palette 자체의 layout/event model을 재작성하지 않는 것이 목표다.

각 결과가 제공하는 action 역시 label/action descriptor로 렌더한다.

```text
액터: +1 추가 / 더 보기
이미지: 미리보기 / 공개
아이템: 지급 / 파티 보관함
상태: 적용
규칙: 열기
```

DM-only source는 provider 수준에서 Player에게 전달되지 않아야 하며 CSS 숨김으로 해결하지 않는다.

---

# 7. 파티 보관함

Party Stash의 storage/ownership 모델과 운영 권한 정책을 분리한다.

```text
Party Stash data
= 공동 소유 inventory state

Party Stash policy
= 누가 열람/입고/출고/지급/승인할 수 있는가
```

권한 정책은 고정된 세 개 if문으로 만들지 않고 policy descriptor/capability matrix로 표현한다.

초기 UX 후보:

```text
shared
- 플레이어 열람
- 플레이어 입고
- 플레이어 출고
- DM 전체 관리

approval
- 플레이어 열람
- 플레이어 입고
- 출고 요청
- DM 승인/거절

managed
- 플레이어 열람
- DM 입고/출고/지급
```

이 세 가지는 **초기 preset**일 뿐, 저장 구조 자체가 세 종류로 갈라져서는 안 된다.

향후 캠페인별 커스텀 정책이나 추가 permission을 지원할 수 있도록 capability set으로 저장/해석한다.

아직 Player가 모르는 전리품/비밀 보상은 Party Stash에 숨겨 놓는 방식으로 구현하지 않는다. 비공개 준비/획득 후보와 공동 소유 확정 상태를 분리해야 한다.

---

# 8. 전리품 흐름

향후 전리품 시스템은 다음 lifetime 전환을 지원할 수 있어야 한다.

```text
Content 정의
    ↓
DM 준비 / 보상 후보
    ↓ 획득 확정
Party Stash
    ↓ 분배
Character Inventory
```

각 이동은 검증 가능한 transaction/event로 표현하고 Activity/Undo와 연결 가능해야 한다.

Loot UI 자체는 domain 계약이 준비되기 전까지 prototype 제안으로만 유지한다.

---

# 9. 휴식 / 상태 / 기타 공식 시스템

Short Rest / Long Rest를 UI가 이름으로 special-case하지 않는다.

```text
RestActivityDescriptor
- id
- labelKey
- eligibility
- preview provider
- choice descriptors
- commit command
```

Condition/Effect도 이름별 UI 분기 대신 presentation metadata를 사용한다.

```text
StatusPresentation
- source identity
- labelKey/display name
- severity/presentation priority
- compact badge presentation
- detail projection
- response capability when required
```

향후 다른 룰셋의 휴식/상태 시스템을 추가해도 기존 화면 구조를 재작성하지 않는 것을 목표로 한다.

---

# 10. UI 확장성에서 금지하는 패턴

다음은 새 코드의 기본 패턴으로 사용하지 않는다.

```text
if item.name === "Potion of Healing"
if condition.name === "Poisoned"
if rulesProfile === "DND2024" then render totally separate app
switch quickType with every future content type hard-coded in palette component
English label text used as identity or persistence key
Player/DM privacy implemented by rendering everything then CSS display:none
```

필요한 explicit branching은 capability/authority/domain semantics에 근거해야 한다.

---

# 11. 현재 프로토타입 적용 기준

`core-systems-reference.html` 후보는 다음 방향으로 갱신한다.

1. 사용자-facing 문구를 한국어 우선으로 전환한다.
2. 시나리오 목록과 Hotbar/Quick 결과를 registry 데이터에서 렌더한다.
3. Quick 결과 타입/action을 provider-like fixture registry로 표현한다.
4. Party Stash는 한국어 `파티 보관함`으로 표시한다.
5. Party Stash policy는 데이터-driven preset 예시로 보여주되 domain authority로 가장하지 않는다.
6. 현재 fixture는 설계 검토용이며 실제 규칙/소유권 authority가 아니다.

---

# 12. 구현 순서

앞으로 기능을 만들 때 우선 순서는 다음과 같다.

```text
1. Domain/Application capability contract
2. stable IDs + validation
3. registry/provider/descriptor extension point
4. ko-KR presentation resource
5. shared renderer / interaction grammar
6. tests: 신규 등록 항목이 중앙 UI 수정 없이 나타나는지
7. privacy/lifetime/authority regression
```

목표는 "처음부터 모든 미래 기능을 예측"하는 것이 아니다.

목표는 **새 기능을 추가할 때 기존 핵심 화면을 갈아엎지 않아도 되는 경계와 확장 지점을 지금부터 유지하는 것**이다.
