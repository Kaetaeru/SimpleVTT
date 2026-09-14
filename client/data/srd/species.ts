/**
 * SRD 5.2.1 species — trait summaries and the choices each species asks (lineage, ancestry, legacy, skill, origin
 * feat), with the effects of every option. Korean texts are SRD summaries (descriptionSource "srd-summary").
 */
import type { SpeciesChoice } from "../../catalog/catalog";

export interface SpeciesOptionEffect {
  cantrips?: string[];
  /** Spells by total-level threshold, always prepared (cast once free per long rest). */
  spellsByLevel?: Record<number, string[]>;
  speed?: number;
  darkvision?: number;
  resistances?: string[];
  features?: Array<{ name: string; nameEn: string; description: string }>;
}

export interface SrdSpeciesData {
  description?: string;
  traits: Record<string, { name: string; nameEn: string; description: string }>;
  choices?: SpeciesChoice[];
  /** Effects keyed by choice id → option id. */
  effects?: Record<string, Record<string, SpeciesOptionEffect>>;
}

const dragon = (id: string, name: string, nameEn: string, type: string, typeKo: string): [string, { id: string; name: string; nameEn: string; summary: string }, SpeciesOptionEffect] => [
  id, { id, name, nameEn, summary: `${typeKo} 피해 · 브레스 무기와 저항` }, { resistances: [type], features: [{ name: `${name}의 혈통`, nameEn: `${nameEn} Ancestry`, description: `브레스 무기와 피해 저항의 피해 유형이 ${typeKo}입니다.` }] },
];
const DRAGONS = [
  dragon("black", "흑룡", "Black", "acid", "산성"), dragon("blue", "청룡", "Blue", "lightning", "번개"), dragon("brass", "황동룡", "Brass", "fire", "화염"),
  dragon("bronze", "청동룡", "Bronze", "lightning", "번개"), dragon("copper", "구리룡", "Copper", "acid", "산성"), dragon("gold", "금룡", "Gold", "fire", "화염"),
  dragon("green", "녹룡", "Green", "poison", "독"), dragon("red", "적룡", "Red", "fire", "화염"), dragon("silver", "은룡", "Silver", "cold", "냉기"), dragon("white", "백룡", "White", "cold", "냉기"),
];
const GIANTS: Array<[string, string, string, string]> = [
  ["cloud", "구름 거인", "Cloud", "추가 행동으로 30피트 안의 볼 수 있는 빈 공간으로 순간이동(구름의 도약)"],
  ["fire", "불 거인", "Fire", "공격 명중 시 1d10 화염 피해 추가(불의 타격)"],
  ["frost", "서리 거인", "Frost", "공격 명중 시 1d6 냉기 피해와 다음 턴 시작까지 이동 속도 10피트 감소(서리의 타격)"],
  ["hill", "언덕 거인", "Hill", "공격 명중 시 대형 이하 대상을 넘어뜨림(언덕의 무너뜨림)"],
  ["stone", "돌 거인", "Stone", "피해를 받을 때 반응으로 1d12 + 건강 수정치만큼 피해 감소(돌의 인내)"],
  ["storm", "폭풍 거인", "Storm", "60피트 안에서 피해를 받으면 반응으로 가해자에게 1d8 천둥 피해(폭풍의 천둥)"],
];

export const SRD_SPECIES: Record<string, SrdSpeciesData> = {
  "dnd.srd521.species.dragonborn": {
    traits: {
      "breath-weapon": { name: "브레스 무기", nameEn: "Breath Weapon", description: "공격 행동에서 공격 하나를 브레스로 대체합니다: 15피트 원뿔 또는 30피트 직선(5피트 폭)의 생물은 민첩 내성(DC 8 + 건강 수정치 + 숙련 보너스)에 실패하면 1d10 피해(5레벨 2d10, 11레벨 3d10, 17레벨 4d10), 성공하면 절반. 피해 유형은 혈통을 따릅니다. 긴 휴식마다 숙련 보너스만큼 사용합니다." },
      "damage-resistance": { name: "피해 저항", nameEn: "Damage Resistance", description: "혈통의 피해 유형에 저항을 얻습니다." },
      "draconic-flight": { name: "용의 비행", nameEn: "Draconic Flight", description: "5레벨부터 추가 행동으로 10분 동안 이동 속도와 같은 비행 속도를 얻는 날개를 펼칩니다. 긴 휴식마다 1회." },
    },
    choices: [{ id: "species.draconicAncestry", label: "용의 혈통", description: "브레스 무기와 저항의 피해 유형을 정합니다.", count: 1, options: DRAGONS.map(([, option]) => option) }],
    effects: { "species.draconicAncestry": Object.fromEntries(DRAGONS.map(([id, , effect]) => [id, effect])) },
  },
  "dnd.srd521.species.dwarf": {
    traits: {
      "poison-resistance": { name: "독 저항", nameEn: "Poison Resistance", description: "독 피해에 저항이 있고, 중독 상태를 피하거나 끝내는 내성 굴림에 유리를 받습니다." },
      "dwarven-toughness": { name: "드워프의 강인함", nameEn: "Dwarven Toughness", description: "최대 HP가 1 증가하고, 레벨을 얻을 때마다 1씩 더 증가합니다." },
      stonecunning: { name: "돌 감각", nameEn: "Stonecunning", description: "추가 행동으로 10분 동안 60피트 범위의 진동 감각을 얻습니다(자신과 대상이 모두 돌 표면에 닿아 있을 때). 긴 휴식마다 숙련 보너스만큼 사용합니다." },
    },
  },
  "dnd.srd521.species.elf": {
    traits: {
      "fey-ancestry": { name: "요정 혈통", nameEn: "Fey Ancestry", description: "매혹 상태를 피하거나 끝내는 내성 굴림에 유리를 받습니다." },
      trance: { name: "명상", nameEn: "Trance", description: "잠들 필요 없이 4시간의 명상으로 긴 휴식을 마칩니다. 마법으로도 잠들지 않습니다." },
      "lineage-spells": { name: "엘프 혈통", nameEn: "Elven Lineage", description: "혈통에 따라 소마법 하나와, 3레벨·5레벨에 주문 하나씩을 항상 준비합니다(긴 휴식마다 1회 무료 시전). 주문 시전 능력치는 지능·지혜·매력 중 고릅니다." },
    },
    choices: [
      { id: "species.lineage", label: "혈통", description: "드로우, 하이 엘프, 우드 엘프.", count: 1, options: [
        { id: "drow", name: "드로우", nameEn: "Drow", summary: "암시야 120피트 · Dancing Lights · 3레벨 Faerie Fire · 5레벨 Darkness" },
        { id: "high-elf", name: "하이 엘프", nameEn: "High Elf", summary: "Prestidigitation(긴 휴식마다 다른 위저드 소마법으로 교체 가능) · 3레벨 Detect Magic · 5레벨 Misty Step" },
        { id: "wood-elf", name: "우드 엘프", nameEn: "Wood Elf", summary: "이동 속도 35피트 · Druidcraft · 3레벨 Longstrider · 5레벨 Pass without Trace" },
      ] },
      { id: "species.keenSenses", label: "예리한 감각", description: "통찰·지각·생존 중 하나에 숙련을 얻습니다.", count: 1, options: [
        { id: "insight", name: "통찰", nameEn: "Insight" }, { id: "perception", name: "지각", nameEn: "Perception" }, { id: "survival", name: "생존", nameEn: "Survival" },
      ] },
      { id: "species.spellcastingAbility", label: "혈통 주문 능력치", description: "혈통 주문의 시전 능력치입니다.", count: 1, options: "spellcasting-ability" },
    ],
    effects: { "species.lineage": {
      drow: { darkvision: 120, cantrips: ["Dancing Lights"], spellsByLevel: { 3: ["Faerie Fire"], 5: ["Darkness"] } },
      "high-elf": { cantrips: ["Prestidigitation"], spellsByLevel: { 3: ["Detect Magic"], 5: ["Misty Step"] } },
      "wood-elf": { speed: 35, cantrips: ["Druidcraft"], spellsByLevel: { 3: ["Longstrider"], 5: ["Pass without Trace"] } },
    } },
  },
  "dnd.srd521.species.gnome": {
    traits: {
      "gnomish-cunning": { name: "노움의 교활함", nameEn: "Gnomish Cunning", description: "지능·지혜·매력 내성 굴림에 유리를 받습니다." },
      "lineage-traits": { name: "노움 혈통", nameEn: "Gnomish Lineage", description: "혈통에 따라 소마법과 주문을 얻습니다. 주문 시전 능력치는 지능·지혜·매력 중 고릅니다." },
    },
    choices: [
      { id: "species.lineage", label: "혈통", description: "숲 노움 또는 바위 노움.", count: 1, options: [
        { id: "forest-gnome", name: "숲 노움", nameEn: "Forest Gnome", summary: "Minor Illusion · Speak with Animals 항상 준비(긴 휴식마다 숙련 보너스만큼 무료)" },
        { id: "rock-gnome", name: "바위 노움", nameEn: "Rock Gnome", summary: "Mending · Prestidigitation · 태엽 장치(10분에 걸쳐 작은 장치 제작, 최대 3개)" },
      ] },
      { id: "species.spellcastingAbility", label: "혈통 주문 능력치", description: "혈통 주문의 시전 능력치입니다.", count: 1, options: "spellcasting-ability" },
    ],
    effects: { "species.lineage": {
      "forest-gnome": { cantrips: ["Minor Illusion"], spellsByLevel: { 1: ["Speak with Animals"] } },
      "rock-gnome": { cantrips: ["Mending", "Prestidigitation"], features: [{ name: "태엽 장치", nameEn: "Tinker", description: "Prestidigitation으로 10분에 걸쳐 작은 태엽 장치(음악 상자, 불꽃 장치 등)를 만듭니다. 최대 3개까지 유지되며 8시간 뒤 사라집니다." }] },
    } },
  },
  "dnd.srd521.species.goliath": {
    traits: {
      "giant-ancestry-power": { name: "거인 혈통", nameEn: "Giant Ancestry", description: "혈통에 따른 초자연적 능력을 긴 휴식마다 숙련 보너스만큼 씁니다." },
      "large-form": { name: "거대한 형태", nameEn: "Large Form", description: "5레벨부터 추가 행동으로 10분 동안 대형이 되어 근력 판정에 유리를 받고 이동 속도가 10피트 증가합니다. 긴 휴식마다 1회." },
      "powerful-build": { name: "강인한 체격", nameEn: "Powerful Build", description: "붙잡힘 상태를 끝내는 판정에 유리를 받고, 운반 용량을 계산할 때 한 단계 큰 크기로 칩니다." },
    },
    choices: [{ id: "species.giantAncestry", label: "거인 혈통", description: "혈통의 초자연적 능력을 고릅니다.", count: 1, options: GIANTS.map(([id, name, nameEn, summary]) => ({ id, name, nameEn, summary })) }],
    effects: { "species.giantAncestry": Object.fromEntries(GIANTS.map(([id, name, nameEn, summary]) => [id, { features: [{ name: `${name}의 힘`, nameEn: `${nameEn} Giant Power`, description: `${summary}. 긴 휴식마다 숙련 보너스만큼 씁니다.` }] }])) },
  },
  "dnd.srd521.species.halfling": {
    traits: {
      brave: { name: "용감함", nameEn: "Brave", description: "공포 상태를 피하거나 끝내는 내성 굴림에 유리를 받습니다." },
      "halfling-nimbleness": { name: "하플링의 민첩함", nameEn: "Halfling Nimbleness", description: "자신보다 큰 생물의 공간을 통과해 이동할 수 있습니다(멈출 수는 없음)." },
      luck: { name: "행운", nameEn: "Luck", description: "d20 판정에서 1이 나오면 다시 굴릴 수 있고, 새 결과를 써야 합니다." },
      "naturally-stealthy": { name: "타고난 은신", nameEn: "Naturally Stealthy", description: "자신보다 한 단계 이상 큰 생물에게 가려져 있으면 숨기 행동을 할 수 있습니다." },
    },
  },
  "dnd.srd521.species.human": {
    traits: {
      resourceful: { name: "임기응변", nameEn: "Resourceful", description: "긴 휴식을 마칠 때마다 영웅적 영감을 얻습니다." },
      skillful: { name: "숙련됨", nameEn: "Skillful", description: "원하는 기술 하나에 숙련을 얻습니다." },
      versatile: { name: "다재다능", nameEn: "Versatile", description: "원하는 기원 재주 하나를 얻습니다." },
    },
    choices: [
      { id: "species.skillProficiency", label: "숙련됨 — 기술", description: "원하는 기술 하나.", count: 1, options: "any-skill" },
      { id: "species.originFeat", label: "다재다능 — 기원 재주", description: "원하는 기원 재주 하나.", count: 1, options: "any-origin-feat" },
    ],
  },
  "dnd.srd521.species.orc": {
    traits: {
      "adrenaline-rush": { name: "아드레날린 분출", nameEn: "Adrenaline Rush", description: "추가 행동으로 질주하며 숙련 보너스만큼 임시 HP를 얻습니다. 짧은 휴식이나 긴 휴식마다 숙련 보너스만큼 씁니다." },
      "relentless-endurance": { name: "끈질긴 인내", nameEn: "Relentless Endurance", description: "HP가 0이 되어도 즉사하지 않았다면 대신 1 HP로 남을 수 있습니다. 긴 휴식마다 1회." },
    },
  },
  "dnd.srd521.species.tiefling": {
    traits: {
      "otherworldly-presence": { name: "이계의 존재감", nameEn: "Otherworldly Presence", description: "Thaumaturgy 소마법을 압니다. 유산 주문과 같은 능력치로 시전합니다." },
      "fiendish-legacy": { name: "마귀의 유산", nameEn: "Fiendish Legacy", description: "유산에 따라 피해 저항 하나, 소마법 하나, 3레벨·5레벨 주문 하나씩을 얻습니다(긴 휴식마다 1회 무료 시전). 주문 시전 능력치는 지능·지혜·매력 중 고릅니다." },
    },
    choices: [
      { id: "species.legacy", label: "유산", description: "심연·지하세계·지옥.", count: 1, options: [
        { id: "abyssal", name: "심연의 유산", nameEn: "Abyssal", summary: "독 저항 · Poison Spray · 3레벨 Ray of Sickness · 5레벨 Hold Person" },
        { id: "chthonic", name: "지하세계의 유산", nameEn: "Chthonic", summary: "괴저 저항 · Chill Touch · 3레벨 False Life · 5레벨 Ray of Enfeeblement" },
        { id: "infernal", name: "지옥의 유산", nameEn: "Infernal", summary: "화염 저항 · Fire Bolt · 3레벨 Hellish Rebuke · 5레벨 Darkness" },
      ] },
      { id: "species.spellcastingAbility", label: "유산 주문 능력치", description: "이계의 존재감과 유산 주문의 시전 능력치입니다.", count: 1, options: "spellcasting-ability" },
    ],
    effects: { "species.legacy": {
      abyssal: { resistances: ["poison"], cantrips: ["Poison Spray"], spellsByLevel: { 3: ["Ray of Sickness"], 5: ["Hold Person"] } },
      chthonic: { resistances: ["necrotic"], cantrips: ["Chill Touch"], spellsByLevel: { 3: ["False Life"], 5: ["Ray of Enfeeblement"] } },
      infernal: { resistances: ["fire"], cantrips: ["Fire Bolt"], spellsByLevel: { 3: ["Hellish Rebuke"], 5: ["Darkness"] } },
    } },
  },
};

/** Cantrips every member of the species knows regardless of choices. */
export const SPECIES_BASE_CANTRIPS: Record<string, string[]> = { "dnd.srd521.species.tiefling": ["Thaumaturgy"] };
