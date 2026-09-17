# 하드코딩 감사 — 규칙 내용을 JSON으로 옮기기 위한 목록

소유자 지시(2026-09-17): "하드코딩된 것들 싹 다 풀어내서 JSON 형태로. JSON으로 만드는 게 불가능하거나 오히려 손해인 것만 하드코딩."
이 문서는 **옮기기 전 준비**다. 코드는 아직 바꾸지 않았다.

## 0. 왜

- 사용자가 설치하는 모듈(PHB 보충 등)은 **JSON뿐**이다. 코드에 박힌 규칙은 SRD의 그 ID·이름에만 작동하고, 모듈이 같은 모양의 특성·주문·몬스터를 가져와도 자동화되지 않는다.
- 같은 규칙이 두 곳(코드 표 + 계약 JSON)에 있으면 어긋난다. D184(표 비우기)와 같은 원칙이다.

## 1. 판정 기준

| 판정 | 기준 |
|---|---|
| **JSON으로** | 특정 콘텐츠(직업·서브클래스·특성·주문·몬스터·아이템)의 이름·ID·수치·레벨표에 묶인 것. 모듈이 같은 것을 새로 정의할 수 있어야 하는 것. |
| **코드 유지** | 모든 콘텐츠가 공유하는 5e 핵심 규칙 어휘(상태의 효과, 피해 유형, 능력치, 주사위 문법, 계약 문법 자체), UI 표기, 보안·통신 한도. 모듈이 재정의할 일이 없고 JSON으로 빼면 간접 참조만 늘어나는 것. |
| **문법 추가 후 JSON** | 지금 문법으로 표현할 수 없어서 코드에 박은 것. 범용 연산을 **한 번** 코드에 추가하고, 어느 콘텐츠가 쓰는지는 JSON에 적는다. |

## 2. JSON으로 옮길 것

### 2.1 이번 세션(R89~R103)에 들어간 하드코딩

| # | 위치 | 지금 | JSON 목표 | 필요한 문법 |
|---|---|---|---|---|
| S1 ✔ H2 | `rules/attackSpec.ts` `HUNTERS_MARK`, `effects.ts`·`contractEffects.ts` `hunters-mark.die/advantage/keeps-concentration` | 사냥꾼의 표식 주문 ID 상수, 그 주문 전용 속성 이름 | 계약 `property.modify` `marked-spell.die` / `marked-spell.advantage` / `concentration.damage-immune`, 값에 `spellId` | 속성에 대상 주문 ID 매개변수 |
| S2 ✔ H2 | `attackSpec.ts` `TRUE_STRIKE`, `trueStrikeList`, `PageCanvas.tsx` 체크박스, `protocol.ts` `trueStrike` | 진실의 일격 ID와 전용 라이더 | 주문 메커닉 `weaponSpell: { ability: "spellcasting", extraDice: [{ level: 5, dice: "1d6", type: "radiant" }, …] }`, 판정 전 창은 "무기 주문" 목록을 읽음 | `weapon-spell` 주문 메커닉 + `AttackRiders.weaponSpell: spellId` |
| S3 ✔ H2 | `character/derive.ts` `invocation:agonizing-blast:` 플래그 파싱, `spellcast.ts` `damageModifier` | 기원술 이름을 코드가 읽음 | 기원술 계약 `property.modify` `spell.damage.ability-modifier` + 고른 대상 소마법 참조 | 선택된 대상 주문을 참조하는 속성 |
| S4 ✔ H3d | `tracks.ts` `picked === "thaumaturge"/"magician"/"protector"/"warden"`, `wis-skill-bonus:` 플래그 | 질서 선택지 ID 분기 | 선택지 계약: `proficiency.weapon/armor`, `cantrips.bonus`, `skill.<id>.bonus` 값 `max(1, wis)` | 기존 문법(표현식 `max`) |
| S5 ✔ H3 | `tracks.ts` `key === "body-and-mind"/"slippery-mind"/"scholar"`, 전승 학파 `bonus-proficiencies` | 특성 키 분기 | 특성 계약 `ability.score.bonus`(상한), `saving-throw.proficiency`, `choice.expertise`(목록), `choice.skills`(개수) | 만들기 단계 연산 (§3) |
| S6 ✔ H1 | `attackSpec.ts` `traitPatterns`, `monsterAuras`(R103, 커밋 전), `regenerationOf`, `magicResistance` 정규식, `NpcSheet.tsx` 특성 힌트 | 영문 특성 이름·한국어 설명문 정규식 | SRD 색인 `monster-traits.json`: `{ monsterId: [{ pattern: "absorb", type: "lightning" }, { pattern: "undead-fortitude" }, { pattern: "bloodied-advantage" }, { pattern: "evasion" }, { pattern: "magic-resistance" }, { pattern: "regeneration", amount: 10 }, { pattern: "aura-damage", dice: "1d10", type: "fire", when: "owner-turn-end" }] }`. 사용자 NPC JSON(D209)도 같은 `traits[].pattern` 사용 | 패턴 실행기(코드) + 색인(데이터) |
| S7 ✔ H2 | `host.ts` `WOUNDED_FACT = "target-below-max-hp"` | 사실 ID를 호스트가 이름으로 앎 | 계약 `when: { ref: "target.hp.below-max" }` — 스코프 참조로 표에서 계산되는 사실 | 명중 창 스코프에 대상 참조 |
| S8 ✔ H2 | `resolve.ts`·`spellcast.ts` 행동불능 목록 리터럴 중복 | 규칙 어휘인데 여러 곳에 복제 | 코드 유지하되 **한 곳**(`CANNOT_ACT` 재사용) — JSON 아님 | — |

### 2.2 세션 이전부터 있던 하드코딩

| # | 위치 | 지금 | JSON 목표 | 필요한 문법 |
|---|---|---|---|---|
| P1 (일부 ✔ H3: 원초의 투사·야성 감각·불굴의 힘·드루이드어·도둑 은어·마법의 비밀·단련된 생존자; H3c ✔ 비무장 방어·빠른 이동·비무장 이동·만능재주·무술; H4 ✔ 주문 시전 플래그 → `casterKind`) | `tracks.ts` 특성 키 분기: `fast-movement`, `unarmored-defense`, `unarmored-movement`, `martial-arts`, `jack-of-all-trades`, `disciplined-survivor`, `primal-champion`, `feral-senses`, `indomitable-might`, `druidic`, `thieves-cant`, `magical-secrets`, `pact-magic`, `spellcasting` | 특성 키 → 플래그 → `derive.ts`가 플래그로 계산 | 특성 계약: `speed.walk`(조건 `armor.training`), `ac.unarmored-formula`, `skill.all.half-proficiency`, `saving-throw.proficiency`, `ability.score.bonus`, `senses.blindsight`, `language.grant`, `spell-list.any` | `ac.unarmored-formula`, `language.grant`, `check.minimum`, `spell-list.*` 추가 |
| P2 ✔ H3 | `tracks.ts` `expertise`, `deft-explorer`, `fighting-style`, `primal-knowledge`, `blessed-strikes`, `elemental-fury`, `mystic-arcanum-N` | 선택 요청을 특성 키로 분기 | 특성 계약 `choice.*` 연산(`choice.expertise`, `choice.languages`, `choice.fighting-style`, `choice.skills`, `choice.class-option`, `choice.spell` + 무료 시전 자원) | §3 만들기 연산 |
| P3 ✔ H3 | `tracks.ts` 기원술 slug 분기: `pact-of-the-tome`, `gift-of-the-depths`, `witch-sight`, `devils-sight` | 기원술 ID 분기 | 기원술 계약: `choice.spells`, `speed.swim`, `senses.truesight`, `senses.devils-sight` | §3 + 감각 속성 |
| P4 ✔ H3c | `derive.ts` slug 분기: 용의 회복력 AC(`sorcerer` draconic), 방랑자 이동(`ranger` 6), 보호의 오라 내성(`paladin` 6) | 직업 slug·레벨 비교 | 해당 특성 계약 `ac.unarmored-formula`, `speed.walk`(조건: 중갑 아님), `saving-throw.bonus`(이미 계약 있음 — 코드와 이중 계산 위험) | 기존 + `ac.unarmored-formula` |
| P5 ✔ H3·H4 | `tracks.ts` `cls.slug === "paladin"/"ranger"` 전투 방식 대체 선택지, `cls.slug === "sorcerer"` 메타매직 | 직업 slug 분기 | 직업 데이터: 전투 방식 선택지 목록에 대체 항목, 메타매직 선택 스케줄 | 직업 JSON 필드 |
| P6 ✔ H4 (`COLUMN`·`numericColumn`은 진행표 열 어휘로 남음) | `rules/classes.ts` `CLASS_TRAINING`, `SPELLCASTING_ABILITY`, `ASI_LEVELS`, `EXPERTISE_SCHEDULE`, `FIGHTING_STYLE_LEVEL`, `METAMAGIC_KNOWN`, `MYSTIC_ARCANUM`, `WIZARD_SPELLBOOK`, `COLUMN`, `CLASS_RESOURCES`(29개, 최대치 함수 포함) | 12직업 표가 TS 상수 | 직업 모듈 JSON(`progression`, `resources: [{ id, max: 표현식 또는 열 이름, recovery }]`). 모듈 직업이 자원·스케줄을 가질 수 있어야 함 | 자원 최대치 표현식(계약 표현식 재사용) |
| P7 ✔ H7b | `client/data/srd/*.ts` 739줄 (`classFeatures`, `subclasses`, `classOptions`, `species`, `spellLists`, `featsAndBackgrounds`) | SRD 콘텐츠가 TS 파일 | `content/modules/dnd-srd-5.2.1.*` JSON으로 이동 | 없음(형식 변환) |
| P8 ✔ H4 | `rules/tables.ts` `MULTICLASS_PREREQUISITES` | 직업별 멀티클래스 조건 | 직업 JSON `multiclass.prerequisites` | 직업 JSON 필드 |
| P9 ✔ H3d | `tracks.ts` `LAND_RESISTANCE`, `subclass.land-type`·`elemental-affinity` 분기 | 서브클래스 선택지 효과 분기 | 선택지 계약 `resistance`, `condition-immunity` | 기존 문법 |
| P10 (암습 ✔ H5a, 신성한 강타 ✔ H5b; 야만적 공격자는 재주 설정 키라 남음) | `attackSpec.ts` 암습(`sneakDice`, `hasSneakAttack`), 신성한 강타(`hasSmite`, `SMITE_LABEL`, 악마·언데드 +1d8), `HIT_BUILT_INS`, 야만적 공격자 `featEffects` | 명중 창 내장 라이더 | `on-hit` 계약: 암습 `diceCount: ceil-div(rogue level, 2)` + 조건 사실(유리 또는 인접 아군 — 버튼), 강타 `damage.apply` + 슬롯 비용 + `when: target.type in [fiend, undead]` | 슬롯 비용 연산, 대상 유형 참조 |
| P11 ✔ H5c | `activation.ts` `FEATURE_ACTIVATIONS` 4개(공격 흘리기, 브레스 무기, 아드레날린 분출, 안수), `breathDice`, `METAMAGIC_COST`, `NOT_ACTIVATABLE` | 손으로 쓴 사용 규칙 | 각 특성 계약(`damage.apply` 레벨 표현식, `temp-hp.grant`, 점수 풀 사용), 메타매직 선택지 계약 `resource.change` | 점수형 풀 사용 연산 |
| P12 ✔ H5d | `effects.ts` `EFFECT_RULES["spell:aid"]` | 남은 손 규칙 1개 | 효과 계약 `hp.maximum` + 시작 시 `healing.apply` | 기존 문법 |
| P13 ✔ H5d | `items.ts` `POTIONS` 정규식(치유 물약 등급), 소모품 판정 정규식 | 아이템 이름 정규식 | 아이템 메커닉 JSON `use: { heal: "2d4+2" }`, `consumable: true` | 아이템 사용 메커닉 |
| P14 ✔ H6a | `summons.ts` `SUMMON_RULES`(5), `CONJURES_NOTHING`(6), `STEEDS` | 주문 ID별 소환 규칙 | 주문 메커닉 `summon`(R84에 이미 있음)으로 합치고, 소환 없음은 `summon: false` + 사유 | 기존(R84) |
| P15 ✔ H6b | `host.ts` `COUNTERSPELL`, 방패 반응(`pcReactionSpell(… "shield")`), `Notify.tsx` 두 ID | 반응 주문 ID | 주문 메커닉 `reaction: { trigger: "attack.hit-self", acBonus: 5 }`, `reaction: { trigger: "spell.cast-seen", counter: true }` — 반응 창이 주문 목록을 읽음 | 반응 주문 트리거 |
| P16 ✔ H1 | `PageCanvas.tsx` `SITUATIONAL`(무리 전술·태양광 과민성·투명 정규식) | 특성 이름 정규식 | S6 색인 패턴 `pack-tactics`, `sunlight-sensitivity` → 상황 버튼 | S6 |
| P18 ✔ H6c | `spellcast.ts` `REPEAT_SAVE` — 주문 요약문에서 "턴이 끝날 때 … 내성 굴림을 반복"을 정규식으로 찾음 | 설명문 정규식 | 주문 실행 데이터 필드(`repeatSave: "turn-end"`) | 주문 메커닉 필드 |
| P19 ✔ H6c | `effects.ts` `effectRuleKey` — 주문 효과 계약 키를 영문 주문 이름 slug로 만듦(`spell:aid`) | 이름에서 키를 만듦(모듈 주문이 같은 영문명이면 충돌) | 계약 키를 주문 ID로(`spell:<spellId>`) | ID 체계 |
| P20 ✔ H7a (H6c 뒤 발견) | `origin.ts` `traitKey === …` 분기, `SPECIES_TRAIT_RESOURCES`, `species.id.endsWith("gnome")`, `SPECIES_BASE_CANTRIPS` | 종족 특성 키·ID 분기(검사 정규식 `key === "`가 `traitKey`를 놓침) | 특성 gain 계약, 색인 `spellUses` | `grant.resource`, `per: character` |
| P17 ✔ H4 | `classes.ts` `fiend-patron` 자원, `catalog.ts` 기본 기원 재주 `feat.skilled`, `tracks.ts` `ASI_FEAT_ID` | 콘텐츠 ID 기본값 | 배경 JSON `originFeat` 필수화, 직업 JSON `asiFeat` | 필드 |

## 3. 추가해야 할 범용 문법

만들기 단계(`tracks.ts`가 실행):
- `ability.score.bonus` { ability, amount, cap }
- `saving-throw.proficiency` { abilities | "all" }
- `choice.skills` { count, from } · `choice.expertise` { count, from } · `choice.languages` { count } · `choice.spells` { count, list, level, prepared | alwaysPrepared, freeCast }
- `choice.class-option` { list } · `choice.fighting-style`
- `choice.spell` { resourceId, recovery, atWill } · `grant.resource` { id, recovery, spell } · `grant.ritual-casting` · `grant.spellbook-picks` { school } (D261)
- `grant.spells` { spells, into } · `choice.spells` { classes, levels } (D262)
- 사용: `damage.apply` { save, diceSides } → 표의 `strikes` · `healing.apply` { pool: half-max } · 예약 자원 `resource.spell-slot` · `resource.lockout` { resource, dice } · `adjudication.request` { amount } · 진입점 `killer: nearby` · 속성 `healing.self-on-slot-heal`, `marked-spell.reveal-defenses` · 기습 이니셔티브 `tracker.add.surprised` (D263)
- `condition.apply` { duration {kind rounds|minutes|hours|permanent, amount, boundary, anchor}, repeatSave: turn-end, successMark } · 탑승 속성 `target.mark` { mark {name, nextSave, nextAttack {advantage, bonus, by}} } · 표 `conditionSaves` (D264)
- 효과 계약 `effect.upkeep`, 속성 `effect.upkeep-waived` { effect } — 호스트의 격노 키 상수 제거 · `resource.change` { upTo } · 예약 자원 `resource.exhaustion` · 표 `party.healPoints` + `act.contract.amount` (D265)
- `language.grant` · `senses.*`(truesight, devils-sight) · `speed.swim/climb`
- `ac.unarmored-formula` { abilities, shieldAllowed }

전투(호스트·리졸버가 실행):
- 속성 매개변수 `spellId`(S1), 대상 참조 `target.hp.below-max`, `target.type`(S7, P10)
- 주문 메커닉 `weaponSpell`(S2), `reaction`(P15)
- 몬스터 특성 패턴 실행기(S6): `absorb`, `undead-fortitude`, `bloodied-advantage`, `evasion`, `magic-resistance`, `regeneration`, `aura-damage`, `pack-tactics`, `sunlight-sensitivity`, `legendary-resistance`

## 4. 코드에 남길 것 (이유)

| 위치 | 이유 |
|---|---|
| `resolve.ts` 상태별 유리·불리(장님, 넘어짐, 마비 …), `actions.ts` `CANNOT_ACT`, `play.ts` `CONDITIONS` | 2024 핵심 규칙의 상태 정의. 모든 콘텐츠가 참조하고 모듈이 재정의하지 않는다. |
| 피해 유형·능력치·기술 한국어 표(`TYPE_KO`, `ABILITY_KO`, `SKILL_KO` …) | 표기 어휘. JSON으로 빼도 한 곳에서 한 곳으로 옮길 뿐이다. |
| `tables.ts` 슬롯표·경험치표·표준 배열, 소마법 5/11/17 확장 | 핵심 규칙 표. 직업마다 다르지 않다. |
| 무기 숙련(`MASTERY_LABEL`)·무기 속성 표기 | 2024 고정 어휘. 모듈이 새 숙련을 만들면 그때 재검토. |
| 계약 문법 집합(`COMPUTED_OPERATIONS`, `PROPERTIES`, `ATTACK_INVOCATIONS` …) | 문법 자체. |
| 채팅 명령 정규식, `LIMITS`, UI 색·라벨, 지속시간 한국어 단위 파싱(`ROUNDS_PER`) | UI·통신·보안. |
| `activation.ts` `featureRuleKey` ID 규칙 | ID 체계 해석. |
| `model.ts` `ReactionPrompt.kind`의 `"shield"`·`"counterspell"` (H6b) | 저장된 캠페인 채팅 기록이 이 창 종류를 들고 있다. 이름을 바꾸면 옛 기록이 깨진다. 어떤 주문이 답하는지는 `spellId`와 색인이 정한다. |
| `scripts/generate-monster-catalog.mjs` 스탯 블록 문장 해석(명중·피해·내성·`repeatSave`) (H6c) | 콘텐츠 생성기가 SRD 번역 문장을 한 번 읽어 몬스터 JSON 필드로 적는다. 실행 코드는 필드만 읽고, 모듈·붙여넣은 NPC는 필드를 직접 쓴다. |
| `PageCanvas.tsx` 토큰 복제 이름 정규식("고블린 2") | 사용자가 붙인 토큰 이름에 번호를 붙이는 UI. 콘텐츠 규칙이 아니다. |
| 계약 안내문 | V1(D253)부터 규칙을 읽지 않는다. 행동 경제는 `payments`의 `economy`. |
| `tracks.ts` 진행표 행 단어 `"Ability Score Improvement"`, `"Epic Boon"`, `"Subclass Feature"`, `/Subclass$/` (H4) | 직업 진행표 형식의 어휘. SRD와 모듈 직업표가 같은 단어로 행을 쓴다. |

## 5. 진행 순서 (제안)

1. **H1 몬스터 특성 색인**(S6, P16) — 패턴 실행기 + `monster-traits.json`, 사용자 NPC JSON도 같은 형식. R103 오라(커밋 전)는 여기서 다시 만든다.
2. **H2 이번 세션 전투 하드코딩**(S1, S2, S3, S7, S8) — 속성 매개변수, 무기 주문, 대상 참조.
3. **H3 만들기 문법**(§3 만들기) + S4, S5, P1~P5, P9 — `tracks.ts`·`derive.ts` 분기 제거.
4. **H4 직업 표 → 직업 JSON**(P6, P8, P17) — 자원·스케줄.
5. **H5 내장 라이더·사용 규칙**(P10, P11, P12, P13) — 암습·강타·브레스·물약.
6. **H6 반응·소환 주문 메커닉**(P14, P15).
7. **H7 SRD TS 데이터 → JSON**(P7) — 형식 변환만.

슬라이스마다 옮긴 뒤 검사 테스트(`hardcode.test.ts`: `client/` 안의 `dnd.srd521.` 리터럴, 특성 키 분기, 특성 이름 정규식 개수 상한)를 줄여 가며 게이트에 둔다.

## 6. 현재 상태 (측정값)

- R89~R102 커밋됨. R103 몬스터 오라 편집은 **커밋하지 않음**(H1에서 색인 방식으로 다시 만든다).
- `client/`(data/srd 제외) 안 `"dnd.srd521.*"` 리터럴 22건, `tracks.ts` `key ===` 분기 25종, slug·선택지 분기 15건, 특성 이름·설명문 정규식 9곳, 콘텐츠 상수표 약 20개.
