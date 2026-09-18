# PHB 2024 보충 모듈 — 다시 만들기 계획 (인계 문서)

작성 2026-09-18. 이 문서 하나만 읽으면 다음 사람이 작업을 이어받을 수 있게 쓴다.
**PHB 2024 본문은 이 저장소에 들어오지 않는다.** 소스는 사설 저장소, 산출물은 저장소 밖(소유자의 `Downloads`).

---

## 1. 왜 다시 만드나

지금 소유자가 설치해 쓰는 `phb-2024-supplement.module.json`은 **옛 컴파일러(구 `src/` 클라이언트용)의 산출물**이다.
그 산출물은 본문을 잘라서 실었다 — 예를 들어 어떤 3레벨 특성은 "다음 혜택을 얻는다."에서 끝나고 혜택 목록이 없다.
규칙을 계약으로 옮기지 못한 자리의 상당수가 거기서 나왔다. 항목 id도 `…feature.3-1` 같은 기계 이름이라 사람이 읽지 못한다.

소스 저장소에는 **전문이 온전히** 있다. 컴파일러 산출물이 아니라 **소스에서 바로** 모듈을 만든다.

## 2. 확정된 결정 (소유자)

| 질문 | 결정 |
|---|---|
| 본문 포함 범위 | **전문 그대로** (각 항목의 `presentation.locales.ko-KR.description`에 절 구조 유지) |
| 부록 B 소환 스탯블록 11종 | **현행 모듈의 소환 템플릿을 그대로 이식** (원본 저장소는 번역 제외 상태) |
| 1/3 시전자(엘드리치 나이트·비전 사기꾼) | **엔진에 추가**한다 |
| 파일·모듈 이름 | **새 이름** — moduleId `phb-2024`, 파일 `phb-2024.module.json` |
| 야생 마법 쇄도 d100 표 | **본문만 싣는다.** 모듈 굴림표 문법은 만들지 않고, 표는 사람이 굴린다 (사유를 계약에 적는다) |

## 3. 소스

- 저장소: `Kaetaeru/D-D-2024-` (비공개), 브랜치 `main`, 작업 기준 리비전 **`d3d5747`**
- 경로: `10-RULEBOOKS/phb-2024/`
- 받는 법 (스크래치패드 등 저장소 밖에서):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/Kaetaeru/D-D-2024-.git phb-src
cd phb-src && git sparse-checkout set 10-RULEBOOKS/phb-2024
```

### 3.1 문서 구성

| 폴더 | 개수 | 문서 모양 |
|---|---:|---|
| `subclasses/*.md` | 36 | `## <레벨>레벨: <특성명>` 절이 특성 하나 (전부 **178개**), 그 밖에 `기동 선택지`(배틀 마스터 20개), `맹세 주문`(팔라딘 3개), `검수 기록` |
| `feats/*.md` | 58 | frontmatter `feat_category`가 분류(기원 6·일반 41·전투 방식 6·에픽 은총 5), 본문은 절 또는 문단 |
| `spells/items/*.md` | 52 | 머리말 불릿에 시전 시간·사거리·구성요소·지속시간·주문 목록, 본문에 효과와 상위 슬롯 |
| `backgrounds/*.md` | 12 | `배경 특성` 표(능력치·기원 재주·기술 숙련·도구 숙련) + `능력치 증가` + `시작 장비` A/B |
| `species/aasimar.md` | 1 | 절마다 종족 특성 하나 |
| `appendix-b/*.md` | 11 | 소환 스탯블록 — **원본에서 번역 제외**(조사 이력). 모듈에는 §2의 결정대로 기존 템플릿을 쓴다 |

모든 문서는 YAML frontmatter(`name`, `original_name`, `source`, `srd: false`, `translation_status: complete` …)를 갖는다.

### 3.2 파서

`scripts/phb2024-parse-source.mjs`가 위 구조를 그대로 JSON으로 만든다(규칙 해석 없음).

```bash
node scripts/phb2024-parse-source.mjs <phb-src>/10-RULEBOOKS/phb-2024 <out>/phb-parsed.json
```

출력: `{ subclass|feat|spell|background|species|statblock: [{ slug, file, fm, intro, sections:[{head,text}] }] }`.
기대 개수는 36 / 58 / 52 / 12 / 1 / 11이며, 서브클래스의 `N레벨:` 절 합이 178이다. 숫자가 다르면 소스가 바뀐 것이니 먼저 확인한다.

## 4. 산출물 규격

파일 하나: `phb-2024.module.json` (`moduleId: "phb-2024"`, `moduleVersion: "1"`, `dependencies: []`).

### 4.1 id 체계 (사람이 읽는 이름)

| 무엇 | id |
|---|---|
| 서브클래스 | `phb2024.subclass.<class>.<slug>` (예: `…subclass.barbarian.zealot`) |
| 서브클래스 특성 | `phb2024.subclass.<class>.<slug>.feature.<level>.<feature-slug>` |
| 재주 | `phb2024.feat.<slug>` |
| 주문 | `phb2024.spell.<slug>` |
| 배경 | `phb2024.background.<slug>` |
| 종족 | `phb2024.species.aasimar`, 특성은 `species-definition.traits`에 이름 있는 키 |
| 효과(계약이 시작하는 지속 효과) | `effect.phb2024.<subclass-or-feat>.<slug>` — 계약 id는 `feature:<같은 키>` |
| 선택지 목록 항목 (기동 등) | `phb2024.option.<list>.<slug>` |

**기존 모듈과 id가 달라진다.** 소유자는 옛 모듈을 지우고 새것을 설치한다(§2 결정).

### 4.2 항목 한 개의 모양

- `presentation.locales.ko-KR.name` = 소스 `fm.name`, `originalName` = `fm.original_name`
- `presentation.locales.ko-KR.description` = **그 항목의 전문**. 서브클래스 특성은 해당 절의 본문, 재주·주문·배경은 문서 본문. `검수 기록` 절은 싣지 않는다(플레이에 쓰이지 않는다).
- `mechanics`:
  - 정의: `subclass-definition`(`spells`, `choices`, `spellsByOption`), `feat-definition`, `spell-definition`, `spell-mechanic`, `background-definition`, `species-definition`
  - 계약: `common-play` — 현재 문법(`client/rules/contract.ts`)

### 4.3 계약을 쓰는 기준 (CLAUDE.md §1)

1. 계산할 수 있으면 계약 연산으로 (자원·경제·피해·상태·효과·인터셉터).
2. 앱이 볼 수 없는 사실(좌표 D109, 조명, 접촉)은 **상황 버튼**이나 `adjudication.request`의 `fact`.
3. 열거 가능한 선택은 **표시된 사용**(`label`) 또는 선택지 목록.
4. 남는 것은 **"DM 판정" + 사유**. 사유 없는 라벨은 금지.

## 5. 문법 구멍과 엔진 슬라이스

D300~D302에서 이미 연 것(바로 쓴다): 서브클래스 레벨별 주문(`subclass-definition.spells`), 수영 속도, 회복·임시 HP의 `diceCount`/`diceSides`, 사후 불리점(`reroll-keep-lower`), 반응 창 어휘(`reaction.auto-miss`, `damage-taken.reduce`의 `diceSides`), 지속 주문의 대상 고정(`sustain.target: "bound"`)과 종료 버튼(`sustain.endWhen`), 획득 시점 식이 읽는 능력 수정치.

새로 필요한 것 **두 개** — P1에서 먼저 연다.

### G1. 1/3 시전자 주문 시전 (`subclass-definition.spellcasting`)

- 데이터(모듈): `{ kind: "third", ability: "int", list: "dnd.srd521.class.wizard", cantrips: {"3":2,"10":3}, prepared: {"3":3,"4":4, …} }`
- 엔진: 시전자를 만드는 주체가 **서브클래스**가 될 수 있어야 한다.
  - `client/catalog/catalog.ts` — `SubclassView`에 `spellcasting`을 실어 나른다
  - `client/character/spells.ts` — 슬롯은 `fullCasterSlots(ceil(level/3))`, 멀티클래스 시전자 레벨에 1/3 기여
  - `client/character/tracks.ts` — 서브클래스 레벨에서 주문 항목(`classSpellEntry`)을 만들고 준비 주문 수를 그 표에서 읽는다
- 시험: 합성 모듈의 3분의1 시전자가 3레벨에 1레벨 슬롯 2개·준비 3개, 7레벨에 2레벨 슬롯, 멀티클래스에서 1/3만 기여.

### G2. 모듈이 정의하는 선택지 목록 (`option-list-definition`)

- 지금 `choice.class-option`은 `catalog.classOptions`(내장 SRD 데이터)만 본다 → 모듈이 목록을 못 만든다.
- 데이터(모듈): 목록 항목은 `option` 카테고리 항목들이고, 목록 자체를 선언하는 항목이 하나 더 있다
  `{"kind":"option-list-definition","config":{"list":"phb2024.maneuvers","options":["phb2024.option.maneuvers.ambush", …]}}`
- 엔진: `ContentCatalog`가 그 목록을 `classOptions`에 합쳐 준다. 선택은 기존 `choice.class-option` 그대로.
- 쓰는 곳: 배틀 마스터 기동 20개(3레벨 3개, 이후 7·10·15레벨에 2개씩 추가, 15레벨에 교체). 기동 하나하나가 계약을 갖는다.

### 열지 않기로 한 것

- **야생 마법 쇄도 d100 표**: 본문만 싣고 표에서 굴린다. 계약에는 "표에서 굴린다" 사유를 적는다.
- **좌표가 필요한 규칙**(오라·범위·5피트, 소스에서 72곳): 상황 버튼 또는 DM 판정. 격자를 되살리지 않는다(D109).

## 6. 단계

| 단계 | 내용 | 끝났다는 기준 |
|---|---|---|
| **P1** | 엔진 G1·G2 + 시험 + 문서(D번호) | `npm run gate:client` 통과, 합성 모듈 시험 2개 |
| **P2** | 배경 12 · 아시마르 1 · 재주 58 | 항목 71개가 전문 + 정의 + 계약, 문법 검사 0 |
| **P3** | 주문 52 (`spell-mechanic` 전부, 소환 템플릿 8종 이식) | 52개 전부 시전 가능, 상위 슬롯·집중·onHit·sustain 반영 |
| **P4** | 서브클래스 36 (직업별 3개씩 12배치) + 기동 20 + 맹세 주문 | 특성 178개 전부 계약, 검사 0 |
| **P5** | 검증·인도 | 아래 §7 전부 통과, 파일 전달 |

각 배치는 CLAUDE.md §3 점검표를 돌리고, 저장소 변경(엔진·시험·문서)만 커밋한다. 모듈 파일은 커밋하지 않는다.

## 7. 검증

```bash
npx tsx scripts/check-module-grammar.ts <out>/phb-2024.module.json   # unsupported 0, 모르는 속성 0
npm run gate:client                                                   # 단위 시험 전부
```

그리고 파생 스모크(저장소 밖 스크립트): 서브클래스 36개를 각자 대표 레벨로 만들어

- `derived.warnings` 0
- 특성마다 계약이 붙어 있는지(붙지 않은 특성 목록이 비어 있어야 한다)
- 커버리지 표를 출력한다 — 자동 / 버튼 / 상황 버튼 / DM 판정 개수

숫자 기대값: 항목 159 + 효과·선택지 항목, 서브클래스 특성 178, 재주 58, 주문 52.

## 8. 재사용할 자산

- **현행 모듈**(`Downloads/phb-2024-supplement.module.json`, moduleVersion 2)에 이미 178개 특성·58 재주·52 주문의 계약이 들어 있다. **규칙 판단은 거기서 그대로 가져오되**, 본문이 잘려 있던 자리(불릿 목록이 사라진 특성들)는 소스를 보고 다시 쓴다.
- 소환 템플릿 8종은 그 파일의 `spell-mechanic.summon`에 있다 — 그대로 옮긴다.
- 옛 저장소 모듈 `content/supplements/phb-2024.*`는 **더 쓰지 않는다**(새 모듈이 그 내용을 포함한다). 새 모듈이 완성되면 지운다.

## 9. 규칙

- PHB 본문·번역문은 이 저장소에 **커밋하지 않는다**. 계획·문법·개수만 적는다.
- 엔진에 들어가는 것은 **콘텐츠 중립 문법**뿐(CLAUDE.md §2). 특정 특성 이름·id를 코드가 비교하지 않는다.
- 새 문법은 `docs/design/v3/ROLL20_TABLE_SPEC.md`에 D번호로 적고 로드맵 줄을 추가한다.
- 못 하는 것은 숨기지 않는다 — "DM 판정 (사유)".
