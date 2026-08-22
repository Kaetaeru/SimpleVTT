import type {
  InstalledCampaignCalendarProfileV1,
  InstalledCampaignProviderProfileV1,
  InstalledCampaignRationProfileV1,
  InstalledCatalogEntryV1,
} from "./installedContentContracts";

export type { InstalledCampaignCalendarProfileV1, InstalledCampaignProviderProfileV1, InstalledCampaignRationProfileV1 } from "./installedContentContracts";

export const CAMPAIGN_CALENDAR_PROFILE_CAPABILITY="campaign.calendar-profile" as const;
export const CAMPAIGN_RATION_PROFILE_CAPABILITY="campaign.ration-profile" as const;

const ROSTER_KINDS=new Set(["player-character-ref","host-preset","companion"]);
type Obj=Record<string,unknown>;

function object(value:unknown,label:string):Obj {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Obj;
}

function assertAllowedKeys(value:Obj,allowed:readonly string[],label:string){
  const allow=new Set(allowed);
  const unexpected=Object.keys(value).filter((key)=>!allow.has(key));
  if(unexpected.length) throw new Error(`${label} contains unsupported field: ${unexpected.join(", ")}`);
}

function text(value:unknown,label:string){
  if(typeof value!=="string"||!value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function integer(value:unknown,label:string,min:number,max:number){
  if(!Number.isInteger(value)||Number(value)<min||Number(value)>max) throw new Error(`${label} must be an integer from ${min} to ${max}`);
  return Number(value);
}

function textArray(value:unknown,label:string,maxLength=64){
  if(!Array.isArray(value)||value.length>maxLength) throw new Error(`${label} must be an array with at most ${maxLength} entries`);
  const result=value.map((item,index)=>text(item,`${label}[${index}]`));
  if(new Set(result).size!==result.length) throw new Error(`${label} must not contain duplicates`);
  return result;
}

function parseCalendarProfile(raw:Obj):InstalledCampaignCalendarProfileV1 {
  assertAllowedKeys(raw,["kind","defaultEra","weekdays","months","leapYear"],"calendar provider");
  const defaultEra=text(raw.defaultEra,"calendar.defaultEra");
  const weekdays=textArray(raw.weekdays,"calendar.weekdays",32);
  if(!weekdays.length) throw new Error("calendar.weekdays must contain at least one entry");
  if(!Array.isArray(raw.months)||raw.months.length<1||raw.months.length>36) throw new Error("calendar.months must contain 1 to 36 entries");
  const months=raw.months.map((item,index)=>{
    const month=object(item,`calendar.months[${index}]`);
    assertAllowedKeys(month,["id","label","days"],`calendar.months[${index}]`);
    return {id:text(month.id,`calendar.months[${index}].id`),label:text(month.label,`calendar.months[${index}].label`),days:integer(month.days,`calendar.months[${index}].days`,1,1000)};
  });
  if(new Set(months.map((month)=>month.id)).size!==months.length) throw new Error("calendar.months ids must be unique");
  let leapYear:InstalledCampaignCalendarProfileV1["leapYear"];
  if(raw.leapYear!==undefined){
    const leap=object(raw.leapYear,"calendar.leapYear");
    assertAllowedKeys(leap,["cycle","remainders","monthId","extraDays"],"calendar.leapYear");
    const cycle=integer(leap.cycle,"calendar.leapYear.cycle",1,10000);
    if(!Array.isArray(leap.remainders)||!leap.remainders.length||leap.remainders.length>cycle) throw new Error("calendar.leapYear.remainders must contain at least one cycle remainder");
    const remainders=leap.remainders.map((item,index)=>integer(item,`calendar.leapYear.remainders[${index}]`,0,cycle-1));
    if(new Set(remainders).size!==remainders.length) throw new Error("calendar.leapYear.remainders must not contain duplicates");
    const monthId=text(leap.monthId,"calendar.leapYear.monthId");
    if(!months.some((month)=>month.id===monthId)) throw new Error(`calendar.leapYear month is unknown: ${monthId}`);
    leapYear={cycle,remainders,monthId,extraDays:integer(leap.extraDays,"calendar.leapYear.extraDays",1,100)};
  }
  return {kind:"calendar",defaultEra,weekdays,months,...(leapYear?{leapYear}:{})};
}

function parseRationProfile(raw:Obj):InstalledCampaignRationProfileV1 {
  assertAllowedKeys(raw,["kind","defaultUnitsPerDay","unitsByRosterKind","shortageConsequences"],"ration provider");
  const defaultUnitsPerDay=integer(raw.defaultUnitsPerDay,"ration.defaultUnitsPerDay",0,1000);
  let unitsByRosterKind:InstalledCampaignRationProfileV1["unitsByRosterKind"];
  if(raw.unitsByRosterKind!==undefined){
    const units=object(raw.unitsByRosterKind,"ration.unitsByRosterKind");
    assertAllowedKeys(units,[...ROSTER_KINDS],"ration.unitsByRosterKind");
    unitsByRosterKind={};
    for(const [kind,value] of Object.entries(units)){
      if(!ROSTER_KINDS.has(kind)) throw new Error(`ration.unitsByRosterKind contains unsupported field: ${kind}`);
      unitsByRosterKind[kind as keyof NonNullable<InstalledCampaignRationProfileV1["unitsByRosterKind"]>]=integer(value,`ration.unitsByRosterKind.${kind}`,0,1000);
    }
  }
  let shortageConsequences:string[]|undefined;
  if(raw.shortageConsequences!==undefined) shortageConsequences=textArray(raw.shortageConsequences,"ration.shortageConsequences",32);
  return {kind:"ration",defaultUnitsPerDay,...(unitsByRosterKind?{unitsByRosterKind}:{}),...(shortageConsequences?{shortageConsequences}:{})};
}

export function parseInstalledCampaignProviderProfile(value:unknown):InstalledCampaignProviderProfileV1 {
  const raw=object(value,"Campaign provider");
  if(raw.kind==="calendar") return parseCalendarProfile(raw);
  if(raw.kind==="ration") return parseRationProfile(raw);
  throw new Error("Campaign provider kind must be calendar or ration");
}

export function providerIdForInstalledCampaignProfile(sourceId:string,contentId:string,profile:InstalledCampaignProviderProfileV1){
  const source=text(sourceId,"provider sourceId");
  const content=text(contentId,"provider contentId");
  return profile.kind==="calendar"
    ? `module.calendar-profile:${source}:${content}`
    : `module.ration-profile:${source}:${content}`;
}

export interface InstalledCampaignProviderDescriptorV1 {
  providerId:string;
  providerVersion:string;
  kind:InstalledCampaignProviderProfileV1["kind"];
  label:string;
  source:string;
  sourceId:string;
  contentId:string;
  profile:InstalledCampaignProviderProfileV1;
}

export function campaignProviderDescriptorForEntry(entry:InstalledCatalogEntryV1):InstalledCampaignProviderDescriptorV1|null {
  if(!entry.campaignProvider) return null;
  const profile=parseInstalledCampaignProviderProfile(entry.campaignProvider);
  return {
    providerId:providerIdForInstalledCampaignProfile(entry.sourceId,entry.contentId,profile),
    providerVersion:entry.version,
    kind:profile.kind,
    label:entry.nameKo,
    source:entry.source,
    sourceId:entry.sourceId,
    contentId:entry.contentId,
    profile,
  };
}

export function requiredCapabilityForCampaignProvider(profile:InstalledCampaignProviderProfileV1){
  return profile.kind==="calendar"?CAMPAIGN_CALENDAR_PROFILE_CAPABILITY:CAMPAIGN_RATION_PROFILE_CAPABILITY;
}
