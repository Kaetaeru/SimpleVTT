# SRD 5.2.1 — 모듈로 다시 만들기 계획

작성 2026-09-19. 소유자 결정: "SRD도 새로 작성" → "갈아엎어버리자".
CLAUDE.md §1.6(설치 모듈도 SRD와 똑같이 동작)과 §2(규칙은 JSON에)를 끝까지 밀어붙이는 작업이다.

---

## 1. 왜

지금의 SRD는 **한 군데에 있지 않다.** 같은 주문 하나가 여섯 곳에서 온다:

| 경로 | 무엇 |
|---|---|
| `content/modules/dnd-srd-5.2.1.*` (40개) | 직업·서브클래스 6·종족·배경·재주·장비·계약 344 — 주문은 21개뿐 |
| `content/indexes/*.json` (10개, 손으로 씀) | 만들기 색인(기술·언어·직업 1레벨 선택·주문 수), 괴물 특성 규칙, 주문 지속·강타·지속효과·무기·소환·반응·재내성·갈래 |
| `content/srd-extras/*.json` (7개, 손으로 씀) | 직업 특성 글, 서브클래스 12, 종족 선택·효과, 주문 목록 2~9레벨, 기원술·메타매직 목록 |
| `src/generated/progressionCatalog` | 직업 레벨 표(특성·숙련 보너스·열), 시전자 종류, 멀티클래스 |
| `src/generated/spellExecutionCatalog` | 주문 실행 — **옛 `src/` 코드가 주문 글을 읽어 추측한 것**(`catalogMechanic`)이 상당수 |
| `src/generated/monsterCatalog` | 괴물 329 스탯블록 |

결과:
- 주문 감사(`scripts/audit-spells.ts`)에서 63개 주문·85건 불일치 — 글에서 추측한 실행이 틀린 자리.
- 모듈 문법으로는 표현이 안 되는 것이 내장 경로에만 있다(아래 §4). 즉 **SRD는 모듈이 아니다** — 설치 모듈은 직업 하나도 만들 수 없다.
- 설치 모듈이 SRD 주문의 실행을 덮어쓸 수 없다(생성 카탈로그가 항상 이긴다).
- 같은 규칙이 두 곳에 있어 어긋난다(종족 선택: 색인 vs 모듈; 서브클래스 특성: extras vs 모듈).

## 2. 목표

1. SRD는 **원문에서 빌드한 모듈 파일**이다. 설치 모듈과 같은 문법, 같은 읽는 길.
2. 엔진에는 SRD 전용 입력(`index`·`extras`·`progression`·생성 카탈로그)이 없다. `createCatalog`는 모듈 목록만 받는다.
3. 규칙 결정(계약·실행)은 **항목마다 손으로 쓴 JSON**에 있고, 원문 글과 대조하는 감사 도구가 0건을 낸다.
4. id는 그대로 `dnd.srd521.*` — 저장된 캐릭터·캠페인이 깨지지 않는다.

## 3. 소스

- `Kaetaeru/D-D-2024-` → `10-RULEBOOKS/srd-5.2.1/` (CC-BY-4.0 — SRD 번역문은 이 저장소에 실어도 된다)
- 파서: `node scripts/srd-parse-source.mjs <src>/10-RULEBOOKS/srd-5.2.1 <out>/srd-parsed.json`
  → `{ docs: [{ file, fm, intro, tree: [{ depth, head, text, children }] }] }` (규칙 해석 없음)
- 현재 개수: 문서 426, 주문 339(주문 원문명 slug = 현 id — `'`는 `-s`로), 직업 12(각 문서에 서브클래스 1), 종족 9, 배경 4, 재주 17(한 문서), 괴물 332 문서.

| 문서 | 모양 |
|---|---|
| `spells/<글자>.md` | `## <주문명>` + `*N레벨 학파*` + 불릿(원문명·시전 시간·사거리·구성요소·지속시간) + 본문 + `**상위 레벨 주문 슬롯 사용.**` |
| `classes/<직업>.md` | `# 직업` (`## 핵심 특성` 표, `## <직업> 특성 표`), `# 클래스 특성` (`## N레벨: 특성명`), `# 서브클래스: 이름` (`## N레벨: …`) |
| `character-origins/species/*.md` | `# 종족` + `## 특성`(선택지는 `###`) |
| `feats/README.md` | `# 분류` 아래 `## 재주` (`###` 혜택) |

## 4. 문법에 없는 것 (내장 경로에만 있는 것) — 엔진에 넣는다

| # | 무엇 | 지금 | 새 문법 |
|---|---|---|---|
| G1 | 직업 레벨 표: 레벨별 특성·열(슬롯·소마법·준비·통달·기원술·자원·무술 주사위), 시전자 종류, 멀티클래스 | `progressionCatalog` | `class-definition.levels[]` + `casterKind` + `multiclass` |
| G2 | 직업 특성 기록(이름·글·레벨) | extras class-features | `levels[].features`에 특성 `option` 항목 id (D310) |
| G3 | 직업 1레벨 선택·기술 목록·주문 수·주문책 | 색인 `classes` | `class-definition.skillOptions`, `choices[]`, `spellcasting` |
| G4 | 주문의 직업 목록 | 색인 + extras spell-lists | `spell-definition.classes`만 |
| G5 | 기술·언어·장인 도구 어휘 | 색인 | 기술은 §2 핵심 어휘(엔진). 언어·장인 도구는 S4에서 `vocabulary-definition`으로 |
| G6 | 선택지 목록의 레벨·선행·비용 | extras class-options | `option-list-definition.options[]`에 `minLevel`·`requires`·`cost`·`repeatable` |
| G7 | 괴물 스탯블록·특성 규칙 | `monsterCatalog` + 색인 | `monster-definition` (지금 붙여넣기 NPC와 같은 모양) |
| G8 | 주문 실행 우선순위 | 생성 카탈로그가 항상 이김 | 모듈의 `spell-mechanic`이 유일한 출처 |
| G9 | 부분 `spell-mechanic`이 `trackedEffects`·`weaponSpell`·`variants`를 버림 | — | 부분 덧대기도 전부 읽음 |

마법 물건은 지금 카탈로그에 없다 — 이번 범위 밖(붙여넣기 경로 유지). 필요하면 이 계획 다음에.

## 5. 산출물

- `content/modules/srd-5.2.1/*.module.json` — 영역별 파일(규칙, 직업, 종족·배경, 재주, 주문, 장비, 괴물). 저장소에 커밋.
- `content/srd-authoring/**.json` — **손으로 쓰는 규칙 결정**(항목 id → 정의 메커닉·계약·`spell-mechanic`). 빌더가 원문 글과 합친다.
- `scripts/srd-build-modules.mjs` — 원문 + 결정 → 모듈. 결정 없는 항목은 목록으로 낸다.
- 첫 결정 JSON은 **지금 경로들에서 옮겨 온다**(이전 스크립트 1회) — 되던 것을 두 번 정하지 않는다. 옮긴 뒤 감사로 고친다.

## 6. 단계 (슬라이스 = 코드+테스트+문서, 매번 게이트)

| 단계 | 내용 | 끝났다는 증거 |
|---|---|---|
| S0 | 이 계획, 원문 파서 | 파서 개수 일치 |
| S1 ✔ (D310) | G1~G3·G6: 설치 모듈이 직업을 만들 수 있다 | 합성 모듈 직업으로 1~20레벨 캐릭터·시전·자원 (호스트 경로 포함) |
| S2 ✔ (D311) | G7: 괴물 모듈 문법 | 합성 모듈 괴물을 표에 놓고 공격·특성 |
| S3 ✔ (D312) | G8·G9: 모듈 `spell-mechanic`이 유일한 출처 | 합성 모듈이 SRD 주문 실행을 덮어씀 |
| S4 | 결정 이전 스크립트 + 빌더 → 새 SRD 모듈. 옛 경로와 **나란히** 비교(같은 캐릭터 파생 결과 diff 0) | 비교 도구 diff 0 |
| S5 | 내장 로딩을 새 모듈로 전환, 옛 경로(`indexes`·`srd-extras`·생성 카탈로그·옛 모듈·`src/domain` 주문 추측) 삭제 | 게이트, `createCatalog` 입력이 모듈뿐 |
| S6 | 내용 교정: 주문 감사 85건, 재주·종족·직업 특성을 원문과 대조, 표 검증 `--builtin` | 감사 0건(사유 있는 예외만 목록), 표 검증 거절 0 |

S4의 나란히 비교가 핵심 안전장치다 — 전환 전에 옛 SRD와 새 SRD가 같은 캐릭터를 같게 만드는지 본다. 차이는 전부 원문 대조로 판정한다(옛 쪽이 틀렸으면 S6 목록으로).

## 7. 지켜야 할 것

- 코드에 콘텐츠 id·이름 비교 없음(CLAUDE.md §2). 빌더도 규칙을 글에서 추측하지 않는다 — 글은 글로만 싣고, 규칙은 결정 JSON에서.
- 저장된 캐릭터 호환: id 유지, 선택 id(`origin.species.draconicAncestry` 등) 유지.
- 각 문법 추가는 `MODULE_GRAMMAR.md`·스키마·합성 모듈 시험과 함께.
