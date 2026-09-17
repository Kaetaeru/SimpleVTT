# 커스텀 NPC JSON 작성 가이드

저널 탭의 **+ NPC**(GM 전용)에 붙여 넣는 스탯 블록 형식이다. 붙여 넣으면 창 아래에 해석 결과(AC·HP·CR·행동 수)와 경고가 바로 보이고, **저널에 추가**를 누르면 `NPC` 폴더에 NPC 항목이 생긴다. 그 NPC는 SRD 몬스터와 똑같이 토큰으로 놓고, 턴 패널에서 공격·내성 행동을 굴리고, 피해 저항과 상태 효과가 계산된다.

파서: `client/compendium/customMonster.ts` (`parseCustomMonster`). 시험: `tests/client/r74.test.ts`. 결정 기록: D209.

## 1. 최소 형태

```json
{
  "name": "동굴 쥐왕",
  "ac": 12,
  "hp": 18,
  "abilities": { "str": 8, "dex": 14, "con": 12, "int": 6, "wis": 10, "cha": 4 },
  "actions": [
    { "name": "물기", "attack": { "mode": "melee", "bonus": 4, "damage": [{ "formula": "1d6+2", "type": "piercing" }] } }
  ]
}
```

`name`, `ac`, `hp`, `abilities`의 여섯 값은 **필수**다. 없으면 추가되지 않고 무엇이 빠졌는지 알려 준다. 나머지는 모두 선택이며 비우면 아래 기본값을 쓴다. 모르는 필드는 무시된다.

## 2. 최상위 필드

| 필드 | 형식 | 기본값 / 설명 |
|---|---|---|
| `name` | 문자열 | 필수. 화면에 보이는 이름 |
| `nameEn` | 문자열 | `name`. id 슬러그에도 쓰인다 |
| `size` | `tiny` `small` `medium` `large` `huge` `gargantuan` | `medium`. 토큰 크기 |
| `type` | 문자열 | `인간형`. 화면용 종류 ("인간형", "야수" …) |
| `creatureType` | 문자열 | `humanoid`. 필터용 영문 종류 |
| `alignment` | 문자열 | 빈 값 |
| `ac` | 숫자 | 필수 |
| `acText` | 문자열 | 방어구 설명 ("판금") |
| `hp` | 숫자 ≥ 1 | 필수. 최대 HP |
| `hitDice` | 문자열 | 표시용 ("8d8+16") |
| `speed` | 숫자(ft) | `30` |
| `speeds` | `{ "fly": 60, "swim": 30 }` | 보행 외 속도 |
| `abilities` | `{ str, dex, con, int, wis, cha }` 점수 | 필수. 수정치는 자동 계산 |
| `cr` | 숫자 (`0.125`, `0.25`, `0.5`, `1` …) | `0`. 숙련 보너스를 CR에서 계산 |
| `xp` | 숫자 | `0` |
| `saveProficiencies` | `["dex", "wis"]` | 내성 = 수정치 + (숙련이면 숙련 보너스) |
| `skills` | `{ "stealth": 5 }` | 최종 보너스 그대로 |
| `initiativeBonus` | 숫자 | 민첩 수정치 |
| `passivePerception` | 숫자 | 10 + 지혜 수정치 |
| `damageResistances` `damageImmunities` `damageVulnerabilities` | 피해 타입 배열 | 계산에 쓰인다 (§4) |
| `conditionImmunities` | 상태 id 배열 | §5 |
| `senses` `languages` | 문자열 | 표시용 |
| `traits` `actions` `bonusActions` `reactions` `legendaryActions` | 행동 배열 | §3 |
| `legendaryActionsPerRound` | 숫자 | `0` |
| `legendaryResistance` | 숫자 | `0` (하루 횟수) |

## 3. 행동 (`traits`, `actions`, `bonusActions`, `reactions`, `legendaryActions`)

모든 행동은 `name`이 필수이고 `text`(설명)는 선택이다. 아래 셋 중 **하나만** 쓴다. 아무것도 없으면 글로만 보이는 행동이다(특성, 반응 설명 등).

### 공격 — `attack`

```json
{ "name": "장검", "attack": { "mode": "melee", "bonus": 5, "rangeFeet": 5,
  "damage": [{ "formula": "1d8+3", "type": "slashing" }, { "formula": "2d6", "type": "fire" }],
  "conditions": ["prone"] } }
```

- `mode`: `melee` 또는 `ranged`
- `bonus`: 명중 보너스(최종값)
- `rangeFeet`, `longRangeFeet`: 사거리
- `damage`: 피해 배열. `formula`는 `"2d6+3"`, `"1d8-1"`, `"7"`(고정) 형식
- `conditions`: 명중 시 적용할 상태 id (선택)
- `text`를 비우면 공격 설명을 자동으로 만든다

### 내성 굴림 — `save`

```json
{ "name": "화염 숨결", "recharge": { "min": 5 },
  "save": { "ability": "dex", "dc": 13, "areaFeet": 15,
    "damage": [{ "formula": "6d6", "type": "fire" }], "onSuccess": "half", "conditions": [] } }
```

- `ability`: `str` `dex` `con` `int` `wis` `cha`
- `onSuccess`: `half`(기본) 또는 `none`
- `conditions`: 실패 시 상태

### 다중공격 — `multiattack`

```json
{ "name": "다중공격", "text": "물기 한 번, 발톱 두 번.",
  "multiattack": { "routine": [{ "name": "물기", "count": 1 }, { "name": "발톱", "count": 2 }] } }
```

`routine`의 `name`은 같은 NPC의 공격 행동 이름과 **정확히** 같아야 한다.

### 공통 선택 필드

- `recharge`: `{ "min": 5 }` = 재충전 5–6
- `legendaryCost`: 전설 행동 비용 (`legendaryActions` 안에서)

## 4. 피해 타입 (영문 id)

`acid` `bludgeoning` `cold` `fire` `force` `lightning` `necrotic` `piercing` `poison` `psychic` `radiant` `slashing` `thunder`

다른 값도 들어가지만 저항·면역 계산에 걸리지 않으므로 경고가 뜬다.

## 5. 상태 id (영문)

`blinded` `charmed` `deafened` `exhaustion` `frightened` `grappled` `incapacitated` `invisible` `paralyzed` `petrified` `poisoned` `prone` `restrained` `stunned` `unconscious`

모르는 id는 경고와 함께 버린다.

## 6. 전체 예시

붙여 넣기 창의 **예시 넣기** 버튼이 넣는 것과 같다.

```json
{
  "name": "늪지 도적 두목", "nameEn": "Bog Bandit Captain",
  "size": "medium", "type": "인간형", "creatureType": "humanoid", "alignment": "혼돈 악",
  "ac": 15, "acText": "스터디드 레더", "hp": 52, "hitDice": "8d8+16", "speed": 30,
  "abilities": { "str": 14, "dex": 16, "con": 14, "int": 11, "wis": 12, "cha": 14 },
  "saveProficiencies": ["dex", "wis"], "skills": { "stealth": 5, "perception": 3 },
  "damageResistances": ["poison"], "senses": "암시야 60ft", "languages": "공용어, 도적 은어",
  "cr": 3, "xp": 700,
  "traits": [{ "name": "늪지 은신", "text": "늪이나 습지에서 민첩(은신) 판정에 유리합니다." }],
  "actions": [
    { "name": "다중공격", "text": "시미터로 두 번 공격합니다.", "multiattack": { "routine": [{ "name": "시미터", "count": 2 }] } },
    { "name": "시미터", "attack": { "mode": "melee", "bonus": 5, "damage": [{ "formula": "1d6+3", "type": "slashing" }] } },
    { "name": "중형 쇠뇌", "attack": { "mode": "ranged", "bonus": 5, "rangeFeet": 80, "longRangeFeet": 320, "damage": [{ "formula": "1d8+3", "type": "piercing" }] } },
    { "name": "독 안개 병", "text": "10피트 반경에 독 안개를 던집니다.", "recharge": { "min": 5 },
      "save": { "ability": "con", "dc": 13, "damage": [{ "formula": "3d6", "type": "poison" }], "onSuccess": "half", "conditions": ["poisoned"], "areaFeet": 10 } }
  ],
  "bonusActions": [{ "name": "물러서기", "text": "추가 행동으로 이탈 행동을 합니다." }],
  "reactions": [{ "name": "받아넘기기", "text": "보이는 공격자의 근접 공격이 명중하기 전에 AC +2." }]
}
```

## 7. 코딩 에이전트에게 맡길 때

이 문서를 함께 주고 아래처럼 요청한다.

> 첨부한 CUSTOM_NPC_JSON.md 형식으로 NPC 스탯 블록 JSON 하나만 출력해줘. 설명이나 코드 펜스 없이 JSON만.
> 규칙: `name`·`ac`·`hp`·`abilities` 여섯 값은 반드시 넣는다. 피해 `type`과 상태 id는 §4·§5의 영문 id만 쓴다. 피해 `formula`는 `"XdY+Z"` 형식이다. 명중 보너스와 내성 DC는 최종값으로 쓴다(보통 명중 = 숙련 보너스 + 능력 수정치, DC = 8 + 그 값). 다중공격 `routine`의 이름은 같은 NPC의 공격 이름과 정확히 같게 한다. 기계적으로 표현할 수 없는 능력은 `text`만 있는 행동으로 쓴다.
> 만들 NPC: (컨셉, CR, 역할 등)

붙여 넣은 뒤 경고가 뜨면 그 문장을 그대로 에이전트에게 돌려주면 고칠 수 있다.

## 8. 한계

- 주문 시전(`spellcasting`)은 아직 JSON으로 받지 않는다. 주문은 `text` 행동으로 적는다.
- 다중공격의 "A 또는 B" 대안(`alternatives`)은 받지 않는다.
- 한 번 추가한 NPC의 스탯 블록은 저널에서 고칠 수 없다. JSON을 고쳐 다시 추가한다.
