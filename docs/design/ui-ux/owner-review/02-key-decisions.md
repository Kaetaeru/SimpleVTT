# 2. 핵심 Owner 결정 — 처리 완료

**처리 상태: 완료**

이 파일의 선택은 `decisions.md`에 Reviewed 결정으로 반영되었습니다. 현재 남은 필수 Owner Checkpoint는 없습니다.

> 이후에는 AI가 `OWNER-CONTROL-POLICY.md`에 따라 세부 UX를 정리하고, 제품 사용법을 크게 바꾸는 새 선택이 생길 때만 다시 Owner에게 묻습니다.

---

## 작성된 선택 요약

| # | Decision ID | 선택 | 결과 |
| ---: | --- | --- | --- |
| 1 | `PLATFORM-01-01` | A | v1은 wide/normal/narrow 데스크톱 창 지원; mobile/touch-first 제외 |
| 2 | `SES-01-04` | C | Character 없으면 Join 차단 + Create/Import 후 다시 Join |
| 3 | `SES-01-02` | CUSTOM | 별도 Lobby/Ready 없이 Host가 열면 즉시 live session; 중간 참가 가능 |
| 4 | `DM-01-01` | A | 새 세션 DM 굴림 기본 Public; 변경값은 그 live session 동안만 유지 |
| 5 | `DM-02-01` | C | DM Activity 한 타임라인 + public/private 표시와 필터 |
| 6 | `DM-01-03` | C | 거리/시야/엄폐 수동 편집은 고급 DM 도구로 유지 |
| 7 | `DM-02-05` | C | 과거 기록 삭제 금지; correction/reversal 기록 추가 |
| 8 | `CONTENT-02-04` | A | v1 공식 SimpleVTT package format 하나 지원 |
| 9 | `CONTENT-02-09` | A | install/update/replace/disable/delete 전체 lifecycle를 v1 capability로 포함 |
| 10 | `CONTENT-02-11` | C | 세션 시작 시 content snapshot 고정; 변경은 다음 세션에 적용 |

### 3번 CUSTOM 원문

> 따로 기다리는 창을 만들지 말고, 호스트가 세션을 열면 바로 플레이와 편집 동시에 가능한 세션이 열리게 하자. 중간참여식으로 참여가능하게 하고

저장된 문장이 `하고`에서 끝났지만, 앞부분만으로 확정 가능한 최소 의미만 반영했습니다:

- 별도 Host/Player Lobby/Ready 단계 없음
- Host가 세션을 열면 즉시 live session
- DM은 같은 live session에서 플레이와 준비/편집 가능
- Player는 이미 열린 session에 중간 참가 가능

그 뒤의 미완성 문구에서 추가 행동을 추측하지 않았습니다.

---

# 원본 선택지 기록

<!-- CHECKPOINT ID: PLATFORM-01-01 -->
## 1. 어떤 화면 크기까지 공식 지원할까?

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: SES-01-04 -->
## 2. 캐릭터가 하나도 없는데 세션 참가를 누르면?

**OWNER SELECT:** `C`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: SES-01-02 -->
## 3. DM은 플레이어들이 준비되지 않아도 세션을 시작할 수 있을까?

**OWNER SELECT:** `CUSTOM`

**OWNER NOTE:** `따로 기다리는 창을 만들지 말고, 호스트가 세션을 열면 바로 플레이와 편집 동시에 가능한 세션이 열리게 하자. 중간참여식으로 참여가능하게 하고 `

---

<!-- CHECKPOINT ID: DM-01-01 -->
## 4. DM 굴림은 기본적으로 공개일까, 비공개일까?

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: DM-02-01 -->
## 5. DM만 볼 수 있는 비공개 굴림 기록은 어디에 둘까?

**OWNER SELECT:** `C`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: DM-01-03 -->
## 6. DM의 거리/시야/엄폐 직접 편집 도구를 v1에 넣을까?

**OWNER SELECT:** `C`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: DM-02-05 -->
## 7. DM의 `되돌리기`는 실제 과거 기록을 지워도 될까?

**OWNER SELECT:** `C`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: CONTENT-02-04 -->
## 8. 애드온/콘텐츠 파일은 어떤 형식을 공식 지원할까?

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: CONTENT-02-09 -->
## 9. 애드온은 설치한 뒤 어디까지 관리할 수 있게 할까?

**OWNER SELECT:** `A`

**OWNER NOTE:** ``

---

<!-- CHECKPOINT ID: CONTENT-02-11 -->
## 10. 세션 진행 중에 콘텐츠 구성을 바꿀 수 있을까?

**OWNER SELECT:** `C`

**OWNER NOTE:** ``

---

# 다음 단계

Owner가 추가로 작성할 필수 워크시트는 없습니다.

AI가 다음을 진행합니다:

1. 상세 Decision Map의 저위험 항목을 AI Design Default/contract로 정리
2. 남은 Domain/Architecture Gap 해결
3. legacy planning 문서와 Reviewed 방향 reconciliation
4. 구현 준비 시 필요한 Surface/Component/Motion contract와 Work Order 작성

**이 파일의 완료는 Freeze나 구현 승인이 아닙니다.**
