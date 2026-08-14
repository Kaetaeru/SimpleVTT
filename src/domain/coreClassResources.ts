import type { ProgressionClassTrack } from "./progression";
import type { ResourceRecovery } from "./resources";

export const CLERIC_ID = "dnd.srd521.class.cleric";
export const PALADIN_ID = "dnd.srd521.class.paladin";
export const DRUID_ID = "dnd.srd521.class.druid";
export const FIGHTER_ID = "dnd.srd521.class.fighter";

export const CLERIC_CHANNEL_DIVINITY_RESOURCE_ID = "resource:cleric.channel-divinity";
export const CLERIC_DIVINE_INTERVENTION_RESOURCE_ID = "resource:cleric.divine-intervention";
export const PALADIN_LAY_ON_HANDS_RESOURCE_ID = "resource:paladin.lay-on-hands";
export const PALADIN_CHANNEL_DIVINITY_RESOURCE_ID = "resource:paladin.channel-divinity";
export const DRUID_WILD_SHAPE_RESOURCE_ID = "resource:druid.wild-shape";
export const DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID = "resource:druid.wild-resurgence.turn";
export const DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID = "resource:druid.wild-resurgence.long-rest";
export const FIGHTER_SECOND_WIND_RESOURCE_ID = "resource:fighter.second-wind";
export const FIGHTER_INDOMITABLE_RESOURCE_ID = "resource:fighter.indomitable";

export interface CoreClassResourceDefinition {
  classId: string;
  classLevel: number;
  resourceId: string;
  label: string;
  maximum: number;
  source: string;
  recovery: ResourceRecovery;
}

function validatedLevel(className: string, level: number) {
  if (!Number.isInteger(level) || level < 0 || level > 20) {
    throw new Error(`${className} level must be an integer from 0 to 20`);
  }
  return level;
}

export function clericChannelDivinityMaximum(level: number) {
  validatedLevel("Cleric", level);
  if (level < 2) return 0;
  if (level >= 18) return 4;
  if (level >= 6) return 3;
  return 2;
}

export function clericDivineInterventionMaximum(level: number) {
  validatedLevel("Cleric", level);
  return level >= 10 ? 1 : 0;
}

export function paladinLayOnHandsMaximum(level: number) {
  validatedLevel("Paladin", level);
  return level * 5;
}

export function paladinChannelDivinityMaximum(level: number) {
  validatedLevel("Paladin", level);
  if (level < 3) return 0;
  return level >= 11 ? 3 : 2;
}

export function druidWildShapeMaximum(level: number) {
  validatedLevel("Druid", level);
  if (level < 2) return 0;
  if (level >= 17) return 4;
  if (level >= 6) return 3;
  return 2;
}

export function fighterSecondWindMaximum(level: number) {
  validatedLevel("Fighter", level);
  if (level < 1) return 0;
  if (level >= 10) return 4;
  if (level >= 4) return 3;
  return 2;
}

export function fighterIndomitableMaximum(level: number) {
  validatedLevel("Fighter", level);
  if (level < 9) return 0;
  if (level >= 17) return 3;
  if (level >= 13) return 2;
  return 1;
}

export function coreClassResourceDefinitions(classTracks: ProgressionClassTrack[]): CoreClassResourceDefinition[] {
  const definitions: CoreClassResourceDefinition[] = [];
  const clericLevel = classTracks.find((track) => track.classId === CLERIC_ID)?.level ?? 0;
  const clericMaximum = clericChannelDivinityMaximum(clericLevel);
  if (clericMaximum > 0) {
    definitions.push({
      classId:CLERIC_ID,
      classLevel:clericLevel,
      resourceId:CLERIC_CHANNEL_DIVINITY_RESOURCE_ID,
      label:"채널 디비니티",
      maximum:clericMaximum,
      source:`클레릭 ${clericLevel}레벨 · Channel Divinity · SRD 5.2.1`,
      recovery:{ shortRest:1, longRest:"all" },
    });
  }
  const divineInterventionMaximum = clericDivineInterventionMaximum(clericLevel);
  if (divineInterventionMaximum > 0) {
    definitions.push({
      classId:CLERIC_ID,
      classLevel:clericLevel,
      resourceId:CLERIC_DIVINE_INTERVENTION_RESOURCE_ID,
      label:"Divine Intervention",
      maximum:divineInterventionMaximum,
      source:`클레릭 ${clericLevel}레벨 · Divine Intervention · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }

  const paladinLevel = classTracks.find((track) => track.classId === PALADIN_ID)?.level ?? 0;
  const layOnHandsMaximum = paladinLayOnHandsMaximum(paladinLevel);
  if (layOnHandsMaximum > 0) {
    definitions.push({
      classId:PALADIN_ID,
      classLevel:paladinLevel,
      resourceId:PALADIN_LAY_ON_HANDS_RESOURCE_ID,
      label:"Lay On Hands",
      maximum:layOnHandsMaximum,
      source:`팔라딘 ${paladinLevel}레벨 · Lay On Hands · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  const paladinMaximum = paladinChannelDivinityMaximum(paladinLevel);
  if (paladinMaximum > 0) {
    definitions.push({
      classId:PALADIN_ID,
      classLevel:paladinLevel,
      resourceId:PALADIN_CHANNEL_DIVINITY_RESOURCE_ID,
      label:"채널 디비니티",
      maximum:paladinMaximum,
      source:`팔라딘 ${paladinLevel}레벨 · Channel Divinity · SRD 5.2.1`,
      recovery:{ shortRest:1, longRest:"all" },
    });
  }

  const druidLevel = classTracks.find((track) => track.classId === DRUID_ID)?.level ?? 0;
  const wildShapeMaximum = druidWildShapeMaximum(druidLevel);
  if (wildShapeMaximum > 0) {
    definitions.push({
      classId:DRUID_ID,
      classLevel:druidLevel,
      resourceId:DRUID_WILD_SHAPE_RESOURCE_ID,
      label:"야생 변신",
      maximum:wildShapeMaximum,
      source:`드루이드 ${druidLevel}레벨 · Wild Shape · SRD 5.2.1`,
      recovery:{ shortRest:1, longRest:"all" },
    });
  }
  if (druidLevel >= 5) {
    definitions.push(
      {
        classId:DRUID_ID,
        classLevel:druidLevel,
        resourceId:DRUID_WILD_RESURGENCE_TURN_RESOURCE_ID,
        label:"야생의 재기 · 슬롯→야생 변신",
        maximum:1,
        source:`드루이드 ${druidLevel}레벨 · Wild Resurgence · SRD 5.2.1`,
        recovery:{ turnStart:"all" },
      },
      {
        classId:DRUID_ID,
        classLevel:druidLevel,
        resourceId:DRUID_WILD_RESURGENCE_LONG_REST_RESOURCE_ID,
        label:"야생의 재기 · 야생 변신→1레벨 슬롯",
        maximum:1,
        source:`드루이드 ${druidLevel}레벨 · Wild Resurgence · SRD 5.2.1`,
        recovery:{ longRest:"all" },
      },
    );
  }

  const fighterLevel = classTracks.find((track) => track.classId === FIGHTER_ID)?.level ?? 0;
  const secondWindMaximum = fighterSecondWindMaximum(fighterLevel);
  if (secondWindMaximum > 0) {
    definitions.push({
      classId:FIGHTER_ID,
      classLevel:fighterLevel,
      resourceId:FIGHTER_SECOND_WIND_RESOURCE_ID,
      label:"Second Wind",
      maximum:secondWindMaximum,
      source:`파이터 ${fighterLevel}레벨 · Second Wind · SRD 5.2.1`,
      recovery:{ shortRest:1, longRest:"all" },
    });
  }
  const indomitableMaximum = fighterIndomitableMaximum(fighterLevel);
  if (indomitableMaximum > 0) {
    definitions.push({
      classId:FIGHTER_ID,
      classLevel:fighterLevel,
      resourceId:FIGHTER_INDOMITABLE_RESOURCE_ID,
      label:"Indomitable",
      maximum:indomitableMaximum,
      source:`파이터 ${fighterLevel}레벨 · Indomitable · SRD 5.2.1`,
      recovery:{ longRest:"all" },
    });
  }
  return definitions;
}
