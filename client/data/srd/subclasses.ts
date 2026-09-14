/**
 * SRD 5.2.1 subclasses — level features and always-prepared spells (Korean summaries, descriptionSource "srd-summary").
 * Ids match the SRD subclasses module; feature ids reuse the `dnd.srd521.feature.<class>.<subclass>.<feature>` form.
 */
export interface SrdSubclassFeature { level: number; id: string; name: string; nameEn: string; description: string }
export interface SrdSubclassChoice { id: string; level: number; label: string; description: string; options: Array<{ id: string; name: string; nameEn: string; summary: string }> }
export interface SrdSubclassData {
  id: string;
  classId: string;
  name: string;
  nameEn: string;
  summary: string;
  features: SrdSubclassFeature[];
  /** Always-prepared spells by class level (English names). */
  spells?: Record<number, string[]>;
  /** A choice the subclass adds (Circle of the Land's land type, Hunter's Prey…). */
  choices?: SrdSubclassChoice[];
  /** Always-prepared spells that depend on a choice option: choiceId → optionId → level → names. */
  spellsByOption?: Record<string, Record<string, Record<number, string[]>>>;
}

const f = (subclass: string, level: number, key: string, name: string, nameEn: string, description: string): SrdSubclassFeature => ({ level, id: `dnd.srd521.feature.${subclass}.${key}`, name, nameEn, description });

export const SRD_SUBCLASSES: SrdSubclassData[] = [
  {
    id: "dnd.srd521.subclass.barbarian.path-of-the-berserker", classId: "dnd.srd521.class.barbarian", name: "광전사의 길", nameEn: "Path of the Berserker", summary: "격노를 극한까지 밀어붙이는 바바리안 서브클래스다.",
    features: [
      f("barbarian.berserker", 3, "frenzy", "광란", "Frenzy", "격노 중 무모한 공격을 쓰면, 그 턴에 처음 명중한 근력 근접 공격에 격노 피해 보너스만큼의 d6을 추가 피해로 줍니다."),
      f("barbarian.berserker", 6, "mindless-rage", "무심한 격노", "Mindless Rage", "격노 중에는 매혹과 공포 상태에 면역이며, 격노에 들어갈 때 걸려 있던 매혹·공포는 격노가 끝날 때까지 정지됩니다."),
      f("barbarian.berserker", 10, "retaliation", "보복", "Retaliation", "5피트 안의 생물이 자신에게 피해를 입히면 반응으로 그 생물에게 근접 공격을 한 번 합니다."),
      f("barbarian.berserker", 14, "intimidating-presence", "위압적인 존재감", "Intimidating Presence", "추가 행동으로 30피트 안의 생물들에게 지혜 내성(DC 8 + 숙련 보너스 + 근력 수정치)을 요구합니다. 실패하면 1분 동안 자신에게 공포 상태가 됩니다. 긴 휴식마다 1회, 또는 격노 1회를 소비해 다시 씁니다."),
    ],
  },
  {
    id: "dnd.srd521.subclass.bard.college-of-lore", classId: "dnd.srd521.class.bard", name: "지식의 학파", nameEn: "College of Lore", summary: "지식과 재치로 아군을 돕고 적을 흔드는 바드 서브클래스다.",
    features: [
      f("bard.college-of-lore", 3, "bonus-proficiencies", "추가 숙련", "Bonus Proficiencies", "원하는 기술 세 개에 숙련을 얻습니다."),
      f("bard.college-of-lore", 3, "cutting-words", "신랄한 말", "Cutting Words", "60피트 안에서 볼 수 있는 생물이 피해 굴림을 하거나 능력 판정·공격 굴림에 성공했을 때 반응으로 바드의 영감 1회를 소비해 영감 주사위를 굴린 값만큼 그 굴림에서 뺍니다."),
      f("bard.college-of-lore", 6, "magical-discoveries", "마법 발견", "Magical Discoveries", "클레릭·드루이드·위저드 주문 목록에서 주문 두 개를 골라 항상 준비합니다. 바드 레벨을 얻을 때 하나를 바꿀 수 있습니다."),
      f("bard.college-of-lore", 14, "peerless-skill", "탁월한 기술", "Peerless Skill", "능력 판정이나 공격 굴림에 실패했을 때 바드의 영감 1회를 소비해 영감 주사위를 더할 수 있습니다. 그래도 실패하면 소비하지 않은 것으로 칩니다."),
    ],
  },
  {
    id: "dnd.srd521.subclass.cleric.life-domain", classId: "dnd.srd521.class.cleric", name: "생명 권역", nameEn: "Life Domain", summary: "생명을 지키고 치유하는 클레릭 서브클래스다.",
    features: [
      f("cleric.life-domain", 3, "disciple-of-life", "생명의 제자", "Disciple of Life", "슬롯을 소비해 치유 주문을 시전하면 회복량이 2 + 주문 레벨만큼 늘어납니다."),
      f("cleric.life-domain", 3, "spells", "생명 권역 주문", "Life Domain Spells", "권역 주문을 항상 준비합니다: 3레벨 Aid·Bless·Cure Wounds·Lesser Restoration, 5레벨 Mass Healing Word·Revivify, 7레벨 Aura of Life·Death Ward, 9레벨 Greater Restoration·Mass Cure Wounds."),
      f("cleric.life-domain", 3, "preserve-life", "생명 보존", "Preserve Life", "행동으로 신성 변환 1회를 소비해 클레릭 레벨의 5배만큼의 HP를 30피트 안의 생물들에게 나눠 회복시킵니다. 한 생물은 최대 HP의 절반까지만 회복합니다."),
      f("cleric.life-domain", 6, "blessed-healer", "축복받은 치유자", "Blessed Healer", "슬롯을 소비한 치유 주문으로 자신이 아닌 생물을 치유하면 자신도 2 + 주문 레벨만큼 회복합니다."),
      f("cleric.life-domain", 17, "supreme-healing", "최고의 치유", "Supreme Healing", "주문으로 HP를 회복시킬 때 주사위를 굴리지 않고 최대값을 씁니다."),
    ],
    spells: { 3: ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"], 5: ["Mass Healing Word", "Revivify"], 7: ["Aura of Life", "Death Ward"], 9: ["Greater Restoration", "Mass Cure Wounds"] },
  },
  {
    id: "dnd.srd521.subclass.druid.circle-of-the-land", classId: "dnd.srd521.class.druid", name: "대지의 회합", nameEn: "Circle of the Land", summary: "대지의 힘을 주문으로 끌어내는 드루이드 서브클래스다.",
    features: [
      f("druid.circle-of-the-land", 3, "spells", "대지의 회합 주문", "Circle of the Land Spells", "긴 휴식을 마칠 때 대지 유형(건조·극지·온대·열대)을 고르면 그 유형의 회합 주문을 항상 준비합니다."),
      f("druid.circle-of-the-land", 3, "lands-aid", "대지의 도움", "Land's Aid", "행동으로 야생 변신 1회를 소비해 60피트 안의 한 지점을 중심으로 10피트 구체를 만듭니다. 안의 생물은 건강 내성에 실패하면 2d6 괴저 피해를 받고, 안의 생물 하나는 2d6 HP를 회복합니다. 10레벨에 3d6, 14레벨에 4d6이 됩니다."),
      f("druid.circle-of-the-land", 6, "natural-recovery", "자연의 회복", "Natural Recovery", "긴 휴식마다 1회, 회합 주문 하나를 슬롯 없이 시전할 수 있습니다. 또한 짧은 휴식을 마칠 때 소비한 슬롯을 합계 레벨이 드루이드 레벨의 절반(올림) 이하가 되도록 회복합니다(6레벨 이상 제외). 긴 휴식마다 1회."),
      f("druid.circle-of-the-land", 10, "natures-ward", "자연의 수호", "Nature's Ward", "중독 상태에 면역이며, 고른 대지 유형에 따라 피해 저항을 얻습니다: 건조 화염, 극지 냉기, 온대 번개, 열대 독."),
      f("druid.circle-of-the-land", 14, "natures-sanctuary", "자연의 성역", "Nature's Sanctuary", "행동으로 야생 변신 1회를 소비해 120피트 안에 15피트 정육면체의 영적 자연 지대를 1분간 만듭니다. 안의 자신과 아군은 절반 엄폐를 얻고 자연의 수호의 저항을 공유합니다. 추가 행동으로 지대를 60피트 옮길 수 있습니다."),
    ],
    choices: [{
      id: "subclass.land-type", level: 3, label: "대지 유형", description: "긴 휴식을 마칠 때 바꿀 수 있는 대지 유형입니다. 회합 주문과 자연의 수호의 저항이 여기서 정해집니다.",
      options: [
        { id: "arid", name: "건조", nameEn: "Arid", summary: "Blur, Burning Hands, Fire Bolt → Fireball → Blight → Wall of Stone. 저항: 화염" },
        { id: "polar", name: "극지", nameEn: "Polar", summary: "Fog Cloud, Hold Person, Ray of Frost → Sleet Storm → Ice Storm → Cone of Cold. 저항: 냉기" },
        { id: "temperate", name: "온대", nameEn: "Temperate", summary: "Misty Step, Shocking Grasp, Sleep → Lightning Bolt → Freedom of Movement → Tree Stride. 저항: 번개" },
        { id: "tropical", name: "열대", nameEn: "Tropical", summary: "Acid Splash, Ray of Sickness, Web → Stinking Cloud → Polymorph → Insect Plague. 저항: 독" },
      ],
    }],
    spellsByOption: {
      "subclass.land-type": {
        arid: { 3: ["Blur", "Burning Hands", "Fire Bolt"], 5: ["Fireball"], 7: ["Blight"], 9: ["Wall of Stone"] },
        polar: { 3: ["Fog Cloud", "Hold Person", "Ray of Frost"], 5: ["Sleet Storm"], 7: ["Ice Storm"], 9: ["Cone of Cold"] },
        temperate: { 3: ["Misty Step", "Shocking Grasp", "Sleep"], 5: ["Lightning Bolt"], 7: ["Freedom of Movement"], 9: ["Tree Stride"] },
        tropical: { 3: ["Acid Splash", "Ray of Sickness", "Web"], 5: ["Stinking Cloud"], 7: ["Polymorph"], 9: ["Insect Plague"] },
      },
    },
  },
  {
    id: "dnd.srd521.subclass.fighter.champion", classId: "dnd.srd521.class.fighter", name: "챔피언", nameEn: "Champion", summary: "순수한 무예 실력을 갈고닦는 파이터 서브클래스다.",
    features: [
      f("fighter.champion", 3, "improved-critical", "향상된 치명타", "Improved Critical", "공격 굴림에서 d20이 19나 20이면 치명타입니다."),
      f("fighter.champion", 3, "remarkable-athlete", "비범한 운동선수", "Remarkable Athlete", "이니셔티브 굴림과 근력(운동) 판정에 유리를 받습니다. 치명타를 내면 기회 공격을 유발하지 않고 이동 속도의 절반까지 이동할 수 있습니다."),
      f("fighter.champion", 7, "additional-fighting-style", "추가 전투 방식", "Additional Fighting Style", "아직 갖지 않은 전투 방식 재주 하나를 더 얻습니다."),
      f("fighter.champion", 10, "heroic-warrior", "영웅적 전사", "Heroic Warrior", "전투 중 자기 턴 시작 시 영웅적 영감이 없으면 영웅적 영감을 얻습니다."),
      f("fighter.champion", 15, "superior-critical", "우월한 치명타", "Superior Critical", "공격 굴림에서 d20이 18, 19, 20이면 치명타입니다."),
      f("fighter.champion", 18, "survivor", "생존자", "Survivor", "전투 중 자기 턴 시작 시 HP가 최대의 절반 이하이고 0이 아니면 5 + 건강 수정치만큼 회복합니다. 죽음 내성 굴림에서 18~20은 20으로 칩니다."),
    ],
  },
  {
    id: "dnd.srd521.subclass.monk.warrior-of-the-open-hand", classId: "dnd.srd521.class.monk", name: "열린 손의 전사", nameEn: "Warrior of the Open Hand", summary: "맨손 무예를 극한까지 연마하는 몽크 서브클래스다.",
    features: [
      f("monk.open-hand", 3, "open-hand-technique", "열린 손 기술", "Open Hand Technique", "폭풍 같은 공격의 맨손 타격이 명중할 때마다 효과 하나를 고릅니다: 흔들기(다음 턴 시작까지 반응 불가), 밀어내기(근력 내성 실패 시 15피트 밀어냄), 넘어뜨리기(민첩 내성 실패 시 넘어짐)."),
      f("monk.open-hand", 6, "wholeness-of-body", "심신의 완전함", "Wholeness of Body", "추가 행동으로 무예 주사위 + 지혜 수정치(최소 1)만큼 HP를 회복합니다. 긴 휴식마다 지혜 수정치(최소 1)회."),
      f("monk.open-hand", 11, "fleet-step", "빠른 걸음", "Fleet Step", "바람의 걸음이 아닌 추가 행동을 하면 그 직후 바람의 걸음을 기 점수 없이 함께 쓸 수 있습니다."),
      f("monk.open-hand", 17, "quivering-palm", "진동하는 손바닥", "Quivering Palm", "맨손 타격이 명중했을 때 기 점수 4점을 소비해 대상의 몸에 진동을 심습니다. 이후 행동으로 진동을 터뜨리면 대상은 건강 내성에 실패하면 10d12 역장 피해를, 성공하면 절반을 받습니다. 진동은 몽크 레벨만큼의 일수 동안 유지됩니다."),
    ],
  },
  {
    id: "dnd.srd521.subclass.paladin.oath-of-devotion", classId: "dnd.srd521.class.paladin", name: "헌신의 맹세", nameEn: "Oath of Devotion", summary: "정의와 명예에 헌신하는 팔라딘 서브클래스다.",
    features: [
      f("paladin.oath-of-devotion", 3, "spells", "헌신의 맹세 주문", "Oath of Devotion Spells", "맹세 주문을 항상 준비합니다: 3레벨 Protection from Evil and Good·Shield of Faith, 5레벨 Aid·Zone of Truth, 9레벨 Beacon of Hope·Dispel Magic, 13레벨 Freedom of Movement·Guardian of Faith, 17레벨 Commune·Flame Strike."),
      f("paladin.oath-of-devotion", 3, "sacred-weapon", "신성한 무기", "Sacred Weapon", "추가 행동으로 신성 변환 1회를 소비해 10분 동안 무기 하나를 축복합니다. 그 무기의 공격 굴림에 매력 수정치(최소 1)를 더하고, 무기는 20피트 밝은 빛을 냅니다. 무기 공격에 광휘 피해를 쓸 수 있습니다."),
      f("paladin.oath-of-devotion", 7, "aura-of-devotion", "헌신의 오라", "Aura of Devotion", "보호의 오라 안의 자신과 아군은 매혹 상태에 면역입니다."),
      f("paladin.oath-of-devotion", 15, "smite-of-protection", "보호의 강타", "Smite of Protection", "Divine Smite를 시전하면 다음 턴 시작까지 보호의 오라 안의 자신과 아군이 절반 엄폐를 얻습니다."),
      f("paladin.oath-of-devotion", 20, "holy-nimbus", "성스러운 후광", "Holy Nimbus", "추가 행동으로 10분 동안 30피트 밝은 빛을 내며, 자기 턴 시작마다 오라 안의 적에게 매력 수정치 + 숙련 보너스만큼 광휘 피해를 주고, 악마와 언데드의 주문에 대한 내성 굴림에 유리를 받습니다. 긴 휴식마다 1회, 또는 5레벨 슬롯을 소비해 다시 씁니다."),
    ],
    spells: { 3: ["Protection from Evil and Good", "Shield of Faith"], 5: ["Aid", "Zone of Truth"], 9: ["Beacon of Hope", "Dispel Magic"], 13: ["Freedom of Movement", "Guardian of Faith"], 17: ["Commune", "Flame Strike"] },
  },
  {
    id: "dnd.srd521.subclass.ranger.hunter", classId: "dnd.srd521.class.ranger", name: "사냥꾼", nameEn: "Hunter", summary: "위험한 먹잇감을 추적해 쓰러뜨리는 레인저 서브클래스다.",
    features: [
      f("ranger.hunter", 3, "hunters-lore", "사냥꾼의 지식", "Hunter's Lore", "Hunter's Mark로 표시한 생물의 면역·저항·취약을 알 수 있습니다."),
      f("ranger.hunter", 3, "hunters-prey", "사냥꾼의 먹잇감", "Hunter's Prey", "거상 학살자(턴당 한 번, HP가 최대보다 낮은 생물을 무기로 명중 시 1d8 추가 피해) 또는 무리 격파자(턴당 한 번, 무기 공격 뒤 첫 대상 5피트 안의 다른 생물을 같은 무기로 한 번 더 공격) 중 하나를 고릅니다. 짧은 휴식이나 긴 휴식을 마칠 때 바꿀 수 있습니다."),
      f("ranger.hunter", 7, "defensive-tactics", "방어 전술", "Defensive Tactics", "기회 공격 회피(자신을 향한 기회 공격 굴림에 불리) 또는 다중 공격 방어(피해를 받은 뒤 같은 생물의 그 턴 공격에 AC +4) 중 하나를 고릅니다. 짧은 휴식이나 긴 휴식을 마칠 때 바꿀 수 있습니다."),
      f("ranger.hunter", 11, "superior-hunters-prey", "우월한 사냥꾼의 먹잇감", "Superior Hunter's Prey", "턴당 한 번, Hunter's Mark의 추가 피해를 줄 때 표시한 대상 30피트 안에서 볼 수 있는 다른 생물 하나에게도 같은 피해를 줄 수 있습니다."),
      f("ranger.hunter", 15, "superior-hunters-defense", "우월한 사냥꾼의 방어", "Superior Hunter's Defense", "피해를 받았을 때 반응으로 그 피해 유형(그리고 다음 턴 시작까지 같은 유형)에 저항을 얻습니다."),
    ],
    choices: [
      { id: "subclass.hunters-prey", level: 3, label: "사냥꾼의 먹잇감", description: "휴식마다 바꿀 수 있는 선택입니다.", options: [
        { id: "colossus-slayer", name: "거상 학살자", nameEn: "Colossus Slayer", summary: "턴당 한 번, 상처 입은 생물에 무기 명중 시 1d8 추가 피해" },
        { id: "horde-breaker", name: "무리 격파자", nameEn: "Horde Breaker", summary: "턴당 한 번, 인접한 다른 생물에게 같은 무기로 추가 공격" },
      ] },
      { id: "subclass.defensive-tactics", level: 7, label: "방어 전술", description: "휴식마다 바꿀 수 있는 선택입니다.", options: [
        { id: "escape-the-horde", name: "기회 공격 회피", nameEn: "Escape the Horde", summary: "자신을 향한 기회 공격 굴림에 불리" },
        { id: "multiattack-defense", name: "다중 공격 방어", nameEn: "Multiattack Defense", summary: "피해를 준 생물의 그 턴 이후 공격에 AC +4" },
      ] },
    ],
  },
  {
    id: "dnd.srd521.subclass.rogue.thief", classId: "dnd.srd521.class.rogue", name: "도둑", nameEn: "Thief", summary: "손재주와 민첩함으로 보물을 손에 넣는 로그 서브클래스다.",
    features: [
      f("rogue.thief", 3, "fast-hands", "빠른 손", "Fast Hands", "교활한 행동의 추가 행동으로 손재주 판정, 도둑 도구 사용, 물건 사용 행동을 할 수 있습니다."),
      f("rogue.thief", 3, "second-story-work", "2층 작업", "Second-Story Work", "이동 속도와 같은 등반 속도를 얻고, 도움닫기 점프 거리가 민첩 수정치만큼 늘어납니다."),
      f("rogue.thief", 9, "supreme-sneak", "최고의 은신", "Supreme Sneak", "교활한 일격에 은신 공격(1d6 소비)이 추가됩니다: 숨은 상태에서 공격해도 그 턴 이동 속도의 절반 이하로만 움직이면 다음 턴이 끝날 때까지 투명 상태가 유지됩니다."),
      f("rogue.thief", 13, "use-magic-device", "마법 물건 사용", "Use Magic Device", "조율 슬롯이 하나 늘어나고, 마법 물건의 충전을 소비할 때 d6에서 6이 나오면 소비하지 않으며, 어느 클래스 목록의 주문 두루마리라도 지능(비전) 판정으로 시전을 시도할 수 있습니다."),
      f("rogue.thief", 17, "thiefs-reflexes", "도둑의 반사신경", "Thief's Reflexes", "전투의 첫 라운드에 두 번의 턴을 갖습니다. 첫 턴은 원래 이니셔티브, 두 번째 턴은 이니셔티브 −10입니다."),
    ],
    choices: [],
  },
  {
    id: "dnd.srd521.subclass.sorcerer.draconic-sorcery", classId: "dnd.srd521.class.sorcerer", name: "용혈 마법", nameEn: "Draconic Sorcery", summary: "용의 피가 흐르는 소서러 서브클래스다.",
    features: [
      f("sorcerer.draconic", 3, "draconic-resilience", "용의 회복력", "Draconic Resilience", "최대 HP가 3 늘고 이후 소서러 레벨을 얻을 때마다 1씩 더 늡니다. 갑옷을 입지 않았을 때 AC는 10 + 민첩 수정치 + 매력 수정치입니다."),
      f("sorcerer.draconic", 3, "draconic-spells", "용의 주문", "Draconic Spells", "용의 주문을 항상 준비합니다: 3레벨 Alter Self·Chromatic Orb·Command·Dragon's Breath, 5레벨 Fear·Fly, 7레벨 Arcane Eye·Charm Monster, 9레벨 Legend Lore·Summon Dragon."),
      f("sorcerer.draconic", 6, "elemental-affinity", "원소의 친화력", "Elemental Affinity", "산성·냉기·화염·번개·독 중 하나를 골라 그 피해에 저항을 얻고, 그 유형의 피해를 주는 주문을 시전할 때 피해 굴림 하나에 매력 수정치를 더합니다."),
      f("sorcerer.draconic", 14, "dragon-wings", "용의 날개", "Dragon Wings", "추가 행동으로 1시간 동안 60피트 비행 속도를 주는 날개를 펼칩니다. 긴 휴식마다 1회, 또는 마법 점수 3점을 소비해 다시 씁니다."),
      f("sorcerer.draconic", 18, "dragon-companion", "용 동료", "Dragon Companion", "Summon Dragon을 슬롯 없이 시전할 수 있고(긴 휴식마다 1회), 이 주문에 집중하지 않아도 되며 1분간 지속됩니다."),
    ],
    choices: [{ id: "subclass.elemental-affinity", level: 6, label: "원소의 친화력", description: "저항과 주문 피해 보너스를 받는 피해 유형입니다.", options: [
      { id: "acid", name: "산성", nameEn: "Acid", summary: "산성 저항, 산성 주문 피해 +매력" },
      { id: "cold", name: "냉기", nameEn: "Cold", summary: "냉기 저항, 냉기 주문 피해 +매력" },
      { id: "fire", name: "화염", nameEn: "Fire", summary: "화염 저항, 화염 주문 피해 +매력" },
      { id: "lightning", name: "번개", nameEn: "Lightning", summary: "번개 저항, 번개 주문 피해 +매력" },
      { id: "poison", name: "독", nameEn: "Poison", summary: "독 저항, 독 주문 피해 +매력" },
    ] }],
    spells: { 3: ["Alter Self", "Chromatic Orb", "Command", "Dragon's Breath"], 5: ["Fear", "Fly"], 7: ["Arcane Eye", "Charm Monster"], 9: ["Legend Lore", "Summon Dragon"] },
  },
  {
    id: "dnd.srd521.subclass.warlock.fiend-patron", classId: "dnd.srd521.class.warlock", name: "마귀 후원자", nameEn: "Fiend Patron", summary: "하계의 존재와 계약한 워락 서브클래스다.",
    features: [
      f("warlock.fiend", 3, "dark-ones-blessing", "어둠의 존재의 축복", "Dark One's Blessing", "적대적 생물의 HP를 0으로 만들면 매력 수정치 + 워락 레벨만큼 임시 HP를 얻습니다. 5피트 안에서 다른 이가 적을 쓰러뜨려도 얻습니다."),
      f("warlock.fiend", 3, "fiend-spells", "마귀 주문", "Fiend Spells", "마귀 주문을 항상 준비합니다: 3레벨 Burning Hands·Command·Scorching Ray·Suggestion, 5레벨 Fireball·Stinking Cloud, 7레벨 Fire Shield·Wall of Fire, 9레벨 Geas·Insect Plague."),
      f("warlock.fiend", 6, "dark-ones-own-luck", "어둠의 존재의 행운", "Dark One's Own Luck", "능력 판정이나 내성 굴림을 한 뒤 d10을 굴려 더할 수 있습니다. 긴 휴식마다 매력 수정치(최소 1)회."),
      f("warlock.fiend", 10, "fiendish-resilience", "마귀의 회복력", "Fiendish Resilience", "짧은 휴식이나 긴 휴식을 마칠 때 피해 유형 하나를 골라 다음 휴식까지 그 피해에 저항을 얻습니다(마법 무기나 은 무기 제외)."),
      f("warlock.fiend", 14, "hurl-through-hell", "지옥으로 내던지기", "Hurl Through Hell", "공격 굴림로 명중한 생물을 하계로 순간이동시킵니다. 대상은 다음 턴 종료 시 돌아오며 마귀가 아니면 8d10 정신 피해를 받습니다. 긴 휴식마다 1회, 또는 계약 마법 슬롯을 소비해 다시 씁니다."),
    ],
    spells: { 3: ["Burning Hands", "Command", "Scorching Ray", "Suggestion"], 5: ["Fireball", "Stinking Cloud"], 7: ["Fire Shield", "Wall of Fire"], 9: ["Geas", "Insect Plague"] },
  },
  {
    id: "dnd.srd521.subclass.wizard.evoker", classId: "dnd.srd521.class.wizard", name: "방출술사", nameEn: "Evoker", summary: "파괴적인 에너지를 다루는 위저드 서브클래스다.",
    features: [
      f("wizard.evoker", 3, "evocation-savant", "방출술 전문가", "Evocation Savant", "1레벨 이상 방출술 위저드 주문 두 개를 골라 주문서에 무료로 적습니다. 이후 위저드 레벨을 얻을 때마다 방출술 주문 하나를 무료로 더 적을 수 있습니다."),
      f("wizard.evoker", 3, "potent-cantrip", "강력한 소마법", "Potent Cantrip", "피해를 주는 소마법에 대상이 내성에 성공하거나 공격이 빗나가도 피해의 절반을 줍니다(추가 효과는 없음)."),
      f("wizard.evoker", 6, "sculpt-spells", "주문 조형", "Sculpt Spells", "방출술 주문을 시전할 때 1 + 주문 레벨명까지의 생물을 골라 그들이 내성에 자동 성공하고 피해를 받지 않게 합니다."),
      f("wizard.evoker", 10, "empowered-evocation", "강화된 방출술", "Empowered Evocation", "방출술 위저드 주문의 피해 굴림 하나에 지능 수정치를 더합니다."),
      f("wizard.evoker", 14, "overchannel", "과부하", "Overchannel", "1~5레벨 위저드 주문을 시전할 때 피해를 최대값으로 낼 수 있습니다. 긴 휴식 뒤 첫 사용은 무해하지만, 이후 사용마다 주문 레벨당 2d12 괴저 피해를 받고 다음 긴 휴식 전까지 사용할 때마다 d12가 하나씩 늘어납니다."),
    ],
  },
];
