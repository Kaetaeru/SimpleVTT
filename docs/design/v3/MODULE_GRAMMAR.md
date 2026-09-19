# 모듈 문법 설명서 — 설치 콘텐츠를 앱이 실제로 굴리게 쓰는 법

읽는 사람: 모듈(JSON)을 쓰는 사람과 그 문법을 넓히는 사람.
**코드를 고치기 전에 이 문서의 어휘로 표현되는지 먼저 본다** (CLAUDE.md §2).
진실의 출처는 코드다 — `client/rules/contract.ts`(연산·식·결제), `client/rules/contractEffects.ts`(속성), `client/character/tracks.ts`(획득 시점), `client/rules/contractReactions.ts`(반응 창), `client/compendium/spells.ts`(주문 실행). 이 문서와 코드가 다르면 코드가 맞다.

---

## 0. 한 장 요약

| 쓰고 싶은 것 | 어디에 적나 |
|---|---|
| 시트에 늘 붙어 있는 값 (AC, 저항, 이동, 기술 유리) | 계약 `entryPoints[invocation: "manual"]`의 `property.modify` → **패시브** |
| 버튼 하나 (자원·경제 소모) | 같은 계약에 `payments` + 연산. 여러 개면 `label` 붙은 항목마다 버튼 |
| 만들 때 정해지는 것 (숙련·주문·자원 풀·선택) | `entryPoints[invocation: "gain"]`의 `property.modify` — **획득 어휘**(§5) |
| 판정 전에 선언하는 것 | `invocation: "pre-roll-attack"` (+ `attack.scope`) |
| 명중한 뒤 고르는 것 | `invocation: "on-hit"` |
| 남의 굴림/내 굴림을 바꾸는 것 | `interceptors[timing: "d20.outcome-determined"]` |
| 맞았을 때 뜨는 반응 창 | `interceptors[timing: "reaction.window", trigger: "attack.hit-self" \| "attack.hit-ally"]` |
| 휴식·이니셔티브·처치·턴 시작/끝 | `invocation: "short-rest" \| "long-rest" \| "initiative" \| "kill" \| "turn-start" \| "turn-end"` |
| 주문이 하는 일 | `spell-mechanic` (§7) |
| 앱이 볼 수 없는 사실 | `adjudication.request` + `fact` (체크박스) |
| 그래도 남는 것 | `adjudication.request`에 **사유를 적은 "DM 판정"** |

---

## 1. 모듈 파일

```json
{
  "$schema": "https://simplevtt.local/schemas/rule-module.schema.json",
  "moduleId": "phb-2024", "moduleVersion": "1", "defaultLocale": "ko-KR",
  "source": { "document": "Player's Handbook", "version": "2024", "license": "not-srd", "srdDerived": false },
  "dependencies": [], "content": [ /* 항목들 */ ]
}
```

항목 하나:

```json
{
  "id": "phb2024.subclass.barbarian.zealot.feature.3.divine-fury",
  "category": "option",
  "presentation": { "originalName": "Divine Fury", "defaultLocale": "ko-KR",
    "locales": { "ko-KR": { "name": "신성한 격노", "description": "…전문…" } } },
  "tags": ["subclass-feature", "phb-2024"],
  "mechanics": [ { "kind": "common-play", "config": { /* 계약 */ } } ]
}
```

`category`는 `class · subclass · species · background · feat · spell · option · weapon · armor · shield · tool · item · adventuring-gear · ammunition · focus · starting-loadout · combatant · condition`. 서브클래스 특성·지속 효과·선택지는 전부 `option`이다.

**설치 모듈은 덧대기(patch)도 된다**: 같은 `id`로 같은 `kind`의 mechanic을 주면 설정이 키 단위로 합쳐지고, 말하지 않은 것(표현·다른 기계)은 남는다(D197).

---

## 2. 계약(`common-play`)의 뼈대

```json
{
  "$schema": "https://simplevtt.local/schemas/common-play-contract.schema.json",
  "schemaVersion": "0.2-draft",
  "id": "<규칙 키>",
  "payments": [ … ],
  "entryPoints": [ { "id": "…", "invocation": "manual", "operations": [ … ] } ],
  "interceptors": [ … ]
}
```

### 2.1 `id` = 규칙 키 (틀리면 아무 일도 안 일어난다)

계약은 **특성 id에서 유도된 규칙 키**로 찾는다.

- 특성 항목 id가 `phb2024.…feature.3.divine-fury`이면 계약 `id`도 **그 문자열 그대로**.
- SRD 스타일 `dnd.srd521.feature.<x>` / `feature.<x>` 접두는 벗겨져 `<x>`가 키가 된다.
- 재주: 특성 id `…feat.lucky` → 키 `feat:lucky` → 계약 `id`는 `feat:lucky`.
- 종족 특성: `<speciesId>.trait.<키>` → `species.<키>`.
- 지속 효과 항목: 계약 `id`를 `feature:<효과 키>`로 두고, `effect.apply`의 `template.key`도 같은 `feature:<효과 키>`.

### 2.2 결제(`payments`)

```json
{ "kind": "resource", "resource": "resource:phb2024.zealot.warrior-of-the-gods", "amount": { "value": 1 }, "consumeAt": "commit" }
{ "kind": "economy", "bucket": "bonus-action", "amount": { "value": 1 }, "consumeAt": "commit" }
```

- `resource:<id>` → 시트의 `resource.<id>`. SRD 풀 이름 예: `resource:barbarian.rage`, `resource:bard.bardic-inspiration`, `resource:cleric.channel-divinity`, `resource:paladin.channel-divinity`, `resource:monk.focus`, `resource:druid.wild-shape`, `resource:sorcerer.sorcery-points`, `resource:spell-slot`, `resource:spell-slot-levels`(레벨 합), `resource:pact-slot`.
- `bucket`: `action` · `bonus-action` · `reaction` · `action.extra.non-magic` 같은 확장.
- `condition: { "kind": "d20-result", "outcome": "success" | "failure" }`를 붙이면 **그 결과일 때만** 값이 나간다.
- 표시된 사용(`label`)마다 자기 `payments`를 가질 수 있다. 수동 사용이 스스로 무언가를 하면(판정 줄·패시브가 아닌 연산) 그 `resource` 결제가 버튼의 비용이다(D307). 판정 창만 쓰는 풀(행운아)은 계약 단위 결제로 두고 버튼을 만들지 않는다.
- 슬롯을 비용으로: `resource.change` `resource:spell-slot` `amount -1` `level N`, 계약 슬롯은 `resource:pact-slot` `amount -1`. `resource:spell-slot-levels`는 휴식에서 슬롯을 **되찾는** 어휘다.

### 2.3 진입점(`entryPoints`)

| `invocation` | 언제 |
|---|---|
| `manual` | 시트·턴 패널의 버튼(또는 패시브) |
| `gain` | 캐릭터를 만들/올릴 때 한 번 (§5) |
| `pre-roll-attack` | 공격 판정 전 선언 (`attack: { scope, oncePerTurn, requiresEffects }`) |
| `on-hit` | 명중이 확정된 뒤 |
| `short-rest` / `long-rest` | 휴식 창 |
| `initiative` | 우선권을 굴릴 때 |
| `kill` | 적을 0 HP로 만들었을 때 (`killer: "nearby"`면 남의 처치도) |
| `turn-start` / `turn-end` | 자기 턴 시작·끝에 저절로 |

옵션: `label`(여러 사용을 줄마다 나누기), `targeting: { from: "targets", min, max }`, `test: { kind: "saving-throw", roller: "target", property: "save.str.modifier", dc: <식>, perTarget: true }`.

**`when`(진입점, D308)**: 그 사용이 이 캐릭터에게 있는지를 정하는 식. 틀리면 시트 줄도, 공격 창의 선택지도 없고 표는 거절한다.
만들 때 고른 것에 따라 사용이 갈리는 특성은 **반드시** 이것으로 나눈다 — 안 그러면 모든 선택지의 사용이 다 나온다
(초록 드래곤본이 다섯 속성 브레스를 다 뿜던 결함).

```json
{ "id": "poison", "label": "브레스 웨폰 (독)", "invocation": "manual",
  "when": { "op": "any", "args": [{ "ref": "actor.chose:draconicAncestry:green" }] }, "operations": [ … ] }
```

인터셉터(§6)의 `when`도 같은 식을 읽는다 — 돌 거인 혈통만 받는 반응 창은 인터셉터에 `when`을 단다.

경제 버킷의 확장 이름: `bonus-action.as:<공식 행동>`(그 행동을 추가 행동으로), `bonus-action.attack:<scope>`(추가 행동 공격 한 번), `free.attack:<scope>`(경제를 안 쓰는 공격).

---

## 3. 연산 27종

모두 `when: <식>`을 받는다. 대상은 `self` · `target` · `targets` · `allies`.

| 연산 | 쓰임 |
|---|---|
| `property.modify` | 값 하나를 바꾼다 (§4) |
| `economy.modify` | 행동·추가 행동·반응을 준다 (`bucket`, `amount`) |
| `resource.change` | 풀을 쓰거나 돌려준다 (`resource`, `amount`(음수=소모), `upTo`, `level`) |
| `resource.recharge` | 주사위를 굴려 회복 (`die`, `succeedsOn`) |
| `damage.apply` | 피해 (`dice`, `diceCount`, `diceSides`, `amount`, `damageType`, `save: {ability, dc, success}`) |
| `healing.apply` | 회복 (`dice`/`diceCount`+`diceSides`/`amount`, `pool: "half-max"`) |
| `temp-hp.grant` | 임시 HP (같은 주사위 필드) |
| `condition.apply` / `condition.remove` | 상태 (`save`, `duration`, `repeatSave: "turn-end"`, `successMark`) |
| `effect.apply` / `effect.remove` / `effect.suppress` | 지속 효과 시작·종료·정지 |
| `roll.modify` | 굴림에 손대기 (§6) |
| `hp.maximum.change`, `life.stabilize`, `life.death-save` | HP 최대치·안정화·죽음 내성 |
| `movement.stand`, `movement.relocate`, `movement.grant` | 일어서기·순간이동·추가 이동 |
| `content.grant` | 물건·항목을 준다 |
| `artifact.spawn` / `remove` / `repair` / `damage` / `relocate` / `update` | 장면 위 물체·소환물 |
| `adjudication.request` | 사람에게 묻는 줄 (§8) |

**식**: `{"value":3}` · `{"ref":"proficiency.bonus"}` · `{"op":"add","args":[…]}`.
연산자: `add sub mul floor-div ceil-div min max eq ne lt lte gt gte all any not if`.
참조: `proficiency.bonus`, `actor.level`, `ability.<x>.modifier`, `ability.<x>.score`, `save.<x>.modifier`, `actor.class-level:<classId>`, `armor.training`, `armor.dex-capped`, `equipment.shield`, `actor.pact-slots`, `actor.has-feature:<규칙 키>`, `actor.chose:<선택 id>:<옵션 id>`(D308 — 만들기·레벨업에서 그 옵션을 골랐는가; 선택 id는 전체(`origin.species.draconicAncestry`)나 마지막 조각(`draconicAncestry`)), `effect.running:<효과 이름>`, `fact:<id>`.

지속시간: `{"kind":"rounds"|"minutes"|"hours"|"permanent","amount":1,"boundary":"start"|"end","anchor":"source"|"bearer"}`.
효과 수명(`lifetime`): `until-duration`(라운드를 센다) · `until-state` · `until-event` · `until-consumed` · `until-source-recast` · `with-parent` · `durable`.
상태 이름은 영어 id(D307: 파싱할 때 시트가 쓰는 한국어 이름으로 바뀐다 — 한국어로 적어도 된다. `prone`, `frightened`, `charmed`, `poisoned`, `restrained`, `stunned`, `blinded`, `deafened`, `incapacitated`, `invisible`, `paralyzed`, `petrified`, `grappled`, `unconscious`)를 쓴다. 피해 유형은 한국어(`타격 관통 참격 산성 냉기 화염 번개 사령 독 정신 광휘 천둥 역장`).

---

## 4. `property.modify` 속성표

형태: `{"kind":"property.modify","property":"<이름>","operation":"add"|"set"|"multiply"|"minimum","value":<식>,"dice":"1d4","diceSides":<식>,"scope":"<공격 필터>","abilities":["con"],"damageTypes":["화염"],"params":{…},"note":"시트에 보일 한 줄"}`

- **방어·체력**: `ac.bonus` `ac.unarmored-base` `ac.minimum` `hp.maximum` `hp.heal-on-start` `hp.zero.hold` `damage-taken.reduce` `damage-taken.halve` `resistance` `condition-immunity`
- **굴림**: `attack-roll.bonus` `damage.bonus` `saving-throw.bonus` `ability-check.bonus` `skill.<id>.bonus` `skill.<id>.expertise` `skill.<id>.advantage` `attack-roll.advantage` `ability-check.advantage` `saving-throw.advantage` `saving-throw.advantage-vs-condition`(`params.conditions`) `attack-roll.crit-range` `attack-roll.ignore-cover` `attack-roll.against-me.advantage` `attack-roll.against-me.no-advantage` `attack-roll.against-me.opportunity-disadvantage` `attack-roll.against-me.after-hit-disadvantage` `ability-check.minimum-d20` `ability-check.minimum-score` `saving-throw.minimum-score` `saving-throw.evasion` `death-save.advantage` `death-save.crit-range` `initiative.advantage` `initiative.extra-turn` `heroic-inspiration.gain`
- **이동·감각**: `speed.walk` `speed.fly` `speed.climb` `speed.fly-as-walk` `speed.swim` `speed.swim-as-walk` `senses.darkvision` `senses.blindsight`
- **주문**: `spell.save-dc` `spell.attack-roll.bonus` `spell.cantrip-damage.ability-modifier` `spell.cantrip-potent` `spell.damage.maximize`(`params.class`) `spell.damage.ability-modifier` `spell.damage-type.ability-modifier`(`damageTypes`, `params.class`) `spell.school-damage.ability-modifier`(`school`) `spell.metamagic` `spell.metamagic-limit` `spell.metamagic-free` `healing.maximize` `healing.spell-slot-bonus` `healing.self-on-slot-heal` `concentration.damage-immune` `marked-spell.die` `marked-spell.advantage` `marked-spell.reveal-defenses`(`spell`)
- **공격 횟수·무기**: `attack-action.attacks` `damage.extra-die` `damage.reroll-lowest` `damage.die-minimum` `damage.ignore-resistance` `weapon.shillelagh`(`params.items`, `dice`)
- **반응 창 전용**: `reaction.auto-miss` `reaction.strike-back` `reaction.redirect` (§6.2)
- **그 밖**: `proficiency.armor` `proficiency.weapon` `attunement.slots` `aura.grant`(`params.name/conditionImmunities`) `form.assume`(`params.creatureTypes/level`) `skill.ability-swap`(`params.skills/ability`) `effect.upkeep` `effect.upkeep-waived` `rider.forgo-limit` `attack-roll.studied` `rule.applied-elsewhere`(다른 자리에서 처리된다는 메모)

`scope`(공격 필터): `weapon melee ranged unarmed heavy light finesse thrown two-handed one-handed-melee finesse-or-ranged strength-melee weapon-or-form bludgeoning piercing slashing`.

**없는 속성을 쓰면 조용히 무시되지 않는다** — `scripts/check-module-grammar.ts`가 "모르는 속성"으로 센다.

---

## 5. 획득 시점(`invocation: "gain"`) 어휘

캐릭터를 만들 때 한 번 실행된다. 전부 `property.modify`이고 값은 `value`(수)와 `params`(이름 있는 인자)로 준다.

| property | params |
|---|---|
| `choice.skills` | `id, label, from: "class"\|[기술id…], mode: "expertise"?` |
| `choice.languages` | `id, label` |
| `choice.spell` | `id, label, resourceId?, recovery?, atWill?` (직업 목록에서 하나, 항상 준비) |
| `choice.spells` | `id, label, classes[], levels[], into: "alwaysPrepared"\|"cantrips", ritual?` |
| `choice.class-option` | `list`(내장 목록 키 또는 모듈이 `option-list-definition`으로 선언한 목록, D303) |
| `choice.fighting-style` | `extra[]` |
| `grant.resource` | `id, label, recovery, minLevel?, spell?/spells?/maxLevel?, atWill?` · `value`=최대치(식) |
| `grant.spells` | `spells[], into` |
| `grant.spell-lists` | `classes[]`(직업 slug) — 그 직업들의 목록에서도 준비한다(D305) |
| `grant.cantrips` | (값=개수) |
| `grant.spellbook-picks` | `id, label, school` |
| `grant.ritual-casting` | — |
| `grant.proficiency` | `weapons[], armor[]` |
| `grant.save-proficiency` | `abilities[] \| "all"` |
| `grant.ability` | `abilities[], cap?` (값=증가량) |
| `grant.senses` | `sense` (값=거리) |
| `grant.speed` | `mode, equalsWalk?` |
| `grant.speed-bonus` | `column?, unless, modes[]` |
| `grant.hp-per-level` | `per: "character"` 또는 생략(그 직업 레벨당) |
| `grant.ac-formula` | `abilities[], shield?` |
| `grant.resistance` / `grant.condition-immunity` | `types[]` / `conditions[]` |
| `grant.skill-ability-bonus` | `skills[], ability, min` |
| `grant.half-proficiency`, `grant.martial-arts`, `grant.language` | — |

식은 `proficiency.bonus`, `actor.level`, `ability.<x>.modifier/score`, `actor.class-level:<id>`를 읽는다(D302).
**직업 전용 연산**(`choice.spell(s)`, `grant.spells`, `grant.cantrips`, `grant.spellbook-picks`, `grant.ritual-casting`, `choice.class-option`, `grant.speed-bonus`, `grant.martial-arts`)을 종족 특성에 쓰면 경고가 남고 실행되지 않는다.

---

## 6. 인터셉터

### 6.1 굴림에 손대기 — `timing: "d20.outcome-determined"`

```json
{ "id": "flare", "timing": "d20.outcome-determined", "slot": "attack-roll",
  "families": ["attack-roll"], "outcomes": ["success"],
  "interaction": { "id": "use", "kind": "choice", "responder": "actor-owner", "mode": "blocking",
                   "input": { "type": "boolean" }, "revalidate": "if-revision-changed", "stalePolicy": "reject" },
  "factQueries": [ { "id": "in-range", "fact": "table.judgement", "unknownPolicy": "ask", "question": "30피트 이내입니까?" } ],
  "operations": [ { "kind": "roll.modify", "mode": "reroll-keep-lower", "dice": "1d20" } ] }
```

- `families`: `attack-roll` · `saving-throw` · `ability-check` · `death-save` (비우면 전부)
- `outcomes`: `failure`(내 실패를 구제) · `success`(남의 성공을 깎는다 — 그 창은 다른 시트에 뜬다)
- `roll.modify` 모드: `add-die`(`dice` 또는 `diceSides` 식) · `add-flat` · `subtract-die` · `reroll` · `reroll-keep-lower` · `reroll-keep-higher` · `set-die` · `force-success`
- `oncePerTurn`, `naturalOnly: 1`도 있다.
- 앱이 모르는 사실은 `factQueries`에 `unknownPolicy: "ask"` + `question`으로 두면 **창이 그 질문을 띄운다**. `ask`가 아니면 "실행 못 함"으로 센다.

### 6.2 맞았을 때 뜨는 창 — `timing: "reaction.window"`

`trigger`는 **`attack.hit-self`**(내가 맞음) 또는 **`attack.hit-ally`**(남이 맞음 — 거리 확인은 `factQueries`).
창이 읽는 연산은 이것뿐이다:

| 연산 | 뜻 |
|---|---|
| `property.modify ac.bonus` | 그 공격에 대해서만 AC를 올려 다시 판정 |
| `property.modify damage-taken.reduce` (`dice` 또는 `diceSides` 식 + `value`) | 피해를 깎는다 |
| `property.modify damage-taken.halve` | 피해 절반 |
| `property.modify reaction.auto-miss` | 그 공격을 빗나가게 한다 |
| `property.modify reaction.strike-back` | 반격 창을 연다 |
| `property.modify reaction.redirect` (`dice`, `params.dc/damageType`; 내성이 없으면 `params.save: "none"` — D308) | 공격자에게 되돌려준다 |
| `adjudication.request` | 창에 뜨는 줄(또는 `fact.at: "reaction"` 체크박스) |

창은 **답할 수단이 있을 때만** 열린다. 위 연산이 하나도 없으면 창이 아예 안 뜬다 — 버튼만 만들지 말고 창을 쓸 것.
같은 특성의 표시된 사용(`label`)이 여러 개여도 창은 한 번만 제안된다(D302).

---

## 7. 주문 (`spell-mechanic`)

`spell-definition`은 목록에 올리는 글(레벨·학파·시전 시간·사거리·구성요소·지속·`classes`), `spell-mechanic`은 **테이블에서 굴러가는 부분**이다.

```json
{ "baseLevel": 1, "castingEconomy": "action",
  "targeting": { "kind": "creature", "rangeFeet": 60, "minTargets": 1, "maxTargets": 1,
                 "allowedRelations": ["enemy"], "targetsPerSlotAboveBase": 0 },
  "primary": { "kind": "attack-damage", "damageType": "번개",
               "dice": { "count": 2, "sides": 12, "dicePerSlotAboveBase": 1 } },
  "concentration": true,
  "sustain": { "economy": "bonus-action", "target": "bound", "endWhen": "대상이 사거리 밖이거나 완전 엄폐",
               "primary": { "kind": "automatic-projectiles", "damageType": "번개",
                            "projectileDice": { "sides": 12 }, "baseProjectiles": 1 } } }
```

- `primary.kind`: `attack-damage` `save-damage` `save-compound-damage` `save-effect` `healing` `temporary-hp` `automatic-projectiles` `multi-attack-damage` `tracked-effect` `area-damage` `maximum-hp` `dispel` `full-healing` `power-word-kill` `revive`
- 주사위: `count/sides/flat`, 상위 슬롯은 `dicePerSlotAboveBase`·`flatPerSlotAboveBase`, 소마법은 `cantripScaling`, 시전 능력치는 `addSpellcastingModifier`
- `effects[]`(상태), `trackedEffects[]`(지속 효과가 굴림에 주는 것), `removesConditions[]`
- `sustain`: `economy`(`action`/`bonus-action`/`none`) · `primary` · `note` · `move` · `target: "bound"`(처음 겨눈 대상에게만 — 빗나가도 묶인다) · `endWhen`(사람이 누르는 종료 버튼)
- `onHit`: 무기 명중 직후 시전하는 강타류 (`weapon`, `damage`, `inflicts`, `save`, `versus`, `mark`)
- `summon`: 소환 템플릿(`forms[].template`, 치환값 `{level}` `{attack}` `{dc}`)
- `creatures`, `reaction`(`attack.hit-self`/`spell.cast-seen`), `repeatSave: "turn-end"`, `variants`(시전 때 고르는 갈래), `casterHealing`, `weaponSpell`
- 아무 `spell-mechanic`이 없어도 시전은 된다(대상·슬롯·집중은 기록된다). 필요한 조각만 덧대도 된다.

---

## 8. 사람에게 넘기는 줄

```json
{ "kind": "adjudication.request", "question": "…", "amount": { "ref": "proficiency.bonus" },
  "fact": { "id": "flanked", "at": "pre-roll" | "reaction" | "on-hit", "auto": "target.hp.below-max", "orAsk": true } }
```

- `fact`가 있으면 **체크박스**가 되고, `when: {"ref":"fact:<id>"}`를 단 연산은 체크했을 때만 실행된다.
- `fact`가 없으면 시트에 그대로 찍히는 줄이다. 그 자리가 "DM 판정"이면 **왜 그런지**를 함께 적는다 — 좌표가 없다(D109), 조명은 앱이 모른다, 표가 굴리는 표다 …
- 사유 없는 "표에서" 한 줄은 이 프로젝트에서 결함으로 친다.

---

## 9. 정의 메커닉 (계약이 아닌 것)

| kind | 읽는 키 |
|---|---|
| `spell-definition` | `level, school, ritual, castingTimeText, rangeText, componentsText, durationText, summary, classes[]` |
| `feat-definition` | `tier`(origin/general/fighting-style/epic-boon), `repeatable`, `minimumLevel`, `abilityPrerequisite`, `abilityIncrease`, `requires`, `grants[]`, `choices`, `execution.status`, `armorAcBonus`, `rangedWeaponAttackBonus`, `damageDieMinimum`+`weaponPropertiesAny`, `oncePerTurn`, `lightExtraAttackAbilityModifier`, `resistances[]`, `languages[]`, `speedBonus`, `hitPointsPerLevel`, `truesight`, `darkvision`, `<x>SaveProficiency`, `proficiencyChoice`, `expertiseChoice`, `allSkillProficiencies`, `saveProficiencyChoice`, `resistanceChoice`, `ignoreResistanceChoice`, `weaponMasteryChoice`, `grantCantrips[]`, `grantSpells[]`, `grantSpellChoice`, `grantSpellAbility`, `freeCastReset`, `resources[]` |
| `class-definition` | `hitDie`, `primaryAbilities[]`, `savingThrowProficiencies[]`, `armorTraining[]`, `weaponTraining[]`, `toolProficiencies[]`, `multiclass`, `spellcastingAbility`, `spellcastingFeature`, `resources[]`, `optionPools[]`, 그리고 D310: `casterKind`(`full`/`half`/`pact`/`none`), `levels[]`(아래), `skillOptions`(`{count, options}`), `level1Choices[]`, `spells`(`cantrips`·`prepared`·`spellbook`·`spellbookPerLevel`·`preparedFromSpellbook`), `multiclassGrants[]` |
| `monster-definition` (분류 `combatant`, D311) | 붙여넣기 NPC와 같은 형식(`docs/guides/CUSTOM_NPC_JSON.md`: `ac`·`hp`·`abilities`·`cr`·`traits[].rules`·`actions[]` …, 이름은 항목의 이름) 또는 `{ "statBlock": { … } }`(표가 쓰는 스탯블록 그대로). 같은 id의 SRD 괴물을 대신한다 |
| `subclass-definition` | `spells`(레벨→주문 id 또는 영어 이름), `choices[]`, `spellsByOption`, `spellcasting`(1/3 시전자, 아래), `optionPools[]`(아래) |
| `option-list-definition` | `list`(목록 키), `options[]`(`option` 항목 id) — 선택지 목록을 선언한다(D303) |
| `species-definition` | `size[]`, `speed`, `darkvision`, `traits[]`(이름 있는 키), `choices`, `semantics`(`baseCantrips`, `baseFeatures`, `extraChoices`…), `effects` |
| `background-definition` | `abilityChoices[]`, `skills[]`, `tool`, `toolChoice`, `originFeat`, `equipmentChoice` |
| `weapon-definition` · `armor-definition` · `shield-definition` · `tool-definition` · `consumable-definition` · `pack-definition` · `starting-loadout-definition` | 장비 |

**직업 레벨 표 (D310)** — 직업 하나를 모듈이 통째로 정의한다:

```json
{ "levels": [
  { "level": 1, "features": ["<특성 option 항목 id>"], "columns": { "소마법": 2, "준비 주문": 2, "1": 2, "불꽃": 2 } },
  { "level": 3, "features": [{ "role": "subclass", "name": "땜장이 서브클래스" }], "columns": { … } },
  { "level": 4, "features": [{ "role": "asi", "name": "능력치 향상" }], "columns": { … } } ] }
```

- `features`: 특성 항목 id(그 항목의 이름·글·계약을 쓴다), 또는 표 자체의 줄 `{ role }` — `subclass`(서브클래스 고르기), `asi`, `epic-boon`, `subclass-feature`(서브클래스 특성이 붙는 자리).
- `columns`: 열 이름은 표 어휘(`소마법`, `준비 주문`, 슬롯 레벨 `"1"`~`"9"`, `계약 슬롯`, `슬롯 레벨`, `무기 통달`, …) 또는 직업이 정한 이름 — 자원(`resources[].column`)과 선택지 풀(`optionPools[].column`)이 그 이름으로 읽는다.
- `proficiencyBonus`는 생략하면 레벨로 계산한다.

**선택지 풀과 문(門) (D310)** — `optionPools[]`의 수는 `known`(레벨→개수) 또는 `column`(표의 열)로. `featureName: "option"`이면 시트 줄이 선택지 이름 그대로.
`option-list-definition.options[]`의 항목은 id 문자열 또는 `{ "id", "minLevel", "requires": "<먼저 필요한 선택지 id>", "cost", "repeatable", "targetKind": "origin-feat" | "damage-cantrip" | "attack-cantrip" }`.
워락의 섬뜩한 기원술도 이 풀 하나다(`column: "기원술"`).

**서브클래스가 주는 주문 시전 (D303)** — 스스로 시전하지 않는 직업을 1/3 시전자로 만든다:

```json
{ "spellcasting": { "kind": "third", "ability": "int", "list": "dnd.srd521.class.wizard",
                  "cantrips": { "3": 2, "10": 3 }, "prepared": { "3": 3, "4": 4, "7": 5 } } }
```

표의 키는 직업 레벨이고 도달한 가장 높은 키의 값을 쓴다. 슬롯은 직업 레벨 3분의 1(올림)의 전 시전자 표, 멀티클래스 시전자 레벨에는 3분의 1(내림).

**늘어나는 선택지 (D303)** — `optionPools: [{ "id": "maneuvers", "list": "<목록 키>", "label": "기동", "known": { "3": 3, "7": 5 } }]`.
선택 id는 `class.<그 직업 첫 트랙>.<id>`. 목록은 `option-list-definition`으로 선언한다. 고른 항목은 특성이 되고 자기 계약(`id` = 항목 id)을 찾는다.

서브클래스 항목은 `relationships: [{ "kind": "parent", "target": "<classId>" }]`와
`progressionContributions: [{ "track": "<classId>", "threshold": 3, "grants": ["<특성 항목 id>"] }]`로 붙는다.

---

## 10. 확인하는 법

```bash
npx tsx scripts/check-module-grammar.ts <파일>.module.json          # unsupported 0, 모르는 속성 0 이어야 한다
npm run gate:client                                                  # 엔진을 건드렸으면
```

- `unsupported`: 실행기가 못 읽은 조각(연산 이름 오타, 모르는 `invocation`, `ask`가 아닌 `factQuery` …)
- `모르는 속성`: §4에 없는 `property`
- 테이블에서 전부 눌러 본다(D307): `node --import tsx --import ./tests/support/register-css.mjs scripts/verify-module-at-table.ts <파일> [보고서.json]` — 거절·무반응·풀 미소모를 센다. `--builtin`(파일 없이)이면 SRD 콘텐츠 전체를 누르고, 종족 선택마다 캐릭터를 만들어 선택이 사용을 가르는지도 본다(D308).
- 주문 글과 실행을 맞대 본다: `npx tsx scripts/audit-spells.ts [--module <파일>] [--out <보고서.json>]` — 글이 말하는 피해 주사위·유형, 내성, 명중 굴림, 집중, 상태, 상위 슬롯 증가가 실행에 있는지. 불일치가 곧 버그는 아니지만(선택 부가 효과일 수 있다) 버그는 전부 여기 나온다.
- 재주를 훑어본다: `npx tsx scripts/audit-feats.ts [--module <파일>]` — 재주마다 정의·계약이 있는지, 실행기가 못 읽는 조각, DM 줄뿐인 재주.
- 그다음은 실제로 캐릭터를 만들어 본다 — 특성마다 계약이 붙었는지, 자원 풀이 생겼는지, 창이 뜨는지. 시험은 **합성 모듈**로 쓴다(저장소에 남의 콘텐츠를 넣지 않는다): `tests/client/v6-module.test.ts`가 본보기다.

## 11. 문법을 넓혀야 할 때

1. 기존 어휘로 되는지 다시 본다 (§0 표).
2. 안 되면 **콘텐츠 중립 이름**으로 연산·속성을 하나 추가한다 (`marked-spell.die` ○ / `hunters-mark.die` ✗).
3. 그 문법을 쓰는 쪽은 JSON에만 적는다.
4. `docs/design/v3/ROLL20_TABLE_SPEC.md`에 D번호로 적고, 스키마(`schemas/*.json`)와 이 문서를 갱신한다.
5. 합성 모듈 시험을 하나 남긴다.
