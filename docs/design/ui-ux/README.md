# SimpleVTT UI/UX — 사용자 대시보드

현재 **Owner가 직접 답해야 하는 필수 UI/UX 질문은 모두 끝났고**, 실제 runtime UI를 만들기 전에 검토할 **Standalone UI Reference Prototype 후보까지 만들어졌습니다.**

이제 다음 단계는 `src/` 구현이 아니라 **프로토타입을 브라우저에서 보고 자연어로 수정하는 단계**입니다.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **완료 — 0개 남음** |
| 핵심 Product/UX 방향 | **Reviewed** |
| 상세 UI 설계 | AI Design Default + Reference Prototype |
| Reference Prototype specification | **P0 PASS** |
| Standalone HTML prototype | **Review Candidate 생성됨** |
| Static boundary/coverage verification | **PASS** |
| Browser visual/interaction review | **대기** |
| Prototype Owner Acceptance | **아직 안 함** |
| Frozen 결정 | 없음 |
| Runtime `src/` UI 구현 | **아직 승인되지 않음** |

Prototype 시작 문서: [`prototype/README.md`](prototype/README.md)

Prototype HTML entry: [`prototype/app/index.html`](prototype/app/index.html)

Prototype 검토 체크리스트: [`prototype/PROTOTYPE-ACCEPTANCE.md`](prototype/PROTOTYPE-ACCEPTANCE.md)

Canonical Product/UX decisions: [`decisions.md`](decisions.md)

---

# 지금 프로토타입에서 미리 보는 것

현재 Reference Prototype 후보는 실제 backend/rules 없이 mock data만 사용해서 다음을 시각·조작 검토하도록 만들어졌습니다.

- Home / Characters / Session / Content / Rules / Settings
- First Run 안내
- Official-style / SimpleVTT Character Sheet
- 기존 Builder / Level Up reference shell
- Host Setup -> 즉시 Live Session
- Join + Character Select + no-Character 차단
- DM / Player Freeform Play
- DM / Player Initiative
- 위쪽 NPC/적 Actor Board + 아래쪽 Player/아군 Actor Board
- 중앙 Scene/Table
- 아래 고정 Command Center
- Hotbar / Action economy / Resource Rail
- Initiative Tracker
- Targeting / invalid target / multi-target
- Main Hand unavailable + no fallback
- Resolving / Reaction / Concentration / Dice / Result
- Activity public/private / correction history
- Encounter / Participants / Session Share / Player Session
- 고급 DM 거리/시야/엄폐 도구
- Handout Overlay / Upper Scene / Full Scene
- Full Sheet layer
- 우클릭 Actor Context Menu
- Rich hover explanation
- NOTICE / reconnect / error / pending
- 패널 resize / Reset Layout
- Wide / Normal / Narrow desktop
- Reduced Motion
- Component Gallery

Prototype Controls에는 34개 named scenario와 Surface 바로 보기 기능이 있습니다.

---

# 중요한 경계

이 HTML은 **제품 코드가 아닙니다.**

현재 prototype은:

- production `src/` UI를 import하지 않음;
- real backend/network/storage를 사용하지 않음;
- D&D 룰/타게팅/권한을 계산하지 않음;
- fixture가 target valid/unavailable/result 같은 표시값을 직접 제공함;
- Player 화면에서 DM-only mock event의 placeholder를 만들지 않음.

정적 검증 기록: [`prototype/BUILD-VERIFICATION.md`](prototype/BUILD-VERIFICATION.md)

현재 실행 환경에서는 GitHub raw host DNS를 사용할 수 없어 제가 브라우저/Node runtime까지 직접 실행 검증하지는 못했습니다. 따라서 Prototype Acceptance는 아직 PASS가 아니며, 실제 브라우저 검토가 필요합니다.

---

# 이미 확정된 큰 방향

## 제품 / 역할

- Standalone Character Sheet와 Connected VTT는 둘 다 핵심 기능
- Connected: **Host = DM / Client = Player**
- Offline/Standalone에는 DM/Player 역할 없음
- Player는 자신의 Character Actor를 기본 조종
- DM은 추가 Actor 조종권을 줄 수 있고 모든 Actor를 조종 가능
- v1 Spectator / Co-DM / Observer 없음

## 앱 / 메뉴

- 기본 메뉴: **홈 → 캐릭터 → 세션 → 콘텐츠 → 룰 → 설정**
- Product Shell은 상단 메뉴형
- Activity/Encounter/판정수정/세션도구는 contextual tool
- live session 중 `플레이로 돌아가기` 제공
- fresh app launch는 Home
- 첫 실행 별도 안내

## 세션

- 별도 Lobby / Ready / Start Session 없음
- Host가 열면 바로 **live session**
- DM은 같은 live session 안에서 플레이와 준비/편집
- Player는 진행 중 세션에 중간 참가
- Character 없으면 Join 차단 + Create / Import 후 다시 Join

## 플레이

- Scene/Actor + Command Center 공동 핵심
- Command Center 아래 고정
- 적/NPC Actor Board 위, Player/아군 아래
- Initiative는 Actor Boards를 유지하고 상단 tracker 추가
- 자주 쓰는 capability는 직접 노출
- rich hover explanation 적극 사용
- 중요 현재 상태는 NOTICE UI 가능
- 주요 panel은 안전한 범위에서 resize 가능

## DM / Activity / Content

- 새 세션 DM 굴림 기본 Public, 바꾼 값은 live session 동안 유지
- DM Activity는 public/private 한 chronology + 표시/필터
- DM-only secret은 Player에게 전달하지 않는 방향
- 거리/시야/엄폐는 advanced contextual DM tool
- correction/reversal은 원본 기록을 지우지 않음
- 공식 SimpleVTT package format 하나
- add-on install/update/replace/disable/delete 지원
- live session은 open 시 content snapshot 고정

---

# 아직 AI도 임의로 정하지 않는 기술 문제

Prototype은 아래 문제를 mock으로 보여줄 수 있지만 runtime semantics를 해결하지 않습니다.

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION`

이 항목들은 나중 Runtime 준비 전에 Domain/Architecture 계약 또는 문서 reconciliation로 처리합니다.

---

# 이제 Owner가 할 일

Prototype을 보고 평범하게 말하면 됩니다.

예:

- `Command Center가 너무 높아.`
- `이 Actor 카드가 너무 작아.`
- `Activity를 열면 Scene이 너무 좁아져.`
- `DM 도구는 오른쪽에서 열자.`
- `이 정보는 hover 말고 항상 보여줘.`
- `Handout Full에서 아래 UI가 너무 많이 보여.`

AI가 그 피드백을 Design Default / Catalog / Product Decision 중 맞는 곳으로 분류하고 prototype을 다시 맞춥니다.

---

# Runtime으로 가는 순서

```text
현재 Reviewed 방향
-> Standalone Reference Prototype  ← 지금 여기
-> Owner visual/interaction review + 수정
-> Explicit Prototype Acceptance
-> Surface / Component / Motion contract 추출
-> 기술 Gap 해결
-> legacy UX reconciliation
-> 필요한 Product Decision scope Freeze
-> runtime Work Order
-> 별도 runtime 구현 승인
-> src/ UI 구현
```

**따라서 아직 SimpleVTT 실제 UI 구현 단계가 아닙니다.**