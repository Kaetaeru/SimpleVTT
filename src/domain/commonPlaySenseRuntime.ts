import { DomainEvaluationError } from "./profileEngine";

export interface CommonPlaySense {
  kind:"normal-sight"|"blindsight"|"darkvision"|"tremorsense"|"truesight";
  rangeFeet?:number;
}
export interface CommonPlaySenseFacts {
  distanceFeet:number;
  light:"bright"|"dim"|"dark";
  obscurement:"none"|"light"|"heavy";
  lineOfSight:boolean;
  lineOfEffect:boolean;
  targetInvisible:boolean;
  targetHidden:boolean;
  targetAudible:boolean;
  observerCanHear:boolean;
  sharedGroundContact:boolean;
}
export interface CommonPlaySenseResolution {
  canSee:boolean;
  canHear:boolean;
  detected:boolean;
  seeingSense?:CommonPlaySense["kind"];
  detectionSources:string[];
}

function inRange(sense:CommonPlaySense,distanceFeet:number) {
  return sense.rangeFeet===undefined||distanceFeet<=sense.rangeFeet;
}

/** Resolves perception only from authoritative environment facts supplied by a provider or DM. */
export function resolveCommonPlaySenses(senses:CommonPlaySense[],facts:CommonPlaySenseFacts):CommonPlaySenseResolution {
  if(!Number.isFinite(facts.distanceFeet)||facts.distanceFeet<0) throw new DomainEvaluationError("sense distance must be a non-negative finite number");
  for(const sense of senses) if(sense.rangeFeet!==undefined&&(!Number.isFinite(sense.rangeFeet)||sense.rangeFeet<0)) throw new DomainEvaluationError("sense range must be non-negative");
  const visibleBy=senses.find((sense)=>{
    if(!inRange(sense,facts.distanceFeet)||!facts.lineOfSight) return false;
    if(sense.kind==="blindsight") return facts.lineOfEffect;
    if(sense.kind==="tremorsense") return false;
    if(sense.kind==="truesight") return facts.lineOfEffect;
    if(facts.targetInvisible||facts.targetHidden||facts.obscurement==="heavy") return false;
    if(facts.light==="dark") return sense.kind==="darkvision";
    return sense.kind==="normal-sight"||sense.kind==="darkvision";
  });
  const tremor=senses.some((sense)=>sense.kind==="tremorsense"&&inRange(sense,facts.distanceFeet)&&facts.sharedGroundContact);
  const canHear=facts.observerCanHear&&facts.targetAudible;
  const detectionSources=[...(visibleBy?[visibleBy.kind]:[]),...(tremor?["tremorsense"]:[]),...(canHear?["hearing"]:[])];
  return {canSee:Boolean(visibleBy),canHear,detected:detectionSources.length>0,seeingSense:visibleBy?.kind,detectionSources};
}
