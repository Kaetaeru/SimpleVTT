# SimpleVTT V1 Master Roadmap v2

Status: **CANONICAL V1 EXECUTION PLAN AFTER MERGE**  
Prepared: 2026-08-31 Asia/Seoul  
Integration target: `work/v1-composite`  
Reconciled base SHA: `a38b0f07ac012bc9e600a28b2630a365d1bd098b`  
Tracking Epic: `#110`  
Multiplayer catalog: `docs/design/multiplayer-v1-scenario-catalog.md`

## 0. 숫자로 보는 V1

V1은 아래 숫자가 모두 충족될 때만 완료다.

| 항목 | 확정 수치 | 완료 조건 |
| --- | ---: | --- |
| Exact Git SHA | 1개 | 모든 자동·Windows 증거가 같은 SHA를 사용 |
| Windows release artifact | 1개 | 동일 SHA에서 생성되고 digest가 기록됨 |
| 필수 앱 역할 | 4개 | `H`, `P1`, `P2`, reconnect/late-join용 `P3` |
| Workstream | 10개 | `W0`~`W9` |
| Release Gate | 72개 | 모든 Gate가 `PASS` |
| 완료 점수 | 100점 | 가중 점수 100.0/100.0 |
| Multiplayer scenario | 120개 | `A10 + B8 + C30 + D13 + E14 + F10 + G9 + H12 + I6 + J8 = 120`; 모든 적용 가능한 AUTO/WIN Gate 통과 |
| 기존 V1 release gate | 18개 | `V1-00`, `01`, `10`~`13`, `20`~`21`, `30`~`32`, `40`~`42`, `50`, `60`, `70`, `80` |
| Multiplayer work issue | 13개 필요 | 현재 12개 존재; `MP-13` issue를 추가한 뒤 `MP-01`~`MP-13` 모두 종료 |

### 현재 구현 분포

이 수치는 **완료율이 아니라 현재 감사 기준의 작업 종류**다. `W0` evidence 이관 중 증거가 부족한 Gate는 숫자를 숨기지 않고 `R -> V` 또는 `V -> B`로 재분류한다.

| 초기 분류 | Gate 수 | 비율 | 의미 |
| --- | ---: | ---: | --- |
| `R — REUSE_LOCKED` | 47/72 | 65.3% | 구현과 focused 자동 증거가 이미 있음. 재구현 금지 |
| `V — VERIFY_ONLY` | 14/72 | 19.4% | 구현은 있으나 Tauri/Windows/전체 여정 증거가 부족함 |
| `B — BUILD` | 11/72 | 15.3% | 실제로 새로 만들어야 하는 문서·하네스·종합 수락 산출물 |
| **기존 구현 재사용 범위 (`R+V`)** | **61/72** | **84.7%** | 새 기능 개발보다 검증·연결이 중심 |

새 ledger에 이관된 exact-SHA `PASS`가 아직 없으므로 이 문서 생성 시점의 **공식 기록 점수는 0.0/100.0**이다. 이는 제품이 0% 구현됐다는 뜻이 아니다. `W0`에서 기존 증거를 이관하면 코드 수정 없이 점수가 상승한다.

### 현재 확인된 통제 불일치 — 5개

1. `docs/CURRENT.md`가 이미 통합된 C9 Gate N을 현재 목표로 가리킨다.
2. `docs/roadmap/CURRENT.md`가 완료된 Resolver mechanism selection을 현재 로드맵으로 가리킨다.
3. `CANONICAL_ROOT.md`가 C9 전용 작업 branch를 전역 active branch로 가리킨다.
4. Epic `#110`이 112 scenario와 `MP-01`~`MP-12`만 기록하며, 실제 catalog의 `MP-J01`~`J08` 및 `MP-13`을 누락한다.
5. historical Phase 14 branch를 자동 커밋·push하는 write-capable workflow가 남아 있다. 현재 integration branch를 직접 쓰지는 않지만, `W0-01`에서 격리·폐기 여부를 명시적으로 판정한다.

## 1. 상태 문법과 점수 계산

### 작업 종류

- `R — REUSE_LOCKED`: 기존 production 경로를 그대로 사용한다.
- `V — VERIFY_ONLY`: 기존 경로를 실제 Tauri/Windows 또는 complete journey에서 검증한다.
- `B — BUILD`: 현재 저장소에 없는 최소 산출물을 새로 만든다.

### 실행 상태

- `PENDING`: exact-SHA 증거가 아직 ledger에 기록되지 않음.
- `PASS`: 같은 SHA에서 요구된 자동/Windows/영속화 증거가 모두 존재함.
- `FAIL`: 현재 SHA에서 재현 가능한 실패가 있음.
- `BLOCKED`: 외부 도구, Windows 환경, 선행 Gate가 없어 실행 불가.

### 코드 변경 규칙

`R` 또는 `V` Gate는 **재현 가능한 `FAIL` 없이 제품 코드를 수정하지 않는다**. 실패가 확인되면 같은 Gate를 `REPAIR` 작업으로 전환하고, 가장 작은 수정만 허용한다.

### 100점 공식

```text
전체 점수 = Σ(Workstream 가중치 × 해당 Workstream PASS Gate 수 / 전체 Gate 수)
```

- 소수점 첫째 자리까지 표시한다.
- structural test만으로 rendered motion Gate를 `PASS` 처리하지 않는다.
- 과거 SHA, 다른 branch, protocol-only replica, source 존재만으로 점수를 부여하지 않는다.

## 2. Workstream 대시보드

| Workstream | 범위 | Gate | 가중치 | R | V | B |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `W0` | Source of truth·증거·재구현 방지 | 6 | 5점 | 0 | 1 | 5 |
| `W1` | First run·Character 생성·성장 | 8 | 10점 | 4 | 4 | 0 |
| `W2` | SRD 5.2.1 product lifecycle | 8 | 15점 | 4 | 4 | 0 |
| `W3` | Complete local play | 8 | 10점 | 7 | 1 | 0 |
| `W4` | Campaign·DM 준비 | 8 | 10점 | 7 | 1 | 0 |
| `W5` | Multiplayer authority·presentation | 10 | 15점 | 10 | 0 | 0 |
| `W6` | Inventory·Stash·Rest·DM tools | 8 | 10점 | 7 | 1 | 0 |
| `W7` | Recovery·privacy·accessibility | 8 | 10점 | 7 | 1 | 0 |
| `W8` | Automated H+P1+P2 acceptance | 4 | 5점 | 1 | 1 | 2 |
| `W9` | Windows release·next-session closure | 4 | 10점 | 0 | 0 | 4 |
| **합계** |  | **72** | **100점** | **47** | **14** | **11** |

## 3. 72개 Release Gate

### W0 — Source of truth, evidence, and reimplementation control — 6 Gate / 5점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W0-01` | `work/v1-composite` exact HEAD와 정상 CI를 재조정하고, 어떤 write-capable workflow도 현재 integration/작업 branch를 변경할 수 없는지 확인한다. | V | V1-00, V1-01 |
| `W0-02` | `docs/roadmap/V1_EVIDENCE_LEDGER.json`에 72 Gate의 SHA·명령·테스트 수·Windows artifact를 기록한다. | B | 전체 |
| `W0-03` | `docs/CURRENT.md`, `docs/roadmap/CURRENT.md`, `CANONICAL_ROOT.md`를 이 로드맵으로 단일 라우팅한다. | B | 전체 |
| `W0-04` | Epic `#110`을 120 scenario 기준으로 동기화하고 누락된 `MP-13` issue를 생성·연결한다. | B | MP-EPIC |
| `W0-05` | C9/과거 Phase 문서는 `COMPLETE` 또는 `ARCHIVE`로 표시하고 `NEXT` 권한을 제거한다. | B | C9, archived V1 docs |
| `W0-06` | 모든 구현 작업 전에 Evidence Card를 요구하는 재구현 방지 Gate를 고정한다. | B | 전체 |

**W0 Exit:** 누구든 문서 하나만 읽고 현재 목표, 정확한 수치, 다음 Gate, 재사용할 구현을 식별할 수 있다.

### W1 — First run, Character creation, library, and progression — 8 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W1-01` | First run에서 Character Library와 생성 진입점에 도달한다. | R | V1-20 |
| `W1-02` | Guided Create가 Species·Background·Class·Ability·proficiency·equipment와 해당되는 spell choice를 처리한다. | R | V1-20 |
| `W1-03` | Quick Create가 Guided와 동일 draft를 공유하고 전환 시 선택을 잃지 않는다. | R | V1-20 |
| `W1-04` | Review·validation·commit이 불완전/불법 Character를 저장하지 않는다. | R | V1-20 |
| `W1-05` | 실제 Tauri에서 생성 → 저장 → 앱 종료 → 재실행 → 동일 Character 로드를 증명한다. | V | J1, V1-20 |
| `W1-06` | 실제 UI에서 import·duplicate·delete와 ID/provenance 분리를 증명한다. | V | V1-20 |
| `W1-07` | Full Sheet에서 HP·AC·resource·inventory·spells·features·actions가 저장본과 일치한다. | V | V1-20, V1-21 |
| `W1-08` | 실제 Tauri에서 대표 level-up → 새 choice → commit → 새 feature/action → restart 유지까지 증명한다. | V | V1-21, MP-E05 |

**W1 Exit:** 새 사용자가 외부 fixture 없이 플레이 가능한 Character를 만들고 다시 열 수 있다.

### W2 — SRD 5.2.1 product lifecycle — 8 Gate / 15점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W2-01` | 12 class, 9 species, 4 background와 Level 1 생성 catalog를 고정한다. | R | SRD profile |
| `W2-02` | weapon·armor·equipment·item catalog와 item capability를 고정한다. | R | SRD profile |
| `W2-03` | 339 spell의 presentation과 authoritative executable definition을 고정한다. | R | SRD profile |
| `W2-04` | class feature·feat·progression과 36 Common Play mechanism family를 기존 generic path로 고정한다. | R | C9 Gate N |
| `W2-05` | 모든 Level-1 eligible shipped content가 Character creation에서 합법적으로 획득 가능한지 검사한다. | V | V1-20 |
| `W2-06` | 모든 progression content가 올바른 level/choice schedule에서 획득 가능한지 검사한다. | V | V1-21 |
| `W2-07` | 획득 content가 Sheet·Action·resource recovery·persistence로 연결되는지 검사한다. | V | V1-21 |
| `W2-08` | 대표 archetype lifecycle matrix를 Tauri에서 검증한다: martial, prepared caster, spontaneous caster, pact caster, shapeshifter, healer. | V | Journey J1, Journey J3 |

**W2 Exit:** “데이터가 존재한다”가 아니라 “획득·표시·사용·회복·저장된다”가 증명된다.

### W3 — Complete local play — 8 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W3-01` | Freeform·ability check·saving throw·generic d20이 production authority를 사용한다. | R | V1-21 |
| `W3-02` | Initiative·round·turn·economy가 일관된 lifecycle을 가진다. | R | V1-21 |
| `W3-03` | attack·miss·critical·damage·healing·HP writeback이 atomic하다. | R | V1-21 |
| `W3-04` | spell·feature·item action이 cost·target·effect·Activity를 함께 처리한다. | R | V1-21 |
| `W3-05` | reaction·interrupt·concentration·Ready lifecycle이 production path를 사용한다. | R | V1-21, MP-D |
| `W3-06` | duration·condition·Short Rest·Long Rest·resource recovery가 저장 상태와 일치한다. | R | V1-21 |
| `W3-07` | correction/Undo가 역사 삭제가 아닌 compensating event로 동작한다. | R | V1-21 |
| `W3-08` | 실제 Tauri에서 complete local session → rest → 종료 → restart를 한 번에 통과한다. | V | Journey J3, Journey J6 |

**W3 Exit:** 네트워크 없이도 한 세션을 시작부터 종료·재실행까지 플레이할 수 있다.

### W4 — Campaign and DM preparation — 8 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W4-01` | Campaign create/read/update/archive/restore/duplicate/delete와 namespace isolation을 고정한다. | R | V1-10 |
| `W4-02` | Campaign dashboard·Session binding·Campaign-required Host start를 고정한다. | R | V1-11 |
| `W4-03` | roster·Session snapshot·history·summary를 고정한다. | R | V1-12 |
| `W4-04` | calendar·rations·visibility·declarative provider 설정을 고정한다. | R | V1-12, MP-F |
| `W4-05` | Party Stash와 shared/approval/DM-managed policy를 고정한다. | R | V1-13, MP-E |
| `W4-06` | DM Library organization·import·private notes·provenance를 고정한다. | R | V1-13, MP-G |
| `W4-07` | NPC/PC preset/custom Actor materialization·handout·spatial fallback을 고정한다. | R | V1-40, MP-G |
| `W4-08` | 실제 Tauri에서 Campaign 준비 → Session 시작/종료 → Campaign reopen을 증명한다. | V | Journey J2, Journey J5, Journey J6 |

**W4 Exit:** DM이 외부 debug fixture 없이 다음 세션을 준비하고 다시 열 수 있다.

### W5 — Multiplayer authority and shared presentation — 10 Gate / 15점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W5-01` | H/P1/P2 topology와 P3 late-join/reconnect lifecycle을 고정한다. | R | MP-A |
| `W5-02` | Host-unknown persisted Character가 trusted owner projection으로 mount된다. | R | MP-A02, MP-B01~B04 |
| `W5-03` | Client intent → Host validate/resolve/commit 단일 mutation 경로를 고정한다. | R | MP invariants |
| `W5-04` | immutable Resolution Presentation Envelope의 identity·dice·outcome·privacy·Activity를 고정한다. | R | MP-01 |
| `W5-05` | ordered remote queue·duplicate suppression·catch-up·no-reroll을 고정한다. | R | MP-02, MP-H |
| `W5-06` | local/Host/remote가 동일 VisualDiceBridge와 CombatVfxBridge를 사용한다. | R | MP-C, MP-I |
| `W5-07` | H/P1/P2 attack·check·save·spell·item·feature action matrix를 고정한다. | R | MP-03, MP-C01~C24 |
| `W5-08` | Initiative·reaction·concentration·Ready·correction fan-out을 고정한다. | R | MP-04, MP-D |
| `W5-09` | J01~J08의 UI-facing Actor·action·inventory·Activity parity 자동 증거를 고정한다. | R | MP-13, MP-J |
| `W5-10` | MP-01~MP-04의 기존 production-adapter 3-peer action·presentation·turn·Undo 자동 증거를 exact HEAD의 단일 scenario map으로 고정한다. | R | MP-01~MP-04 |

**W5 Exit:** Host authority와 shared presentation의 자동 증거가 한 경로로 고정된다. 실제 3창 rendered parity는 W9에서만 최종 수락한다.

### W6 — Inventory, Party Stash, rest, and DM live tools — 8 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W6-01` | DM item/GP grant·revoke와 owner projection refresh를 고정한다. | R | MP-E01~E03, MP-J05~J06 |
| `W6-02` | XP grant와 immediate level-up credit의 durable ownership을 고정한다. | R | MP-E04~E05 |
| `W6-03` | Stash shared/approval/DM-managed request lifecycle을 고정한다. | R | MP-E06~E11 |
| `W6-04` | transfer atomicity·journal·compensation·restart recovery를 고정한다. | R | MP-E12~E13 |
| `W6-05` | capability 기반 item-to-rations conversion을 고정한다. | R | MP-E14 |
| `W6-06` | Character+Campaign distributed Long Rest와 owner/Host recovery를 고정한다. | R | MP-F07~F09 |
| `W6-07` | connected DM Library materialization·handout·spatial capability를 고정한다. | R | MP-G |
| `W6-08` | 기존 Tauri H+P1 경로에서 지급·회수·Stash·Long Rest·handout 대표 flow를 검증한다. P2 observer parity의 최종 수락은 W9-02에서만 수행한다. | V | Journey J5, MP-E~G |

**W6 Exit:** DM live operation과 양쪽 durable owner transaction이 실제 앱에서 연결된다.

### W7 — Recovery, privacy, capability security, and accessibility — 8 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W7-01` | duplicate request/event batch/retry가 exactly-once로 처리된다. | R | MP-H01~H03 |
| `W7-02` | reconnect·late join·presentation catch-up이 reroll 없이 복구된다. | R | MP-H04~H08 |
| `W7-03` | Host restart와 Session end 후 transient state가 되살아나지 않는다. | R | MP-A08~A09, MP-H |
| `W7-04` | owner writeback·Host Campaign write·partial persistence recovery를 고정한다. | R | MP-B08, MP-H09~H12 |
| `W7-05` | DM-only/hidden/private payload·Activity·handout metadata가 누출되지 않는다. | R | MP-B05~B07, MP-09 |
| `W7-06` | protocol/rules/content/spatial capability mismatch가 명시적으로 차단된다. | R | MP-A05, MP-G08~G09 |
| `W7-07` | keyboard·screen reader·narrow desktop·Reduced Motion·correlated diagnostics를 고정한다. | R | MP-10, MP-I |
| `W7-08` | focused Tauri/Windows 경로에서 disconnect·restart·failure·privacy·accessibility 대표 case를 검증하고, 3/4창 comprehensive case는 W9-02에만 배치한다. | V | MP-08~10 |

**W7 Exit:** 실패·재접속·권한 차이에서도 중복·손실·정보 누출 없이 복구된다.

### W8 — Automated H+P1+P2 acceptance — 4 Gate / 5점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W8-01` | 기존 실제 Tauri H+P1 2창 smoke와 GP/Stash UI assertion을 보존한다. | R | MP-J05, MP-E08 |
| `W8-02` | 기존 하네스를 H+P1+P2와 선택적 P3 orchestration으로 확장한다. | B | MP-11 |
| `W8-03` | 120 scenario의 AUTO/STRUCTURE/WIN 요구와 정확한 테스트·artifact를 machine-readable map으로 만든다. | B | MP-11, MP-13 |
| `W8-04` | exact SHA에서 external content importer focused suite를 포함한 focused suites·connected full regression·TypeScript·Vite·Rust/Tauri·production build를 실행한다. | V | V1-60, MP-11 |

**W8 Exit:** protocol-only replica가 아닌 production adapter와 실제 Tauri 앱을 사용하는 자동 acceptance가 존재한다.

#### V1 external content importer closure slice — `W8-04` + `W9-03` 내부 수락 항목, 별도 Gate 아님

이 항목은 73번째 Gate를 추가하지 않는다. 기존 72 Gate·100점 공식을 유지하면서, **외부 non-builtin rules content를 production 앱이 실제로 수용하지 못하면 `W8-04`와 `W9-03`을 PASS할 수 없게 만드는 최종 통합 조건**이다. 현재 `W7` 실행을 중단하지 않으며, `W7-08` 종료 후 `W8-04`의 exact-SHA regression 전에 구현·자동 검증을 끝낸다.

- [x] production UI의 기존 `previewContentImport -> activateContentImport` 계약이 mock 단일 `CatalogEntry` 데모가 아니라 실제 external module JSON/manifest를 읽는다.
- [x] module/schema version, stable ID, content kind, provenance를 검증하고 malformed/unsupported payload와 builtin 또는 기존 external ID collision을 activation 전에 거부한다.
- [x] external module은 SRD builtin generator/allowlist에 편입하지 않는다. `moduleId`/provenance를 유지한 채 기존 content catalog authority에 등록한다.
- [x] V1 golden fixture 하나가 최소 `Background 1개 + Subclass 1개 + 해당 feature/rule definition`을 포함하고, 필요한 executable behavior는 기존 CommonPlay operation으로 표현한다.
- [x] imported definition은 기존 Catalog -> CommonPlay runtime -> `PendingResolution` -> canonical Resolver 경로를 사용한다. second catalog/store/Resolver/content authority를 만들지 않는다.
- [x] imported Background/Subclass가 Character creation 또는 progression의 합법 선택지로 나타나고, 획득 후 Sheet·Action·resource/effect 동작까지 연결된다. imported feat도 level-up의 능력치 향상/재주 선택지에 module provenance를 유지한 채 나타난다. (AUTO: tests/ui/externalContentGoldenModule.test.ts, tests/domain/installedSubclassProgression.test.ts)
- [ ] imported executable feature를 실제 Session에서 한 번 resolve하고 authoritative result와 Activity/presentation이 builtin content와 같은 경로를 사용함을 증명한다.
- [x] activation과 Character reference가 Tauri restart 뒤에도 해석 가능하며, 실패한 import는 기존 active catalog를 보존하고 half-installed state를 남기지 않는다.
- [ ] focused importer tests와 full TypeScript/Vite/Rust/Tauri production build를 같은 exact SHA에서 통과시키고, fixture module ID/version/hash와 명령·pass count를 evidence에 기록한다.
- [ ] `W9-03` Windows golden journey에서 실제 UI로 fixture를 import/activate하고 그 content로 Character를 만든 뒤 Session 1 사용 -> restart -> Session 2 재사용까지 캡처한다.

실행 순서는 `W7 closure -> importer closure slice -> W8-04 exact-SHA regression -> W9 Windows/golden journey`로 고정한다. importer 구현 때문에 W8 이후에 새 product SHA를 만들지 않는다.

### W9 — Windows release and next-session closure — 4 Gate / 10점

| ID | Gate | 초기 분류 | 연결 |
| --- | --- | --- | --- |
| `W9-01` | 기존 release build 경로를 사용해 동일 SHA의 production Windows `SimpleVTT.exe`와 digest를 생성한다. | B | V1-70, V1-80 |
| `W9-02` | 모든 적용 가능한 WIN scenario를 H/P1/P2, 필요 시 P3에서 실행하고 캡처한다. | B | MP-12, MP-13 |
| `W9-03` | Zero-to-Next-Session golden journey를 통과한다: first run → external content import/activate → imported Background/Subclass를 사용한 Character → Campaign → imported executable feature를 포함한 full Session → restart → Session 2 action. | B | legacy Journey J1~J9 |
| `W9-04` | exact-SHA evidence bundle·issue closure·clean tree·canonical update 후 V1을 선언한다. | B | V1-80, #110 |

**W9 Exit:** 동일 production artifact에서 첫 실행부터 external content import와 다음 세션까지 끊김 없이 재현된다.

## 4. 7개 실행 Wave

| Wave | Workstream | Gate 수 | 누적 Gate | 핵심 결과 |
| --- | --- | ---: | ---: | --- |
| `Wave 0` | W0 | 6 | 6/72 | 단일 source of truth와 evidence ledger |
| `Wave 1` | W1 + W4 | 16 | 22/72 | Character와 Campaign 실제 Tauri 기반 |
| `Wave 2` | W2 + W3 | 16 | 38/72 | SRD lifecycle과 complete local play |
| `Wave 3` | W5 + W6 | 18 | 56/72 | multiplayer presentation과 DM live operations |
| `Wave 4` | W7 | 8 | 64/72 | recovery·privacy·accessibility |
| `Wave 5` | W8 | 4 | 68/72 | automated H+P1+P2 acceptance |
| `Wave 6` | W9 | 4 | 72/72 | Windows release와 next-session closure |

### 의존성

```text
W0
├─ W1 ─> W2 ─> W3
└─ W4

W3 + W4
├─ W5
└─ W6

W5 + W6 ─> W7 ─> W8 ─> W9
```

`W1`과 `W4`는 Wave 0 이후 병렬 가능하다. `W5`와 `W6`도 W3/W4의 해당 기반이 PASS면 병렬 가능하다. 하지만 `W8`과 `W9`는 앞선 Gate를 우회하지 않는다.

## 5. 기존 Gate와 Issue 매핑

### 기존 18개 V1 release gate

| 기존 Gate | 새 Workstream |
| --- | --- |
| V1-00, V1-01 | W0 |
| V1-10~V1-13 | W4, W6 |
| V1-20~V1-21 | W1, W2, W3 |
| V1-30~V1-32 | W5, W7 |
| V1-40~V1-42 | W4, W5, W6, W7 |
| V1-50 | W7 |
| V1-60 | W8 |
| V1-70, V1-80 | W9 |

### MP-01~MP-13

| Issue | 새 Workstream | 처리 원칙 |
| --- | --- | --- |
| MP-01~MP-04 | W5 | 기존 구현을 먼저 exact-head 재검증 |
| MP-05~MP-07 | W6 | 기존 transaction·DM tool을 재사용 |
| MP-08~MP-10 | W7 | recovery/privacy/accessibility 증거 보완 |
| MP-11 | W8 | 실제 3-peer automated harness 확장 |
| MP-12 | W9 | Windows multi-instance release acceptance |
| MP-13 | W5, W8, W9 | UI-facing parity 자동·실창 증거 |

## 6. Evidence Card — 코드 변경 전 필수

모든 구현/수정 작업은 아래 8칸을 먼저 채운다.

```text
Gate ID:
Acceptance criterion:
Production entrypoint:
Existing implementation files:
Existing automated tests:
Existing Tauri/Windows evidence:
Exact observed failure:
Smallest required change:
```

다음 네 조건 중 하나가 없으면 제품 코드 변경을 금지한다.

1. 현재 exact HEAD에서 재현 가능한 실패가 있다.
2. 요구된 production entrypoint가 실제로 없다.
3. 구현은 있으나 실제 Tauri UI에서 접근할 수 없다.
4. ownership·persistence·privacy·recovery가 요구 계약과 다르게 동작한다.

## 7. 명시적 재구현 금지 목록

다음 시스템의 두 번째 구현을 만들지 않는다.

- Tauri desktop shell 또는 별도 desktop app
- Character Creator, Character Library, progression engine
- SRD content catalog, spell engine, Generic Resolver
- Campaign store, Character store, second persistence backend
- TCP/session transport, event ledger, authority path
- Resolution Presentation Envelope 또는 remote queue의 대체 경로
- VisualDice/CombatVfx의 network-only renderer
- Party Stash transaction/journal/compensation system
- distributed Long Rest coordinator
- DM Library 또는 handout system
- 새 E2E framework

기존 경로가 실패하면 대체 시스템을 추가하지 말고 기존 소유 경로를 최소 수정한다.

## 8. V1 최종 종료 조건

다음이 모두 참이어야 한다.

```text
72/72 Release Gate PASS
100.0/100.0 weighted score
120/120 applicable multiplayer scenarios PASS
18/18 legacy V1 release gates PASS
13/13 MP work issues closed with exact-SHA evidence
1 exact Git SHA
1 matching Windows artifact + digest
H/P1/P2 rendered parity PASS
P3 reconnect/late-join PASS
External content importer golden fixture PASS (W8-04 + W9-03)
Zero-to-Next-Session golden journey PASS
Git working tree clean
```

## 9. 바로 다음 정확한 작업

`W0-01`부터 시작한다.

1. `work/v1-composite`의 최신 HEAD와 정상 read-only CI를 다시 확인한다.
2. `W0-02` evidence ledger를 생성한다.
3. 기존 61개 `R/V` Gate의 production file·test·Tauri evidence를 ledger에 이관한다.
4. 이관 중 실제 증거가 없는 항목만 `V` 또는 `B`로 유지한다.
5. 이관이 끝나기 전에는 신규 feature 구현을 시작하지 않는다.