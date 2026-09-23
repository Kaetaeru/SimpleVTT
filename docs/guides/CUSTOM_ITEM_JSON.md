# 커스텀 마법 아이템 JSON 작성 가이드

캐릭터 시트의 **아이템 추가** 창 아래 **커스텀 마법 아이템 (JSON 붙여넣기)** 에 붙여 넣는 형식이다. 해석 결과와 경고가 바로 보이고, **이 캐릭터에게 지급**을 누르면 가방에 들어간다. GM은 저널에서 그 캐릭터의 시트를 열어 지급한다. 시트를 편집할 수 있는 플레이어도 같은 창을 쓸 수 있다.

파서: `client/character/customItem.ts` (`parseCustomItem`). 시험: `tests/client/r75.test.ts`. 결정 기록: D210.

## 1. 동작 규칙

- 아이템의 숫자(보너스·저항)는 시트에 **출처와 함께** 더해진다. 명중·AC 위에 마우스를 올리면 아이템 이름이 보인다.
- `attunement: true`면 가방 줄의 **조율** 버튼을 눌러야 효과가 켜진다. 한 캐릭터는 동시에 3개까지 조율한다. 4번째는 거절되고 기록에 남는다.
- `base`가 방어구나 방패면 **착용했을 때만** 효과가 켜진다. 착용 버튼은 그 방어구와 같다.
- `base`가 무기면 공격 표에 **아이템 이름으로 된 공격 줄이 따로** 생긴다. `attack`과 `damage` 보너스는 그 줄에만 붙는다. 테이블의 ⚔ 공격도 그 줄로 굴린다.
- 그 밖의 아이템(반지, 망토 등)은 가방에 있는 동안(조율이 필요하면 조율한 동안) 켜진다.

## 2. 필드

| 필드 | 형식 | 설명 |
|---|---|---|
| `name` | 문자열 | **필수**. 가방과 공격 표에 보이는 이름 |
| `type` | 문자열 | `weapon` `armor` `shield` `ring` `wondrous` `potion` 등. 표시용. 기본 `wondrous` |
| `rarity` | `common` `uncommon` `rare` `very-rare` `legendary` `artifact` | 가방 줄에 ✦ 희귀도로 보인다 |
| `attunement` | `true` / 생략 | 조율 필요 여부 |
| `description` | 문자열 | 가방 줄에 마우스를 올리면 보인다 |
| `base` | 문자열 | 기반 SRD 아이템. 영문 id 끝(`longsword`, `chain-mail`, `shield`), 영문 이름(`Longsword`), 한국어 이름(`장검`), 전체 id(`dnd.srd521.item.weapon.longsword`) 모두 된다 |
| `bonus` | 객체 | §3 |
| `saveAbilities` | `["wis", "cha"]` | `bonus.saves`를 이 능력의 내성에만 붙인다. 생략하면 모든 내성 |
| `resistances` | 피해 타입 배열 | 영문 id (§4). 시트의 저항 목록에 더해진다 |
| `notes` | 문자열 배열 | 계산할 수 없는 효과. 가방 줄에 마우스를 올리면 설명 아래에 보인다 |
| `use` | 객체 | 턴 패널에서 썼을 때: `healing`("2d4+2" 형식, 마실 대상을 골라 굴려 회복)과 `consumes`(true면 하나 줄어듦). 회복이 있으면 소모된다. 이름에 "물약"이 들어가도 `use`가 없으면 회복하지 않는다(D247). D353: `tempHp`("10", "2d4" — 마신 쪽 임시 HP), `effect`(`{ "name", "duration": "1시간", "rounds", "grants": { 아이템과 같은 필드 } }` — 마신 쪽에 그 시간 동안 붙는다. `rounds`를 생략하면 지속시간 글에서 센다), `spell`(`{ "spellId", "duration" }` — 마신 쪽이 집중 없이 그 주문의 효과를 받는다). `effect.permanent: true`면 끝나지 않는 효과(교본: `grants.abilityBonuses`로 영구 +2), 두 번 쓰면 두 번 더해진다 (D356). 셋 중 하나라도 있으면 소모되고, 턴 패널에서 마실 대상을 고른다 |
| `charges` | 객체 | 충전: `max`(최대치), `recharge`("1d6+4" 형식, 긴 휴식(새벽)에 이만큼 돌아온다. 생략하면 긴 휴식에 전부), `note`(다 쓰면 부서지는지 같은 서사 — "DM 판정"). 시트의 자원에 "이름 충전"으로 보인다 (D351) |
| `spells` | 배열 | 충전으로 시전하는 주문: `{ "spellId", "charges", "dc", "attackBonus", "level" }`. 아이템이 작동할 때(조율이 필요하면 조율 중) 주문 목록에 들어가고, 그 충전 풀로 시전하면 주문마다 적힌 충전이 빠진다. `dc`·`attackBonus`를 생략하면 시전자의 값, `level`을 생략하면 주문 레벨 (D351). `perLevel`·`maxLevel`: 충전을 `perLevel`개 더 쓸 때마다 한 레벨 높게, `maxLevel`까지 — 시전 창이 레벨별로 보여 준다 (D356) |
| `abilities` | 객체 | 작동하는 동안 능력치를 이 값으로: `{ "str": 19 }`. 이미 더 높으면 그대로 (D352) |
| `immunities` | 피해 타입 배열 | 영문 id (§4). 피해 면역 (D352) |
| `conditionImmunities` | 상태 배열 | `poisoned`, `charmed`, `frightened` … 상태 면역 (D352) |
| `speeds` | 객체 | `{ "fly": 60 }`, `{ "swim": "walk" }` — 피트 수 또는 보행 속도와 같음 (D352) |
| `darkvision` | 숫자(ft) | 암시야 (D352) |
| `attunementRequires` | 객체 | 누가 조율할 수 있나: `{ "spellcaster": true }`(직업의 주문 시전·계약 마법이 있는 캐릭터), `{ "classes": ["cleric", "paladin"] }`(직업 id나 그 끝 부분), `note`(앱이 확인 못 하는 조건). 안 되면 조율 버튼이 이유를 보여 준다 (D360) |
| `curse` | 객체 | 저주: `cannotUnattune`(조율을 풀 수 없음), `grants`(아이템과 같은 필드 — 불이익·취약), `note`. 작동하는 동안 걸리고, 가방 줄의 "저주 풀기"(DM 판정)로 풀면 끝난다 (D360) |
| `vulnerabilities` | 피해 타입 배열 | 피해 취약 — 표가 그 피해를 두 배로 받는다 (D360) |
| `worksWhen` | `"held"` | 손에 쥐고 있을 때(주 손·보조 손 칸)만 작동 — 지팡이·막대처럼. 조율이 필요하면 조율도 해야 한다 (D359) |
| `uses` | 배열 | `charges` 말고 따로 세는 풀: `[{ "id": "bolt", "label": "번개", "max": 2, "recharge": "short-rest" }]`. `recharge`는 `dawn`·`long-rest`·`short-rest`·`never` 또는 새벽에 굴리는 주사위("1d6+1"). 주문은 `"pool": "bolt"`로, 계약은 `resource:self.bolt`로 쓴다. 사본마다 따로 센다 (D358) |
| `contract` | 객체 | 모듈 항목과 같은 `common-play` 계약(MODULE_GRAMMAR.md §2~§6): 상시 속성, 라벨 붙은 사용(버튼), 반응. `id`는 앱이 붙인다. `resource:self`는 이 사본의 `charges`, `resource:self.<id>`는 `uses` 풀 (D358) |
| `format` | `"simplevtt.magic-item/2"` | 생략해도 된다. 전체 형식은 `schemas/magic-item.schema.json` (D358) |
| `abilityBonuses` | 객체 | 작동하는 동안 능력치를 올린다, 상한까지: `{ "con": { "amount": 2, "max": 20 } }`. 이미 상한을 넘은 점수는 그대로 (D356) |
| `damageType` | 피해 타입 | 이 무기의 피해 타입을 기반 무기 대신 이것으로 (태양검: `radiant`) (D356) |
| `baseOptions` | 객체 | 공식·모듈 아이템: 지급할 때 기반을 고른다. `{ "kind": "weapon"|"armor"|"shield"|"ammunition", "training": ["martial"] 또는 ["medium","heavy"], "mode": "melee"|"ranged", "ids": [...], "exclude": [...] }`. 고른 기반으로 "아이템 (기반)" 이름으로 지급된다 (D354) |

## 3. `bonus`

| 키 | 형식 | 붙는 곳 |
|---|---|---|
| `attack` | 숫자 | 명중 (무기면 그 무기만) |
| `damage` | 숫자 | 피해 보너스 (무기면 그 무기만) |
| `damageDice` | `"1d6"` | 피해 주사위 추가. 무기 피해 타입과 같은 타입으로 굴린다 |
| `ac` | 숫자 | AC |
| `saves` | 숫자 | 내성 굴림 (`saveAbilities`로 좁힘) |
| `checks` | 숫자 | 모든 능력 판정 |
| `speed` | 숫자(ft) | 보행 속도 |
| `hpMax` | 숫자 | 최대 HP |
| `spellDc` | 숫자 | 주문 내성 DC |
| `spellAttack` | 숫자 | 주문 명중 |
| `extraDamage` | `{ "dice": "2d6", "type": "fire" }` 또는 그 배열 | 이 무기가 맞히면 따로 굴리는 다른 타입의 피해 (D352). 각각 `"when": { "targetTypes": ["undead", "fiend"] }`(그 크리처 유형에게만 — 맞을 때 표가 대상을 본다) 또는 `"when": { "effect": "불꽃" }`(그 이름의 효과가 도는 동안만 — 계약의 켜기 버튼과 짝)을 붙일 수 있다 (D359) |

모르는 키나 숫자가 아닌 값은 경고와 함께 무시한다.

## 4. 피해 타입 (영문 id)

`acid` `bludgeoning` `cold` `fire` `force` `lightning` `necrotic` `piercing` `poison` `psychic` `radiant` `slashing` `thunder`

## 5. 예시

무기 (창의 **예시 넣기**와 같음):

```json
{
  "name": "서리송곳 장검 +1", "type": "weapon", "rarity": "rare", "attunement": true, "base": "longsword",
  "description": "칼날에 서리가 맺힌 장검. 조율하면 명중과 피해에 +1, 냉기 피해에 저항한다.",
  "bonus": { "attack": 1, "damage": 1 },
  "resistances": ["cold"]
}
```

방어구:

```json
{ "name": "사슬 갑옷 +1", "type": "armor", "rarity": "rare", "base": "chain-mail", "bonus": { "ac": 1 } }
```

반지:

```json
{ "name": "보호의 반지", "type": "ring", "rarity": "rare", "attunement": true, "bonus": { "ac": 1, "saves": 1 } }
```

주문 시전 보조:

```json
{ "name": "비전 초점 막대 +2", "type": "wondrous", "rarity": "rare", "attunement": true, "bonus": { "spellDc": 2, "spellAttack": 2 } }
```

계산할 수 없는 효과:

```json
{ "name": "도약의 장화", "type": "wondrous", "rarity": "uncommon", "attunement": true,
  "description": "도약 거리가 세 배가 된다.", "notes": ["도약 거리 ×3 (수동 적용)"] }
```

## 6. 코딩 에이전트에게 맡길 때

이 문서를 함께 주고 아래처럼 요청한다.

> 첨부한 CUSTOM_ITEM_JSON.md 형식으로 마법 아이템 JSON 하나만 출력해줘. 설명이나 코드 펜스 없이 JSON만.
> 규칙: `name`은 반드시 넣는다. 무기나 방어구면 `base`에 SRD 영문 이름을 쓴다(`longsword`, `chain-mail`). 숫자로 계산되는 효과는 `bonus`의 정해진 키(attack, damage, damageDice, ac, saves, checks, speed, hpMax, spellDc, spellAttack)만 쓴다. 피해 저항은 `resistances`에 영문 피해 타입 id로 쓴다. 표에 없는 효과(충전, 1일 1회 주문, 조건부 효과)는 `notes`와 `description`에 문장으로 쓴다.
> 만들 아이템: (컨셉, 희귀도, 효과)

붙여 넣은 뒤 경고가 뜨면 그 문장을 그대로 에이전트에게 돌려주면 고칠 수 있다.

## 7. 한계

- `spells`만 있고 `charges`가 없으면 작동하는 동안 무제한으로 시전한다. 충전 풀 안에서 `charges: 0`인 주문은 풀이 비어도 시전된다. `charges.recharge: "0"`은 회복되지 않는 충전이다 (D354).
- 충전을 다 썼을 때의 파괴 굴림은 굴리지 않는다. `charges.note`에 적어 DM이 판정한다.
- `damageDice`는 무기의 피해 타입으로 굴린다. 다른 타입의 추가 피해는 `bonus.extraDamage`로 적는다.
- 마법 탄약(`type: "ammunition"`, `base`가 화살·볼트)은 탄약을 쓰는 무기마다 "무기 (탄약 이름)" 공격 줄이 생기고 보너스는 그 줄에만 붙는다. 화살과 볼트는 구분하지 않는다 — 맞는 무기 줄을 고른다. 쏜 뒤 줄이는 것은 가방에서 직접.
- 주문 두루마리는 아이템 추가 창의 두루마리(R19)로 지급한다.
- 발동하는 능력(버튼)은 `contract`로 붙여넣기에서도 만든다(D358).
- 조건부 보너스(특정 크리처에게만 등)는 계산하지 않는다.
- 지급한 아이템의 정의는 시트에서 고칠 수 없다. 버리고 JSON을 고쳐 다시 지급한다.
