/**
 * R56 (ROLL20_TABLE_SPEC.md D191): the contracts for the PHB 2024 supplement's feats.
 *
 * The supplement ships 58 feats whose `execution.status` is `descriptive` — presentation and selection only. Every
 * one of them is authored here against the seams R51–R55 opened, in the same grammar the SRD content uses. A feat
 * that this engine can run is a number; a feat that turns on where people are standing (the scene has no positions,
 * D109) or on a mount, a kitchen or a cloudy sky is an `adjudication.request` naming what the table must judge.
 *
 * The output is NOT built into the app: it carries PHB rules, not SRD ones, so it is installed alongside the
 * supplement it belongs to. Run it with `node scripts/author-phb-feat-contracts.mjs`.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const PB = { ref: "proficiency.bonus" };
const LEVEL = { ref: "actor.level" };
const ask = (question) => ({ kind: "adjudication.request", question });
/**
 * R57 (D192): a fact the person at the table confirms, rather than a sentence they read. `at` says when they are
 * asked (`pre-roll` in the attack dialog, `reaction` on the prompt); anything written `when: on(id)` waits for the
 * tick. This is how a rule gated on where people are standing runs in a scene that has no positions (D109).
 */
const fact = (id, at, question) => ({ kind: "adjudication.request", question, fact: { id, at } });
const on = (id) => ({ ref: `fact:${id}` });
const modify = (property, extra = {}) => ({ kind: "property.modify", property, operation: "add", ...extra });
const INTERACTION = { id: "use", kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" }, revalidate: "if-revision-changed", stalePolicy: "reject" };

/** A pre-roll rider (R52): declared in the attack dialog, narrowed to a weapon. */
const rider = (attack, operations) => ({ id: "declare", invocation: "pre-roll-attack", attack: { oncePerTurn: true, requiresEffects: [], ...attack }, operations });
/** An aftermath (R53): fires once the swing has landed. */
const after = (outcomes, operations, scope) => ({ id: `after-${outcomes.join("-")}`, timing: "attack.resolved", slot: "attack.outcome", outcomes, ...(scope ? { scope } : {}), operations });
/** A reaction window (R54). */
const guard = (operations) => ({ id: "guard", timing: "reaction.window", slot: "reaction", trigger: "attack.hit-self", interaction: INTERACTION, operations });

/**
 * Every feat, by its supplement slug. `rules` are the entry-point operations (standing properties and the lines the
 * table judges); `riders` and `hooks` are the two interceptor families; `pre` are pre-roll entry points.
 */
const FEATS = {
  actor: { rules: [ask("변장한 동안 그 인물이라고 납득시키는 매력(기만·공연) 판정에 유리 — 굴릴 때 선언"), ask("소리 흉내: 듣는 쪽이 DC 8 + 매력 + 숙련의 지혜(통찰)로 간파")] },
  athlete: { rules: [modify("speed.climb", { value: 0, note: "이동 속도와 같은 등반 속도" }), ask("엎드림에서 5피트 이동만으로 일어섬"), ask("5피트만 이동한 뒤에도 도움닫기 도약")] },
  "blind-fighting": { rules: [modify("senses.blindsight", { value: 10 })] },
  charger: { rules: [ask("질주 행동 동안 이동 속도 +10")], pre: [rider({ scope: "melee" }, [
    fact("charged", "pre-roll", "대상을 향해 직선으로 10피트 이상 이동했다"),
    { kind: "damage.apply", dice: "1d8", damageType: "weapon", target: "attack-target", when: on("charged") },
    ask("피해 대신 10피트 밀기를 골라도 됩니다"),
  ])] },
  chef: { rules: [ask("짧은 휴식에 4 + 숙련 보너스 명분의 음식 — 먹고 히트 다이스를 쓰면 1d8 추가 회복"), ask("긴 휴식·1시간 작업에 숙련 보너스만큼의 간식 (추가 행동으로 먹고 임시 HP 숙련 보너스)")] },
  crafter: { rules: [ask("도구 숙련과 할인은 만들기·장보기에서")] },
  "crossbow-expert": { rules: [ask("쇠뇌의 장전 속성 무시"), ask("근접 사격: 이 앱은 그 불리를 애초에 적용하지 않습니다 (장면에 거리가 없음) — 이미 효과가 난 셈입니다")] },
  crusher: { hooks: [after(["hit"], [ask("타격 피해를 준 공격으로 대상을 5피트 빈 공간으로 (턴당 한 번)")], "bludgeoning"), after(["crit"], [{ kind: "condition.apply", condition: "교란", target: "target" }, ask("다음 자기 턴 시작까지 이 대상에게 유리")], "bludgeoning")] },
  "defensive-duelist": { guards: [guard([
    fact("finesse-in-hand", "reaction", "기교 무기를 들고 있고, 맞은 것이 근접 공격이다"),
    modify("ac.bonus", { value: PB, when: on("finesse-in-hand") }),
  ])] },
  "dual-wielder": { rules: [ask("공격 행동 뒤 추가 행동으로 다른 무기 한 번 (양손 아님, 수정치가 음수가 아니면 피해에 능력 수정치)"), ask("무기 두 개를 한 번에 뽑거나 집어넣음")] },
  dueling: { rules: [modify("damage.bonus", { value: 2, scope: "one-handed-melee", note: "다른 무기를 들지 않은 동안" })] },
  durable: { rules: [ask("죽음 내성 굴림에 유리 — 굴릴 때 선언"), ask("추가 행동으로 히트 다이스 하나를 굴려 회복")] },
  "elemental-adept": { rules: [ask("고른 피해 유형 하나: 자신의 주문이 그 저항을 무시하고, 그 유형 피해 주사위의 1은 2로"), ask("어떤 유형을 골랐는지 시트에 적어 두세요 — 앱은 고름을 기억하지 않습니다")] },
  "fey-touched": { rules: [ask("점술·환혹 1레벨 주문 하나와 안개 걸음을 항상 준비, 각각 긴 휴식마다 슬롯 없이 한 번")] },
  "great-weapon-master": { pre: [rider({ scope: "heavy" }, [
    fact("attack-action", "pre-roll", "자신의 턴에 공격 행동의 일부로 휘두른다"),
    { kind: "damage.apply", amount: PB, damageType: "weapon", target: "attack-target", when: on("attack-action") },
  ])], hooks: [after(["crit", "downed"], [{ kind: "economy.modify", bucket: "bonus-action.extra", amount: 1 }, ask("같은 무기로 추가 행동 공격 한 번")], "melee")] },
  healer: { rules: [ask("회복 주사위가 1이면 다시 굴려 새 결과를 씁니다"), ask("치유사 가방으로 히트 다이스 하나 + 숙련 보너스만큼 회복 (짧은 휴식마다 한 번)")] },
  "heavily-armored": { rules: [modify("proficiency.armor", { value: "중갑" })] },
  "heavy-armor-master": { rules: [modify("damage-taken.reduce", { value: PB, damageTypes: ["타격", "관통", "참격"], when: { op: "eq", left: { ref: "armor.training" }, right: { value: "heavy" } }, note: "중갑을 입은 동안" })] },
  "inspiring-leader": { rules: [ask("휴식 끝에 30피트 안 아군 최대 여섯에게 임시 HP (캐릭터 레벨 + 올린 능력치 수정치) — 대상 지정은 표에서")] },
  interception: { guards: [{ ...guard([
    fact("within-5ft", "reaction", "맞은 사람에게서 5피트 안에 있고, 방패나 무기를 들고 있다"),
    modify("damage-taken.reduce", { dice: "1d10", value: PB, when: on("within-5ft") }),
  ]), trigger: "attack.hit-ally" }] },
  "keen-mind": { rules: [ask("비전학·역사·조사·자연·종교 중 하나에 숙련 또는 전문화 — 만들기·레벨업에서 시트에 반영됩니다"), ask("연구 행동을 추가 행동으로")] },
  "lightly-armored": { rules: [modify("proficiency.armor", { value: "경갑" }), modify("proficiency.armor", { value: "방패" })] },
  lucky: { rules: [ask("행운 점수 (숙련 보너스만큼, 긴 휴식마다 회복) — 유리·불리를 사고 판정을 다시 굴립니다")] },
  "mage-slayer": { rules: [ask("집중 중인 대상에게 피해를 주면 그 집중 내성에 불리"), ask("지능·지혜·매력 내성에 실패했을 때 대신 성공 (휴식마다 한 번)")] },
  "martial-weapon-training": { rules: [modify("proficiency.weapon", { value: "군용 무기" })] },
  "medium-armor-master": { rules: [modify("ac.bonus", { value: 1, when: { op: "all", args: [{ op: "eq", left: { ref: "armor.training" }, right: { value: "medium" } }, { op: "gte", left: { ref: "ability.dex.modifier" }, right: { value: 3 } }] }, note: "평갑의 민첩 상한이 3" })] },
  "moderately-armored": { rules: [modify("proficiency.armor", { value: "평갑" }), modify("proficiency.armor", { value: "방패" })] },
  "mounted-combatant": { rules: [ask("탈것 규칙은 앱이 다루지 않습니다 — 기마 타격·비켜서기·진로 변경은 표에서")] },
  musician: { rules: [ask("휴식 끝에 숙련 보너스만큼의 아군에게 영웅적 영감")] },
  observant: { rules: [ask("통찰·조사·지각 중 하나에 숙련 또는 전문화"), ask("수색 행동을 추가 행동으로")] },
  piercer: { hooks: [after(["hit"], [ask("관통 피해 주사위 하나를 다시 굴려 새 결과를 씁니다 (턴당 한 번)")], "piercing"), after(["crit"], [ask("피해 주사위 하나를 더 굴려 더합니다")], "piercing")] },
  poisoner: { rules: [modify("damage.ignore-resistance", { value: "독" }), ask("독 제조 도구로 약량을 만들고 추가 행동으로 바릅니다 (DC 8 + 숙련 + 민첩)")] },
  "polearm-master": { rules: [ask("육척봉·창·중량+장거리 무기로 공격한 뒤 추가 행동으로 자루 끝 근접 공격 (d4 타격)"), ask("그 무기의 간격에 들어오는 생물에게 반응으로 근접 공격 — 장면에 위치가 없어 표에서 선언합니다")] },
  protection: { rules: [ask("5피트 안의 다른 이를 노린 공격에 반응으로 불리 (방패 필요) — 장면에 위치가 없어 표에서 선언합니다")] },
  resilient: { rules: [ask("올린 능력치의 내성 굴림에 숙련 — 만들기·레벨업에서 시트에 반영됩니다")] },
  "ritual-caster": { rules: [ask("의식 태그 1레벨 주문을 숙련 보너스만큼 항상 준비"), ask("긴 휴식마다 한 번, 준비한 의식 하나를 슬롯 없이 보통 시전 시간으로")] },
  sentinel: { hooks: [after(["hit"], [{ kind: "condition.apply", condition: "둔화", target: "target" }, ask("기회 공격으로 명중시켰다면 대상의 이동 속도가 이번 턴 0")], "melee")], rules: [ask("5피트 안의 생물이 이탈하거나 다른 대상을 명중시키면 기회 공격 — 장면에 위치가 없어 표에서 선언합니다")] },
  "shadow-touched": { rules: [ask("환영·사령 1레벨 주문 하나와 투명화를 항상 준비, 각각 긴 휴식마다 슬롯 없이 한 번")] },
  sharpshooter: { rules: [modify("attack-roll.ignore-cover", { value: true, scope: "ranged", note: "절반·3/4 엄폐 무시" }), ask("근접 사격·장거리 사격: 이 앱은 그 불리를 애초에 적용하지 않습니다 (장면에 거리가 없음) — 이미 효과가 난 셈입니다")] },
  "shield-master": { hooks: [after(["hit"], [ask("장비한 방패로 후려치기: DC 8 + 근력 + 숙련의 근력 내성, 실패면 5피트 밀기 또는 넘어짐 (턴당 한 번)")], "melee")], rules: [ask("민첩 내성에 성공하면 반응으로 피해를 아예 받지 않음 (방패 필요)")] },
  skulker: { rules: [modify("senses.blindsight", { value: 10 }), ask("전투 중 숨기의 민첩(은신) 판정에 유리"), ask("숨은 채로 빗나가도 위치가 드러나지 않음")] },
  slasher: { hooks: [after(["hit"], [{ kind: "condition.apply", condition: "둔화", target: "target" }, ask("참격 피해로 명중시켜 이동 속도 −10 (턴당 한 번)")], "slashing"), after(["crit"], [{ kind: "condition.apply", condition: "약화", target: "target" }, ask("다음 자기 턴 시작까지 대상의 공격 굴림에 불리")], "slashing")] },
  speedy: { rules: [modify("speed.walk", { value: 10 }), ask("질주하면 그 턴 험지가 추가 이동을 요구하지 않음"), ask("자신을 향한 기회 공격에 불리 — 표에서 선언합니다")] },
  "spell-sniper": { rules: [modify("attack-roll.ignore-cover", { value: true, note: "주문 공격 굴림이 절반·3/4 엄폐 무시" }), ask("근접 시전: 이 앱은 그 불리를 애초에 적용하지 않습니다 (장면에 거리가 없음) — 이미 효과가 난 셈입니다"), ask("공격 굴림이 필요한 10피트 이상 주문의 사거리 +60피트")] },
  "tavern-brawler": { pre: [rider({ scope: "unarmed" }, [fact("push-5ft", "pre-roll", "명중하면 대상을 5피트 민다 (빈 공간이 있다)")])] },
  tough: { rules: [modify("hp.maximum", { value: { op: "mul", args: [{ value: 2 }, LEVEL] }, note: "캐릭터 레벨 × 2" })] },
  "unarmed-fighting": { rules: [ask("자기 턴 시작에 붙잡고 있는 생물 하나에게 1d4 타격")] },
  "war-caster": { rules: [ask("집중 유지 건강 내성에 유리 — 굴릴 때 선언"), ask("기회 공격 대신 반응으로 그 생물만 노리는 행동 주문 한 번"), ask("무기·방패를 들고도 동작 구성요소 수행")] },
  "weapon-master": { rules: [ask("숙련된 단순·군용 무기 하나의 통달 속성을 씁니다 (긴 휴식마다 바꿀 수 있음) — 시트의 무기 숙련에 적어 두세요")] },
  "thrown-weapon-fighting": { rules: [modify("damage.bonus", { value: 2, scope: "thrown", note: "투척 무기 원거리 명중" })] },
  telekinetic: { rules: [ask("마법사의 손을 구성요소 없이, 사거리 +30피트"), ask("추가 행동으로 30피트 안의 생물 하나에게 근력 내성 (DC 8 + 올린 능력치 + 숙련), 실패면 5피트 이동")] },
  telepathic: { rules: [ask("60피트 안의 생물에게 텔레파시로 말함 (대상은 답할 수 없음)"), ask("생각 탐지를 항상 준비, 긴 휴식마다 슬롯 없이 한 번")] },
  "skill-expert": { rules: [ask("기술 하나에 숙련, 숙련된 기술 하나에 전문화 — 만들기·레벨업에서 시트에 반영됩니다")] },
  "boon-of-energy-resistance": { rules: [ask("고른 두 유형에 저항, 그 유형 피해를 받으면 반응으로 60피트 안의 생물에게 2d12 + 건강 (민첩 내성)")] },
  "boon-of-fortitude": { rules: [modify("hp.maximum", { value: 40 }), ask("HP를 회복할 때 건강 수정치만큼 추가 (턴당 한 번)")] },
  "boon-of-recovery": { rules: [ask("d10 열 개의 풀 — 추가 행동으로 원하는 만큼 굴려 회복, 긴 휴식에 전부 회복")] },
  "boon-of-skill": { rules: [ask("전문화가 없는 기술 하나에 전문화 — 만들기·레벨업에서 시트에 반영됩니다")] },
  "boon-of-speed": { rules: [modify("speed.walk", { value: 30 })] },
};

/** The supplement's own Korean names, so the two modules agree on what each feat is called. */
const NAMES = {
  "actor": "배우",
  "athlete": "운동선수",
  "blind-fighting": "맹목 전투",
  "boon-of-energy-resistance": "에너지 저항의 은총",
  "boon-of-fortitude": "강인함의 은총",
  "boon-of-recovery": "회복의 은총",
  "boon-of-skill": "기술의 은총",
  "boon-of-speed": "속도의 은총",
  "charger": "돌격자",
  "chef": "요리사",
  "crafter": "제작자",
  "crossbow-expert": "쇠뇌 전문가",
  "crusher": "분쇄자",
  "defensive-duelist": "방어적 결투가",
  "dual-wielder": "쌍수 사용자",
  "dueling": "결투",
  "durable": "튼튼함",
  "elemental-adept": "원소 숙련자",
  "fey-touched": "요정의 손길",
  "great-weapon-master": "대형 무기 달인",
  "healer": "치유사",
  "heavily-armored": "중갑 훈련",
  "heavy-armor-master": "중갑 달인",
  "inspiring-leader": "고무적인 지도자",
  "interception": "가로막기",
  "keen-mind": "예리한 정신",
  "lightly-armored": "경갑 훈련",
  "lucky": "행운아",
  "mage-slayer": "마법사 살해자",
  "martial-weapon-training": "군용 무기 훈련",
  "medium-armor-master": "평갑 달인",
  "moderately-armored": "평갑 훈련",
  "mounted-combatant": "기마 전투원",
  "musician": "음악가",
  "observant": "관찰력",
  "piercer": "관통자",
  "poisoner": "독 제조자",
  "polearm-master": "장병기 달인",
  "protection": "보호",
  "resilient": "회복력",
  "ritual-caster": "의식 시전자",
  "sentinel": "파수꾼",
  "shadow-touched": "그림자의 손길",
  "sharpshooter": "명사수",
  "shield-master": "방패 달인",
  "skill-expert": "기술 전문가",
  "skulker": "잠행자",
  "slasher": "참격자",
  "speedy": "쾌속",
  "spell-sniper": "주문 저격수",
  "tavern-brawler": "선술집 싸움꾼",
  "telekinetic": "염동력",
  "telepathic": "텔레파시 능력",
  "thrown-weapon-fighting": "투척 무기 전투",
  "tough": "강인함",
  "unarmed-fighting": "비무장 전투",
  "war-caster": "전투 시전자",
  "weapon-master": "무기 달인",
};

const content = Object.entries(FEATS).map(([slug, spec]) => ({
  id: `effect.feat.phb2024.${slug}`,
  category: "option",
  presentation: { originalName: NAMES[slug] ?? slug, defaultLocale: "ko-KR", locales: { "ko-KR": { name: NAMES[slug] ?? slug, summary: "PHB 2024 재주의 규칙 계약" } } },
  tags: ["feat", "common-play", "phb-2024"],
  mechanics: [{
    kind: "common-play",
    config: {
      $schema: "https://simplevtt.local/schemas/common-play-contract.schema.json",
      schemaVersion: "0.2-draft",
      id: `feat:${slug}`,
      ...(spec.rules?.length || spec.pre?.length ? { entryPoints: [...(spec.rules?.length ? [{ id: "rule", invocation: "manual", operations: spec.rules }] : []), ...(spec.pre ?? [])] } : {}),
      ...(spec.hooks?.length || spec.guards?.length ? { interceptors: [...(spec.hooks ?? []), ...(spec.guards ?? [])] } : {}),
    },
  }],
}));

const module_ = {
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json",
  schemaVersion: "0.1-draft",
  moduleId: "phb-2024.feat-common-play",
  moduleVersion: "0.1-draft",
  rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR",
  source: { document: "Player's Handbook", version: "2024", license: "not-srd", srdDerived: false },
  dependencies: [{ moduleId: "phb-2024-supplement", version: "1" }],
  conflicts: [],
  capabilities: ["dnd.effect.property-modify.v1"],
  extensionPoints: [],
  content,
};

mkdirSync("content/supplements/phb-2024.feat-common-play", { recursive: true });
writeFileSync("content/supplements/phb-2024.feat-common-play/module.json", JSON.stringify(module_, null, 1));
console.log(`authored ${content.length} PHB 2024 feat contracts`);
