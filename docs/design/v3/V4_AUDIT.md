# V4 플레이어 기준 재감사 목록 (D263~)

V0.9 계획의 V4 슬라이스가 처리할 구멍 전수 목록. 직업군별로 SRD 5.2.1 규칙과 계약·엔진 코드를 대조했다. 각 줄은 `대상 (레벨) — 문제 — [분류] 고칠 방향`. 분류: data-fix(JSON만), new-grammar(범용 문법 추가), host-hook(호스트 시점 추가), picker(선택 창), button(상황 버튼), DM-label(사유 있는 판정 표시). 처리하면 줄 앞에 ✔와 D 번호를 붙인다.

## 공통 엔진

- ✔ D285 화면을 열어 확인한 것: 브라우저로 테이블을 열어 소서러의 시전 창·명령 바를 눌러 보고 세 가지를 고쳤다(없는 슬롯 레벨의 교환 버튼, 내성 없는 주문에 뜬 고양 주문, 신속 주문이 행동을 쓴 표시). 새 캡처 `scripts/capture-client-v4.mjs`가 그 흐름을 E2E 게이트에서 지킨다.

- ✔ D268 주문 효과의 방어 데이터(`damageDefenses`, `armorClass`, `retaliation`, `preventsDeath`)를 엔진이 어디서도 읽지 않았다 — `bearerDefenses`가 전투원 방어·NPC AC에, 호스트가 화염 방패 반격과 죽음 방비에 쓴다.

- ✔ D265 효과의 턴마다 유지 조건(격노)이 코드의 콘텐츠 키 `"feature:barbarian.rage"`로 박혀 있었다(§2 위반, 검사가 놓침). — 효과 계약 `effect.upkeep`, 면제 `effect.upkeep-waived`, 검사 패턴 `contractKeys` 상한 0.

- (D264: 판정 전 탑승물은 셈. 특성 사용·행동 폭증은 남음) once-per-turn은 명중 창 탑승물만 센다(`host.ts` useThisTurn). 판정 전 탑승물·특성 사용·행동 폭증은 세지 않고 시트가 "직접 세어 주세요"라고 쓴다. — [host-hook] 턴 사용 기록을 판정 전 창·사용 버튼에도.
- ✔ D264 명중 창 내성 실패 상태(`riderSave`)가 항상 "다음 내 턴 시작까지 1라운드"로 박혀 있다. 넘어짐·1분 중독·1분 무의식이 한 라운드 뒤 사라진다. — [new-grammar] `condition.apply`에 지속시간과 반복 내성.
- ✔ D263 사용의 `healing.apply`/`temp-hp.grant`가 남 대상이어도 사용자 자신도 회복했다(`contractUse`). — 남 대상은 표로만.
- ✔ D263 양수 `resource.change`(풀 회복)가 적용되지 않았다. — `contractOutcome.restores`.
- ✔ D263 사용의 대상 피해(`damage.apply` target/area)가 굴림만 하고 HP를 깎지 않았다. — 표의 `strikes`, 주문 해석기로 내성·저항·되돌리기.
- ✔ D264 표의 `condition.apply`가 `save`를 무시한다(`act.contract`). — [host-hook] 대상마다 내성.
- ✔ D264 대상 표식 효과(다음 내성 불리, 다른 이의 다음 명중 +5, 기회 공격 불가, 속도 감소, 다음 명중 유리)가 없다. — [new-grammar]
- ✔ D278 계약 치유에 최상급 치유(최대값)가 적용되지 않는다. — [host-hook]
- (D266: `hp.zero.hold` ✔ 불굴의 격노·끈질긴 인내, 보호자의 선물·죽음 방비 남음) 전투 중 0 HP가 되는 순간의 가로채기(무모한 격노, 보호자의 선물)가 없다. — [new-grammar + host-hook]
- ✔ D273 야생 변신 형태(능력치 덮어쓰기)가 없다. — [new-grammar + picker]
- ✔ D272 슬롯↔점수 변환(마법의 원천)이 없다. — [new-grammar + picker]
- ✔ D280 메타매직이 시전 창에 없다. — [picker]
- ✔ D263 계약의 `adjudication.request` 문구에 계산된 수치를 붙이는 수단이 없었다. — `amount`.

## 바바리안
- ✔ D266 relentless-rage (11) — 0 HP 순간 가로채기 없음, 건강 내성 없음, HP를 레벨×2로 두지 않음, DC 누적이 풀로 잘못 모델링. — [new-grammar + host-hook]
- (D265: 근력 유리·유지 조건은 계약으로, 시전 금지는 남음) rage (1) — 근력 판정·내성 유리가 문구뿐(속성 있음). 주문 시전·집중 금지, 조기 종료 조건, 연장이 문구. — [data-fix + host-hook]
- ✔ D265 persistent-rage (15) — 수동 +1 버튼. 규칙은 이니셔티브 때 전부 회복, 긴 휴식당 1회. — [data-fix]
- ✔ D264 berserker.intimidating-presence (14) — 추가 행동·지혜 내성·공포·반복 내성·긴 휴식 1회·격노로 회복 없음. — [new-grammar]
- ✔ D277 berserker.mindless-rage (6) — 언제든 누르는 해제 버튼. 격노 중 면역이어야. — [new-grammar] 효과 중 조건부 속성.
- ✔ D277 berserker.frenzy (3) — 판정 전이지만 "처음 맞힌 대상"이라 명중 창이어야. 턴당 1회 안 셈. — [data-fix + host-hook]
- ✔ D287 (효과 수 상한은 계약으로, 15피트 밀기·속도 −15는 좌표가 없어 사유 있는 라벨) brutal-strike 계열 (9/13/17) — 턴당 1회·효과 수 제한 안 셈, 절뚝·휘청·무너뜨림 효과가 문구. — [new-grammar + host-hook]
- ✔ D267 berserker.retaliation (10) — 피해 받음 반응 창 없음. — [host-hook + button]
- ✔ D265 primal-champion (20) — cap 24, SRD는 25. — [data-fix]
- ✔ D277 indomitable-might (18) — 근력 판정 최소값이 문구. — [new-grammar] `ability-check.minimum-score`.
- ✔ D277 primal-knowledge (3) — 격노 중 기술을 근력으로가 없음. — [new-grammar]

## 파이터
- action-surge / -2 (2/17) — 턴당 1회 안 셈, 없는 자원 `fighter.action-surge.turn`을 결제로 씀, 마법 행동 제외 없음. — [host-hook]
- ✔ D270 champion.survivor (18) — 죽음 내성 18~20이 20으로 취급되지 않음. — [new-grammar] `death-save.crit-range`.
- ✔ D265 champion.remarkable-athlete (3) — 운동 판정 유리가 문구(속성 있음). — [data-fix]

## 몽크
- ✔ D263 open-hand.wholeness-of-body (6) — 고른 생물에게 피해 1d12. 자신 회복(무예 주사위+지혜)·지혜 수정치 횟수 풀 없음. — [data-fix]
- ✔ D270 open-hand.quivering-palm (17) — 해방이 내성 없이 10d12 전부. 공격 행동의 공격 하나 대신. 대상 표식·하나만 제한 없음. — [data-fix + new-grammar]
- ✔ D270 martial-arts (1) — 추가 행동 맨손 타격 없음. — [data-fix]
- ✔ D286 focus#flurry (2/10) — 2·3회 타격이 문구, 공격 경제 부여 없음. — [data-fix]
- ✔ D264 stunning-strike (5) — 무기 범위 없음(활에도), 성공 시 속도 절반·다음 공격 유리가 문구. — [data-fix + new-grammar]
- ✔ D270 deflect-attacks (3) — 되돌리기(기 1, 민첩 내성, 무예 주사위×2+민첩)가 문구. — [new-grammar]
- ✔ D265 superior-defense (18) — 기 3 소비·역장 외 저항 없음. — [data-fix]
- ✔ D266 disciplined-survivor (14) — 실패한 내성 기 1로 재굴림 없음. — [data-fix]
- ✔ D265 perfect-focus (15) — 수동 +4. 이니셔티브 때 4까지 채우기. — [new-grammar] "N까지 회복".
- ✔ D270 self-restoration (10) — 세 상태를 한 번에 버튼. 턴 끝마다 하나. — [host-hook + picker]
- ✔ D286 open-hand.fleet-step (11) — 무료라는 문구가 틀림, 결제 중복. — [data-fix]
- ✔ D264 open-hand.open-hand-technique (3) — 밀어내기 내성 굴림 없음, 교란의 기회 공격 불가가 문구, 넘어짐 1라운드. — [new-grammar]
- ✔ D263 slow-fall (4) — DM 팔레트 손 작업 안내. — [button] 마지막 낙하 피해 감소 반응.

## 로그
- ✔ D266 stroke-of-luck (20) — 풀만 소비, 굴림은 그대로. — [data-fix] 실패 시 20으로.
- ✔ D264 cunning-strike#poison/#trip (5) — 1분·반복 내성이 1라운드로. — [new-grammar]
- ✔ D264 devious-strikes#daze (14) — 내성·효과 없음. — [new-grammar]
- ✔ D264 devious-strikes#knock-out/#obscure (14) — 지속시간 잘못. — [new-grammar]
- ✔ D270 sneak-attack (1) — 유리 여부를 앱이 아는데 확인 안 함, 인접 아군이 문구. — [host-hook + button]
- ✔ D270 improved-cunning-strike (11) — 효과 둘 제한 안 셈. — [picker]
- ✔ D263 thief.thiefs-reflexes (17) — 기습 제외는 2014 문구, 2024엔 없음. — [data-fix] 문구 제거 (D263의 기습 버튼은 2024 기습 규칙: 이니셔티브 불리).
- ✔ D263 thief.use-magic-device (13) — 충전 d6·두루마리 지능 판정이 손 작업. — [host-hook]
- ✔ D265 thief.supreme-sneak (9) — 조건 문구가 틀림(엄폐 뒤에서 턴 끝). — [data-fix + button]
- (D265: 행동 메뉴에 마법 행동이 없어 안내) thief.fast-hands (9) — 마법 행동을 추가 행동으로 누락. — [data-fix]

## 바드
- ✔ D266 bardic-inspiration (1) — 아군이 주사위를 받지 않음. 실패한 d20에 구조로 제시해야. — [new-grammar + host-hook]
- ✔ D274 college-of-lore.cutting-words (3) — 사실 질의가 KNOWN_FACTS에 없어 계약이 미지원 처리, 풀 주사위 전달 안 됨, 피해 굴림에 없음. — [host-hook]
- ✔ D274 college-of-lore.peerless-skill (14) — 고정 1d12, 영감 주사위여야. — [data-fix]
- ✔ D265 superior-inspiration (18) — 수동 +2. 이니셔티브 때 2까지. — [data-fix + new-grammar]
- countercharm (7) — 매혹·공포 내성 실패 시 반응 재굴림 계산 가능. — [host-hook]
- words-of-creation (20) — 두 번째 대상. — [picker]
- ✔ D286 (확인: 2레벨·9레벨 각각 2개, 9레벨에 4개 전문화) expertise (2/9) — 9레벨 두 번째 선택 확인 필요. — [data-fix?]
- ✔ D263 font-of-inspiration (5) — 슬롯으로 영감 회복이 손 작업. — [data-fix] D263 슬롯 결제·풀 회복으로.

## 클레릭
- ✔ D263 channel-divinity#divine-spark-heal — 치유가 사용자에게도 들어감(공통 항목).
- ✔ D278 life-domain.supreme-healing (17) — 계약 치유에 최대값 없음. — [host-hook]
- ✔ D264 channel-divinity#turn-undead (2) — 지혜 내성·공포·행동불능이 문구, 소각 피해에 내성 조건 없음, 피해 받으면 끝 없음. — [host-hook + data-fix]
- ✔ D263 channel-divinity#divine-spark-harm (2) — 건강 내성 절반이 문구. — [data-fix] D263 `save`.
- ✔ D278 divine-intervention (10) — 5레벨 이하 클레릭 주문 무료 시전 선택 없음. — [picker]
- ✔ D263 greater-divine-intervention (20) — 2d4 긴 휴식 잠금. — [data-fix] D263 `resource.lockout`.
- improved-blessed-strikes#potent (14) — 선택지 없어도 표시, 소마법 피해 뒤 제시 아님. — [data-fix + host-hook]
- ✔ D263 life-domain.preserve-life (3) — 회복 유형 피해, 행동 결제 없음, 절반 최대 제한 없음. — [data-fix + picker]
- ✔ D263 blessed-strikes.divine-strike — 광휘/괴저 선택. — [picker]
- ✔ D263 life-domain.blessed-healer — 자신 회복 손 작업. — [data-fix] D263 `healing.self-on-slot-heal`.

## 팔라딘
- ✔ D265 oath-of-devotion.sacred-weapon (3) — 신성 변환 소비·매력 명중 보너스·광휘 없음, 누르면 아무것도 안 바뀜. — [data-fix]
- ✔ D264 abjure-foes (9) — 행동 결제·지혜 내성·공포·대상 수 없음. — [data-fix + host-hook]
- channel-divinity (3) — "수동 적용" 안내, 신성 감지 계약 없음. — [button]
- ✔ D265 lay-on-hands (1) — 남에게 쓰면 점수만 쓰고 치유 안 됨, 중독 해제 5점이 문구. — [data-fix + host-hook]
- ✔ D278 oath-of-devotion.holy-nimbus (20) — 빈 효과. — [data-fix + host-hook]
- ✔ D278 restoring-touch (14) — 안수 한 번에 여러 상태 해제가 아님. — [picker]
- ✔ D267 (D265: 자신 면역 ✔, 아군 남음) aura-of-courage / aura-of-devotion (10/7) — 해제 버튼, 면역이어야. 아군 쪽 오라. — [data-fix + button]
- ✔ D267 aura-of-protection — 아군 내성 보너스 손 작업. — [button] "오라 안" 표식.
- ✔ D267 aura-expansion (18) — 오라 반경. — [DM-label] 오라 안 버튼과 함께.
- ✔ D267 smite-of-protection (15) — 신성한 강타 뒤 효과 + 오라 안 버튼. — [host-hook]
- ✔ D265 favored-enemy / paladin.smite / faithful-steed 자체 버튼 — 주문 없이 횟수만 소비. — [data-fix] 버튼 제거.

## 레인저
- ✔ D267 hunter.superior-hunters-defense (15) — 13개 수동 버튼, 피해 받음 반응 창이어야, 맞은 피해 절반 손 작업. — [data-fix + host-hook]
- ✔ D278 hunter.hunters-prey 무리 파괴자 (3) — 계약 없음. — [button]
- (D265: 추가 행동·횟수·투명 ✔, 투명 자동 해제 남음) natures-veil (14) — 추가 행동·투명 없음. — [data-fix]
- ✔ D265 tireless (10) — 임시 HP에 지혜 수정치 빠짐, 짧은 휴식 탈진 −1 없음. — [data-fix + new-grammar]
- ✔ D263 hunter.superior-hunters-prey (11) — 표식 주사위 크기. — [data-fix] D263 `diceSides`.
- ✔ D263 hunter.hunters-lore (7) — [data-fix] D263 `marked-spell.reveal-defenses`.

## 드루이드
- ✔ D273 wild-shape (2) — 형태 없음(AC·공격·속도·능력치), 형태 목록·CR 제한, 지속시간·해제 없음. — [new-grammar + picker]
- ✔ D273 elemental-fury.primal-strike (7) — 야생 변신 공격에 안 붙음. — [host-hook] 형태와 함께.
- ✔ D272 wild-resurgence (5) — 슬롯↔야생 변신 교환 둘 다 없음. — [data-fix] D263 슬롯 결제·풀 회복.
- (D265: 이니셔티브 회복 ✔, 자연 마법사 남음) archdruid (20) — 수동 +1, 이니셔티브 때 0이면. 자연 마법사 문구. — [data-fix + picker]
- ✔ D279 circle-of-the-land.natures-sanctuary (14) — 사용 소비·행동·엄폐·저항 없음. — [data-fix + button]
- ✔ D279 wild-companion (2) — 사역마 찾기 무료 시전 없음. — [new-grammar]
- ✔ D279 circle-of-the-land.natural-recovery (6) — 회합 주문 무료 시전이 문구. — [picker]
- ✔ D263 circle-of-the-land.lands-aid (3) — 내성 없음, 아군 회복 없음. — [data-fix]

## 소서러
- ✔ D272 font-of-magic (2) — 슬롯↔점수 변환 없음. — [new-grammar + picker]
- ✔ D265 innate-sorcery (1) — 효과에 속성 없음(DC +1, 주문 명중 유리), 추가 행동 결제 없음. — [data-fix]
- ✔ D265 draconic.dragon-wings (14) — 비행 60·추가 행동·횟수 없음. — [data-fix]
- draconic.dragon-companion (18) — 집중 없음이 문구. — [picker]
- ✔ D265 metamagic.twinned-spell — 2014 비용 문구. — [data-fix]
- sorcery-incarnate / arcane-apotheosis (7/20) — 점수로 선천 마법, 메타매직 둘·무료. — [data-fix + picker]
- elemental-affinity (6) — 멀티클래스 시 능력치 오류. — [data-fix]

## 워락
- ✔ D271 fiend.hurl-through-hell (14) — 수동 버튼 즉시 피해. 명중 창·매력 내성·행동불능·마귀 제외·긴 휴식 1회·계약 슬롯 회복 없음. — [data-fix]
- ✔ D271 계약 없는 기원: pact-of-the-blade, thirsting-blade, devouring-blade, eldritch-smite, lifedrinker, eldritch-mind, devils-sight, armor-of-shadows, ascendant-step, fiendish-vigor, mask-of-many-faces, master-of-myriad-forms, misty-visions, one-with-shadows, otherworldly-leap, visions-of-distant-realms, whispers-of-the-grave, repelling-blast, eldritch-spear, pact-of-the-chain, investment-of-the-chain-master, gift-of-the-protectors. — [data-fix + new-grammar] 무제한 무료 시전 `grant.resource` `atWill`, 계약 슬롯 탑승 비용.
- ✔ D271 gift-of-the-depths (5) — 수중 호흡·무료 시전 없음. — [data-fix]
- (D265: 역장 제외·문구 ✔, 휴식 창 선택 남음) fiend.fiendish-resilience (10) — 역장 제외, 2014 문구, 휴식 창 선택 없음. — [data-fix + picker]
- ✔ D263 fiend.dark-ones-blessing (3) — 10피트(5피트 아님), 처치 카드 버튼. — [data-fix] D263 근처 처치 제시.
- ✔ D265 contact-patron (9), mystic-arcanum-6..9 — 수동 소비 줄이 무료 시전과 이중 소비. — [data-fix]

## 위저드
- ✔ D265 evoker.evocation-savant (3) — 추가한 주문을 준비 선택지에서 못 고름(`spells.ts` 준비 선택지가 `picked`만). — [engine bug]
- memorize-spell (5) — 짧은 휴식 준비 교체 없음. — [picker]
- spell-mastery (18) — 주문서 안의 주문이 아니라 목록 전체. — [data-fix] `from: spellbook`.
- evoker.overchannel (14) — 멀티클래스 시 위저드 주문 제한 없음. — [data-fix]

## 재주·종족·주문

- ✔ D269 상태를 끝내는 주문의 `removesConditions`를 클라이언트가 읽지 않았다 — 표의 해제 줄로.
### 재주
- ✔ D266 epic.combat-prowess — 빗나감이 치명타로 바뀜(SRD는 명중), 턴당 1회 없음. — [data-fix + new-grammar] 명중으로 바꾸기 모드, 턴 시작 초기화.
- epic.fate — 자신의 실패에만 2d4, 60피트 안 다른 이의 판정·감점 불가, 이니셔티브 회복 없음. — [picker + host-hook]
- ✔ D276 epic.irresistible-offense — 치명타 추가 피해가 항상 근력 점수. — [data-fix] 올린 능력치.
- ✔ D276 epic.night-spirit — 전부 문구, 저항 범위 틀림. — [button + data-fix]
- ✔ D276 epic.spell-recall — 1~4레벨 무슬롯 시전 없음. — [picker]
- ✔ D276 epic.dimensional-travel — 표시 없음. — [DM-label/button]
- ✔ D276 grappler — 붙잡은 대상 유리 계산 가능(grappledBy), 맨손 명중 시 붙잡기. — [new-grammar + picker]
- ✔ D276 alert — 이니셔티브 교환이 손 작업. — [picker]

### 종족
- ✔ D275 goliath 거대한 형태 — 5레벨부터 +10 속도가 항상 켜짐, 내성 유리는 틀림, 크기 그대로. — [data-fix] 추가 행동 10분 효과.
- ✔ D275 dragonborn 용의 비행 — 비행 30이 항상 켜짐. — [data-fix] 추가 행동 10분 효과.
- ✔ D275 dragonborn 브레스 웨폰 — 민첩 내성 없음, DC·혈통 피해 유형·절반·공격 하나 대신 없음. — [data-fix] D263 `save`.
- goliath 거인 혈통 6종 — 풀만 있음. — [data-fix + host-hook]
- ✔ D266 orc 불굴의 인내 — 0 HP 대신 1 없음. — [host-hook]
- ✔ D266 halfling 행운 — 1 재굴림 없음. — [data-fix + new-grammar]
- ✔ D275 elf 요정 혈통, halfling 용감함, dwarf 드워프 강인함 — 매혹·공포·중독 내성 유리 없음. — [new-grammar] 상태 한정 내성 유리.
- ✔ D275 gnome 노움의 교활함 — 지·지·매 내성 유리 없음(문법 있음). — [data-fix]
- ✔ D275 human 수완 — 긴 휴식에 영웅적 영감 없음. — [data-fix + host-hook]
- ✔ D275 goliath 강력한 체격 — 붙잡힘 탈출 판정 유리. — [data-fix]
- 하플링 민첩함·은신 본능, 엘프 무아지경 — 표시 없음. — [DM-label]

### 주문 (소마법·1~3레벨)
- ✔ D281 guidance — 한 번 +1d4 후 종료. 2024는 고른 기술 판정마다. — [picker + data-fix]
- ✔ D268 sorcerous-burst — 항상 화염, 8 폭발 주사위 없음. — [picker + new-grammar]
- ✔ D281 shillelagh — 17레벨 1d20(SRD 2d6), 곤봉 ID 코드 비교(§2 위반 `effects.ts`), 역장 선택 없음. — [data-fix + picker]
- produce-flame, flame-blade — 추가 행동 시전·이후 마법 행동 공격이어야. — [data-fix]
- ✔ D269 spellIsJudged 버그 — 색인 데이터(sustain, creatures, weapon-spell)를 안 봐서 true-strike·spike-growth·find-familiar·find-steed·animate-dead가 판정으로 표시. — [engine bug]
- ✔ D283 spare-the-dying — 안정화 계산 가능. — [host-hook]
- ✔ D284 (문법과 작성된 5개: 축복·액운·영웅심·투명화·능력 강화. 나머지는 정의를 작성해야 함) 상위 슬롯 대상 증가 문법 없음(축복·액운·매혹·명령·웃음·영웅심·도약·괴물/인간 포박·투명·실명/귀머거리·능력 강화·비행·추방 등), 호스트가 추가 대상 거절. — [new-grammar] `targetsPerSlotAboveBase`.
- ✔ D268 chromatic-orb — 항상 화염, 튕김 없음. — [picker + new-grammar]
- ice-knife — 피해 없음. 명중 1d10 뒤 범위 2d6 내성. — [new-grammar]
- command — 효과 없음. — [picker]
- ✔ D269 hideous-laughter — 반복 내성·피해 시 재내성 없음. — [data-fix + host-hook]
- sleep — 두 번째 실패 무의식 없음. — [new-grammar]
- ✔ D282 heroism — 턴 시작 임시 HP 없음. — [new-grammar]
- ✔ D282 ensnaring-strike, searing-smite — 턴 시작 피해·종료 내성이 문구. — [new-grammar]
- shining-smite — 대상 공격 유리가 문구(문법 있음). — [data-fix]
- ✔ D283 hellish-rebuke — 반응으로 제시 안 됨. — [host-hook]
- expeditious-retreat — 판정 표시, 추가 행동 질주 문법 있음. — [data-fix]
- grease — 들어감·턴 끝 내성 없음. — [button]
- acid-arrow — 다음 턴 2d4·빗나감 절반 없음. — [new-grammar]
- ✔ D269 spiritual-weapon — 슬롯당 +1d8 없음. — [data-fix]
- ✔ D281 aid — 최대 HP +5 고정. — [data-fix]
- ✔ D268 blindness-deafness — 둘 다 부여. — [picker]
- ✔ D268 enhance-ability — 모든 판정 유리. — [picker]
- dragon-s-breath — 효과 없는 내성, 아군 브레스 없음. — [picker + data-fix]
- ✔ D269 flaming-sphere — 피해 없는 내성. — [data-fix + button]
- ✔ D281 protection-from-poison — 모든 내성 유리, 중독 해제 없음. — [data-fix + new-grammar]
- ✔ D269 ray-of-enfeeblement — 실패에 성공 효과, 근력 판정 불리·피해 −1d8·반복 내성 없음. — [data-fix + new-grammar]
- calm-emotions — 효과 없음. — [picker]
- ✔ D281 invisibility — 공격·시전 시 종료가 문구. — [host-hook]
- ✔ D269 lesser-restoration — 판정 표시. — [picker]
- ✔ D281 magic-weapon — 슬롯에 따른 +2/+3 없음. — [data-fix]
- warding-bond — 저항·피해 공유가 문구. — [host-hook]
- ✔ D269 beacon-of-hope — 아군 내성, 모든 내성 유리, 치유 최대값 없음. — [data-fix]
- ✔ D268 bestow-curse — 두 효과 동시. — [picker]
- ✔ D269 slow — 효과 없는 내성. — [data-fix]
- stinking-cloud — 중독 지속 틀림. — [data-fix + button]
- ✔ D283 vampiric-touch — 시전자 회복 없음. — [new-grammar]
- blink — 턴 끝 d6 계산 가능. — [host-hook]
- (D268: 에너지 보호·화염 방패·저주 선택 ✔) 알려진 것: protection-from-energy·fire-shield 유형 고정, hex 능력치, enlarge-reduce 선택, resistance 2024 피해 감소, mirror-image·sanctuary 미계산, protection-from-evil-and-good 모든 공격자, 메타매직. — [picker/new-grammar]

### 주문 (4~9레벨 전투)
- ✔ D269 vitriolic-sphere, conjure-woodland-beings, delayed-blast-fireball, befuddlement — 피해 없음. — [data-fix]
- prismatic-spray — 굴림 없음. — [new-grammar]
- divine-word — HP별 효과 없음. — [new-grammar]
- eyebite — 선택 없음. — [picker]
- confusion — d10 행동·반복 내성 없음. — [new-grammar]
- polymorph / true-polymorph — 끝난 것처럼 보임. — [DM-label]
- ✔ D269 dispel-evil-and-good — 방향 반대(scope target이어야). — [data-fix]
- dominate-beast/person/monster — 피해 시 즉시 종료(SRD는 재내성). — [data-fix]
- phantasmal-killer — 판정 불리·반복 피해 문구. — [data-fix]
- ✔ D281 mass-heal — 대상 1명. — [data-fix + picker]
- conjure-minor-elementals — 항상 화염. — [picker]
- ✔ D268 death-ward — 0 대신 1이 문구. — [host-hook]
- ✔ D282 aura-of-life — 턴 시작 1 HP가 문구. — [host-hook]

### 판정 주문 중 계산 가능한 것
빈사 안정화, 신속 후퇴, 하급·상급 회복, 이동의 자유, 정신 방벽, 영웅의 연회, 기체 형태, 점멸, 침묵·어둠·안개 구름(안에 있음 버튼), 투명 간파, 비전의 손, 용 소환·거대 곤충·물체 살리기(SRD 소환 틀 없음), 거울 분신, 진실의 일격·가시 성장·사역마 찾기·군마 찾기·시체 조종(표시 버그). 나머지(탐지·점술·대화·이동·벽·소원·시간 정지·변신 등)는 사유 있는 DM 판정.
