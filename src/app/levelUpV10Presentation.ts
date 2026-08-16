import "./progressionContracts";
import type { CharacterSheet } from "./contracts";
import type { ProgressionPlan } from "./progressionContracts";
import { PROGRESSION_CATALOG, multiclassEligibility } from "../domain/progressionCatalog";

export const LEVEL_UP_ABILITIES = [
  ["str", "근력"],
  ["dex", "민첩"],
  ["con", "건강"],
  ["int", "지능"],
  ["wis", "지혜"],
  ["cha", "매력"],
] as const;

type SubclassPresentation = {
  nameEn: string;
  summary: string;
  detailLines: string[];
};

const SUBCLASS_PRESENTATIONS: Array<{ match: RegExp; presentation: SubclassPresentation }> = [
  {
    match: /광전사|berserker/i,
    presentation: {
      nameEn: "Path of the Berserker",
      summary: "격노를 전면전 압박과 끈질긴 근접 전투로 확장하는 바바리안 서브클래스입니다.",
      detailLines: ["격노 기반 공격 특성 중심", "상위 레벨에서 정신 방어·보복·위압 계열 특성으로 확장", "SRD 5.2.1 서브클래스 진행"],
    },
  },
  {
    match: /지식|lore/i,
    presentation: {
      nameEn: "College of Lore",
      summary: "폭넓은 기술과 마법 지식을 이용해 아군을 지원하고 적의 행동을 방해하는 바드 서브클래스입니다.",
      detailLines: ["기술·지식 활용 중심", "바드의 지원 및 방해 능력을 확장", "SRD 5.2.1 서브클래스 진행"],
    },
  },
  {
    match: /생명|life/i,
    presentation: {
      nameEn: "Life Domain",
      summary: "치유 주문과 생명력 회복을 강화해 파티의 생존을 책임지는 클레릭 서브클래스입니다.",
      detailLines: ["생명의 제자", "생명 권역 주문 · 생명 보존", "상위 레벨에서 축복받은 치유자와 최고의 치유로 확장"],
    },
  },
  {
    match: /대지|land/i,
    presentation: {
      nameEn: "Circle of the Land",
      summary: "대지와 환경의 마법을 활용해 주문 선택, 회복, 자연 방어를 강화하는 드루이드 서브클래스입니다.",
      detailLines: ["대지의 회합 주문 · 대지의 도움", "자연의 회복", "상위 레벨에서 자연의 수호·자연의 성역으로 확장"],
    },
  },
  {
    match: /챔피언|champion/i,
    presentation: {
      nameEn: "Champion",
      summary: "무기 전투의 치명타, 운동 능력, 전투 방식과 생존력을 꾸준히 강화하는 파이터 서브클래스입니다.",
      detailLines: ["향상된 치명타 · 비범한 운동선수", "추가 전투 방식", "상위 레벨에서 우월한 치명타·생존자로 확장"],
    },
  },
  {
    match: /열린.?손|open.?hand/i,
    presentation: {
      nameEn: "Warrior of the Open Hand",
      summary: "맨손 공격과 기동을 이용해 전장을 제어하고 근접 전투의 유연성을 높이는 몽크 서브클래스입니다.",
      detailLines: ["맨손 전투와 전장 제어 중심", "몽크의 기동성과 생존 능력을 확장", "SRD 5.2.1 서브클래스 진행"],
    },
  },
  {
    match: /헌신|devotion/i,
    presentation: {
      nameEn: "Oath of Devotion",
      summary: "신성한 무기와 보호 능력을 통해 정면 전투와 아군 방어를 강화하는 팔라딘 서브클래스입니다.",
      detailLines: ["헌신 계열 신성 능력 중심", "헌신의 오라", "상위 레벨에서 보호의 강타·성스러운 후광으로 확장"],
    },
  },
  {
    match: /사냥꾼|hunter/i,
    presentation: {
      nameEn: "Hunter",
      summary: "사냥 대상에 맞춘 공격과 방어 전술을 선택해 전투 적응력을 높이는 레인저 서브클래스입니다.",
      detailLines: ["사냥꾼 전투 선택 중심", "방어 전술", "상위 레벨에서 우월한 먹잇감·방어 특성으로 확장"],
    },
  },
  {
    match: /도둑|thief/i,
    presentation: {
      nameEn: "Thief",
      summary: "민첩한 행동과 도구 활용, 기동성을 강화해 전투와 탐험 모두에서 선택지를 넓히는 로그 서브클래스입니다.",
      detailLines: ["기동·도구 활용 중심", "로그의 행동 선택지를 확장", "SRD 5.2.1 서브클래스 진행"],
    },
  },
  {
    match: /용|draconic/i,
    presentation: {
      nameEn: "Draconic Sorcery",
      summary: "용의 마법적 혈통을 바탕으로 방어와 원소 계열 주문 운용을 강화하는 소서러 서브클래스입니다.",
      detailLines: ["용 계열 마법 정체성", "방어와 원소 주문 운용 강화", "상위 레벨의 Draconic Sorcery 특성으로 연결"],
    },
  },
  {
    match: /악마|fiend/i,
    presentation: {
      nameEn: "Fiend Patron",
      summary: "악마 후원자의 힘으로 전투 중 생존, 저항, 공격적인 마법 효과를 강화하는 워락 서브클래스입니다.",
      detailLines: ["후원자 기반 생존·공격 특성", "어둠의 존재의 행운 · 악마적 회복력", "상위 레벨에서 지옥으로 내던지기로 확장"],
    },
  },
  {
    match: /방출|evocation|evoker/i,
    presentation: {
      nameEn: "School of Evocation",
      summary: "방출 계열 주문을 더 안전하고 효과적으로 다루는 데 집중하는 위저드 서브클래스입니다.",
      detailLines: ["방출 주문 운용 중심", "아군과 함께 싸울 때의 주문 제어를 강화", "상위 레벨의 방출술 특성으로 연결"],
    },
  },
];

export function projectLevelUpSubclassPresentation(label: string, source: string): SubclassPresentation {
  const matched = SUBCLASS_PRESENTATIONS.find((entry) => entry.match.test(label));
  if (matched) return matched.presentation;
  return {
    nameEn: "",
    summary: `${label}의 SRD 서브클래스 진행을 선택합니다.`,
    detailLines: ["이 선택은 이후 해당 클래스의 서브클래스 특성 진행 기준이 됩니다.", `획득 시점 · ${source}`, "선택 후 이번 레벨의 실제 변경은 오른쪽 Before → After에서 확인할 수 있습니다."],
  };
}

export function projectLevelUpClassOptions(character:CharacterSheet) {
  const tracks=character.classLevels ?? [];
  return PROGRESSION_CATALOG.classes.map((entry)=>{
    const existing=tracks.some((track)=>track.classId===entry.id);
    const eligibility=existing
      ? { eligible:true,reason:"" }
      : multiclassEligibility(character.abilities,tracks,entry.id);
    return {
      entry,
      existing,
      eligible:eligibility.eligible,
      reason:eligibility.reason,
      currentLevel:tracks.find((track)=>track.classId===entry.id)?.level ?? 0,
    };
  });
}

export function projectLevelUpFixedHpGain(plan:ProgressionPlan) {
  return Math.max(1,Math.floor(plan.hp.hitDie/2)+1+plan.hp.constitutionModifier);
}
