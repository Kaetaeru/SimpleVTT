# SimpleVTT UI/UX — 사용자 대시보드

여기서는 **SimpleVTT 사용법을 크게 바꾸는 결정만** 직접 고릅니다.

예전처럼 수백 개의 세부 UI 질문을 하나씩 답할 필요는 없습니다.

---

# 지금 할 일

첫 번째 큰 설계 묶음은 모두 정리됐습니다.

이제 남은 사용자 결정은 **핵심 10개**입니다.

➡️ [`owner-review/02-key-decisions.md`](owner-review/02-key-decisions.md)

가장 쉬운 방법은 파일 맨 위에:

```text
전체 추천안 사용: YES
```

만 적는 것입니다.

그러면 AI 추천안을 전부 사용하고, 마음에 안 드는 질문만 따로 바꾸면 됩니다.

---

# 지금까지 정리된 것

## 제품의 큰 방향

- Standalone 캐릭터 시트와 Connected VTT는 둘 다 핵심 기능
- Connected에서는 Host=DM, Client=Player
- Offline/Standalone에는 DM/Player 역할 없음
- Player는 자신의 Character Actor를 기본 조종
- DM은 추가 Actor 조종권을 줄 수 있고 모든 Actor를 조종 가능
- v1 추가 역할(Spectator/Co-DM 등) 없음

## 앱/메뉴

- 기본 메뉴: **홈 → 캐릭터 → 세션 → 콘텐츠 → 룰 → 설정**
- Product Shell은 **상단 메뉴형**
- Activity/Encounter/판정수정/세션도구는 기본 메뉴가 아니라 필요할 때 여는 도구
- 라이브 세션 중에는 `플레이로 돌아가기`가 항상 보임
- 앱을 완전히 종료했다 다시 켜면 자동 복귀하지 않고 **Home에서 시작**
- 첫 실행은 별도 튜토리얼/안내 화면

## 플레이 화면

- Scene/Actor + Command Center + 현재 턴/상태를 가장 중요하게 표시
- Command Center는 화면 아래 고정
- BG3 계열 구성: 위쪽 작은 행동자원 줄 + 왼쪽 캐릭터 상태 + 오른쪽 행동버튼
- 적/NPC Actor Board는 위, Player/아군 Board는 아래
- 카드가 최소 크기보다 작아질 상황이면 가로 스크롤
- Initiative Tracker는 장면 위쪽에 겹쳐 표시하되 중요한 장면을 가리지 않음
- 세션/DM 부가도구는 좌우 Side Pane
- 큰 영역은 필요하면 독립 스크롤 가능
- 사용자가 안전한 범위에서 플레이 영역/패널 크기를 조절 가능

## 캐릭터

- Character Library가 캐릭터 관리의 중심
- **Official-style 시트 + SimpleVTT 시트**를 선택 가능
- 첫 튜토리얼에서 기본 시트 스타일 선택
- SimpleVTT 시트는 UX를 우선해서 새로 설계
- 현재 Character 생성/Level Up UI는 그대로 유지

## 기본 조작

- 타겟팅 중이면 대상 선택 클릭이 최우선
- DM은 별도 조종 모드에서 Actor 제어
- Actor 우클릭 메뉴는 `자세히/정보/관리` 같은 UI 기능만 사용
- 공격/주문/아이템 같은 실제 게임 행동은 우클릭 메뉴에 넣지 않음
- v1에서는 Actor 우클릭 메뉴를 여는 키보드 단축키는 제공하지 않음
- Esc는 행동/타겟팅 취소를 먼저 처리
- 자주 쓰는 행동은 가능한 한 직접 보이게 함
- 사용불가 이유는 호버/포커스 설명을 기본으로 하고 중요한 막힘은 직접 표시
- 중요한 현재 상태를 별도 **NOTICE UI**에서도 계속 보여줌
- 설명/세부정보는 마우스 호버 시 가벼운 따라오는 설명 프레임을 적극 활용

이 내용은 [`decisions.md`](decisions.md)에 Reviewed 결정으로 정리되어 있습니다. **Frozen은 아닙니다.**

---

# 앞으로 직접 고를 것은 왜 10개뿐인가?

새 규칙은 간단합니다.

### 직접 묻는 것

- 제품 사용 흐름을 크게 바꾸는 것
- 기능을 넣을지 뺄지
- DM/Player 권한이나 비밀정보
- 되돌리기/데이터 손실처럼 결과가 큰 것
- 플랫폼 범위처럼 개발 범위가 크게 달라지는 것

### AI가 알아서 정하는 것

- 글씨 크기/여백
- 버튼/아이콘 스타일
- 평범한 Hover/Focus/Pressed 상태
- 일반적인 로딩/오류/빈 화면
- 반응형 세부 배치
- 패널 내부 정렬
- 일반 확인창/문구
- 컴포넌트 세부 구조
- 애니메이션 세부 타이밍
- 접근성의 일반적인 좋은 관행

단, AI가 정하는 세부사항이라도 **실제 사용법이 크게 달라지는 선택으로 커지면 그때만 다시 사용자에게 올립니다.**

기준: [`OWNER-CONTROL-POLICY.md`](OWNER-CONTROL-POLICY.md)

---

# AI도 추측하지 않는 것

다음은 사용자 취향이 아니라 기술적으로 정확해야 해서 별도 계약으로 해결합니다.

- D&D 룰 계산/공격 가능 여부
- 주 손 기본공격의 canonical relation
- 판정 중 어떤 authoritative command가 동시에 안전한지
- DM 비밀 데이터 전송
- Handout 공유/재연결 네트워크 상태
- 저장/스키마/보안

---

# 현재 진행상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | Stable v1 |
| Global Planning Gate | PASS |
| UX-01 | Reviewed |
| UX-02 | Reviewed |
| UX-03 | Reviewed |
| NAV-01 | Reviewed |
| UI-01 | Reviewed |
| INT-01 | Reviewed |
| 첫 번째 Owner Worksheet | **완료 및 반영됨** |
| 남은 Owner Checkpoints | **10개** |
| 상세 UI 질문 | AI 내부 coverage/default 대상으로 전환 |
| 구현 | 아직 승인되지 않음 |

## 아직 Owner가 직접 정할 큰 항목

[`owner-review/02-key-decisions.md`](owner-review/02-key-decisions.md)에만 있습니다.

1. 공식 지원 화면 크기 범위
2. Character 없는 Join
3. 준비 안 된 Player가 있을 때 Host Start
4. DM 굴림 Public/DM Only 기본값
5. DM 비공개 Activity 표시
6. 거리/시야/엄폐 고급 DM 도구
7. Undo/판정수정 기록 방식
8. 공식 Add-on 파일 형식
9. Add-on lifecycle 범위
10. Live Session 중 Content 변경

---

# 아직 남은 기술/계약 문제

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS` — 이제 Owner 질문이 아니라 Domain contract 문제
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION` — legacy planning reconciliation

Owner Checkpoint로 남아 있는 Gap은 핵심 10개 파일에 포함되어 있습니다.

---

# 다음 사용법

핵심 10개를 직접 고른 뒤:

> **핵심 결정 반영해**

라고 하면 됩니다.

또는 추천이 전반적으로 마음에 들면:

> **추천안 전체로 가자**

라고 해도 됩니다.

그 뒤에는 AI가 나머지 세부 UX를 정리하고, 사용자 판단이 정말 필요한 큰 선택이 생길 때만 다시 질문합니다.
