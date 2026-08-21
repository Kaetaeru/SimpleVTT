# SimpleVTT UI/UX 선택 워크시트

여기는 **제가 제품을 어떻게 만들지 직접 고르는 곳**입니다.

개발 용어를 몰라도 됩니다. 각 질문마다 보기 중 하나를 고르거나, 마음에 드는 보기가 없으면 `CUSTOM`으로 직접 적으면 됩니다.

## 어떻게 쓰면 되나요?

각 질문은 아래처럼 생겼습니다.

```text
질문: 전투 화면에서 메뉴를 어디에 둘까요?

A — 왼쪽에 둔다.
B — 위쪽에 둔다.
C — 상황에 따라 접히게 한다.
CUSTOM — 내가 직접 정한다.

OWNER SELECT: B
OWNER NOTE: 전투 중에는 작게 접혀 있으면 좋겠음.
```

### 입력할 곳은 딱 두 군데입니다

- `OWNER SELECT` → `A`, `B`, `C`, `CUSTOM` 중 하나를 적습니다.
- `OWNER NOTE` → 추가로 하고 싶은 말이 있으면 자유롭게 적습니다. 비워도 됩니다.

`CUSTOM`을 골랐다면 `OWNER NOTE`에 원하는 모습을 적어주세요.

## 어려운 용어가 나오면 이렇게 생각하면 됩니다

| 문서에서 쓰는 말 | 쉽게 말하면 |
| --- | --- |
| Character | 내가 만든 D&D 캐릭터 |
| Actor | 현재 세션 화면에서 움직이고 조작하는 대상 |
| Product Shell | 홈/캐릭터/설정 등을 오가는 앱의 기본 화면 |
| Play Workspace | 실제 세션을 플레이하는 전용 화면 |
| Command Center | 전투/플레이 화면 아래쪽의 행동 버튼 영역 |
| Actor Board | 캐릭터/적/NPC 카드가 줄지어 보이는 영역 |
| Contextual | 항상 보이는 게 아니라 필요할 때만 나타나는 것 |
| Persistent | 계속 화면에 남아 있는 것 |
| Activity | 지난 판정·행동·변경 기록 |
| Handout | DM이 플레이어에게 보여주는 이미지/자료 |
| Canonical | 게임이 실제 정답으로 인정하는 값 |
| Authority | 누가 보고/조작하고/변경할 권한이 있는지 |
| Reconnect | 연결이 끊긴 뒤 같은 세션으로 다시 연결 |
| Progressive disclosure | 자주 안 쓰는 정보나 도구를 처음부터 다 보여주지 않고 필요할 때 펼치는 방식 |

모르는 단어가 있더라도 **선택지의 실제 결과만 보고 고르면 됩니다.**

## 작성 순서

한 번에 전부 할 필요 없습니다. 위에서 아래로 천천히 작성하면 됩니다.

1. [`01-foundation-navigation-layout.md`](01-foundation-navigation-layout.md) — 화면 구조, 메뉴, 배치, 기본 조작
2. [`02-states-layering-confirmation.md`](02-states-layering-confirmation.md) — 로딩/에러/창/확인창
3. [`03-visual-components-content.md`](03-visual-components-content.md) — 글씨, 색, 아이콘, 버튼, 문구
4. [`04-accessibility-platform.md`](04-accessibility-platform.md) — 키보드 접근성과 화면 폭 변화
5. [`05-dnd-experience.md`](05-dnd-experience.md) — 캐릭터 시트, 주사위, 행동, 전투
6. [`06-session-authority-dm-content.md`](06-session-authority-dm-content.md) — 세션, DM 권한, 판정 수정, 콘텐츠

현재는 **1번 파일의 UX-03부터** 작성하면 됩니다.

## 내가 작성한 뒤에는?

여기 채팅에서 그냥 이렇게 말하면 됩니다.

> 워크시트 반영해

그러면 AI가:

1. 내가 작성한 선택을 읽고,
2. 서로 충돌하는 선택이 있는지만 확인하고,
3. 실제 결정 문서에 옮기고,
4. 관련 문서들을 알아서 정리합니다.

제가 다른 문서를 직접 고칠 필요는 없습니다.

## 중요한 점

- 보기 A/B/C는 **예시 후보**일 뿐입니다. 마음에 안 들면 언제든 `CUSTOM`을 쓰면 됩니다.
- 빈 질문은 그냥 넘어가도 됩니다.
- 이미 확정된 결정과 충돌하면 AI가 그 부분만 알려줍니다.
- 이 파일에 답을 적는 것만으로 코드가 자동 구현되지는 않습니다.
- `AI STATUS` 같은 내부 표시는 화면에서 최대한 숨겨두며 AI가 관리합니다.

기술적인 원본 질문 ID와 순서는 [`../review-plan.md`](../review-plan.md)에 유지됩니다. 실제 확정된 제품 결정은 [`../decisions.md`](../decisions.md)에 정리됩니다.
