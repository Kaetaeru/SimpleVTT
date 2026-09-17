# 직업 정의 JSON (`class-definition`)

모듈의 직업 항목(`category: "class"`)은 `mechanics`에 `class-definition` 하나를 둔다. SRD 직업
(`content/modules/dnd-srd-5.2.1.classes/module.json`)도 같은 형식이고, 코드는 이 설정만 읽는다(D243).
설치 모듈이 기존 직업 ID로 같은 종류를 보내면 설정 키 단위로 덮어쓴다(배열은 통째로 바뀐다).

```json
{
  "kind": "class-definition",
  "config": {
    "hitDie": 10,
    "primaryAbilities": ["str"],
    "savingThrowProficiencies": ["str", "con"],
    "skillChoiceCount": 2,
    "spellcasting": "half",
    "spellcastingAbility": "cha",
    "spellcastingFeature": "paladin.spellcasting",
    "armorTraining": ["light", "medium", "heavy", "shield"],
    "weaponTraining": ["simple", "martial"],
    "toolProficiencies": [],
    "multiclass": {
      "armor": ["light", "medium", "shield"], "weapons": ["simple", "martial"],
      "skills": 1, "tools": [], "instruments": 0,
      "prerequisites": { "all": ["str", "cha"] }
    },
    "resources": [
      { "id": "resource.paladin.lay-on-hands", "label": "안수", "max": { "op": "mul", "args": [{ "ref": "class.level" }, { "value": 5 }] }, "recovery": "long-rest", "minLevel": 1 },
      { "id": "resource.paladin.channel-divinity", "label": "신성 변환", "column": "신성 변환", "recovery": "short-rest:1", "minLevel": 3 }
    ],
    "optionPools": []
  }
}
```

| 키 | 뜻 |
|---|---|
| `armorTraining` / `weaponTraining` | 1레벨로 시작할 때의 훈련. 방어구 `light·medium·heavy·shield`, 무기 `simple·martial·martial-light·martial-finesse-or-light`. |
| `toolProficiencies` | 도구 ID 또는 SRD 도구 slug. |
| `multiclass` | 두 번째 이후 직업으로 얻을 때의 훈련·기술 수·도구·악기 수. `prerequisites`는 13 이상이어야 하는 능력치(`all` 전부, `any` 하나). |
| `spellcastingAbility` | 주문 시전 능력치. 없으면 주 능력치 중 지능·지혜·매력. |
| `spellcastingFeature` | 직업의 주문 시전이 구현하는 특성 키(`<slug>.<특성 id>`). 시트가 그 특성에 "자동 계산" 줄을 붙인다. |
| `resources[]` | 자원 풀. 최대치는 진행표 열 이름 `column` 또는 식 `max`(계약 식: `add·mul·max·min·if·gte …`, 참조 `class.level`, `ability.<키>.modifier`). `recovery`: `short-rest`, `long-rest`, `short-rest:1`, `short-rest:half`. `recoveryFrom {level, recovery}`, `subclassId`(그 서브클래스일 때만), `spell`(무료로 시전하는 주문의 영문 이름). |
| `optionPools[]` | 레벨에 따라 아는 개수가 느는 선택지 목록: `{ id, list(직업 선택지 목록 키), label, known: { "2": 2, "10": 3 } }`. 선택 ID는 `class.<첫 트랙>.<id>`. |

주문서가 있는 직업은 생성 색인 `spells.spellbook`(1레벨 개수)과 `spells.spellbookPerLevel`(레벨마다 추가)을 쓴다.
특성을 얻을 때의 선택과 부여는 직업 정의가 아니라 특성 계약의 `gain` 진입점이다(D240~D242).
