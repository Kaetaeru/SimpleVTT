import type { ChoiceDefinition, ChoiceSelectionMap } from "./choiceDefinition";
import { classSpellListEntries, stableSpellId } from "./spellListCatalog";

export const WARLOCK_ID = "dnd.srd521.class.warlock";

export interface PactMagicProgression {
  slotLevel: number;
  slotMaximum: number;
}

const PACT_MAGIC_BY_LEVEL: Record<number, PactMagicProgression> = {
  1:{ slotLevel:1, slotMaximum:1 }, 2:{ slotLevel:1, slotMaximum:2 },
  3:{ slotLevel:2, slotMaximum:2 }, 4:{ slotLevel:2, slotMaximum:2 },
  5:{ slotLevel:3, slotMaximum:2 }, 6:{ slotLevel:3, slotMaximum:2 },
  7:{ slotLevel:4, slotMaximum:2 }, 8:{ slotLevel:4, slotMaximum:2 },
  9:{ slotLevel:5, slotMaximum:2 }, 10:{ slotLevel:5, slotMaximum:2 },
  11:{ slotLevel:5, slotMaximum:3 }, 12:{ slotLevel:5, slotMaximum:3 }, 13:{ slotLevel:5, slotMaximum:3 },
  14:{ slotLevel:5, slotMaximum:3 }, 15:{ slotLevel:5, slotMaximum:3 }, 16:{ slotLevel:5, slotMaximum:3 },
  17:{ slotLevel:5, slotMaximum:4 }, 18:{ slotLevel:5, slotMaximum:4 }, 19:{ slotLevel:5, slotMaximum:4 }, 20:{ slotLevel:5, slotMaximum:4 },
};

export function pactMagicProgression(classLevel: number): PactMagicProgression {
  return PACT_MAGIC_BY_LEVEL[classLevel] ?? { slotLevel:0, slotMaximum:0 };
}

export type InvocationTargetKind = "none" | "damage-cantrip" | "attack-cantrip" | "origin-feat";
export interface EldritchInvocationDefinition {
  id: string;
  label: string;
  minLevel: number;
  targetKind: InvocationTargetKind;
  repeatable?: boolean;
  prerequisiteInvocationId?: string;
  description: string;
}

export const ELDRITCH_INVOCATIONS: readonly EldritchInvocationDefinition[] = [
  { id:"invocation:agonizing-blast", label:"고통스러운 폭발", minLevel:2, targetKind:"damage-cantrip", repeatable:true, description:"피해를 주는 워락 소마법 하나를 선택해 그 주문의 피해 굴림에 매력 수정치를 더합니다." },
  { id:"invocation:armor-of-shadows", label:"그림자 갑옷", minLevel:1, targetKind:"none", description:"주문 슬롯을 소비하지 않고 자신에게 Mage Armor를 시전할 수 있습니다." },
  { id:"invocation:ascendant-step", label:"승천의 발걸음", minLevel:5, targetKind:"none", description:"주문 슬롯을 소비하지 않고 자신에게 Levitate를 시전할 수 있습니다." },
  { id:"invocation:devils-sight", label:"악마의 시야", minLevel:2, targetKind:"none", description:"120피트 이내의 마법적·비마법적 어둠과 희미한 빛에서 정상적으로 볼 수 있습니다." },
  { id:"invocation:devouring-blade", label:"포식하는 칼날", minLevel:12, targetKind:"none", prerequisiteInvocationId:"invocation:thirsting-blade", description:"Thirsting Blade의 추가 공격이 한 번이 아니라 두 번의 추가 공격을 제공합니다." },
  { id:"invocation:eldritch-mind", label:"섬뜩한 정신", minLevel:1, targetKind:"none", description:"집중을 유지하기 위한 건강 내성 굴림에 이점을 얻습니다." },
  { id:"invocation:eldritch-smite", label:"섬뜩한 강타", minLevel:5, targetKind:"none", prerequisiteInvocationId:"invocation:pact-of-the-blade", description:"계약 무기로 적중했을 때 Pact Magic 슬롯을 소비해 추가 역장 피해와 넘어짐 효과를 적용할 수 있습니다." },
  { id:"invocation:eldritch-spear", label:"섬뜩한 창", minLevel:2, targetKind:"damage-cantrip", repeatable:true, description:"사거리 10피트 이상인 피해 워락 소마법 하나를 선택해 사거리를 워락 레벨의 30배 피트만큼 증가시킵니다." },
  { id:"invocation:fiendish-vigor", label:"마귀의 활력", minLevel:2, targetKind:"none", description:"주문 슬롯 없이 자신에게 False Life를 시전하며 임시 HP 주사위는 최대값을 사용합니다." },
  { id:"invocation:gaze-of-two-minds", label:"두 정신의 시선", minLevel:5, targetKind:"none", description:"접촉한 자발적 생물의 감각을 통해 지각하고 그 공간에서 주문을 시전할 수 있습니다." },
  { id:"invocation:gift-of-the-depths", label:"심해의 선물", minLevel:5, targetKind:"none", description:"수중 호흡과 수영 속도를 얻고 Water Breathing을 무료로 시전할 수 있습니다." },
  { id:"invocation:gift-of-the-protectors", label:"수호자의 선물", minLevel:9, targetKind:"none", prerequisiteInvocationId:"invocation:pact-of-the-tome", description:"Book of Shadows에 기록된 생물이 0 HP가 될 때 대신 1 HP가 되게 할 수 있습니다." },
  { id:"invocation:investment-of-the-chain-master", label:"사슬 주인의 투자", minLevel:5, targetKind:"none", prerequisiteInvocationId:"invocation:pact-of-the-chain", description:"Find Familiar로 소환한 사역마에게 강화된 이동, 공격, 피해 유형, 내성 DC와 저항 효과를 부여합니다." },
  { id:"invocation:lessons-of-the-first-ones", label:"태초의 존재의 가르침", minLevel:2, targetKind:"origin-feat", repeatable:true, description:"아직 보유하지 않은 기원 재주 하나를 얻습니다." },
  { id:"invocation:lifedrinker", label:"생명 흡수자", minLevel:9, targetKind:"none", prerequisiteInvocationId:"invocation:pact-of-the-blade", description:"계약 무기 적중 시 추가 괴저/정신/광휘 피해를 주고 히트 다이스를 소비해 HP를 회복할 수 있습니다." },
  { id:"invocation:mask-of-many-faces", label:"수많은 얼굴의 가면", minLevel:2, targetKind:"none", description:"주문 슬롯 없이 Disguise Self를 시전할 수 있습니다." },
  { id:"invocation:master-of-myriad-forms", label:"무수한 형상의 지배자", minLevel:5, targetKind:"none", description:"주문 슬롯 없이 Alter Self를 시전할 수 있습니다." },
  { id:"invocation:misty-visions", label:"안개 낀 환영", minLevel:2, targetKind:"none", description:"주문 슬롯 없이 Silent Image를 시전할 수 있습니다." },
  { id:"invocation:one-with-shadows", label:"그림자와 하나", minLevel:5, targetKind:"none", description:"희미한 빛이나 어둠 속에서 주문 슬롯 없이 자신에게 Invisibility를 시전할 수 있습니다." },
  { id:"invocation:otherworldly-leap", label:"이계의 도약", minLevel:2, targetKind:"none", description:"주문 슬롯 없이 자신에게 Jump를 시전할 수 있습니다." },
  { id:"invocation:pact-of-the-blade", label:"칼날의 계약", minLevel:1, targetKind:"none", description:"계약 무기를 소환하거나 마법 무기와 결속하고 이를 주문 시전 매개체로 사용할 수 있습니다." },
  { id:"invocation:pact-of-the-chain", label:"사슬의 계약", minLevel:1, targetKind:"none", description:"Find Familiar를 특별한 형태와 강화된 방식으로 시전할 수 있습니다." },
  { id:"invocation:pact-of-the-tome", label:"고서의 계약", minLevel:1, targetKind:"none", description:"Book of Shadows를 얻어 소마법 셋과 의식 주문 둘을 준비하고 주문 시전 매개체로 사용할 수 있습니다." },
  { id:"invocation:repelling-blast", label:"밀쳐내는 폭발", minLevel:2, targetKind:"attack-cantrip", repeatable:true, description:"공격 굴림으로 피해를 주는 워락 소마법 하나를 선택해 적중 시 대상을 10피트 밀어낼 수 있습니다." },
  { id:"invocation:thirsting-blade", label:"갈증 나는 칼날", minLevel:5, targetKind:"none", prerequisiteInvocationId:"invocation:pact-of-the-blade", description:"계약 무기로 공격 행동을 할 때 두 번 공격할 수 있습니다." },
  { id:"invocation:visions-of-distant-realms", label:"먼 영역의 환영", minLevel:9, targetKind:"none", description:"주문 슬롯 없이 Arcane Eye를 시전할 수 있습니다." },
  { id:"invocation:whispers-of-the-grave", label:"무덤의 속삭임", minLevel:7, targetKind:"none", description:"주문 슬롯 없이 Speak with Dead를 시전할 수 있습니다." },
  { id:"invocation:witch-sight", label:"마녀의 시야", minLevel:15, targetKind:"none", description:"30피트 범위의 Truesight를 얻습니다." },
];

const DAMAGE_WARLOCK_CANTRIPS = new Set(["Chill Touch","Eldritch Blast","Poison Spray","True Strike"].map(stableSpellId));
const ATTACK_WARLOCK_CANTRIPS = new Set(["Chill Touch","Eldritch Blast","True Strike"].map(stableSpellId));

export function invocationBaseId(acquisitionId: string) {
  return acquisitionId.split("|", 1)[0];
}

export function invocationTargetId(acquisitionId: string) {
  const marker = "|target=";
  const index = acquisitionId.indexOf(marker);
  return index < 0 ? undefined : acquisitionId.slice(index + marker.length);
}

export function isWarlockInvocationChoice(id: string) {
  return id.startsWith(`progression.${WARLOCK_ID}.`) && id.includes(".invocation-slot.");
}

function selectedInvocationAcquisitionIds(selections: ChoiceSelectionMap) {
  return Object.entries(selections)
    .filter(([id, value]) => isWarlockInvocationChoice(id) && value.kind === "options")
    .flatMap(([, value]) => value.kind === "options" ? value.optionIds : []);
}

function concreteInvocationOptions(args: {
  targetLevel: number;
  knownInvocationIds: string[];
  knownCantripIds: string[];
  originFeatOptions: Array<{ id: string; label: string; description?: string }>;
  selections: ChoiceSelectionMap;
}) {
  const knownConcrete = new Set(args.knownInvocationIds);
  const knownBases = new Set(args.knownInvocationIds.map(invocationBaseId));
  const selectedConcrete = selectedInvocationAcquisitionIds(args.selections);
  const selectedBases = new Set(selectedConcrete.map(invocationBaseId));
  const availableBases = new Set([...knownBases, ...selectedBases]);
  const knownCantrips = new Set(args.knownCantripIds);
  const result: Array<{ id:string; label:string; description:string; disabledReason?:string }> = [];

  for (const invocation of ELDRITCH_INVOCATIONS) {
    const prerequisiteReason = args.targetLevel < invocation.minLevel
      ? `워락 ${invocation.minLevel}레벨 이상이 필요합니다.`
      : invocation.prerequisiteInvocationId && !availableBases.has(invocation.prerequisiteInvocationId)
        ? `${ELDRITCH_INVOCATIONS.find((entry) => entry.id === invocation.prerequisiteInvocationId)?.label ?? invocation.prerequisiteInvocationId} 기원술이 필요합니다.`
        : undefined;

    if (invocation.targetKind === "damage-cantrip" || invocation.targetKind === "attack-cantrip") {
      const eligible = invocation.targetKind === "damage-cantrip" ? DAMAGE_WARLOCK_CANTRIPS : ATTACK_WARLOCK_CANTRIPS;
      for (const cantripId of args.knownCantripIds.filter((id) => eligible.has(id))) {
        const concreteId = `${invocation.id}|target=${cantripId}`;
        result.push({
          id:concreteId,
          label:`${invocation.label} · ${cantripId.split(".").at(-1)}`,
          description:invocation.description,
          disabledReason:prerequisiteReason ?? (knownConcrete.has(concreteId) || selectedConcrete.includes(concreteId) ? "이미 같은 대상에 적용한 기원술입니다." : undefined),
        });
      }
      if (![...knownCantrips].some((id) => eligible.has(id))) {
        result.push({
          id:`${invocation.id}|target=none`,
          label:invocation.label,
          description:invocation.description,
          disabledReason:prerequisiteReason ?? "현재 이 기원술의 대상이 될 수 있는 워락 소마법을 알고 있지 않습니다.",
        });
      }
      continue;
    }

    if (invocation.targetKind === "origin-feat") {
      for (const feat of args.originFeatOptions) {
        const concreteId = `${invocation.id}|target=${feat.id}`;
        result.push({
          id:concreteId,
          label:`${invocation.label} · ${feat.label}`,
          description:`${invocation.description} ${feat.description ?? ""}`.trim(),
          disabledReason:prerequisiteReason ?? (knownConcrete.has(concreteId) || selectedConcrete.includes(concreteId) ? "이미 같은 기원 재주로 이 기원술을 얻었습니다." : undefined),
        });
      }
      continue;
    }

    result.push({
      id:invocation.id,
      label:invocation.label,
      description:invocation.description,
      disabledReason:prerequisiteReason ?? (knownBases.has(invocation.id) || selectedBases.has(invocation.id) ? "이미 알고 있는 기원술입니다." : undefined),
    });
  }
  return result;
}

export function warlockInvocationChoices(args: {
  targetLevel: number;
  count: number;
  knownInvocationIds: string[];
  knownCantripIds: string[];
  originFeatOptions: Array<{ id: string; label: string; description?: string }>;
  selections: ChoiceSelectionMap;
}): ChoiceDefinition[] {
  if (args.count <= 0) return [];
  const options = concreteInvocationOptions(args);
  return Array.from({ length:args.count }, (_, index) => ({
    id:`progression.${WARLOCK_ID}.${args.targetLevel}.invocation-slot.${index + 1}`,
    label:args.count === 1 ? "섬뜩한 기원술" : `섬뜩한 기원술 ${index + 1}/${args.count}`,
    description:"현재 자격을 만족하는 섬뜩한 기원술 하나를 선택합니다. Repeatable 기원술은 대상이 concrete acquisition ID에 함께 저장됩니다.",
    kind:"feature-option" as const,
    count:1,
    required:true,
    status:"ready" as const,
    source:`워락 ${args.targetLevel}레벨 · 섬뜩한 기원술 · SRD 5.2.1`,
    options,
  }));
}

export function mysticArcanumSpellLevel(targetLevel: number) {
  return ({ 11:6, 13:7, 15:8, 17:9 } as Record<number,number>)[targetLevel];
}

export function warlockMysticArcanumChoice(args: {
  targetLevel: number;
  knownArcanumSpellIds: Record<number,string>;
  spellOptions?: Array<{ id:string; label:string; description?:string }>;
}): ChoiceDefinition | undefined {
  const spellLevel = mysticArcanumSpellLevel(args.targetLevel);
  if (!spellLevel) return undefined;
  const presentation = new Map((args.spellOptions ?? []).map((option) => [option.id, option]));
  const known = new Set(Object.values(args.knownArcanumSpellIds));
  return {
    id:`progression.${WARLOCK_ID}.${args.targetLevel}.mystic-arcanum.${spellLevel}`,
    label:`신비한 비전 · ${spellLevel}레벨 주문`,
    description:`${spellLevel}레벨 워락 주문 하나를 신비한 비전으로 선택합니다. 이 주문은 주문 슬롯 없이 한 번 시전하고 긴 휴식 후 다시 사용할 수 있습니다.`,
    kind:"spell",
    count:1,
    required:true,
    status:"ready",
    source:`워락 ${args.targetLevel}레벨 · 신비한 비전 · SRD 5.2.1`,
    options:classSpellListEntries(WARLOCK_ID).filter((entry) => entry.level === spellLevel).map((entry) => ({
      id:entry.id,
      label:presentation.get(entry.id)?.label ?? entry.nameEn,
      description:presentation.get(entry.id)?.description ?? `${spellLevel}레벨 워락 주문`,
      disabledReason:known.has(entry.id) ? "이미 다른 신비한 비전으로 선택한 주문입니다." : undefined,
    })),
  };
}
