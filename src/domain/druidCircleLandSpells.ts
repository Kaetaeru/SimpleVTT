import { DRUID_CIRCLE_LAND_SUBCLASS_ID } from "./druidCircleLand";
import type { CircleLandType } from "./druidCircleLandRecovery";
import { DomainEvaluationError } from "./profileEngine";
import { spellRuleMetadataById } from "./spellRuleCatalog";
import { stableSpellId } from "./spellListCatalog";

export const DRUID_CIRCLE_LAND_SPELLS_SOURCE = "feature:druid.circle-of-the-land.circle-spells";

interface CircleLandSpellRow {
  druidLevel:number;
  names:string[];
}

const LAND_SPELL_ROWS:Record<CircleLandType,CircleLandSpellRow[]> = {
  arid:[
    { druidLevel:3, names:["Blur","Burning Hands","Fire Bolt"] },
    { druidLevel:5, names:["Fireball"] },
    { druidLevel:7, names:["Blight"] },
    { druidLevel:9, names:["Wall of Stone"] },
  ],
  polar:[
    { druidLevel:3, names:["Fog Cloud","Hold Person","Ray of Frost"] },
    { druidLevel:5, names:["Sleet Storm"] },
    { druidLevel:7, names:["Ice Storm"] },
    { druidLevel:9, names:["Cone of Cold"] },
  ],
  temperate:[
    { druidLevel:3, names:["Misty Step","Shocking Grasp","Sleep"] },
    { druidLevel:5, names:["Lightning Bolt"] },
    { druidLevel:7, names:["Freedom of Movement"] },
    { druidLevel:9, names:["Tree Stride"] },
  ],
  tropical:[
    { druidLevel:3, names:["Acid Splash","Ray of Sickness","Web"] },
    { druidLevel:5, names:["Stinking Cloud"] },
    { druidLevel:7, names:["Polymorph"] },
    { druidLevel:9, names:["Insect Plague"] },
  ],
};

export interface CircleLandSpellPackage {
  landType:CircleLandType;
  cantripIds:string[];
  preparedSpellIds:string[];
  sources:Record<string,string>;
}

export interface CircleLandSpellRestState {
  revision:number;
  circleLandType?:CircleLandType;
  circleLandCantripIds?:string[];
  circleLandPreparedSpellIds?:string[];
  circleLandSpellSources?:Record<string,string>;
}

export interface CircleLandSpellRestRequest {
  expectedRevision:number;
  druidLevel:number;
  subclassId?:string;
  landType:CircleLandType;
}

export type CircleLandSpellRestResolution<T extends CircleLandSpellRestState> =
  | { status:"committed"; state:T }
  | { status:"rejected"; state:T; error:string };

function validateContext(druidLevel:number,subclassId:string|undefined) {
  if (!Number.isInteger(druidLevel) || druidLevel < 3 || druidLevel > 20) {
    throw new DomainEvaluationError("Circle Spells require Druid level 3-20");
  }
  if (subclassId !== DRUID_CIRCLE_LAND_SUBCLASS_ID) {
    throw new DomainEvaluationError("Circle Spells require the Circle of the Land subclass");
  }
}

export function circleLandSpellPackage(
  druidLevel:number,
  subclassId:string|undefined,
  landType:CircleLandType,
):CircleLandSpellPackage {
  validateContext(druidLevel,subclassId);
  const spellIds = LAND_SPELL_ROWS[landType]
    .filter((row) => druidLevel >= row.druidLevel)
    .flatMap((row) => row.names.map(stableSpellId));
  const cantripIds:string[] = [];
  const preparedSpellIds:string[] = [];
  const sources:Record<string,string> = {};
  for (const spellId of spellIds) {
    const metadata = spellRuleMetadataById(spellId);
    if (!metadata) throw new DomainEvaluationError(`Circle Spell is missing canonical spell metadata: ${spellId}`);
    if (metadata.level === 0) cantripIds.push(spellId);
    else preparedSpellIds.push(spellId);
    sources[spellId] = `${DRUID_CIRCLE_LAND_SPELLS_SOURCE}:${landType} · SRD 5.2.1`;
  }
  return { landType, cantripIds, preparedSpellIds, sources };
}

export function resolveCircleLandSpellRest<T extends CircleLandSpellRestState>(
  inputState:T,
  request:CircleLandSpellRestRequest,
):CircleLandSpellRestResolution<T> {
  try {
    if (request.expectedRevision !== inputState.revision) {
      throw new DomainEvaluationError(`revision mismatch: expected ${request.expectedRevision}, current ${inputState.revision}`);
    }
    const packageState = circleLandSpellPackage(request.druidLevel,request.subclassId,request.landType);
    const next = structuredClone(inputState) as T;
    next.revision += 1;
    next.circleLandType = packageState.landType;
    next.circleLandCantripIds = [...packageState.cantripIds];
    next.circleLandPreparedSpellIds = [...packageState.preparedSpellIds];
    next.circleLandSpellSources = { ...packageState.sources };
    return { status:"committed", state:next };
  } catch (error) {
    return {
      status:"rejected",
      state:inputState,
      error:error instanceof Error ? error.message : String(error),
    };
  }
}

export function circleLandSpellView(args:{
  baseCantripIds:string[];
  basePreparedSpellIds:string[];
  circleLandCantripIds?:string[];
  circleLandPreparedSpellIds?:string[];
}) {
  return {
    cantripIds:[...new Set([...args.baseCantripIds,...(args.circleLandCantripIds ?? [])])],
    preparedSpellIds:[...new Set([...args.basePreparedSpellIds,...(args.circleLandPreparedSpellIds ?? [])])],
  };
}
