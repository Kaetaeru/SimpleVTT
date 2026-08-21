# SimpleVTT UI/UX — 사용자 대시보드

현재 Owner가 직접 답해야 하는 필수 UI/UX 질문은 모두 끝났습니다.

실제 runtime `src/` UI를 만들기 전 단계로 **Final-Spec UI Reference Demo**를 검토하고 있습니다.

첫 번째 HTML 후보는 Owner 검토에서 탈락했습니다. 이유는 이미 정한 UX를 두 군데에서 어겼기 때문입니다:

1. Offline/Standalone 주사위를 현재 Character Sheet 안에서 굴리지 않고 detached roll surface처럼 표현함.
2. Connected Session Play를 이미 정한 Actor Board + Scene + Command Center 구조보다 느슨하게 재해석함.

이 두 문제를 기준부터 다시 확인해 새 Final-Spec demo로 교체했습니다.

---

# 현재 상태

| 항목 | 상태 |
| --- | --- |
| Meta governance | **Stable v1** |
| Global Planning Gate | **PASS** |
| Owner 필수 질문 | **완료 — 0개 남음** |
| 핵심 Product/UX 방향 | **Reviewed** |
| 첫 Prototype 후보 | **Rejected / Superseded** |
| Final-Spec replacement | **Review Candidate 생성됨** |
| Final-Spec static structural verification | **PASS** |
| Browser visual/interaction review | **대기** |
| Prototype Owner Acceptance | **아직 안 함** |
| Frozen 결정 | 없음 |
| Runtime `src/` UI 구현 | **아직 승인되지 않음** |

## 지금 열어볼 파일

**현재 유일한 review entry:**

```text
docs/design/ui-ux/prototype/app/final-spec.html
```

Prototype 설명: [`prototype/README.md`](prototype/README.md)

Owner 교정사항: [`prototype/OWNER-CORRECTIONS.md`](prototype/OWNER-CORRECTIONS.md)

Final-Spec 검증: [`prototype/FINAL-SPEC-VERIFICATION.md`](prototype/FINAL-SPEC-VERIFICATION.md)

검토 체크리스트: [`prototype/PROTOTYPE-ACCEPTANCE.md`](prototype/PROTOTYPE-ACCEPTANCE.md)

Canonical Product/UX decisions: [`decisions.md`](decisions.md)

---

# 이번 교정에서 가장 중요한 두 규칙

## 1. Offline / Standalone 주사위

**어떤 주사위를 굴려도 현재 Character Sheet를 떠나지 않습니다.**

예:

- 능력치/Skill 체크
- Save
- Attack
- Damage
- Feature roll
- 그 외 Standalone Character Sheet에서 시작하는 모든 일반 roll

흐름:

```text
현재 Character Sheet
-> Roll 클릭
-> 같은 Sheet 내부 Roll Plane에서 주사위가 굴러감
-> far/back -> near/front -> impact/roll -> settle
-> 같은 Sheet 안에서 결과 확인
-> 그대로 Sheet 사용 계속
```

금지:

- 별도 modal
- 별도 drawer
- 별도 결과창/card
- 별도 route/screen
- roll이 끝난 뒤 돌아가기/닫기를 눌러야 하는 흐름

새 Final-Spec demo는 이 구조로 다시 작성했습니다.

## 2. Connected Session Play

Play의 구조는 자유 해석 대상이 아닙니다.

```text
Compact Play chrome / session status
────────────────────────────────────
상단 NPC / Neutral / Hostile Actor Board
────────────────────────────────────
중앙 Scene / Table Context       [필요할 때 side utility pane]
  └ Initiative Tracker = Scene 상단 edge overlay
  └ Dice = 중앙 Scene/Table에서 굴림
  └ NOTICE / 즉시 Result = Scene 안에서 표시
────────────────────────────────────
하단 Player / Allied Actor Board
────────────────────────────────────
고정 BG3-family Command Center
  ├ 상단 작은 줄: Action / Bonus / Reaction / Movement + Resource Rail
  ├ 좌하단: Controlled Actor 상태
  └ 우하단 큰 영역: Hotbar / Actions / contextual Execute·End Turn·Cancel
```

- Scene/Actor와 Command Center는 공동 핵심입니다.
- Actor Board를 side portrait rail로 바꾸지 않습니다.
- Initiative가 별도 전투 화면을 만들지 않습니다.
- Activity/Encounter/Participants/Session/Advanced DM 도구는 side pane/contextual UI입니다.
- DM과 Player는 같은 Play skeleton을 씁니다.
- Targeting 중에도 모든 Actor Card를 유지합니다.
- Single valid target은 바로 submit, Multi는 Execute.
- Main Hand가 unavailable이면 다른 행동으로 smart fallback하지 않습니다.
- Resolution/Dice/Result 중에도 Command Center를 없애지 않습니다.

---

# Final-Spec demo에서 확인 가능한 것

현재 replacement demo에는 다음 reference가 들어 있습니다.

- Home
- Character Library
- Official-style Character Sheet
- SimpleVTT Character Sheet
- Standalone same-Sheet Skill/Save/Attack/Damage rolls
- Session Host / Join / no-Character block
- Content / Rules / Settings
- DM / Player Freeform
- DM / Player Initiative
- 상단 적/NPC Actor Board
- 중앙 Scene/Table + Actor tokens
- 하단 Player/아군 Actor Board
- Persistent Command Center
- Hotbar pages
- Action economy / Resource Rail
- Target valid / invalid / selected
- Single-target / Multi-target Execute
- Main Hand fixture behavior / no smart fallback
- Scene dice / Result
- DM/Public Activity filtering
- Player에서 DM-only placeholder 없음
- Encounter / Participants / Session / Advanced spatial side pane
- Handout Overlay / Upper / Full
- Actor right-click context menu
- Hover/focus explanation
- NOTICE / reconnect examples
- Wide / Normal / Narrow desktop
- Reduced Motion
- Component Gallery

Prototype 데이터는 모두 fixture입니다. 룰/권한/네트워크를 실제 계산하지 않습니다.

---

# 아직 해결하지 않는 기술 문제

Prototype은 아래를 모양으로만 보여줄 수 있고 runtime 계약을 해결하지 않습니다.

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION`

---

# 앞으로 순서

```text
Final-Spec Reference Demo  ← 지금 여기
-> Owner browser review + 수정
-> Explicit Prototype Acceptance
-> 이번 Owner correction을 canonical runtime planning으로 reconciliation
-> Surface / Component / Motion contract 추출
-> 기술 Gap 해결
-> legacy UX reconciliation
-> 필요한 scope만 Freeze
-> runtime Work Order
-> 별도 runtime 구현 승인
-> 그제서야 src/ UI 구현
```

**아직 실제 SimpleVTT runtime UI 구현 단계가 아닙니다.**
