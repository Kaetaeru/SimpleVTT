# SimpleVTT UI/UX 설계 — 사용자 대시보드

여기서는 **SimpleVTT의 화면과 사용법을 하나씩 결정**합니다.

개발 문서를 직접 관리할 필요는 없습니다. 아래 워크시트에서 원하는 보기를 고르고, 다 작성한 뒤 ChatGPT에 `워크시트 반영해`라고 말하면 됩니다.

## 지금 할 일

현재는 **1번 워크시트**를 작성하고 있습니다.

➡️ [`owner-review/01-foundation-navigation-layout.md`](owner-review/01-foundation-navigation-layout.md)

여기에는 다음 내용이 들어 있습니다.

- 화면에서 무엇을 가장 중요하게 보여줄지
- 기본 메뉴 구조
- 캐릭터/세션 화면 이동
- 플레이 화면의 큰 배치
- 마우스/키보드 기본 조작

이미 작성한 답은 그대로 보존되어 있고, **아직 실제 제품 결정 문서에는 반영하지 않았습니다.**

## 작성 방법

질문마다 아래 두 칸만 보면 됩니다.

```text
OWNER SELECT: A
OWNER NOTE: 필요하면 추가 의견 작성
```

- `A / B / C` → 마음에 드는 보기 선택
- `CUSTOM` → 보기 대신 원하는 방식을 직접 작성
- `OWNER NOTE` → 추가 설명이 있으면 자유롭게 작성
- 모르는 질문 → 그냥 비워두기

내부 AI 처리상태는 주석으로 숨겨져 있으므로 신경 쓰지 않아도 됩니다.

## 전체 워크시트

1. [`01-foundation-navigation-layout.md`](owner-review/01-foundation-navigation-layout.md) — **화면 구조 / 메뉴 / 배치 / 기본 조작**
2. [`02-states-layering-confirmation.md`](owner-review/02-states-layering-confirmation.md) — **로딩 / 오류 / 창 겹침 / 확인창**
3. [`03-visual-components-content.md`](owner-review/03-visual-components-content.md) — **글씨 / 색 / 아이콘 / 버튼 / 문구**
4. [`04-accessibility-platform.md`](owner-review/04-accessibility-platform.md) — **키보드 접근성 / 좁은 화면 대응**
5. [`05-dnd-experience.md`](owner-review/05-dnd-experience.md) — **캐릭터 / 주사위 / 행동 / 전투**
6. [`06-session-authority-dm-content.md`](owner-review/06-session-authority-dm-content.md) — **세션 / DM 권한 / 판정 수정 / 콘텐츠**

처음 안내가 필요하면 [`owner-review/README.md`](owner-review/README.md)를 보면 됩니다.

## 작성이 끝나면

ChatGPT에 한마디만 하면 됩니다.

> **워크시트 반영해**

그러면 AI가 자동으로:

1. 작성한 답을 읽고,
2. 서로 충돌하는 답이 있는지 확인하고,
3. 확정된 내용을 정식 결정 문서에 옮기고,
4. 관련 설계 문서를 맞춰 정리하고,
5. 아직 답하지 않은 질문은 그대로 남깁니다.

제가 다른 설계 문서를 직접 수정할 필요는 없습니다.

## 현재 진행상태

| 항목 | 상태 |
| --- | --- |
| 전체 UI/UX 질문 목록 | 준비 완료 |
| 전체 화면/기능 누락 조사 | 완료 |
| UX-01 — 제품의 큰 방향 | 검토 완료 |
| UX-02 — DM/플레이어 역할과 조작권 | 검토 완료 |
| UX-03 — 정보 우선순위 | **워크시트 입력 중** |
| 그 이후 설계 질문 | 워크시트 준비 완료 |
| 실제 UI 구현 | 아직 시작하지 않음 |

### 이미 정해진 역할 원칙

- 연결 세션에서 **Host는 항상 DM**입니다.
- 연결 세션에서 **Client는 항상 Player**입니다.
- 혼자 사용하는 Offline/Standalone에는 DM/Player 역할이 없습니다.
- 플레이어는 자신의 캐릭터 Actor를 기본적으로 조종합니다.
- DM은 필요하면 플레이어에게 추가 Actor 조종권을 줄 수 있습니다.
- DM은 모든 Actor를 조종할 수 있습니다.
- 세션 도중 DM과 Player 역할을 서로 바꾸지는 않습니다.
- v1에는 Spectator / Co-DM / Observer 역할을 넣지 않습니다.
- DM전용 비밀정보는 플레이어에게 보내놓고 숨기는 방식이 아니라, **애초에 플레이어에게 전달하지 않는 방식**을 유지합니다.

이 결정들은 검토된 제품 방향이지만 아직 `Frozen` 상태는 아니며, 이것만으로 구현을 시작하지 않습니다.

## 아직 나중에 해결해야 하는 큰 문제

아래는 질문을 잘못 만든 것이 아니라, 별도 규칙/구현 계약이 필요한 부분입니다.

- 캐릭터가 하나도 없는 플레이어가 세션 참가를 누르면 어떻게 할지
- 적을 그냥 클릭했을 때 사용할 `주 손 기본공격`을 시스템이 어떻게 정확히 알려줄지
- DM전용 굴림의 기본 공개상태와 저장범위
- Actor 우클릭 메뉴의 최종 기능 목록
- 판정 진행 중 어떤 조작까지 안전하게 허용할지
- Handout 공유/재연결 구조
- DM전용 비밀 판정 데이터를 플레이어에게 전혀 보내지 않는 네트워크 구조
- DM Activity에서 비공개 기록을 보여주는 최종 방식

이런 것은 해당 워크시트와 기술 계약 단계에서 하나씩 해결합니다.

## 참고: AI용 문서

아래 문서들은 주로 AI가 사용하는 내부 설계 문서입니다. **직접 읽거나 수정할 필요 없습니다.**

- [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md)
- [`MANIFEST.yaml`](MANIFEST.yaml)
- [`PREFLIGHT.md`](PREFLIGHT.md)
- [`review-plan.md`](review-plan.md)
- [`decisions.md`](decisions.md)
- [`registry.md`](registry.md)
- [`matrices.md`](matrices.md)
- [`planning-gaps.md`](planning-gaps.md)

원하는 UI/UX를 결정할 때는 기본적으로 **`owner-review/` 폴더만 보면 됩니다.**
