# 새 클라이언트 — 전면 재작성 계획 (V3)

- 상태: **착수 (2026-09-14)**. 소유자 지시: "모든 부분을 전면적으로 새로 만든다는 느낌으로. 멀티세션은 나중으로 미루고, 캐릭터 시트를 완벽하게 생성 가능하게. JSON도."
- 캐릭터 모델은 [캐릭터 시스템 재설계](../v2/CHARACTER_SYSTEM.md) §4(원본 · 계산 · 사용량)를 그대로 쓴다. 이 문서는 그 위에 "무엇으로 어떻게 구동하고, 어떤 순서로 만드는가"를 정한다.
- 기존 `src/`(옛 앱, V2 테이블 포함)는 손대지 않고 그대로 둔다. 새 클라이언트가 같은 기능을 덮을 때마다 옛 화면을 퇴역시킨다.

## 1. 구동 방식 — 결정

**웹 우선 + Tauri 셸.**

- 새 클라이언트는 표준 웹 앱(Vite + React 19 + TypeScript)이고 **브라우저만으로 전 기능이 돈다**: 저장은 IndexedDB, 캐릭터·모듈은 JSON 파일로 내보내기/가져오기. 개발·검사는 `npm run dev:client`로 브라우저에서 한다. 소유자 기기에 Rust가 없어도 된다.
- 배포 exe는 기존 Tauri v2 셸이 그대로 감싼다(CI의 `windows-exe` 워크플로가 이미 exe를 만든다). Tauri는 나중에 네이티브 파일 저장(데이터 폴더)과 멀티세션 네트워크(기존 Rust TCP 또는 WebSocket, M4에서 결정)를 더한다.
- 검토한 대안: Electron(150MB+, M1에 필요한 Node API가 없어 이점이 없음), PWA 전용(멀티세션 호스트를 열 수 없음). Tauri는 10MB exe와 CI 파이프라인이 이미 있다.

## 2. 저장소 배치

```text
client/                     새 클라이언트 (옛 src/를 import하지 않는다 — 경계 검사로 강제)
  index.html · main.tsx
  app/                      셸·라우트·전역 상태
  catalog/                  ContentCatalog: content/modules(SRD) + 설치 모듈(JSON) → 하나의 카탈로그, 긴 id, 한글 이름
  rules/                    SRD 5.2.1 표: 숙련 보너스, 포인트 바이, 멀티클래스 슬롯, 계약 마법, 갑옷 공식, 종족·서브클래스 표
  character/                CharacterSource · CharacterRuntime · deriveCharacter(부여 원장 · 필요 선택 · 파생값 · 검증)
  storage/                  IndexedDB 저장소, JSON 내보내기/가져오기, 모듈 설치
  screens/                  라이브러리 · 생성 마법사 · 시트 · 가방 · 레벨업 · 콘텐츠
  ui/                       디자인 토큰·기본 컴포넌트 (DM 워크스페이스의 13px·32px·두 단계 표면)
  data/                     저장소 안에 없던 SRD 데이터 (서브클래스 표, 종족 선택 표, 특성·재주 설명)
tests/client/               node --test + tsx (옛 테스트와 분리)
```

- 읽기만 하는 데이터: `content/modules/**`, `content/indexes/**`, `src/generated/*.json`. 코드는 가져오지 않는다.
- 스크립트: `dev:client`, `build:client`(→ `dist-client/`), `test:client`, `check:client-boundary`. Tauri는 `src-tauri/tauri.client.conf.json`으로 `dist-client`를 가리킨다.

## 3. 이정표

| 이정표 | 내용 | 완료 기준 |
| --- | --- | --- |
| **M1 캐릭터 생성** | 카탈로그 + 계산 엔진 + 저장/JSON + 생성 마법사 + 시트(읽기) + 콘텐츠 설치 | §4 수락 목록 전부, 전수 검사 green, exe |
| M2 시트 운용 | 사용량 인라인, 가방·장착·손·조율, 개인 휴식, 레벨업, 원본 편집, 종이형 시트 | CHARACTER_SYSTEM §3.3·§5.2~5.4 |
| M3 테이블 | V2 테이블 커널을 새 모델 위에 이식(솔로) | 시나리오 1·3 |
| M4 멀티세션 | 전송 결정(Rust TCP / WebSocket), Host·Client, 세션 UI | H+P1+P2 |
| M5 준비·캠페인·퇴역 | 준비실·캠페인·자료, 옛 `src/` 제거 | 전체 게이트 |

## 4. M1 수락 목록 — "완벽한 생성"

CHARACTER_SYSTEM §3.1의 모든 행에 더해:

1. **모든 SRD 조합**: 종족 9(선택 있는 종족의 혈통·유산·조상·기술·재주 포함) × 배경 4(능력치 +2/+1·+1/+1/+1, 기원 재주, 도구, 장비) × 직업 12(1레벨 선택 전부: 기술, 무기 통달, 전투 방식, 신성한/원초적 역할, 악기, 도구, 전문화, 언어, 기원술, 소마법·준비 주문·주문서) — 빠지는 선택이 없다.
2. **원하는 시작 레벨(1~20)**: 레벨 기록을 순서대로 채우고 서브클래스(3레벨)·ASI/재주(일반 재주만, 선행 조건)·주문 증가·교체·통달 수·전문화·기원술·초월 마법·서사시 은혜(19)까지 묻는다. 멀티클래스(선행 조건, 1레벨 숙련만, 합산 슬롯, 계약 마법 별도).
3. **파생값 전부**: 최대 HP(고정/굴림, 건강, 강인함·드워프), AC(갑옷·방패·비무장 방어·마법사 갑옷), 속도·감각·크기, 숙련 보너스, 내성·기술(전문화)·패시브 지각·이니셔티브, 주문 DC·명중·슬롯·소마법/준비/주문서/항상 준비, 공격(무기별·통달), 자원 풀, 저항·면역, 언어·도구, 특성·재주·배경 목록 **설명 포함**.
4. **설명**: 직업 특성 191 + 서브클래스 특성, 종족 특성, 재주, 배경, 주문 339 모두 한글 설명이 붙는다. 저장소에 없던 설명은 SRD(CC-BY-4.0) 요약으로 우선 채우고 `descriptionSource: "srd-summary"`로 표시한다. 소유자 번역본이 오면 같은 id로 교체한다.
5. **JSON**: (a) 캐릭터 내보내기/가져오기(원본 + 사용량, 스키마 v2, 검증과 오류 보고), (b) 콘텐츠 모듈 설치 — 기존 RuleModule JSON(SRD 모듈과 PHB 보충 모듈이 쓰는 형식) 그대로. 설치한 종족·배경·재주·서브클래스·주문이 생성·시트에서 내장과 똑같이 흐른다. 기원 재주는 ASI 후보에 나오지 않는다.
6. **검증**: 능력치 상한·포인트 바이 합, 선행 조건, 중복 선택, 알 수 없는 id, 갑옷 숙련 경고. 막힘이 있으면 저장하지 않는다.
7. **전수 검사**: 종족 9 × 직업 12 × 배경 4 × 레벨 1→20을 결정적 기본 선택으로 만들어 골든 표와 비교한다. 화면 캡처는 대표 6조합.

### 4.1 M1 진행 상태

| 조각 | 내용 | 상태 |
| --- | --- | --- |
| C1 카탈로그 | `client/catalog/` — SRD 모듈 36개 + 생성 색인 + 진행표 + 주문 339 + 저작 데이터(`client/data/srd/`)를 한 id 공간으로. 경고 0 | 완료 |
| C1 엔진 | `client/character/` — `deriveCharacter(source, catalog)`: 원장(ledger) 한 번 순회로 종족·배경·트랙·장비를 적용하고 선택 요청(`ChoiceRequest`)을 등록, 끝에서 숫자를 계산. 자동 채우기(`autofill`)로 검사·빠른 생성 | 완료 |
| C1 검사 | `tests/client/derive.test.ts`(17 시나리오) + `tests/client/matrix.test.ts`(종족 9 × 직업 12 × 배경 4 × L1·L5 = 864, 직업 12 × L1~20 = 240, 독립 공식 대조) | green |
| C2 저장·JSON | `client/storage/store.ts`(IndexedDB `simplevtt-client` v1: characters/modules/settings, 메모리 폴백), `client/character/json.ts`(파일 형식 `simplevtt.character` 스키마 2 = source + runtime + summary, 필드별 검증·오류 일괄 보고, 미설치 모듈 id 목록), `client/catalog/install.ts`(RuleModule JSON 파싱·요약·의존성). 검사: `install.test.ts`(합성 보충 모듈 → 종족·배경·기원 재주·일반 재주·서브클래스·주문이 생성까지 흐름, 기원 재주는 ASI 후보 밖), `json.test.ts`, `storage.test.ts`(fake-indexeddb) | 완료 |
| C3 화면 | `client/app/`(셸·해시 라우터·컨텍스트), `client/screens/`(라이브러리, 생성 마법사 7단계 + 오른쪽 실시간 시트·검증, 시트, 콘텐츠 설치 미리보기, 선택 피커), `client/ui/`(토큰 사본·스타일). `npm run dev:client`(포트 1430) · `npm run build:client` · `npm run tauri:build:client`(`src-tauri/tauri.client.conf.json`, dist-client). 워크플로 `windows-exe-client.yml`이 `client-m1-*` 프리릴리스로 exe를 올린다. 검사: `screens.test.ts`(정적 렌더) + `npm run capture:client`(Chromium이 마법사→시트→레벨업→JSON→모듈 설치→설치 콘텐츠 캐릭터까지 진행, `docs/evidence/new-client-m1/` 15장) | 완료 |

화면 규약: 마법사는 원본만 바꾸고(`setChoice`/`addLevel`…) 매 변경마다 `deriveCharacter`를 다시 돌려 오른쪽 시트와 검증을 갱신한다. 막힘(blocking)이 하나라도 있으면 저장 버튼이 잠긴다(수락 6). 새 캐릭터 초안은 설정 키 `creation-draft`에 자동 저장되어 창을 닫아도 남는다. "남은 선택 빠르게 채우기"는 `autofill`이다. 시트의 현재 HP만 런타임을 바꾼다(나머지 운용은 M2).

**M2 착수 (2026-09-15, 소유자 지시 "숫자 출처 추적 + 오프라인 세션처럼 시트 조작")**: 파생값마다 `terms`(가산 항목)를 붙여 시트에서 마우스를 올리면 출처가 나온다(HP·AC·이니셔티브·속도·패시브 지각·능력치·내성·기술·공격 명중/피해·주문 DC/명중). 시트는 런타임을 직접 조작한다: 피해/회복/설정/임시 HP, 히트 다이스 소비, 짧은 휴식(자원 회복 규칙 `restore.short`, 계약 슬롯)·긴 휴식(전부 회복, 히트 다이스 절반, 탈진 −1), 슬롯·자원 핍 클릭, 금화 증감, 아이템 추가(카탈로그 검색 또는 직접 입력)·수량·버리기·착용(AC·공격에 반영), 상태 토글, 탈진, 죽음 내성, 영웅적 영감, 활동 기록 200줄. 연산은 `client/character/play.ts`의 순수 함수이고 `play.test.ts`가 덮는다. 런타임 스키마에 `inventory`(제거·수량·추가)와 `log`가 추가됐다(JSON v2 호환, 없으면 빈 값).

엔진의 선택 id 규약(원본 `choices` 맵의 키): `origin.languages`, `origin.species.<choice>`(`origin.species.lineage`…), `origin.background.abilityMode|abilityPlus2|abilityPlus1|tool`, `class.<트랙>.skills|expertise|fighting-style|subclass|asi|epic-boon|...`, 직업 전체 풀은 첫 트랙에 붙는다(`class.<첫 트랙>.weapon-mastery|invocations|metamagic|cantrips|spells|spellbook`), 재주 하위 선택은 `feat.<부여 위치>.<재주 id>.<항목>`, 장비는 `equipment.class|background[.<옵션>.<n>]`. 답은 항상 옵션 id 배열이고, 옵션 밖의 답은 무시된다(모듈 제거·레벨 되돌림에도 안전).

M1에서 단순화한 것: 반복 가능한 기원술(고통스러운 폭발 등)은 한 번만 고른다. 준비 주문은 최대치보다 적어도 막지 않는다(규칙대로). ASI 후보에서 기원 재주를 뺀다(소유자 결정; 규칙상은 허용).

## 5. 결정(가정)과 열린 질문

CHARACTER_SYSTEM §10의 추천안을 M1의 가정으로 쓴다: HP 고정값 기본(D44), 능력치 직접 입력 허용·표시(D45), 시작 장비 옵션 기본(D46), 멀티클래스 허용(D47), 마일스톤이면 XP 숨김(D51), SRD 설명을 저장소에 추가(D52). 옛 저장본 이관(D43)은 M2 이후로 미룬다(새 클라이언트는 빈 라이브러리에서 시작하고 옛 캐릭터는 JSON 가져오기로 옮긴다).

열린 것: 비공개 번역 저장소(`Kaetaeru/D-D-2024-`)는 이 세션에서 접근할 수 없다. 설명 데이터는 위 4번대로 SRD 요약으로 채우고, 소유자가 나중에 생성기로 교체한다.
